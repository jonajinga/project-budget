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
  /**
   * Fuzzy autocomplete results for the add-transaction payee field.
   * @param {string} q query
   * @param {number} [limit]
   * @returns {object[]}
   */
  suggestPayees(q, limit) {
    if (!this.profile) return [];
    return suggestPayeesImpl(this.profile, q, limit);
  },
  /** @param {id} id @returns {object|null} */
  findPayee(id) { return this.profile ? findPayeeImpl(this.profile, id) : null; },
  /** @param {id} id @returns {string} payee name, or "" */
  payeeName(id) { var p = this.findPayee(id); return p ? p.name : ""; },

  /**
   * Records an undo entry.
   * @param {id} id
   * @param {string} newName
   * @returns {object|null}
   */
  renamePayee(id, newName) {
    if (!this.profile) return null;
    this._recordUndo("Rename payee");
    var p = renamePayeeImpl(this.profile, id, newName);
    this._bumpLists();
    this._save();
    return p;
  },
  /**
   * Update a payee's default category (used to auto-pick a category
   * on the next add-transaction). Records an undo entry.
   * @param {id} id
   * @param {id} categoryId
   * @returns {object|null}
   */
  setPayeeCategory(id, categoryId) {
    if (!this.profile) return null;
    this._recordUndo("Set payee category");
    var p = setPayeeCategoryImpl(this.profile, id, categoryId);
    this._bumpLists();
    this._save();
    return p;
  },
  /**
   * Re-point every transaction from source onto target, then delete
   * source. Records an undo entry.
   * @param {id} sourceId
   * @param {id} targetId
   * @returns {object|null} the merged target payee
   */
  mergePayees(sourceId, targetId) {
    if (!this.profile) return null;
    this._recordUndo("Merge payees");
    var p = mergePayeesImpl(this.profile, sourceId, targetId);
    this._bumpLists();
    this._save();
    return p;
  },
  /**
   * Records an undo entry.
   * @param {id} id
   * @returns {boolean} false if the domain helper refused
   */
  deletePayee(id) {
    if (!this.profile) return false;
    this._recordUndo("Delete payee");
    var ok = deletePayeeImpl(this.profile, id);
    if (ok) { this._bumpLists(); this._save(); }
    return ok;
  },
  /**
   * @returns {object} map of payeeId -> transaction count
   */
  payeeUsageCounts() {
    void this._listVersion;
    return this.profile ? payeeUsageCountsImpl(this.profile) : {};
  },
  /**
   * @returns {object[]} payees sorted alphabetically by name
   */
  allPayees() {
    void this._listVersion;
    if (!this.profile) return [];
    return (this.profile.payees || []).slice().sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });
  },
};
