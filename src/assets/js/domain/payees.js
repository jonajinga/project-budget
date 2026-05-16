/* Payees: find-or-create on entry, remember the last category assigned to
   each payee so subsequent entries pre-fill the category. */

import { newPayee } from "../store/schema.js";

function normalize(name) {
  return (name || "").trim();
}

export function findPayeeByName(profile, name) {
  var n = normalize(name).toLowerCase();
  if (!n) return null;
  return profile.payees.find(function (p) { return p.name.toLowerCase() === n; });
}

/* Upsert by name (case-insensitive). Returns the Payee. Bumps useCount and
   sets lastCategoryId so the next entry of the same payee gets a hint. */
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

export function findPayee(profile, id) {
  if (!id) return null;
  return profile.payees.find(function (p) { return p.id === id; });
}
