/* Transactions slice — single-row CRUD (add / update / delete), bulk
   operations wrapped in batchMutate (atomic + rollback), trash
   restore/purge/empty, splits, transfers, and the two lookup
   helpers the register + reports pages call. */

import {
  addTxn as addTxnImpl,
  editTxn as editTxnImpl,
  deleteTxn as deleteTxnImpl,
  splitTxn as splitTxnImpl,
  transfer as transferImpl,
  syncTransferPair,
  restoreTxnFromTrash,
  purgeTxnFromTrash,
  emptyTrash as emptyTrashImpl,
} from "../../domain/transactions.js";
import { upsertPayee } from "../../domain/payees.js";

export const transactionsSlice = {
  /* ---- Single-row CRUD ---- */
  addTransaction(opts) {
    if (!this.profile) return null;
    this._recordUndo("Add transaction");
    var amount = Math.round(Number(opts.amount) || 0);
    var payeeId = null;
    if (opts.payeeName) {
      var p = upsertPayee(this.profile, opts.payeeName, opts.categoryId || null);
      if (p) payeeId = p.id;
    } else if (opts.payeeId) {
      payeeId = opts.payeeId;
    }
    var t = addTxnImpl(this.profile, {
      accountId: opts.accountId,
      date: opts.date || new Date().toISOString().slice(0, 10),
      payeeId: payeeId,
      categoryId: opts.categoryId || null,
      amount: amount,
      memo: opts.memo || "",
      cleared: !!opts.cleared,
    });
    this._save();
    return t;
  },

  updateTransaction(id, patch) {
    if (!this.profile) return null;
    this._recordUndo("Edit transaction");
    if (patch.payeeName !== undefined) {
      var p = upsertPayee(this.profile, patch.payeeName, patch.categoryId || null);
      patch.payeeId = p ? p.id : null;
      delete patch.payeeName;
    }
    if (patch.amount !== undefined) patch.amount = Math.round(Number(patch.amount) || 0);
    var result = editTxnImpl(this.profile, id, patch);
    /* If it's part of a transfer pair, mirror the change. */
    if (result && result.transferTxnId) syncTransferPair(this.profile, id);
    this._bumpLists();
    this._save();
    return result;
  },

  deleteTransaction(id) {
    if (!this.profile) return false;
    this._recordUndo("Delete transaction");
    var ok = deleteTxnImpl(this.profile, id);
    if (ok) {
      this._bumpLists();
      this._save();
      this.pushToast("Transaction moved to Trash. Restore from /app/trash/ within 30 days.");
    }
    return ok;
  },

  /* ---- Bulk operations on transactions ----
     All three are wrapped in batchMutate so the entire set commits
     atomically — if any single row fails, the whole batch rolls
     back to the pre-batch snapshot. Reconciled rows are silently
     skipped (they're locked from edit by design). Returns the
     number of rows actually mutated. */

  /** Reassign every transaction in `ids` to `categoryId` (or null
   *  for uncategorized). Skips splits (split txns derive their
   *  category from the splits themselves) and reconciled rows. */
  bulkRecategorize(ids, categoryId) {
    if (!this.profile || !Array.isArray(ids) || !ids.length) return 0;
    var self = this;
    var catId = categoryId || null;
    return this.batchMutate(function () {
      var n = 0;
      ids.forEach(function (id) {
        var t = self.profile.transactions.find(function (x) { return x.id === id; });
        if (!t || t.reconciled || (t.splits && t.splits.length)) return;
        editTxnImpl(self.profile, id, { categoryId: catId });
        n += 1;
      });
      return n;
    }, "Bulk recategorize");
  },

  /** Rename the payee on every transaction in `ids`. Upserts the
   *  payee record (creates if missing). Skips reconciled and
   *  transfer rows. */
  bulkRenamePayee(ids, payeeName) {
    if (!this.profile || !Array.isArray(ids) || !ids.length) return 0;
    var name = (payeeName || "").trim();
    if (!name) return 0;
    var self = this;
    return this.batchMutate(function () {
      var p = upsertPayee(self.profile, name, null);
      var pid = p ? p.id : null;
      var n = 0;
      ids.forEach(function (id) {
        var t = self.profile.transactions.find(function (x) { return x.id === id; });
        if (!t || t.reconciled || t.transferTxnId) return;
        editTxnImpl(self.profile, id, { payeeId: pid });
        n += 1;
      });
      return n;
    }, "Bulk rename payee");
  },

  /** Move every transaction in `ids` to the trash. Skips reconciled
   *  rows. Transfers cascade via the existing deleteTxnImpl logic. */
  bulkDeleteTransactions(ids) {
    if (!this.profile || !Array.isArray(ids) || !ids.length) return 0;
    var self = this;
    return this.batchMutate(function () {
      var n = 0;
      ids.forEach(function (id) {
        var t = self.profile.transactions.find(function (x) { return x.id === id; });
        if (!t || t.reconciled) return;
        if (deleteTxnImpl(self.profile, id)) n += 1;
      });
      return n;
    }, "Bulk delete");
  },

  /* ---- Trash management ---- */
  listTrashedTransactions() {
    void this._listVersion;
    if (!this.profile || !this.profile.trash) return [];
    return this.profile.trash.slice().sort(function (a, b) {
      return (b.deletedAt || "").localeCompare(a.deletedAt || "");
    });
  },
  restoreTransactionFromTrash(id) {
    if (!this.profile) return null;
    this._recordUndo("Restore transaction");
    var rec = restoreTxnFromTrash(this.profile, id);
    this._bumpLists();
    this._save();
    if (rec) this.pushToast("Restored.");
    return rec;
  },
  purgeTransactionFromTrash(id) {
    if (!this.profile) return false;
    this._recordUndo("Purge transaction");
    var ok = purgeTxnFromTrash(this.profile, id);
    this._bumpLists();
    this._save();
    if (ok) this.pushToast("Purged.");
    return ok;
  },
  emptyTransactionTrash() {
    if (!this.profile) return 0;
    this._recordUndo("Empty transaction trash");
    var n = emptyTrashImpl(this.profile);
    this._bumpLists();
    this._save();
    if (n) this.pushToast("Emptied " + n + " trashed item" + (n === 1 ? "" : "s") + ".");
    return n;
  },

  setSplits(id, splits) {
    if (!this.profile) return null;
    this._recordUndo(splits ? "Edit splits" : "Clear splits");
    var t = splitTxnImpl(this.profile, id, splits);
    this._save();
    return t;
  },

  transfer(opts) {
    if (!this.profile) return null;
    this._recordUndo("Transfer");
    var pair = transferImpl(this.profile, {
      fromAccountId: opts.fromAccountId,
      toAccountId: opts.toAccountId,
      amount: Math.round(Number(opts.amount) || 0),
      date: opts.date,
      memo: opts.memo,
    });
    if (!pair) return null;
    this._save();
    return pair;
  },

  /* ---- Transaction queries ---- */
  transactionsForAccount(accountId) {
    if (!this.profile) return [];
    return this.profile.transactions
      .filter(function (t) { return t.accountId === accountId; })
      .sort(function (a, b) {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return 0;
      });
  },

  allTransactions() {
    if (!this.profile) return [];
    return this.profile.transactions.slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return 0;
    });
  },
};
