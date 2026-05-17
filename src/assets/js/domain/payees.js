/* Payees: find-or-create on entry, remember the last category assigned to
   each payee so subsequent entries pre-fill the category. */

import { newPayee } from "../store/schema.js";

function normalize(name) {
  return (name || "").trim();
}

/**
 * Case-insensitive lookup of a payee by name.
 * @param {Profile} profile
 * @param {string} name
 * @returns {object|null}
 */
export function findPayeeByName(profile, name) {
  var n = normalize(name).toLowerCase();
  if (!n) return null;
  return profile.payees.find(function (p) { return p.name.toLowerCase() === n; });
}

/* Upsert by name (case-insensitive). Returns the Payee. Bumps useCount and
   sets lastCategoryId so the next entry of the same payee gets a hint. */
/**
 * Finds-or-creates a payee by name and bumps usage. Mutates profile.
 * @param {Profile} profile
 * @param {string} name
 * @param {string} [categoryId] remembered as the payee's lastCategoryId
 * @returns {object|null} the payee (null if name is blank)
 */
export function upsertPayee(profile, name, categoryId) {
  var clean = normalize(name);
  if (!clean) return null;
  var existing = findPayeeByName(profile, clean);
  if (existing) {
    existing.useCount = (existing.useCount || 0) + 1;
    if (categoryId) existing.lastCategoryId = categoryId;
    return existing;
  }
  var fresh = newPayee(clean);
  fresh.useCount = 1;
  fresh.lastCategoryId = categoryId || null;
  profile.payees.push(fresh);
  return fresh;
}

/* startsWith suggestions, ordered by useCount desc then alpha.
   Used for the payee inline-edit dropdown. */
/**
 * Payee suggestions matching a startsWith query, sorted by useCount.
 * @param {Profile} profile
 * @param {string} q query prefix
 * @param {number} [limit] max results (default 8)
 * @returns {Array<object>}
 */
export function suggestPayees(profile, q, limit) {
  var query = normalize(q).toLowerCase();
  var max = limit || 8;
  var matches = profile.payees.filter(function (p) {
    return !query || p.name.toLowerCase().indexOf(query) === 0;
  });
  matches.sort(function (a, b) {
    return (b.useCount - a.useCount) || a.name.localeCompare(b.name);
  });
  return matches.slice(0, max);
}

/**
 * Looks up a payee by id.
 * @param {Profile} profile
 * @param {string} id
 * @returns {object|null}
 */
export function findPayee(profile, id) {
  if (!id) return null;
  return profile.payees.find(function (p) { return p.id === id; });
}

/* Rename a payee (collapsing into an existing one if the new name
   already exists). Returns the surviving payee. */
/**
 * Renames a payee. If newName matches another payee, merges into it.
 * Mutates profile in place. Returns the surviving payee.
 * @param {Profile} profile
 * @param {string} id
 * @param {string} newName
 * @returns {object|null}
 */
export function renamePayee(profile, id, newName) {
  var clean = normalize(newName);
  if (!clean) return null;
  var src = findPayee(profile, id);
  if (!src) return null;
  var dupe = profile.payees.find(function (p) {
    return p.id !== id && p.name.toLowerCase() === clean.toLowerCase();
  });
  if (dupe) {
    /* Collapse into the existing payee: re-point every transaction
       and schedule to the dupe's id, then drop the src. */
    profile.transactions.forEach(function (t) {
      if (t.payeeId === id) t.payeeId = dupe.id;
    });
    (profile.scheduled || []).forEach(function (s) {
      if (s.template && s.template.payeeId === id) s.template.payeeId = dupe.id;
    });
    dupe.useCount = (dupe.useCount || 0) + (src.useCount || 0);
    profile.payees = profile.payees.filter(function (p) { return p.id !== id; });
    return dupe;
  }
  src.name = clean;
  return src;
}

/* Set or clear the default category that auto-fills when this payee
   is selected for a new transaction. */
/**
 * Sets (or clears, when categoryId is falsy) a payee's default category.
 * Mutates profile in place.
 * @param {Profile} profile
 * @param {string} id payee id
 * @param {string|null} categoryId
 * @returns {object|null} the updated payee
 */
export function setPayeeCategory(profile, id, categoryId) {
  var p = findPayee(profile, id);
  if (!p) return null;
  p.lastCategoryId = categoryId || null;
  return p;
}

/* Merge sourceId INTO targetId — re-points every transaction and
   scheduled template, sums useCount, drops the source payee. */
/**
 * Merges sourceId into targetId, re-pointing transactions + schedules and
 * removing the source. Mutates profile in place.
 * @param {Profile} profile
 * @param {string} sourceId
 * @param {string} targetId
 * @returns {object|null} the surviving target payee
 */
export function mergePayees(profile, sourceId, targetId) {
  if (!sourceId || !targetId || sourceId === targetId) return null;
  var src = findPayee(profile, sourceId);
  var tgt = findPayee(profile, targetId);
  if (!src || !tgt) return null;
  profile.transactions.forEach(function (t) {
    if (t.payeeId === sourceId) t.payeeId = targetId;
  });
  (profile.scheduled || []).forEach(function (s) {
    if (s.template && s.template.payeeId === sourceId) s.template.payeeId = targetId;
  });
  tgt.useCount = (tgt.useCount || 0) + (src.useCount || 0);
  profile.payees = profile.payees.filter(function (p) { return p.id !== sourceId; });
  return tgt;
}

/* Permanently delete a payee. Transactions that referenced it lose
   the link (payeeId set to null); the user can re-categorize later. */
/**
 * Deletes a payee and nulls payeeId on referencing txns/schedules.
 * Mutates profile in place.
 * @param {Profile} profile
 * @param {string} id
 * @returns {boolean} true if a payee was removed
 */
export function deletePayee(profile, id) {
  if (!id) return false;
  var p = findPayee(profile, id);
  if (!p) return false;
  profile.transactions.forEach(function (t) {
    if (t.payeeId === id) t.payeeId = null;
  });
  (profile.scheduled || []).forEach(function (s) {
    if (s.template && s.template.payeeId === id) s.template.payeeId = null;
  });
  profile.payees = profile.payees.filter(function (x) { return x.id !== id; });
  return true;
}

/* Count of transactions that reference each payee — used by the
   management page to show usage stats. Returns { payeeId: count }. */
/**
 * Per-payee transaction count.
 * @param {Profile} profile
 * @returns {Object<string, number>} { payeeId: count }
 */
export function payeeUsageCounts(profile) {
  var out = {};
  (profile.transactions || []).forEach(function (t) {
    if (!t.payeeId) return;
    out[t.payeeId] = (out[t.payeeId] || 0) + 1;
  });
  return out;
}
