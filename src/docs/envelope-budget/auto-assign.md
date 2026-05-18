---
title: "Auto-assign strategies"
subtitle: "Six ways to fill a month's Assigned column without typing every cell."
category: "envelope-budget"
order: 6
---

The **Auto-assign** button on [Budget](/app/budget/) opens a modal with six strategies. Pick one, preview the totals, apply. Every strategy is non-destructive — it sets Assigned values; it doesn't move money, doesn't create transactions, doesn't touch closed months. You can undo by editing the cells back, or by picking a different strategy and applying again.

## Scope

Before picking a strategy, scope matters:

- **All categories** — the toolbar's main *Auto-assign* button. Walks every non-payment category.
- **One group** — the three-dots menu on a group header. Touches only that group.
- **One category** — the three-dots menu on a category row. Touches only that row.

## The strategies

### Goal target

For every category with a goal, set Assigned to exactly what the goal needs this month. Categories without goals are left alone. Most useful for monthly fixed goals (rent, insurance, subscriptions) and reach-a-target goals on a deadline.

### Last month's spending

Set each Assigned to whatever Activity was in the same category last month. If you spent $412 on groceries in April, May's *Groceries* Assigned becomes $412. Good for stable categories, misleading for seasonal ones (don't run this in January expecting it to predict December).

### Three-month average

Set each Assigned to the mean of the last three months' Activity in that category. Smooths out one-off months. Underestimates if any of those three months had unusual restraint; overestimates if any had unusual splurging.

### Six-month average

Same as three-month but with a longer window. Better signal-to-noise, slower to react to lifestyle changes. Use this once you have six months of clean data.

### Underfunded only

For every category whose goal is short, top it up to the goal target. Funded categories are left alone. The opposite of *Goal target* — that one overwrites; this one only fills gaps.

### Last month's plan

Copy last month's Assigned values verbatim. Different from *Last month's spending* — this is your plan, not your reality. Useful when your assignments rarely change month to month.

## The preview

Each row in the modal shows the dollar total that strategy would apply. Negative previews are valid (a category that received money via inflow last month would Auto-assign to a negative). The total at the bottom is the net change to Ready to Assign — positive means you're freeing up cash, negative means you're committing it.

## A common workflow

The Auto-assign sequence most users land on after a few months:

1. **Goal target** — first pass; everything with a stated commitment gets covered.
2. Look at what's left in Ready to Assign.
3. **Three-month average** scoped to a *Variable spending* group — fund groceries, gas, dining at typical levels.
4. Manually assign what's left to savings or fun.

The whole session takes under a minute once it's habit.

## What Auto-assign won't do

- Touch credit-card payment categories (those are derived from card spending, not assigned directly).
- Overspend [Ready to Assign](/glossary/#ready-to-assign) — if a strategy would push RTA negative, the apply button warns and asks for confirmation.
- Modify months other than the active one.

If you want different behavior in a specific category, exclude it by scoping Auto-assign to its group and using a different strategy for that category afterward.
