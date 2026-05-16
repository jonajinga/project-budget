/* JSON profile import. Two paths:
     - importAsNew: deep-clone, generate a fresh id, push to profile list,
       optionally activate.
     - replaceActive: overwrite the active profile in place (requires the
       caller to confirm with a typed-name check).
   Both run schema migrations before commit. */

import { migrate, SCHEMA_VERSION, newId } from "../store/schema.js";

export function parseFile(text) {
  var data;
  try { data = JSON.parse(text); }
  catch (_e) { return { ok: false, error: "Could not parse JSON." }; }

  /* Accept either a bare profile or the wrapped {profile, exportedAt} shape. */
  var profile = data.profile && data.profile.id ? data.profile : data;
  if (!profile || !profile.id || !profile.schemaVersion) {
    return { ok: false, error: "Not a Project Budget export — missing id or schemaVersion." };
  }
  if (profile.schemaVersion > SCHEMA_VERSION) {
    return { ok: false, error: "Export was made with a newer Project Budget version (" + profile.schemaVersion + ") than this one (" + SCHEMA_VERSION + ")." };
  }

  /* Run migrations to current schema. Migrations mutate in place. */
  try { migrate(profile); }
  catch (e) { return { ok: false, error: "Schema migration failed: " + (e.message || e) }; }

  return {
    ok: true,
    profile: profile,
    counts: {
      accounts: (profile.accounts || []).length,
      categories: (profile.categories || []).length,
      transactions: (profile.transactions || []).length,
      payees: (profile.payees || []).length,
      scheduled: (profile.scheduled || []).length,
      goals: (profile.goals || []).length,
    },
  };
}

function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

/* Create a fresh profile from a parsed bundle. New id everywhere so two
   copies can coexist. */
export function importAsNew(parsed, opts) {
  var clone = deepClone(parsed.profile);
  clone.id = newId();
  if (opts && opts.name) clone.name = opts.name;
  else clone.name = parsed.profile.name + " (imported)";
  clone.createdAt = new Date().toISOString();
  clone.updatedAt = clone.createdAt;
  return clone;
}

/* Replace the active profile slot. Keeps the active id so the user
   doesn't need to switch. */
export function importReplacing(parsed, activeId) {
  var clone = deepClone(parsed.profile);
  clone.id = activeId;
  clone.updatedAt = new Date().toISOString();
  return clone;
}
