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
  exportActiveJSON() {
    if (!this.profile) return;
    downloadJSON(this.profile);
    this.pushToast("Profile downloaded.");
  },
  exportFilename() {
    return this.profile ? suggestedFilename(this.profile) : "";
  },
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
  exportBundleFilename() { return suggestedBundleFilename(); },

  /* ---- JSON import ---- */
  parseImportJSON(text) { return parseJSON(text); },

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
  parseCSVText(text) {
    var parsed = parseCSV(text);
    var detection = csvDetect(parsed.headers);
    return { headers: parsed.headers, rows: parsed.rows, detection: detection };
  },

  applyCSVMapping(rows, columnMap) { return applyMapping(rows, columnMap); },

  dryRunCSV(accountId, rows) {
    if (!this.profile) return rows.map(function (r) { return Object.assign({}, r, { duplicate: false }); });
    return csvDryRun(this.profile, accountId, rows);
  },

  parseOFXText(text) { return parseOFX(text); },
  dryRunOFX(accountId, rows) {
    if (!this.profile) return rows.map(function (r) { return Object.assign({}, r, { duplicate: false }); });
    return ofxDryRun(this.profile, accountId, rows);
  },

  parseQIFText(text) { return parseQIF(text); },
  dryRunQIF(accountId, rows) {
    if (!this.profile) return rows.map(function (r) { return Object.assign({}, r, { duplicate: false }); });
    return qifDryRun(this.profile, accountId, rows);
  },

  parseGoCardlessText(text) { return parseGoCardless(text); },
  dryRunGoCardless(accountId, rows) {
    if (!this.profile) return rows.map(function (r) { return Object.assign({}, r, { duplicate: false }); });
    return gcDryRun(this.profile, accountId, rows);
  },

  /* Commit non-duplicate rows as real transactions. Categories are
     matched by name (case-insensitive); unmatched categories become
     null. Returns { added, skipped } counts.
     Wrapped in batchMutate so all rows commit atomically: one
     undo entry covers the entire import, save fires once at the
     end, and a mid-loop error rolls back to the pre-import
     profile state (no partial imports). */
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
