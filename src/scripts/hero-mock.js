(function () {
  var HERO_DRAFT_STORAGE_KEY = "anybuild_hero_draft";

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
        sessionStorage.setItem(HERO_DRAFT_STORAGE_KEY, v);
        var url = new URL("try.html", window.location.href);
        url.searchParams.set("intent", "ai");
        url.searchParams.set("draft_source", "session");
        window.location.href = url.toString();
      } catch (err) {
        try {
          var fallback = new URL("try.html", window.location.href);
          fallback.searchParams.set("intent", "ai");
          fallback.searchParams.set("draft", v);
          window.location.href = fallback.toString();
        } catch (err2) {
          window.location.href = "try.html?intent=ai";
        }
      }
    });
  }
})();
