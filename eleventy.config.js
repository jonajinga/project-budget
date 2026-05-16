import { DateTime } from "luxon";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

import eleventyImg from "@11ty/eleventy-img";
import tinyHTML from "@sardine/eleventy-plugin-tinyhtml";
import * as pagefind from "pagefind";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// CSS partials concatenated in this order at build time.
// global.css is the only entry processed; partials are read and joined.
const CSS_PARTIAL_ORDER = [
  "reset.css",
  "tokens.css",
  "base.css",
  "layout.css",
  "components.css",
  "nav.css",
  "app.css",
  "register.css",
  "budget.css",
  "reports.css",
  "docs.css",
  "forms.css",
  "style-guide.css",
  "print.css",
];

export default function (eleventyConfig) {

  eleventyConfig.addPlugin(tinyHTML);

  // ---- CSS partial concatenation -----------------------------------------
  // global.css is the entry stub; this extension reads every partial in
  // CSS_PARTIAL_ORDER and emits one concatenated file. Never use @import.
  eleventyConfig.addTemplateFormats("css");
  eleventyConfig.addExtension("css", {
    outputFileExtension: "css",
    compile: async function (_inputContent, inputPath) {
      if (!inputPath.endsWith("global.css")) {
        return undefined;
      }
      return async () => {
        const partialsDir = resolve(__dirname, "src/assets/css/partials");
        const existing = new Set(readdirSync(partialsDir));
        const banner = "/* Project Budget — concatenated from src/assets/css/partials/ */\n";
        const blocks = CSS_PARTIAL_ORDER
          .filter((name) => existing.has(name))
          .map((name) => `/* ---- ${name} ---- */\n${readFileSync(join(partialsDir, name), "utf8")}\n`);
        return banner + blocks.join("\n");
      };
    },
  });

  // ---- Image shortcode ---------------------------------------------------
  eleventyConfig.addAsyncShortcode("image", async function (src, alt, sizes = "100vw", widths = [400, 800, 1200], priority = "lazy") {
    if (alt === undefined) {
      throw new Error(`Missing alt text for image: ${src}`);
    }
    const isEager = priority === "eager";
    const metadata = await eleventyImg(src, {
      widths,
      formats: ["avif", "webp", "jpeg"],
      outputDir: "./_site/assets/img/",
      urlPath: "/assets/img/",
    });
    return eleventyImg.generateHTML(metadata, {
      alt,
      sizes,
      loading: isEager ? "eager" : "lazy",
      decoding: isEager ? "sync" : "async",
      fetchpriority: isEager ? "high" : undefined,
    });
  });

  // ---- Filters -----------------------------------------------------------
  eleventyConfig.addFilter("readableDate", (d) =>
    DateTime.fromJSDate(d || new Date(), { zone: "utc" }).toFormat("LLLL d, yyyy")
  );

  eleventyConfig.addFilter("htmlDateString", (d) =>
    DateTime.fromJSDate(d || new Date(), { zone: "utc" }).toISODate()
  );

  eleventyConfig.addFilter("dateISO", (d) =>
    DateTime.fromJSDate(d || new Date(), { zone: "utc" }).toISO()
  );

  eleventyConfig.addFilter("head", (arr, n) => {
    if (!Array.isArray(arr) || arr.length === 0) return [];
    return n < 0 ? arr.slice(n) : arr.slice(0, n);
  });

  eleventyConfig.addFilter("limit", (arr, n) => (Array.isArray(arr) ? arr.slice(0, n) : []));
  eleventyConfig.addFilter("skip", (arr, n) => (Array.isArray(arr) ? arr.slice(n) : []));

  eleventyConfig.addFilter("striptags", (s) => (s || "").replace(/<[^>]*>/g, ""));

  eleventyConfig.addFilter("readingTime", (s) => {
    const words = (s || "").trim().split(/\s+/).length;
    return Math.max(1, Math.round(words / 200));
  });

  eleventyConfig.addFilter("rejectattr", (arr, key, val) =>
    (arr || []).filter((item) => item[key] !== val)
  );

  // Real character-count truncate (Nunjucks built-in second arg is a word-boundary flag).
  eleventyConfig.addFilter("truncate", (str, n = 160, suffix = "...") => {
    const s = (str || "").toString();
    return s.length <= n ? s : s.slice(0, n).trimEnd() + suffix;
  });

  eleventyConfig.addFilter("startsWith", (str, prefix) =>
    typeof str === "string" && str.startsWith(prefix)
  );

  // Money — cents to USD-style display
  eleventyConfig.addFilter("dollars", (cents) => {
    const v = Number(cents) / 100;
    return v.toLocaleString("en-US", { style: "currency", currency: "USD" });
  });

  eleventyConfig.addFilter("signedDollars", (cents) => {
    const n = Number(cents);
    const v = Math.abs(n) / 100;
    const sign = n < 0 ? "-" : "";
    return sign + v.toLocaleString("en-US", { style: "currency", currency: "USD" });
  });

  // ---- Shortcodes --------------------------------------------------------
  eleventyConfig.addShortcode("currentYear", () => String(new Date().getFullYear()));

  // ---- Email obfuscation (defeats Cloudflare's email-decode injection) ---
  eleventyConfig.addTransform("emailOff", function (content) {
    if (!this.page.outputPath || !this.page.outputPath.endsWith(".html")) return content;
    return content.replace(
      /(<a\s[^>]*href="mailto:[^"]*"[^>]*>)([\s\S]*?)(<\/a>)/gi,
      "$1<!--email_off-->$2<!--/email_off-->$3"
    );
  });

  // ---- Passthrough -------------------------------------------------------
  eleventyConfig.addPassthroughCopy({ "src/assets/img": "assets/img" });
  eleventyConfig.addPassthroughCopy({ "src/assets/js": "assets/js" });
  eleventyConfig.addPassthroughCopy({ "src/assets/sample": "assets/sample" });
  eleventyConfig.addPassthroughCopy({ "src/_headers": "_headers" });
  eleventyConfig.addPassthroughCopy({ "src/favicon.ico": "favicon.ico" });
  eleventyConfig.addPassthroughCopy({ "src/favicon.svg": "favicon.svg" });
  eleventyConfig.addPassthroughCopy({ "src/manifest.webmanifest": "manifest.webmanifest" });

  // ---- Watch -------------------------------------------------------------
  eleventyConfig.addWatchTarget("src/assets/css/partials/");
  eleventyConfig.addWatchTarget("src/assets/js/");

  // ---- Collections -------------------------------------------------------
  eleventyConfig.addCollection("changelog", (api) =>
    api.getFilteredByGlob("src/pages/changelog/*.md").sort((a, b) => b.date - a.date)
  );

  // Docs collection — order within a category follows the page's `order`
  // front-matter (defaults to 99 for missing values).
  eleventyConfig.addCollection("docs", (api) =>
    api.getFilteredByGlob("src/docs/**/*.md").sort((a, b) => {
      const oa = a.data.order ?? 99;
      const ob = b.data.order ?? 99;
      if (oa !== ob) return oa - ob;
      return (a.data.title || "").localeCompare(b.data.title || "");
    })
  );

  // Blog posts.
  eleventyConfig.addCollection("posts", (api) =>
    api.getFilteredByGlob("src/blog/posts/*.md").sort((a, b) => b.date - a.date)
  );

  // ---- Pagefind index ----------------------------------------------------
  // Build the search index after the site is written. Indexes only the
  // marketing surface (docs, blog, glossary, accessibility, changelog,
  // open-source, terms, privacy). The /app/ tree is intentionally
  // excluded — it's all dynamic + behind a robots.txt Disallow.
  eleventyConfig.on("eleventy.after", async () => {
    try {
      const { index } = await pagefind.createIndex({
        forceLanguage: "en",
        verbose: false,
      });
      const siteDir = resolve(__dirname, "_site");
      await index.addDirectory({ path: siteDir, glob: "**/*.html" });
      await index.writeFiles({ outputPath: resolve(siteDir, "pagefind") });
    } catch (e) {
      console.warn("Pagefind index build failed:", e.message);
    }
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
    templateFormats: ["njk", "md", "html", "css", "11ty.js"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
}
