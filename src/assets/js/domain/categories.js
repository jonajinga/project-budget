/* Category mutators + queries. The store calls these and persists. */

import { newCategoryGroup, newCategory } from "../store/schema.js";

/* A credit-card payment category is a regular Category whose id is also
   listed in profile.settings.creditCardPaymentMap as: { [creditAccountId]: categoryId }.
   The flag tells the budget math to compute activity from credit-card
   spending + payments instead of from direct transactions. */

/**
 * Looks up a category by id.
 * @param {Profile} profile
 * @param {string} id
 * @returns {object|undefined}
 */
export function findCategory(profile, id) {
  return profile.categories.find(function (c) { return c.id === id; });
}

/**
 * Looks up a category group by id.
 * @param {Profile} profile
 * @param {string} id
 * @returns {object|undefined}
 */
export function findCategoryGroup(profile, id) {
  return profile.categoryGroups.find(function (g) { return g.id === id; });
}

/**
 * The { creditAccountId: categoryId } payment map. Lazily initialized on the
 * profile. Mutates profile.settings in place when missing.
 * @param {Profile} profile
 * @returns {Object<string, string>}
 */
export function paymentMap(profile) {
  if (!profile.settings) profile.settings = {};
  if (!profile.settings.creditCardPaymentMap) profile.settings.creditCardPaymentMap = {};
  return profile.settings.creditCardPaymentMap;
}

/* Inverse lookup: which credit card does this category pay? null if none. */
/**
 * Credit-card account id that the given category pays, or null.
 * @param {Profile} profile
 * @param {string} categoryId
 * @returns {string|null}
 */
export function paymentCardId(profile, categoryId) {
  var map = paymentMap(profile);
  var keys = Object.keys(map);
  for (var i = 0; i < keys.length; i++) {
    if (map[keys[i]] === categoryId) return keys[i];
  }
  return null;
}

/**
 * True if the category is mapped as a credit-card payment category.
 * @param {Profile} profile
 * @param {string} categoryId
 * @returns {boolean}
 */
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

/**
 * Appends a new category group. Mutates profile in place.
 * @param {Profile} profile
 * @param {string} name
 * @returns {object} the new group
 */
export function addCategoryGroup(profile, name) {
  var g = newCategoryGroup((name || "").trim() || "Group", profile.categoryGroups.length);
  profile.categoryGroups.push(g);
  return g;
}

/**
 * Adds a category to a group. Mutates profile in place.
 * @param {Profile} profile
 * @param {object} opts - { name, groupId }
 * @returns {object} the new category
 */
export function addCategory(profile, opts) {
  var c = newCategory({
    groupId: opts.groupId,
    name: (opts.name || "").trim() || "New category",
    sortIndex: profile.categories.filter(function (x) { return x.groupId === opts.groupId; }).length,
  });
  profile.categories.push(c);
  return c;
}

/**
 * Renames a category. Mutates profile in place; no-op if empty or missing.
 * @param {Profile} profile
 * @param {string} id
 * @param {string} name
 */
export function renameCategory(profile, id, name) {
  var c = findCategory(profile, id);
  if (!c) return;
  c.name = (name || "").trim() || c.name;
}

/**
 * Renames a category group. Mutates profile in place; no-op if empty or missing.
 * @param {Profile} profile
 * @param {string} id
 * @param {string} name
 */
export function renameCategoryGroup(profile, id, name) {
  var g = findCategoryGroup(profile, id);
  if (!g) return;
  g.name = (name || "").trim() || g.name;
}

/**
 * Removes a category, detaching transactions/splits/goals and dropping any
 * payment-map entry. Mutates profile in place.
 * @param {Profile} profile
 * @param {string} id
 */
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

/**
 * Removes a category group; member categories become ungrouped (not deleted).
 * Mutates profile in place.
 * @param {Profile} profile
 * @param {string} id
 */
export function deleteCategoryGroup(profile, id) {
  /* Detach categories — they become ungrouped, not deleted. */
  profile.categories.forEach(function (c) { if (c.groupId === id) c.groupId = null; });
  profile.categoryGroups = profile.categoryGroups.filter(function (g) { return g.id !== id; });
}

/**
 * Reassigns a category to a different group (or ungrouped when groupId is falsy).
 * @param {Profile} profile
 * @param {string} id
 * @param {string|null} groupId
 */
export function moveCategoryToGroup(profile, id, groupId) {
  var c = findCategory(profile, id);
  if (!c) return;
  c.groupId = groupId || null;
}

/* Ensure a payment category exists for a given credit card account.
   Idempotent — returns the existing category if one is already mapped. */
/**
 * Idempotent: returns existing payment category for a credit account or
 * creates one inside the hidden Credit Card Payments group. Mutates profile.
 * @param {Profile} profile
 * @param {string} creditAccountId
 * @param {string} accountName used to build "{name} payment"
 * @returns {object} the payment category
 */
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
/**
 * Keeps the credit card's payment category name in sync with the account.
 * @param {Profile} profile
 * @param {string} creditAccountId
 * @param {string} newAccountName
 */
export function syncPaymentCategoryName(profile, creditAccountId, newAccountName) {
  var map = paymentMap(profile);
  var catId = map[creditAccountId];
  if (!catId) return;
  var c = findCategory(profile, catId);
  if (c) c.name = newAccountName + " payment";
}

/* Drop the payment category when the underlying account goes away. */
/**
 * Drops the payment category + mapping for a credit account. Mutates profile.
 * @param {Profile} profile
 * @param {string} creditAccountId
 */
export function removePaymentCategory(profile, creditAccountId) {
  var map = paymentMap(profile);
  var catId = map[creditAccountId];
  if (!catId) return;
  delete map[creditAccountId];
  deleteCategory(profile, catId);
}

/* Group → categories view (sorted). Used by the budget UI. */
/**
 * Sorted view of groups + their categories. Hides hidden categories unless
 * opts.includeHidden is true.
 * @param {Profile} profile
 * @param {object} [opts] - { includeHidden }
 * @returns {Array<{ group: object|null, categories: Array<object> }>}
 */
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
