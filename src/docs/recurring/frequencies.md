---
title: "Frequencies and cadence"
subtitle: "Every schedule Project Budget understands — and how to build a custom one when the presets don't fit."
category: "recurring"
order: 2
---

When you create a recurring template, the frequency picker offers a set of presets plus a *Custom* builder. This page lists every option and what each one produces.

## Presets

- **Daily.** Surfaces once per calendar day starting on the start date.
- **Weekly.** Surfaces once a week on the same weekday as the start date.
- **Every two weeks.** A 14-day cadence — common for biweekly paydays.
- **Twice a month.** Surfaces on two days per month. Default: the 1st and the 15th. The pair is editable.
- **Monthly.** Surfaces once per month on the same day-of-month as the start date. If the start date is the 31st, see *End-of-month behavior* below.
- **Every two months.** A bi-monthly cadence on the same day-of-month.
- **Quarterly.** Every three months on the same day-of-month.
- **Twice a year.** Surfaces on two days per year. Defaults to the start date and that date +6 months; editable.
- **Yearly.** Once a year on the same month-and-day as the start date.

## Custom cadence

When none of the presets fit, *Custom* opens a builder with four fields:

- **Repeat every** — a number from 1 to 999
- **Unit** — days, weeks, months, or years
- **On** — for months: a day-of-month, or *Last day of the month*, or *Nth weekday of the month* (e.g., *Third Tuesday*)
- **Until** — *No end date* (default), *After N occurrences*, or *On date*

Combinations the custom builder unlocks:

- *Every 10 days* — for short-cycle reminders that don't fit weekly.
- *Every 4 weeks* — distinct from monthly; produces 13 entries per year, not 12.
- *Every 3 months, on the last day* — quarterly invoicing on month-end.
- *Every 1 month, on the second Friday* — payday for some salaried schedules.

## End-of-month behavior

If a template's day-of-month doesn't exist in a given month (the 31st in February, the 30th in February in a non-leap year), Project Budget surfaces the entry on the **last day of that month** instead. The cadence then continues from that month's intended day-of-month — so a 31st-of-month template stays on the 31st whenever the month has one.

This matches how most banks process mortgage and recurring debits.

## Weekend / holiday handling

Project Budget does not shift recurring entries off weekends or US/UK/EU holidays. If you want a paycheck template to post on the Friday before a Monday holiday, set the template to a custom cadence with *Nth weekday* logic, or edit the date when the entry surfaces.

## End-of-life

A template stops surfacing when:

- Its **Until** condition is met (occurrence count or end date).
- You **pause** it from the Recurring page.
- You **delete** it.

Reaching an end date doesn't delete the template — it stays in the list as *Ended*, useful for historical context (the [cashflow projection report](/docs/reports/projection/) knows not to include it past its end date).

## Editing the cadence later

Change frequency at any time from the template's edit modal. The change applies from the **next** due date forward. Already-posted entries stay where they posted; pending entries are repositioned to the new schedule.

If you switch from a tight schedule (daily) to a looser one (weekly), Project Budget asks how to handle queued-up pending entries: *Discard pending* (skip them) or *Keep pending* (let them surface and approve them on the old schedule one last time).
