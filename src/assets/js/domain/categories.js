/* Category mutators + queries. The store calls these and persists. */

import { newCategoryGroup, newCategory } from "../store/schema.js";

/* A credit-card payment category is a regular Category whose id is also
   listed in profile.settings.creditCardPaymentMap as: { [creditAccountId]: categoryId }.
   The flag tells the budget math to compute activity from credit-card
   spending + payments instead of from direct transactions. */

export function findCategory(profile, id) {
  return profile.categories.find(function (c) { return c.id === id; });
}

export function findCategoryGroup(profile, id) {
  return profile.categoryGroups.find(function (g) { return g.id === id; });
}

export function paymentMap(profile) {
  if (!profile.settings) profile.settings = {};
  if (!profile.settings.creditCardPaymentMap) profile.settings.creditCardPaymentMap = {};
  return profile.settings.creditCardPaymentMap;
}

/* Inverse lookup: which credit card does this category pay? null if none. */
export function paymentCardId(profile, categoryId) {
  var map = paymentMap(profile);
  var keys = Object.keys(map);
  for (var i = 0; i < keys.length; i++) {
    if (map[keys[i]] === categoryId) return keys[i];
  }
  return null;
}

export function isPaymentCategory(profile, categoryId) {
  return paymentCardId(profile, categoryId) !== null;
}

/* Hidden system group that holds Credit Card Payment categories. */
function ensurePaymentGroup(profile) {
  var existing = profile.categoryGroups.find(function (g) { return g.name === "Credit Card Payments"; });
  if (existing) return existing;
  var g = newCategoryGroup("Credit Card Payments", -1);
  /* Push to front, then resort other groups so this one sits above. */
  profile.categoryGroups.unshift(g);
  return g;
}

export function addCategoryGroup(profile, name) {
  var g = newCategoryGroup((name || "").trim() || "Group", profile.categoryGroups.length);
  profile.categoryGroups.push(g);
  return g;
}

export function addCategory(profile, opts) {
  var c = newCategory({
    groupId: opts.groupId,
    name: (opts.name || "").trim() || "New category",
    sortIndex: profile.categories.filter(function (x) { return x.groupId === opts.groupId; }).length,
  });
  profile.categories.push(c);
  return c;
}

export function renameCategory(profile, id, name) {
  var c = findCategory(profile, id);
  if (!c) return;
  c.name = (name || "").trim() || c.name;
}

export function renameCategoryGroup(profile, id, name) {
  var g = findCategoryGroup(profile, id);
  if (!g) return;
  g.name = (name || "").trim() || g.name;
}

export function deleteCategory(profile, id) {
  /* Detach any transactions referencing this category and any goals on it. */
  profile.transactions.forEach(function (t) {
    if (t.categoryId === id) t.categoryId = null;
    if (t.splits) t.splits.forEach(function (s) { if (s.categoryId === id) s.categoryId = null; });
  });
  profile.goals = profile.goals.filter(function (g) { return g.categoryId !== id; });
  /* If it was a payment category, drop the mapping. */
  var map = paymentMap(profile);
  Object.keys(map).forEach(function (k) { if (map[k] === id) delete map[k]; });
  profile.categories = profile.categories.filter(function (c) { return c.id !== id; });
}

export function deleteCategoryGroup(profile, id) {
  /* Detach categories — they become ungrouped, not deleted. */
  profile.categories.forEach(function (c) { if (c.groupId === id) c.groupId = null; });
  profile.categoryGroups = profile.categoryGroups.filter(function (g) { return g.id !== id; });
}

export function moveCategoryToGroup(profile, id, groupId) {
  var c = findCategory(profile, id);
  if (!c) return;
  c.groupId = groupId || null;
}

/* Ensure a payment category exists for a given credit card account.
   Idempotent — returns the existing category if one is already mapped. */
export function ensurePaymentCategory(profile, creditAccountId, accountName) {
  var map = paymentMap(profile);
  if (map[creditAccountId] && findCategory(profile, map[creditAccountId])) {
    return findCategory(profile, map[creditAccountId]);
  }
  var group = ensurePaymentGroup(profile);
  var c = newCategory({
    groupId: group.id,
    name: accountName + " payment",
    sortIndex: profile.categories.filter(function (x) { return x.groupId === group.id; }).length,
  });
  profile.categories.push(c);
  map[creditAccountId] = c.id;
  return c;
}

/* When a credit card account is renamed, follow up by renaming its
   payment category so the two stay in sync. */
export function syncPaymentCategoryName(profile, creditAccountId, newAccountName) {
  var map = paymentMap(profile);
  var catId = map[creditAccountId];
  if (!catId) return;
  var c = findCategory(profile, catId);
  if (c) c.name = newAccountName + " payment";
}

/* Drop the payment category when the underlying account goes away. */
export function removePaymentCategory(profile, creditAccountId) {
  var map = paymentMap(profile);
  var catId = map[creditAccountId];
  if (!catId) return;
  delete map[creditAccountId];
  deleteCategory(profile, catId);
}

/* Group → categories view (sorted). Used by the budget UI. */
export function categoryGroupsView(profile, opts) {
  var includeHidden = opts && opts.includeHidden;
  var groups = profile.categoryGroups
    .slice()
    .sort(function (a, b) { return a.sortIndex - b.sortIndex || a.name.localeCompare(b.name); })
    .map(function (g) { return { group: g, categories: [] }; });

  var ungrouped = { group: null, categories: [] };
  profile.categories.forEach(function (c) {
    if (c.hidden && !includeHidden) return;
    var bucket = groups.find(function (b) { return b.group.id === c.groupId; }) || ungrouped;
    bucket.categories.push(c);
  });
  if (ungrouped.categories.length) groups.push(ungrouped);

  groups.forEach(function (b) {
    b.categories.sort(function (x, y) { return x.sortIndex - y.sortIndex || x.name.localeCompare(y.name); });
  });
  return groups;
}
