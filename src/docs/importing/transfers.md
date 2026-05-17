---
title: "Importing transfers"
subtitle: "Banks export the two sides as independent transactions. Pair them up so the budget is honest."
category: "importing"
order: 4
---

A transfer between two of your accounts is one transaction logically and two transactions to the bank — one outflow on the source side, one inflow on the destination side. Bank exports send them as independent rows in independent files. After importing both accounts, you end up with two single-sided entries that look like spending and income.

If you leave them that way, [Ready to Assign](/glossary/ready-to-assign/) overstates your income, [Spending by category](/docs/reports/spending/) shows phantom outflows, and the [Net worth](/docs/reports/net-worth/) line is unaffected (because the two sides cancel) but every other report lies.

The cleanup is straightforward.

## The pattern to look for

After importing both accounts of a transfer:

- One row in account A, dated the transfer date, amount -$X, no category (or a *Transfer* / *Funds Transfer* category the bank invented).
- One row in account B, same date, amount +$X, same untagged category.

If your bank uses generic descriptions like "Online Transfer to/from CHK 1234" or "ACH Transfer," they're easy to spot. If the descriptions are vague ("Withdrawal" and "Deposit"), you'll need to compare dates and amounts.

## The fix, per pair

For each pair:

1. Open the source-account row in the [register](/docs/accounts/register-and-entry/).
2. Click **Convert to transfer**.
3. Pick the destination account.
4. Project Budget finds the matching row in the destination account (same date ±1 day, same absolute amount, opposite sign), confirms the pairing, and links them.
5. The destination row gets the *Transfer from [source account]* category automatically.
6. The source row gets *Transfer to [destination account]*.
7. Both rows update in place; no second import needed.

## When the destination row can't be auto-found

If the destination row isn't in the register (you only imported one account), Project Budget asks if you want to:

- **Create the missing side** — generates the opposite entry. Pick this when the destination account is on-budget but you haven't imported its file yet.
- **Leave as single-sided** — abandons the conversion. Pick this if the "transfer" is actually to an external account you don't track.

If the destination row exists but doesn't match (different amount, wrong sign), the matching modal lets you pick the candidate manually from a list of nearby rows.

## Bulk converting

When you have many transfers to fix at once (typical after a first-time import of a year of history):

1. Filter the register to category *Uncategorized* and any account.
2. Sort by date.
3. Pairs of equal-and-opposite amounts on adjacent rows are usually transfers. Tick both, then use **Bulk → Convert to transfer pair**. The bulk modal walks through each pair, asks for confirmation, and links them in sequence.

For thirty pairs this is a 10-minute job. For three hundred it's still tedious; budget some patience and a cup of coffee.

## Credit-card payments are transfers

The most common type of import-transfer is the monthly credit-card payment: outflow from checking, inflow on the credit card (reducing debt). After importing both, the cleanup pairing turns the two rows into one transfer; the *Visa payment* category Available correctly drops by the payment amount.

See [Credit-card workflow](/docs/accounts/credit-card-workflow/) for the full cycle.

## What about Venmo, Zelle, PayPal?

If you actively track your Venmo (or similar) balance as an on-budget account in Project Budget, then sending money from checking to Venmo is a transfer — apply the pairing.

If you don't track Venmo as an account (most people don't), then "sending money to a friend via Venmo" is a normal outflow categorized to wherever the money was for. The Venmo side never enters Project Budget. No pairing needed.

## After the cleanup

Re-check the [Spending by category](/docs/reports/spending/) report. The phantom outflows should be gone. *Income vs expense* should show smaller, more realistic totals. *Net worth* is unchanged (it always was; transfers cancel by definition).

The dedupe detector knows about paired transfers, so re-importing either file later won't re-create the single-sided entries. See [Duplicate detection](/docs/importing/duplicate-detection/).
