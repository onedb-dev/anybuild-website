(function () {
  var toggle = document.getElementById("nav-toggle");
  var panel = document.getElementById("nav-mobile-menu");
  if (!toggle || !panel) return;

  var backdrop = panel.querySelector(".nav-mobile-backdrop");

  function open() {
    panel.classList.add("is-open");
    toggle.classList.add("is-open");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Close menu");
    panel.setAttribute("aria-hidden", "false");
    document.body.classList.add("nav-open");
  }

  function close() {
    panel.classList.remove("is-open");
    toggle.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open menu");
    panel.setAttribute("aria-hidden", "true");
    document.body.classList.remove("nav-open");
    panel.querySelectorAll(".nav-mobile-group").forEach(function (group) {
      group.classList.remove("is-expanded");
      var b = group.querySelector(".nav-mobile-group-toggle");
      if (b) b.setAttribute("aria-expanded", "false");
      var p = group.querySelector(".nav-mobile-group-panel");
      if (p) p.hidden = true;
    });
  }

  function toggleMenu() {
    if (panel.classList.contains("is-open")) close();
    else open();
  }

  toggle.addEventListener("click", function (e) {
    e.stopPropagation();
    toggleMenu();
  });

  if (backdrop) {
    backdrop.addEventListener("click", close);
  }

  panel.addEventListener("click", function (e) {
    var btn = e.target.closest(".nav-mobile-group-toggle");
    if (!btn || !panel.contains(btn)) return;
    e.stopPropagation();
    var group = btn.closest(".nav-mobile-group");
    if (!group) return;
    group.classList.toggle("is-expanded");
    var expanded = group.classList.contains("is-expanded");
    btn.setAttribute("aria-expanded", expanded ? "true" : "false");
    var subPanel = group.querySelector(".nav-mobile-group-panel");
    if (subPanel) subPanel.hidden = !expanded;
  });

  panel.querySelectorAll(".nav-mobile-link, .nav-mobile-sublink, .nav-mobile-btn").forEach(function (el) {
    el.addEventListener("click", close);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && panel.classList.contains("is-open")) close();
  });

  window.addEventListener("resize", function () {
    if (window.innerWidth > 1080) close();
  });
})();
