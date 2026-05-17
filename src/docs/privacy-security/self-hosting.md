---
title: "Self-hosting"
subtitle: "Run Project Budget on your own server, your own LAN, or just from a folder on your laptop."
category: "privacy-security"
order: 3
---

Project Budget is a static site. There is no backend, no database server, no API. Self-hosting means putting the built site somewhere a browser can fetch the HTML, CSS, and JS files from — anywhere from a $5 VPS to a USB stick.

This page walks through the realistic options.

## What "self-hosting" gets you

- **Zero third-party host visibility.** No Cloudflare, no anyone-else, sees the requests for your app pages.
- **Pinned version.** You decide when to update. A bug in a new release can't reach you until you redeploy.
- **LAN-only or air-gapped use.** Run the site on a Raspberry Pi on your home network; the family uses it without it ever touching the public internet.

What it does **not** get you:

- Sync between devices. Self-hosting doesn't add server-side storage. Your data still lives in each device's browser. See [Local-only storage](/docs/privacy-security/local-only/).
- Bank integration. There is no bank integration to enable; the app is import-from-file by design.

## Option 1: from a folder on your laptop

The minimum viable host.

```bash
git clone https://github.com/jonajinga/projectbudget.git
cd projectbudget
npm install
npm run build
npx serve _site
```

Open `http://localhost:3000` (or whichever port `serve` picks). Bookmark it. The app runs locally; the "server" is just a static file server.

Data is in your browser, same as the public site. Nothing about being local changes that.

## Option 2: on a Raspberry Pi or NAS

Same `npm run build` produces a `_site/` directory of plain files. Copy it to the Pi / NAS. Serve it with anything that serves static files: nginx, Caddy, Apache, Python's built-in `http.server`, the NAS's bundled web-share feature.

A minimal Caddyfile:

```
projectbudget.lan {
  root * /var/www/projectbudget
  file_server
  try_files {path} {path}/index.html /404.html
}
```

Add a hosts-file entry on the devices that should reach it. Done.

## Option 3: on a VPS or static-site host

Same `_site/` directory; deploy via:

- **Netlify** — drag-and-drop the `_site/` folder, or connect the repo.
- **Vercel** — similar.
- **GitHub Pages** — serve `_site/` from a branch.
- **Cloudflare Pages** — the same host the public version uses.
- **Any S3-compatible bucket** — write the files, point a CDN, done.

All of these are static-file hosting; none requires a backend.

## Building from source

The project is open source under the MIT license. Repository: https://github.com/jonajinga/projectbudget.

Build requirements:

- Node.js 20 or higher
- npm

Build steps:

```bash
npm install
npm run build
```

Output is in `_site/`. Serve that directory.

For local development:

```bash
npm run dev
```

Serves on `localhost:8080` with hot reload.

## Caching headers

If you serve via a proper HTTP server, set long cache TTLs on hashed assets (CSS / JS bundles) and short TTLs on HTML. The shipped Cloudflare Pages config has these in `src/_headers`:

```
/assets/*
  Cache-Control: public, max-age=31536000, immutable

/*.html
  Cache-Control: public, max-age=0, must-revalidate
```

Most static hosts pick this up automatically.

## Auto-updating from upstream

If you want your self-hosted instance to track upstream releases, set up a cron / scheduled job:

```bash
cd /path/to/projectbudget
git pull
npm install
npm run build
# Copy _site/ to your serving directory
```

The build is deterministic — same source, same output bytes. No environment-specific configuration changes between builds.

## Migrating data between instances

Your local browser data does not move when you switch from the public site to a self-hosted instance (or between two self-hosted instances). Browsers scope IndexedDB and localStorage per-origin; the data at `projectbudget.com` is in a different bucket than the data at `projectbudget.lan`.

To migrate: export your profile from origin A, import on origin B. Same flow as a cross-device move. See [Export file schema](/docs/profiles-backups/export-schema/).

## Verifying the build matches the source

If you build the site yourself and compare against the public site's bundle, the hashes should match for a given release tag — the build is reproducible. If they don't match, either a different commit was deployed or the build environment differs (different Node version, different dependency resolution).

The repository tags every release. `git checkout v1.4.2 && npm install && npm run build` produces the same output as the public site at v1.4.2.
