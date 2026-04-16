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

function loadJsonIfExists(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) return null;
  return JSON.parse(read(rel));
}

function copyDir(relFrom, relTo) {
  const from = path.join(root, relFrom);
  if (!fs.existsSync(from)) return;
  const to = path.join(root, relTo);
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyDir(path.join(relFrom, entry.name), path.join(relTo, entry.name));
    } else {
      fs.copyFileSync(src, dst);
    }
  }
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

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeMetaText(s) {
  if (s == null) return "";
  // Meta tags and titles should not contain fancy dash characters.
  return String(s).replace(/[—–]/g, "-");
}

function standardizePageTitle(title, brandName = "Anybuild") {
  const raw = normalizeMetaText(title).trim();
  const brand = normalizeMetaText(brandName).trim();
  if (!raw) return raw;
  if (!brand) return raw;

  const suffix = ` - ${brand}`;
  if (raw.endsWith(suffix)) return raw;

  const brandPrefix = `${brand} - `;
  if (raw.startsWith(brandPrefix)) {
    return `${raw.slice(brandPrefix.length).trim()}${suffix}`;
  }

  return `${raw}${suffix}`;
}

function writeSitemap(siteUrl, htmlFilenames) {
  const base = (siteUrl || "").trim();
  if (!base) {
    console.warn("siteUrl missing; sitemap.xml not written.");
    return;
  }
  const lastmod = new Date().toISOString().split("T")[0];
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];
  for (const filename of htmlFilenames) {
    const loc = escapeXml(canonicalUrl(siteUrl, filename));
    lines.push("  <url>");
    lines.push(`    <loc>${loc}</loc>`);
    lines.push(`    <lastmod>${lastmod}</lastmod>`);
    lines.push("  </url>");
  }
  lines.push("</urlset>");
  write("dist/sitemap.xml", lines.join("\n") + "\n");
}

function writeRobotsTxt(siteUrl) {
  const base = (siteUrl || "").trim().replace(/\/$/, "");
  if (!base) {
    console.warn("siteUrl missing; robots.txt not written.");
    return;
  }
  const sitemapUrl = `${base}/sitemap.xml`;
  const body = [
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${sitemapUrl}`,
    "",
  ].join("\n");
  write("dist/robots.txt", body);
}

/**
 * Storyboard image URLs:
 * - Default: `image` / `fullImage` in src/data/pages/home.json (relative paths → work with dist/assets).
 * - CloudFront paths are often opaque (UUIDs); use per-frame `imageRemote` and optional `fullImageRemote`
 *   (full HTTPS URLs). Optionally put them only in src/data/pages/home-storyboard-remote.json
 *   (same structure: { "frames": [ { "imageRemote": "...", "fullImageRemote": "..." }, ... ] })
 *   merged by index with home.json so UUIDs can stay out of git.
 * - Production HTML: ANYBUILD_STORYBOARD_USE_REMOTE=1 replaces `image`/`fullImage` emitted to HTML
 *   with the remote fields when set; missing remote fields fall back to local paths for that frame.
 */
function storyboardUseRemoteUrls() {
  const v = process.env.ANYBUILD_STORYBOARD_USE_REMOTE;
  return v === "1" || /^true$/i.test(String(v || "").trim());
}

function mergeStoryboardRemoteOverlay(pageData, overlay) {
  if (!pageData?.sectionStoryboard?.frames || !overlay?.frames) return pageData;
  if (!Array.isArray(overlay.frames)) return pageData;
  const nHome = pageData.sectionStoryboard.frames.length;
  const nOver = overlay.frames.length;
  if (nHome !== nOver) {
    console.warn(
      `home-storyboard-remote.json: frames length (${nOver}) does not match home.json (${nHome}); merging by index.`
    );
  }
  const frames = pageData.sectionStoryboard.frames.map((f, i) => {
    const o = overlay.frames[i];
    if (!o || typeof o !== "object") return { ...f };
    return { ...f, ...o };
  });
  return {
    ...pageData,
    sectionStoryboard: {
      ...pageData.sectionStoryboard,
      frames,
    },
  };
}

function trimStoryboardUrl(s) {
  if (s == null || typeof s !== "string") return "";
  return s.trim();
}

function applyStoryboardRemoteUrlsForHtml(pageData) {
  if (!storyboardUseRemoteUrls() || !pageData?.sectionStoryboard?.frames) {
    return pageData;
  }
  const frames = pageData.sectionStoryboard.frames.map((f) => {
    const image = trimStoryboardUrl(f.imageRemote) || f.image;
    const fullImage = trimStoryboardUrl(f.fullImageRemote) || f.fullImage;
    return { ...f, image, fullImage };
  });
  return {
    ...pageData,
    sectionStoryboard: {
      ...pageData.sectionStoryboard,
      frames,
    },
  };
}

function prepareHomePageData() {
  let home = loadJson("src/data/pages/home.json");
  const overlay = loadJsonIfExists("src/data/pages/home-storyboard-remote.json");
  if (overlay) {
    home = mergeStoryboardRemoteOverlay(home, overlay);
  }
  home = applyStoryboardRemoteUrlsForHtml(home);
  return home;
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
  const brandName = merged.brand?.name || "Anybuild";
  merged.title = merged.title
    ? standardizePageTitle(merged.title, brandName)
    : merged.title;
  if (merged.description) merged.description = normalizeMetaText(merged.description);
  merged.effectiveDescription = (
    merged.description ||
    site.defaultDescription ||
    ""
  ).trim();
  merged.effectiveDescription = normalizeMetaText(merged.effectiveDescription);
  merged.keywords = Object.prototype.hasOwnProperty.call(pageData, "keywords")
    ? pageData.keywords
    : site.defaultPageKeywords || "";
  if (merged.canonicalUrl === undefined && merged.siteUrl) {
    merged.canonicalUrl = canonicalUrl(merged.siteUrl, filename);
  }
  merged.ogImageAlt =
    merged.meta?.ogImageAlt || `${merged.title} - ${brandName}`;
  merged.jsonLd = buildJsonLd(merged, filename);
  const data = merged;
  const bodyTpl = Handlebars.compile(read(bodyTemplateRel));
  const html = layout({ ...data, body: bodyTpl(data) });
  write(path.join("dist", filename), html);
}

write("dist/main.css", read("src/styles/main.css"));
write("dist/nav.js", read("src/scripts/nav.js"));
write("dist/pricing-inquiry.js", read("src/scripts/pricing-inquiry.js"));
write("dist/pricing-currency.js", read("src/scripts/pricing-currency.js"));
write("dist/platform-expand.js", read("src/scripts/platform-expand.js"));
write("dist/faq-search.js", read("src/scripts/faq-search.js"));
write("dist/inquiry-form.js", read("src/scripts/inquiry-form.js"));
write("dist/hero-mock.js", read("src/scripts/hero-mock.js"));
copyDir("src/assets", "dist/assets");

const home = prepareHomePageData();
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

writeSitemap(site.siteUrl, ["index.html", ...pages.map((p) => p[0])]);
writeRobotsTxt(site.siteUrl);

console.log(
  "Build complete: dist/ (flat HTML, main.css, sitemap.xml, robots.txt, hero-mock.js)"
);
