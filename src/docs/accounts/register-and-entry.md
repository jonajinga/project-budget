---
title: "The register and entering transactions"
subtitle: "Add, edit, split, and clear transactions across one account or all of them."
category: "accounts"
order: 2
---

## Quick entry

The form at the top of [Register](/app/register/) takes a date, payee, category, amount, and account. The amount is signed: negative for outflows, positive for inflows. Mark *Cleared* if the bank has already posted the transaction.

Payee auto-suggests previous payees as you type. Picking a known payee also pre-fills the category from the last time you used that payee.

## Editing in place

Click **Edit** on any row to switch it into edit mode without leaving the page. Press **Enter** to save, **Esc** to cancel.

## Splits

A single transaction can be divided across multiple categories. Click **Split** on a row, list the categories and amounts, and the total updates the parent transaction's amount.

## Transfers

The **Transfer** button creates two paired entries — one negative on the source account, one positive on the destination — linked together. Editing one updates the other.

## Cleared vs reconciled

- **Cleared** (`C` checkbox) means the bank has posted the transaction. You can toggle it on and off freely.
- **Reconciled** is set by the [Reconcile flow](/docs/accounts/reconciliation/) and locks the transaction. Reconciled rows refuse to be edited or deleted until you explicitly unlock them.
