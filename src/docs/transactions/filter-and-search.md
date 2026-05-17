---
title: "Filtering, search, and bulk edits"
subtitle: "Narrow the register down, then change everything that matches in one move."
category: "transactions"
order: 3
---

The [Register](/app/register/) defaults to *all transactions, all accounts, this year*. That's rarely what you want when you're trying to fix something or answer a question. The toolbar at the top is built for narrowing fast.

## The filters

Each filter is independent and they all stack:

- **Account** — one account, an account group, or all.
- **Category** — one category, one category group, *Uncategorized*, or all.
- **Date range** — a preset (*This month*, *Last 3 months*, *Year to date*) or a custom range.
- **Cleared** — *Cleared only*, *Uncleared only*, *Reconciled only*, *Unreconciled only*, or any.
- **Type** — *Inflow*, *Outflow*, *Transfer*, or any.
- **Amount range** — minimum, maximum, or both.

The active filter set is shown as chips above the table. Click a chip's × to clear that filter.

## Search

The search box matches against payee, memo, and split memos. Match is case-insensitive substring; no special syntax.

Useful pattern: search for a payee that you suspect has been miscategorized over time. Searching `whole foods` pulls every visit; scanning the category column reveals the rows you want to fix.

## Saving a filter view

Click **Save view** on the toolbar. Name it something memorable (*Q1 uncategorized*, *Visa over $100*). The view appears in the **Views** dropdown. Views are stored per profile — switching profiles swaps the view list.

Saved views are filter-only — they don't capture sort order or column visibility.

## Bulk edit

Once the register is narrowed, the leftmost column shows a checkbox per row plus a *Select all visible* checkbox in the header. Tick what you want, then use the **Bulk** menu:

- **Recategorize** — pick a category; every selected row's category changes.
- **Re-payee** — assign one payee across the selection. Useful when a bank export gave you ten variants of the same merchant name.
- **Mark cleared** — toggle the C flag on every selected row.
- **Mark uncleared** — same in reverse.
- **Delete** — confirms the count before deleting. Reconciled rows are skipped automatically.

A confirmation modal shows the count, the change, and the impact (*N rows will move from X to Y; this affects the Available in 3 categories*). Cancel is always safe.

## Bulk-categorize by payee — the most common move

After [importing initial data](/docs/getting-started/importing-initial-data/), the fastest way to clean up is:

1. Sort the register by payee.
2. For each common payee, search by name, select all visible, Bulk → Recategorize.
3. Repeat for the 20 most common payees. That's usually 80% of transactions.

Anything left over gets categorized by hand.

## Filtering and reports

Filters live on the register page only. Reports have their own date pickers and account scopes. Saving a register view does not affect any report.

## Performance

The register can hold tens of thousands of transactions per profile without trouble. Filters are evaluated client-side over the in-memory array; the typing-to-results delay should be under 50ms even on a large profile. If it isn't, file an issue — that's a regression.

## Keyboard

See [Keyboard shortcuts](/docs/transactions/keyboard-shortcuts/) for the full list. The register-specific ones:

- **/** focuses the search box.
- **n** starts a new transaction.
- **j / k** move down / up through rows (Vim-style).
- **e** edits the focused row.
- **Esc** clears the focus or closes the editor.
