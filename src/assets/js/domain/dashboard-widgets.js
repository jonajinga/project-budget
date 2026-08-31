/* The widget catalogue.
 *
 * Every widget the dashboard can show is declared here once: its type key,
 * the label a person sees in the picker, what it is for, and how big it
 * wants to be. The template renders from this; the store seeds default
 * layouts from this; the picker lists from this. Adding a widget means
 * adding an entry here and a matching markup block in the dashboard
 * template -- there is no third place to remember.
 *
 * SIZING. `w` is columns out of 12, `h` is row units (see --dash-row in
 * dashboard.css). Both are the DEFAULT and the user can change them;
 * `minW`/`minH` are the point below which the widget stops being readable
 * rather than merely small -- a sparkline at 2 columns is a smudge, and a
 * table at 1 row is a header with nothing under it.
 *
 * `chart: true` marks widgets that own a Chart.js canvas. The view uses it
 * to tear charts down before a re-layout and rebuild them after, which is
 * what stops the leak that a naive re-render would cause.
 *
 * `singleton: true` means more than one makes no sense (two "Today's
 * summary" headers is a mistake, two "Top categories" is not).
 */

export const WIDGETS = [
  {
    type: "hero",
    title: "Today's summary",
    description: "Greeting, the month's headline number, and where you stand.",
    w: 12, h: 3, minW: 6, minH: 2,
    singleton: true,
  },
  {
    type: "kpis",
    title: "Key indicators",
    description: "To-assign, overspent, income and expense tiles for the month.",
    w: 12, h: 3, minW: 4, minH: 2,
    singleton: true,
  },
  {
    type: "alerts",
    title: "Alerts",
    description: "Anything needing attention — overspending, overdue, low balances.",
    w: 6, h: 4, minW: 3, minH: 2,
    singleton: true,
  },
  {
    type: "insights",
    title: "Insights",
    description: "Observations about this month compared with your recent history.",
    w: 6, h: 4, minW: 3, minH: 2,
    singleton: true,
  },
  {
    type: "accounts",
    title: "Account balances",
    description: "Every open account grouped, with balances and the total.",
    w: 12, h: 5, minW: 4, minH: 3,
    singleton: true,
  },
  {
    type: "cashflow",
    title: "Cash flow this month",
    description: "Money in against money out, with the pivot between them.",
    w: 12, h: 4, minW: 6, minH: 3,
    singleton: true,
  },
  {
    type: "income-expense",
    title: "Income vs expense",
    description: "Monthly income and expense side by side over time.",
    w: 6, h: 5, minW: 4, minH: 4,
    chart: true,
  },
  {
    type: "top-categories",
    title: "Top categories",
    description: "Where the money went this month, largest first.",
    w: 6, h: 5, minW: 3, minH: 3,
  },
  {
    type: "cashflow-30",
    title: "30-day cash flow",
    description: "Projected balance over the next 30 days.",
    w: 6, h: 5, minW: 4, minH: 4,
    chart: true,
  },
  {
    type: "upcoming-bills",
    title: "Upcoming bills",
    description: "Scheduled transactions due in the next two weeks.",
    w: 6, h: 5, minW: 3, minH: 3,
  },
  {
    type: "goals",
    title: "Goals needing attention",
    description: "Goals that are behind, and what they need to catch up.",
    w: 12, h: 4, minW: 4, minH: 3,
    singleton: true,
  },
  {
    type: "recent",
    title: "Recent transactions",
    description: "The latest activity across every account.",
    w: 6, h: 5, minW: 3, minH: 3,
  },
  {
    type: "quick-actions",
    title: "Quick actions",
    description: "Add a transaction, jump to the budget, import, reconcile.",
    w: 6, h: 4, minW: 3, minH: 2,
    singleton: true,
  },
];

export const GRID_COLUMNS = 12;

var _byType = null;
export function widgetSpec(type) {
  if (!_byType) {
    _byType = Object.create(null);
    for (var i = 0; i < WIDGETS.length; i++) _byType[WIDGETS[i].type] = WIDGETS[i];
  }
  return _byType[type] || null;
}

/* The layout a brand-new dashboard gets, and what "Reset layout" restores.
 * Deliberately the order the hand-built dashboard used, so upgrading an
 * existing profile does not rearrange a screen someone already knows. */
export const DEFAULT_LAYOUT = [
  "hero",
  "kpis",
  "alerts",
  "insights",
  "accounts",
  "cashflow",
  "income-expense",
  "top-categories",
  "cashflow-30",
  "upcoming-bills",
  "goals",
  "recent",
  "quick-actions",
];

/* Clamp a widget to something renderable. Called on every resize and on
 * import, because an imported definition is untrusted input -- a hand-edited
 * or older file can carry w: 40 or h: 0, and a widget spanning 40 columns of
 * a 12-column grid silently breaks the whole row. */
export function clampSize(type, w, h) {
  var spec = widgetSpec(type);
  var minW = spec ? spec.minW || 1 : 1;
  var minH = spec ? spec.minH || 1 : 1;
  var nw = Math.round(Number(w));
  var nh = Math.round(Number(h));
  if (!isFinite(nw) || nw <= 0) nw = spec ? spec.w : 6;
  if (!isFinite(nh) || nh <= 0) nh = spec ? spec.h : 4;
  return {
    w: Math.max(minW, Math.min(GRID_COLUMNS, nw)),
    h: Math.max(minH, Math.min(24, nh)),
  };
}
