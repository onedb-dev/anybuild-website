(function () {
  var STATUS_URL = window.location.origin + "/api/provisioning/environments";
  var USE_FAKE_STATUS = false;
  var POLL_INTERVAL_MS = 10000;
  var FAKE_READY_AFTER_MS = 30000;
  var FAKE_ACTIVATION_AFTER_MS = 12000;
  var TIMEOUT_MS = 5 * 60 * 1000;
  var REDIRECT_DELAY_MS = 1000;

  var TIMEOUT_MESSAGE =
    "This is taking longer than expected. Please try again later or contact support if the problem continues.";
  var MISSING_TOKEN_MESSAGE =
    "This activation link is invalid or incomplete. Open the link from your activation email, or contact support if you need help.";
  var IN_PROGRESS_LABEL = "In progress";

  var pageStart = Date.now();
  var pollTimer = null;
  var finished = false;

  function trimOrNull(s) {
    if (s == null) return null;
    var t = String(s).trim();
    return t === "" ? null : t;
  }

  function getToken() {
    try {
      return trimOrNull(new URLSearchParams(window.location.search).get("token"));
    } catch (e) {
      return null;
    }
  }

  function getFakeRedirectUrl() {
    try {
      var fromQuery = trimOrNull(
        new URLSearchParams(window.location.search).get("redirect_url")
      );
      if (fromQuery) return fromQuery;
    } catch (e) {}
    return "https://anybuild.ai/platform.html";
  }

  function fakeFetchStatus() {
    return new Promise(function (resolve) {
      var elapsed = Date.now() - pageStart;
      if (elapsed >= FAKE_READY_AFTER_MS) {
        resolve({
          status: "ready",
          redirect_url: getFakeRedirectUrl(),
        });
      } else if (elapsed >= FAKE_ACTIVATION_AFTER_MS) {
        resolve({ status: "activating", phase: "activation" });
      } else {
        resolve({ status: "activating", phase: "provisioning" });
      }
    });
  }

  function fetchStatus(token) {
    if (USE_FAKE_STATUS) {
      return fakeFetchStatus();
    }

    var url = STATUS_URL + "?token=" + encodeURIComponent(token || "");

    return fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json, text/plain, */*",
      },
      mode: "cors",
      credentials: "omit",
    }).then(function (res) {
      return res.text().then(function (text) {
        var data = {};
        if (text) {
          try {
            data = JSON.parse(text);
          } catch (e) {
            throw new Error("Invalid status response.");
          }
        }
        if (!res.ok) {
          throw new Error(data.message || "Could not check activation status.");
        }
        return data;
      });
    });
  }

  function setStepState(root, stepId, state, statusText) {
    var step = root.querySelector('[data-activate-step="' + stepId + '"]');
    if (!step) return;
    step.setAttribute("data-state", state);
    step.setAttribute("aria-current", state === "in_progress" ? "step" : "false");

    var statusEl = step.querySelector("[data-activate-step-status]");
    if (!statusEl) return;
    if (state === "in_progress") {
      statusEl.textContent = statusText || IN_PROGRESS_LABEL;
      statusEl.hidden = false;
    } else {
      statusEl.textContent = "";
      statusEl.hidden = true;
    }
  }

  function resetSteps(root) {
    setStepState(root, "provision", "pending");
    setStepState(root, "activate", "pending");
    setStepState(root, "redirect", "pending");
  }

  function resolvePhase(data) {
    var phase = String((data && data.phase) || "").toLowerCase();
    if (phase === "activation" || phase === "provisioning") {
      return phase;
    }
    return "provisioning";
  }

  function applyActivatingSteps(root, phase) {
    if (phase === "activation") {
      setStepState(root, "provision", "done");
      setStepState(root, "activate", "in_progress", IN_PROGRESS_LABEL);
      setStepState(root, "redirect", "pending");
      return;
    }

    setStepState(root, "provision", "in_progress", IN_PROGRESS_LABEL);
    setStepState(root, "activate", "pending");
    setStepState(root, "redirect", "pending");
  }

  function showFeedback(root, message, kind) {
    var feedback = root.querySelector("[data-activate-feedback]");
    var actions = root.querySelector("[data-activate-actions]");
    if (!feedback) return;
    feedback.hidden = false;
    feedback.textContent = message;
    feedback.classList.remove("is-success", "is-error");
    if (kind) feedback.classList.add(kind);
    if (actions) actions.hidden = kind !== "is-error";
    feedback.focus();
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function handleTerminalError(root, message) {
    if (finished) return;
    finished = true;
    stopPolling();
    resetSteps(root);

    var lead = root.querySelector("[data-activate-lead]");
    if (lead) {
      lead.textContent = "We could not finish preparing your workspace.";
    }

    showFeedback(root, message, "is-error");
  }

  function handleReady(root, redirectUrl) {
    if (finished) return;
    finished = true;
    stopPolling();

    setStepState(root, "provision", "done");
    setStepState(root, "activate", "done");
    setStepState(root, "redirect", "in_progress", IN_PROGRESS_LABEL);

    var lead = root.querySelector("[data-activate-lead]");
    if (lead) {
      lead.textContent = "Your workspace is ready. Redirecting you now.";
    }

    setTimeout(function () {
      if (redirectUrl) {
        window.location.href = redirectUrl;
        return;
      }

      resetSteps(root);
      showFeedback(
        root,
        "Your workspace is ready, but no redirect URL was provided. Please contact support.",
        "is-error"
      );
    }, REDIRECT_DELAY_MS);
  }

  function handleTimeout(root) {
    handleTerminalError(root, TIMEOUT_MESSAGE);
  }

  function poll(root, token) {
    if (finished) return;

    if (Date.now() - pageStart >= TIMEOUT_MS) {
      handleTimeout(root);
      return;
    }

    fetchStatus(token)
      .then(function (data) {
        if (finished) return;

        var status = String((data && data.status) || "").toLowerCase();

        if (status === "ready") {
          handleReady(root, data.redirect_url);
          return;
        }

        if (status === "failed" || status === "error" || status === "expired") {
          handleTerminalError(root, data.message || TIMEOUT_MESSAGE);
          return;
        }

        applyActivatingSteps(root, resolvePhase(data));
      })
      .catch(function () {
        if (finished) return;
        if (Date.now() - pageStart >= TIMEOUT_MS) {
          handleTimeout(root);
        }
      });
  }

  document.querySelectorAll("[data-activate-status]").forEach(function (root) {
    var token = getToken();

    if (!token && !USE_FAKE_STATUS) {
      handleTerminalError(root, MISSING_TOKEN_MESSAGE);
      return;
    }

    resetSteps(root);
    poll(root, token);
    pollTimer = setInterval(function () {
      poll(root, token);
    }, POLL_INTERVAL_MS);
  });
})();
