# Project Budget

A free, open-source budgeting web app for envelope-style personal finance. Your data lives in your browser — no accounts, no servers, no bank connections.

Project Budget is modeled on the workflow popularized by YNAB and Actual Budget: every dollar you have gets assigned a job before it leaves your account. Where Project Budget differs is that it runs entirely in your browser via `localStorage`. There is no backend to host, no subscription to pay, and no third party that can see your numbers.

> Status: 0.1.0 — first public preview. See [/changelog/](https://projectbudget.org/changelog/) for what shipped.

## Features

- Full account coverage — cash, checking, savings, credit card, and off-budget tracking accounts for assets and liabilities
- Account groups with collapse / expand
- Credit-card payment tracking via paired payment categories
- Four category goal types — monthly fixed, target by date, refill up to, monthly top-up
- Seven built-in reports — income vs expense, net worth over time, spending by category, monthly trends, debt overview, assignment history, forward cashflow projection
- Recurring transactions with auto-post and review queue
- Transaction import from CSV (Chase, Capital One, Discover, Mint, Actual), OFX, QFX, QIF, and GoCardless exports
- JSON profile export and import, fresh-start, history trim, profile clone
- Automatic daily local backups with point-in-time restore (14-day window)
- Multiple budget profiles in one browser
- Print stylesheets for every report
- Light and dark themes with a no-flash theme script
- Glossary tooltips on every budget term
- PWA installable
- WCAG 2.2 AA target sizes throughout

## Screenshots

<!-- Add screenshots to src/assets/img/screenshots/ before tagging 1.0 -->
- `src/assets/img/screenshots/dashboard.webp` — App dashboard
- `src/assets/img/screenshots/budget.webp` — Monthly budget view
- `src/assets/img/screenshots/register.webp` — Transaction register
- `src/assets/img/screenshots/reports.webp` — Reports hub

## Quickstart

```
git clone https://github.com/jonajinga/project-budget.git
cd project-budget
npm install
npm run dev
```

The app serves at `http://localhost:8080`. Open [/app/](http://localhost:8080/app/), create a profile, and start budgeting. Your data is saved automatically to your browser's `localStorage`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server at localhost:8080 |
| `npm run start` | Alias for `dev` |
| `npm run build` | Production build into `_site/` |
| `npm run clean` | Delete `_site/` |

## Data stays local

Project Budget does not transmit your financial data anywhere. There is no API endpoint, no analytics pixel that touches your budget, and no opt-in cloud sync. Your data is written to `localStorage` keys prefixed with `projectbudget:` and stays in your browser unless you explicitly export it as a JSON file.

If you clear your browser data, your Project Budget profiles go with it. Export regularly.

## Privacy in private browsing

`localStorage` in private / incognito windows is typically ephemeral. Project Budget detects private browsing on boot and displays a persistent banner reminding you to export before closing the window.

## Deploy your own

Project Budget deploys cleanly to Cloudflare Pages.

- Connect your fork to Cloudflare Pages
- Build command: `npm run build`
- Output directory: `_site`
- Environment: `NODE_VERSION` = `20`, `SITE_URL` = your production URL

The `src/_headers` file is copied to the build and sets immutable caching for hashed assets, no-store for HTML, and a defensive set of security headers (HSTS preload, frame deny, content-type sniffing off, restrictive Permissions-Policy).

## Architecture

- Eleventy v3 (ESM) static-site generator
- Nunjucks templates
- Vanilla CSS partials concatenated at build into a single stylesheet (no bundler)
- Vendored Alpine.js, D3, Tippy.js, PapaParse, and instant.page — no runtime dependency manager
- One module per domain concern (`src/assets/js/domain/`): accounts, transactions, payees, scheduled, reconcile, budget, goals, categories, reports
- One module per IO format (`src/assets/js/io/`): export-json, import-json, import-csv, csv-shapes, import-ofx, import-qif, import-gocardless

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Bug reports and import-format requests are welcome via GitHub Issues. Pull requests that add a backend, telemetry, or paid features will not be merged.

## License

[MIT](LICENSE). Built with [Eleventy](https://www.11ty.dev/), [Alpine.js](https://alpinejs.dev/), [D3.js](https://d3js.org/), [Tippy.js](https://atomiks.github.io/tippyjs/), [PapaParse](https://www.papaparse.com/), and [instant.page](https://instant.page/).

Website by [Pikes Peak Web Designs](https://pikespeakwebdesigns.com).
