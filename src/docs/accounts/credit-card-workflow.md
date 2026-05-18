---
title: "Credit-card workflow end-to-end"
subtitle: "From the swipe at the register to the cleared statement payment, every step in order."
category: "accounts"
order: 4
---

Credit cards are the part of envelope budgeting people get tangled up in. The mechanics are simple once you see the full cycle. This page walks one card through one month.

## The setup

You've added a Visa with a current balance of -$240 (you owe $240). Project Budget auto-created a *Visa payment* category in a hidden *Credit Card Payments* group. That category already shows $240 Available — the opening balance was recorded as a pre-assigned debt.

## Day 5: a charge posts

You buy groceries: $87 on the Visa.

1. Enter the transaction on [Register](/app/register/) with account *Visa*, category *Groceries*, amount -$87. Or import it from the bank's CSV.
2. *Groceries* Activity decreases by $87 (you spent grocery money).
3. *Visa payment* Activity increases by $87 (cash is earmarked to pay this charge).
4. Your on-budget cash balance (sum of checking + savings + cash) decreases by $87 conceptually, even though it hasn't physically left checking yet.

Net effect on the budget: identical to a debit-card transaction. The $87 left an envelope.

## Day 12: more charges

Gas $42, dining $31. Same pattern: each charge moves cash from its spending category into *Visa payment*. By day 12 the *Visa payment* category Available shows $240 + $87 + $42 + $31 = $400.

## Day 15: overspending one category

You buy more groceries: $48. But *Groceries* only had $60 available before today, you've already burned $87 + $48 = $135. *Groceries* goes red at -$75.

The *Visa payment* category doesn't care. It earmarks the full $48 anyway — the bill is funded regardless of which envelope it came from. See [Underfunded vs overspent](/docs/envelope-budget/underfunded-vs-overspent/) for the cash side.

## Day 18: pay the overspend forward

Open the red *Groceries* row. Click Available, pick *Move money from…*, and pull $75 out of *Just for Fun*. *Groceries* returns to zero. *Visa payment* is untouched (it was already correct).

If you don't fix it, next month's [Ready to Assign](/glossary/#ready-to-assign) starts $75 lower. The card still gets paid.

## Day 28: statement arrives

The Visa statement shows $208 due (the new charges) on top of the $240 carryover. Total balance: $448. Minimum payment: $25. You decide to pay the full statement balance.

## Day 28: make the payment

On [Register](/app/register/), click **Transfer**. Source: *Checking*. Destination: *Visa*. Amount: $448. Project Budget creates the paired entries:

- *Checking*: -$448 (cash leaves)
- *Visa*: +$448 (debt decreases)

The *Visa payment* category Available drops by $448 — cash was earmarked, cash was spent.

## Day 30: the month closes

The Visa balance is now $208 - $0 = wait, let's recalculate. You owed $240 at month-start. You charged $208. You paid $448. Closing balance: $240 + $208 - $448 = $0. Card balance is zero.

The *Visa payment* category Available is also zero (you earmarked exactly what you owed, and you paid exactly that). If there's a small residual it's usually a charge that posted to the card after you paid — perfectly normal, will be earmarked from next month's spending.

## Edge cases

### Returns

A return is a positive amount on the card. Enter it as a regular transaction, account *Visa*, category *Groceries* (or whatever you originally bought), amount +$30. *Groceries* Activity rises by $30 (envelope refilled). *Visa payment* Activity decreases by $30 (less to pay).

### Paying less than the statement balance

Same transfer; smaller amount. *Visa payment* Available stays positive — that's cash earmarked for future statements. You're carrying revolving debt; the budget knows.

### Cash advance

Treat as a transfer from *Visa* to *Cash on hand* (or wherever the cash went). The card balance goes up; the cash account goes up. No category Activity, because no category was spent on yet — you just moved a liability into an asset. Spend that cash later and categorize the spend at that point.

### Reward redemption as statement credit

A statement credit reduces the Visa balance. Enter it as account *Visa*, amount +$X, category *Ready to Assign* (the special inflow category). This adds $X to RTA — you can now assign it. *Visa payment* Activity decreases by $X automatically because the credit also reduces what you owe.

## A common misconception

Project Budget does **not** automatically pay your credit card. The *Visa payment* category accumulating cash is just the budget setting money aside. You still have to make the actual payment — by transfer or by the bank's own bill-pay — and enter that payment as a transfer here.
