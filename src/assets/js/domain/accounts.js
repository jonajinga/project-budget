/* Pure derivations over the active profile.
   All inputs are arrays; nothing here mutates. */

export function transactionsFor(profile, accountId) {
  return profile.transactions.filter(function (t) { return t.accountId === accountId; });
}

/* Running balance = opening + sum of all transaction amounts. Amounts are
   signed cents (outflow negative, inflow positive). */
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

export function findAccount(profile, accountId) {
  return profile.accounts.find(function (a) { return a.id === accountId; });
}

export function findAccountGroup(profile, groupId) {
  return profile.accountGroups.find(function (g) { return g.id === groupId; });
}

/* Accounts grouped by AccountGroup, with an "ungrouped" bucket for any
   account whose groupId is null or points at a missing group. */
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
export function totalByPredicate(profile, predicate) {
  var sum = 0;
  profile.accounts.forEach(function (a) {
    if (!predicate(a)) return;
    sum += runningBalance(profile, a.id);
  });
  return sum;
}

export function onBudgetTotal(profile) {
  return totalByPredicate(profile, function (a) { return !a.closedAt && a.onBudget; });
}

export function trackingAssetTotal(profile) {
  return totalByPredicate(profile, function (a) { return !a.closedAt && a.type === "tracking-asset"; });
}

export function trackingLiabilityTotal(profile) {
  return totalByPredicate(profile, function (a) { return !a.closedAt && a.type === "tracking-liability"; });
}

export function netWorth(profile) {
  /* On-budget accounts already include credit cards (which carry a
     negative balance when in debt). Tracking liabilities are stored as
     negative numbers by convention. */
  return totalByPredicate(profile, function (a) { return !a.closedAt; });
}

export const ACCOUNT_TYPES = [
  { value: "checking",            label: "Checking",            onBudget: true },
  { value: "savings",             label: "Savings",             onBudget: true },
  { value: "cash",                label: "Cash",                onBudget: true },
  { value: "credit",              label: "Credit card",         onBudget: true },
  { value: "tracking-asset",      label: "Tracking asset",      onBudget: false },
  { value: "tracking-liability",  label: "Tracking liability",  onBudget: false },
];
