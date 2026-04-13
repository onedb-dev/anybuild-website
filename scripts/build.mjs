import Handlebars from "handlebars";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

execSync("node scripts/wrap-terms.mjs", { cwd: root, stdio: "inherit" });
execSync("node scripts/wrap-privacy.mjs", { cwd: root, stdio: "inherit" });

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function write(rel, content) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function loadJson(rel) {
  return JSON.parse(read(rel));
}

function registerPartials() {
  const dir = path.join(root, "src/partials");
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".hbs")) continue;
    const name = file.replace(/\.hbs$/, "");
    Handlebars.registerPartial(name, read(path.join("src/partials", file)));
  }
}

registerPartials();

const distDir = path.join(root, "dist");
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true });
}

const layout = Handlebars.compile(read("src/layouts/default.hbs"));
const site = loadJson("src/data/site.json");

function canonicalUrl(siteUrl, htmlFilename) {
  if (!siteUrl || typeof siteUrl !== "string") return "";
  const base = siteUrl.replace(/\/$/, "");
  if (htmlFilename === "index.html") return `${base}/`;
  return `${base}/${htmlFilename}`;
}

function buildJsonLd(merged, filename) {
  const base = (merged.siteUrl || "").replace(/\/$/, "");
  if (!base) return "";
  const pageUrl =
    merged.canonicalUrl || canonicalUrl(merged.siteUrl, filename) || `${base}/`;
  const brandName = merged.brand?.name || "Anybuild";
  const orgName = merged.footer?.company?.legalName || "Onedb Service Delivery Ltd";
  const desc = merged.effectiveDescription || merged.description || "";

  const graph = [
    {
      "@type": "Organization",
      "@id": `${base}/#organization`,
      name: orgName,
      legalName: orgName,
      url: `${base}/`,
    },
    {
      "@type": "WebSite",
      "@id": `${base}/#website`,
      name: brandName,
      url: `${base}/`,
      publisher: { "@id": `${base}/#organization` },
    },
    {
      "@type": "WebPage",
      "@id": `${pageUrl}#webpage`,
      name: merged.title,
      ...(desc ? { description: desc } : {}),
      url: pageUrl,
      isPartOf: { "@id": `${base}/#website` },
    },
  ];

  const payload = { "@context": "https://schema.org", "@graph": graph };
  return JSON.stringify(payload).replace(/</g, "\\u003c");
}

function buildPage(filename, bodyTemplateRel, pageData = {}) {
  const merged = {
    ...site,
    ...pageData,
    meta: { ...(site.meta || {}), ...(pageData.meta || {}) },
  };
  merged.effectiveDescription = (
    merged.description ||
    site.defaultDescription ||
    ""
  ).trim();
  merged.keywords = Object.prototype.hasOwnProperty.call(pageData, "keywords")
    ? pageData.keywords
    : site.defaultPageKeywords || "";
  if (merged.canonicalUrl === undefined && merged.siteUrl) {
    merged.canonicalUrl = canonicalUrl(merged.siteUrl, filename);
  }
  const brandName = merged.brand?.name || "Anybuild";
  merged.ogImageAlt =
    merged.meta?.ogImageAlt || `${merged.title} — ${brandName}`;
  merged.jsonLd = buildJsonLd(merged, filename);
  const data = merged;
  const bodyTpl = Handlebars.compile(read(bodyTemplateRel));
  const html = layout({ ...data, body: bodyTpl(data) });
  write(path.join("dist", filename), html);
}

write("dist/main.css", read("src/styles/main.css"));
write("dist/nav.js", read("src/scripts/nav.js"));
write("dist/platform-expand.js", read("src/scripts/platform-expand.js"));
write("dist/faq-search.js", read("src/scripts/faq-search.js"));
write("dist/inquiry-form.js", read("src/scripts/inquiry-form.js"));
write("dist/hero-mock.js", read("src/scripts/hero-mock.js"));

const home = loadJson("src/data/pages/home.json");
buildPage("index.html", "src/pages/home-body.hbs", home);

const pages = [
  ["platform.html", "src/data/pages/platform.json", "src/pages/platform-body.hbs"],
  ["onedb-smartsuite.html", "src/data/pages/onedb-smartsuite.json", "src/pages/onedb-smartsuite-body.hbs"],
  ["partners.html", "src/data/pages/partners.json", "src/pages/partners-body.hbs"],
  ["ai.html", "src/data/pages/ai.json", "src/pages/ai-body.hbs"],
  ["pricing.html", "src/data/pages/pricing.json", "src/pages/pricing-body.hbs"],
  ["faq.html", "src/data/pages/faq.json", "src/pages/faq-body.hbs"],
  ["careers.html", "src/data/pages/careers.json", "src/pages/careers-body.hbs"],
  ["terms.html", "src/data/pages/terms.json", "src/pages/terms-body.hbs"],
  ["privacy.html", "src/data/pages/privacy.json", "src/pages/privacy-body.hbs"],
  ["contact.html", "src/data/pages/contact.json", "src/pages/inquiry-page-body.hbs"],
  ["support.html", "src/data/pages/support.json", "src/pages/inquiry-page-body.hbs"],
  ["careers-inquiry.html", "src/data/pages/careers-inquiry.json", "src/pages/inquiry-page-body.hbs"],
  ["about.html", "src/data/pages/about.json", "src/pages/about-body.hbs"],
  ["demo.html", "src/data/pages/demo.json", "src/pages/inquiry-page-body.hbs"],
  ["try.html", "src/data/pages/try.json", "src/pages/inquiry-page-body.hbs"],
];

for (const [filename, jsonPath, bodyPath] of pages) {
  buildPage(filename, bodyPath, loadJson(jsonPath));
}

console.log("Build complete: dist/ (flat HTML, main.css, hero-mock.js)");
