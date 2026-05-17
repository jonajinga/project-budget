---
title: "Importing your initial data"
subtitle: "Skip months of manual entry by pulling history from your bank — and learn which history is worth pulling."
category: "getting-started"
order: 6
---

You do not need historical transactions to start budgeting. The envelope method works from today forward. But two or three months of history makes the [reports](/docs/reports/overview/) useful immediately and gives Auto-assign something to average over.

## How much history to import

A pragmatic rule:

- **0 months.** You want to start clean and learn the app on live data. Perfectly valid.
- **3 months.** Enough for Auto-assign averages, last-month-spending shortcuts, and an honest *Spending* report. The sweet spot.
- **6–12 months.** You want trend lines, year-over-year context, and a full *Net worth* curve. Worth doing if your bank exports go back that far without fuss.
- **All-time.** Only do this if you're consolidating a long Quicken/Actual/Mint archive and you actually want it. It's slow to reconcile and the marginal insight drops fast.

## The flow

For each account that has history worth pulling:

1. Export from the bank in any supported format. See [Supported import formats](/docs/importing/formats/) for what works.
2. On [Import](/app/import/), pick the account you're importing into. **This matters** — transactions are tied to that account; you can't pick "all" and sort later.
3. Drop the file. Project Budget detects the format, parses, and shows a preview table.
4. Adjust column mapping if needed (CSV only — OFX/QFX/QIF are self-describing).
5. Review the dedupe count. The importer skips rows that match `account + date + amount + payee`, so re-running the same file is safe.
6. Click **Import**. Rows land in the register, marked as *Cleared* by default since the bank already posted them.

## Categorizing the past

You have three reasonable approaches:

- **Leave it uncategorized.** Reports won't be meaningful, but the balances are correct and you can categorize forward from today.
- **Bulk-categorize by payee.** Filter the [register](/docs/accounts/register-and-entry/) to a payee like "Whole Foods", select all, set category to *Groceries*. Repeat for the top 20 payees. Covers 80% of transactions in 20 minutes.
- **Categorize every row.** Tedious for a year of data, but produces clean historical reports. Worth it if you imported only a couple months.

## Reconcile after importing

Once history is in, reconcile each account against its current statement balance. See [Reconciliation](/docs/accounts/reconciliation/). This is the moment to catch missing transactions and import duplicates the dedupe didn't catch.

## What does **not** import

- **Goals** — you set those in Project Budget; no bank knows about them.
- **Category structure** — banks have their own "category" guesses on each transaction; Project Budget ignores them in favor of the categories you defined. You can map bank categories to yours later with bulk edits.
- **Transfers as paired entries** — most exports send the two sides of a transfer as two separate transactions in two separate files. See [Importing transfers](/docs/importing/transfers/) for the cleanup pattern.
