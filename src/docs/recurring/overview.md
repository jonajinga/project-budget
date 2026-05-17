---
title: "Recurring overview"
subtitle: "Templates that queue on a schedule. They never post automatically — you approve every entry."
category: "recurring"
order: 1
---

[Recurring](/app/scheduled/) is where you keep templates for transactions that repeat — rent on the first, the gym on the third, payday every other Friday. Project Budget never posts a template behind your back. When a due date arrives, the entry surfaces in the [register](/app/register/) for you to approve, skip, or edit.

## Why no auto-post

Two reasons:

1. **The real-world transaction sometimes doesn't happen.** The gym refunded. The autopay failed. The amount was different this month.
2. **Auto-posted entries silently drift your budget out of sync with your bank.** A template that posts a $42 amount when the actual charge was $46 leaves a phantom $4 discrepancy for the next reconciliation to find.

You stay in the loop on every entry. The template is a reminder and a pre-fill, not an oracle.

## What a template stores

Each template has:

- **Payee** — the merchant or counterparty
- **Account** — where the transaction will land
- **Category** — what envelope it pulls from (or *Ready to Assign* for income)
- **Amount** — negative for outflows, positive for inflows
- **Memo** — optional, pre-filled on every posting
- **Frequency** — how often it recurs (see [Frequencies and cadence](/docs/recurring/frequencies/))
- **Next due** — the next date the template will surface

## Summary tiles

The Recurring page header shows four counters:

- **Active templates** — total count
- **Monthly inflow** — sum of inflow templates normalized to monthly
- **Monthly outflow** — same for outflows
- **Net monthly** — inflow minus outflow

Clicking a tile filters the list. *Monthly outflow* is the quick-cap on your recurring commitments — useful when deciding whether a new subscription fits.

## Where templates surface

Three places:

1. **Register**, when the due date hits or passes. A *Pending* banner appears at the top of the register with an *Approve* and *Skip* button per entry.
2. **Calendar**, on the due date. Upcoming recurring entries show as a colored chip on the day, so you can scan the next 30 days at a glance. See [Calendar overview](/docs/calendar/overview/).
3. **Cashflow projection report**, as projected outflows / inflows for the next 3, 6, or 12 months. See [Cashflow projection](/docs/reports/projection/).

## Inactive vs deleted

A template can be **paused** (still in the list but won't surface) or **deleted** (removed entirely). Pause when a subscription is on hold and might come back; delete when it's gone for good. Pausing keeps the history of when the template last fired, which the cashflow projection still uses.

## Importing templates

There's no import format for recurring templates. They're entered by hand on the Recurring page. If you're migrating from another budgeting app, expect to spend 5–15 minutes recreating your recurring list — usually 10–30 templates for a household.

## Next

See [Frequencies and cadence](/docs/recurring/frequencies/) for how to set the schedule, and [Skip vs post-now](/docs/recurring/skip-vs-post-now/) for what to do when a due date arrives.
