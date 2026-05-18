---
title: "Switching from YNAB or Mint"
subtitle: "What carries over, what works differently, and where to look for the equivalent feature."
category: "getting-started"
order: 7
---

Project Budget uses the same four-rule envelope method as YNAB and the same transaction-history shape as Mint, so the muscle memory transfers. The vocabulary and a few mechanics are different. This page maps them.

## Coming from YNAB

The model is intentionally similar.

| YNAB term            | Project Budget term                    |
|----------------------|-----------------------------------------|
| Ready to Assign      | [Ready to Assign](/glossary/#ready-to-assign) — same idea, same name |
| Category Assigned    | [Assigned](/glossary/#assigned)         |
| Category Activity    | [Activity](/glossary/#activity)         |
| Category Available   | [Available](/glossary/#available)       |
| Master category      | Category group                          |
| Scheduled transaction| Recurring template — see [Recurring](/docs/recurring/overview/) |
| Reconcile            | [Reconcile](/docs/accounts/reconciliation/) — same flow |
| Targets (Goals)      | [Goals](/docs/envelope-budget/goals/) — four types vs YNAB's three |

What's the same: every dollar gets a job, overspending in cash categories reduces next month's Ready to Assign, credit cards use a paired payment category.

What's different:

- **No direct bank import.** Project Budget reads files you download. There is no link to Plaid or any bank API. See [Importing your initial data](/docs/getting-started/importing-initial-data/).
- **No subscription.** The app is free; there is no account to create.
- **Local-only data.** Your budget lives in your browser, not on a server. See [How storage works](/docs/profiles-backups/how-storage-works/).
- **Recurring never posts automatically.** Templates surface on the due date for you to approve, skip, or edit. See [Skip vs post-now](/docs/recurring/skip-vs-post-now/).
- **Reports are different but cover the same ground.** YNAB's Spending, Income vs. Expense, Net Worth, and Age of Money all have equivalents — see [Reports overview](/docs/reports/overview/).

### Migrating data from YNAB

YNAB's CSV export gives you one transactions file and one budget file per account.

1. Use the per-account transactions CSV — the *all transactions* export is harder to dedupe.
2. Create matching accounts in Project Budget first. See [Your first account](/docs/getting-started/first-account/).
3. Import each account's CSV separately. Project Budget's generic CSV detector handles YNAB's column names.
4. Recreate categories by hand. The YNAB budget CSV is a snapshot of assignments, not the category structure, and the structures rarely map one-to-one.
5. Set goals fresh on the [Budget](/app/budget/) page.

## Coming from Mint

Mint was a tracker, not a budget. The biggest mindset shift: you assign money **before** you spend it, not classify it after.

| Mint term            | Project Budget term                     |
|----------------------|------------------------------------------|
| Transactions tab     | [Register](/docs/accounts/register-and-entry/) |
| Trends               | [Reports](/docs/reports/overview/)       |
| Budgets (per category cap) | Goals — *Monthly fixed* type — see [Goals](/docs/envelope-budget/goals/) |
| Goals (savings target)     | Goals — *Reach a target by a date* type |
| Bills                | Recurring templates                     |
| Net worth tile       | [Net worth report](/docs/reports/net-worth/) |

### Migrating data from Mint

Mint's all-transactions CSV is one of the supported shapes. The flow:

1. Export all transactions from Mint.
2. Create the same accounts in Project Budget — *all transactions* is filtered by `Account Name` per row.
3. On [Import](/app/import/), select the account, then upload the same CSV repeatedly — once per account. The importer filters rows where `Account Name` matches the selected account.
4. Reconcile each account against current statement balances.
5. Build a category structure from scratch — Mint's auto-categories are a starting point at best.

## A common rough patch

After migrating, the first month feels strange. Your reports look thin (one month of data isn't much), Auto-assign has nothing to average, and you're typing every assignment by hand. This is temporary; by month three the app does most of the assigning work for you.
