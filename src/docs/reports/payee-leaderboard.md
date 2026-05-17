---
title: "Payee leaderboard"
subtitle: "Where the money actually went, ranked by merchant."
category: "reports"
order: 6
---

The [Payee leaderboard](/app/reports/payees/) ranks every payee by total outflow over a chosen window. It's the per-merchant complement to the [Spending by category](/docs/reports/spending/) report, which is per-category.

## The math

For every payee, sum the *outflow* transactions to that payee in the window. Splits are walked at the parent-payee level — a $100 split between two categories still counts as one $100 transaction to that payee.

Inflows from payees (refunds, paychecks, interest) are excluded by default. Toggle *Show inflows separately* in the toolbar to add a second ranked list of inflow payees.

## Windows

- **This month**, **last month**, **last 3 months**, **year to date**, **last 12 months**, **custom**.

## The table

One row per payee. Columns:

- **Payee**
- **Spend** — total outflow in the window
- **Count** — number of transactions
- **Average** — spend ÷ count
- **Last seen** — date of the most recent transaction with this payee
- **Top category** — the category that received the largest share of this payee's spend

Sortable by every column. Default sort is *Spend* descending.

## Filters

- **Account scope** — one account, an account group, or all.
- **Minimum count** — hide payees with fewer than N transactions in the window. Useful for filtering out one-off charges and seeing only the merchants you actually frequent.
- **Hide transfers** — on by default. Transfer counterparties (e.g., the credit card account showing up as a payee on transfer rows) get noisy fast.

## What it's good for

- **Subscription audit.** Once a quarter, scan the leaderboard for monthly-recurring small charges. Cancel what you don't use.
- **Renegotiation candidates.** The top 10 by spend is where small percentage savings translate to real dollars. *Insurance — Auto* in your top 5 is a candidate for a quote-shopping session.
- **Catching duplicate payee names.** *AMZN Mktp* and *Amazon Marketplace* both showing up means an import created two payee variants. Use bulk edit to merge them. See [Filtering and bulk edits](/docs/transactions/filter-and-search/).

## Drill-in

Click a payee row to filter the [register](/docs/accounts/register-and-entry/) to that payee for the window. Useful for "every transaction with Whole Foods this quarter" reviews.

## Inflow leaderboard

When *Show inflows separately* is on, a second table appears below the main one. Same columns; ranked by inflow amount. Useful for:

- Confirming all expected paychecks landed
- Spotting refunds you forgot were coming
- Identifying interest-payment accounts (most banks send several small interest credits per year that are easy to lose track of)

## What the leaderboard is not

- **Not a category report.** A *Target* payee can hit groceries, household, gifts, and pharmacy in one trip — the leaderboard shows the merchant total; the category split is in the split rows.
- **Not a budget report.** No assignment column. For Assigned-vs-actual see [Budget vs actual](/docs/reports/budget-vs-actual/).
- **Not a forecast.** Historical only.

## A pattern worth watching

If your top payee by spend is unexpected — a delivery app, a single restaurant, an online store — that's the leaderboard surfacing a habit you didn't notice. The point isn't to feel bad about it; the point is that the data was hiding in the register and the leaderboard pulled it out.
