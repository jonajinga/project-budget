/* Reconciliation slice — match cleared balance to statement,
   lock cleared transactions, plug gaps with adjustment entries,
   and unlock individual reconciled rows on demand. */

import {
  reconciliationStatus,
  applyReconcile as applyReconcileImpl,
  addAdjustment as addAdjustmentImpl,
  unlockReconciled as unlockReconciledImpl,
} from "../../domain/reconcile.js";

export const reconcileSlice = {
  /**
   * Compare cleared balance against a typed statement balance.
   * @param {id} accountId
   * @param {number} statementCents
   * @returns {object} {clearedBalance, statementBalance, diff} — all cents
   */
  reconcileStatus(accountId, statementCents) {
    if (!this.profile) return { clearedBalance: 0, statementBalance: 0, diff: 0 };
    return reconciliationStatus(this.profile, accountId, statementCents);
  },

  /**
   * Mark every cleared transaction in the account as reconciled
   * (locking them from edit). Records an undo entry.
   * @param {id} accountId
   * @returns {number} count of transactions reconciled
   */
  applyReconcile(accountId) {
    if (!this.profile) return 0;
    this._recordUndo("Reconcile account");
    var count = applyReconcileImpl(this.profile, accountId);
    this._save();
    this.pushToast("Reconciled " + count + " transaction" + (count === 1 ? "" : "s") + ".");
    return count;
  },

  /**
   * Insert a balancing adjustment transaction to plug the gap between
   * cleared balance and the statement. Records an undo entry.
   * @param {id} accountId
   * @param {number} amountCents
   * @param {string} dateISO
   * @param {string} memo
   * @returns {object|null} the adjustment transaction
   */
  addAdjustment(accountId, amountCents, dateISO, memo) {
    if (!this.profile) return null;
    this._recordUndo("Add adjustment");
    var t = addAdjustmentImpl(this.profile, accountId, amountCents, dateISO, memo);
    this._save();
    return t;
  },

  /**
   * Re-open a single reconciled transaction so it can be edited.
   * Records an undo entry.
   * @param {id} txnId
   * @returns {boolean} false if not found or not reconciled
   */
  unlockReconciled(txnId) {
    if (!this.profile) return false;
    this._recordUndo("Unlock reconciled");
    var ok = unlockReconciledImpl(this.profile, txnId);
    if (ok) this._save();
    return ok;
  },
};
