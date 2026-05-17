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
import { applyRules } from "../../domain/rules.js";

export const transactionsSlice = {
  /* ---- Single-row CRUD ---- */
  /**
   * Create a transaction. Upserts the payee from `payeeName` when
   * provided (overriding any payeeId). Amount stored as integer cents.
   * Auto-rules (normalize payee + categorize) are applied unless
   * opts.skipRules is true (used by transfers + reconciliation
   * adjustments where rules shouldn't override the intent).
   * Records an undo entry.
   * @param {object} opts {accountId, date, payeeName|payeeId, categoryId, amount, memo, cleared, skipRules?}
   * @returns {object|null} the created transaction
   */
  addTransaction(opts) {
    if (!this.profile) return null;
    this._recordUndo("Add transaction");
    var amount = Math.round(Number(opts.amount) || 0);
    var payeeId = null;
    var rawPayeeName = opts.payeeName;
    var categoryId = opts.categoryId || null;
    if (rawPayeeName && !opts.skipRules) {
      var ruled = applyRules(this.profile, rawPayeeName, categoryId);
      rawPayeeName = ruled.name;
      categoryId = ruled.categoryId;
    }
    if (rawPayeeName) {
      var p = upsertPayee(this.profile, rawPayeeName, categoryId || null);
      if (p) payeeId = p.id;
    } else if (opts.payeeId) {
      payeeId = opts.payeeId;
    }
    var t = addTxnImpl(this.profile, {
      accountId: opts.accountId,
      date: opts.date || new Date().toISOString().slice(0, 10),
      payeeId: payeeId,
      categoryId: categoryId,
      amount: amount,
      memo: opts.memo || "",
      cleared: !!opts.cleared,
    });
    this._save();
    return t;
  },

  /**
   * Patch a transaction. Resolves payeeName -> payeeId via upsert,
   * rounds amount to integer cents, and mirrors the edit onto the
   * paired transfer row when applicable. Records an undo entry.
   * @param {id} id
   * @param {object} patch
   * @returns {object|null} the updated transaction
   */
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

  /**
   * Move a transaction to the trash (30-day recovery window).
   * Records an undo entry.
   * @param {id} id
   * @returns {boolean} false if the domain helper refused
   */
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
  /**
   * @returns {object[]} trashed transactions, most-recently-deleted first
   */
  listTrashedTransactions() {
    void this._listVersion;
    if (!this.profile || !this.profile.trash) return [];
    return this.profile.trash.slice().sort(function (a, b) {
      return (b.deletedAt || "").localeCompare(a.deletedAt || "");
    });
  },
  /**
   * Restore a trashed transaction back to its account. Records an
   * undo entry.
   * @param {id} id
   * @returns {object|null} the restored transaction
   */
  restoreTransactionFromTrash(id) {
    if (!this.profile) return null;
    this._recordUndo("Restore transaction");
    var rec = restoreTxnFromTrash(this.profile, id);
    this._bumpLists();
    this._save();
    if (rec) this.pushToast("Restored.");
    return rec;
  },
  /**
   * Permanently remove a trashed transaction. Records an undo entry.
   * @param {id} id
   * @returns {boolean}
   */
  purgeTransactionFromTrash(id) {
    if (!this.profile) return false;
    this._recordUndo("Purge transaction");
    var ok = purgeTxnFromTrash(this.profile, id);
    this._bumpLists();
    this._save();
    if (ok) this.pushToast("Purged.");
    return ok;
  },
  /**
   * Purge every row currently in the trash. Records an undo entry.
   * @returns {number} count purged
   */
  emptyTransactionTrash() {
    if (!this.profile) return 0;
    this._recordUndo("Empty transaction trash");
    var n = emptyTrashImpl(this.profile);
    this._bumpLists();
    this._save();
    if (n) this.pushToast("Emptied " + n + " trashed item" + (n === 1 ? "" : "s") + ".");
    return n;
  },

  /**
   * Replace a transaction's splits (pass null/empty to clear and
   * revert to a flat single-category transaction). Records an undo
   * entry labelled by whether splits were set or cleared.
   * @param {id} id
   * @param {object[]|null} splits
   * @returns {object|null} the updated transaction
   */
  setSplits(id, splits) {
    if (!this.profile) return null;
    this._recordUndo(splits ? "Edit splits" : "Clear splits");
    var t = splitTxnImpl(this.profile, id, splits);
    this._save();
    return t;
  },

  /**
   * Create a paired transfer between two accounts (one outflow row
   * on the source, one inflow row on the destination, linked by
   * transferTxnId). Records an undo entry.
   * @param {object} opts {fromAccountId, toAccountId, amount, date, memo}
   * @returns {object|null} {outTxn, inTxn} pair
   */
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
  /**
   * @param {id} accountId
   * @returns {object[]} transactions in the account, newest date first
   */
  transactionsForAccount(accountId) {
    if (!this.profile) return [];
    return this.profile.transactions
      .filter(function (t) { return t.accountId === accountId; })
      .sort(function (a, b) {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return 0;
      });
  },

  /**
   * @returns {object[]} every transaction in the profile, newest date first
   */
  allTransactions() {
    if (!this.profile) return [];
    return this.profile.transactions.slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return 0;
    });
  },
};
