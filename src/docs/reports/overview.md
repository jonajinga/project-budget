---
title: "Reports overview"
subtitle: "The seven built-in reports and what each one is good for."
category: "reports"
order: 1
---

## The reports

- **[Income vs expense](/app/reports/income-expense/)** — paired bars per month. Quick sanity check that you're spending less than you earn.
- **[Net worth over time](/app/reports/net-worth/)** — line chart of every account's month-end balance summed. The single most useful long-horizon number.
- **[Spending by category](/app/reports/spending/)** — treemap of where your money actually went. Pick the window.
- **[Monthly trends](/app/reports/trends/)** — small sparklines for the top 12 categories. Spot creeping growth.
- **[Debt overview](/app/reports/debt/)** — balances on every credit card and tracking liability with payoff projections.
- **[Assignment history](/app/reports/assignment-history/)** — what you assigned vs what you spent, per category, over the year.
- **[Cashflow projection](/app/reports/projection/)** — forward 3, 6, or 12 months from current balances + scheduled transactions + goal funding.

## How charts react

Every chart reads directly from the active profile. Edit a transaction in the register and the chart updates the next time you view it. Switching the theme recolors the charts immediately — colors come from CSS custom properties, not hard-coded values.

## Print

Every report has a print stylesheet that hides the chrome, scales the chart to fit the page, and prints the companion data table next to it. Print preview before you print.
