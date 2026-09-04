import { DateTime } from "luxon";
import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

import eleventyImg from "@11ty/eleventy-img";
import tinyHTML from "@sardine/eleventy-plugin-tinyhtml";
import * as pagefind from "pagefind";
import { PurgeCSS } from "purgecss";

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
  /* app-chrome.css after app.css: .app-page--flush > * has to beat
     `.app-page > * { max-width: 100% }`, and on equal specificity that
     is decided by source order. */
  "app-chrome.css",
  "register.css",
  "budget.css",
  "budget-inspector.css",
  "budget-cuts.css",
  "history.css",
  "changelog.css",
  "reports.css",
  "docs.css",
  "forms.css",
  "fab.css",
  /* After fab.css: the tab bar hides the FAB's trigger below 768px, and
     equal-specificity rules are decided by this order. */
  "tab-bar.css",
  "goal-progress.css",
  "dashboard.css",
  /* accounts.css after components.css: its .acct-table-card rule has to
     beat the shared `.card { overflow-x: auto }` on equal specificity,
     and equal specificity is decided by source order. */
  "accounts.css",
  "contact.css",
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

  /* readableDate above takes a JS Date. Data files that carry plain ISO
     strings (the changelog) use this one instead. */
  eleventyConfig.addFilter("readableISO", (s) =>
    DateTime.fromISO(String(s), { zone: "utc" }).toFormat("LLLL d, yyyy")
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
  /* sw.js is authored as src/sw.njk and emitted through the template
     pipeline, NOT passed through, so its cache version can interpolate
     {{ build.hash }}. As a passthrough copy it could not, which is why the
     version sat frozen at a hand-typed date while every asset URL around it
     changed on every build. */

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

  // ---- View fragments for the single-shell router ------------------------
  //
  // Every /app/* route keeps rendering as its own full page -- that is the
  // first paint, and the fallback when the router cannot fetch a fragment.
  // This additionally writes the inner HTML of each page's #app-view mount to
  // /app/_views/<slug>.html, which is what the router swaps in.
  //
  // Extracted from the BUILT page rather than re-rendered from the template.
  // A separately-rendered fragment can drift from the page it is meant to
  // mirror; a slice of the real output cannot. It also means app pages need no
  // front-matter changes -- they all carry eleventyExcludeFromCollections,
  // so a collection could never have seen them anyway.
  eleventyConfig.on("eleventy.after", async ({ dir }) => {
    const { readdirSync, readFileSync, writeFileSync, mkdirSync } = await import("node:fs");
    const { join, relative, sep } = await import("node:path");

    const out = dir && dir.output ? dir.output : "_site";
    const appDir = join(out, "app");
    const viewsDir = join(appDir, "_views");

    /* Must stay in step with slugFor() in src/assets/js/ui/router.js. A
       mismatch does not error -- the fetch 404s and the router quietly falls
       back to a full page load, which looks like "the router did nothing". */
    const slugFor = (routePath) => {
      const rest = routePath.replace(/^\/app\//, "").replace(/\/$/, "");
      /* "_root", never "index": a fragment named index.html inside _views
         makes /app/_views/ look like a route to anything that walks the build
         for index.html -- which is how the e2e route list is built. */
      return rest === "" ? "_root" : rest.replace(/\//g, "--");
    };

    /* innerHTML of the first <div id=app-view>, by depth-counting rather than
       regex: the mount contains hundreds of nested divs and a lazy match would
       stop at the first </div>. tinyHTML has already stripped attribute quotes
       by this point, so match both spellings. */
    const extractMount = (html) => {
      const openIdx = html.search(/<div[^>]*\sid=["']?app-view["']?[^>]*>/i);
      if (openIdx === -1) return null;
      const tagEnd = html.indexOf(">", openIdx);
      if (tagEnd === -1) return null;

      let depth = 1;
      let i = tagEnd + 1;
      const start = i;
      const re = /<\/?div\b/gi;
      re.lastIndex = i;
      let m;
      while ((m = re.exec(html)) !== null) {
        depth += m[0][1] === "/" ? -1 : 1;
        if (depth === 0) return html.slice(start, m.index);
        i = re.lastIndex;
      }
      return null;
    };

    const pages = [];
    const walk = (d) => {
      for (const entry of readdirSync(d, { withFileTypes: true })) {
        const full = join(d, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "_views") continue;
          walk(full);
        } else if (entry.name === "index.html") {
          pages.push(full);
        }
      }
    };

    try {
      walk(appDir);
    } catch (_e) {
      return; /* no app directory in this build */
    }

    mkdirSync(viewsDir, { recursive: true });
    let written = 0;
    const skipped = [];

    for (const file of pages) {
      const routePath = "/app/" + relative(appDir, join(file, "..")).split(sep).join("/").replace(/^$/, "") + "/";
      const html = readFileSync(file, "utf8");
      const inner = extractMount(html);
      if (inner === null) { skipped.push(routePath); continue; }
      writeFileSync(join(viewsDir, slugFor(routePath.replace("//", "/")) + ".html"), inner, "utf8");
      written += 1;
    }

    console.log(`[views] ${written} route fragment(s) written to /app/_views/`);
    if (skipped.length) {
      /* Loud on purpose. A skipped route silently degrades to a full page
         load, which is the exact symptom this whole change exists to remove. */
      console.warn(`[views] NO #app-view mount found in ${skipped.length}: ${skipped.join(", ")}`);
    }
  });

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

  // ---- PurgeCSS site-wide pass -------------------------------------------
  // Walks _site for HTML + the JS bundles that inject classes at runtime,
  // reads each file as a raw string, and feeds them to PurgeCSS as
  // { raw, extension } content objects. Skipping glob entirely sidesteps
  // the Windows path issue where forward-slash globs silently match zero
  // files on resolved backslash paths.
  function walkFiles(dir, extensions, out) {
    out = out || [];
    if (!existsSync(dir)) return out;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip vendor + pagefind output to keep the scan fast.
        if (entry.name === "pagefind" || entry.name === "node_modules") continue;
        walkFiles(full, extensions, out);
      } else if (extensions.some(function (ext) { return entry.name.endsWith(ext); })) {
        out.push(full);
      }
    }
    return out;
  }
  eleventyConfig.on("eleventy.after", async () => {
    try {
      const siteDir = resolve(__dirname, "_site");
      const cssPath = resolve(siteDir, "assets/css/global.css");
      if (!existsSync(cssPath)) return;
      const before = statSync(cssPath).size;

      const htmlFiles = walkFiles(siteDir, [".html"]);
      const siteJsFiles = walkFiles(resolve(siteDir, "assets/js"), [".js"]);
      const srcJsFiles = walkFiles(resolve(__dirname, "src/assets/js"), [".js"]);
      const allFiles = htmlFiles.concat(siteJsFiles).concat(srcJsFiles);

      const content = allFiles.map(function (f) {
        return {
          raw: readFileSync(f, "utf8"),
          extension: f.endsWith(".html") ? "html" : "js",
        };
      });

      // PurgeCSS treats the `css` array as path-or-string + tries to
      // resolve absolute Windows paths as relative globs (mangling the
      // drive letter and slashes). Pass the CSS content as a raw
      // string under a different key shape that the lib supports —
      // { raw } — so no path resolution happens.
      const cssContent = readFileSync(cssPath, "utf8");

      const result = await new PurgeCSS().purge({
        content: content,
        css: [{ raw: cssContent }],
        safelist: {
          standard: [
            /^is-/, /^has-/, /^x-/, /^js-/,
            "active", "open", "show", "hidden", "expanded", "collapsed",
            "is-dragging", "is-chosen", "is-ghost",
            /^cal-/, /^budget__/, /^register__/, /^rec-/, /^kpi/,
            /^modal/, /^toast/, /^tippy/, /^profile-switcher/,
            /^app-/, /^site-/, /^doc-/, /^docs-/,
            /^theme-picker/, /^save-status/, /^contact-/,
            /^pb-/, /^thanks-/, /^glossary/, /^auto-assign/,
            /^goal-/, /^available-pill/, /^amount--/,
            /^swatch/, /^type-spec/, /^space-spec/, /^callout/,
            /^fab/, /^cleared-toggle/, /^dnd-handle/, /^card/,
            /^chart/, /^report/, /^badge/, /^field/, /^form-/,
            /^example/, /^a11y/, /^lead/, /^eyebrow/, /^breadcrumb/,
            /^sidebar/, /^header/, /^month-/, /^year-/, /^acct-/,
            /^cat-/, /^month-strip/, /^sample-/, /^pool-/,
            /^overflow-menu/, /^payee-cards/, /^data-cards/, /^acct-cards/, /^budget-stat/, /^cell-/, /^rec-payee/, /^rec-post/,
            /^hist__/, /^mini-chart/, /^cuts__/, /^cl-/, /^table/, /^col-p/, /^page-info/,
            /^app-toolbar/, /^app-page/, /^panel/,
          ],
          greedy: [
            /* An attribute that only ever appears Alpine-bound is written
               ":data-widget-kind" in the templates, and the extractor reads
               the colon as part of the token, so the bare attribute name is
               never found and every rule using it is dropped from the built
               CSS with no warning. Any new [data-*] selector whose attribute
               is set with a binding needs a line here. */
            /^data-theme/, /^data-touch/, /^data-tip/, /^data-widget/,
            /^aria-/, /^tippy/, /^popper/, /^sortable/,
          ],
          deep: [/dialog/, /sortable/, /tippy/, /popper/],
        },
        defaultExtractor: (content) => content.match(/[\w-/:%@.]+(?<!:)/g) || [],
      });
      if (result && result[0] && result[0].css) {
        writeFileSync(cssPath, result[0].css);
        const after = statSync(cssPath).size;
        const pct = Math.round((1 - after / before) * 100);
        console.log(`[purgecss] site-wide ${(before/1024).toFixed(1)}KB → ${(after/1024).toFixed(1)}KB (-${pct}%) — ${allFiles.length} files scanned`);
      }

      // ---- Per-page inlining pass --------------------------------------
      // Inlines each page's used CSS as a <style> block + drops the
      // external <link>. Trade-off: cuts first-paint round-trips
      // (~20% per page in measurement) but DOUBLES bytes for repeat
      // visitors because the CSS no longer caches across pages. Gated
      // behind PB_INLINE_CSS=1 so production releases can opt in
      // when single-visit landing pages are the priority. Default
      // build keeps the single cached external stylesheet.
      if (process.env.PB_INLINE_CSS !== "1") return;
      try {
        const purgedSiteCss = readFileSync(cssPath, "utf8");
        const runtimeJsContent = siteJsFiles.concat(srcJsFiles).map(function (f) {
          return { raw: readFileSync(f, "utf8"), extension: "js" };
        });
        const safelistShared = {
          standard: [
            /^is-/, /^has-/, /^x-/, /^js-/,
            "active", "open", "show", "hidden", "expanded", "collapsed",
            "is-dragging", "is-chosen", "is-ghost",
            /^modal/, /^toast/, /^tippy/, /^popper/,
            /^profile-switcher/, /^save-status/,
            /^goal-/, /^auto-assign/, /^pool-/,
            /^chart/, /^kpi/, /^report/, /^month-strip/,
            /^cleared-toggle/, /^dnd-handle/,
            /^amount--/, /^available-pill/, /^badge/,
            /^callout/, /^fab/, /^app-sidebar-backdrop/,
            /^theme-picker/, /^sample-/, /^thanks-/,
            /^year-/, /^cal-mini/, /^cal-period/, /^cal-day/,
            /^rec-/, /^cat-row/, /^cat-group/, /^acct-group/,
            /^budget__/, /^cal-/, /^register__/,
            /^overflow-menu/, /^payee-cards/, /^data-cards/, /^acct-cards/, /^budget-stat/, /^cell-/, /^rec-payee/, /^rec-post/, /^acct-cards/,
            /^hist__/, /^mini-chart/, /^cuts__/, /^table/, /^col-p/, /^page-info/, /^dash-/, /^cl-/,
            /^app-toolbar/, /^app-page/, /^panel/,
          ],
          greedy: [/^data-theme/, /^data-touch/, /^data-tip/, /^data-widget/, /^aria-/],
          deep: [/dialog/, /sortable/, /tippy/, /popper/],
        };
        let perPageBefore = 0, perPageAfter = 0, pagesInlined = 0;
        const linkPattern = /<link[^>]*?href=["']?\/assets\/css\/global\.css[^>]*?>/g;
        for (const htmlPath of htmlFiles) {
          let html = readFileSync(htmlPath, "utf8");
          // Skip files that don't link the global stylesheet.
          if (!linkPattern.test(html)) { linkPattern.lastIndex = 0; continue; }
          linkPattern.lastIndex = 0;

          const pageRes = await new PurgeCSS().purge({
            content: [{ raw: html, extension: "html" }].concat(runtimeJsContent),
            css: [{ raw: purgedSiteCss }],
            safelist: safelistShared,
            defaultExtractor: (c) => c.match(/[\w-/:%@.]+(?<!:)/g) || [],
          });
          const pageCss = pageRes && pageRes[0] && pageRes[0].css;
          if (!pageCss) continue;
          perPageBefore += purgedSiteCss.length;
          perPageAfter += pageCss.length;
          // Replace the external <link> with an inline <style>.
          const styleTag = "<style>" + pageCss + "</style>";
          html = html.replace(linkPattern, styleTag);
          linkPattern.lastIndex = 0;
          writeFileSync(htmlPath, html);
          pagesInlined += 1;
        }
        if (pagesInlined) {
          const avgBefore = perPageBefore / pagesInlined / 1024;
          const avgAfter = perPageAfter / pagesInlined / 1024;
          const pct = Math.round((1 - perPageAfter / perPageBefore) * 100);
          console.log(`[purgecss] per-page inlined into ${pagesInlined} HTML files: avg ${avgBefore.toFixed(1)}KB → ${avgAfter.toFixed(1)}KB per page (-${pct}%)`);
        }
      } catch (e) {
        console.warn("PurgeCSS per-page inline failed:", e.message);
      }
    } catch (e) {
      console.warn("PurgeCSS pass failed:", e.message);
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
