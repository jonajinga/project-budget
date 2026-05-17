---
title: "Net worth report"
subtitle: "One line per month. The single most useful long-horizon number in personal finance."
category: "reports"
order: 2
---

The [Net worth report](/app/reports/net-worth/) plots the sum of every account's month-end balance across time. On-budget cash, credit-card debt (negative), tracking assets, tracking liabilities — all of it, summed, monthly.

## The math

For every month in the window, the report computes:

```
net worth(month) = sum of (balance of each account on the last day of the month)
```

A credit-card account with a $400 balance contributes -$400. A mortgage tracking-liability with a -$240,000 balance contributes -$240,000. A 401k tracking-asset at $80,000 contributes +$80,000.

The line is the running total. There is no smoothing, no trend line, no projection — what you see is what your accounts said at the close of each month.

## Time windows

The window picker:

- **1 year** — month-by-month, last 12 months
- **3 years** — month-by-month, last 36 months
- **5 years** — month-by-month, last 60 months
- **All-time** — month-by-month, full profile history
- **Custom** — pick a start and end month

The chart switches from full month resolution to quarterly aggregates when *All-time* is selected on a profile with more than five years of history. This keeps the line readable.

## The companion table

Below the chart is a table with one row per month:

- **Month**
- **Cash** — sum of on-budget accounts
- **Debt** — sum of credit-card balances (positive number, representing what you owe)
- **Tracking assets** — sum of tracking-asset accounts
- **Tracking liabilities** — sum of tracking-liability balances (positive number)
- **Net worth** — assets minus debts

The table prints next to the chart on the print stylesheet.

## What it's good for

- **Confirming you're moving in the right direction.** A line going up means you're saving faster than your tracking assets are depreciating and your debt is growing. A flat line means you're treading water. A line going down means the opposite.
- **Catching one-off windfalls and shocks.** A bonus, a tax refund, a big medical bill — they all show up as month-over-month jumps. Hovering a month shows what changed.
- **Year-over-year comparison.** A multi-year window makes it easy to see whether this March is ahead of last March.

## What it's not good for

- **Daily volatility.** Month-end snapshots smooth out everything in between. If you want to watch a brokerage day-by-day, use the brokerage's own tools.
- **Inflation-adjusted comparison.** The report shows nominal dollars. If you want real dollars, you'll need to deflate yourself.
- **Tracking individual account contribution.** Use the [Spending by category](/docs/reports/spending/) or the [register filtered by account](/docs/transactions/filter-and-search/) for that.

## When tracking accounts need updating

A common cause of misleading net worth lines: tracking accounts that haven't been updated in months. A 401k balance you entered in January doesn't change on its own — the report keeps using January's number for every month after until you add a transaction or edit the opening balance.

Recommended habit: on the first of every month, open the relevant tracking accounts (401k, brokerage, home value), check the institution's current balance, and add an *Adjustment* transaction for the difference. Five minutes total. The report immediately reflects the new reality.

## Print

The print stylesheet hides the chrome, scales the chart to fit a portrait page, and prints the data table on a second page. Useful for monthly review packets if that's a habit you have.
