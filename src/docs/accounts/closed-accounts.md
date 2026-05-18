---
title: "Closing accounts"
subtitle: "When to close, what gets archived, and how to keep historical reports intact."
category: "accounts"
order: 5
---

Accounts get closed in real life — the credit card paid off and shut, the savings account moved to a new bank, the loan finished. Project Budget keeps closed accounts around for history without letting them clutter the live UI.

## When to close

Close an account when:

- The real-world account is closed and you have no more transactions to enter.
- The balance is zero (or you've reconciled it to zero deliberately).
- You don't want it in the [Accounts](/app/accounts/) sidebar anymore.

Don't close an account just because you stopped using it temporarily. A dormant card you may use again is better left open with a zero balance.

## How to close

From [Accounts](/app/accounts/), click the account, then choose **Close account** from the actions menu. Project Budget prompts for confirmation if the balance is non-zero — you can choose to close anyway, but a non-zero balance on a closed account is usually a mistake.

## What happens to a closed account

- It hides from the default Accounts view. Toggle **Show closed** to bring it back into the list.
- It stops appearing in account dropdowns (transaction entry, transfers, reconcile).
- Its transactions remain in the [register](/docs/accounts/register-and-entry/) — historical reports still see them.
- It stops contributing to Net worth from the close date onward.
- The account name gets struck through in the sidebar so it reads as archived.

For a closed credit-card account, the auto-created [Credit Card Payment](/glossary/#credit-card-payment-category) category is also hidden but kept for history. You can't assign to it anymore.

## Reopening

Same menu, **Reopen account**. Everything returns to normal. The account is selectable in dropdowns again, transactions resume.

## Deleting

There is no hard delete for accounts — only close. If you genuinely don't want the history, two options:

- **Delete each transaction** individually from the register, then close the account. The account row becomes an empty stub; close hides it.
- **Export, edit, re-import.** Export the profile, open the JSON, remove the account block, re-import. Destructive but complete.

Most people are better off leaving closed accounts alone. They take no UI space once hidden and the history is occasionally useful — *Spending* and *Net worth* reports both benefit from full account history even on closed accounts.

## What about a transferred balance?

A common pattern: closing Savings Account A and moving the balance to Savings Account B at a new bank. Do this in three steps:

1. Add Account B with opening balance $0 (not the transferred amount — you haven't moved anything yet).
2. Enter a transfer from Account A to Account B for the full balance.
3. Close Account A.

The transfer is the audit trail. Both balances land where they should. Net worth is unchanged.
