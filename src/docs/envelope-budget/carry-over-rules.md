---
title: "Carry-over rules"
subtitle: "What happens to leftover money — and leftover deficits — when the month ends."
category: "envelope-budget"
order: 7
---

[Carry-over](/glossary/carry-over/) is what happens at midnight on the last day of a month. Project Budget runs one short rule for every category. The rule is asymmetric: surplus rolls; deficit doesn't.

## The rule, in one paragraph

If a category's [Available](/glossary/available/) at month-end is **positive**, that amount becomes the carry-in for the same category next month. If Available is **negative**, the carry-in resets to zero and the deficit is subtracted from next month's [Ready to Assign](/glossary/ready-to-assign/). If Available is **exactly zero**, nothing happens.

## Why surplus rolls

Because the envelope still has money in it. If you assigned $400 to *Groceries* and only spent $350, the remaining $50 doesn't vanish — it's groceries money you didn't need yet. Next month starts with $50 already in the envelope; whatever you assign on top of that is additive.

This is what makes [True Expenses](/docs/getting-started/envelope-method/) work. You can assign $50/month toward *Car insurance* for six months, watch the balance grow to $300, and pay the semi-annual bill from accumulated dollars without disrupting any other category.

## Why deficit resets

If *Groceries* ends the month at -$23 (you spent $23 more than was in the envelope), Project Budget does **not** start next month at -$23. The reasons are practical:

- A perpetual hole compounds month over month and becomes psychologically defeating.
- The dollars came from somewhere real — your accounts. That "somewhere" was Ready to Assign, drawn against your future income.
- The honest accounting is: you spent $23 that hadn't been assigned to anything yet. Next month's RTA absorbs the hit and the category starts fresh.

## Worked example

Two-month run of *Groceries*:

| Month | Carry-in | Assigned | Activity | Available | Carry-out → next month |
|-------|----------|----------|----------|-----------|------------------------|
| April | $0       | $400     | -$350    | $50       | $50 carries in to May  |
| May   | $50      | $400     | -$480    | -$30      | $0 carry-in to June; RTA reduced by $30 on June 1 |

By June 1, *Groceries* shows $0 carry-in. You assign fresh from a Ready to Assign that's $30 lighter than it would have been.

## Credit-card categories carry too

The [Credit Card Payment](/glossary/credit-card-payment-category/) category follows the same surplus-rolls / deficit-resets rule. In practice it rarely ends a month negative — that would mean you paid more than the card owed, which is unusual.

## Tracking-account "categories"

Tracking accounts don't have categories and don't participate in carry-over. Their balances are reported in [Net worth](/docs/reports/net-worth/), nothing more.

## Overriding the rule

You can't change the rule per-category. If you want a category to *not* accumulate (a *Fun money* envelope where leftover should refund to Ready to Assign at month-end), do it manually: at month-end, move the surplus from *Fun money* back to a savings category or directly into next month by editing next month's Assigned.

A natural place to spot accumulation drift is the [Assignment history report](/docs/reports/assignment-history/), which shows months of carry-in alongside Assigned and Activity for every category.
