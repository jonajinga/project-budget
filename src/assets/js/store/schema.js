/* Project Budget profile schema.
   All money is integer cents. All IDs are crypto.randomUUID().
   Bump SCHEMA_VERSION when any shape changes; register a migration in
   MIGRATIONS that walks from N to N+1. */

export const SCHEMA_VERSION = 1;

export function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
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
  };
}

export function newCategoryGroup(name, sortIndex) {
  return { id: newId(), name: name, sortIndex: sortIndex || 0, collapsed: false };
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
