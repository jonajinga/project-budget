/* Import/Export slice — covers JSON / CSV / OFX / QIF / GoCardless.
   commitImport() is the only mutator; it runs inside batchMutate so
   the entire import is atomic (single undo entry, single _save,
   rollback on throw). The rest is parsing + dry-run + download.

   The JSON import paths touch profile-store internals
   (profileKey / profilesIndexKey / writeJSON / readJSON / loadProfile)
   because they import as a *new* profile rather than into the active
   one. We re-import the persistence helpers under their original
   names so the method bodies stay identical to the pre-extraction
   inline versions. */

import {
  download as downloadJSON,
  suggestedFilename,
  downloadBundle,
  suggestedBundleFilename,
} from "../../io/export-json.js";
import {
  parseFile as parseJSON,
  importAsNew as cloneAsNew,
  importReplacing,
} from "../../io/import-json.js";
import { parseCSV, applyMapping, dryRun as csvDryRun, detect as csvDetect } from "../../io/import-csv.js";
import { parseOFX, dryRun as ofxDryRun } from "../../io/import-ofx.js";
import { parseQIF, dryRun as qifDryRun } from "../../io/import-qif.js";
import { parseGoCardless, dryRun as gcDryRun } from "../../io/import-gocardless.js";
import {
  profileKey as _profileKey,
  profilesIndexKey as _profilesIndexKey,
  writeJSON as _writeJSON,
  readJSON as _readJSON,
} from "../persist.js";
import { loadProfile } from "../profile.js";

export const importExportSlice = {
  /* ---- Export ---- */
  /**
   * Trigger a browser download of the active profile as JSON.
   */
  exportActiveJSON() {
    if (!this.profile) return;
    downloadJSON(this.profile);
    this.pushToast("Profile downloaded.");
  },
  /** @returns {string} suggested filename for the active profile */
  exportFilename() {
    return this.profile ? suggestedFilename(this.profile) : "";
  },
  /**
   * Download every profile in the index as a single bundle file.
   * No-op if the profile index is empty or all loads fail.
   */
  exportAllProfilesJSON() {
    var index = this.profiles || [];
    if (!index.length) return;
    var profiles = index
      .map(function (entry) { return loadProfile(entry.id); })
      .filter(Boolean);
    if (!profiles.length) {
      this.pushToast("No profiles available to export.", "warn");
      return;
    }
    downloadBundle(profiles);
    this.pushToast("Exported " + profiles.length + " profile" + (profiles.length === 1 ? "" : "s") + " as one bundle.");
  },
  /** @returns {string} suggested filename for the bundle download */
  exportBundleFilename() { return suggestedBundleFilename(); },

  /* ---- JSON import ---- */
  /**
   * @param {string} text raw JSON
   * @returns {object} parser result {ok, kind, profile|profiles, ...}
   */
  parseImportJSON(text) { return parseJSON(text); },

  /**
   * Import a parsed JSON payload as a new profile (single or bundle).
   * For bundles, every contained profile is imported with a fresh id
   * and the first is activated. For singles, the new profile becomes
   * the active one.
   * @param {object} parsed result of parseImportJSON
   * @returns {object|object[]|null} the imported profile(s), or null if invalid
   */
  importJSONAsNew(parsed) {
    if (!parsed || !parsed.ok) return null;
    /* Bundle: import every profile as new. */
    if (parsed.kind === "bundle") {
      var index = _readJSON(_profilesIndexKey()) || [];
      var imported = [];
      parsed.profiles.forEach(function (p) {
        var fresh = cloneAsNew({ ok: true, profile: p });
        _writeJSON(_profileKey(fresh.id), fresh);
        index.push({ id: fresh.id, name: fresh.name, lastOpenedAt: fresh.updatedAt, schemaVersion: fresh.schemaVersion });
        imported.push(fresh);
      });
      _writeJSON(_profilesIndexKey(), index);
      this.refreshProfiles();
      if (imported.length) this._load(imported[0].id);
      this.pushToast("Imported " + imported.length + " profile" + (imported.length === 1 ? "" : "s") + " from bundle.");
      return imported;
    }
    var fresh = cloneAsNew(parsed);
    var index = _readJSON(_profilesIndexKey()) || [];
    _writeJSON(_profileKey(fresh.id), fresh);
    index.push({ id: fresh.id, name: fresh.name, lastOpenedAt: fresh.updatedAt, schemaVersion: fresh.schemaVersion });
    _writeJSON(_profilesIndexKey(), index);
    this.refreshProfiles();
    this._load(fresh.id);
    this.pushToast("Imported '" + fresh.name + "' as a new profile.");
    return fresh;
  },

  /**
   * Overwrite the active profile in place with parsed JSON data.
   * Requires confirmedName to match the active profile's name.
   * @param {object} parsed result of parseImportJSON
   * @param {string} confirmedName
   * @returns {boolean} false on name mismatch or invalid input
   */
  importJSONReplacing(parsed, confirmedName) {
    if (!parsed || !parsed.ok || !this.profile) return false;
    if (confirmedName !== this.profile.name) {
      this.pushToast("Replace cancelled — typed name did not match.", "warn");
      return false;
    }
    var replaced = importReplacing(parsed, this.profile.id);
    _writeJSON(_profileKey(replaced.id), replaced);
    this.profile = replaced;
    this._hydrateCollapsed();
    this.refreshProfiles();
    this.pushToast("Active profile replaced with imported data.");
    return true;
  },

  /* ---- CSV / OFX / QIF / GoCardless import ---- */
  /**
   * Parse a CSV blob into rows plus a header-detection guess.
   * @param {string} text
   * @returns {object} {headers, rows, detection}
   */
  parseCSVText(text) {
    var parsed = parseCSV(text);
    var detection = csvDetect(parsed.headers);
    return { headers: parsed.headers, rows: parsed.rows, detection: detection };
  },

  /**
   * Convert raw rows into normalized transaction shape using the
   * user's column mapping.
   * @param {object[]} rows
   * @param {object} columnMap
   * @returns {object[]}
   */
  applyCSVMapping(rows, columnMap) { return applyMapping(rows, columnMap); },

  /**
   * Annotate parsed rows with a `duplicate` flag against existing
   * transactions in the target account.
   * @param {id} accountId
   * @param {object[]} rows
   * @returns {object[]}
   */
  dryRunCSV(accountId, rows) {
    if (!this.profile) return rows.map(function (r) { return Object.assign({}, r, { duplicate: false }); });
    return csvDryRun(this.profile, accountId, rows);
  },

  /**
   * @param {string} text raw OFX
   * @returns {object[]} parsed rows
   */
  parseOFXText(text) { return parseOFX(text); },
  /**
   * @param {id} accountId
   * @param {object[]} rows
   * @returns {object[]} rows with `duplicate` flag annotated
   */
  dryRunOFX(accountId, rows) {
    if (!this.profile) return rows.map(function (r) { return Object.assign({}, r, { duplicate: false }); });
    return ofxDryRun(this.profile, accountId, rows);
  },

  /**
   * @param {string} text raw QIF
   * @returns {object[]} parsed rows
   */
  parseQIFText(text) { return parseQIF(text); },
  /**
   * @param {id} accountId
   * @param {object[]} rows
   * @returns {object[]} rows with `duplicate` flag annotated
   */
  dryRunQIF(accountId, rows) {
    if (!this.profile) return rows.map(function (r) { return Object.assign({}, r, { duplicate: false }); });
    return qifDryRun(this.profile, accountId, rows);
  },

  /**
   * @param {string} text raw GoCardless export
   * @returns {object[]} parsed rows
   */
  parseGoCardlessText(text) { return parseGoCardless(text); },
  /**
   * @param {id} accountId
   * @param {object[]} rows
   * @returns {object[]} rows with `duplicate` flag annotated
   */
  dryRunGoCardless(accountId, rows) {
    if (!this.profile) return rows.map(function (r) { return Object.assign({}, r, { duplicate: false }); });
    return gcDryRun(this.profile, accountId, rows);
  },

  /**
   * Commit non-duplicate rows as real transactions. Categories are
   * matched by name (case-insensitive); unmatched categories become
   * null. Atomic via batchMutate — one undo entry, single save, and
   * mid-loop errors roll back the whole import.
   * @param {id} accountId
   * @param {object[]} rows
   * @returns {object} {added, skipped}
   */
  commitImport(accountId, rows) {
    if (!this.profile) return { added: 0, skipped: 0 };
    var self = this;
    var added = 0;
    var skipped = 0;
    this.batchMutate(function () {
      rows.forEach(function (r) {
        if (r.duplicate) { skipped += 1; return; }
        if (!r.date || !r.amount) { skipped += 1; return; }
        var catId = null;
        if (r.category) {
          var match = self.profile.categories.find(function (c) {
            return c.name.toLowerCase() === r.category.toLowerCase();
          });
          if (match) catId = match.id;
        }
        self.addTransaction({
          accountId: accountId,
          date: r.date,
          payeeName: r.payee,
          categoryId: catId,
          amount: r.amount,
          memo: r.memo,
          cleared: !!r.cleared,
        });
        added += 1;
      });
    }, "Import " + rows.length + " transactions");
    this.pushToast("Imported " + added + " transaction" + (added === 1 ? "" : "s") + (skipped ? " (" + skipped + " skipped)" : "") + ".");
    return { added: added, skipped: skipped };
  },
};
