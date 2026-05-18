---
title: "Moving money between categories"
subtitle: "The simplest budget repair tool. Three ways to do it; same effect."
category: "envelope-budget"
order: 5
---

Plans change. The whole point of envelope budgeting is that re-planning costs nothing — you reassign dollars and move on. Project Budget gives you three ways to move money between categories. All three produce the same result.

## What "moving" actually does

Moving $50 from *Dining out* to *Groceries* this month means:

- *Dining out*'s **Assigned** drops by $50.
- *Groceries*'s **Assigned** rises by $50.

No transaction is created. The bank doesn't see anything. [Ready to Assign](/glossary/#ready-to-assign) is unchanged. The reports for *Dining out* and *Groceries* reflect the new assignment.

You can only move dollars between categories that exist in the same profile and the same month. To shift money across months, edit the future month's Assigned directly.

## Method 1: drag

On [Budget](/app/budget/), drag a category row by its handle and drop it on another row. A small popover asks how much to move, defaults to the entire Available balance of the source row, and confirms.

## Method 2: click into Available

Click any category's **Available** cell. The cell flips to an editor with two choices: *Move money from…* (when you want to top this category up from another) and *Move money to…* (when you want to push surplus out). Pick a counterparty category, type the amount, confirm.

## Method 3: edit Assigned directly

The most surgical and the easiest to think about. Type a lower number in the source row's **Assigned**, hit Enter, then type a higher number in the destination row's **Assigned**. Ready to Assign briefly rises by the difference, then falls back to zero when you finish the second edit.

This works because Ready to Assign is the buffer between un-assigned dollars and category Assigned. Pulling money out of a category puts it back in Ready to Assign; assigning it elsewhere takes it out again.

## When to move from Ready to Assign

If Ready to Assign is positive (typically because new inflow arrived since the last assigning session), assign that money directly into the category that needs it rather than borrowing from another category. Keep envelopes that are working as they are.

## When to move from another category

When Ready to Assign is zero and a category is [overspent](/docs/envelope-budget/underfunded-vs-overspent/) or about to be, you have to take money from somewhere. Pick the lowest-priority category that has surplus this month — usually a discretionary one like *Entertainment* or *Just for Fun*.

## What not to do

- **Don't pull money out of next month's Assigned to cover this month.** If you've already pre-budgeted ahead, leave it alone. Cover overspends from current-month categories or accept the next-month penalty.
- **Don't move money out of the [Credit Card Payment](/glossary/#credit-card-payment-category) category to cover overspending.** That money was earmarked for the bill. Pulling it out leaves you short when the statement arrives.

## History

Every move and every Assigned edit is preserved in the [Assignment history report](/docs/reports/assignment-history/) — useful for spotting categories you've been raiding from all year.
