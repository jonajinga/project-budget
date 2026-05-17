---
title: "Your first profile"
subtitle: "Name the budget, choose how it starts, and learn what the profile actually is."
category: "getting-started"
order: 3
---

A profile is one complete budget — its own accounts, categories, transactions, goals, and history. On a fresh visit the app loads a read-only sample profile so you can poke around. Your first real step is creating your own.

## Create the profile

Open [Profiles](/app/profiles/) and click **New profile**. You'll be asked for:

- **Name** — anything you'll recognize in the switcher. *Household*, *Personal*, *2026 budget* are all fine.
- **Start month** — the first month the budget covers. Default is the current month. Pick an earlier month only if you also plan to back-fill transactions; otherwise leave it.
- **Currency display** — the symbol shown in the UI. Stored numbers are cents; the symbol is cosmetic.

When you click **Create**, the new profile becomes active and the sample profile is left untouched.

## Start from scratch vs. import

If you have a JSON export from another Project Budget profile (yours or someone else's), pick **Import from file** instead. The file is validated, migrated to the current schema if needed, and loaded as a new profile with a new id. See [Backups and export](/docs/profiles-backups/backups-and-export/) for the export shape.

## What you can change later

Almost everything. The name, the currency display, and the start month are all editable from [Settings](/app/settings/). The only thing fixed at creation is the internal profile id, which you'll never see.

## Where it lives

The new profile is written to both browser stores immediately — see [How storage works](/docs/profiles-backups/how-storage-works/) for the two-backend mirror. There is no server call; no network request leaves your browser. Confirm this by opening DevTools, going to the Network tab, and watching while you click **Create profile**: zero requests.

## Next

With a profile in hand, add accounts. See [Your first account](/docs/getting-started/first-account/).
