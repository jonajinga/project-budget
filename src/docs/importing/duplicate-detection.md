---
title: "Duplicate detection"
subtitle: "How the importer decides whether a row is a re-import of something you already have."
category: "importing"
order: 3
---

Re-importing the same file is safe. Importing two overlapping files from the same bank is safe. The duplicate detector decides which rows in the incoming file already exist in the active profile and skips them on commit.

## The dedupe key

For every incoming row, the importer constructs a key:

```
account_id + date + amount + payee
```

Plus, when present, a bank-provided unique id:

- `FITID` (OFX / QFX)
- `transactionId` (GoCardless)
- `id` (some CSV exports)

If the bank id is present, the dedupe is **exact** — same id means same transaction. If only the four-field key is available, the dedupe is **fuzzy** in two ways:

- Payee match strips whitespace and lowercases. *AMAZON.COM* and *amazon.com* match.
- Date match accepts a ±1 day window when the bank-id is absent. Banks sometimes post a transaction on a different calendar day in the export than in the previous export; the window absorbs this.

## The preview

The preview table flags each row:

- **New** (green check) — will be imported.
- **Duplicate of existing** (gray icon) — will be skipped. Hover shows the existing transaction it matched.
- **Possible duplicate** (amber) — the four-field key matches but the bank id is different (or absent on one side). Asks for a manual decision.

The footer shows totals: *N new, M duplicates, K possible duplicates*. You can flip *Possible duplicates* to *Import* or *Skip* in bulk from the toolbar.

## When the detector misses

The detector can miss duplicates in two situations:

### Two banks for the same transaction

A Venmo transfer from a friend lands in your checking account *and* in your Venmo balance. If you import both, both look like real transactions to the detector because they're in different accounts. The dedupe key includes `account_id`, so cross-account matches aren't considered. The right fix: enter the Venmo side as a [transfer](/docs/transactions/transfers/), not a separate transaction.

### Amount mismatch

A foreign-currency transaction sometimes posts at a different USD amount the second time the bank reports it (the conversion rate changed by the time the post settled). The dedupe key includes amount, so a one-cent difference can sneak past.

After import, the [register](/docs/accounts/register-and-entry/)'s search-by-date plus account filter is the quickest way to find these. Two transactions on the same day, same payee, slightly different amounts — one is a duplicate.

## When the detector over-skips

A real second transaction to the same payee for the same amount on the same day is rare but possible. The detector treats it as a duplicate and skips it. Two ways to recover:

- Before import, switch the flagged row from *Duplicate of existing* to *Import anyway* in the preview.
- After import, enter the missing row manually on the [register](/docs/accounts/register-and-entry/).

This is most common with high-frequency, small-amount payees (vending machine, parking meter) or with very precise round-number bills.

## Re-importing the same file

Safe. Every row that matches the dedupe key is skipped. The footer shows the count of skipped rows so you can confirm. The active profile is unchanged.

## Importing into the wrong account

Less safe. If you accidentally import Visa transactions into the Mastercard account, the dedupe key includes `account_id`, so re-importing later into the correct account will *not* recognize them as duplicates — they'll come in again. The cleanup: filter the [register](/docs/accounts/register-and-entry/) to the wrong account and the date range, bulk-delete the rows, then re-import to the correct account.

## What does **not** dedupe

- **Transactions you entered by hand** before importing the bank's version. These have no bank id and likely don't match the bank's payee string exactly. The detector flags them as *Possible duplicates*; you choose.
- **Splits.** A split parent dedupes against another split parent only if the totals match; the split lines themselves are not part of the key.
- **Transfers.** A transfer pair imports as two single-sided entries unless you manually re-pair them. See [Importing transfers](/docs/importing/transfers/).
