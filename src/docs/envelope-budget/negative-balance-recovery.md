---
title: "Recovering from a negative balance"
subtitle: "When Ready to Assign goes red, what to do and in what order."
category: "envelope-budget"
order: 8
---

Negative [Ready to Assign](/glossary/#ready-to-assign) means you've committed more dollars than you have in your on-budget accounts. The hero at the top of [Budget](/app/budget/) turns red. The fix is mechanical and short.

## How you got here

Three common causes:

1. **A prior-month overspend rolled forward.** A category ended last month negative, and the deficit hit this month's RTA. See [Carry-over rules](/docs/envelope-budget/carry-over-rules/).
2. **You over-assigned.** You typed a number into a category's Assigned that pushed the running total past your inflow.
3. **A miscategorized inflow.** A paycheck or refund got tagged to a spending category instead of staying in Ready to Assign.

The recovery differs slightly for each. Walk through these in order.

## Step 1: confirm the actual gap

Click the red RTA number to see the breakdown. The popover shows:

- This month's inflows (positive)
- This month's category assignments (negative)
- Prior-month deficits absorbed (negative)
- Net = current Ready to Assign

That tells you whether you're dealing with a current-month over-assignment, a carry-over hit, or a categorization error.

## Step 2: check for miscategorized income

On [Register](/app/register/), filter the current month to *Inflow* transactions only. Every paycheck, refund, or interest payment should be categorized to *Ready to Assign* (the special inflow category, not a spending category). Anything tagged to a spending category is being treated as a refund to that envelope rather than as new money — fix the category and RTA jumps back up by the inflow amount.

## Step 3: roll back the most recent assignment

If RTA went red because of a single over-assignment you just made, the simplest fix is to undo it. Look at the [Assignment history report](/docs/reports/assignment-history/) for this month — the most-recently-edited rows are at the top. Pull the most recent Assigned change back to its prior value.

## Step 4: redistribute

If the gap is real (you genuinely committed more than you have), move money out of lower-priority categories until RTA reaches zero.

A reliable cut-list, in order:

1. **Just for Fun** — discretionary categories first.
2. **Quality of Life** — dining, entertainment, hobbies.
3. **Savings goals not on a deadline** — emergency fund top-ups can wait a month.
4. **True Expenses with cushion** — categories whose Available is significantly more than this month's bill needs.

Don't cut Immediate Obligations until everything else is at zero — those bills are due.

## Step 5: cover a prior-month deficit you can't absorb

If a prior-month overspend pushed RTA so far negative that this month's income can't cover it (rare but possible), you have two choices:

- **Accept the rolling deficit.** Leave one category under-funded for a month or two until paychecks fill the gap. Honest, but uncomfortable.
- **Pull from a tracking-asset cushion.** If you have savings in a tracking account you'd consider "real," transfer it into an on-budget account and the transfer becomes new RTA. That's the moment to be honest about whether savings are savings or a slush fund.

## What not to do

- **Don't delete the offending transactions** to make the math work. The bank still cleared them; the budget needs to reflect reality.
- **Don't move money out of [Credit Card Payment](/glossary/#credit-card-payment-category)** to fix RTA. Those dollars are earmarked for the bill.
- **Don't lower a goal's target** to silence an *Underfunded* indicator — that's not the same problem and not the same fix. See [Underfunded vs overspent](/docs/envelope-budget/underfunded-vs-overspent/).

## Prevention

Two habits that prevent most red-RTA days:

- Run [Auto-assign](/docs/envelope-budget/auto-assign/) at the start of each month with a strategy that respects Ready to Assign's limits — the preview will warn before pushing you negative.
- Reconcile each account monthly so overspends are caught immediately, not three months later.
