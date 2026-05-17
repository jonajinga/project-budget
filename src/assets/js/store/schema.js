/* Project Budget profile schema.
   All money is integer cents. All IDs are crypto.randomUUID().
   Bump SCHEMA_VERSION when any shape changes; register a migration in
   MIGRATIONS that walks from N to N+1. */

export const SCHEMA_VERSION = 1;

/* Base-62 short IDs — 12 chars give 62^12 ≈ 3.2 × 10^21 possible
   values, plenty of uniqueness for any realistic single-profile
   usage and ~24 chars (66%) shorter than the 36-char UUIDs we used
   to emit. Saves ~100 bytes per transaction at scale. Old UUIDs
   keep working because every consumer treats IDs as opaque strings;
   no migration needed. */
var _ID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
export function newId() {
  var out = "";
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    var buf = new Uint8Array(12);
    crypto.getRandomValues(buf);
    for (var i = 0; i < 12; i++) out += _ID_ALPHABET[buf[i] % 62];
    return out;
  }
  /* Math.random fallback for older environments. */
  for (var j = 0; j < 12; j++) {
    out += _ID_ALPHABET[Math.floor(Math.random() * 62)];
  }
  return out;
}

function nowISO() { return new Date().toISOString(); }

export function newProfile(name) {
  var now = nowISO();
  return {
    id: newId(),
    name: name || "My Budget",
    currencyLabel: "USD",
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    accountGroups: [],
    accounts: [],
    categoryGroups: [],
    categories: [],
    payees: [],
    transactions: [],
    /* Soft-deleted transactions wait in trash with a deletedAt
       timestamp. They're invisible to every consumer (register,
       reports, running balance, etc.) and auto-purge after 30 days.
       Restoring drops the deletedAt and re-inserts into transactions. */
    trash: [],
    scheduled: [],
    budgets: {},
    goals: [],
    settings: {},
  };
}

export function newAccountGroup(name, sortIndex) {
  return { id: newId(), name: name, sortIndex: sortIndex || 0, collapsed: false };
}

export function newAccount(opts) {
  var type = opts.type || "checking";
  var isTracking = type === "tracking-asset" || type === "tracking-liability";
  return {
    id: newId(),
    groupId: opts.groupId || null,
    name: opts.name,
    type: type,
    onBudget: opts.onBudget !== undefined ? opts.onBudget : !isTracking,
    openingBalance: opts.openingBalance || 0,
    closedAt: null,
    sortIndex: opts.sortIndex || 0,
    /* Account is tracked + visible in the sidebar but its balance is
       excluded from netWorth() / trackingAssetTotal() /
       trackingLiabilityTotal(). Use for kids' 529s, escrow accounts,
       employer-held RSUs the user can't liquidate — anything that
       shouldn't roll up into "your" net worth. Defaults false; older
       records without the field are treated as included. */
    excludeFromNetWorth: !!opts.excludeFromNetWorth,
  };
}

export function newCategoryGroup(name, sortIndex) {
  return {
    id: newId(),
    name: name,
    sortIndex: sortIndex || 0,
    collapsed: false,
    /* "expense" | "income". Drives the Outflow/Inflow toggle in the
       transaction form so income categories only show when entering
       an inflow. Default expense; user-facing toggle on the
       categories admin page can flip it. */
    kind: "expense",
  };
}

export function newCategory(opts) {
  return {
    id: newId(),
    groupId: opts.groupId,
    name: opts.name,
    hidden: false,
    sortIndex: opts.sortIndex || 0,
    goalId: opts.goalId || null,
  };
}

export function newPayee(name) {
  return { id: newId(), name: name, lastCategoryId: null, useCount: 0 };
}

export function newTransaction(opts) {
  return {
    id: newId(),
    accountId: opts.accountId,
    date: opts.date || new Date().toISOString().slice(0, 10),
    payeeId: opts.payeeId || null,
    categoryId: opts.categoryId || null,
    amount: opts.amount || 0,
    memo: opts.memo || "",
    cleared: !!opts.cleared,
    reconciled: false,
    transferTxnId: opts.transferTxnId || null,
    splits: opts.splits || null,
    scheduledId: opts.scheduledId || null,
  };
}

export function newScheduledTxn(opts) {
  return {
    id: newId(),
    template: opts.template,
    frequency: opts.frequency || "monthly",
    /* Used only when frequency === "custom". customInterval is the
       integer count, customUnit is "days" | "weeks" | "months" | "years". */
    customInterval: opts.customInterval || null,
    customUnit: opts.customUnit || null,
    nextDate: opts.nextDate,
    lastRun: null,
    /* Paused templates stay in the list but are skipped by the due-
       queue, upcoming-bills helper, and calendar projection until
       toggled active again. Lets users suspend a subscription (gym,
       service on hold) without deleting + re-creating. Older records
       without the field are treated as active. */
    paused: !!opts.paused,
  };
}

export function newBudgetMonth(month) {
  return { month: month, assigned: {}, notes: {} };
}

export function newGoal(opts) {
  return {
    id: newId(),
    categoryId: opts.categoryId,
    type: opts.type || "monthlyFixed",
    target: opts.target || 0,
    byDate: opts.byDate || null,
    cadence: opts.cadence || null,
  };
}

/* Migration runner. Each entry: { from, to, run(profile) }.
   Walks the chain until profile.schemaVersion === SCHEMA_VERSION. */
export const MIGRATIONS = [];

export function migrate(profile) {
  var current = profile.schemaVersion || 1;
  while (current < SCHEMA_VERSION) {
    var step = MIGRATIONS.find(function (m) { return m.from === current; });
    if (!step) break;
    step.run(profile);
    current = step.to;
    profile.schemaVersion = current;
  }
  return profile;
}
