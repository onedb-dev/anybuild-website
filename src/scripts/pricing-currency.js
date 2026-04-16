(function () {
  "use strict";

  var STORAGE_KEY = "anybuild_pricing_currency";

  /**
   * Mid-market reference rates (EUR → foreign), rounded. Refresh when you update list prices.
   * Snapshot aligned with public ECB/market tables (e.g. ~2026 Q1).
   */
  var EUR_TO_GBP = 0.8765;
  var EUR_TO_USD = 1.1818;

  function getStored() {
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      if (v === "eur" || v === "gbp" || v === "usd") return v;
    } catch (e) {}
    return "eur";
  }

  function setStored(c) {
    try {
      localStorage.setItem(STORAGE_KEY, c);
    } catch (e) {}
  }

  function fmtInt(n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function convert(amountEur, currency) {
    var a = Number(amountEur);
    if (Number.isNaN(a)) return 0;
    if (currency === "eur") return a;
    if (currency === "gbp") return Math.round(a * EUR_TO_GBP);
    return Math.round(a * EUR_TO_USD);
  }

  function formatLabel(amountEur, currency, kind) {
    var n = convert(amountEur, currency);
    var suffix = "";
    if (kind === "monthly") {
      suffix = n === 0 ? "" : " / mo";
    }
    if (currency === "eur") return "€" + fmtInt(n) + suffix;
    if (currency === "gbp") return "£" + fmtInt(n) + suffix;
    return "$" + fmtInt(n) + suffix;
  }

  function apply(currency) {
    var nodes = document.querySelectorAll(".js-pricing-amount");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var eur = el.getAttribute("data-amount-eur");
      if (eur === null || eur === "") continue;
      var kind = el.getAttribute("data-price-kind") || "plain";
      el.textContent = formatLabel(eur, currency, kind);
    }

    var btns = document.querySelectorAll(".currency-switch-btn");
    for (var j = 0; j < btns.length; j++) {
      var b = btns[j];
      var is = b.getAttribute("data-currency") === currency;
      b.classList.toggle("is-active", is);
      b.setAttribute("aria-pressed", is ? "true" : "false");
    }
  }

  function init() {
    var bar = document.querySelector(".currency-switch");
    if (!bar) return;

    apply(getStored());

    bar.addEventListener("click", function (ev) {
      var t = ev.target && ev.target.closest ? ev.target.closest("[data-currency]") : null;
      if (!t || !bar.contains(t)) return;
      var c = t.getAttribute("data-currency");
      if (c !== "eur" && c !== "gbp" && c !== "usd") return;
      setStored(c);
      apply(c);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
