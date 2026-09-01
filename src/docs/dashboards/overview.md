---
title: "Dashboards"
subtitle: "Build the view you want from your own data, and keep as many of them as you need."
category: "dashboards"
order: 1
---

## What a widget is

A widget is three choices:

- **A source** — where the numbers come from. Every report has one, plus the
  thirteen summary cards ("Today's summary", "Alerts", "Account balances", and
  so on).
- **Its options** — the month range, how many rows, how far to look back.
  Whatever that source accepts.
- **A shape** — how it is drawn. Most sources can be a chart, a table, a ranked
  list, or a single big number.

That means the same data can appear twice, asked two different ways. Net worth
over six months beside net worth over two years. Spending as a treemap in one
place and as a table in another. Give them names and they stay tellable apart.

## Building one

Press **Edit**, then **Add widget**. Pick a source, choose a shape, set the
options, and name it if you want. The preview on the right draws with your real
numbers as you go, using exactly the same code the dashboard uses, so what you
see is what you get.

To change a widget later, open **Configure** from its menu. It is the same
form, filled in.

## Arranging

In edit mode each widget has a grip. Drag it to move, or drag the corner to
resize.

Everything works from the keyboard too. Focus a grip and press **Space** to
pick the widget up, then:

- **Arrow keys** move it
- **Shift + arrow keys** resize it
- **Space** drops it
- **Escape** cancels and puts it back

A whole gesture counts as one action, so a single **Undo** puts it back where
it started.

Below 900px every widget goes full width. The order you set is the order you
get on a phone.

## Several dashboards

The strip at the top of the page lists them. The menu beside it creates,
renames, duplicates and deletes.

Deleting is a soft delete — **Undo** brings it straight back — and the last
remaining dashboard cannot be deleted, so you can never end up with none.

## Getting it out

- **Export as PDF** builds a real PDF of the dashboard as it stands, charts
  included. It is a file, not a print dialog.
- **Export layout** saves the *shape* of a dashboard — which widgets, where,
  configured how — and no figures at all. It is safe to send to someone else;
  when they import it, it fills with their own numbers.

**Import layout** reads a file from either of those. Anything it does not
recognise is dropped rather than shown as a blank card.
