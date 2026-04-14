(function () {
  var INQUIRY_URL = "https://anybuild.ai/api/website/queries";
  var RECAPTCHA_SITE_KEY = "6LdpodcqAAAAAECRuoE_Mb5vAlmeWfWTIZPwohQy";
  var RECAPTCHA_ACTION = "submit";

  var MSG_SUCCESS =
    "Message sent! We appreciate you contacting us and will respond as soon as possible.";
  var MSG_ERROR = "We are sorry, there was an error! Please try again later";

  var AREA_LABELS = {
    contact: "General contact",
    support: "Platform support",
    careers: "Careers inquiry",
    demo: "Demo request",
    trial: "Trial access",
  };

  function trimOrNull(s) {
    if (s == null) return null;
    var t = String(s).trim();
    return t === "" ? null : t;
  }

  function compileBody(payload) {
    var lines = [
      "Area: " + payload.area_label + " (" + payload.form_mode + ")",
      "Intent: " + payload.intent,
      "Submitted from: " + payload.page_url,
      "Path: " + payload.page_path,
    ];
    if (payload.referrer) lines.push("Referrer: " + payload.referrer);
    lines.push("Submitted at: " + payload.submitted_at);
    lines.push("---");
    lines.push("Name: " + payload.full_name);
    lines.push("Email: " + payload.email);
    if (payload.organization) lines.push("Organization: " + payload.organization);
    if (payload.priority) lines.push("Priority: " + payload.priority);
    lines.push("Subject: " + payload.subject);
    lines.push("---");
    lines.push(payload.message);
    return lines.join("\n");
  }

  function setFeedback(el, text, kind) {
    if (!el) return;
    el.hidden = false;
    el.textContent = text;
    el.classList.remove("is-success", "is-error");
    if (kind) el.classList.add(kind);
  }

  function clearFeedback(el) {
    if (!el) return;
    el.hidden = true;
    el.textContent = "";
    el.classList.remove("is-success", "is-error");
  }

  document.querySelectorAll("[data-inquiry-form]").forEach(function (form) {
    var feedback = form.querySelector("[data-inquiry-feedback]");
    var submitBtn = form.querySelector(".inquiry-submit");
    var defaultLabel = submitBtn ? submitBtn.textContent : "";

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      clearFeedback(feedback);

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      var mode = form.getAttribute("data-form-mode") || "contact";
      var fd = new FormData(form);
      var organization = trimOrNull(fd.get("organization"));
      var priorityField = form.querySelector('[name="priority"]');
      var priority = priorityField ? trimOrNull(fd.get("priority")) : null;

      var intentRaw = String(fd.get("intent") || "").trim();
      var intent = intentRaw || mode;

      var payload = {
        cmd: "record_enquiry",
        form_mode: mode,
        area: mode,
        area_label: AREA_LABELS[mode] || mode,
        intent: intent,
        page_url: window.location.href,
        page_path: window.location.pathname,
        referrer: trimOrNull(document.referrer),
        submitted_at: new Date().toISOString(),
        full_name: String(fd.get("full_name") || "").trim(),
        email: String(fd.get("email") || "").trim(),
        organization: organization,
        priority: priority,
        subject: String(fd.get("subject") || "").trim(),
        message: String(fd.get("message") || "").trim(),
      };

      payload.compiled_body = compileBody(payload);

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.setAttribute("aria-busy", "true");
        submitBtn.textContent = "Sending…";
      }

      function sendWithToken(token) {
        var params = new URLSearchParams();
        params.append("cmd", "record_enquiry");
        params.append("type", mode);
        if (token) {
          params.append("g-recaptcha-response", token);
        }
        params.append("full_name", payload.full_name);
        params.append("email", payload.email);
        params.append("subject", payload.subject);
        params.append("message", payload.message);
        params.append("intent", payload.intent);
        params.append("page_url", payload.page_url);
        params.append("page_path", payload.page_path);
        if (payload.organization) params.append("organization", payload.organization);
        if (payload.priority) params.append("priority", payload.priority);
        if (payload.referrer) params.append("referrer", payload.referrer);
        params.append("submitted_at", payload.submitted_at);
        params.append("compiled_body", payload.compiled_body);

        fetch(INQUIRY_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json, text/plain, */*",
          },
          mode: "cors",
          credentials: "omit",
          body: params.toString(),
        })
          .then(function (res) {
            return res.text().then(function () {
              if (res.status === 200) {
                setFeedback(feedback, MSG_SUCCESS, "is-success");
                form.reset();
                if (feedback) feedback.focus();
              } else {
                setFeedback(feedback, MSG_ERROR, "is-error");
              }
            });
          })
          .catch(function () {
            setFeedback(feedback, MSG_ERROR, "is-error");
          })
          .finally(function () {
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.removeAttribute("aria-busy");
              submitBtn.textContent = defaultLabel;
            }
          });
      }

      if (typeof grecaptcha === "undefined" || !grecaptcha.execute) {
        setFeedback(
          feedback,
          "Security check failed to load. Please refresh the page.",
          "is-error"
        );
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.removeAttribute("aria-busy");
          submitBtn.textContent = defaultLabel;
        }
        return;
      }

      grecaptcha.ready(function () {
        grecaptcha
          .execute(RECAPTCHA_SITE_KEY, { action: RECAPTCHA_ACTION })
          .then(function (token) {
            sendWithToken(token);
          })
          .catch(function () {
            setFeedback(
              feedback,
              "Could not verify reCAPTCHA. Please try again.",
              "is-error"
            );
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.removeAttribute("aria-busy");
              submitBtn.textContent = defaultLabel;
            }
          });
      });
    });
  });

  var STORAGE_PROMPT = "anybuild_inquiry_intent_prompt";

  document.querySelectorAll("[data-inquiry-form]").forEach(function (form) {
    var intentInput = form.querySelector('input[name="intent"]');
    if (intentInput) {
      var params = new URLSearchParams(window.location.search);
      var qIntent = trimOrNull(params.get("intent"));
      if (qIntent) intentInput.value = qIntent;
    }

    var mode = form.getAttribute("data-form-mode") || "";
    if (mode !== "trial") return;

    var draft = null;
    try {
      draft = sessionStorage.getItem(STORAGE_PROMPT);
    } catch (e) {}
    if (!draft) return;

    var msg = form.querySelector('[name="message"]');
    if (msg && !String(msg.value || "").trim()) {
      msg.value = draft;
    }
    try {
      sessionStorage.removeItem(STORAGE_PROMPT);
    } catch (e) {}
  });
})();
