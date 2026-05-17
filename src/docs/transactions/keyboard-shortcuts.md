---
title: "Keyboard shortcuts and the calculator field"
subtitle: "Move through the app without taking your hands off the keyboard."
category: "transactions"
order: 4
---

Project Budget aims to be fully usable from the keyboard. The shortcuts are grouped by what page they apply on. Most modifier keys are platform-native — Cmd on macOS, Ctrl on Windows / Linux — and the docs write `Mod` to mean *whichever your platform uses*.

## Global

| Shortcut | Action                          |
|----------|----------------------------------|
| `Mod + K` | Open the command palette       |
| `g` then `d` | Jump to Dashboard           |
| `g` then `b` | Jump to Budget              |
| `g` then `r` | Jump to Register            |
| `g` then `a` | Jump to Accounts            |
| `g` then `c` | Jump to Categories          |
| `g` then `s` | Jump to Scheduled / Recurring |
| `g` then `p` | Jump to Reports             |
| `?` | Show the keyboard cheat sheet       |
| `Esc` | Close the topmost modal / drawer  |

The `g` prefix is a two-key chord — press `g`, release, then the second key within one second. Cancel by pressing anything else.

## Register

| Shortcut | Action                                       |
|----------|-----------------------------------------------|
| `n` | New transaction (focuses the entry form)         |
| `/` | Focus the search box                             |
| `j` / `k` | Move down / up one row                     |
| `e` | Edit the focused row                             |
| `Enter` | Save the row currently in edit mode          |
| `Esc` | Cancel edit or clear focus                     |
| `c` | Toggle cleared on the focused row                |
| `s` | Split the focused row                            |
| `Delete` | Delete the focused row (asks for confirmation) |
| `Mod + A` | Select all visible (for bulk edit)         |

## Budget

| Shortcut | Action                                       |
|----------|-----------------------------------------------|
| `j` / `k` | Move down / up one category row             |
| `h` / `l` | Previous / next month                       |
| `Enter` | Edit the focused Assigned cell               |
| `m` | Open *Move money…* on the focused row             |
| `Mod + Enter` | Apply Auto-assign with the last-used strategy |
| `t` | Jump to *This month*                             |

## Calendar

| Shortcut | Action                                       |
|----------|-----------------------------------------------|
| `1` / `2` / `3` / `4` | Day / Week / Month / Year view      |
| `h` / `l` | Previous / next period                      |
| `t` | Jump to today                                    |

## The calculator field

Every amount input in Project Budget is a calculator. You can type:

- A number: `42.50`
- An expression: `42.50 + 18 + 7.25`
- A division for "split the bill four ways": `89.40 / 4`
- A discount: `120 * 0.85`
- Parentheses: `(45 + 22) * 1.0875`

Press `Tab` or `Enter` to evaluate. The field replaces the expression with the result. Press `Esc` while editing to abandon the calculation.

Supported operators: `+`, `-`, `*`, `/`, `%`, parentheses. No variables, no functions. Negative numbers work: `-42.50` is a valid outflow amount.

### Common patterns

- **Adding tax to a pre-tax estimate.** `78.00 * 1.0875` for 8.75% sales tax.
- **Subtracting a coupon.** `42.99 - 5`
- **Splitting a tip.** `60 * 0.20`
- **Adding receipt lines.** `12.99 + 4.50 + 8.75 + 1.50`
- **Quick currency conversion.** `100 * 1.34` if you know the rate.

The calculator runs locally; nothing leaves your browser to evaluate it.

## What's not bound (yet)

- Per-report navigation. Use the sidebar or the URL.
- Pagefind search from inside the app — currently only on the marketing site.

If a shortcut you'd expect to exist doesn't, the cheat sheet (`?`) is the authoritative list.
