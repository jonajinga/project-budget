---
title: "Transfers"
subtitle: "Moving money between your own accounts without inflating your spending or income."
category: "transactions"
order: 2
---

A [transfer](/glossary/transfer/) is money moving between two accounts you own. Checking to savings. Checking to the credit card to pay the bill. Cash withdrawal from a checking account. None of these are spending or income — they're just dollars relocating within your own balance sheet.

## How to enter one

On [Register](/app/register/), click **Transfer**. Pick:

- **From** — the source account
- **To** — the destination account
- **Amount** — always positive; direction is implied by from/to
- **Date** — when the money actually moved (transfers can have separate post dates on the two ends, but use one date here)
- **Memo** — optional

When you save, Project Budget creates two paired entries:

- Source: -$X
- Destination: +$X

The two are linked. Editing one updates the other. Deleting one deletes both. The category for both sides is *Transfer to/from [account name]* — automatic, not selectable.

## What transfers do to the budget

For two on-budget accounts (checking → savings), nothing changes in [Ready to Assign](/glossary/ready-to-assign/), category Available, or net worth. You moved cash from one envelope-eligible bucket to another. No category is touched.

For on-budget → credit card (paying a card), the source account drops, the card account rises (less debt), and the [Credit Card Payment](/glossary/credit-card-payment-category/) category's Available drops by the payment amount — cash that was earmarked is now spent. See [Credit-card workflow](/docs/accounts/credit-card-workflow/).

For on-budget → tracking (moving cash to a 401k contribution that's a tracking-asset account), the source account drops and the tracking account rises. Ready to Assign drops too, because the cash left an on-budget account. This is the right behavior — you no longer have those dollars to spend.

For tracking → on-budget (moving cash out of a brokerage to checking), the tracking account drops and the on-budget account rises. Ready to Assign rises by the transferred amount.

## What transfers are not

- **Not income.** A transfer doesn't add to RTA unless one end is a tracking account.
- **Not spending.** A transfer doesn't show up on the *Spending by category* report.
- **Not a way to "hide" money.** Reports still walk every transaction, and the [Net worth](/docs/reports/net-worth/) view sums everything.

## Common transfer scenarios

**Paying yourself back from savings.** You used the credit card for an emergency that should come from the emergency fund. Transfer the amount from savings to checking, then make the credit-card payment. Two transfers, both clean.

**Moving cash from one bank to another.** Transfer; both accounts visible in Project Budget.

**Sending money via Venmo / Zelle to a friend.** Not a transfer. That's an outflow to a friend (use a *Gifts* or *Reimbursements* category). The friend is not your account.

**Receiving money via Venmo / Zelle from a friend.** Not a transfer either. That's an inflow categorized to whatever the money was for — if they paid you back for dinner, category it to *Dining out* as a positive (refilling the envelope), not to Ready to Assign.

## Transfers in imports

Most bank exports send the two sides of a transfer as two separate rows in two separate account files. The Project Budget importer doesn't automatically pair them — you'll get two single-sided entries that look like spending and income.

See [Importing transfers](/docs/importing/transfers/) for the cleanup pattern.

## Editing or deleting

Editing one side of a transfer updates the other. The fields that propagate: amount, date, memo. The category doesn't propagate — it's locked on both sides.

Deleting one side prompts to delete both. Picking *Delete just this side* breaks the pair and leaves the other side as an orphan single-sided transaction — usually a mistake. Only do this if you genuinely meant the two sides as independent entries that happened to be the same amount.
