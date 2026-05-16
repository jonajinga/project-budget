/* Build a realistic sample profile.

   Writes two outputs:
     - src/assets/sample/sample.json — shipped with the build so first-time
       visitors auto-load it (see store.init -> loadSampleIfFirstVisit).
     - _sample/sample.json — a copy outside the build, useful for ad-hoc
       imports while developing.

   The profile exercises:
     - 5 accounts across all on-budget + tracking types
     - 2 account groups
     - 4 category groups, 16 categories
     - Credit-card payment categories (auto-created when CC accounts add)
     - Three months of transactions with realistic payees/categories
     - Split transactions
     - Transfers (paid CC, savings transfer)
     - Reconciled transactions
     - Recurring transactions (salary, rent, gym, streaming)
     - 4 goals covering all 4 goal types
     - Two months of assigned budgets
*/

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createStore } from "../src/assets/js/store/store.js";
import { buildExport } from "../src/assets/js/io/export-json.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/* Minimal localStorage shim so the store can use scheduleSave. */
globalThis.localStorage = (() => {
  const m = new Map();
  return {
    get length() { return m.size; },
    key(i) { return [...m.keys()][i] ?? null; },
    getItem(k) { return m.has(k) ? m.get(k) : null; },
    setItem(k, v) { m.set(k, String(v)); },
    removeItem(k) { m.delete(k); },
    clear() { m.clear(); },
  };
})();

/* Force a fixed "today" so screenshots are reproducible. */
const TODAY = "2026-05-15";
const CURRENT_MONTH = TODAY.slice(0, 7);
const PRIOR_MONTH = "2026-04";
const TWO_BACK = "2026-03";

const s = createStore();
s.init();
const profile = s.createProfile("Sample household");
profile.settings = profile.settings || {};
profile.settings.isSample = true;
s.setMonth(CURRENT_MONTH);

/* ---- Account groups + accounts -------------------------------------- */
const gDaily   = s.addAccountGroup("Daily");
const gReserves = s.addAccountGroup("Reserves and debts");

const checking = s.addAccount({ name: "Checking",           type: "checking",            groupId: gDaily.id,    openingBalance: 320000 });
const savings  = s.addAccount({ name: "Savings",            type: "savings",             groupId: gReserves.id, openingBalance: 850000 });
const cash     = s.addAccount({ name: "Cash on hand",       type: "cash",                groupId: gDaily.id,    openingBalance: 6000 });
const visa     = s.addAccount({ name: "Visa",               type: "credit",              groupId: gDaily.id,    openingBalance: -85000 });
const auto     = s.addAccount({ name: "Auto loan",          type: "tracking-liability",  groupId: gReserves.id, openingBalance: -1850000 });
const i401k    = s.addAccount({ name: "401(k)",             type: "tracking-asset",      groupId: gReserves.id, openingBalance: 12500000 });

/* ---- Category groups + categories ----------------------------------- */
const gImmediate = s.addCategoryGroup("Immediate obligations");
const gTrue      = s.addCategoryGroup("True expenses");
const gQOL       = s.addCategoryGroup("Quality of life");
const gJust      = s.addCategoryGroup("Just for fun");

const catRent      = s.addCategory({ groupId: gImmediate.id, name: "Rent" });
const catUtilities = s.addCategory({ groupId: gImmediate.id, name: "Utilities" });
const catGroceries = s.addCategory({ groupId: gImmediate.id, name: "Groceries" });
const catGas       = s.addCategory({ groupId: gImmediate.id, name: "Gas" });
const catInsurance = s.addCategory({ groupId: gImmediate.id, name: "Insurance" });

const catAutoMaint = s.addCategory({ groupId: gTrue.id, name: "Auto maintenance" });
const catMedical   = s.addCategory({ groupId: gTrue.id, name: "Medical" });
const catGifts     = s.addCategory({ groupId: gTrue.id, name: "Gifts" });
const catSubs      = s.addCategory({ groupId: gTrue.id, name: "Subscriptions" });

const catDining    = s.addCategory({ groupId: gQOL.id, name: "Dining out" });
const catFitness   = s.addCategory({ groupId: gQOL.id, name: "Fitness" });
const catHobby     = s.addCategory({ groupId: gQOL.id, name: "Hobby" });
const catClothing  = s.addCategory({ groupId: gQOL.id, name: "Clothing" });

const catVacation  = s.addCategory({ groupId: gJust.id, name: "Vacation" });
const catEntertain = s.addCategory({ groupId: gJust.id, name: "Entertainment" });
const catHousehold = s.addCategory({ groupId: gJust.id, name: "Household" });

/* ---- Goals ---------------------------------------------------------- */
s.addGoal({ categoryId: catRent.id,      type: "monthlyFixed", target: 145000 });
s.addGoal({ categoryId: catGroceries.id, type: "monthlyTopUp", target: 75000 });
s.addGoal({ categoryId: catVacation.id,  type: "targetByDate", target: 250000, byDate: "2026-08-31" });
s.addGoal({ categoryId: catSubs.id,      type: "refillUpTo",   target: 4500 });

/* ---- Three months of transactions ---------------------------------- */
function txn(opts) {
  return s.addTransaction({
    accountId: opts.account || checking.id,
    date: opts.date,
    payeeName: opts.payee,
    categoryId: opts.cat || null,
    amount: opts.amount,
    memo: opts.memo || "",
    cleared: opts.cleared !== false,
  });
}

/* Two months back — March */
txn({ date: "2026-03-01", payee: "Acme Industries",  amount:  580000 });                                 // paycheck
txn({ date: "2026-03-02", payee: "Riverside Apts",    amount: -145000, cat: catRent.id });
txn({ date: "2026-03-04", payee: "PG&E",              amount:  -11200, cat: catUtilities.id });
txn({ date: "2026-03-07", payee: "Trader Joe's",      amount:  -8400,  cat: catGroceries.id, account: visa.id });
txn({ date: "2026-03-09", payee: "Shell",             amount:  -4800,  cat: catGas.id,       account: visa.id });
txn({ date: "2026-03-12", payee: "Whole Foods",       amount:  -6750,  cat: catGroceries.id, account: visa.id });
txn({ date: "2026-03-14", payee: "Netflix",           amount:  -1599,  cat: catSubs.id,      account: visa.id });
txn({ date: "2026-03-15", payee: "Acme Industries",   amount:  580000 });
txn({ date: "2026-03-15", payee: "Sweetgreen",        amount:  -1875,  cat: catDining.id,    account: visa.id });
txn({ date: "2026-03-18", payee: "Equinox",           amount: -22000,  cat: catFitness.id });
txn({ date: "2026-03-19", payee: "Costco",            amount: -19200,  cat: catGroceries.id, account: visa.id });
txn({ date: "2026-03-21", payee: "Spotify",           amount:  -1199,  cat: catSubs.id,      account: visa.id });
txn({ date: "2026-03-24", payee: "Walgreens",         amount:  -3400,  cat: catMedical.id });
txn({ date: "2026-03-25", payee: "Visa payment",      amount: -65000,  account: checking.id });          // dummy
txn({ date: "2026-03-27", payee: "Amazon",            amount: -12400,  cat: catHousehold.id, account: visa.id });
txn({ date: "2026-03-30", payee: "AAA Insurance",     amount: -42000,  cat: catInsurance.id });

/* Prior month — April */
txn({ date: "2026-04-01", payee: "Acme Industries",   amount:  580000 });
txn({ date: "2026-04-02", payee: "Riverside Apts",    amount: -145000, cat: catRent.id });
txn({ date: "2026-04-04", payee: "PG&E",              amount: -10100,  cat: catUtilities.id });
txn({ date: "2026-04-05", payee: "Verizon",           amount:  -8500,  cat: catUtilities.id });
txn({ date: "2026-04-06", payee: "Trader Joe's",      amount:  -9200,  cat: catGroceries.id, account: visa.id });
txn({ date: "2026-04-08", payee: "Chevron",           amount:  -5500,  cat: catGas.id,       account: visa.id });
txn({ date: "2026-04-10", payee: "Whole Foods",       amount:  -8400,  cat: catGroceries.id, account: visa.id });
txn({ date: "2026-04-11", payee: "Goodwill",          amount: -4500,   cat: catClothing.id });
txn({ date: "2026-04-12", payee: "Concert tickets",   amount: -12800,  cat: catEntertain.id, account: visa.id });
txn({ date: "2026-04-14", payee: "Netflix",           amount:  -1599,  cat: catSubs.id,      account: visa.id });
txn({ date: "2026-04-15", payee: "Acme Industries",   amount:  580000 });
txn({ date: "2026-04-15", payee: "Etsy gift",         amount:  -3500,  cat: catGifts.id,     account: visa.id });
txn({ date: "2026-04-17", payee: "Pep Boys",          amount: -18500,  cat: catAutoMaint.id });
txn({ date: "2026-04-19", payee: "Costco",            amount: -21000,  cat: catGroceries.id, account: visa.id });
txn({ date: "2026-04-21", payee: "Spotify",           amount:  -1199,  cat: catSubs.id,      account: visa.id });
txn({ date: "2026-04-23", payee: "Hobby Lobby",       amount:  -8700,  cat: catHobby.id });
txn({ date: "2026-04-25", payee: "Visa payment",      amount: -75000,  account: checking.id });
txn({ date: "2026-04-28", payee: "Amazon",            amount:  -6700,  cat: catHousehold.id, account: visa.id });
txn({ date: "2026-04-30", payee: "Equinox",           amount: -22000,  cat: catFitness.id });

/* Current month — May (partial through the 15th) */
txn({ date: "2026-05-01", payee: "Acme Industries",   amount:  580000 });
txn({ date: "2026-05-02", payee: "Riverside Apts",    amount: -145000, cat: catRent.id });
txn({ date: "2026-05-04", payee: "PG&E",              amount: -10800,  cat: catUtilities.id });
txn({ date: "2026-05-05", payee: "Verizon",           amount:  -8500,  cat: catUtilities.id });
txn({ date: "2026-05-06", payee: "Trader Joe's",      amount: -10400,  cat: catGroceries.id, account: visa.id });
txn({ date: "2026-05-07", payee: "Shell",             amount:  -5100,  cat: catGas.id,       account: visa.id });
txn({ date: "2026-05-09", payee: "Whole Foods",       amount:  -7800,  cat: catGroceries.id, account: visa.id });
txn({ date: "2026-05-10", payee: "Sweetgreen",        amount:  -2050,  cat: catDining.id,    account: visa.id });
txn({ date: "2026-05-11", payee: "Mom's birthday",    amount: -6000,   cat: catGifts.id });
txn({ date: "2026-05-12", payee: "Netflix",           amount:  -1599,  cat: catSubs.id,      account: visa.id });
txn({ date: "2026-05-14", payee: "Equinox",           amount: -22000,  cat: catFitness.id });

/* A split transaction (groceries + household at Target). */
const targetTxn = s.addTransaction({
  accountId: visa.id, date: "2026-05-13", payeeName: "Target",
  amount: -18450, cleared: true,
});
s.setSplits(targetTxn.id, [
  { categoryId: catGroceries.id, amount: -12000, memo: "groceries" },
  { categoryId: catHousehold.id, amount: -6450,  memo: "cleaning, paper goods" },
]);

/* A transfer: monthly savings move and a CC payment. */
s.transfer({ fromAccountId: checking.id, toAccountId: savings.id, amount: 100000, date: "2026-05-08", memo: "Monthly savings" });
s.transfer({ fromAccountId: checking.id, toAccountId: visa.id,    amount: 80000,  date: "2026-05-12", memo: "Pay down Visa" });

/* ---- Reconciliation on checking through end of April --------------- */
// All checking transactions through Apr 30 are cleared; reconcile locks them.
s.applyReconcile(checking.id);

/* ---- Recurring transactions (none due — push past today) ----------- */
s.addSchedule({
  template: { accountId: checking.id, payeeName: "Acme Industries", categoryId: null,           amount:  580000, memo: "Paycheck" },
  frequency: "biweekly", nextDate: "2026-05-29",
});
s.addSchedule({
  template: { accountId: checking.id, payeeName: "Riverside Apts",  categoryId: catRent.id,    amount: -145000, memo: "Monthly rent" },
  frequency: "monthly",  nextDate: "2026-06-02",
});
s.addSchedule({
  template: { accountId: checking.id, payeeName: "Equinox",         categoryId: catFitness.id, amount: -22000,  memo: "Gym membership" },
  frequency: "monthly",  nextDate: "2026-05-30",
});
s.addSchedule({
  template: { accountId: visa.id,     payeeName: "Netflix",          categoryId: catSubs.id,   amount: -1599,   memo: "Streaming" },
  frequency: "monthly",  nextDate: "2026-06-12",
});
/* One that IS due — surfaces in the register due queue. */
s.addSchedule({
  template: { accountId: visa.id,     payeeName: "Spotify",          categoryId: catSubs.id,   amount: -1199,   memo: "Streaming" },
  frequency: "monthly",  nextDate: TODAY,
});

/* ---- Assigned amounts ---------------------------------------------- */
function assign(catId, month, dollars) { s.assign(catId, month, Math.round(dollars * 100)); }

// April — fully funded
assign(catRent.id,      PRIOR_MONTH, 1450);
assign(catUtilities.id, PRIOR_MONTH,  220);
assign(catGroceries.id, PRIOR_MONTH,  550);
assign(catGas.id,       PRIOR_MONTH,  120);
assign(catInsurance.id, PRIOR_MONTH,  420);
assign(catAutoMaint.id, PRIOR_MONTH,  200);
assign(catMedical.id,   PRIOR_MONTH,   50);
assign(catGifts.id,     PRIOR_MONTH,   75);
assign(catSubs.id,      PRIOR_MONTH,   60);
assign(catDining.id,    PRIOR_MONTH,  100);
assign(catFitness.id,   PRIOR_MONTH,  220);
assign(catHobby.id,     PRIOR_MONTH,  100);
assign(catClothing.id,  PRIOR_MONTH,   60);
assign(catVacation.id,  PRIOR_MONTH,  500);
assign(catEntertain.id, PRIOR_MONTH,  150);
assign(catHousehold.id, PRIOR_MONTH,  100);

// May — funded so far through mid-month
assign(catRent.id,      CURRENT_MONTH, 1450);
assign(catUtilities.id, CURRENT_MONTH,  220);
assign(catGroceries.id, CURRENT_MONTH,  750);
assign(catGas.id,       CURRENT_MONTH,  120);
assign(catInsurance.id, CURRENT_MONTH,  420);
assign(catAutoMaint.id, CURRENT_MONTH,    0);
assign(catMedical.id,   CURRENT_MONTH,   50);
assign(catGifts.id,     CURRENT_MONTH,  100);
assign(catSubs.id,      CURRENT_MONTH,   45);
assign(catDining.id,    CURRENT_MONTH,  120);
assign(catFitness.id,   CURRENT_MONTH,  220);
assign(catHobby.id,     CURRENT_MONTH,   60);
assign(catClothing.id,  CURRENT_MONTH,   40);
assign(catVacation.id,  CURRENT_MONTH,  650);
assign(catEntertain.id, CURRENT_MONTH,  100);
assign(catHousehold.id, CURRENT_MONTH,   60);

/* Pay credit card payment categories so they're realistic. */
const ccPaymentCat = s.profile.categories.find(c => c.name === "Visa payment");
if (ccPaymentCat) {
  assign(ccPaymentCat.id, CURRENT_MONTH, 600);
  assign(ccPaymentCat.id, PRIOR_MONTH, 700);
}

/* ---- Export ---- */
const exportData = buildExport(s.profile);

const devOut = resolve(__dirname, "..", "_sample");
mkdirSync(devOut, { recursive: true });
writeFileSync(resolve(devOut, "sample.json"), JSON.stringify(exportData, null, 2));

const shippedOut = resolve(__dirname, "..", "src", "assets", "sample");
mkdirSync(shippedOut, { recursive: true });
writeFileSync(resolve(shippedOut, "sample.json"), JSON.stringify(exportData));

console.log("Wrote _sample/sample.json and src/assets/sample/sample.json");
console.log("Profile:", s.profile.name);
console.log("  accounts:    ", s.profile.accounts.length);
console.log("  categories:  ", s.profile.categories.length);
console.log("  transactions:", s.profile.transactions.length);
console.log("  scheduled:   ", s.profile.scheduled.length);
console.log("  goals:       ", s.profile.goals.length);
console.log("  payees:      ", s.profile.payees.length);
console.log("  budgets:     ", Object.keys(s.profile.budgets).join(", "));
console.log("Ready to assign (May):", (s.readyToAssign() / 100).toFixed(2));
console.log("Net worth:           ", (s.netWorth() / 100).toFixed(2));
