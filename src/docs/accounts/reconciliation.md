---
title: "Reconciliation"
subtitle: "Match your account to your statement, then lock the matched rows."
category: "accounts"
order: 3
---

## When to reconcile

Once a month, when your bank or card statement arrives. Reconciling is how you catch missed transactions, typos in amounts, and duplicates created by sloppy imports.

## The flow

1. Filter the [Register](/app/register/) to a single account.
2. Click **Reconcile**. Enter the ending balance from the statement.
3. Project Budget shows the cleared balance it knows about and the difference.
4. If the difference is zero, click **Mark cleared as reconciled** and you're done.
5. If the difference is non-zero, you can **add an adjustment and reconcile** — Project Budget inserts a single transaction to close the gap, then locks everything.

## What "reconciled" means

A reconciled transaction is locked. The edit and delete buttons disappear, the row gets a tinted background, and the cleared toggle stops responding. To change one, click **Unlock** to put it back in editable state — you'll need to reconcile the account again afterward.

This protects past months from accidental drift. If your June reconciliation balanced, the June rows won't quietly change next April.
