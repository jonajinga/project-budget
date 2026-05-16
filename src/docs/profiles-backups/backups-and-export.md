---
title: "Backups and export"
subtitle: "What protects your data from a wiped cache, a new device, or a bad reconciliation."
category: "profiles-backups"
order: 2
---

## Daily local backups

Once per calendar day, the first time you open the app, Project Budget snapshots the active profile to `projectbudget:backup:<id>:<YYYY-MM-DD>`. The last 14 days are kept; older snapshots are pruned automatically.

You can list and restore snapshots from [Settings](/app/settings/). Restoring overwrites the active profile with the snapshot — today's automatic backup is kept intact, so you can recover from a bad restore.

## JSON export

[Export](/app/export/) downloads the active profile as a pretty-printed JSON file named `projectbudget-<slug>-<date>.json`. The file is a complete snapshot — accounts, categories, transactions, payees, schedules, goals, budgets, settings. Import it back through [Import](/app/import/) to round-trip into the same browser or a different one.

## When to export

- Before you switch browsers or devices.
- Before you wipe site data for any reason.
- After any month-end reconciliation, as a personal habit.
- Before deleting a profile you might want back beyond the 7-day soft-delete window.

## What is and isn't included

Included: every account, category, transaction, payee, schedule, goal, and assigned amount.

Not included: the daily backup snapshots (they regenerate), the theme preference, the sidebar width, the sample-banner dismissed flag.
