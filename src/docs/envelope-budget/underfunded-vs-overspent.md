---
title: "Underfunded vs overspent"
subtitle: "Two different problems that look similar in the budget. Same fix is rarely the right fix."
category: "envelope-budget"
order: 4
---

Both states show up as a warning on the [Budget](/app/budget/) page. They mean different things and ask for different responses.

## Underfunded

A category is **underfunded** when its goal needs more assigned this month than you've given it, but [Available](/glossary/#available) is still zero or positive. You haven't overspent — you just haven't promised the goal as much as it asked for.

Example: *Car insurance* has a goal of $120/month and you've assigned $80. Available is $80. The category shows an amber *Underfunded by $40* indicator. Nothing has gone wrong yet; the goal will fall short if you don't catch up.

**The fix:** assign the missing dollars now, or accept that the goal is being deferred and edit the goal target so it stops complaining.

## Overspent (cash)

A cash category (one that doesn't sit behind a credit card) is **overspent** when [Activity](/glossary/#activity) plus carry-in plus assigned goes negative. You spent money that wasn't there.

Example: *Dining out* had $50 available. You spent $73 on debit. Available is now -$23 and the row turns red.

**The fix:** move $23 in from another category. Click the available cell, pick *Move money from…*, choose a category with surplus, confirm. The red disappears.

If you don't move money, the deficit silently reduces next month's [Ready to Assign](/glossary/#ready-to-assign) by $23 when the month rolls over. The category's [Carry-over](/glossary/#carry-over) resets to zero — you don't keep digging a deeper hole. See [Carry-over rules](/docs/envelope-budget/carry-over-rules/).

## Overspent (credit card)

Credit-card overspending is a different animal. When you spend $73 on a card but only $50 was assigned, the *Dining out* category goes red the same way — but the [Credit Card Payment](/glossary/#credit-card-payment-category) category for the card still earmarks the full $73 owed. The bill is funded; the budget is just telling you you spent more on dining than planned.

**The fix:** same as cash — move $23 from another category into *Dining out*. The Available there returns to zero. The payment category doesn't change.

If you don't move money, the same thing happens at month-end: next month's Ready to Assign drops by $23. The card still gets paid; you just take the dent in next month's starting position.

## How to spot the difference quickly

| Indicator color | Meaning                                          |
|-----------------|--------------------------------------------------|
| Amber           | Underfunded — goal wants more, nothing spent yet |
| Red             | Overspent — Available is negative                |
| Gray            | Funded to zero, no goal in play                  |
| Green           | Funded                                           |

When in doubt, hover the indicator; the tooltip names the exact state.

## A common mistake

Treating underfunded categories like overspending. They're not. Moving money from elsewhere "to cover" a goal that hasn't been spent is fine, but it's optional — you may simply not want to fund that goal this month. Overspending in a cash category is more urgent because the dollars have already left the account.
