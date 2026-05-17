---
title: "How your data is stored"
subtitle: "Local-first, no server, no account. Where the bytes actually live and why that's deliberate."
category: "privacy-security"
order: 1
---

Project Budget is **local-first** in the strict sense: every byte of your financial data lives in the browser on the device you're using. There is no account to create, no server to sign in to, no cloud sync. The app is a static website plus a JavaScript runtime; it does not talk to any backend to function.

## What's stored where

Two browser storage mechanisms hold your profile data. See [How storage works](/docs/profiles-backups/how-storage-works/) for the mechanics; the short version:

- **localStorage** — under keys prefixed with `projectbudget:`. Holds the live profile and the index of profiles.
- **IndexedDB** — database named `ProjectBudget`. Holds mirrored copies of profiles, plus daily backups, manual snapshots, and the trash.

Every write goes to both. Every read uses whichever has the freshest data.

## What never leaves your browser

- Your account names and balances
- Your transactions, payees, memos, splits, transfers
- Your category structure and assignments
- Your goals and recurring templates
- Reconciliation status
- Daily backups and manual snapshots

None of these are uploaded anywhere. There is no telemetry packet that includes any of them. Open DevTools, watch the Network tab, use the app normally — you'll see zero outbound requests after the initial page load.

## What the browser does load from the network

When you first visit, your browser downloads:

- The HTML for the marketing site and the app shell
- A bundle of CSS
- A bundle of JavaScript (the app runtime, Alpine.js, chart libraries)
- The Pagefind search index (only when you use search on the docs / blog)
- Fonts from Bunny Fonts (GDPR-compliant; see [their privacy policy](https://fonts.bunny.net/about))

After the initial load, the app is fully usable offline. Reload the tab on a plane, in a tunnel, with WiFi off — it works.

## What the host (Cloudflare Pages) sees

The static site is hosted on Cloudflare Pages. Cloudflare's access logs record the standard web-server data: IP address, requested URL path, user-agent, timestamp, response code. That's the same minimum that any website you visit collects.

What Cloudflare's logs **do not** include:

- The contents of your IndexedDB or localStorage
- The names of your accounts, categories, or transactions
- Anything you typed into the app

That's by construction. The static files have no upload paths; there's nothing to post to. The app has no analytics tracker; there's nothing to phone home.

## What if I clear my browser data?

Your profiles are wiped. Same as any local-first app.

This is why [daily backups](/docs/profiles-backups/backups-and-export/) and periodic [JSON exports](/docs/profiles-backups/export-schema/) matter. Both live in browser storage, which a cache wipe will also clear — so the export to a file you save somewhere else is the layer that survives a wipe.

Recommended habit: monthly export to your file system (or a cloud-drive folder if you want off-device safety) is the single highest-value backup habit.

## What about syncing across devices?

There is no built-in sync. By design — adding sync would mean adding a server, and a server would change the privacy story.

The supported cross-device workflow:

1. Export the profile as JSON on device A.
2. Move the file to device B (cloud drive, email to yourself, USB stick — your call).
3. Import on device B as a new profile.

This is asymmetric: changes you make on B after importing don't flow back to A unless you re-export and re-import. The app is best used as a single-device tool, with the export as the portability layer.

## Private / incognito windows

Both browser stores are typically session-scoped in private windows — they exist for the session and get wiped on close. Project Budget detects this on load and shows a persistent banner reminding you to export before closing the window. The app works normally during the session.

## Tracking accounts and external statements

Tracking accounts (401k, brokerage, mortgage) store the balance number you enter. They do not connect to the institution. Updating the balance is a manual transaction you add when you check the institution's own statement.

If having no tracking-account sync is a dealbreaker, Project Budget may not be the right tool. Most users find the manual update — five minutes once a month — a fair price for not handing bank credentials to a third party.

## Self-hosting

Because the site is static, you can host it yourself. See [Self-hosting](/docs/privacy-security/self-hosting/) for the steps.
