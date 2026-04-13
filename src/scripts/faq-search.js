(function () {
  var root = document.querySelector(".page-faq");
  if (!root) return;

  var input = root.querySelector('[data-faq-search-input]');
  var clearBtn = root.querySelector('[data-faq-search-clear]');
  var items = Array.prototype.slice.call(root.querySelectorAll("[data-faq-item]"));
  var empty = root.querySelector("[data-faq-empty]");
  if (!input || !items.length || !empty) return;

  items.forEach(function (item) {
    var summary = item.querySelector("summary");
    var answer = item.querySelector(".faq-answer p");
    if (!summary || !answer) return;
    item.setAttribute("data-faq-question", summary.textContent || "");
    item.setAttribute("data-faq-answer", answer.textContent || "");
  });

  function normalize(value) {
    return (value || "").toLowerCase().trim();
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function highlightText(text, term) {
    var safeText = escapeHtml(text);
    if (!term) return safeText;
    var regex = new RegExp("(" + escapeRegex(term) + ")", "gi");
    return safeText.replace(regex, "<mark>$1</mark>");
  }

  function applyFilter() {
    var term = normalize(input.value);
    var visible = 0;

    items.forEach(function (item) {
      var haystack = normalize(item.getAttribute("data-faq-search"));
      var summary = item.querySelector("summary");
      var answer = item.querySelector(".faq-answer p");
      var rawQuestion = item.getAttribute("data-faq-question") || "";
      var rawAnswer = item.getAttribute("data-faq-answer") || "";
      var match = !term || haystack.indexOf(term) !== -1;
      item.hidden = !match;
      if (match) visible += 1;
      if (term && match) item.setAttribute("open", "open");
      if (!term || !match) item.removeAttribute("open");

      if (summary) summary.innerHTML = highlightText(rawQuestion, term && match ? term : "");
      if (answer) answer.innerHTML = highlightText(rawAnswer, term && match ? term : "");
    });

    empty.hidden = visible > 0;
    clearBtn.hidden = !term;
  }

  input.addEventListener("input", applyFilter);
  clearBtn.addEventListener("click", function () {
    input.value = "";
    applyFilter();
    input.focus();
  });

  applyFilter();
})();
