(function () {
  var INQUIRY_URL = "https://anybuild.ai/api/website/queries";
  var RECAPTCHA_SITE_KEY = "6LdpodcqAAAAAECRuoE_Mb5vAlmeWfWTIZPwohQy";
  var RECAPTCHA_ACTION = "submit";

  var MSG_SUCCESS =
    "Message sent! We appreciate you contacting us and will respond as soon as possible.";
  var MSG_ERROR = "We are sorry, there was an error! Please try again later";

  /** Hero → Try: draft in sessionStorage; URL must include draft_source=session to read (avoids stale data). */
  var HERO_DRAFT_STORAGE_KEY = "anybuild_hero_draft";

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

  function isSmartsuitePackageId(pkg) {
    return pkg === "crm" || pkg === "erp" || pkg === "smartsuite";
  }

  function getPackageFromUrlOnly() {
    try {
      var q = trimOrNull(new URLSearchParams(window.location.search).get("package"));
      return q ? q.toLowerCase() : null;
    } catch (e) {
      return null;
    }
  }

  /** true / false if present in query string; null if param omitted (not the same as false). */
  function getIncludeSmartsuiteFromUrlOnly() {
    try {
      var params = new URLSearchParams(window.location.search);
      if (!params.has("include_smartsuite")) return null;
      var v = params.get("include_smartsuite");
      if (v === "true" || v === "1") return true;
      if (v === "false" || v === "0") return false;
      return null;
    } catch (e) {
      return null;
    }
  }

  function syncTrialPackageSelect(form) {
    var sel = form.querySelector('select[name="package_id"]');
    if (!sel) return;
    var tpl = document.getElementById("inquiry-package-options-smartsuite");
    if (!window.__inquiryAnybuildPackageOptionsHtml) {
      window.__inquiryAnybuildPackageOptionsHtml = sel.innerHTML;
    }

    var pkgFromUrl = getPackageFromUrlOnly();
    var pkgFromUrlLower = pkgFromUrl;
    var incFromUrl = getIncludeSmartsuiteFromUrlOnly();

    var useSmartsuite;
    if (pkgFromUrlLower) {
      useSmartsuite = isSmartsuitePackageId(pkgFromUrlLower);
    } else {
      useSmartsuite = incFromUrl === true;
    }

    if (useSmartsuite && tpl) {
      sel.innerHTML = "";
      sel.appendChild(document.importNode(tpl.content, true));
    } else {
      sel.innerHTML = window.__inquiryAnybuildPackageOptionsHtml;
    }

    var pre;
    if (pkgFromUrlLower) {
      pre = pkgFromUrlLower;
    } else {
      pre = incFromUrl === true ? "smartsuite" : "trial";
    }

    sel.value = pre;
    if (sel.value !== pre && sel.options.length) {
      sel.selectedIndex = 0;
    }
  }

  function compileBody(payload) {
    var lines = [];
    if (payload.package_id) {
      lines.push("Package id: " + payload.package_id);
    }
    lines.push("Include Smartsuite: " + (payload.include_smartsuite ? "true" : "false"));
    lines.push("---");
    lines.push(
      "Area: " + payload.area_label + " (" + payload.form_mode + ")",
      "Intent: " + payload.intent,
      "Submitted from: " + payload.page_url,
      "Path: " + payload.page_path
    );
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

      var packageSelect = form.querySelector('select[name="package_id"]');
      var packageId = packageSelect
        ? trimOrNull(fd.get("package_id"))
        : null;
      if (!packageId && (mode === "trial" || mode === "demo")) {
        packageId = getPackageFromUrlOnly();
      }
      if (packageId) {
        packageId = packageId.toLowerCase();
      }
      var includeSmartsuite = isSmartsuitePackageId(packageId || "");

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
        package_id: packageId,
        include_smartsuite: includeSmartsuite,
      };

      payload.compiled_body = compileBody(payload);

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.setAttribute("aria-busy", "true");
        submitBtn.textContent = "Sending…";
      }

      function sendWithToken(token) {
        var body = {
          cmd: "record_enquiry",
          type: mode,
          full_name: payload.full_name,
          email: payload.email,
          subject: payload.subject,
          message: payload.message,
          intent: payload.intent,
          page_url: payload.page_url,
          page_path: payload.page_path,
          submitted_at: payload.submitted_at,
          include_smartsuite: payload.include_smartsuite,
          compiled_body: payload.compiled_body,
        };
        if (token) {
          body["g-recaptcha-response"] = token;
        }
        if (payload.organization) body.organization = payload.organization;
        if (payload.priority) body.priority = payload.priority;
        if (payload.referrer) body.referrer = payload.referrer;
        if (payload.package_id) body.package_id = payload.package_id;

        fetch(INQUIRY_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json, text/plain, */*",
          },
          mode: "cors",
          credentials: "omit",
          body: JSON.stringify(body),
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

  document.querySelectorAll("[data-inquiry-form]").forEach(function (form) {
    var intentInput = form.querySelector('input[name="intent"]');
    if (intentInput) {
      var params = new URLSearchParams(window.location.search);
      var qIntent = trimOrNull(params.get("intent"));
      if (qIntent) intentInput.value = qIntent;
    }

    var mode = form.getAttribute("data-form-mode") || "";
    if (mode !== "trial") return;

    var pkgSelect = form.querySelector('select[name="package_id"]');
    if (pkgSelect) {
      syncTrialPackageSelect(form);
    }

    var msg = form.querySelector('[name="message"]');
    if (msg && !String(msg.value || "").trim()) {
      try {
        var p = new URLSearchParams(window.location.search);
        if (p.get("draft_source") === "session") {
          var stored = trimOrNull(sessionStorage.getItem(HERO_DRAFT_STORAGE_KEY));
          if (stored) {
            msg.value = stored;
            sessionStorage.removeItem(HERO_DRAFT_STORAGE_KEY);
          }
        } else {
          var draft = trimOrNull(p.get("draft"));
          if (draft) msg.value = draft;
        }
      } catch (e) {}
    }
  });
})();
