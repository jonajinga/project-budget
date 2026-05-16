---
name: Import format request
about: Add support for a new bank or service's export shape
labels: import
---

## Bank / service

<!-- e.g. Wells Fargo, Citi, NatWest, Wise, Revolut. -->

## File type

<!-- CSV, OFX, QFX, QIF, MT940, or other. -->

## Sample (with personal data removed)

<!-- Paste at least 3 rows of the export. Strip account numbers,
     real merchant names, real amounts. Keep the column headers exact. -->

```
```

## What goes wrong today

<!-- Does the current detector pick the wrong shape? Does the import succeed
     but assign the wrong sign to debit/credit? Does the date parse fail? -->

## Notes

<!-- Anything weird about the file: trailing newlines, BOM, locale-specific
     date format, comma vs semicolon delimiter, etc. -->
