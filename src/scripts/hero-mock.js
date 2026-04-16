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

  var storyboard = document.querySelector("[data-storyboard]");
  if (storyboard) {
    var frameNodes = storyboard.querySelectorAll(".storyboard-data [data-src]");
    var dots = storyboard.querySelectorAll("[data-storyboard-jump]");
    var imageEl = storyboard.querySelector("[data-storyboard-image]");
    var stepEl = storyboard.querySelector("[data-storyboard-step]");
    var titleEl = storyboard.querySelector("[data-storyboard-title]");
    var descEl = storyboard.querySelector("[data-storyboard-desc]");
    var current = 0;
    var timer = null;
    var processTransitionMs = 420;
    var transitionLock = false;
    var isPaused = false;
    var isModalOpen = false;
    var clickPauseTimeout = null;
    var processDelayMs = 4800;
    var liveDelayMs = 2400;
    var introDelayMs = 3600;
    var DEFAULT_OBJECT_POSITION = "center top";

    function readFrame(i) {
      var node = frameNodes[i];
      if (!node) return null;
      return {
        src: node.getAttribute("data-src") || "",
        fullSrc: node.getAttribute("data-full-src") || "",
        objectPosition:
          node.getAttribute("data-object-position") || null,
        step: node.getAttribute("data-step") || "",
        title: node.getAttribute("data-title") || "",
        desc: node.getAttribute("data-desc") || "",
        kind: node.getAttribute("data-kind") || "",
      };
    }

    function render(i) {
      var frame = readFrame(i);
      if (!frame || !imageEl || !stepEl || !titleEl || !descEl) return;
      current = i;
      var isIntro = frame.kind === "intro";
      storyboard.classList.toggle("is-intro", isIntro);

      imageEl.src = frame.src;
      imageEl.alt = frame.title;
      if (frame.objectPosition) {
        imageEl.style.objectPosition = frame.objectPosition;
      } else {
        imageEl.style.objectPosition = DEFAULT_OBJECT_POSITION;
      }
      var isLive = frame.kind === "live";
      if (isLive || !frame.step) {
        stepEl.textContent = "";
        stepEl.hidden = true;
      } else {
        stepEl.hidden = false;
        stepEl.textContent = frame.step;
      }
      titleEl.textContent = frame.title;
      descEl.textContent = frame.desc;
      dots.forEach(function (dot, idx) {
        var active = idx === i;
        dot.classList.toggle("is-active", active);
        dot.setAttribute("aria-selected", active ? "true" : "false");
      });
    }

    function transitionTo(i, done) {
      if (transitionLock || i === current) {
        if (done) done();
        return;
      }
      transitionLock = true;

      var target = readFrame(i);
      var isLive = target && target.kind === "live";
      var isIntro = target && target.kind === "intro";

      if (isLive || isIntro) {
        // Live business frames should just replace screens.
        storyboard.classList.remove("is-fading-out");
        render(i);
        transitionLock = false;
        if (done) done();
        return;
      }

      storyboard.classList.add("is-fading-out");
      setTimeout(function () {
        render(i);
        requestAnimationFrame(function () {
          storyboard.classList.remove("is-fading-out");
          setTimeout(function () {
            transitionLock = false;
            if (done) done();
          }, processTransitionMs);
        });
      }, processTransitionMs);
    }

    function schedule() {
      if (timer) clearTimeout(timer);
      if (frameNodes.length < 2 || isPaused) return;

      var frame = readFrame(current);
      var isLive = frame && frame.kind === "live";
      var isIntro = frame && frame.kind === "intro";
      var delayMs = isIntro ? introDelayMs : isLive ? liveDelayMs : processDelayMs;

      timer = setTimeout(function () {
        var next = (current + 1) % frameNodes.length;
        transitionTo(next, schedule);
      }, delayMs);
    }

    function pauseAutoplay() {
      isPaused = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    }

    function resumeAutoplay() {
      if (isModalOpen) return;
      isPaused = false;
      schedule();
    }

    dots.forEach(function (dot) {
      dot.addEventListener("click", function () {
        pauseAutoplay();
        var i = Number(dot.getAttribute("data-storyboard-jump"));
        if (Number.isNaN(i)) return;
        transitionTo(i);
      });
    });

    function openModalForFrame(i) {
      var frame = readFrame(i);
      if (!frame) return;
      if (frame.kind === "intro") return;

      var modal = storyboard.querySelector("[data-storyboard-modal]");
      if (!modal) return;

      var modalImg = storyboard.querySelector(
        "[data-storyboard-modal-image]"
      );
      var modalStep = storyboard.querySelector("[data-storyboard-modal-step]");
      var modalTitle = storyboard.querySelector("[data-storyboard-modal-title]");
      var modalDesc = storyboard.querySelector("[data-storyboard-modal-desc]");
      var modalCloseBtn = storyboard.querySelector("[data-storyboard-close]");

      if (!modalImg || !modalStep || !modalTitle || !modalDesc) return;

      isModalOpen = true;
      pauseAutoplay();

      modalImg.src = frame.src;
      if (frame.fullSrc) modalImg.src = frame.fullSrc;
      modalImg.alt = frame.title;
      if (frame.kind === "live" || !frame.step) {
        modalStep.textContent = "";
        modalStep.hidden = true;
      } else {
        modalStep.hidden = false;
        modalStep.textContent = frame.step;
      }
      modalTitle.textContent = frame.title;
      modalDesc.textContent = frame.desc;

      modal.hidden = false;
      modal.setAttribute("aria-hidden", "false");

      if (
        modalCloseBtn &&
        typeof modalCloseBtn.focus === "function"
      ) {
        modalCloseBtn.focus();
      }
    }

    function closeModal() {
      var modal = storyboard.querySelector("[data-storyboard-modal]");
      if (!modal) return;
      modal.hidden = true;
      modal.setAttribute("aria-hidden", "true");
      isModalOpen = false;
      resumeAutoplay();
    }

    var openBtn = storyboard.querySelector("[data-storyboard-open]");
    if (openBtn) {
      openBtn.addEventListener("click", function () {
        openModalForFrame(current);
      });
    }

    var modal = storyboard.querySelector("[data-storyboard-modal]");
    if (modal) {
      var modalCloseBtn2 = storyboard.querySelector("[data-storyboard-close]");
      if (modalCloseBtn2) {
        modalCloseBtn2.addEventListener("click", function (e) {
          e.preventDefault();
          closeModal();
        });
      }

      modal.addEventListener("click", function (e) {
        if (e.target === modal) closeModal();
      });

      document.addEventListener("keydown", function (e) {
        if (!isModalOpen) return;
        if (e.key === "Escape") {
          e.preventDefault();
          closeModal();
        }
      });
    }

    storyboard.addEventListener("mouseenter", pauseAutoplay);
    storyboard.addEventListener("mouseleave", resumeAutoplay);
    storyboard.addEventListener("focusin", pauseAutoplay);
    storyboard.addEventListener("focusout", function () {
      // Resume only when focus leaves the whole component.
      if (!storyboard.contains(document.activeElement)) {
        resumeAutoplay();
      }
    });
    storyboard.addEventListener("pointerdown", function () {
      pauseAutoplay();
      if (clickPauseTimeout) clearTimeout(clickPauseTimeout);
      // Keep the frame visible for reading after click/tap.
      clickPauseTimeout = setTimeout(function () {
        if (
          !isModalOpen &&
          !storyboard.matches(":hover") &&
          !storyboard.contains(document.activeElement)
        ) {
          resumeAutoplay();
        }
      }, 9000);
    });

    render(0);
    // Intro isn't a "step": hide its dot and keep it out of tab order.
    dots.forEach(function (dot, idx) {
      var frame = readFrame(idx);
      if (frame && frame.kind === "intro") {
        dot.hidden = true;
        dot.setAttribute("aria-hidden", "true");
        dot.tabIndex = -1;
      }
    });
    schedule();
  }
})();
