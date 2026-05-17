/* Rules engine — pattern matching on incoming transactions to:
 *   - assign a category automatically (categorization rules)
 *   - rewrite the payee name (payee-normalization rules)
 *
 * Both rule types live on profile.rules:
 *   profile.rules = {
 *     categorize: [{ id, pattern, matchType, categoryId, enabled }, ...],
 *     normalizePayee: [{ id, pattern, matchType, replacement, enabled }, ...],
 *   }
 *
 * matchType: "contains" | "starts-with" | "equals" | "regex"
 *   - String matches are case-insensitive after trimming.
 *   - regex patterns are compiled with the "i" flag; invalid patterns
 *     are skipped silently (so a broken rule never blocks an import).
 *
 * Rules are applied in order; the first matching rule wins. Disabled
 * rules are skipped.
 *
 * Both functions are pure — they take a candidate string and return
 * the matched rule (or null). The store-level glue is responsible
 * for actually applying the result to the transaction. */

import { newId } from "../store/schema.js";

function _ensureBuckets(profile) {
  if (!profile.rules) profile.rules = { categorize: [], normalizePayee: [] };
  if (!profile.rules.categorize) profile.rules.categorize = [];
  if (!profile.rules.normalizePayee) profile.rules.normalizePayee = [];
}

/** @returns {RegExp|null} */
function _compile(rule) {
  if (!rule || !rule.pattern) return null;
  var raw = String(rule.pattern);
  if (rule.matchType === "regex") {
    try { return new RegExp(raw, "i"); }
    catch (_e) { return null; }
  }
  /* Escape regex metacharacters so the literal pattern matches as-is. */
  var esc = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (rule.matchType === "equals")      return new RegExp("^" + esc + "$", "i");
  if (rule.matchType === "starts-with") return new RegExp("^" + esc, "i");
  /* Default: contains. */
  return new RegExp(esc, "i");
}

/**
 * Find the first enabled categorize rule whose pattern matches the
 * given payee name. Returns null if no rule matches or the matched
 * rule's categoryId no longer exists.
 * @param {Profile} profile
 * @param {string} payeeName
 * @returns {object|null}
 */
export function matchCategorizeRule(profile, payeeName) {
  if (!profile || !profile.rules || !profile.rules.categorize) return null;
  if (!payeeName) return null;
  var subject = String(payeeName).trim();
  if (!subject) return null;
  var catIds = new Set((profile.categories || []).map(function (c) { return c.id; }));
  var rules = profile.rules.categorize;
  for (var i = 0; i < rules.length; i++) {
    var r = rules[i];
    if (!r || r.enabled === false) continue;
    if (!r.categoryId || !catIds.has(r.categoryId)) continue;
    var re = _compile(r);
    if (!re) continue;
    if (re.test(subject)) return r;
  }
  return null;
}

/**
 * Find the first enabled normalize rule whose pattern matches the
 * incoming payee name. Returns null if no rule matches.
 * @param {Profile} profile
 * @param {string} payeeName
 * @returns {object|null}
 */
export function matchNormalizeRule(profile, payeeName) {
  if (!profile || !profile.rules || !profile.rules.normalizePayee) return null;
  if (!payeeName) return null;
  var subject = String(payeeName).trim();
  if (!subject) return null;
  var rules = profile.rules.normalizePayee;
  for (var i = 0; i < rules.length; i++) {
    var r = rules[i];
    if (!r || r.enabled === false) continue;
    if (!r.replacement) continue;
    var re = _compile(r);
    if (!re) continue;
    if (re.test(subject)) return r;
  }
  return null;
}

/**
 * Apply normalize-then-categorize against a raw payee name. Returns
 * { name, categoryId } where name is the (possibly rewritten) payee
 * and categoryId is the auto-assigned category (or null).
 * @param {Profile} profile
 * @param {string} rawPayeeName
 * @param {id|null} fallbackCategoryId category to use if no rule matches
 * @returns {{ name: string, categoryId: (string|null) }}
 */
export function applyRules(profile, rawPayeeName, fallbackCategoryId) {
  var name = (rawPayeeName == null ? "" : String(rawPayeeName)).trim();
  var normRule = matchNormalizeRule(profile, name);
  if (normRule) name = normRule.replacement;
  var catRule = matchCategorizeRule(profile, name);
  return {
    name: name,
    categoryId: catRule ? catRule.categoryId : (fallbackCategoryId || null),
  };
}

/* ---- Mutators ---- */

/**
 * Add a new categorize rule. Pushed to the end of the list so the
 * rule order (= match priority) is user-controlled.
 */
export function addCategorizeRule(profile, opts) {
  _ensureBuckets(profile);
  var r = {
    id: newId(),
    pattern: (opts.pattern || "").trim(),
    matchType: opts.matchType || "contains",
    categoryId: opts.categoryId || null,
    enabled: opts.enabled !== false,
  };
  profile.rules.categorize.push(r);
  return r;
}

/**
 * Add a new normalize-payee rule.
 */
export function addNormalizeRule(profile, opts) {
  _ensureBuckets(profile);
  var r = {
    id: newId(),
    pattern: (opts.pattern || "").trim(),
    matchType: opts.matchType || "contains",
    replacement: (opts.replacement || "").trim(),
    enabled: opts.enabled !== false,
  };
  profile.rules.normalizePayee.push(r);
  return r;
}

/** Update fields on a rule (either kind). Returns the updated rule or null. */
export function updateRule(profile, kind, id, patch) {
  _ensureBuckets(profile);
  var arr = kind === "normalizePayee" ? profile.rules.normalizePayee : profile.rules.categorize;
  var r = arr.find(function (x) { return x.id === id; });
  if (!r) return null;
  Object.keys(patch).forEach(function (k) {
    if (k === "id") return;
    r[k] = patch[k];
  });
  return r;
}

/** Remove a rule by id from the named bucket. Returns true if removed. */
export function deleteRule(profile, kind, id) {
  _ensureBuckets(profile);
  var arr = kind === "normalizePayee" ? profile.rules.normalizePayee : profile.rules.categorize;
  var i = arr.findIndex(function (x) { return x.id === id; });
  if (i === -1) return false;
  arr.splice(i, 1);
  return true;
}

/** Move a rule up or down (delta = -1 / +1) in priority order. */
export function moveRule(profile, kind, id, delta) {
  _ensureBuckets(profile);
  var arr = kind === "normalizePayee" ? profile.rules.normalizePayee : profile.rules.categorize;
  var i = arr.findIndex(function (x) { return x.id === id; });
  if (i === -1) return false;
  var next = Math.max(0, Math.min(arr.length - 1, i + delta));
  if (next === i) return false;
  var [moved] = arr.splice(i, 1);
  arr.splice(next, 0, moved);
  return true;
}
