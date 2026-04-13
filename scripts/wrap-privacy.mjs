import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const raw = fs.readFileSync(path.join(root, "src/legal/privacy-raw.html"), "utf8");

const ids = [
  "privacy-intro",
  "privacy-policy",
  "privacy-collect",
  "privacy-use",
  "privacy-security",
  "privacy-cookies",
  "privacy-control",
  "privacy-rights",
  "privacy-complain",
];

const sectionRe = /<section>\s*<h2>([^<]+)<\/h2>\s*([\s\S]*?)<\/section>/g;
const articles = [];
let m;
let i = 0;
while ((m = sectionRe.exec(raw)) !== null) {
  articles.push({
    id: ids[i] || `privacy-section-${i + 1}`,
    title: m[1].trim().replace(/\s+/g, " "),
    html: m[2].trim(),
  });
  i += 1;
}

if (articles.length !== ids.length) {
  console.error(`Expected ${ids.length} sections, got ${articles.length}`);
  process.exit(1);
}

const tocItems = articles
  .map(
    (a) =>
      `          <li><a href="#${a.id}">${escapeHtml(a.title)}</a></li>`
  )
  .join("\n");

const articleBlocks = articles
  .map(
    (a) => `      <article id="${a.id}" class="page-terms-article">
        <h2 class="page-terms-h2">${escapeHtml(a.title)}</h2>
        <div class="page-terms-body">
${a.html}
        </div>
      </article>`
  )
  .join("\n\n");

const out = `<section class="page-terms-main">
  <div class="container page-terms-columns">
    <aside class="page-terms-toc" aria-label="On this page">
      <div class="card page-terms-toc-card">
        <p class="page-terms-toc-label">On this page</p>
        <ul class="page-terms-toc-list">
${tocItems}
        </ul>
      </div>
    </aside>
    <div class="page-terms-articles">
${articleBlocks}
    </div>
  </div>
</section>
`;

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

fs.writeFileSync(path.join(root, "src/partials/privacy-legal.hbs"), out);
console.log("Wrote src/partials/privacy-legal.hbs");
