---
title: "Spending by category report"
subtitle: "Treemap of where your money actually went over a chosen window."
category: "reports"
order: 3
---

The [Spending by category report](/app/reports/spending/) shows outflows aggregated by category over a window you pick. The default visualization is a treemap — bigger rectangle, more spent. A bar-chart toggle exists for users who prefer linear comparisons.

## The math

For every category, sum the *negative* activity (outflows only) during the window. Inflows to a category — refunds, returns — are subtracted in the table view but excluded from the treemap (treemaps don't render negative areas).

Splits are walked: a $100 transaction split $60 / $40 contributes $60 to one category and $40 to another, not $100 to either.

## Windows

- **This month**, **last month**, **last 3 months**, **last 12 months**, **year to date**, **custom**.

The window selector also offers **Compare to previous period** — adds a smaller bar / rectangle showing the prior window's spending in the same category. Useful for "is dining out trending up or down?" questions.

## Grouping

Three grouping levels:

- **By category** (default) — every leaf category gets its own rectangle.
- **By category group** — every group is a rectangle; categories within are stacked.
- **Top 10 + Other** — the top 10 categories by spend get rectangles; everything else collapses into one *Other* tile.

The top-10 view is the most readable on a phone-sized screen.

## What's excluded

- **Transfers between your own accounts.** Moving $1,000 from checking to savings is not spending; it doesn't appear here.
- **Inflows.** Spending is outflow-only by definition.
- **Credit-card payment activity.** The [Credit Card Payment](/glossary/credit-card-payment-category/) category accumulates earmarks, not spending — its activity comes from other categories' spending and doesn't appear as its own line.
- **Off-budget transactions** in tracking accounts. Spending here is restricted to on-budget activity.

## Filters

- **Account scope** — one account, an account group, or all on-budget accounts. Useful when you want "what did I spend on the Visa this month" specifically.
- **Exclude reimbursed** — when on, transactions in any category that has at least one offsetting inflow within the window get netted before display. Practical for shared-expense scenarios where you spend then get paid back.

## What it's good for

- **End-of-month review.** What categories ate more than I expected?
- **Lifestyle creep detection.** Compare-to-previous on a 12-month window: which categories grew the most?
- **Category-structure decisions.** A category that always shows up under $5 across a year is probably worth merging into a bigger one. A category that consistently dominates *Other* in the top-10 view is probably worth splitting.

## What it's not

- **Not a budget vs actual report.** The treemap only knows what you spent, not what you assigned. For that comparison, see [Budget vs actual](/docs/reports/budget-vs-actual/).
- **Not a payee report.** Categories aggregate across many payees. For per-merchant rankings, use the [Payee leaderboard](/docs/reports/payee-leaderboard/).

## Drill-in

Click any rectangle to filter the [register](/docs/accounts/register-and-entry/) to that category for the chosen window. Quick path from "*Dining out* is huge this quarter" to "let me see every transaction that fed that number."
