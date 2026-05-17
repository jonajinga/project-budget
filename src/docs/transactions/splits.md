---
title: "Split transactions"
subtitle: "One transaction, two or more categories. When and how."
category: "transactions"
order: 1
---

A [split transaction](/glossary/split/) divides one row's amount across multiple categories. Use it whenever a single charge covers things that belong in different envelopes.

## A typical case

You drop $84 at Target. The receipt breaks down as:

- $52 groceries
- $24 household supplies
- $8 a birthday card

If you enter that as a single $84 charge to *Groceries*, your spending report misattributes $32 and your *Household supplies* envelope never knows it was tapped.

The split version:

1. Enter the transaction normally for $84.
2. Click **Split** on the row.
3. Add three split lines: *Groceries* -$52, *Household supplies* -$24, *Gifts* -$8.
4. The split total updates the parent. Save.

The transaction now shows *Multiple* as its category. Expanding the row reveals the breakdown.

## What the data looks like

Internally, a split parent stores the total amount and a `splits` array. Each split entry has a category, an amount, and an optional memo. Reports walk the splits, not the parent — *Spending by category* attributes $52 to Groceries, $24 to Household, $8 to Gifts.

The parent's `categoryId` is null. Filtering the register by category shows the split parent if any child matches; clicking the parent reveals which line matched.

## Editing splits

Click **Edit** on the parent. The split rows become editable. You can:

- Change a split's category, amount, or memo.
- Add a new split line.
- Delete a split (the parent total must still equal the sum of remaining splits).
- **Convert back to single** — remove all but one split. The transaction becomes a regular single-category row.

## Splits with transfers

A split line can be a transfer. Useful for "I paid $100 on the card and also moved $50 from checking to savings" as one entry — though most people find this confusing and split such cases into two separate transactions.

A split with a transfer line creates the paired entry on the other account when saved.

## Splits and credit cards

Splits behave exactly the same on credit-card accounts as on debit accounts. The [Credit Card Payment](/glossary/credit-card-payment-category/) category Activity rises by the full parent amount; each split's category Activity moves by its own portion. The math always balances.

## Splits and import

When importing from CSV/OFX/QIF/QFX, transactions arrive un-split — the bank doesn't know your category structure. After import, find compound transactions in the [register](/docs/accounts/register-and-entry/) and split them by hand. There is no auto-split.

## Splits and reconciliation

A reconciled split parent is fully locked — you can't edit the parent total *or* any child split until you unlock it. The cleared flag is at the parent level, not per-split.

## When not to split

If you keep splitting the same payee into the same two categories, ask whether those should be one category instead. *Gas* and *Convenience store snacks* at the gas station might be one *Gas station* envelope in real life. Split where the categories matter; merge where they don't.
