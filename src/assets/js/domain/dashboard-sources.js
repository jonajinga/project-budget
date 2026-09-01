/* Where a widget's data comes from.
 *
 * A widget is {source, params, view}: this file declares every SOURCE, and
 * dashboard-views.js declares every way of drawing one. That split is the
 * whole point of the rebuild. The previous dashboard had thirteen hardcoded
 * widget types and two charts nailed to two fixed report calls, in a codebase
 * that already had fourteen parameterised report methods and eleven chart
 * renderers sharing one signature. The combinations were always there; nothing
 * declared them.
 *
 * TWO FAMILIES, ONE SHAPE.
 *
 *   report:*   a method on store/slices/reports.js. Parameterised, memoized,
 *              and safe to place more than once with different params.
 *   panel:*    one of the thirteen bespoke cards. Its markup is hand-written
 *              because a KPI strip or an alert list is not a table and would
 *              be worse as one.
 *
 * Panels are NOT a second class of widget. They are sources whose only valid
 * view happens to be their own markup. Everything downstream -- the grid, the
 * settings dialog, export, import, PDF -- sees one record shape, so there is
 * one place to add a feature and one place to forget _bumpLists().
 *
 * FIELDS ARE COPIED FROM THE JSDoc in domain/reports.js, which documents every
 * return shape exactly. They drive the generic table, list and stat views, so
 * those need no per-source code at all -- which is why fourteen sources times
 * four views costs a handful of files rather than fifty.
 *
 * `args` is ORDERED and maps onto the method's positional arguments. Params
 * feed data and therefore the memo key; view settings never do. Keeping them
 * apart is what makes "same source, two date ranges, side by side" correct for
 * free rather than a cache bug.
 */

var money = true;

/* Reused param declarations. Defaults are null where the store method already
   falls back to the current month, so a widget follows the app rather than
   pinning itself to whenever it was created. */
function pEndMonth() {
  return { key: "endMonth", type: "month", label: "Through month", default: null,
           hint: "Leave empty to follow the current month." };
}
function pCount(def, max) {
  return { key: "count", type: "int", label: "Months", default: def, min: 2, max: max || 36 };
}
function pTopN(def) {
  return { key: "topN", type: "int", label: "How many", default: def, min: 3, max: 40 };
}
function pFromMonth() {
  /* resolveBack turns "no choice made" into a WINDOW rather than a single
     month. reportSpending treats a null from as "same as to", so a widget
     added with defaults asked for one month and usually rendered "No spending
     in this range." -- which reads as a broken widget, not as an empty range.
     Six months is what the equivalent report pages open on. */
  return { key: "fromMonth", type: "month", label: "From month", default: null, resolveBack: 5 };
}
function pToMonth() {
  return { key: "toMonth", type: "month", label: "To month", default: null,
           hint: "Leave empty to follow the current month." };
}

export const SOURCES = [
  /* ---- reports ---------------------------------------------------------- */
  {
    id: "report:income-expense",
    family: "reports",
    title: "Income vs expense",
    description: "Money in against money out, month by month.",
    method: "reportIncomeVsExpense",
    args: ["endMonth", "count"],
    params: [pEndMonth(), pCount(6)],
    shape: "series",
    fields: [
      { key: "month", label: "Month" },
      { key: "income", label: "Income", numeric: true, money: money },
      { key: "expense", label: "Expense", numeric: true, money: money },
      { key: "net", label: "Net", numeric: true, money: money },
    ],
    views: ["chart:income-expense", "table", "stat"],
    defaultView: "chart:income-expense",
  },
  {
    id: "report:net-worth",
    family: "reports",
    title: "Net worth",
    description: "Everything you own minus everything you owe, over time.",
    method: "reportNetWorth",
    args: ["endMonth", "count"],
    params: [pEndMonth(), pCount(12)],
    shape: "series",
    fields: [
      { key: "month", label: "Month" },
      { key: "value", label: "Net worth", numeric: true, money: money },
    ],
    views: ["chart:net-worth", "table", "stat"],
    defaultView: "chart:net-worth",
  },
  {
    id: "report:spending",
    family: "reports",
    title: "Spending by category",
    description: "Where the money went over a range of months.",
    method: "reportSpending",
    args: ["fromMonth", "toMonth"],
    params: [pFromMonth(), pToMonth()],
    shape: "rows",
    fields: [
      { key: "category", label: "Category" },
      { key: "group", label: "Group" },
      { key: "value", label: "Spent", numeric: true, money: money },
    ],
    views: ["chart:spending-category", "table", "list", "stat"],
    defaultView: "chart:spending-category",
    needs: ["d3"],
  },
  {
    id: "report:trends",
    family: "reports",
    title: "Category trends",
    description: "How each category has moved month to month.",
    method: "reportTrends",
    args: ["endMonth", "count", "topN"],
    params: [pEndMonth(), pCount(12), pTopN(12)],
    shape: "series",
    fields: [
      { key: "category", label: "Category" },
      { key: "group", label: "Group" },
      { key: "total", label: "Total", numeric: true, money: money },
    ],
    views: ["chart:monthly-trends", "table", "list"],
    defaultView: "chart:monthly-trends",
  },
  {
    id: "report:debt",
    family: "reports",
    title: "Debt overview",
    description: "Balances, typical payments, and months to payoff.",
    method: "reportDebt",
    args: [],
    params: [],
    shape: "rows",
    fields: [
      { key: "account", label: "Account" },
      { key: "balance", label: "Balance", numeric: true, money: money },
      { key: "avgPayment", label: "Avg payment", numeric: true, money: money },
      { key: "monthsToPayoff", label: "Months left", numeric: true },
    ],
    views: ["chart:debt", "table", "list", "stat"],
    defaultView: "chart:debt",
  },
  {
    id: "report:assignment-history",
    family: "reports",
    title: "Assigned vs spent",
    description: "What you budgeted against what you actually spent.",
    method: "reportAssignmentHistory",
    args: ["endMonth", "count", "topN"],
    params: [pEndMonth(), pCount(12), pTopN(8)],
    shape: "series",
    fields: [
      { key: "category", label: "Category" },
      { key: "group", label: "Group" },
    ],
    views: ["chart:assignment-history", "table"],
    defaultView: "chart:assignment-history",
  },
  {
    id: "report:projection",
    family: "reports",
    title: "Balance projection",
    description: "Where your balance is heading, with a low and high band.",
    method: "reportProjection",
    args: ["count"],
    params: [pCount(12, 24)],
    shape: "series",
    fields: [
      { key: "month", label: "Month" },
      { key: "expected", label: "Expected", numeric: true, money: money },
      { key: "low", label: "Low", numeric: true, money: money },
      { key: "high", label: "High", numeric: true, money: money },
    ],
    views: ["chart:projection", "table", "stat"],
    defaultView: "chart:projection",
  },
  {
    id: "report:savings-rate",
    family: "reports",
    title: "Savings rate",
    description: "What share of income you kept, month by month.",
    method: "reportSavingsRate",
    args: ["endMonth", "count"],
    params: [pEndMonth(), pCount(12)],
    shape: "series",
    fields: [
      { key: "month", label: "Month" },
      { key: "savings", label: "Saved", numeric: true, money: money },
      { key: "rate", label: "Rate", numeric: true, percent: true },
    ],
    views: ["table", "stat"],
    defaultView: "stat",
  },
  {
    id: "report:payees",
    family: "reports",
    title: "Top payees",
    description: "Who you paid most, and how often.",
    method: "reportPayeeLeaderboard",
    args: ["fromMonth", "toMonth", "limit"],
    params: [pFromMonth(), pToMonth(),
             { key: "limit", type: "int", label: "How many", default: 10, min: 3, max: 50 }],
    shape: "rows",
    fields: [
      { key: "payee", label: "Payee" },
      { key: "total", label: "Total", numeric: true, money: money },
      { key: "count", label: "Times", numeric: true },
      { key: "avg", label: "Average", numeric: true, money: money },
    ],
    views: ["table", "list", "stat"],
    defaultView: "list",
  },
  {
    id: "report:budget-vs-actual",
    family: "reports",
    title: "Budget vs actual",
    description: "Assigned against spent for one month, by category.",
    method: "reportBudgetVsActual",
    args: ["month"],
    params: [{ key: "month", type: "month", label: "Month", default: null,
               hint: "Leave empty to follow the current month." }],
    shape: "rows",
    fields: [
      { key: "category", label: "Category" },
      { key: "assigned", label: "Assigned", numeric: true, money: money },
      { key: "spent", label: "Spent", numeric: true, money: money },
      { key: "remaining", label: "Remaining", numeric: true, money: money },
    ],
    views: ["table", "list"],
    defaultView: "table",
  },
  {
    id: "report:sankey",
    family: "reports",
    title: "Money flow",
    description: "Income flowing through to where it ended up.",
    method: "reportSankey",
    args: ["fromMonth", "toMonth"],
    params: [pFromMonth(), pToMonth()],
    shape: "graph",
    fields: [],
    views: ["chart:sankey"],
    defaultView: "chart:sankey",
    needs: ["d3", "d3-sankey"],
  },
  {
    id: "report:heatmap",
    family: "reports",
    title: "Spending heatmap",
    description: "Categories down, months across, intensity by amount.",
    method: "reportHeatmap",
    args: ["endMonth", "count", "topN"],
    params: [pEndMonth(), pCount(12), pTopN(15)],
    shape: "matrix",
    fields: [],
    views: ["chart:heatmap"],
    defaultView: "chart:heatmap",
    needs: ["d3"],
  },
  {
    id: "report:year-over-year",
    family: "reports",
    title: "Year over year",
    description: "This period against the same period last year.",
    method: "reportYearOverYear",
    args: ["currentRange", "priorRange"],
    params: [
      { key: "currentRange", type: "range", label: "This period", default: null },
      { key: "priorRange", type: "range", label: "Compared with", default: null },
    ],
    shape: "object",
    fields: [],
    views: ["chart:yoy"],
    defaultView: "chart:yoy",
  },
  {
    id: "report:subscriptions",
    family: "reports",
    title: "Subscriptions",
    description: "Recurring charges it found, and what they cost a year.",
    method: "reportSubscriptions",
    args: ["lookbackMonths"],
    params: [{ key: "lookbackMonths", type: "int", label: "Look back (months)",
               default: 12, min: 3, max: 36 }],
    shape: "rows",
    fields: [
      { key: "payee", label: "Payee" },
      { key: "typicalAmount", label: "Typical", numeric: true, money: money },
      { key: "cadence", label: "Cadence" },
      { key: "annualCost", label: "Per year", numeric: true, money: money },
    ],
    views: ["table", "list", "stat"],
    defaultView: "table",
  },
];

/* ---- panels -------------------------------------------------------------
   The thirteen bespoke cards. Each keeps its own markup as its only view, and
   gains the parameters its underlying store method already accepted -- which
   is how they become configurable for the first time without a line of new
   store code. `legacyType` is what a v1 record called it, and is what the
   upgrade in dashboard-widgets.js matches on. */
var PANELS = [
  { legacyType: "hero", title: "Today's summary", w: 12, h: 3, minW: 6, minH: 2, singleton: true,
    description: "Greeting, the month's headline number, and where you stand." },
  { legacyType: "kpis", title: "Key indicators", w: 12, h: 3, minW: 4, minH: 2, singleton: true,
    description: "To-assign, overspent, income and expense tiles." },
  { legacyType: "alerts", title: "Alerts", w: 6, h: 4, minW: 3, minH: 2, singleton: true,
    description: "Anything needing attention right now." },
  { legacyType: "insights", title: "Insights", w: 6, h: 4, minW: 3, minH: 2, singleton: true,
    description: "Observations about this month against your history." },
  { legacyType: "accounts", title: "Account balances", w: 12, h: 5, minW: 4, minH: 3, singleton: true,
    description: "Every open account grouped, with the total." },
  { legacyType: "cashflow", title: "Cash flow this month", w: 12, h: 4, minW: 6, minH: 3, singleton: true,
    description: "Money in against money out, with the pivot between." },
  { legacyType: "income-expense", title: "Income vs expense (mini)", w: 6, h: 5, minW: 4, minH: 4,
    chart: true, description: "The compact sparkline version." },
  { legacyType: "top-categories", title: "Top categories", w: 6, h: 5, minW: 3, minH: 3,
    description: "Where the money went this month.",
    params: [{ key: "limit", type: "int", label: "How many", default: 8, min: 3, max: 20 }] },
  { legacyType: "cashflow-30", title: "30-day cash flow", w: 6, h: 5, minW: 4, minH: 4,
    chart: true, description: "Projected balance over the next 30 days." },
  { legacyType: "upcoming-bills", title: "Upcoming bills", w: 6, h: 5, minW: 3, minH: 3,
    description: "Scheduled transactions coming up.",
    params: [{ key: "days", type: "int", label: "Days ahead", default: 14, min: 3, max: 90 }] },
  { legacyType: "goals", title: "Goals needing attention", w: 12, h: 4, minW: 4, minH: 3, singleton: true,
    description: "Goals that are behind, and what they need.",
    params: [{ key: "limit", type: "int", label: "How many", default: 6, min: 2, max: 20 }] },
  { legacyType: "recent", title: "Recent transactions", w: 6, h: 5, minW: 3, minH: 3,
    description: "The latest activity across every account.",
    params: [{ key: "limit", type: "int", label: "How many", default: 8, min: 3, max: 30 }] },
  { legacyType: "quick-actions", title: "Quick actions", w: 6, h: 4, minW: 3, minH: 2, singleton: true,
    description: "Add a transaction, jump to the budget, import, reconcile." },
];

PANELS.forEach(function (p) {
  SOURCES.push({
    id: "panel:" + p.legacyType,
    family: "panels",
    legacyType: p.legacyType,
    title: p.title,
    description: p.description,
    method: null, /* panels read the store directly from their own markup */
    args: [],
    params: p.params || [],
    shape: "panel:" + p.legacyType,
    fields: [],
    views: ["panel:" + p.legacyType],
    defaultView: "panel:" + p.legacyType,
    singleton: !!p.singleton,
    chart: !!p.chart,
    w: p.w, h: p.h, minW: p.minW, minH: p.minH,
  });
});

var _byId = null;
export function sourceSpec(id) {
  if (!_byId) {
    _byId = Object.create(null);
    for (var i = 0; i < SOURCES.length; i++) _byId[SOURCES[i].id] = SOURCES[i];
  }
  return _byId[id] || null;
}

/* v1 stored a bare `type`; v2 stores a source id. */
export function sourceIdForLegacyType(type) {
  return sourceSpec("panel:" + type) ? "panel:" + type : null;
}

export const DEFAULT_LAYOUT = [
  "panel:hero", "panel:kpis", "panel:alerts", "panel:insights", "panel:accounts",
  "panel:cashflow", "panel:income-expense", "panel:top-categories",
  "panel:cashflow-30", "panel:upcoming-bills", "panel:goals", "panel:recent",
  "panel:quick-actions",
];
