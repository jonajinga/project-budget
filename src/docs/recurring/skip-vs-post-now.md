---
title: "Skip, post now, and editing the surfaced entry"
subtitle: "Three actions per pending entry, and what each one does to the schedule."
category: "recurring"
order: 3
---

When a recurring template's due date arrives, the entry shows up in two places: the [Register](/app/register/) (as a *Pending* row with action buttons) and the [Calendar](/app/calendar/) (as a chip on the day). You have three things you can do with it.

## Approve

Click **Approve**. The pending row becomes a regular transaction in the register, dated today by default. The template's next-due date advances by one cycle.

If you want to backdate the approval to the actual transaction date (you paid the rent yesterday but only just got around to approving it), edit the date field on the pending row before clicking Approve. The next-due date still advances by one cycle from the *original* due date, not from the date you backdated to.

## Skip

Click **Skip**. No transaction is created. The template's next-due date advances by one cycle.

Use skip when the real-world transaction didn't happen this period. The gym refunded the month. Payday landed early so the next pending entry is wrong. You took an unpaid week of vacation and the salary didn't hit.

Skipping does **not** delete or pause the template. The next cycle will surface as normal.

## Post now (from the template, before the due date)

From [Recurring](/app/scheduled/), the per-template menu has **Post now**. Use it when the template hasn't yet hit its due date but the transaction has already happened. Surfaces the entry to the register immediately, dated today.

Post now does **not** advance the next-due date — you've fired off an extra entry, not consumed a scheduled one. The next regular due date still arrives on schedule.

## Editing the surfaced entry

The pending row is fully editable before you click Approve. Change:

- **Date** — useful for backdating
- **Amount** — useful when the real charge differed from the template (rent went up $25 mid-lease)
- **Payee** — usually leave as-is
- **Category** — useful when the template's default category is wrong this month
- **Memo** — anytime
- **Split into multiple** — same Split button as any register row

Edits to the pending row affect the posted transaction only. The template itself is unchanged unless you also tick **Update the template too** at the bottom of the modal.

## Advance without surfacing

Three-dots menu on the template → **Advance one cycle**. Bumps the next-due date forward without creating a transaction and without offering an entry to skip. Use when you want to silently reset the schedule.

## When the template's amount drifted

If you find yourself editing the amount on every pending entry to a slightly different value, the template amount is wrong. Open the template, update the amount, save. The next pending entry uses the new amount.

A *Suggest update* indicator appears next to the template after three consecutive entries with the same edited amount — Project Budget noticed the drift and is offering to write the new value back.

## What happens if a template is overdue

If a template's due date has passed and you haven't approved or skipped it, the pending row persists. The next cycle also surfaces when its date arrives — you can end up with two or three pending rows for one template, oldest first.

Approve them in order. Each approval advances the template's next-due by one cycle. Once caught up, the pending area clears.

## Bulk approve

When several templates are pending at once, the pending banner at the top of the register has an **Approve all** button. It approves every pending row using its default values (today's date, template amount). Skip the bulk button if you need to edit any individual row.
