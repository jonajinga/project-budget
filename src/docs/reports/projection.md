---
title: "Cashflow projection report"
subtitle: "Forward 3, 6, or 12 months from today's balances, recurring entries, and goal funding."
category: "reports"
order: 5
---

The [Cashflow projection report](/app/reports/projection/) extrapolates your accounts forward. It starts from today's balances, adds every pending [recurring entry](/docs/recurring/overview/), and accounts for [goal](/docs/envelope-budget/goals/) funding requirements. The output is a per-month forecast of where each account will sit.

## What's projected

For every on-budget account and every tracking account, for every month in the projection window:

```
projected balance(account, month) =
  current balance
  + sum of inflow recurring through month
  - sum of outflow recurring through month
  + transfers in
  - transfers out
```

Goal funding is layered separately:

- *Monthly fixed* goals contribute their target as an outflow from Ready to Assign each month.
- *Reach a target by a date* goals contribute their per-month need.
- *Monthly top-up* and *Refill up to a balance* goals contribute the average top-up / refill of the last 3 months.

## Windows

- **3 months** — short horizon; default. Useful for the next-paycheck question.
- **6 months** — medium horizon. Catches semi-annual bills like insurance.
- **12 months** — annual horizon. Catches every regular event of a normal year.

## The output

Two views, switchable via toolbar tabs:

### Per-account lines

One line per account across the projection window. Useful for "will my checking dip below the safety floor in March?" questions. Shaded zones mark months where any on-budget account is projected to go negative.

### Total cashflow bars

Two bars per month: total expected inflows (green) and total expected outflows (red). A line on top shows projected on-budget cash at month-end. Useful for "do my monthly inflows actually cover my monthly outflows on average?"

## Confidence

The projection is *only as good as your recurring templates and goals*. If you have no recurring set up, the line is flat — Project Budget assumes nothing happens. If your recurring covers 80% of regular outflows, the line is 80%-confident.

Two ways to improve confidence:

- **Add templates for every regular bill.** Subscriptions, utilities, the gym, payday. Every reliable monthly event.
- **Add reach-a-target goals for known annual bills.** Property tax, insurance premiums, holidays. The goal's per-month need feeds the projection.

## What's not projected

- **Discretionary spending** that isn't a recurring template. The projection won't predict what you'll spend on groceries unless *Groceries* is a recurring template (which is unusual). For variable-spending categories, the implicit assumption is the goal's monthly target.
- **Market gains or losses** on tracking-asset accounts. The projection assumes flat.
- **Mortgage / loan amortization** on tracking-liability accounts. If you want the projected balance to drop monthly, add a recurring template for the principal portion of each payment.

## Calibrating against reality

A practical exercise: at the start of each month, take a screenshot of the next-month projection. At month-end, compare projected end-of-month balance to actual. Within 5% is a tightly-calibrated recurring list. Within 20% is normal. Off by more than 20% means either a recurring template is missing or a goal target is wildly off.

## Worst-case overlay

The toolbar has a *Show worst-case overlay* toggle. When on, every variable goal-driven outflow is scaled to its 90th-percentile last-12-month spend instead of its target — a "what if every month is a bad month" line. The original projection stays visible; the worst-case appears as a dashed line below.

Useful for stress-testing: if even the worst-case line stays positive in every account, you have a real cushion.

## Caveats

The projection is a model. It will be wrong. The point is not perfect prediction; the point is direction and order of magnitude. A projection that shows checking dipping below $200 in February is telling you to move money before February, not predicting exactly $200.
