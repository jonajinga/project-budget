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
  reconcileStatus(accountId, statementCents) {
    if (!this.profile) return { clearedBalance: 0, statementBalance: 0, diff: 0 };
    return reconciliationStatus(this.profile, accountId, statementCents);
  },

  applyReconcile(accountId) {
    if (!this.profile) return 0;
    this._recordUndo("Reconcile account");
    var count = applyReconcileImpl(this.profile, accountId);
    this._save();
    this.pushToast("Reconciled " + count + " transaction" + (count === 1 ? "" : "s") + ".");
    return count;
  },

  addAdjustment(accountId, amountCents, dateISO, memo) {
    if (!this.profile) return null;
    this._recordUndo("Add adjustment");
    var t = addAdjustmentImpl(this.profile, accountId, amountCents, dateISO, memo);
    this._save();
    return t;
  },

  unlockReconciled(txnId) {
    if (!this.profile) return false;
    this._recordUndo("Unlock reconciled");
    var ok = unlockReconciledImpl(this.profile, txnId);
    if (ok) this._save();
    return ok;
  },
};
