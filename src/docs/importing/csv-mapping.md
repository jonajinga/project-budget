---
title: "CSV column mapping"
subtitle: "When auto-detect doesn't recognize your bank, map the columns by hand."
category: "importing"
order: 2
---

Project Budget recognizes [a handful of common CSV shapes](/docs/importing/formats/) automatically — Chase, Capital One, Discover, Mint, Actual Budget, and a generic fallback. When yours doesn't match any, the import preview shows a *Map columns* panel and asks you to point at each required field.

## The required fields

Three fields are mandatory:

- **Date** — when the transaction posted. The mapper accepts any column whose values parse as ISO-8601, US `MM/DD/YYYY`, or European `DD/MM/YYYY`. If the column is ambiguous (numbers like `01/02/2026` could be Jan 2 or Feb 1), the picker asks which format your bank uses and remembers the choice for next time.
- **Payee / description** — the merchant or counterparty. Often the rawest field in a bank export; you'll clean it up later via bulk edit. See [Filtering and bulk edits](/docs/transactions/filter-and-search/).
- **Amount** — either one signed column (`-42.50` for outflows, `100.00` for inflows) or two columns (one for debits, one for credits). The picker auto-detects which shape your file uses.

Two fields are optional:

- **Memo / notes** — separate from payee. Useful for the long-form description some banks include.
- **Category** — the bank's category guess. Project Budget can drop it (most users do) or import it into a *Bank category* field that's visible in the register but separate from your envelope categories.

## When the date column is ambiguous

A column with values like `03/04/2026` is ambiguous. The picker offers three resolutions:

1. **Treat as US (MM/DD).** March 4.
2. **Treat as European (DD/MM).** April 3.
3. **Read another column.** If your CSV also has an ISO-format date column, point at that one instead and ignore the ambiguous one.

The choice is per-bank, stored under the saved mapping (see below).

## When amount is two columns

Some banks (Capital One is the textbook case) split amounts into *Debit* and *Credit* columns: outflow rows have a value in *Debit* and blank in *Credit*; inflow rows are the reverse. Pick both fields in the mapper; Project Budget combines them into a single signed amount internally.

## Saving a mapping

Once you've mapped the columns and run a successful import, the preview footer offers **Save as preset**. Name it after your bank (*Ally Checking*, *Schwab Brokerage*) and it appears in the format dropdown next time. Saved presets are per-profile.

## Reusing a saved mapping

On future imports, when you drop the same shape of CSV, the auto-detector matches your saved preset first. The preview opens with columns already mapped; just confirm and import.

## What the mapper does **not** do

- **Will not transform values.** If your bank exports amounts as `(42.50)` for negatives (accountant style with parentheses), the importer doesn't parse those. Open the file in a spreadsheet first and convert to `-42.50`.
- **Will not merge columns.** If payee and memo are in separate columns and you want them concatenated, do that in a spreadsheet first or accept them as separate fields.
- **Will not parse multi-line records.** Each transaction must be one CSV row.
- **Will not handle macro-flavored CSVs.** Some Quicken exports include header rows that span multiple lines; strip those manually.

## A common gotcha: BOMs and quoting

Files saved from Windows tools sometimes start with a UTF-8 byte-order-mark (the invisible `﻿` character). The importer strips it on read, but if you opened the file in a text editor and the first column name looks like `﻿Date`, that's the BOM.

Quoted fields with internal commas (typical of memo fields containing "Last, first" names) parse correctly as long as the CSV is RFC-4180-compliant. Files that quote inconsistently — some rows quoted, some not — sometimes parse with extra columns; check the preview and reject the import if the column count looks off.
