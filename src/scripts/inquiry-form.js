(function () {
  var INQUIRY_URL = "/api/v1/inquiry";

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

      fetch(INQUIRY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      })
        .then(function (res) {
          return res.text().then(function (text) {
            var parsed = null;
            if (text) {
              try {
                parsed = JSON.parse(text);
              } catch (err) {
                parsed = null;
              }
            }
            return { res: res, parsed: parsed, text: text };
          });
        })
        .then(function (out) {
          if (out.res.ok) {
            setFeedback(
              feedback,
              "Thank you. We have received your request and will follow up by email.",
              "is-success"
            );
            form.reset();
            if (feedback) feedback.focus();
          } else {
            var errMsg =
              (out.parsed && (out.parsed.message || out.parsed.error)) ||
              (out.text && out.text.slice(0, 280)) ||
              "Something went wrong. Please try again or email us directly.";
            setFeedback(feedback, errMsg, "is-error");
          }
        })
        .catch(function () {
          setFeedback(
            feedback,
            "We could not reach the server. Check your connection and try again.",
            "is-error"
          );
        })
        .finally(function () {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.removeAttribute("aria-busy");
            submitBtn.textContent = defaultLabel;
          }
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
