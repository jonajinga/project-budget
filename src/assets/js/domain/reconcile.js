/* Reconciliation flow.
   1. User enters their statement ending balance.
   2. UI shows the cleared balance, the diff, and a Reconcile button.
   3. If diff is non-zero, the user can add an adjustment transaction
      that closes the gap, then proceed.
   4. On Reconcile, every cleared transaction in the account becomes
      reconciled (and locked from edit/delete). */

import { clearedBalance } from "./accounts.js";
import { addTxn } from "./transactions.js";

export function reconciliationStatus(profile, accountId, statementBalanceCents) {
  var cleared = clearedBalance(profile, accountId);
  var diff = (statementBalanceCents || 0) - cleared;
  return { clearedBalance: cleared, statementBalance: statementBalanceCents || 0, diff: diff };
}

/* Lock every cleared transaction in this account as reconciled. */
export function applyReconcile(profile, accountId) {
  var changed = 0;
  profile.transactions.forEach(function (t) {
    if (t.accountId !== accountId) return;
    if (t.cleared && !t.reconciled) {
      t.reconciled = true;
      changed += 1;
    }
  });
  return changed;
}

/* Insert an adjustment transaction sized to close the reconciliation gap.
   The transaction is cleared but not yet reconciled — the caller invokes
   applyReconcile next. */
export function addAdjustment(profile, accountId, amountCents, dateISO, memo) {
  return addTxn(profile, {
    accountId: accountId,
    date: dateISO || new Date().toISOString().slice(0, 10),
    amount: amountCents,
    memo: memo || "Reconciliation adjustment",
    cleared: true,
    categoryId: null,
  });
}

/* Unlock a reconciled transaction so it can be edited or removed. The
   surrounding UI should ask the user to confirm — once unlocked the
   account's reconciliation invariant is broken until they reconcile again. */
export function unlockReconciled(profile, txnId) {
  var t = profile.transactions.find(function (x) { return x.id === txnId; });
  if (!t || !t.reconciled) return false;
  t.reconciled = false;
  return true;
}
