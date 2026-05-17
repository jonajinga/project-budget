---
title: "Budget vs actual report"
subtitle: "What you planned to spend versus what actually moved. Per category, per month."
category: "reports"
order: 4
---

The [Budget vs actual report](/app/reports/budget-vs-actual/) puts your monthly assignments next to your monthly activity for every category. It's the report that tells you whether your envelopes are realistic — over time, do you spend roughly what you assign, or are you consistently off in one direction?

## The math

For every category, for every month in the window, the report computes:

- **Assigned** — what the *Budget* page shows as Assigned for that month
- **Spent** — absolute value of negative activity in that category, that month
- **Variance** — Assigned minus Spent (positive = underspent / leftover; negative = overspent)

The chart shows paired bars per month per category. The table shows the same numbers in rows.

## Windows

- **Last 3 months**, **last 6 months**, **last 12 months**, **year to date**, **custom**.

A custom range with start and end months is supported; longer ranges work but the chart gets dense past 24 months.

## Grouping

- **Top 10 by spend** — most categories don't matter; this picks the ones that do.
- **One category** — drill into a single line over time.
- **By group** — one bar pair per category group, summing the categories within.

## What it's good for

- **Spotting envelopes you under-assign to.** *Groceries* with consistent red variance every month means $400/month isn't enough; you actually need $475 and you've been borrowing from somewhere else to cover it.
- **Spotting envelopes you over-assign to.** *Subscriptions* with consistent green variance means you're hoarding cash in a category that doesn't need it. Move it to something that does.
- **Validating goal targets.** A *Reach a target by a date* goal that's consistently underspent suggests the goal is conservative and the cash isn't being used; consider raising the target or reducing the monthly contribution.

## What it's not

- **Not a forecast.** This is historical. For forward-looking projections see [Cashflow projection](/docs/reports/projection/).
- **Not a per-payee view.** Category-level only.

## How variance interacts with carry-over

A category with $50 underspent in March doesn't disappear — it [carries over](/docs/envelope-budget/carry-over-rules/) to April's starting balance. The Budget vs actual report shows March variance as +$50; it does not adjust April's Assigned to compensate. April stands on its own.

This means a category with *Refill up to a balance* goals will often show variance every month even when it's behaving correctly — the goal does the rebalancing, not the Assigned cell.

## Color coding

- **Green** — underspent (you assigned more than you spent)
- **Red** — overspent (you spent more than you assigned)
- **Gray** — exactly on target, or no spend / no assignment

The red/green palette comes from the theme tokens; flipping the theme adjusts both.

## Drill-in

Click any month/category cell to jump to the [register](/docs/accounts/register-and-entry/) filtered to that category and month. Quickest way to investigate "why did *Dining out* go $80 over in November?"

## A common pattern worth fixing

Categories that show one month deep red, next month deep green, next month deep red again. That's not a budgeting problem — that's an inconsistent assignment process. Either Auto-assign isn't being used or it's being overridden differently each month. See [Auto-assign strategies](/docs/envelope-budget/auto-assign/) for a steady-state workflow.
