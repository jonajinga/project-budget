---
title: "What never leaves your browser"
subtitle: "A field-by-field guarantee, plus how to verify it yourself."
category: "privacy-security"
order: 2
---

The companion to [How your data is stored](/docs/privacy-security/local-only/). This page lists, by field, what kinds of data Project Budget handles and where each kind goes.

## Never sent over the network

The following data is read and written by the app entirely in-browser. None of it is transmitted to any server, analytics endpoint, or third party:

- **Account fields** — name, type, group, opening balance, current balance, closed status, notes
- **Category fields** — name, group, goal target, goal type, goal date, goal cadence
- **Transaction fields** — date, payee, category, amount, memo, cleared status, reconciled status, split children, transfer pair link
- **Recurring template fields** — payee, account, category, amount, frequency, next-due date, paused status
- **Profile metadata** — name, currency display, theme preference, start month
- **Snapshots and daily backups** — full copies of the above, stored locally
- **Reconciliation state** — locked status, reconciled-at timestamps
- **Reports** — calculated client-side from the above; never serialized off-device

## Loaded from the network at page load

The first visit triggers normal HTTP requests for the static site assets. These requests are visible in DevTools:

- The HTML document
- CSS and JS bundles (cached aggressively; subsequent visits often load from disk)
- Web fonts from Bunny Fonts
- The Pagefind search index (only when you use docs / blog search)

None of these requests include any of your profile data. They are GETs for files; there is no request body.

## Loaded from the network as needed

- **Pagefind search index** — fetched only when you focus the docs / blog search box. Self-hosted alongside the site; doesn't talk to any third-party search service.
- **Documentation pages** — markdown rendered to HTML at build time and served as static files. Reading the docs doesn't transmit anything about your profile.

## Never collected (because there's no collector)

- **No analytics.** No Google Analytics, no Plausible, no Umami, no first-party tracker. The site doesn't measure pageviews or events.
- **No error reporting.** No Sentry, no Rollbar, no Bugsnag. JavaScript errors stay in your browser console. If you hit a bug, opening an issue on the public repo with reproduction steps is the way to report it.
- **No A/B testing.** Everyone sees the same code.
- **No advertising.** Self-explanatory.

## How to verify

Three concrete ways:

### DevTools Network tab

Open DevTools (F12 on most browsers), switch to Network, clear the log, then use the app normally. After the initial page load completes, the count of new requests should stay at zero as you click around, enter transactions, edit budgets. The only requests appearing later are:

- Search-index fetches when you use docs search
- Document fetches when you navigate to a doc you haven't visited

Neither includes any request body containing your data.

### Reading the source

The site is static and the bundled JavaScript is not obfuscated. View source on any app page, find the script tags, fetch the JS files, search for `fetch(`, `XMLHttpRequest`, `WebSocket`, or `navigator.sendBeacon`. The only network calls are the ones documented above.

If you'd rather read the unbundled code, the project is open source — see [Self-hosting](/docs/privacy-security/self-hosting/) for the repository link.

### Air-gapping

Load the app once over a network. Then disable your network (turn off WiFi, unplug the cable). Refresh the page. The app loads from cache and works normally. Add transactions, run reports, take snapshots — all of it works offline. If any data were going to a server, the offline state would break those operations; it doesn't.

## What the host learns from you

Cloudflare Pages, as the host, sees the standard web-request metadata for every page load: IP address, user-agent, requested URL, response code, timestamp. This is the same minimum collected by any website you visit. Cloudflare's data-handling policies apply; nothing app-specific is collected.

If you want zero host visibility, [self-host](/docs/privacy-security/self-hosting/) the app and the only logs are yours.

## What can't be guaranteed

Two things are out of Project Budget's hands:

- **Browser extensions** can read any page's storage, including yours. An extension you installed with broad permissions could exfiltrate IndexedDB contents. Audit your extensions periodically.
- **Operating-system access.** Anyone with admin access to your computer can read your browser profile directory. Use full-disk encryption on devices with sensitive data.

These are general device-hygiene concerns, not Project Budget-specific. The app does what it can: store nothing remotely. The rest is up to you.
