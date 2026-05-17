---
title: "Export file schema"
subtitle: "What's inside the JSON when you export — and how to read it in a text editor."
category: "profiles-backups"
order: 5
---

The [export](/app/export/) downloads the active profile as a single JSON file. The format is intentionally human-readable: pretty-printed, two-space indent, sensible field names. You can open it in any text editor or pipe it through `jq`.

This page is for users who want to audit the file, build something on top of it, or hand-edit before re-import.

## Top-level shape

```json
{
  "schemaVersion": 7,
  "exportedAt": "2026-05-16T14:22:01.000Z",
  "profile": {
    "id": "p_8f3a...",
    "name": "Household",
    "createdAt": "2024-11-04T...",
    "updatedAt": "2026-05-16T...",
    "settings": { ... },
    "accounts": [ ... ],
    "categoryGroups": [ ... ],
    "categories": [ ... ],
    "payees": [ ... ],
    "transactions": [ ... ],
    "scheduled": [ ... ],
    "goals": [ ... ],
    "budgets": { ... }
  }
}
```

`schemaVersion` is the profile's schema number at the time of export. Re-importing into a newer app version triggers migration if needed.

`exportedAt` is the timestamp of the export, not the timestamp of the most recent change.

## Money

Every amount is stored as **integer cents**. `$42.50` is `4250`. Negatives are outflows: `-4250` means $42.50 out.

This avoids floating-point rounding errors. If you're processing the file in a script, divide by 100 for display.

## Accounts

```json
{
  "id": "a_2c1f...",
  "name": "Chase Checking",
  "type": "checking",
  "groupId": "ag_cash",
  "closedAt": null,
  "openingBalanceCents": 250000,
  "openingDate": "2024-11-04",
  "currency": "USD",
  "noteHtml": null
}
```

`type` is one of: `checking`, `savings`, `cash`, `credit-card`, `tracking-asset`, `tracking-liability`. See [Account types](/docs/accounts/types/).

## Categories

Categories nest under groups:

```json
{
  "id": "cg_immediate",
  "name": "Immediate Obligations",
  "categories": [
    { "id": "c_rent", "name": "Rent", "goalId": "g_rent" },
    { "id": "c_electric", "name": "Electric", "goalId": null }
  ]
}
```

The hidden *Credit Card Payments* group and its per-card categories are present in the export — they have `system: true` and shouldn't be renamed.

## Transactions

```json
{
  "id": "t_5b9d...",
  "accountId": "a_2c1f...",
  "date": "2026-05-12",
  "payee": "Whole Foods",
  "categoryId": "c_groceries",
  "amountCents": -8742,
  "memo": null,
  "cleared": true,
  "reconciled": false,
  "transferOf": null,
  "splits": null,
  "createdAt": "2026-05-12T...",
  "updatedAt": "2026-05-12T..."
}
```

For a transfer, both sides have `transferOf` pointing at the other transaction's id, and `categoryId` is null.

For a split, `categoryId` is null and `splits` is an array:

```json
"splits": [
  { "categoryId": "c_groceries", "amountCents": -5200, "memo": null },
  { "categoryId": "c_household", "amountCents": -2400, "memo": null },
  { "categoryId": "c_gifts",    "amountCents":  -800, "memo": null }
]
```

The split amounts always sum to the parent's `amountCents`.

## Scheduled / recurring

```json
{
  "id": "s_rent",
  "templateAccountId": "a_chase",
  "templatePayee": "Landlord",
  "templateCategoryId": "c_rent",
  "templateAmountCents": -195000,
  "frequency": { "preset": "monthly", "dayOfMonth": 1 },
  "nextDue": "2026-06-01",
  "endsAt": null,
  "paused": false
}
```

For custom cadences, `frequency` has more fields: `every`, `unit`, `until`. See [Frequencies](/docs/recurring/frequencies/).

## Goals

```json
{
  "id": "g_emergency",
  "categoryId": "c_emergency",
  "type": "reach-by-date",
  "targetCents": 1500000,
  "byDate": "2027-01-01"
}
```

`type` is one of `monthly-fixed`, `monthly-topup`, `refill`, `reach-by-date`. See [Goals](/docs/envelope-budget/goals/).

## Budgets

```json
"budgets": {
  "2026-05": {
    "c_rent":      { "assignedCents": 195000 },
    "c_groceries": { "assignedCents":  47500 }
  },
  "2026-04": { ... }
}
```

One map per month, keyed by `YYYY-MM`. Per-category Assigned amounts. Categories that were never assigned in a month are omitted (treated as zero).

## What's *not* in the export

- **Snapshots** — exported separately, one file each.
- **Daily backups** — regenerate on next open, not worth exporting.
- **UI preferences** — theme, sidebar width, dismissed banners.
- **The active-profile pointer** — that's a browser-level setting.

## Hand-editing

You can open the file, make changes, save, and re-import as a new profile (re-import is always non-destructive — it loads into a new profile id, never overwrites an existing one). Useful for bulk-renaming a category across a long history, or for deleting a range of transactions a script can target faster than the UI.

Don't edit field names or change `schemaVersion`. The importer validates the shape and rejects files that don't match.
