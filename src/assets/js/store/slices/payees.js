/* Payees slice — suggestion lookups for the add-transaction form,
   admin mutations (rename / set category / merge / delete), and
   listing helpers for the payees admin page. */

import {
  suggestPayees as suggestPayeesImpl,
  findPayee as findPayeeImpl,
  renamePayee as renamePayeeImpl,
  setPayeeCategory as setPayeeCategoryImpl,
  mergePayees as mergePayeesImpl,
  deletePayee as deletePayeeImpl,
  payeeUsageCounts as payeeUsageCountsImpl,
} from "../../domain/payees.js";

export const payeesSlice = {
  suggestPayees(q, limit) {
    if (!this.profile) return [];
    return suggestPayeesImpl(this.profile, q, limit);
  },
  findPayee(id) { return this.profile ? findPayeeImpl(this.profile, id) : null; },
  payeeName(id) { var p = this.findPayee(id); return p ? p.name : ""; },

  renamePayee(id, newName) {
    if (!this.profile) return null;
    this._recordUndo("Rename payee");
    var p = renamePayeeImpl(this.profile, id, newName);
    this._bumpLists();
    this._save();
    return p;
  },
  setPayeeCategory(id, categoryId) {
    if (!this.profile) return null;
    this._recordUndo("Set payee category");
    var p = setPayeeCategoryImpl(this.profile, id, categoryId);
    this._bumpLists();
    this._save();
    return p;
  },
  mergePayees(sourceId, targetId) {
    if (!this.profile) return null;
    this._recordUndo("Merge payees");
    var p = mergePayeesImpl(this.profile, sourceId, targetId);
    this._bumpLists();
    this._save();
    return p;
  },
  deletePayee(id) {
    if (!this.profile) return false;
    this._recordUndo("Delete payee");
    var ok = deletePayeeImpl(this.profile, id);
    if (ok) { this._bumpLists(); this._save(); }
    return ok;
  },
  payeeUsageCounts() {
    void this._listVersion;
    return this.profile ? payeeUsageCountsImpl(this.profile) : {};
  },
  allPayees() {
    void this._listVersion;
    if (!this.profile) return [];
    return (this.profile.payees || []).slice().sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });
  },
};
