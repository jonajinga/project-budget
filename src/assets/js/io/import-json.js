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

  /* Bundle: { kind: "bundle", profiles: [...] } */
  if (data && data.kind === "bundle" && Array.isArray(data.profiles)) {
    if (data.schemaVersion && data.schemaVersion > SCHEMA_VERSION) {
      return { ok: false, error: "Bundle was made with a newer Project Budget version (" + data.schemaVersion + ") than this one (" + SCHEMA_VERSION + ")." };
    }
    var validProfiles = [];
    var errors = [];
    data.profiles.forEach(function (p, i) {
      if (!p || !p.id || !p.schemaVersion) {
        errors.push("Profile #" + (i + 1) + " missing id or schemaVersion.");
        return;
      }
      try { migrate(p); validProfiles.push(p); }
      catch (e) { errors.push("Profile '" + (p.name || "?") + "' migration failed: " + (e.message || e)); }
    });
    if (!validProfiles.length) {
      return { ok: false, error: "No importable profiles in bundle. " + errors.join(" ") };
    }
    return {
      ok: true,
      kind: "bundle",
      profiles: validProfiles,
      counts: { profiles: validProfiles.length },
      warnings: errors,
    };
  }

  /* Single profile: bare or wrapped {profile, exportedAt}. */
  var profile = data.profile && data.profile.id ? data.profile : data;
  if (!profile || !profile.id || !profile.schemaVersion) {
    return { ok: false, error: "Not a Project Budget export — missing id or schemaVersion." };
  }
  if (profile.schemaVersion > SCHEMA_VERSION) {
    return { ok: false, error: "Export was made with a newer Project Budget version (" + profile.schemaVersion + ") than this one (" + SCHEMA_VERSION + ")." };
  }

  try { migrate(profile); }
  catch (e) { return { ok: false, error: "Schema migration failed: " + (e.message || e) }; }

  return {
    ok: true,
    kind: "profile",
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
