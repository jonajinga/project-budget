/* Build a realistic sample profile.

   Writes two outputs:
     - src/assets/sample/sample.json — shipped with the build so first-time
       visitors auto-load it (see store.init -> loadSampleIfFirstVisit).
     - _sample/sample.json — a copy outside the build, useful for ad-hoc
       imports while developing.

   Covers the last 12 calendar months of posted transactions + scheduled
   templates spanning the next 3 months so every page in the app has
   meaningful data: month-grid calendar fills up, reports look realistic,
   credit-card payment pools have history, and goals show progress. */

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
const TODAY_YEAR  = 2026;
const TODAY_MONTH = 5;
const TODAY_DAY   = 15;
const CURRENT_MONTH = TODAY.slice(0, 7);

const s = createStore();
s.init();
const profile = s.createProfile("Sample Profile");
profile.settings = profile.settings || {};
profile.settings.isSample = true;
s.setMonth(CURRENT_MONTH);

/* ---- Account groups + accounts -------------------------------------- */
const gDaily    = s.addAccountGroup("Daily");
const gReserves = s.addAccountGroup("Reserves and debts");

const checking = s.addAccount({ name: "Checking",     type: "checking",            groupId: gDaily.id,    openingBalance:   320000 });
const savings  = s.addAccount({ name: "Savings",      type: "savings",             groupId: gReserves.id, openingBalance:   850000 });
const cash     = s.addAccount({ name: "Cash on hand", type: "cash",                groupId: gDaily.id,    openingBalance:     6000 });
const visa     = s.addAccount({ name: "Visa",         type: "credit",              groupId: gDaily.id,    openingBalance:   -85000 });
const auto     = s.addAccount({ name: "Auto loan",    type: "tracking-liability",  groupId: gReserves.id, openingBalance: -1850000 });
const i401k    = s.addAccount({ name: "401(k)",       type: "tracking-asset",      groupId: gReserves.id, openingBalance: 12500000 });

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
s.addGoal({ categoryId: catGroceries.id, type: "monthlyTopUp", target:  75000 });
s.addGoal({ categoryId: catVacation.id,  type: "targetByDate", target: 250000, byDate: "2026-08-31" });
s.addGoal({ categoryId: catSubs.id,      type: "refillUpTo",   target:   4500 });

/* ---- Helpers -------------------------------------------------------- */
const pad = (n) => String(n).padStart(2, "0");
const daysInMonth = (y, m) => new Date(y, m, 0).getDate();
const iso = (y, m, d) => y + "-" + pad(m) + "-" + pad(d);

/* Deterministic small variation so monthly amounts feel real without
   changing run-to-run. Returns base ± up to (pct * base), bucketed by
   year+month+salt so the same call site produces the same number every
   regen. */
function vary(base, y, m, salt, pct) {
  const seed = (Math.abs(y * 31 + m * 7 + salt) % 13) - 6;
  return Math.round(base + base * (seed / 6) * (pct || 0.12));
}

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

/* Range walk: [startYM, endYM] inclusive, calls fn(year, monthNum). */
function eachMonth(startY, startM, endY, endM, fn) {
  let y = startY, m = startM;
  while (y < endY || (y === endY && m <= endM)) {
    fn(y, m);
    m++;
    if (m > 12) { m = 1; y++; }
  }
}

/* Generate the recurring template-like transactions for one month.
   `maxDay` lets the partial CURRENT_MONTH stop at TODAY. */
function generateMonth(y, m, maxDay) {
  const last = Math.min(daysInMonth(y, m), maxDay || daysInMonth(y, m));
  /* Paycheck (1st + 15th). Reconciled-eligible. */
  if (last >= 1)  txn({ date: iso(y, m, 1),  payee: "Acme Industries", amount: 420000 });
  if (last >= 15) txn({ date: iso(y, m, 15), payee: "Acme Industries", amount: 420000 });

  /* Rent (2nd). */
  if (last >= 2) txn({ date: iso(y, m, 2), payee: "Riverside Apts", amount: -145000, cat: catRent.id });

  /* Utilities. PG&E always; Verizon starting Aug 2025. */
  if (last >= 4) txn({ date: iso(y, m, 4), payee: "PG&E", amount: vary(-10800, y, m, 1, 0.10), cat: catUtilities.id });
  if (last >= 5 && (y * 12 + m) >= (2025 * 12 + 8)) {
    txn({ date: iso(y, m, 5), payee: "Verizon", amount: -8500, cat: catUtilities.id });
  }

  /* Groceries (Trader Joe's, Whole Foods, Costco) — credit card. */
  if (last >=  7) txn({ date: iso(y, m,  7), payee: "Trader Joe's", amount: vary( -9000, y, m, 2, 0.20), cat: catGroceries.id, account: visa.id });
  if (last >= 12) txn({ date: iso(y, m, 12), payee: "Whole Foods",  amount: vary( -8000, y, m, 3, 0.18), cat: catGroceries.id, account: visa.id });
  if (last >= 19) txn({ date: iso(y, m, 19), payee: "Costco",       amount: vary(-20000, y, m, 4, 0.15), cat: catGroceries.id, account: visa.id });

  /* Gas. */
  if (last >=  9) txn({ date: iso(y, m,  9), payee: "Shell",   amount: vary(-5000, y, m, 5, 0.20), cat: catGas.id, account: visa.id });
  if (last >= 22) txn({ date: iso(y, m, 22), payee: "Chevron", amount: vary(-5000, y, m, 6, 0.20), cat: catGas.id, account: visa.id });

  /* Subs (Netflix 14th, Spotify 21st). */
  if (last >= 14) txn({ date: iso(y, m, 14), payee: "Netflix", amount: -1599, cat: catSubs.id, account: visa.id });
  if (last >= 21) txn({ date: iso(y, m, 21), payee: "Spotify", amount: -1199, cat: catSubs.id, account: visa.id });

  /* Fitness. */
  if (last >= 18) txn({ date: iso(y, m, 18), payee: "Equinox", amount: -22000, cat: catFitness.id });

  /* Dining out — 1-2 per month. */
  if (last >= 10) txn({ date: iso(y, m, 10), payee: "Sweetgreen", amount: vary(-1800, y, m, 7, 0.25), cat: catDining.id, account: visa.id });
  if (last >= 24) txn({ date: iso(y, m, 24), payee: "Tartine",    amount: vary(-3200, y, m, 8, 0.20), cat: catDining.id, account: visa.id });

  /* Household (Amazon). */
  if (last >= 27) txn({ date: iso(y, m, 27), payee: "Amazon", amount: vary(-9000, y, m, 9, 0.25), cat: catHousehold.id, account: visa.id });

  /* Insurance every 3rd month (March, June, September, December). */
  if (m % 3 === 0 && last >= 30) {
    txn({ date: iso(y, m, 30), payee: "AAA Insurance", amount: -42000, cat: catInsurance.id });
  }

  /* CC payment (transfer from checking) on the 25th. */
  if (last >= 25) {
    s.transfer({
      fromAccountId: checking.id, toAccountId: visa.id,
      amount: vary(75000, y, m, 10, 0.15), date: iso(y, m, 25),
      memo: "Pay down Visa",
    });
  }

  /* Monthly savings transfer on the 8th. */
  if (last >= 8) {
    s.transfer({
      fromAccountId: checking.id, toAccountId: savings.id,
      amount: 100000, date: iso(y, m, 8), memo: "Monthly savings",
    });
  }
}

/* ---- Twelve months of history (2025-06 → 2026-05 partial) ---------- */
eachMonth(2025, 6, 2026, 5, function (y, m) {
  const isCurrent = (y === TODAY_YEAR && m === TODAY_MONTH);
  generateMonth(y, m, isCurrent ? TODAY_DAY : null);
});

/* ---- Sprinkle special events for variety --------------------------- */
/* Summer vacation 2025 */
txn({ date: "2025-07-22", payee: "United Airlines", amount: -68000, cat: catVacation.id });
txn({ date: "2025-07-23", payee: "Marriott",        amount: -52000, cat: catVacation.id });
txn({ date: "2025-07-24", payee: "Concert tickets", amount: -12800, cat: catEntertain.id, account: visa.id });

/* Back-to-school / clothing */
txn({ date: "2025-08-23", payee: "Goodwill", amount: -4500,  cat: catClothing.id });
txn({ date: "2025-09-10", payee: "Nordstrom Rack", amount: -16800, cat: catClothing.id, account: visa.id });

/* Holiday season */
txn({ date: "2025-11-28", payee: "Best Buy",     amount: -28000, cat: catGifts.id,   account: visa.id, memo: "Black Friday" });
txn({ date: "2025-12-10", payee: "Etsy",         amount:  -6400, cat: catGifts.id,   account: visa.id });
txn({ date: "2025-12-15", payee: "Tree lot",     amount:  -8000, cat: catHousehold.id });
txn({ date: "2025-12-22", payee: "Mom's holiday gift", amount: -7500, cat: catGifts.id });

/* Winter Costco run + new year gear */
txn({ date: "2026-01-04", payee: "Hobby Lobby", amount:  -8700, cat: catHobby.id });
txn({ date: "2026-01-18", payee: "REI",         amount: -22500, cat: catHobby.id, account: visa.id, memo: "Trail gear" });

/* Spring maintenance */
txn({ date: "2026-04-17", payee: "Pep Boys",  amount: -18500, cat: catAutoMaint.id });
txn({ date: "2026-04-23", payee: "Walgreens", amount:  -3400, cat: catMedical.id });

/* Mother's day */
txn({ date: "2026-05-11", payee: "Mom's birthday", amount: -6000, cat: catGifts.id });

/* A split transaction (groceries + household at Target). */
const targetTxn = s.addTransaction({
  accountId: visa.id, date: "2026-05-13", payeeName: "Target",
  amount: -18450, cleared: true,
});
s.setSplits(targetTxn.id, [
  { categoryId: catGroceries.id, amount: -12000, memo: "groceries" },
  { categoryId: catHousehold.id, amount:  -6450, memo: "cleaning, paper goods" },
]);

/* ---- Reconciliation: lock everything posted through end of April --- */
s.applyReconcile(checking.id);

/* ---- Recurring schedules spanning the next 3 months --------------- */
/* Biweekly paycheck cadence — next two paydays then keep biweekly. */
s.addSchedule({
  template: { accountId: checking.id, payeeName: "Acme Industries", categoryId: null, amount: 420000, memo: "Paycheck" },
  frequency: "biweekly", nextDate: "2026-05-29",
});

/* Standard monthlies. */
s.addSchedule({
  template: { accountId: checking.id, payeeName: "Riverside Apts", categoryId: catRent.id, amount: -145000, memo: "Monthly rent" },
  frequency: "monthly", nextDate: "2026-06-02",
});
s.addSchedule({
  template: { accountId: checking.id, payeeName: "PG&E", categoryId: catUtilities.id, amount: -10800, memo: "Electric + gas" },
  frequency: "monthly", nextDate: "2026-06-04",
});
s.addSchedule({
  template: { accountId: checking.id, payeeName: "Verizon", categoryId: catUtilities.id, amount: -8500, memo: "Internet" },
  frequency: "monthly", nextDate: "2026-06-05",
});
s.addSchedule({
  template: { accountId: checking.id, payeeName: "Equinox", categoryId: catFitness.id, amount: -22000, memo: "Gym membership" },
  frequency: "monthly", nextDate: "2026-05-30",
});
s.addSchedule({
  template: { accountId: visa.id, payeeName: "Netflix", categoryId: catSubs.id, amount: -1599, memo: "Streaming" },
  frequency: "monthly", nextDate: "2026-06-14",
});

/* One that IS due today — surfaces in the register due queue. */
s.addSchedule({
  template: { accountId: visa.id, payeeName: "Spotify", categoryId: catSubs.id, amount: -1199, memo: "Streaming" },
  frequency: "monthly", nextDate: TODAY,
});

/* Custom frequency: quarterly therapy. */
s.addSchedule({
  template: { accountId: checking.id, payeeName: "Dr. Cohen", categoryId: catMedical.id, amount: -22000, memo: "Quarterly visit" },
  frequency: "custom", customInterval: 3, customUnit: "months", nextDate: "2026-07-08",
});

/* Annual property tax in the next 3 months window. */
s.addSchedule({
  template: { accountId: checking.id, payeeName: "County Treasurer", categoryId: catInsurance.id, amount: -180000, memo: "Property tax" },
  frequency: "yearly", nextDate: "2026-06-15",
});

/* Semi-annual auto insurance bump. */
s.addSchedule({
  template: { accountId: checking.id, payeeName: "AAA Insurance", categoryId: catInsurance.id, amount: -42000, memo: "Auto insurance" },
  frequency: "custom", customInterval: 6, customUnit: "months", nextDate: "2026-08-30",
});

/* ---- Assigned amounts — every historical month + current --------- */
function assign(catId, month, dollars) {
  s.assign(catId, month, Math.round(dollars * 100));
}

/* Baseline monthly plan. Applied to every history month with small
   per-month tweaks. Numbers are in dollars. */
/* Calibrated so total assigned ≈ monthly inflow (2 × $4,200 = $8,400),
   keeping Ready-to-Assign close to zero each month — the YNAB rule. */
const baselinePlan = {
  [catRent.id]:      1450,
  [catUtilities.id]:  280,
  [catGroceries.id]: 1100,
  [catGas.id]:        220,
  [catInsurance.id]:  400,
  [catAutoMaint.id]:  300,
  [catMedical.id]:    250,
  [catGifts.id]:      200,
  [catSubs.id]:       100,
  [catDining.id]:     450,
  [catFitness.id]:    220,
  [catHobby.id]:      250,
  [catClothing.id]:   200,
  [catVacation.id]:  2000,
  [catEntertain.id]:  300,
  [catHousehold.id]:  380,
};

eachMonth(2025, 6, 2026, 5, function (y, m) {
  const month = y + "-" + pad(m);
  Object.entries(baselinePlan).forEach(([catId, dollars]) => assign(catId, month, dollars));
  /* Bump groceries in months with bigger spending. */
  if (m === 12 || m === 7) assign(catGroceries.id, month, 700);
  /* Vacation push leading into summer. */
  if (m >= 5 && m <= 7) assign(catVacation.id, month, 650);
  /* Holiday gifts in November + December. */
  if (m === 11 || m === 12) assign(catGifts.id, month, 250);
});

/* Pay credit card payment category — keep the pool funded. */
const ccPaymentCat = s.profile.categories.find(c => c.name === "Visa payment");
if (ccPaymentCat) {
  eachMonth(2025, 6, 2026, 5, function (y, m) {
    assign(ccPaymentCat.id, y + "-" + pad(m), 700);
  });
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
console.log("  budgets:     ", Object.keys(s.profile.budgets).sort().join(", "));
console.log("Ready to assign (May):", (s.readyToAssign() / 100).toFixed(2));
console.log("Net worth:           ", (s.netWorth() / 100).toFixed(2));
