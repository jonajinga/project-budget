/* Pure derivations over the active profile.
   All inputs are arrays; nothing here mutates. */

/**
 * All transactions belonging to an account.
 * @param {Profile} profile
 * @param {string} accountId
 * @returns {Array<object>}
 */
export function transactionsFor(profile, accountId) {
  return profile.transactions.filter(function (t) { return t.accountId === accountId; });
}

/* Running balance = opening + sum of all transaction amounts. Amounts are
   signed cents (outflow negative, inflow positive). */
/**
 * Opening balance plus every transaction amount (signed cents).
 * @param {Profile} profile
 * @param {string} accountId
 * @returns {number} balance in cents
 */
export function runningBalance(profile, accountId) {
  var acct = findAccount(profile, accountId);
  if (!acct) return 0;
  var sum = acct.openingBalance || 0;
  profile.transactions.forEach(function (t) {
    if (t.accountId === accountId) sum += (t.amount || 0);
  });
  return sum;
}

/* Cleared balance = opening + sum of cleared (or reconciled) transactions only. */
/**
 * Opening balance plus only cleared/reconciled transaction amounts.
 * @param {Profile} profile
 * @param {string} accountId
 * @returns {number} balance in cents
 */
export function clearedBalance(profile, accountId) {
  var acct = findAccount(profile, accountId);
  if (!acct) return 0;
  var sum = acct.openingBalance || 0;
  profile.transactions.forEach(function (t) {
    if (t.accountId !== accountId) return;
    if (t.cleared || t.reconciled) sum += (t.amount || 0);
  });
  return sum;
}

/**
 * Looks up an account by id.
 * @param {Profile} profile
 * @param {string} accountId
 * @returns {object|undefined}
 */
export function findAccount(profile, accountId) {
  return profile.accounts.find(function (a) { return a.id === accountId; });
}

/**
 * Looks up an account group by id.
 * @param {Profile} profile
 * @param {string} groupId
 * @returns {object|undefined}
 */
export function findAccountGroup(profile, groupId) {
  return profile.accountGroups.find(function (g) { return g.id === groupId; });
}

/* Accounts grouped by AccountGroup, with an "ungrouped" bucket for any
   account whose groupId is null or points at a missing group. */
/**
 * Open accounts bucketed by their AccountGroup (with an ungrouped trailer).
 * @param {Profile} profile
 * @returns {Array<{ group: object|null, accounts: Array<object> }>}
 */
export function accountsByGroup(profile) {
  var groups = profile.accountGroups
    .slice()
    .sort(function (a, b) { return a.sortIndex - b.sortIndex || a.name.localeCompare(b.name); })
    .map(function (g) { return { group: g, accounts: [] }; });

  var ungrouped = { group: null, accounts: [] };
  profile.accounts.forEach(function (a) {
    if (a.closedAt) return;
    var bucket = groups.find(function (b) { return b.group.id === a.groupId; }) || ungrouped;
    bucket.accounts.push(a);
  });
  if (ungrouped.accounts.length) groups.push(ungrouped);

  groups.forEach(function (b) {
    b.accounts.sort(function (a, b) { return a.sortIndex - b.sortIndex || a.name.localeCompare(b.name); });
  });
  return groups;
}

/* Sum totals — used by sidebar and net-worth math. */
/**
 * Sums runningBalance of every account matching the predicate.
 * @param {Profile} profile
 * @param {(account: object) => boolean} predicate
 * @returns {number} cents
 */
export function totalByPredicate(profile, predicate) {
  var sum = 0;
  profile.accounts.forEach(function (a) {
    if (!predicate(a)) return;
    sum += runningBalance(profile, a.id);
  });
  return sum;
}

/**
 * Sum of balances across all open on-budget accounts.
 * @param {Profile} profile
 * @returns {number} cents
 */
export function onBudgetTotal(profile) {
  return totalByPredicate(profile, function (a) { return !a.closedAt && a.onBudget; });
}

/**
 * Sum of tracking-asset balances (excluding net-worth-excluded accounts).
 * @param {Profile} profile
 * @returns {number} cents
 */
export function trackingAssetTotal(profile) {
  return totalByPredicate(profile, function (a) {
    return !a.closedAt && a.type === "tracking-asset" && !a.excludeFromNetWorth;
  });
}

/**
 * Sum of tracking-liability balances (excluding net-worth-excluded accounts).
 * @param {Profile} profile
 * @returns {number} cents
 */
export function trackingLiabilityTotal(profile) {
  return totalByPredicate(profile, function (a) {
    return !a.closedAt && a.type === "tracking-liability" && !a.excludeFromNetWorth;
  });
}

/**
 * Total net worth across all open, net-worth-eligible accounts.
 * @param {Profile} profile
 * @returns {number} cents
 */
export function netWorth(profile) {
  /* On-budget accounts already include credit cards (which carry a
     negative balance when in debt). Tracking liabilities are stored as
     negative numbers by convention. Accounts flagged
     `excludeFromNetWorth` (kids' 529s, escrow accounts, employer-held
     RSUs the user can't liquidate) are tracked + visible in the
     sidebar but skipped here. */
  return totalByPredicate(profile, function (a) {
    return !a.closedAt && !a.excludeFromNetWorth;
  });
}

export const ACCOUNT_TYPES = [
  { value: "checking",            label: "Checking",            onBudget: true },
  { value: "savings",             label: "Savings",             onBudget: true },
  { value: "cash",                label: "Cash",                onBudget: true },
  { value: "credit",              label: "Credit card",         onBudget: true },
  { value: "tracking-asset",      label: "Tracking asset",      onBudget: false },
  { value: "tracking-liability",  label: "Tracking liability",  onBudget: false },
];
