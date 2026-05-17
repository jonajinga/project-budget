---
title: "Projection window and the next 30 days"
subtitle: "How the calendar previews money that hasn't moved yet — and where the lines get fuzzy."
category: "calendar"
order: 2
---

The [Calendar](/app/calendar/) doesn't only show what happened. It also shows what's queued — every pending [recurring template](/docs/recurring/overview/) for the next several months. This is the projection window.

## What's included

The forward-looking layer of the calendar is built from:

- **Pending recurring entries** — every template with a next-due date in the visible range.
- **Future-dated manual transactions** — any transaction you've entered in the register with a date that hasn't arrived yet.
- **Approved-but-future-dated entries** — entries you approved from a template but backdated or forwarded; same treatment.

It does **not** include:

- Goal funding (goals don't produce transactions on their own).
- Bank-side authorized-but-not-posted holds. Project Budget doesn't see those.
- One-off expectations you have but haven't entered yet (you remembered the dentist is coming but you didn't add it to recurring).

## How far ahead it looks

The default visible range depends on the view:

- **Day**: 1 day forward by default; up to your custom day-span.
- **Week**: the current week and any future weeks within the span.
- **Month**: the current month plus future months within the span — up to 12.
- **Year**: the full 12-month grid (some of which is past, some future).

For longer projections, see the [Cashflow projection report](/docs/reports/projection/) — that one runs 3, 6, or 12 months from today's balances forward.

## Visual distinction

Pending entries look different from posted transactions:

- Slightly muted color
- A clock icon in the chip's corner
- A "Pending" tag in the hover tooltip
- Sortable separately from posted entries within a day cell (pending appears below posted by default)

This is intentional — you should never confuse "did happen" with "scheduled to happen."

## Approving from the calendar

Clicking a pending chip opens a popover with the entry's details plus three buttons: **Approve**, **Skip**, **Edit & approve**. See [Skip vs post now](/docs/recurring/skip-vs-post-now/) for what each does. After approving, the chip changes from muted to solid color in place — no page reload, no lost scroll position.

## Where projection accuracy breaks down

Two situations to watch for:

### Variable-amount recurring

If a template's amount is "$200 but really anywhere from $180 to $230," the calendar's projection treats it as exactly $200. Days when the actual charge will be higher get under-projected; days when it'll be lower get over-projected. The week-total and month-total numbers absorb this in the noise.

### Income on a sliding schedule

Salaries paid on "the 15th or the nearest weekday before" are tricky for fixed-cadence templates. The closest custom-cadence option is *monthly on the 15th*, which puts the entry on the 15th every month and gets the day wrong when the 15th is a weekend. Edit the surfaced entry's date when this happens — see [Skip vs post now](/docs/recurring/skip-vs-post-now/).

## Using projection as a planning tool

Two practical patterns:

**The pre-payday scan.** A day before your paycheck arrives, switch to a 7-day or 14-day forward calendar view. See every scheduled outflow before the next paycheck lands. Adjust assignments on the [Budget](/app/budget/) page if a big outflow needs covering you hadn't budgeted for.

**The annual-bill check.** Switch to Year view, toggle *Show net $ instead of dates*, scan for the deepest-red days of the next twelve months. Those are the days your savings categories need to be funded by. Cross-reference with [Goals](/docs/envelope-budget/goals/) to make sure each annual bill has a *Reach a target by a date* goal pointing at it.
