(function () {
  var STORAGE_PROMPT = "anybuild_inquiry_intent_prompt";
  var TRY_URL = "try.html?intent=ai";
  var promptInput = document.getElementById("prompt-input");
  var generateLink = document.getElementById("hero-generate-ai");
  var promptError = document.getElementById("hero-prompt-error");

  function clearPromptError() {
    if (!promptInput) return;
    promptInput.classList.remove("is-invalid");
    promptInput.setAttribute("aria-invalid", "false");
    if (promptError) {
      promptError.hidden = true;
    }
  }

  function showPromptError() {
    if (!promptInput) return;
    promptInput.classList.add("is-invalid");
    promptInput.setAttribute("aria-invalid", "true");
    if (promptError) {
      promptError.hidden = false;
    }
    promptInput.focus();
  }

  if (promptInput) {
    document.querySelectorAll(".example").forEach(function (btn) {
      btn.addEventListener("click", function () {
        promptInput.value = btn.getAttribute("data-full") || btn.textContent || "";
        clearPromptError();
      });
    });

    promptInput.addEventListener("input", clearPromptError);
  }

  if (generateLink && promptInput) {
    generateLink.addEventListener("click", function (e) {
      e.preventDefault();
      var v = (promptInput.value || "").trim();
      if (!v) {
        showPromptError();
        return;
      }
      clearPromptError();
      try {
        sessionStorage.setItem(STORAGE_PROMPT, v);
      } catch (err) {}
      window.location.href = TRY_URL;
    });
  }
})();
