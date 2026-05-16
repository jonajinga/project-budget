/* Transaction mutators. All operate against the active profile bundle.
   Callers (the Alpine store) are responsible for invoking persist after. */

import { newTransaction, newId } from "../store/schema.js";

export function addTxn(profile, opts) {
  var t = newTransaction(opts);
  profile.transactions.push(t);
  return t;
}

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

export function deleteTxn(profile, id) {
  var t = profile.transactions.find(function (x) { return x.id === id; });
  if (!t || t.reconciled) return false;
  /* If it's a transfer, drop the paired entry too. */
  if (t.transferTxnId) {
    profile.transactions = profile.transactions.filter(function (x) {
      return x.id !== id && x.id !== t.transferTxnId;
    });
  } else {
    profile.transactions = profile.transactions.filter(function (x) { return x.id !== id; });
  }
  return true;
}

/* Convert a transaction to a split or update splits. `splits` is an array
   of { categoryId, amount, memo }. The parent txn's amount must equal the
   sum of split amounts; we recompute it here to enforce the invariant. */
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
export function dedupeKey(t, fitOrTxnId) {
  return [
    t.accountId,
    t.date,
    String(t.amount),
    (t.payeeId || ""),
    (fitOrTxnId || "")
  ].join("|");
}
