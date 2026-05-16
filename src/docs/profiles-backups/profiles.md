---
title: "Multiple profiles"
subtitle: "Run separate budgets in one browser without crossing wires."
category: "profiles-backups"
order: 1
---

## Why multiple profiles

The obvious one: separate household and personal budgets. The less-obvious ones: a budget for a side business, a sandbox for experimenting with goals, a copy of last year's budget you want to keep frozen for tax season.

Each profile is fully isolated. Switching profiles swaps every account, every transaction, every category, every report.

## Storage layout

Every profile is one localStorage key (`projectbudget:profile:<id>`). The active profile id is at `projectbudget:active`. A small index at `projectbudget:profiles` lists names and last-opened timestamps so the switcher works fast.

## What you can do with a profile

- **Create** — from scratch, or by importing a JSON export.
- **Rename** — change the visible name without touching the data.
- **Duplicate** — a deep copy with a new id. Useful for cloning before an experiment.
- **Delete** — soft delete. The profile moves to `projectbudget:trash:<id>` for 7 days before it's purged.
- **Switch** — swap the active profile. The store reloads and the UI refreshes.
