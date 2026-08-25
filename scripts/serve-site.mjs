#!/usr/bin/env node
/* Minimal static server for _site, used by the Playwright suite.
 *
 * Deliberately serves the BUILT output rather than running eleventy --serve:
 * the build applies PurgeCSS, and a class that PurgeCSS strips is exactly the
 * kind of regression these tests exist to catch. Testing the dev server would
 * hide it.
 *
 * No dependency -- node:http only.
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "_site");
const PORT = Number(process.env.PORT || 8181);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
};

async function resolve(pathname) {
  /* normalize() collapses ".." so a request can't escape _site. */
  const rel = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  let file = join(ROOT, rel);
  try {
    const s = await stat(file);
    if (s.isDirectory()) file = join(file, "index.html");
  } catch {
    /* Extensionless URL that isn't a directory -- try .html. */
    if (!extname(file)) file += ".html";
  }
  return file;
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const file = await resolve(url.pathname);
  try {
    const body = await readFile(file);
    res.writeHead(200, {
      "content-type": TYPES[extname(file)] || "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("404");
  }
}).listen(PORT, () => {
  console.log(`serving _site on http://localhost:${PORT}`);
});
