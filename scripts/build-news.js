const fs = require("fs");
const path = require("path");

const NEWS_DIR = path.join(process.cwd(), "content", "news");
const OUTPUT_FILE = path.join(process.cwd(), "news-data.json");

function parseFrontMatter(content) {
  const match = content.match(/^---\s*([\s\S]*?)\s*---\s*([\s\S]*)$/);

  if (!match) {
    return {
      data: {},
      body: content.trim()
    };
  }

  const frontMatter = match[1];
  const body = match[2].trim();

  const data = {};

  for (const line of frontMatter.split(/\r?\n/)) {
    const separator = line.indexOf(":");

    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    data[key] = value;
  }

  return { data, body };
}

function stripMarkdown(text) {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[[^\]]*\]\([^)]*\)/g, "$1")
    .replace(/#{1,6}\s+/g, "")
    .replace(/[*_`~]/g, "")
    .replace(/\r?\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function walkNewsDirectory(dir) {
  if (!fs.existsSync(dir)) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  const result = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "uploads") continue;

      result.push(...walkNewsDirectory(fullPath));
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;

    const raw = fs.readFileSync(fullPath, "utf8");
    const { data, body } = parseFrontMatter(raw);

    const slug = entry.name.replace(/\.md$/, "");

    const article = {
      slug,
      title: data.title || "Χωρίς τίτλο",
      date: data.date || "",
      category: data.category || "Νέα",
      image: data.image || "",
      excerpt: data.excerpt || stripMarkdown(body).slice(0, 220),
      body
    };

    result.push(article);
  }

  return result;
}

const articles = walkNewsDirectory(NEWS_DIR);

articles.sort((a, b) => {
  return new Date(b.date || 0) - new Date(a.date || 0);
});

fs.writeFileSync(
  OUTPUT_FILE,
  JSON.stringify(articles, null, 2),
  "utf8"
);

console.log(`Generated news-data.json with ${articles.length} article(s).`);