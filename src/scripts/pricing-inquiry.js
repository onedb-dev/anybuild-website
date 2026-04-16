(function () {
  function isSmartsuitePackageId(pkg) {
    return pkg === "crm" || pkg === "erp" || pkg === "smartsuite";
  }

  var root = document.querySelector(".page-pricing");
  if (!root) return;

  root.addEventListener(
    "click",
    function (e) {
      var a = e.target.closest && e.target.closest("a[href]");
      if (!a || !root.contains(a)) return;

      var raw = a.getAttribute("href");
      if (!raw) return;

      var pathPart = raw.split("#")[0].split("?")[0].toLowerCase();
      if (!pathPart.endsWith("try.html") && !pathPart.endsWith("demo.html")) return;

      var tab = document.querySelector(".page-pricing .pricing-switch-tab.is-active");
      var tabKey = tab && tab.getAttribute("data-pricing-tab");

      var pkg = (a.getAttribute("data-pricing-package") || "").toLowerCase();
      var includeSmartsuite = false;

      if (!pkg) {
        if (tabKey === "smartsuite") {
          pkg = "crm";
          includeSmartsuite = true;
        } else {
          pkg = "trial";
          includeSmartsuite = false;
        }
      } else {
        includeSmartsuite = isSmartsuitePackageId(pkg) || tabKey === "smartsuite";
      }

      try {
        var url = new URL(a.getAttribute("href"), window.location.href);
        url.searchParams.set("package", pkg);
        if (includeSmartsuite) {
          url.searchParams.set("include_smartsuite", "true");
        } else {
          url.searchParams.delete("include_smartsuite");
        }
        a.href = url.toString();
      } catch (err2) {}
    },
    true
  );
})();
