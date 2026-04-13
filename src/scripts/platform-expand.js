(function () {
  document.querySelectorAll(".page-platform .card-expandable").forEach(function (card) {
    function toggle() {
      card.classList.toggle("is-open");
    }
    card.addEventListener("click", function (e) {
      if (e.target.closest("a")) return;
      toggle();
    });
    card.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });
  });
})();
