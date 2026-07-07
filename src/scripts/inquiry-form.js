(function () {
  var INQUIRY_URL = window.location.origin + "/api/website/queries";
  var PROVISIONING_API_URL = window.location.origin + "/api/provisioning/environments";
  var SUPPORT_URL = "https://anybuild.ai/support.html";
  var RECAPTCHA_SITE_KEY = "6LdpodcqAAAAAECRuoE_Mb5vAlmeWfWTIZPwohQy";
  var RECAPTCHA_ACTION = "submit";

  var MSG_SUCCESS =
    "Message sent! We appreciate you contacting us and will respond as soon as possible.";
  var MSG_ERROR = "We are sorry, there was an error! Please try again later";
  var TRIAL_MSG_ERROR =
    "We could not submit your request. Please try again later or contact support.";

  /** Hero → Try: draft in sessionStorage; URL must include draft_source=session to read (avoids stale data). */
  var HERO_DRAFT_STORAGE_KEY = "anybuild_hero_draft";
  var PROMPT_INTENT = "ai";
  var PROMPT_SUBJECT = "Application prompt";
  var PROMPT_MESSAGE_LABEL = "Your application prompt";
  var TRIAL_INTEREST_SUBJECT = "App interests";

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

  function loadHeroDraft() {
    try {
      var p = new URLSearchParams(window.location.search);
      if (p.get("draft_source") === "session") {
        var stored = trimOrNull(sessionStorage.getItem(HERO_DRAFT_STORAGE_KEY));
        if (stored) {
          sessionStorage.removeItem(HERO_DRAFT_STORAGE_KEY);
          return stored;
        }
      }
      return trimOrNull(p.get("draft"));
    } catch (e) {
      return null;
    }
  }

  function isPromptIntent(intent) {
    return String(intent || "").trim().toLowerCase() === PROMPT_INTENT;
  }

  function applyPromptMode(form, promptText) {
    var subjectField = form.querySelector("[data-inquiry-subject-field]");
    var messageLabel = form.querySelector("#inquiry-message-label");
    var promptHelp = form.querySelector("[data-inquiry-prompt-help]");
    var messageInput = form.querySelector('[name="message"]');
    var lead = form.querySelector(".inquiry-form-lead");

    if (!messageLabel || !messageInput) return false;

    messageInput.value = promptText;

    if (!messageLabel.dataset.enquiryLabelHtml) {
      messageLabel.dataset.enquiryLabelHtml = messageLabel.innerHTML;
    }
    messageLabel.innerHTML =
      PROMPT_MESSAGE_LABEL + ' <span class="inquiry-req" aria-hidden="true">*</span>';

    if (subjectField) subjectField.hidden = true;
    if (promptHelp) promptHelp.hidden = false;
    form.classList.add("is-prompt-mode");

    if (lead) {
      lead.textContent =
        "Confirm your details below. We will use your prompt to start the build when your environment is ready.";
    }

    return true;
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
    lines.push("First name: " + payload.first_name);
    lines.push("Last name: " + payload.last_name);
    lines.push("Email: " + payload.email);
    if (payload.password) lines.push("Password: [provided]");
    if (payload.organization) lines.push("Organization: " + payload.organization);
    if (payload.priority) lines.push("Priority: " + payload.priority);
    if (payload.subject) lines.push("Subject: " + payload.subject);
    lines.push("---");
    if (isPromptIntent(payload.intent)) {
      lines.push("Prompt:");
    } else if (payload.form_mode === "trial") {
      lines.push("App interests:");
    }
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

  function setFeedbackHtml(el, html, kind) {
    if (!el) return;
    el.hidden = false;
    el.innerHTML = html;
    el.classList.remove("is-success", "is-error");
    if (kind) el.classList.add(kind);
  }

  function clearFeedback(el) {
    if (!el) return;
    el.hidden = true;
    el.textContent = "";
    el.innerHTML = "";
    el.classList.remove("is-success", "is-error");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function newIdempotencyKey() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }

    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (ch) {
      var rand = (Math.random() * 16) | 0;
      var val = ch === "x" ? rand : (rand & 0x3) | 0x8;
      return val.toString(16);
    });
  }

  function buildProvisioningBody(payload) {
    var body = {
      idempotency_key: newIdempotencyKey(),
      first_name: payload.first_name,
      last_name: payload.last_name,
      email: payload.email,
      password: payload.password,
      package_id: payload.package_id,
      intent: payload.intent,
    };

    if (payload.organization) {
      body.organization = payload.organization;
    }
    if (payload.message) {
      body.message = payload.message;
    }

    return body;
  }

  function buildTrialSuccessHtml(firstName, referenceId) {
    var name = escapeHtml(firstName || "there");
    var refBlock = referenceId
      ? "<p>Reference: <strong>" + escapeHtml(referenceId) + "</strong>. Quote this if you <a href=\"" +
        escapeHtml(SUPPORT_URL) +
        "\">contact support</a>.</p>"
      : "<p>If you need help, <a href=\"" +
        escapeHtml(SUPPORT_URL) +
        "\">contact support</a>.</p>";

    return (
      "<p><strong>Request received. Thank you, " +
      name +
      ".</strong></p>" +
      "<p>We will email you when your Anybuild environment is ready. This usually takes a few minutes.</p>" +
      "<p>Check your inbox and spam or promotions folder for a message with an activation link.</p>" +
      refBlock
    );
  }

  function showTrialSuccess(form, feedback, data, firstName) {
    setFeedbackHtml(
      feedback,
      buildTrialSuccessHtml(firstName, data && data.reference_id),
      "is-success"
    );

    form.classList.add("is-trial-submitted");

    var submitBtn = form.querySelector(".inquiry-submit");
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.removeAttribute("aria-busy");
    }

    if (feedback) feedback.focus();
  }

  function parseJsonResponse(text) {
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch (e) {
      return {};
    }
  }

  function extractErrorMessage(data, fallback) {
    if (data && data.message) {
      return String(data.message);
    }
    return fallback;
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
      var passwordField = form.querySelector('[name="password"]');
      var password = passwordField
        ? String(fd.get("password") || "").trim()
        : null;
      var priorityField = form.querySelector('[name="priority"]');
      var priority = priorityField ? trimOrNull(fd.get("priority")) : null;

      var intentRaw = String(fd.get("intent") || "").trim();
      var intent = intentRaw || mode;

      var subject = String(fd.get("subject") || "").trim();
      var message = String(fd.get("message") || "").trim();
      if (isPromptIntent(intent)) {
        subject = PROMPT_SUBJECT;
      } else if (mode === "trial" && !subject) {
        subject = TRIAL_INTEREST_SUBJECT;
      }

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
        first_name: String(fd.get("first_name") || "").trim(),
        last_name: String(fd.get("last_name") || "").trim(),
        email: String(fd.get("email") || "").trim(),
        password: password,
        organization: organization,
        priority: priority,
        subject: subject,
        message: message,
        package_id: packageId,
        include_smartsuite: includeSmartsuite,
      };

      payload.compiled_body = compileBody(payload);

      var isTrial = mode === "trial";

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.setAttribute("aria-busy", "true");
        submitBtn.textContent = isTrial ? "Submitting request…" : "Sending…";
      }

      function sendWithToken(token) {
        var trialCompleted = false;

        if (isTrial) {
          if (!payload.password) {
            setFeedback(
              feedback,
              "Password is required to create your workspace.",
              "is-error"
            );
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.removeAttribute("aria-busy");
              submitBtn.textContent = defaultLabel;
            }
            return;
          }

          if (!payload.package_id) {
            setFeedback(feedback, "Please select a package.", "is-error");
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.removeAttribute("aria-busy");
              submitBtn.textContent = defaultLabel;
            }
            return;
          }

          var provisioningBody = buildProvisioningBody(payload);
          if (token) {
            provisioningBody["g-recaptcha-response"] = token;
          }

          fetch(PROVISIONING_API_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json, text/plain, */*",
            },
            mode: "cors",
            credentials: "omit",
            body: JSON.stringify(provisioningBody),
          })
            .then(function (res) {
              return res.text().then(function (text) {
                var data = parseJsonResponse(text);
                if (res.ok) {
                  showTrialSuccess(form, feedback, data, payload.first_name);
                  trialCompleted = true;
                  return;
                }

                setFeedback(
                  feedback,
                  extractErrorMessage(data, TRIAL_MSG_ERROR),
                  "is-error"
                );
              });
            })
            .catch(function () {
              setFeedback(feedback, TRIAL_MSG_ERROR, "is-error");
            })
            .finally(function () {
              if (trialCompleted) return;
              if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.removeAttribute("aria-busy");
                submitBtn.textContent = defaultLabel;
              }
            });

          return;
        }

        var body = {
          cmd: "record_enquiry",
          type: mode,
          first_name: payload.first_name,
          last_name: payload.last_name,
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
        if (payload.password) body.password = payload.password;
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
    var params = new URLSearchParams(window.location.search);
    if (intentInput) {
      var qIntent = trimOrNull(params.get("intent"));
      if (qIntent) intentInput.value = qIntent;
    }

    var mode = form.getAttribute("data-form-mode") || "";
    var intent = intentInput
      ? String(intentInput.value || "").trim() || mode
      : mode;

    if (mode === "trial") {
      var pkgSelect = form.querySelector('select[name="package_id"]');
      if (pkgSelect) {
        syncTrialPackageSelect(form);
      }
    }

    var msg = form.querySelector('[name="message"]');
    var draft = loadHeroDraft();
    if (msg && draft && !String(msg.value || "").trim()) {
      msg.value = draft;
    }

    if (isPromptIntent(intent) && msg && String(msg.value || "").trim()) {
      applyPromptMode(form, String(msg.value).trim());
    }
  });
})();
