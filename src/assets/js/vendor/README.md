# Vendored runtime libraries

Project Budget vendors its runtime JavaScript so the app works offline after the first
load. None of these libraries are listed in `package.json` because they are
not part of the build pipeline — they ship as static files in `_site/assets/js/vendor/`.

## Required files

Place the following minified files in this directory:

| File | Source | Upstream URL |
|---|---|---|
| `alpine.min.js` | Alpine.js v3.x | https://cdn.jsdelivr.net/npm/alpinejs@3/dist/cdn.min.js |
| `d3.min.js` | D3 v7.x | https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js |
| `popper.min.js` | Popper.js v2.x | https://cdn.jsdelivr.net/npm/@popperjs/core@2/dist/umd/popper.min.js |
| `tippy-bundle.min.js` | Tippy.js v6 bundle | https://cdn.jsdelivr.net/npm/tippy.js@6/dist/tippy-bundle.umd.min.js |
| `papaparse.min.js` | PapaParse v5.x | https://cdn.jsdelivr.net/npm/papaparse@5/papaparse.min.js |
| `instantpage.min.js` | instant.page v5.x | https://instant.page/5.2.0 |

## Why not npm?

These libraries are loaded directly by the browser, not bundled. Pulling them
from npm would require a bundler, which Project Budget intentionally does without.
Vendoring keeps the build simple and the offline pledge honest.

## Version pinning

Record the exact upstream version + SHA-256 of every vendored file in
`VERSIONS.md` (sibling file). Update them deliberately, not casually.
