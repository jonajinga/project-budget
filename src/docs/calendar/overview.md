---
title: "Calendar overview"
subtitle: "Day, Week, Month, and Year views of what posted and what's coming."
category: "calendar"
order: 1
---

The [Calendar](/app/calendar/) shows your transactions and pending recurring entries on a date grid. It answers two questions the register answers slowly:

1. *Was there an unusually spendy day this month?*
2. *Is anything big about to hit?*

## The four views

### Day

A single day, with every transaction laid out as a list. Sums for *In*, *Out*, and *Net* at the top. Best for reviewing one specific day in detail — useful the morning after a busy day to check what posted.

### Week

Seven columns, one per day. Each column shows the day's transactions stacked as colored chips (green inflow, red outflow). Day totals at the bottom of each column. Best for spotting day-of-week patterns — every Friday a $90 grocery run, every Tuesday a $40 dining bill.

### Month

A standard 5- or 6-row month grid. Each day cell shows a small list of that day's transactions and an inline *In / Out / Net* if you toggle day totals on. The default view most people land on.

### Year

A 12-month overview, one mini-month per panel. Each day cell is smaller; chips collapse to a single dot per transaction. A toggle in the toolbar swaps the day numbers for **net $ per day**, turning the view into a 12-month cashflow heatmap — red for net-outflow days, green for net-inflow days, gray for zero-activity days.

## Multi-span

Day, Week, and Month views all support showing more than one period at once via the span control:

- **Day** — 1, 3, 7, or any custom number of days
- **Week** — 1, 2, 4, or custom
- **Month** — 1, 2, 3, 6, 12, or custom

Useful when reconciling across a period boundary or when you want to compare two consecutive months side-by-side.

## What's on each day

Three layers stack onto each day cell:

1. **Posted transactions** — anything in the [register](/docs/accounts/register-and-entry/) dated that day. Outflows red, inflows green, transfers neutral.
2. **Pending recurring** — any [recurring template](/docs/recurring/overview/) whose next-due date is that day. Shown with a clock icon; clicking opens the approve/skip flow without leaving the calendar.
3. **Day totals** (optional) — *In / Out / Net* sums for the day, toggled by the *Show day totals* switch in the toolbar.

## Navigation

The toolbar provides:

- **← / →** — previous / next period
- **Today** — jump to the period containing today
- **View tabs** — switch Day / Week / Month / Year
- **Span control** — multi-period layout (Day / Week / Month only)
- **Display toggles** — day totals on/off; year-view net-$ on/off

Keyboard equivalents are documented in [Keyboard shortcuts](/docs/transactions/keyboard-shortcuts/).

## Filters

The calendar inherits no filters from the register. To narrow what shows, use the calendar's own account selector — top right. Filtering by category isn't supported on the calendar; it's a chronological view, not a categorical one.

## Clicking a chip

Click a transaction chip to open it in the register's edit modal, in place. Save or cancel returns you to the calendar with the chip updated. Great for quick fix-ups during a monthly review.

## Print

The month view has a print stylesheet that prints the grid landscape, scales chips to fit, and includes day totals. Useful for paper-archive types. Year view prints as one large grid per page.
