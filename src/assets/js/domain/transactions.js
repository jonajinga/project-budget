/* Transaction mutators. All operate against the active profile bundle.
   Callers (the Alpine store) are responsible for invoking persist after. */

import { newTransaction, newId } from "../store/schema.js";

/**
 * Appends a new transaction. Mutates profile in place.
 * @param {Profile} profile
 * @param {object} opts - { accountId, date, amount, payeeId?, categoryId?, memo?, cleared?, transferTxnId? }
 * @returns {object} the new transaction
 */
export function addTxn(profile, opts) {
  var t = newTransaction(opts);
  profile.transactions.push(t);
  return t;
}

/**
 * Patches a transaction in place. Reconciled txns are rejected unless
 * patch.__forceReconciledEdit is true.
 * @param {Profile} profile
 * @param {string} id
 * @param {object} patch any subset of transaction fields
 * @returns {object|null} the updated transaction or null
 */
export function editTxn(profile, id, patch) {
  var t = profile.transactions.find(function (x) { return x.id === id; });
  if (!t) return null;
  if (t.reconciled && !patch.__forceReconciledEdit) return null;
  Object.keys(patch).forEach(function (k) {
    if (k === "id" || k === "__forceReconciledEdit") return;
    t[k] = patch[k];
  });
  return t;
}

/* Soft-delete: moves the transaction to profile.trash with a
   deletedAt timestamp. Stays recoverable for 30 days. Transfer pairs
   move together so a restored transfer keeps both legs in sync.
   Reconciled transactions can't be deleted (same rule as before). */
/**
 * Soft-deletes a transaction (and its transfer pair) into profile.trash.
 * Reconciled txns are rejected. Mutates profile in place.
 * @param {Profile} profile
 * @param {string} id
 * @returns {boolean} true if removed
 */
export function deleteTxn(profile, id) {
  if (!profile.trash) profile.trash = [];
  var t = profile.transactions.find(function (x) { return x.id === id; });
  if (!t || t.reconciled) return false;
  var nowISO = new Date().toISOString();
  var idsToTrash = [id];
  if (t.transferTxnId) idsToTrash.push(t.transferTxnId);
  /* Snapshot the records, mark deletedAt, push to trash. */
  idsToTrash.forEach(function (txnId) {
    var rec = profile.transactions.find(function (x) { return x.id === txnId; });
    if (rec) profile.trash.push(Object.assign({}, rec, { deletedAt: nowISO }));
  });
  profile.transactions = profile.transactions.filter(function (x) {
    return idsToTrash.indexOf(x.id) === -1;
  });
  return true;
}

/* Restore a soft-deleted transaction back to the active list. Brings
   its transfer pair back with it if both legs are in trash. Returns
   the restored record (the first one, when restoring a transfer pair). */
/**
 * Restores a soft-deleted transaction from trash (with its transfer pair
 * if both legs are present). Mutates profile in place.
 * @param {Profile} profile
 * @param {string} id
 * @returns {object|null} the restored transaction
 */
export function restoreTxnFromTrash(profile, id) {
  if (!profile.trash || !profile.trash.length) return null;
  var entry = profile.trash.find(function (x) { return x.id === id; });
  if (!entry) return null;
  var idsToRestore = [id];
  if (entry.transferTxnId && profile.trash.some(function (x) { return x.id === entry.transferTxnId; })) {
    idsToRestore.push(entry.transferTxnId);
  }
  var restored = null;
  idsToRestore.forEach(function (txnId) {
    var rec = profile.trash.find(function (x) { return x.id === txnId; });
    if (!rec) return;
    var clone = Object.assign({}, rec);
    delete clone.deletedAt;
    profile.transactions.push(clone);
    if (!restored) restored = clone;
  });
  profile.trash = profile.trash.filter(function (x) {
    return idsToRestore.indexOf(x.id) === -1;
  });
  return restored;
}

/* Permanently remove a single trash entry. Does NOT touch its
   transfer pair — purging one leg leaves the other in trash for
   independent handling. */
/**
 * Permanently removes one trash entry. Does NOT touch its transfer pair.
 * Mutates profile in place.
 * @param {Profile} profile
 * @param {string} id
 * @returns {boolean} true if an entry was purged
 */
export function purgeTxnFromTrash(profile, id) {
  if (!profile.trash || !profile.trash.length) return false;
  var before = profile.trash.length;
  profile.trash = profile.trash.filter(function (x) { return x.id !== id; });
  return profile.trash.length < before;
}

/* Empty every trash entry — irreversible. */
/**
 * Empties trash. Irreversible. Mutates profile in place.
 * @param {Profile} profile
 * @returns {number} count of entries removed
 */
export function emptyTrash(profile) {
  if (!profile.trash) return 0;
  var n = profile.trash.length;
  profile.trash = [];
  return n;
}

/* Drop trash entries older than `days` days. Returns how many were
   dropped. Called on every store load so the bin stays fresh. */
/**
 * Drops trash entries older than `days` (default 30). Mutates profile.
 * @param {Profile} profile
 * @param {number} [days] default 30
 * @returns {number} count of entries dropped
 */
export function purgeExpiredTrash(profile, days) {
  if (!profile.trash || !profile.trash.length) return 0;
  var cutoff = Date.now() - ((days || 30) * 24 * 60 * 60 * 1000);
  var before = profile.trash.length;
  profile.trash = profile.trash.filter(function (x) {
    var t = x.deletedAt ? new Date(x.deletedAt).getTime() : Infinity;
    return t >= cutoff;
  });
  return before - profile.trash.length;
}

/* Convert a transaction to a split or update splits. `splits` is an array
   of { categoryId, amount, memo }. The parent txn's amount must equal the
   sum of split amounts; we recompute it here to enforce the invariant. */
/**
 * Sets (or clears, when <2 entries) splits on a transaction; parent amount
 * is recomputed as the sum of split amounts. Reconciled txns are rejected.
 * @param {Profile} profile
 * @param {string} id
 * @param {Array<{ categoryId: string|null, amount: number, memo?: string }>} splits
 * @returns {object|null}
 */
export function splitTxn(profile, id, splits) {
  var t = profile.transactions.find(function (x) { return x.id === id; });
  if (!t || t.reconciled) return null;
  if (!Array.isArray(splits) || splits.length < 2) {
    t.splits = null;
    return t;
  }
  t.splits = splits.map(function (s) {
    return {
      categoryId: s.categoryId || null,
      amount: Math.round(Number(s.amount) || 0),
      memo: s.memo || "",
    };
  });
  t.amount = t.splits.reduce(function (sum, s) { return sum + s.amount; }, 0);
  t.categoryId = null;
  return t;
}

/* Create a transfer between two of the user's accounts. Generates two
   paired transactions with linked transferTxnId and opposite signs.
   `amount` is the absolute amount moved (cents). */
/**
 * Creates a paired transfer between two accounts (linked transferTxnId,
 * opposite signs). Mutates profile in place.
 * @param {Profile} profile
 * @param {object} opts - { fromAccountId, toAccountId, amount (abs cents), date?, memo? }
 * @returns {{ out: object, in: object }|null}
 */
export function transfer(profile, opts) {
  var fromId = opts.fromAccountId;
  var toId = opts.toAccountId;
  if (!fromId || !toId || fromId === toId) return null;
  var amount = Math.abs(Math.round(Number(opts.amount) || 0));
  if (!amount) return null;
  var date = opts.date || new Date().toISOString().slice(0, 10);
  var memo = opts.memo || "";

  var outId = newId();
  var inId = newId();

  var outTxn = newTransaction({
    accountId: fromId,
    date: date,
    amount: -amount,
    memo: memo,
    categoryId: null,
    transferTxnId: inId,
  });
  outTxn.id = outId;

  var inTxn = newTransaction({
    accountId: toId,
    date: date,
    amount: amount,
    memo: memo,
    categoryId: null,
    transferTxnId: outId,
  });
  inTxn.id = inId;

  profile.transactions.push(outTxn, inTxn);
  return { out: outTxn, in: inTxn };
}

/* When the user edits one side of a transfer, mirror the change to the
   paired entry — keeps the two halves in sync. */
/**
 * Mirrors a transfer leg's date/amount/memo/cleared to its paired txn.
 * Mutates profile in place.
 * @param {Profile} profile
 * @param {string} sourceId the edited leg
 */
export function syncTransferPair(profile, sourceId) {
  var src = profile.transactions.find(function (x) { return x.id === sourceId; });
  if (!src || !src.transferTxnId) return;
  var paired = profile.transactions.find(function (x) { return x.id === src.transferTxnId; });
  if (!paired) return;
  paired.date = src.date;
  paired.amount = -src.amount;
  paired.memo = src.memo;
  paired.cleared = src.cleared;
}

/* Dedupe key used by import pipelines (Phase 5) to skip rows already in
   the profile. Lives here so the format is canonical. */
/**
 * Canonical dedupe key for import pipelines. Pipe-joined:
 * accountId | date | amount | payeeId | fitOrTxnId.
 * @param {object} t transaction-shaped object
 * @param {string} [fitOrTxnId] bank-provided id
 * @returns {string}
 */
export function dedupeKey(t, fitOrTxnId) {
  return [
    t.accountId,
    t.date,
    String(t.amount),
    (t.payeeId || ""),
    (fitOrTxnId || "")
  ].join("|");
}
