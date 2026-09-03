/* Build the bundled sample profile: the Castillo household.

   Writes two outputs:
     - src/assets/sample/sample.json  shipped with the build; loaded from
       the welcome wizard or the Profiles page (store.loadSampleProfile).
     - _sample/sample.json            pretty-printed copy outside the build.

   Coverage: five years of posted history (2021-09 through the anchor
   date) and eighteen months of plans past it (recurring templates,
   goals with dates, planned cuts, per-month notes, and the next two
   months assigned). The anchor date is fixed so regeneration is
   deterministic; store.loadSampleProfile shifts every date forward by
   whole months so the sample always reads as "now".

   The family: Evan (41) and Maya (39) Castillo, Westerville, Ohio.
   Sofia 14, Lucas 12, Nora 7, Theo 5. Evan is a mechanical engineer,
   Maya a registered nurse (part-time until 2024, full-time since).

   Modeling rules that keep the budget math honest in THIS app:
     - Paychecks are uncategorized inflows (that is what feeds Ready to
       Work). Net pay is deposited; payroll deductions are not modeled.
     - Tracking accounts (retirement, 529s, home, loans) carry
       uncategorized balance-change entries. The budget index ignores
       off-budget accounts, so these never touch Ready to Work.
     - Roth / 529 / brokerage contributions leave checking as
       categorized outflows (they are budgeted), and the receiving
       tracking account records the same money plus growth.
     - Credit cards are paid in full from checking except Jun-Nov 2022,
       when a balance was carried and interest charged.
     - Assignments are derived AFTER the transactions exist, so every
       month is funded from that month's real inflow. Overspending is
       covered except in a handful of months left red on purpose. */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createStore } from "../src/assets/js/store/store.js";
import { buildExport } from "../src/assets/js/io/export-json.js";
import { buildMonthIndex, buildBudgetTable, tableReadyToAssign, tableCategoryRow } from "../src/assets/js/domain/budget.js";
import { runningBalance } from "../src/assets/js/domain/accounts.js";

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

/* ---- Anchor ----------------------------------------------------------- */
const TODAY = process.env.PB_SAMPLE_TODAY || "2026-09-03";
const [TY, TM, TD] = TODAY.split("-").map(Number);
const CURRENT_MONTH = TODAY.slice(0, 7);
const FIRST_MONTH = "2021-09";
const LAST_PLAN_MONTH = "2028-03";

/* ---- Helpers ---------------------------------------------------------- */
const pad = (n) => String(n).padStart(2, "0");
const iso = (y, m, d) => y + "-" + pad(m) + "-" + pad(d);
const ym = (y, m) => y + "-" + pad(m);
const dim = (y, m) => new Date(y, m, 0).getDate();
const $ = (d) => Math.round(d * 100);
function addMonths(month, n) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return ym(d.getFullYear(), d.getMonth() + 1);
}
function addDays(dateISO, n) {
  const [y, m, d] = dateISO.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return iso(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}
function eachMonth(from, to, fn) {
  let cur = from;
  while (cur <= to) { const [y, m] = cur.split("-").map(Number); fn(y, m, cur); cur = addMonths(cur, 1); }
}
/* Value of the latest era whose start month <= month. eras: [["2021-09", v], ...] */
function era(month, eras) {
  let v = eras[0][1];
  for (const [start, val] of eras) if (start <= month) v = val;
  return v;
}

/* Deterministic PRNG so every regeneration is byte-identical. */
let seed = 20260903;
function rand() { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
const between = (a, b) => a + rand() * (b - a);
const irand = (a, b) => Math.floor(between(a, b + 1));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const chance = (p) => rand() < p;
/* Dollar amount with +-pct wobble, rounded to cents. */
const wob = (base, pct) => Math.round(base * between(1 - pct, 1 + pct) * 100) / 100;

/* ---- Store ------------------------------------------------------------ */
const s = createStore();
s.init();
s.pushToast = function () {};
const profile = s.createProfile("Sample household");
s._suppressUndo = true; /* undo deep-clones the whole profile per mutation */
profile.settings = profile.settings || {};
profile.settings.isSample = true;
profile.settings.currencyLabel = "USD";
profile.settings.sampleAnchor = TODAY;
profile.settings.sampleVersion = 3;
s.setMonth(CURRENT_MONTH);

/* ---- Accounts --------------------------------------------------------- */
const gEveryday = s.addAccountGroup("Everyday");
const gSavings  = s.addAccountGroup("Savings");
const gCards    = s.addAccountGroup("Credit cards");
const gLoans    = s.addAccountGroup("Loans");
const gRetire   = s.addAccountGroup("Retirement and investments");
const gCollege  = s.addAccountGroup("College savings (529)");

const A = {};
A.checking = s.addAccount({ name: "Huntington Checking", type: "checking", groupId: gEveryday.id, openingBalance: 0 });
A.oldChase = s.addAccount({ name: "Chase Checking (old)", type: "checking", groupId: gEveryday.id, openingBalance: 0 });
A.cash     = s.addAccount({ name: "Wallet cash", type: "cash", groupId: gEveryday.id, openingBalance: 0 });
A.ef       = s.addAccount({ name: "Ally Emergency Fund", type: "savings", groupId: gSavings.id, openingBalance: 0 });
A.house    = s.addAccount({ name: "Ally House Projects", type: "savings", groupId: gSavings.id, openingBalance: 0 });
A.visa     = s.addAccount({ name: "Chase Freedom Visa", type: "credit", groupId: gCards.id, openingBalance: $(-1180) });
A.amex     = s.addAccount({ name: "Amex Blue Cash", type: "credit", groupId: gCards.id, openingBalance: 0 });
A.target   = s.addAccount({ name: "Target RedCard", type: "credit", groupId: gCards.id, openingBalance: 0 });
A.home     = s.addAccount({ name: "Home value (Zestimate)", type: "tracking-asset", groupId: gLoans.id, openingBalance: $(342000) });
A.mortgage = s.addAccount({ name: "Mortgage (Rocket)", type: "tracking-liability", groupId: gLoans.id, openingBalance: $(-260500) });
A.auto     = s.addAccount({ name: "Odyssey loan (Honda Financial)", type: "tracking-liability", groupId: gLoans.id, openingBalance: $(-28000) });
A.student  = s.addAccount({ name: "Maya student loan (Nelnet)", type: "tracking-liability", groupId: gLoans.id, openingBalance: $(-18400) });
A.k401     = s.addAccount({ name: "Evan 401(k)", type: "tracking-asset", groupId: gRetire.id, openingBalance: $(118000) });
A.b403     = s.addAccount({ name: "Maya 403(b)", type: "tracking-asset", groupId: gRetire.id, openingBalance: $(41000) });
A.rothE    = s.addAccount({ name: "Evan Roth IRA", type: "tracking-asset", groupId: gRetire.id, openingBalance: $(27500) });
A.rothM    = s.addAccount({ name: "Maya Roth IRA", type: "tracking-asset", groupId: gRetire.id, openingBalance: $(19800) });
A.hsa      = s.addAccount({ name: "HSA", type: "tracking-asset", groupId: gRetire.id, openingBalance: $(3100) });
A.brok     = s.addAccount({ name: "Vanguard brokerage", type: "tracking-asset", groupId: gRetire.id, openingBalance: $(12400) });
A.s529a    = s.addAccount({ name: "Sofia 529", type: "tracking-asset", groupId: gCollege.id, openingBalance: $(14200), excludeFromNetWorth: true });
A.s529b    = s.addAccount({ name: "Lucas 529", type: "tracking-asset", groupId: gCollege.id, openingBalance: $(9800), excludeFromNetWorth: true });
A.s529c    = s.addAccount({ name: "Nora 529", type: "tracking-asset", groupId: gCollege.id, openingBalance: $(3600), excludeFromNetWorth: true });
A.s529d    = s.addAccount({ name: "Theo 529", type: "tracking-asset", groupId: gCollege.id, openingBalance: $(800), excludeFromNetWorth: true });

/* ---- Categories ------------------------------------------------------- */
const GROUPS = [
  ["Housing", ["Mortgage", "Electric", "Natural gas", "Water & sewer", "Trash pickup", "Internet", "Home maintenance", "Lawn & garden", "Kitchen remodel"]],
  ["Transportation", ["Car payment", "Gas", "Car insurance", "Car maintenance", "Registration & parking", "Next car fund"]],
  ["Food", ["Groceries", "Dining out", "Coffee & snacks", "School lunches"]],
  ["Kids", ["Childcare", "Before & after care", "Activities & sports", "Music lessons", "School fees & supplies", "Kids clothing & shoes", "Summer camps", "Allowance", "Babysitting", "Diapers & baby", "Birthdays"]],
  ["Health", ["Doctor & dentist", "Pharmacy", "Orthodontist", "Vision", "YMCA membership"]],
  ["Insurance", ["Life insurance", "Umbrella policy"]],
  ["Bills & subscriptions", ["Cell phones", "Streaming", "Software & memberships"]],
  ["Personal", ["Clothing", "Haircuts", "Personal care", "Woodworking (Evan)", "Running (Maya)", "Books & media"]],
  ["Household", ["Household supplies", "Amazon & misc"]],
  ["Pets", ["Pet food & supplies", "Vet"]],
  ["Giving", ["Church", "Donations"]],
  ["Gifts & celebrations", ["Gifts", "Christmas & holidays"]],
  ["Fun & travel", ["Vacation", "Entertainment", "Date night", "Family outings"]],
  ["Savings & investing", ["Emergency fund", "Roth IRA contributions", "College savings (529)", "Brokerage investing"]],
  ["Debt", ["Student loan", "Interest & fees"]],
  ["Taxes & fees", ["Tax prep & fees"]],
];
const C = {}; /* key = camel-ish slug of the name */
const keyOf = (name) => name.toLowerCase().replace(/\(.*?\)/g, "").replace(/&/g, " ").replace(/[^a-z0-9]+/g, " ").trim().split(" ").map((w, i) => i ? w[0].toUpperCase() + w.slice(1) : w).join("");
for (const [gname, cats] of GROUPS) {
  const g = s.addCategoryGroup(gname);
  for (const name of cats) C[keyOf(name)] = s.addCategory({ groupId: g.id, name });
}
const payCat = (acct) => s.profile.categories.find((c) => c.id === s.profile.settings.creditCardPaymentMap[acct.id]);
C.visaPay = payCat(A.visa); C.amexPay = payCat(A.amex); C.targetPay = payCat(A.target);

/* ---- Transaction queue ------------------------------------------------ */
const Q = [];
function tx(o) { Q.push(o); }
/* {date, acct, payee, cat, amount(dollars, signed), memo, splits:[{cat, amount, memo}]} */
function spend(date, acct, payee, cat, dollars, memo) { tx({ date, acct, payee, cat, amount: -Math.abs(dollars), memo }); }
function inflow(date, acct, payee, dollars, memo, cat) { tx({ date, acct, payee, cat: cat || null, amount: Math.abs(dollars), memo }); }
function xfer(date, from, to, dollars, memo) { tx({ date, transfer: true, from, to, amount: Math.abs(dollars), memo }); }
function split(date, acct, payee, parts, memo) { tx({ date, acct, payee, splits: parts, amount: -parts.reduce((a, p) => a + Math.abs(p.amount), 0), memo }); }
/* Tracking-account balance change (uncategorized; ignored by the budget). */
function track(date, acct, dollars, memo) { tx({ date, acct, payee: null, cat: null, amount: dollars, memo, tracking: true }); }

const inPast = (d) => d <= TODAY;

/* ---- Income ----------------------------------------------------------- */
const EVAN_NET = { 2021: 3150, 2022: 3280, 2023: 3420, 2024: 3560, 2025: 3700, 2026: 3850 }; /* biweekly, raise mid-March */
const MAYA_NET = { 2021: 1650, 2022: 1700, 2023: 1760, 2024: 2550, 2025: 2650, 2026: 2750 }; /* semi-monthly, raise in January */
function evanNet(date) { const y = +date.slice(0, 4); return date >= y + "-03-15" ? EVAN_NET[y] : (EVAN_NET[y - 1] || EVAN_NET[2021]); }

/* Starting balances (Sep 1 2021) as inflows so they feed Ready to Work. */
inflow("2021-09-01", A.checking, "Starting balance", 12500, "Balance when we started budgeting");
inflow("2021-09-01", A.oldChase, "Starting balance", 1300, "Old primary checking");
inflow("2021-09-01", A.ef, "Starting balance", 9500, "Emergency fund at Ally");
inflow("2021-09-01", A.cash, "Starting balance", 60, "");

/* Evan: every other Friday from 2021-09-03. Old Chase until Nov 2021. */
for (let d = "2021-09-03"; d <= TODAY; d = addDays(d, 14)) {
  inflow(d, d < "2021-11-01" ? A.oldChase : A.checking, "Buckeye Precision Manufacturing", evanNet(d), "Evan paycheck (net)");
}
/* Maya: 15th and 30th (28th in February). */
eachMonth(FIRST_MONTH, CURRENT_MONTH, (y, m, mo) => {
  const amt = MAYA_NET[y];
  const d15 = iso(y, m, 15), d30 = iso(y, m, Math.min(30, dim(y, m)));
  if (inPast(d15)) inflow(d15, A.checking, "Scioto Valley Health", amt, "Maya paycheck (net)");
  if (inPast(d30)) inflow(d30, A.checking, "Scioto Valley Health", amt, "Maya paycheck (net)");
  if (inPast(d30) && chance(0.22)) inflow(addDays(d30, -2), A.checking, "Scioto Valley Health", y >= 2024 ? 410 : 310, "Extra shift differential");
});
/* Bonus (March) and tax refunds. */
const BONUS = { 2022: 3800, 2023: 4200, 2024: 4500, 2025: 5000, 2026: 5500 };
const REFUND = { 2022: 4100, 2023: 2650, 2024: 2900, 2025: 2300, 2026: 3100 };
for (const y of [2022, 2023, 2024, 2025, 2026]) {
  inflow(iso(y, 3, 12), A.checking, "Buckeye Precision Manufacturing", BONUS[y], "Annual bonus (net)");
  inflow(iso(y, 3, 28), A.checking, "IRS", REFUND[y], "Federal refund");
  inflow(iso(y, 4, 6), A.checking, "Ohio Dept of Taxation", 180 + (y - 2022) * 45, "State refund");
}
/* Savings interest, quarterly, on the emergency fund (real cash: goes to RTA). */
const APY = (mo) => era(mo, [["2021-09", 0.005], ["2022-07", 0.015], ["2022-12", 0.03], ["2023-06", 0.042], ["2024-10", 0.039], ["2025-04", 0.036]]);
/* Interest amounts are computed after the EF transfers exist (see below). */

/* ---- Recurring bills -------------------------------------------------- */
const ESCROW = { 2021: 585, 2022: 610, 2023: 640, 2024: 690, 2025: 720, 2026: 745 };
const PI = 1144.40;
/* Auto loan: 60 payments from Sep 2021 at 4.9% on $28,000. */
const AUTO_R = 0.049 / 12;
const AUTO_PMT = Math.round(28000 * AUTO_R / (1 - Math.pow(1 + AUTO_R, -60)) * 100) / 100; /* 527.xx */
let mortBal = 260500, autoBal = 28000, studBal = 18400;
const CHILDCARE = (mo) => era(mo, [["2021-09", 880], ["2021-11", 2130], ["2022-01", 2220], ["2023-01", 2170], ["2024-01", 2240], ["2024-09", 1340], ["2025-01", 1395], ["2026-01", 1450], ["2026-09", 0]]);
const PHONES = (mo) => era(mo, [["2021-09", 155], ["2023-09", 185], ["2025-09", 215]]);
const INTERNET = (mo) => era(mo, [["2021-09", 74.99], ["2023-01", 84.99], ["2025-01", 89.99]]);
const CHURCH = (mo) => era(mo, [["2021-09", 150], ["2024-01", 250], ["2026-01", 300]]);
const YMCA = (mo) => era(mo, [["2022-01", 89], ["2024-01", 96], ["2026-01", 104]]);
const CAR_INS = (y) => ({ 2021: 1140, 2022: 1290, 2023: 1420, 2024: 1560, 2025: 1610, 2026: 1650 })[y];
const NETFLIX = (mo) => era(mo, [["2021-09", 15.49], ["2024-01", 17.99], ["2025-04", 20.99]]);
const DISNEY = (mo) => era(mo, [["2021-09", 7.99], ["2023-01", 13.99], ["2025-01", 15.99]]);
const SPOTIFY = (mo) => era(mo, [["2021-09", 15.99], ["2024-06", 19.99]]);
const ICLOUD = (mo) => era(mo, [["2021-09", 2.99], ["2023-03", 9.99]]);
const GASPRICE = (mo) => era(mo, [["2021-09", 3.15], ["2022-03", 3.95], ["2022-06", 4.45], ["2022-09", 3.65], ["2023-01", 3.30], ["2023-08", 3.65], ["2024-01", 3.05], ["2024-06", 3.35], ["2025-01", 2.95], ["2025-06", 3.10], ["2026-01", 2.95], ["2026-06", 3.15]]);
const infl = (base, mo) => base * Math.pow(1.035, (+mo.slice(0, 4) - 2021) + (+mo.slice(5) - 9) / 12);

const GROCERY_PAYEES = ["Kroger", "Kroger", "Kroger", "Aldi", "Meijer", "Giant Eagle"];
const cardFor = (mo) => (mo >= "2023-02" ? (chance(0.5) ? A.amex : A.visa) : A.visa);
const targetCard = (mo) => (mo >= "2024-08" ? A.target : cardFor(mo));

let cashNeeded = 0; /* per-month cash spend, funded by an ATM withdrawal */
function cashSpend(date, payee, cat, dollars, memo) { spend(date, A.cash, payee, cat, dollars, memo); cashNeeded += dollars; }

function genMonth(y, m) {
  const mo = ym(y, m);
  const last = mo === CURRENT_MONTH ? TD : dim(y, m);
  const D = (d) => d <= last ? iso(y, m, d) : null;
  const on = (d, fn) => { const dt = D(d); if (dt) fn(dt); };
  const school = m >= 9 || m <= 5;
  cashNeeded = 0;

  /* Housing */
  on(1, (d) => {
    spend(d, A.checking, "Rocket Mortgage", C.mortgage.id, PI + ESCROW[y], "P&I + escrow");
    const interest = mortBal * 0.031 / 12; const principal = PI - interest; mortBal -= principal;
    track(d, A.mortgage, Math.round(principal * 100) / 100, "Principal portion of payment");
  });
  on(8, (d) => spend(d, A.checking, "AEP Ohio", C.electric.id, wob(infl([105, 100, 110, 118, 128, 148, 172, 176, 150, 120, 108, 112][m - 1], mo), 0.08), ""));
  on(11, (d) => spend(d, A.checking, "Columbia Gas of Ohio", C.naturalGas.id, wob(infl([185, 168, 128, 82, 48, 34, 31, 31, 36, 62, 118, 172][m - 1], mo), 0.1), ""));
  if (m % 3 === 0) on(14, (d) => spend(d, A.checking, "City of Westerville Utilities", C.waterSewer.id, wob(infl(162, mo), 0.06), "Quarterly water/sewer"));
  if (m % 3 === 1) on(3, (d) => spend(d, A.checking, "Rumpke", C.trashPickup.id, y >= 2024 ? 78 : 72, "Quarterly trash"));
  on(18, (d) => spend(d, A.visa, "Spectrum", C.internet.id, INTERNET(mo), "Internet"));
  if (chance(0.5)) on(irand(4, 27), (d) => spend(d, cardFor(mo), pick(["Home Depot", "Lowe's", "Ace Hardware"]), C.homeMaintenance.id, wob(infl(85, mo), 0.6), ""));
  if (m === 4 || m === 10) on(irand(5, 20), (d) => spend(d, A.checking, "Comfort Air Heating & Cooling", C.homeMaintenance.id, y >= 2024 ? 149 : 129, "HVAC tune-up"));
  if (m === 10) on(24, (d) => spend(d, A.checking, "Gutter Guys", C.homeMaintenance.id, 180, "Gutter cleaning"));
  if (m >= 4 && m <= 10 && chance(0.6)) on(irand(3, 25), (d) => spend(d, cardFor(mo), pick(["Lowe's", "Oakland Nursery", "Home Depot"]), C.lawnGarden.id, wob(infl(48, mo), 0.5), ""));

  /* Transportation */
  if (mo <= "2026-08") on(15, (d) => {
    const interest = autoBal * AUTO_R; let principal = AUTO_PMT - interest;
    if (mo === "2026-08") principal = autoBal; /* final payment clears it */
    const pmt = mo === "2026-08" ? Math.round((principal + interest) * 100) / 100 : AUTO_PMT;
    autoBal = Math.max(0, autoBal - principal);
    spend(d, A.checking, "Honda Financial Services", C.carPayment.id, pmt, mo === "2026-08" ? "Final payment - paid off!" : "Odyssey loan");
    track(d, A.auto, Math.round(principal * 100) / 100, "Principal portion of payment");
  });
  const fills = irand(2, 3);
  for (let i = 0; i < fills; i++) on(irand(1, 28), (d) => spend(d, cardFor(mo), pick(["Kroger Fuel", "Speedway", "Costco Gas", "Shell"]), C.gas.id, Math.round(GASPRICE(mo) * between(14, 20) * 100) / 100, ""));
  if (m === 5 || m === 11) on(5, (d) => spend(d, A.checking, "Progressive", C.carInsurance.id, CAR_INS(y) / 2, "6-month premium"));
  if (m % 4 === 1) on(irand(6, 24), (d) => spend(d, cardFor(mo), "Valvoline Instant Oil Change", C.carMaintenance.id, wob(infl(64, mo), 0.15), "Oil change"));
  if (m === 8) on(12, (d) => spend(d, A.checking, "Ohio BMV", C.registrationParking.id, 86, "Odyssey registration"));
  if (m === 11) on(9, (d) => spend(d, A.checking, "Ohio BMV", C.registrationParking.id, 58, "Civic registration"));
  if (chance(0.3)) on(irand(2, 26), (d) => spend(d, cardFor(mo), pick(["ParkMobile", "Ohio Turnpike E-ZPass"]), C.registrationParking.id, wob(9, 0.5), ""));

  /* Food */
  const gBase = infl(era(mo, [["2021-09", 1000], ["2024-01", 1180], ["2025-01", 1240]]), mo) / Math.pow(1.035, +mo.slice(0, 4) - 2021 + (+mo.slice(5) - 9) / 12) ; /* plan-ish base, inflation applied below */
  const gMonth = infl(era(mo, [["2021-09", 960], ["2022-06", 1020], ["2024-01", 1120], ["2025-01", 1180]]), mo) * between(0.93, 1.07);
  const trips = irand(4, 5);
  for (let i = 0; i < trips; i++) on(Math.min(last, 2 + i * Math.floor(28 / trips) + irand(0, 3)), (d) => spend(d, cardFor(mo), pick(GROCERY_PAYEES), C.groceries.id, Math.round(gMonth / trips * between(0.7, 1.3) * 100) / 100, ""));
  if (m >= 5 && m <= 10 && chance(0.6)) on(irand(3, 26), (d) => cashSpend(d, "Uptown Westerville Farmers Market", C.groceries.id, wob(31, 0.4), ""));
  const dines = irand(2, 3);
  for (let i = 0; i < dines; i++) on(irand(1, 28), (d) => spend(d, cardFor(mo), pick(["Chipotle", "Chick-fil-A", "Donatos Pizza", "Panera Bread", "Culver's", "Olive Garden", "Skyline Chili"]), C.diningOut.id, wob(infl(46, mo), 0.45), ""));
  on(irand(1, 28), (d) => spend(d, cardFor(mo), pick(["Starbucks", "Tim Hortons", "Dunkin'"]), C.coffeeSnacks.id, wob(11, 0.5), ""));
  if (school) on(irand(2, 9), (d) => spend(d, A.checking, "Westerville City Schools - lunch account", C.schoolLunches.id, era(mo, [["2021-09", 65], ["2024-09", 105], ["2026-09", 135]]) * between(0.85, 1.15), "PayForIt lunch deposit"));

  /* Kids */
  if (CHILDCARE(mo)) on(1, (d) => spend(d, A.checking, "Little Sprouts Learning Center", C.childcare.id, CHILDCARE(mo), mo < "2024-09" ? "Nora + Theo" : "Theo"));
  if (mo >= "2024-09" && school) on(1, (d) => spend(d, A.checking, "YMCA of Central Ohio", C.beforeAfterCare.id, 185, "Nora before/after care"));
  if (m === 8 || m === 2) on(irand(3, 20), (d) => spend(d, A.checking, "Westerville Youth Soccer", C.activitiesSports.id, era(mo, [["2021-09", 165], ["2024-01", 185]]), "Sofia soccer season"));
  if (mo >= "2023-09" && school) on(irand(1, 8), (d) => spend(d, A.checking, "Dance Elite Westerville", C.activitiesSports.id, 68, "Nora dance"));
  if (mo >= "2023-09" && m >= 9 || mo >= "2023-09" && m <= 3) on(irand(1, 6), (d) => spend(d, A.checking, "YMCA swim team", C.activitiesSports.id, 110, "Lucas swim"));
  if (mo >= "2026-04" && m >= 4 && m <= 6) on(irand(2, 10), (d) => spend(d, A.checking, "Westerville Little League", C.activitiesSports.id, 75, "Theo T-ball"));
  if (mo >= "2023-01") for (let d = 3 + ((y * 12 + m) % 7); d <= 28; d += 7) on(d, (dt) => spend(dt, A.checking, "Ms. Alvarez Piano Studio", C.musicLessons.id, y >= 2025 ? 40 : 35, "Sofia piano lesson"));
  if (m === 8) {
    const kidsInSchool = era(mo, [["2021-09", 2], ["2024-09", 3], ["2026-09", 4]]);
    on(18, (d) => spend(d, A.checking, "Westerville City Schools", C.schoolFeesSupplies.id, 95 * kidsInSchool, "School fees"));
    on(irand(6, 22), (d) => split(d, targetCard(mo), "Target", [{ cat: C.schoolFeesSupplies.id, amount: -wob(infl(140, mo), 0.3), memo: "School supplies" }, { cat: C.kidsClothingShoes.id, amount: -wob(infl(180, mo), 0.3), memo: "Back-to-school clothes" }], "Back to school run"));
    on(irand(8, 24), (d) => spend(d, cardFor(mo), "Famous Footwear", C.kidsClothingShoes.id, wob(infl(120, mo), 0.3), "School shoes"));
  }
  if (m === 3) on(irand(5, 20), (d) => spend(d, A.checking, "Westerville City Schools", C.schoolFeesSupplies.id, 32, "Yearbook"));
  if (chance(0.3)) on(irand(1, 28), (d) => spend(d, pick([targetCard(mo), cardFor(mo)]), pick(["Old Navy", "Target", "Kohl's", "Carter's"]), C.kidsClothingShoes.id, wob(infl(48, mo), 0.5), ""));
  if ((m === 6 || m === 7) && y >= 2022) on(irand(1, 12), (d) => spend(d, A.checking, pick(["YMCA Camp Willson", "Columbus Zoo summer camp", "Westerville Parks & Rec camp"]), C.summerCamps.id, ({ 2022: 320, 2023: 445, 2024: 630, 2025: 770, 2026: 860 })[y], "Summer camp week"));
  for (let d = 5 + ((y + m) % 7); d <= 28; d += 7) on(d, (dt) => cashSpend(dt, "Allowance", C.allowance.id, era(mo, [["2021-09", 18], ["2023-01", 24], ["2025-01", 30]]), "Sofia / Lucas / Nora"));
  if (chance(0.5)) on(irand(6, 27), (d) => cashSpend(d, "Babysitter (Emma)", C.babysitting.id, wob(infl(58, mo), 0.3), "Date night sitter"));
  if (mo <= "2023-06") on(irand(2, 20), (d) => spend(d, cardFor(mo), pick(["Amazon", "Target", "Costco"]), C.diapersBaby.id, wob(infl(105, mo), 0.3), "Diapers / wipes / formula"));
  const BDAYS = { 1: ["Evan", 22], 3: ["Sofia", 14], 6: ["Lucas", 5], 7: ["Maya", 9], 4: ["Theo", 18] };
  if (BDAYS[m]) on(Math.min(28, BDAYS[m][1]), (d) => spend(d, cardFor(mo), pick(["Amazon", "Target", "Party City", "Chuck E. Cheese", "Sky Zone"]), C.birthdays.id, wob(infl(BDAYS[m][0] === "Evan" || BDAYS[m][0] === "Maya" ? 95 : 165, mo), 0.35), BDAYS[m][0] + "'s birthday"));
  if (m === 1) on(28, (d) => spend(d, cardFor(mo), "Amazon", C.birthdays.id, wob(infl(140, mo), 0.3), "Nora's birthday (Jan 30)"));

  /* Health */
  if (chance(0.55)) on(irand(2, 26), (d) => spend(d, A.checking, pick(["Westerville Pediatrics", "Ohio Health Family Medicine", "Westerville Family Dental"]), C.doctorDentist.id, pick([25, 30, 40, 45, 60, 120]), "Copay"));
  on(irand(1, 28), (d) => spend(d, cardFor(mo), pick(["CVS Pharmacy", "Kroger Pharmacy"]), C.pharmacy.id, wob(infl(24, mo), 0.6), ""));
  if (mo >= "2024-03" && mo <= "2026-02") on(6, (d) => spend(d, A.checking, "Smile Doctors Orthodontics", C.orthodontist.id, 185, "Sofia braces"));
  if (mo >= "2026-07") on(6, (d) => spend(d, A.checking, "Smile Doctors Orthodontics", C.orthodontist.id, 195, "Lucas braces"));
  if (m === 9) on(irand(8, 25), (d) => spend(d, cardFor(mo), "Costco Optical", C.vision.id, wob(infl(290, mo), 0.3), "Glasses"));
  if (mo < "2022-01") on(20, (d) => spend(d, A.oldChase.closedAt ? A.checking : (mo < "2021-11" ? A.oldChase : A.checking), "Planet Fitness", C.ymcaMembership.id, 24.99, "Evan gym"));
  else on(1, (d) => spend(d, A.checking, "YMCA of Central Ohio", C.ymcaMembership.id, YMCA(mo), "Family membership"));

  /* Insurance + bills */
  on(5, (d) => spend(d, A.checking, "Banner Life", C.lifeInsurance.id, 99.60, "Term life, Evan + Maya"));
  if (m === 9) on(16, (d) => spend(d, A.checking, "State Farm", C.umbrellaPolicy.id, y >= 2024 ? 285 : 265, "Umbrella policy (annual)"));
  on(20, (d) => spend(d, A.checking, "T-Mobile", C.cellPhones.id, PHONES(mo), "Family plan"));
  on(3, (d) => spend(d, A.visa, "Netflix", C.streaming.id, NETFLIX(mo), ""));
  on(12, (d) => spend(d, A.visa, "Disney+", C.streaming.id, DISNEY(mo), ""));
  on(21, (d) => spend(d, A.visa, "Spotify", C.streaming.id, SPOTIFY(mo), "Family plan"));
  on(9, (d) => spend(d, A.visa, "Apple", C.softwareMemberships.id, ICLOUD(mo), "iCloud+"));
  if (mo >= "2024-01") on(17, (d) => spend(d, A.visa, "Microsoft", C.softwareMemberships.id, 14.99, "Xbox Game Pass (Lucas)"));
  if (m === 2) on(15, (d) => spend(d, A.visa, "Amazon", C.softwareMemberships.id, y >= 2022 ? 139 : 119, "Prime annual"));
  if (m === 9) on(2, (d) => spend(d, mo >= "2023-02" ? A.amex : A.visa, "Costco", C.softwareMemberships.id, y >= 2024 ? 65 : 60, "Membership renewal"));

  /* Personal */
  if (chance(0.5)) on(irand(1, 28), (d) => spend(d, cardFor(mo), pick(["Kohl's", "Old Navy", "Amazon", "Nordstrom Rack", "Marshalls"]), C.clothing.id, wob(infl(72, mo), 0.55), ""));
  if ((y * 12 + m) % 5 === 0) on(irand(2, 26), (d) => spend(d, cardFor(mo), "Great Clips", C.haircuts.id, y >= 2024 ? 32 : 28, "Evan"));
  if ((y * 12 + m) % 2 === 0) on(irand(3, 27), (d) => spend(d, cardFor(mo), "Salon Lofts", C.haircuts.id, y >= 2024 ? 110 : 95, "Maya"));
  if (chance(0.4)) on(irand(1, 28), (d) => spend(d, cardFor(mo), "Great Clips", C.haircuts.id, y >= 2024 ? 44 : 36, "Kids x2"));
  if (chance(0.6)) on(irand(1, 28), (d) => spend(d, pick([targetCard(mo), cardFor(mo)]), pick(["CVS", "Ulta Beauty", "Target"]), C.personalCare.id, wob(infl(38, mo), 0.5), ""));
  if (chance(0.5)) on(irand(1, 28), (d) => spend(d, cardFor(mo), pick(["Rockler Woodworking", "Home Depot", "Woodcraft"]), C.woodworking.id, wob(infl(68, mo), 0.7), ""));
  if (m === 10) on(irand(10, 20), (d) => spend(d, A.checking, "Columbus Marathon", C.running.id, y >= 2024 ? 125 : 110, "Half marathon entry"));
  if (m === 4) on(irand(20, 28), (d) => spend(d, A.checking, "Cap City Half Marathon", C.running.id, 85, "Race entry"));
  if (m === 3 || m === 9) on(irand(2, 25), (d) => spend(d, cardFor(mo), "Fleet Feet Columbus", C.running.id, wob(infl(138, mo), 0.15), "Running shoes"));
  if (chance(0.4)) on(irand(1, 28), (d) => spend(d, cardFor(mo), pick(["Amazon", "Half Price Books", "Kindle Store", "Barnes & Noble"]), C.booksMedia.id, wob(infl(22, mo), 0.6), ""));

  /* Household + Amazon */
  on(irand(3, 25), (d) => split(d, mo >= "2024-08" ? A.target : cardFor(mo), "Target", [{ cat: C.groceries.id, amount: -wob(infl(62, mo), 0.4), memo: "" }, { cat: C.householdSupplies.id, amount: -wob(infl(58, mo), 0.4), memo: "cleaning, paper goods" }], ""));
  on(irand(4, 26), (d) => split(d, mo >= "2023-02" ? A.amex : A.visa, "Costco", [{ cat: C.groceries.id, amount: -wob(infl(165, mo), 0.3), memo: "bulk food" }, { cat: C.householdSupplies.id, amount: -wob(infl(48, mo), 0.5), memo: "" }], "Monthly Costco run"));
  for (let i = 0; i < irand(1, 2); i++) on(irand(1, 28), (d) => spend(d, cardFor(mo), "Amazon", C.amazonMisc.id, wob(infl(34, mo), 0.7), ""));

  /* Pets (Biscuit, adopted April 2023) */
  if (mo === "2023-04") { spend("2023-04-15", A.checking, "Franklin County Dog Shelter", C.petFoodSupplies.id, 95, "Adopted Biscuit!"); spend("2023-04-15", A.visa, "PetSmart", C.petFoodSupplies.id, 212.40, "Crate, leash, bowls, food"); spend("2023-04-22", A.checking, "Banfield Pet Hospital", C.vet.id, 240, "First visit + shots"); }
  if (mo >= "2023-05") {
    if ((y * 12 + m) % 3 !== 1 || chance(0.5)) on(irand(1, 27), (d) => spend(d, A.visa, "Chewy", C.petFoodSupplies.id, wob(61, 0.1), "Dog food"));
    if (m === 5) on(irand(5, 20), (d) => spend(d, A.checking, "Banfield Pet Hospital", C.vet.id, y >= 2025 ? 215 : 185, "Annual exam + vaccines"));
    if (m === 4 || m === 10) on(irand(2, 20), (d) => spend(d, A.visa, "Chewy", C.vet.id, 78, "Flea/tick/heartworm"));
  }

  /* Giving */
  on(3, (d) => spend(d, A.checking, "Grace Community Church", C.church.id, CHURCH(mo), "Monthly giving"));
  if (m === 11) on(28, (d) => spend(d, A.checking, "Mid-Ohio Food Collective", C.donations.id, y >= 2024 ? 200 : 150, "Giving Tuesday"));
  if (m === 10) on(irand(5, 20), (d) => spend(d, A.checking, "Westerville PTA", C.donations.id, 75, "Fall fundraiser"));
  if (m === 2) on(irand(8, 24), (d) => cashSpend(d, "Girl Scouts", C.donations.id, 32, "Cookies"));
  if (m === 12) on(irand(8, 20), (d) => spend(d, A.checking, "St. Jude", C.donations.id, 100, ""));

  /* Gifts + Christmas */
  if (chance(0.5)) on(irand(1, 28), (d) => spend(d, cardFor(mo), pick(["Amazon", "Target", "Etsy"]), C.gifts.id, wob(infl(48, mo), 0.6), "Gift"));
  if (m === 10) on(12, (d) => spend(d, A.amex.closedAt ? A.visa : (mo >= "2023-02" ? A.amex : A.visa), "The Refectory", C.gifts.id, wob(infl(140, mo), 0.15), "Anniversary dinner"));
  if (m === 5) on(irand(6, 12), (d) => spend(d, cardFor(mo), "1-800-Flowers", C.gifts.id, 64.99, "Mother's Day"));
  if (m === 6 || m === 12) on(irand(1, 14), (d) => spend(d, cardFor(mo), "Amazon", C.gifts.id, 60, "Teacher gifts"));
  if (m === 11) on(irand(25, 28), (d) => spend(d, cardFor(mo), pick(["Best Buy", "Amazon", "Target"]), C.christmasHolidays.id, wob(infl(420, mo), 0.3), "Black Friday"));
  if (m === 12) { on(irand(2, 12), (d) => spend(d, cardFor(mo), "Amazon", C.christmasHolidays.id, wob(infl(520, mo), 0.25), "Christmas gifts")); on(irand(6, 18), (d) => spend(d, targetCard(mo), "Target", C.christmasHolidays.id, wob(infl(380, mo), 0.25), "Christmas gifts")); on(irand(10, 20), (d) => spend(d, cardFor(mo), "LEGO Store", C.christmasHolidays.id, wob(infl(140, mo), 0.3), "")); on(irand(4, 10), (d) => cashSpend(d, "Christmas tree farm", C.christmasHolidays.id, y >= 2024 ? 95 : 80, "Tree")); }
  if (m === 10) on(irand(15, 28), (d) => spend(d, targetCard(mo), "Target", C.christmasHolidays.id, wob(infl(88, mo), 0.3), "Halloween costumes"));
  if (m === 4) on(irand(1, 15), (d) => spend(d, targetCard(mo), "Target", C.christmasHolidays.id, wob(infl(55, mo), 0.3), "Easter baskets"));

  /* Fun */
  if (chance(0.45)) on(irand(1, 28), (d) => spend(d, cardFor(mo), pick(["AMC Theatres", "Marcus Crosswoods Cinema", "Magic Mountain Fun Center", "Sequoia Pro Bowl"]), C.entertainment.id, wob(infl(54, mo), 0.4), ""));
  if (m === 3) on(irand(2, 20), (d) => spend(d, A.checking, "Columbus Zoo and Aquarium", C.entertainment.id, y >= 2024 ? 209 : 189, "Family membership"));
  if (m === 7 && (y === 2023 || y === 2025)) on(irand(8, 24), (d) => spend(d, cardFor(mo), "Cedar Point", C.entertainment.id, 386, "Day trip"));
  if (chance(0.7)) on(irand(1, 28), (d) => spend(d, mo >= "2023-02" ? A.amex : A.visa, pick(["Cameron Mitchell - Marcella's", "Northstar Cafe", "Hofbrauhaus Columbus", "The Pearl", "Condado Tacos"]), C.dateNight.id, wob(infl(86, mo), 0.35), "Date night"));
  if (chance(0.5)) on(irand(1, 28), (d) => spend(d, cardFor(mo), pick(["COSI", "Franklin Park Conservatory", "Lynd Fruit Farm", "Rec center pool", "Columbus Clippers"]), C.familyOutings.id, wob(infl(52, mo), 0.5), ""));
  if (m === 6 && y >= 2023) on(irand(1, 8), (d) => spend(d, A.checking, "Westerville Parks & Rec", C.familyOutings.id, y >= 2025 ? 240 : 220, "Family pool pass"));

  /* Savings + investing outflows (categorized: they are budgeted) */
  const rothE = era(mo, [["2021-09", 250], ["2024-01", 300], ["2026-01", 350]]);
  const rothM = era(mo, [["2021-09", 0], ["2024-01", 250]]);
  on(2, (d) => spend(d, A.checking, "Vanguard", C.rothIraContributions.id, rothE, "Evan Roth IRA"));
  if (rothM) on(2, (d) => spend(d, A.checking, "Fidelity", C.rothIraContributions.id, rothM, "Maya Roth IRA"));
  on(10, (d) => spend(d, A.checking, "Ohio 529 CollegeAdvantage", C.collegeSavings.id, era(mo, [["2021-09", 200], ["2024-01", 500]]), "4 x monthly"));
  if (m === 3 && y >= 2022) on(20, (d) => spend(d, A.checking, "Vanguard", C.brokerageInvesting.id, ({ 2022: 1500, 2023: 2000, 2024: 2500, 2025: 3000, 2026: 3500 })[y], "Bonus to brokerage"));

  /* Debt */
  if (mo >= "2023-10") on(12, (d) => { const interest = studBal * 0.055 / 12; const principal = 210 - interest; studBal -= principal; spend(d, A.checking, "Nelnet", C.studentLoan.id, 210, "Maya student loan"); track(d, A.student, Math.round(principal * 100) / 100, "Principal portion of payment"); });

  /* Taxes */
  if (m === 4) on(irand(3, 14), (d) => spend(d, A.checking, "TurboTax", C.taxPrepFees.id, y >= 2024 ? 129 : 89, "Federal + state filing"));

  /* Cash: fund the month's cash spend with an ATM withdrawal on the 2nd. */
  const draw = Math.ceil((cashNeeded + 10) / 20) * 20;
  if (draw > 0) on(2, (d) => xfer(d, A.checking, A.cash, draw, "ATM"));
}

eachMonth(FIRST_MONTH, CURRENT_MONTH, (y, m) => genMonth(y, m));

/* ---- One-off events --------------------------------------------------- */
/* Old checking wound down and closed. */
xfer("2021-10-29", A.oldChase, A.checking, 2400, "Moving to Huntington");
xfer("2022-03-15", A.oldChase, A.checking, 1131.02, "Closing balance to Huntington");
spend("2022-03-15", A.oldChase, "Chase", C.taxPrepFees.id, 12, "Monthly service fee (last one)");
/* Vacations */
const VAC = [
  ["2022-06", [["Vrbo", 1850, 6, "Hilton Head beach house"], ["Shell", 96, 11, "Road trip fuel"], ["Salty Dog Cafe", 142, 14, ""], ["Publix", 210, 12, "Groceries at the beach"], ["Dolphin tour", 180, 15, ""]]],
  ["2023-07", [["Vrbo", 1420, 8, "Smoky Mountains cabin"], ["Dollywood", 486, 12, ""], ["Shell", 88, 9, ""], ["Kroger Pigeon Forge", 165, 10, ""], ["Ole Smoky Distillery", 64, 13, ""]]],
  ["2024-03", [["Southwest Airlines", 1180, 2, "Flights to Orlando"], ["Hilton Orlando", 1650, 22, "5 nights"], ["Universal Orlando", 980, 24, "Park tickets"], ["Uber", 96, 23, ""], ["Publix", 140, 23, ""], ["Bubba Gump Shrimp", 168, 25, ""]]],
  ["2025-06", [["Airbnb", 1680, 14, "Lake Michigan house"], ["Speedway", 110, 14, ""], ["Meijer", 245, 15, ""], ["Sleeping Bear Dunes", 45, 17, "Park pass"], ["Moomers Ice Cream", 42, 18, ""]]],
  ["2026-06", [["Vrbo", 2150, 13, "Outer Banks house"], ["Shell", 124, 13, ""], ["Food Lion", 290, 14, ""], ["Hatteras ferry", 30, 16, ""], ["Kill Devil Grill", 176, 18, ""]]],
];
for (const [mo, items] of VAC) for (const [payee, amt, day, memo] of items) spend(mo + "-" + pad(day), mo >= "2023-02" ? A.amex : A.visa, payee, C.vacation.id, amt, memo);
/* Big maintenance + repairs */
spend("2022-01-14", A.checking, "Comfort Air Heating & Cooling", C.homeMaintenance.id, 480, "Furnace igniter replaced");
spend("2022-08-19", A.checking, "Midas", C.carMaintenance.id, 920, "Civic transmission service");
spend("2023-04-11", A.visa, "Discount Tire", C.carMaintenance.id, 780, "Odyssey tires");
spend("2024-11-08", A.checking, "Hendrix Plumbing", C.homeMaintenance.id, 1650, "Water heater replaced");
spend("2025-06-20", A.checking, "Midas", C.carMaintenance.id, 640, "Odyssey brakes");
spend("2026-02-03", A.checking, "Comfort Air Heating & Cooling", C.homeMaintenance.id, 310, "Blower motor");
/* Kitchen remodel (Feb-Apr 2025), funded from the House Projects account. */
xfer("2025-02-03", A.house, A.checking, 9000, "Kitchen: deposit");
spend("2025-02-04", A.checking, "Kessler Kitchen & Bath", C.kitchenRemodel.id, 8500, "Deposit: cabinets + counters");
xfer("2025-03-10", A.house, A.checking, 6400, "Kitchen: progress payment");
spend("2025-03-11", A.checking, "Kessler Kitchen & Bath", C.kitchenRemodel.id, 6200, "Progress payment");
spend("2025-03-22", A.visa, "Lowe's", C.kitchenRemodel.id, 2890, "Appliances");
xfer("2025-04-14", A.house, A.checking, 3400, "Kitchen: final");
spend("2025-04-15", A.checking, "Kessler Kitchen & Bath", C.kitchenRemodel.id, 3400, "Final payment");
/* A few positive category inflows (refunds / reimbursements). */
inflow("2023-08-14", A.checking, "Costco", 36.99, "Return", C.householdSupplies.id);
inflow("2024-04-19", A.checking, "Grandma Rosa", 50, "Theo birthday check", C.birthdays.id);
inflow("2025-09-02", A.checking, "Buckeye Precision Manufacturing", 84.20, "Travel meal reimbursement", C.diningOut.id);
inflow("2024-06-22", A.checking, "Facebook Marketplace", 120, "Sold the old crib");
inflow("2026-01-17", A.checking, "Facebook Marketplace", 260, "Sold Sofia's old bike + kid stuff");
/* Credit-card interest while carrying a balance, Jun-Nov 2022. */
for (const [mo, amt] of [["2022-06", 38.14], ["2022-07", 61.20], ["2022-08", 74.05], ["2022-09", 68.90], ["2022-10", 52.33], ["2022-11", 31.76]]) spend(mo + "-24", A.visa, "Chase", C.interestFees.id, amt, "Interest charge");

/* ---- Card payments (pay last month's charges) ------------------------ */
function chargesByMonth(acct) {
  const out = {};
  for (const t of Q) {
    if (t.transfer || t.acct !== acct) continue;
    const mo = t.date.slice(0, 7);
    out[mo] = (out[mo] || 0) + t.amount;
  }
  return out;
}
const PAY_DAY = new Map([[A.visa, 22], [A.amex, 26], [A.target, 10]]);
for (const card of [A.visa, A.amex, A.target]) {
  const charges = chargesByMonth(card);
  let owed = card === A.visa ? 1180 : 0;
  let prev = FIRST_MONTH;
  eachMonth(FIRST_MONTH, CURRENT_MONTH, (y, m, mo) => {
    if (mo !== FIRST_MONTH) owed += -(charges[prev] || 0);
    const day = PAY_DAY.get(card);
    if (iso(y, m, day) <= TODAY && owed > 0.5) {
      let pay = owed;
      if (card === A.visa && mo >= "2022-06" && mo <= "2022-11") pay = Math.round(owed * 0.55 * 100) / 100;
      pay = Math.round(pay * 100) / 100;
      xfer(iso(y, m, day), A.checking, card, pay, "Pay " + card.name + (pay < owed ? " (partial)" : ""));
      owed -= pay;
    }
    prev = mo;
  });
}

/* ---- Tracking account growth ------------------------------------------ */
/* Approximate monthly market returns (S&P 500-like), Sep 2021 - Aug 2026.
   2025 H2 and 2026 are plausible placeholders, not history. */
const MKT = {
  "2021-09": -4.7, "2021-10": 7.0, "2021-11": -0.7, "2021-12": 4.5,
  "2022-01": -5.2, "2022-02": -3.0, "2022-03": 3.7, "2022-04": -8.7, "2022-05": 0.2, "2022-06": -8.3, "2022-07": 9.2, "2022-08": -4.1, "2022-09": -9.2, "2022-10": 8.1, "2022-11": 5.6, "2022-12": -5.8,
  "2023-01": 6.3, "2023-02": -2.4, "2023-03": 3.7, "2023-04": 1.6, "2023-05": 0.4, "2023-06": 6.6, "2023-07": 3.2, "2023-08": -1.6, "2023-09": -4.8, "2023-10": -2.1, "2023-11": 9.1, "2023-12": 4.5,
  "2024-01": 1.7, "2024-02": 5.3, "2024-03": 3.2, "2024-04": -4.1, "2024-05": 5.0, "2024-06": 3.6, "2024-07": 1.2, "2024-08": 2.4, "2024-09": 2.1, "2024-10": -0.9, "2024-11": 5.9, "2024-12": -2.4,
  "2025-01": 2.8, "2025-02": -1.3, "2025-03": -5.6, "2025-04": -0.7, "2025-05": 6.3, "2025-06": 5.1, "2025-07": 2.2, "2025-08": 2.0, "2025-09": 3.6, "2025-10": 2.3, "2025-11": 0.1, "2025-12": 0.9,
  "2026-01": 1.5, "2026-02": -2.0, "2026-03": 2.8, "2026-04": 1.1, "2026-05": 0.8, "2026-06": 1.9, "2026-07": 1.4, "2026-08": -0.6,
};
function grow(acct, day, damp, contrib, memoContrib, memoGrowth, every, emit) {
  const put = emit || track;
  let bal = acct.openingBalance / 100;
  let accC = 0, accG = 0, n = 0;
  eachMonth(FIRST_MONTH, addMonths(CURRENT_MONTH, -1), (y, m, mo) => {
    const r = (MKT[mo] || 0) / 100 * damp;
    const c = contrib(mo);
    const g = Math.round(bal * r * 100) / 100;
    bal += c + g; accC += c; accG += g; n += 1;
    if (n % (every || 1) !== 0) return;
    const total = Math.round((accC + accG) * 100) / 100;
    if (total !== 0) put(iso(y, m, Math.min(day, dim(y, m))), acct, total, accC ? memoContrib + " + " + memoGrowth : memoGrowth);
    accC = 0; accG = 0;
  });
  return bal;
}
grow(A.k401, 15, 0.8, (mo) => era(mo, [["2021-09", 675], ["2022-03", 700], ["2023-03", 730], ["2024-03", 760], ["2025-03", 790], ["2026-03", 820]]), "Contribution + match", "market change");
grow(A.b403, 15, 0.8, (mo) => era(mo, [["2021-09", 225], ["2024-01", 600], ["2025-01", 625], ["2026-01", 650]]), "Contribution + match", "market change");
grow(A.rothE, 3, 0.85, (mo) => era(mo, [["2021-09", 250], ["2024-01", 300], ["2026-01", 350]]), "Contributions", "market change", 3);
grow(A.rothM, 3, 0.85, (mo) => era(mo, [["2021-09", 0], ["2024-01", 250]]), "Contributions", "market change", 3);
grow(A.hsa, 15, 0.2, (mo) => era(mo, [["2021-09", 250], ["2024-01", 325]]), "Payroll contributions", "interest", 3);
track("2022-04-20", A.hsa, -640, "Theo ER visit (paid from HSA)");
track("2024-03-06", A.hsa, -1200, "Sofia braces down payment (paid from HSA)");
for (const [acct, base] of [[A.s529a, 50], [A.s529b, 50], [A.s529c, 50], [A.s529d, 50]]) {
  grow(acct, 10, acct === A.s529a ? 0.45 : 0.65, (mo) => era(mo, [["2021-09", base], ["2024-01", 125]]), "Contributions", "market change", 3);
}
/* Home value, quarterly. */
const HOME = [["2021-12", 4.0], ["2022-03", 5.0], ["2022-06", 3.0], ["2022-09", -1.0], ["2022-12", -2.0], ["2023-03", -1.0], ["2023-06", 2.0], ["2023-09", 2.0], ["2023-12", 0.5], ["2024-03", 1.5], ["2024-06", 2.0], ["2024-09", 1.0], ["2024-12", 0.5], ["2025-03", 1.0], ["2025-06", 1.5], ["2025-09", 0.5], ["2025-12", 0.5], ["2026-03", 1.0], ["2026-06", 1.0]];
let homeVal = 342000;
for (const [mo, pct] of HOME) { const d = Math.round(homeVal * pct / 100); homeVal += d; track(mo + "-01", A.home, d, "Zestimate update"); }

/* ---- Insert everything into the store -------------------------------- */
Q.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
const ID = new Map(); /* queue item -> created txn */
for (const t of Q) {
  if (t.transfer) {
    const pair = s.transfer({ fromAccountId: t.from.id, toAccountId: t.to.id, amount: $(t.amount), date: t.date, memo: t.memo || "" });
    ID.set(t, pair.out);
  } else if (t.splits) {
    const rec = s.addTransaction({ accountId: t.acct.id, date: t.date, payeeName: t.payee, categoryId: null, amount: $(t.amount), memo: t.memo || "", cleared: true });
    s.setSplits(rec.id, t.splits.map((p) => ({ categoryId: p.cat, amount: $(p.amount), memo: p.memo || "" })));
    ID.set(t, rec);
  } else {
    const rec = s.addTransaction({ accountId: t.acct.id, date: t.date, payeeName: t.payee || undefined, categoryId: t.cat, amount: $(t.amount), memo: t.memo || "", cleared: true });
    ID.set(t, rec);
  }
}
/* Close the old checking account as of March 2022. */
A.oldChase.closedAt = "2022-03-31T17:00:00.000Z";

/* ---- Assignments: derived from real inflow, month by month ----------- */
const PLAN = {
  mortgage: (mo) => Math.ceil(PI + ESCROW[+mo.slice(0, 4)]),
  electric: (mo) => era(mo, [["2021-09", 125], ["2022-01", 130], ["2023-01", 140], ["2024-01", 145], ["2025-01", 150], ["2026-01", 155]]),
  naturalGas: (mo) => era(mo, [["2021-09", 85], ["2023-01", 95], ["2025-01", 100]]),
  waterSewer: (mo) => era(mo, [["2021-09", 55], ["2024-01", 60]]),
  trashPickup: (mo) => era(mo, [["2021-09", 24], ["2024-01", 26]]),
  internet: (mo) => Math.ceil(INTERNET(mo)),
  homeMaintenance: (mo) => era(mo, [["2021-09", 150], ["2024-01", 250], ["2026-09", 300]]),
  lawnGarden: (mo) => (+mo.slice(5) >= 4 && +mo.slice(5) <= 10 ? 60 : 0),
  kitchenRemodel: (mo) => (mo >= "2023-06" && mo <= "2025-01" ? 700 : 0),
  carPayment: (mo) => (mo <= "2026-08" ? 528 : 0),
  gas: (mo) => era(mo, [["2021-09", 260], ["2022-03", 340], ["2023-01", 300], ["2024-01", 290], ["2025-01", 270], ["2026-01", 275]]),
  carInsurance: (mo) => Math.ceil(CAR_INS(+mo.slice(0, 4)) / 12),
  carMaintenance: (mo) => era(mo, [["2021-09", 100], ["2024-01", 150]]),
  registrationParking: () => 15,
  nextCarFund: (mo) => (mo >= "2026-09" ? 550 : 0),
  groceries: (mo) => era(mo, [["2021-09", 1050], ["2022-06", 1150], ["2023-01", 1250], ["2024-01", 1350], ["2025-01", 1450], ["2026-01", 1500]]),
  diningOut: (mo) => era(mo, [["2021-09", 200], ["2024-01", 300], ["2025-01", 350]]),
  coffeeSnacks: (mo) => era(mo, [["2021-09", 30], ["2024-01", 50]]),
  schoolLunches: (mo) => ((+mo.slice(5) >= 9 || +mo.slice(5) <= 5) ? era(mo, [["2021-09", 70], ["2024-09", 110], ["2026-09", 140]]) : 0),
  childcare: (mo) => CHILDCARE(mo),
  beforeAfterCare: (mo) => (mo >= "2024-09" && (+mo.slice(5) >= 9 || +mo.slice(5) <= 5) ? 185 : 0),
  activitiesSports: (mo) => era(mo, [["2021-09", 80], ["2023-09", 150], ["2025-01", 180]]),
  musicLessons: (mo) => era(mo, [["2021-09", 0], ["2023-01", 150], ["2025-01", 175]]),
  schoolFeesSupplies: (mo) => era(mo, [["2021-09", 40], ["2024-01", 60], ["2026-01", 75]]),
  kidsClothingShoes: (mo) => era(mo, [["2021-09", 70], ["2024-01", 120]]),
  summerCamps: (mo) => era(mo, [["2021-09", 60], ["2024-01", 110], ["2025-01", 140], ["2026-01", 150]]),
  allowance: (mo) => era(mo, [["2021-09", 18], ["2023-01", 24], ["2025-01", 30]]) * 4.4,
  babysitting: (mo) => era(mo, [["2021-09", 30], ["2024-01", 50]]),
  diapersBaby: (mo) => (mo <= "2023-06" ? 110 : 0),
  birthdays: (mo) => era(mo, [["2021-09", 70], ["2024-01", 90]]),
  doctorDentist: () => 80,
  pharmacy: () => 45,
  orthodontist: (mo) => (mo >= "2024-03" && mo <= "2026-02" ? 185 : mo >= "2026-07" ? 195 : 0),
  vision: () => 30,
  ymcaMembership: (mo) => (mo < "2022-01" ? 25 : YMCA(mo)),
  lifeInsurance: () => 100,
  umbrellaPolicy: (mo) => (+mo.slice(0, 4) >= 2024 ? 24 : 22),
  cellPhones: (mo) => PHONES(mo),
  streaming: (mo) => Math.ceil(NETFLIX(mo) + DISNEY(mo) + SPOTIFY(mo)),
  softwareMemberships: (mo) => era(mo, [["2021-09", 20], ["2023-03", 30], ["2024-01", 45]]),
  clothing: (mo) => era(mo, [["2021-09", 60], ["2024-01", 120]]),
  haircuts: (mo) => era(mo, [["2021-09", 60], ["2024-01", 85]]),
  personalCare: (mo) => era(mo, [["2021-09", 35], ["2024-01", 45]]),
  woodworking: (mo) => era(mo, [["2021-09", 40], ["2024-01", 80], ["2026-09", 100]]),
  running: (mo) => era(mo, [["2021-09", 30], ["2024-01", 45]]),
  booksMedia: (mo) => era(mo, [["2021-09", 15], ["2024-01", 25]]),
  householdSupplies: (mo) => era(mo, [["2021-09", 120], ["2024-01", 160]]),
  amazonMisc: (mo) => era(mo, [["2021-09", 60], ["2024-01", 110]]),
  petFoodSupplies: (mo) => (mo >= "2023-04" ? 55 : 0),
  vet: (mo) => (mo >= "2023-04" ? 35 : 0),
  church: (mo) => CHURCH(mo),
  donations: (mo) => era(mo, [["2021-09", 20], ["2024-01", 35]]),
  gifts: (mo) => era(mo, [["2021-09", 60], ["2024-01", 100]]),
  christmasHolidays: (mo) => (mo.slice(5) === "12" ? 0 : era(mo, [["2021-09", 100], ["2023-01", 150], ["2025-01", 180], ["2026-01", 200]])),
  vacation: (mo) => era(mo, [["2021-09", 80], ["2022-07", 150], ["2024-01", 250], ["2025-01", 300], ["2026-09", 350]]),
  entertainment: (mo) => era(mo, [["2021-09", 40], ["2024-01", 80]]),
  dateNight: (mo) => era(mo, [["2021-09", 60], ["2024-01", 120]]),
  familyOutings: (mo) => era(mo, [["2021-09", 30], ["2024-01", 70]]),
  emergencyFund: (mo) => era(mo, [["2021-09", 100], ["2024-01", 400], ["2024-09", 500], ["2026-09", 600]]),
  rothIraContributions: (mo) => era(mo, [["2021-09", 250], ["2024-01", 550], ["2026-01", 600]]),
  collegeSavings: (mo) => era(mo, [["2021-09", 200], ["2024-01", 500]]),
  brokerageInvesting: (mo) => (mo.slice(5) === "03" && +mo.slice(0, 4) >= 2022 ? { 2022: 1500, 2023: 2000, 2024: 2500, 2025: 3000, 2026: 3500 }[+mo.slice(0, 4)] : 0),
  studentLoan: (mo) => (mo >= "2023-10" ? 210 : 0),
  interestFees: () => 0,
  taxPrepFees: () => 10,
};
/* Order to trim in a deficit month (first = trimmed first). */
const TRIM_ORDER = ["brokerageInvesting", "vacation", "nextCarFund", "emergencyFund", "christmasHolidays", "summerCamps", "rothIraContributions", "homeMaintenance", "woodworking", "clothing", "entertainment", "dateNight", "familyOutings", "running", "booksMedia", "amazonMisc", "gifts", "kidsClothingShoes", "carMaintenance", "collegeSavings"];
/* Where a surplus goes. The emergency fund fills to its target first;
   sinking funds take a slice; anything left is invested. */
const EF_TARGET = (mo) => era(mo, [["2021-09", 15000], ["2024-01", 21000], ["2026-09", 24000]]);
let efTotal = 0;
const brokExtra = {};
function sweepCaps(mo) {
  const m = +mo.slice(5);
  return [
    ["emergencyFund", Math.min(mo < "2024-01" ? 400 : 900, Math.max(0, EF_TARGET(mo) - efTotal))],
    ["vacation", 300],
    ["nextCarFund", mo >= "2026-09" ? 400 : 0],
    ["christmasHolidays", m <= 11 ? 150 : 0],
    ["summerCamps", m <= 5 ? 100 : 0],
    ["homeMaintenance", 100],
    ["carMaintenance", 50],
    ["brokerageInvesting", mo >= "2022-03" ? 1e9 : 0],
  ];
}
/* Ceilings (dollars) on how much each envelope is allowed to hold. */
const CEIL = {
  vacation: 6000, christmasHolidays: 2400, summerCamps: 1800, homeMaintenance: 2500, carMaintenance: 1500,
  gifts: 400, kidsClothingShoes: 400, clothing: 400, birthdays: 400, schoolFeesSupplies: 800, activitiesSports: 500,
  carInsurance: 1700, vision: 400, doctorDentist: 400, pharmacy: 150, householdSupplies: 300, amazonMisc: 200,
  entertainment: 250, familyOutings: 250, dateNight: 250, woodworking: 300, running: 300, booksMedia: 100,
  personalCare: 150, haircuts: 200, donations: 250, lawnGarden: 200, coffeeSnacks: 100, diningOut: 400,
  groceries: 600, gas: 500, electric: 300, naturalGas: 400, waterSewer: 250, trashPickup: 100,
  registrationParking: 150, umbrellaPolicy: 320, softwareMemberships: 250, streaming: 100, schoolLunches: 200,
  allowance: 100, babysitting: 150, taxPrepFees: 150, petFoodSupplies: 150, vet: 400, musicLessons: 200,
  beforeAfterCare: 200, lifeInsurance: 120, cellPhones: 250, internet: 100, orthodontist: 220, mortgage: 100,
  ymcaMembership: 120, studentLoan: 250, diapersBaby: 150, childcare: 100, carPayment: 100, kitchenRemodel: 25000,
};
/* Months where a small overspend is left uncovered on purpose. */
const LEAVE_RED = new Set(["2022-08:carMaintenance", "2023-08:diningOut", "2024-11:homeMaintenance", "2025-02:activitiesSports", "2026-09:schoolFeesSupplies", "2025-10:amazonMisc"]);

const idx = buildMonthIndex(s.profile);
const carry = {}; for (const c of s.profile.categories) carry[c.id] = 0;
let inflowCum = 0, assignedCum = 0, lostCum = 0;
const efAssigned = {}, houseAssigned = {};
const round5 = (cents) => Math.round(cents / 500) * 500;
const keyById = {}; for (const k of Object.keys(C)) keyById[C[k].id] = k;

/* Everything in this block is integer CENTS. */
eachMonth(FIRST_MONTH, CURRENT_MONTH, (y, m, mo) => {
  const act = idx.act[mo] || {};
  const plan = {};
  for (const key of Object.keys(PLAN)) plan[C[key].id] = Math.round(PLAN[key](mo) * 100);
  if (mo === FIRST_MONTH) { plan[C.emergencyFund.id] += $(9500); plan[C.visaPay.id] = $(1180); }
  /* Envelopes that are already full skip their contribution this month
     (what a person does when a sinking fund is sitting on plenty). */
  for (const [key, ceil] of Object.entries(CEIL)) {
    const id = C[key].id;
    const over = carry[id] - $(ceil);
    if (over > 0) plan[id] = Math.max(0, plan[id] - over);
  }
  /* Cover overspending unless deliberately left red. */
  for (const c of s.profile.categories) {
    const a = plan[c.id] || 0;
    const avail = carry[c.id] + a + (act[c.id] || 0);
    if (avail < 0 && !LEAVE_RED.has(mo + ":" + keyById[c.id])) plan[c.id] = a - avail;
  }
  /* Emergency fund withdrawals in a crunch show as negative assigned. */
  if (mo === "2022-08") plan[C.emergencyFund.id] = -$(920);
  if (mo === "2024-11") plan[C.emergencyFund.id] = -$(1100);
  inflowCum += idx.inflow[mo] || 0;
  const total = () => Object.values(plan).reduce((a, b) => a + b, 0);
  let rta = inflowCum - assignedCum - lostCum - total();
  /* Deficit: trim discretionary down to what activity requires. */
  for (const key of TRIM_ORDER) {
    if (rta >= 0) break;
    const id = C[key].id;
    const floor = Math.max(0, -(carry[id] + (act[id] || 0)));
    const cut = Math.min(plan[id] - floor, -rta);
    if (cut > 0) { plan[id] -= cut; rta += cut; }
  }
  /* Surplus: sweep into sinking funds, keep a small float. From mid-2024 on
     they build toward being a month ahead, so more stays unassigned. */
  const float = mo >= "2024-06" ? Math.min($(17000), $(4500) + monthsSince("2024-06", mo) * $(500)) : era(mo, [["2021-09", $(3500)], ["2022-04", $(4500)]]);
  let surplus = rta - float;
  for (const [key, cap] of sweepCaps(mo)) {
    if (surplus <= 0) break;
    const add = key === "brokerageInvesting" ? Math.floor(Math.min($(cap), surplus) / 5000) * 5000 : round5(Math.min($(cap), surplus));
    if (add <= 0) continue;
    plan[C[key].id] += add; surplus -= add;
    if (key === "brokerageInvesting") brokExtra[mo] = add / 100;
  }
  efTotal += (plan[C.emergencyFund.id] || 0) / 100;
  const assignments = {};
  for (const id of Object.keys(plan)) if (plan[id]) assignments[id] = plan[id];
  s.applyAssignments(assignments, mo, "Seed " + mo);
  efAssigned[mo] = (plan[C.emergencyFund.id] || 0) / 100;
  houseAssigned[mo] = (plan[C.kitchenRemodel.id] || 0) / 100;
  /* Roll carry + lost exactly as buildBudgetTable does. */
  let lost = 0;
  for (const c of s.profile.categories) {
    const avail = carry[c.id] + (assignments[c.id] || 0) + (act[c.id] || 0);
    if (avail < 0) { lost += -avail; carry[c.id] = 0; } else carry[c.id] = avail;
  }
  assignedCum += Object.values(assignments).reduce((a, b) => a + b, 0);
  lostCum += lost;
});
function monthsSince(a, b) { const [ay, am] = a.split("-").map(Number); const [by, bm] = b.split("-").map(Number); return (by - ay) * 12 + (bm - am); }

/* Next two months assigned ahead (they are roughly a month ahead now). */
const rtaNow = tableReadyToAssign(buildBudgetTable(s.profile, CURRENT_MONTH, buildMonthIndex(s.profile)), CURRENT_MONTH);
{
  let pool = rtaNow / 100 - 350;
  for (const mo of [addMonths(CURRENT_MONTH, 1), addMonths(CURRENT_MONTH, 2)]) {
    const assignments = {};
    for (const key of Object.keys(PLAN)) {
      const want = Math.round(PLAN[key](mo));
      if (want <= 0 || pool <= 0) continue;
      const a = Math.min(want, Math.floor(pool));
      assignments[C[key].id] = a * 100; pool -= a;
    }
    if (Object.keys(assignments).length) s.applyAssignments(assignments, mo, "Assign ahead " + mo);
  }
}

/* ---- Savings transfers mirror the categories --------------------------- */
eachMonth(FIRST_MONTH, CURRENT_MONTH, (y, m, mo) => {
  const ef = efAssigned[mo]; const d = iso(y, m, Math.min(6, mo === CURRENT_MONTH ? TD : 28));
  if (mo !== FIRST_MONTH && ef > 0 && d <= TODAY) s.transfer({ fromAccountId: A.checking.id, toAccountId: A.ef.id, amount: $(ef), date: d, memo: "Emergency fund" });
  if (ef < 0) s.transfer({ fromAccountId: A.ef.id, toAccountId: A.checking.id, amount: $(-ef), date: iso(y, m, 20), memo: mo === "2022-08" ? "Cover Civic repair" : "Cover water heater" });
  const h = houseAssigned[mo];
  if (h > 0 && iso(y, m, 7) <= TODAY) s.transfer({ fromAccountId: A.checking.id, toAccountId: A.house.id, amount: $(h), date: iso(y, m, 7), memo: "Kitchen fund" });
});
/* Surplus swept to the brokerage leaves checking as a real outflow, and the
   tracking account records deposits plus growth quarterly. */
for (const [mo, amt] of Object.entries(brokExtra)) {
  const [y, m] = mo.split("-").map(Number);
  s.addTransaction({ accountId: A.checking.id, date: iso(y, m, Math.min(25, mo === CURRENT_MONTH ? TD : 28)), payeeName: "Vanguard", categoryId: C.brokerageInvesting.id, amount: -$(amt), memo: "Surplus to brokerage", cleared: true });
}
grow(A.brok, 28, 0.95, (mo) => (mo.slice(5) === "03" && +mo.slice(0, 4) >= 2022 ? { "2022": 1500, "2023": 2000, "2024": 2500, "2025": 3000, "2026": 3500 }[mo.slice(0, 4)] : 0) + (brokExtra[mo] || 0), "Deposits", "market change", 3,
  (date, acct, dollars, memo) => s.addTransaction({ accountId: acct.id, date, categoryId: null, amount: $(dollars), memo, cleared: true }));
/* Quarterly interest on the emergency fund (real cash: uncategorized). */
eachMonth(FIRST_MONTH, CURRENT_MONTH, (y, m, mo) => {
  if (m % 3 !== 0) return;
  const d = iso(y, m, dim(y, m)); if (d > TODAY) return;
  const bal = runningBalance(s.profile, A.ef.id) / 100; /* approximate: current balance */
  const balThen = s.profile.transactions.filter((t) => t.accountId === A.ef.id && t.date <= d).reduce((a, t) => a + t.amount, 0) / 100;
  const interest = Math.round(balThen * APY(mo) / 4 * 100) / 100;
  if (interest > 0) s.addTransaction({ accountId: A.ef.id, date: d, payeeName: "Ally Bank", categoryId: null, amount: $(interest), memo: "Quarterly interest", cleared: true });
  void bal;
});

/* ---- Goals (all four types) -------------------------------------------- */
s.addGoal({ categoryId: C.mortgage.id, type: "monthlyFixed", target: $(PLAN.mortgage(CURRENT_MONTH)) });
s.addGoal({ categoryId: C.groceries.id, type: "monthlyFixed", target: $(1500) });
s.addGoal({ categoryId: C.church.id, type: "monthlyFixed", target: $(300) });
s.addGoal({ categoryId: C.cellPhones.id, type: "monthlyFixed", target: $(215) });
s.addGoal({ categoryId: C.childcare.id, type: "monthlyFixed", target: 0 });
s.addGoal({ categoryId: C.activitiesSports.id, type: "monthlyTopUp", target: $(180) });
s.addGoal({ categoryId: C.homeMaintenance.id, type: "monthlyTopUp", target: $(300) });
s.addGoal({ categoryId: C.carMaintenance.id, type: "monthlyTopUp", target: $(150) });
s.addGoal({ categoryId: C.gifts.id, type: "monthlyTopUp", target: $(100) });
s.addGoal({ categoryId: C.householdSupplies.id, type: "refillUpTo", target: $(160) });
s.addGoal({ categoryId: C.diningOut.id, type: "refillUpTo", target: $(350) });
s.addGoal({ categoryId: C.clothing.id, type: "refillUpTo", target: $(200) });
s.addGoal({ categoryId: C.pharmacy.id, type: "refillUpTo", target: $(80) });
s.addGoal({ categoryId: C.vacation.id, type: "targetByDate", target: $(5500), byDate: "2027-06-30" });
s.addGoal({ categoryId: C.nextCarFund.id, type: "targetByDate", target: $(12000), byDate: "2027-08-31" });
s.addGoal({ categoryId: C.christmasHolidays.id, type: "targetByDate", target: $(2400), byDate: "2026-12-01" });
s.addGoal({ categoryId: C.summerCamps.id, type: "targetByDate", target: $(1800), byDate: "2027-06-01" });
s.addGoal({ categoryId: C.carInsurance.id, type: "targetByDate", target: $(825), byDate: "2026-11-05" });
s.addGoal({ categoryId: C.emergencyFund.id, type: "monthlyFixed", target: $(600) });
s.removeGoal(C.childcare.id);

/* ---- Hidden categories (finished chapters) ---------------------------- */
s.setCategoryHidden(C.diapersBaby.id, true);
s.setCategoryHidden(C.kitchenRemodel.id, true);

/* ---- Recurring templates (18 months of plans) ------------------------- */
const nextAfterToday = (day) => { const d = iso(TY, TM, Math.min(day, dim(TY, TM))); return d > TODAY ? d : iso(TY, TM + 1 > 12 ? 1 : TM + 1, Math.min(day, dim(TM === 12 ? TY + 1 : TY, TM === 12 ? 1 : TM + 1))); };
const sched = (template, frequency, nextDate, extra) => s.addSchedule(Object.assign({ template, frequency, nextDate }, extra || {}));
sched({ accountId: A.checking.id, payeeName: "Buckeye Precision Manufacturing", categoryId: null, amount: $(3850), memo: "Evan paycheck (net)" }, "biweekly", "2026-09-04");
sched({ accountId: A.checking.id, payeeName: "Scioto Valley Health", categoryId: null, amount: $(2750), memo: "Maya paycheck (net)" }, "monthly", "2026-09-15");
sched({ accountId: A.checking.id, payeeName: "Scioto Valley Health", categoryId: null, amount: $(2750), memo: "Maya paycheck (net)" }, "monthly", "2026-09-30");
sched({ accountId: A.checking.id, payeeName: "Rocket Mortgage", categoryId: C.mortgage.id, amount: -$(PI + ESCROW[2026]), memo: "P&I + escrow" }, "monthly", "2026-10-01");
sched({ accountId: A.checking.id, payeeName: "AEP Ohio", categoryId: C.electric.id, amount: -$(152), memo: "Electric" }, "monthly", "2026-09-08");
sched({ accountId: A.checking.id, payeeName: "Columbia Gas of Ohio", categoryId: C.naturalGas.id, amount: -$(42), memo: "Gas" }, "monthly", "2026-09-11");
sched({ accountId: A.checking.id, payeeName: "City of Westerville Utilities", categoryId: C.waterSewer.id, amount: -$(190), memo: "Quarterly water/sewer" }, "custom", "2026-09-14", { customInterval: 3, customUnit: "months" });
sched({ accountId: A.checking.id, payeeName: "Rumpke", categoryId: C.trashPickup.id, amount: -$(78), memo: "Quarterly trash" }, "custom", "2026-10-03", { customInterval: 3, customUnit: "months" });
sched({ accountId: A.visa.id, payeeName: "Spectrum", categoryId: C.internet.id, amount: -$(89.99), memo: "Internet" }, "monthly", "2026-09-18");
sched({ accountId: A.checking.id, payeeName: "Nelnet", categoryId: C.studentLoan.id, amount: -$(210), memo: "Maya student loan" }, "monthly", "2026-09-12");
sched({ accountId: A.checking.id, payeeName: "Little Sprouts Learning Center", categoryId: C.childcare.id, amount: -$(1450), memo: "Theo - ended Aug 2026 (kindergarten)" }, "monthly", "2026-10-01", { paused: true });
sched({ accountId: A.checking.id, payeeName: "YMCA of Central Ohio", categoryId: C.beforeAfterCare.id, amount: -$(185), memo: "Nora + Theo before/after care" }, "monthly", "2026-10-01");
sched({ accountId: A.checking.id, payeeName: "Smile Doctors Orthodontics", categoryId: C.orthodontist.id, amount: -$(195), memo: "Lucas braces (through mid-2028)" }, "monthly", "2026-09-06");
sched({ accountId: A.checking.id, payeeName: "Ms. Alvarez Piano Studio", categoryId: C.musicLessons.id, amount: -$(40), memo: "Sofia piano lesson" }, "weekly", "2026-09-08");
sched({ accountId: A.checking.id, payeeName: "Dance Elite Westerville", categoryId: C.activitiesSports.id, amount: -$(72), memo: "Nora dance" }, "monthly", "2026-09-05");
sched({ accountId: A.checking.id, payeeName: "YMCA of Central Ohio", categoryId: C.ymcaMembership.id, amount: -$(104), memo: "Family membership" }, "monthly", "2026-10-01");
sched({ accountId: A.checking.id, payeeName: "Banner Life", categoryId: C.lifeInsurance.id, amount: -$(99.60), memo: "Term life" }, "monthly", "2026-09-05");
sched({ accountId: A.checking.id, payeeName: "State Farm", categoryId: C.umbrellaPolicy.id, amount: -$(285), memo: "Umbrella policy" }, "yearly", "2026-09-16");
sched({ accountId: A.checking.id, payeeName: "Progressive", categoryId: C.carInsurance.id, amount: -$(825), memo: "6-month premium" }, "custom", "2026-11-05", { customInterval: 6, customUnit: "months" });
sched({ accountId: A.checking.id, payeeName: "T-Mobile", categoryId: C.cellPhones.id, amount: -$(215), memo: "Family plan" }, "monthly", "2026-09-20");
sched({ accountId: A.visa.id, payeeName: "Netflix", categoryId: C.streaming.id, amount: -$(20.99), memo: "" }, "monthly", TODAY);
sched({ accountId: A.visa.id, payeeName: "Disney+", categoryId: C.streaming.id, amount: -$(15.99), memo: "" }, "monthly", "2026-09-12");
sched({ accountId: A.visa.id, payeeName: "Spotify", categoryId: C.streaming.id, amount: -$(19.99), memo: "Family plan" }, "monthly", "2026-09-21");
sched({ accountId: A.visa.id, payeeName: "Apple", categoryId: C.softwareMemberships.id, amount: -$(9.99), memo: "iCloud+" }, "monthly", "2026-09-09");
sched({ accountId: A.visa.id, payeeName: "Amazon", categoryId: C.softwareMemberships.id, amount: -$(139), memo: "Prime annual" }, "yearly", "2027-02-15");
sched({ accountId: A.amex.id, payeeName: "Costco", categoryId: C.softwareMemberships.id, amount: -$(65), memo: "Membership renewal" }, "yearly", "2027-09-02");
sched({ accountId: A.visa.id, payeeName: "Chewy", categoryId: C.petFoodSupplies.id, amount: -$(61), memo: "Dog food autoship" }, "custom", "2026-09-10", { customInterval: 6, customUnit: "weeks" });
sched({ accountId: A.checking.id, payeeName: "Grace Community Church", categoryId: C.church.id, amount: -$(300), memo: "Monthly giving" }, "monthly", "2026-10-03");
sched({ accountId: A.checking.id, payeeName: "Vanguard", categoryId: C.rothIraContributions.id, amount: -$(350), memo: "Evan Roth IRA" }, "monthly", "2026-10-02");
sched({ accountId: A.checking.id, payeeName: "Fidelity", categoryId: C.rothIraContributions.id, amount: -$(250), memo: "Maya Roth IRA" }, "monthly", "2026-10-02");
sched({ accountId: A.checking.id, payeeName: "Ohio 529 CollegeAdvantage", categoryId: C.collegeSavings.id, amount: -$(500), memo: "4 x monthly" }, "monthly", "2026-09-10");
sched({ accountId: A.cash.id, payeeName: "Allowance", categoryId: C.allowance.id, amount: -$(30), memo: "Sunday allowance" }, "weekly", "2026-09-06");
sched({ accountId: A.checking.id, payeeName: "Columbus Zoo and Aquarium", categoryId: C.entertainment.id, amount: -$(209), memo: "Family membership" }, "yearly", "2027-03-10");
sched({ accountId: A.checking.id, payeeName: "Westerville Youth Soccer", categoryId: C.activitiesSports.id, amount: -$(185), memo: "Sofia soccer (fall/spring)" }, "custom", "2027-02-10", { customInterval: 6, customUnit: "months" });
sched({ accountId: A.checking.id, payeeName: "Comfort Air Heating & Cooling", categoryId: C.homeMaintenance.id, amount: -$(149), memo: "HVAC tune-up" }, "custom", "2026-10-12", { customInterval: 6, customUnit: "months" });
sched({ accountId: A.visa.id, payeeName: "Great Clips", categoryId: C.haircuts.id, amount: -$(32), memo: "Evan" }, "custom", "2026-09-02", { customInterval: 5, customUnit: "weeks" });
sched({ accountId: A.checking.id, payeeName: "TurboTax", categoryId: C.taxPrepFees.id, amount: -$(129), memo: "Filing" }, "yearly", "2027-04-08");

/* ---- Planned cuts (reduction planning) -------------------------------- */
s.addCut({ categoryId: C.diningOut.id, mode: "percent", value: 2000, startMonth: "2026-07", goalLabel: "Disney trip", targetMonth: "2027-06" });
s.addCut({ categoryId: C.amazonMisc.id, mode: "amount", value: $(40), startMonth: "2026-08", goalLabel: "Next car fund", targetMonth: "2027-08" });

/* ---- Notes ------------------------------------------------------------- */
const NOTES = {
  groceries: "Kroger on Saturdays, Aldi every other week, one Costco run a month. Farmers market May-Oct is cash.",
  childcare: "Little Sprouts. Theo's last month was Aug 2026 - kindergarten started 8/26. Template paused, not deleted, for the history.",
  carInsurance: "Progressive. Due May 5 and Nov 5. Assign 1/6 of the premium every month.",
  orthodontist: "Sofia's braces finished Feb 2026. Lucas started Jul 2026: $195 x 22 months.",
  nextCarFund: "Odyssey paid off Aug 2026. Keep paying ourselves the $528 until the Civic dies. Target: $12k by Aug 2027.",
  vacation: "Disney World, June 2027. Tickets ~$2,800 for six, flights ~$1,900, hotel ~$1,500 with points.",
  emergencyFund: "Target is three months of essentials (~$21,000). Lives at Ally; this category mirrors that account.",
  kitchenRemodel: "Done April 2025 - hidden. Cabinets, counters, and appliances came to about $21,000.",
  studentLoan: "Nelnet, 5.5%. Payments resumed Oct 2023 after the federal pause.",
  homeMaintenance: "Sinking fund. Water heater (2024) and furnace (2022) both came out of here plus the emergency fund.",
  summerCamps: "Save Jan-May, spend Jun-Jul. Four kids in camp now.",
  christmasHolidays: "Also covers Halloween costumes and Easter baskets. Refill to $2,400 by Dec 1.",
  gifts: "Six birthdays are in Birthdays. This is everyone else: teachers, weddings, anniversary.",
  amazonMisc: "The leak. Planned cut of $40/mo toward the next car.",
  diningOut: "Cut 20% from July 2026 toward Disney. Fridays are pizza night; that stays.",
  allowance: "Sofia $12, Lucas $10, Nora $8, cash on Sundays. Theo starts at 6.",
  cellPhones: "T-Mobile, 4 lines since Lucas got a phone in Sep 2025.",
  beforeAfterCare: "YMCA program at the elementary school. Nora and now Theo.",
};
for (const [k, note] of Object.entries(NOTES)) s.setCategoryNote(C[k].id, note);
const MONTH_NOTES = [
  ["2021-11", "childcare", "Theo starts infant room. Two tuitions now."],
  ["2022-06", "vacation", "Hilton Head week. Put the rest on the Visa - paying it down through fall."],
  ["2022-08", "carMaintenance", "Civic transmission. Pulled $920 from the emergency fund."],
  ["2023-04", "petFoodSupplies", "We got a dog. Biscuit, lab mix, from the county shelter."],
  ["2023-10", "studentLoan", "Federal pause ended. Payments resume."],
  ["2024-01", "rothIraContributions", "Maya full-time now - restarted her Roth."],
  ["2024-09", "childcare", "Nora started kindergarten. Down to one tuition."],
  ["2024-11", "homeMaintenance", "Water heater died. $1,650. Covered $1,100 from the emergency fund."],
  ["2025-03", "kitchenRemodel", "Cabinets installed. Appliances on the Visa, paid off next month."],
  ["2026-08", "carPayment", "Final Odyssey payment!"],
  ["2026-09", "schoolFeesSupplies", "Four kids in school. Fees were more than planned - left it red, cover from Ready to Work."],
  ["2026-09", "groceries", "Back-to-school lunches. Bumped $100."],
  ["2026-10", "electric", "AEP rate increase ~4% effective October."],
  ["2026-11", "carInsurance", "Renewal. Quote came in at $825 for six months."],
  ["2026-12", "christmasHolidays", "Spend the envelope down; keep $200 for after-Christmas sales."],
  ["2027-01", "summerCamps", "Camp registration opens in February - decide on weeks."],
  ["2027-03", "brokerageInvesting", "Bonus month. Same split as last year: $3,500 to Vanguard."],
  ["2027-06", "vacation", "Disney, June 12-19."],
  ["2027-08", "nextCarFund", "Target date. Decide: replace the Civic or keep it another year."],
  ["2027-09", "cellPhones", "Nora turns 8 - no phone yet. Hold at four lines."],
  ["2028-01", "carInsurance", "Sofia turns 16 in March. Teen driver adds ~$1,800/yr - start setting aside."],
  ["2028-03", "birthdays", "Sofia's 16th. Bigger than usual."],
];
for (const [mo, k, note] of MONTH_NOTES) s.setMonthNote(C[k].id, mo, note);

/* ---- Rules (payee normalization + auto-categorization) --------------- */
s.addNormalizeRule({ pattern: "^AMZN|AMAZON\\.COM|AMAZON MKTP", matchType: "regex", replacement: "Amazon" });
s.addNormalizeRule({ pattern: "^KROGER #", matchType: "regex", replacement: "Kroger" });
s.addNormalizeRule({ pattern: "^SQ \\*", matchType: "regex", replacement: "Square merchant" });
s.addNormalizeRule({ pattern: "TST\\* ", matchType: "regex", replacement: "Restaurant (Toast)" });
s.addNormalizeRule({ pattern: "CHEWY.COM", matchType: "contains", replacement: "Chewy" });
s.addCategorizeRule({ pattern: "Kroger", matchType: "equals", categoryId: C.groceries.id });
s.addCategorizeRule({ pattern: "Aldi", matchType: "starts-with", categoryId: C.groceries.id });
s.addCategorizeRule({ pattern: "AEP", matchType: "contains", categoryId: C.electric.id });
s.addCategorizeRule({ pattern: "Columbia Gas", matchType: "contains", categoryId: C.naturalGas.id });
s.addCategorizeRule({ pattern: "Speedway|Shell|Kroger Fuel|Costco Gas", matchType: "regex", categoryId: C.gas.id });
s.addCategorizeRule({ pattern: "Chewy", matchType: "equals", categoryId: C.petFoodSupplies.id });
s.addCategorizeRule({ pattern: "Starbucks", matchType: "contains", categoryId: C.coffeeSnacks.id });
s.addCategorizeRule({ pattern: "Netflix|Disney\\+|Spotify", matchType: "regex", categoryId: C.streaming.id });

/* ---- Budget templates -------------------------------------------------- */
s.saveBudgetTemplate("School-year month", "2025-10");
s.saveBudgetTemplate("Summer month (camps)", "2026-07");
s.saveBudgetTemplate("December (holidays)", "2025-12");

/* ---- Dashboards -------------------------------------------------------- */
const overview = s.dashboardList()[0];
s.createDashboard("Debt and savings", [
  { source: "report:net-worth", params: { count: 36 }, title: "Net worth, 3 years", w: 8, h: 2 },
  { source: "report:debt", title: "What we owe" },
  { source: "report:savings-rate", params: { count: 12 } },
  { source: "report:projection", params: { count: 18 }, title: "Cashflow, next 18 months" },
  { source: "report:subscriptions", params: { lookbackMonths: 12 } },
]);
s.setActiveDashboard(overview.id);

/* ---- Cleared / reconciled / pending ----------------------------------- */
const STATEMENT = new Map([[A.checking, "2026-08-28"], [A.ef, "2026-08-31"], [A.house, "2026-08-31"], [A.cash, "2026-08-30"], [A.visa, "2026-08-20"], [A.amex, "2026-08-25"], [A.target, "2026-08-12"], [A.oldChase, "2022-03-31"]]);
const PENDING_FROM = addDays(TODAY, -3);
for (const t of s.profile.transactions) {
  const acct = s.profile.accounts.find((a) => a.id === t.accountId);
  if (!acct.onBudget) { t.cleared = true; continue; }
  const stmt = STATEMENT.get(acct) || "2026-08-25";
  t.cleared = t.date <= stmt;
}
for (const [acct] of STATEMENT) s.applyReconcile(acct.id);
for (const t of s.profile.transactions) {
  const acct = s.profile.accounts.find((a) => a.id === t.accountId);
  if (acct.onBudget && !t.reconciled) t.cleared = t.date < PENDING_FROM;
}
/* One reconciliation adjustment on the cash account (small shortfall). */
s.addAdjustment(A.cash.id, -$(7.50), "2025-11-30", "Reconciliation adjustment - cash short");
/* Two trashed transactions: a duplicate entry deleted last week. */
{
  const dup = s.addTransaction({ accountId: A.visa.id, date: "2026-08-27", payeeName: "Kroger", categoryId: C.groceries.id, amount: -$(84.12), memo: "duplicate - entered twice", cleared: false });
  s.deleteTransaction(dup.id);
  const dup2 = s.addTransaction({ accountId: A.checking.id, date: "2026-08-30", payeeName: "Scioto Valley Health", categoryId: null, amount: $(2750), memo: "duplicate deposit entry", cleared: false });
  s.deleteTransaction(dup2.id);
}

/* ---- Fix-up: never let a month's Ready to Work go negative ----------- */
for (let pass = 0; pass < 3; pass++) {
  const t = buildBudgetTable(s.profile, addMonths(CURRENT_MONTH, 2), buildMonthIndex(s.profile));
  let fixed = 0;
  eachMonth(FIRST_MONTH, addMonths(CURRENT_MONTH, 2), (y, m, mo) => {
    const rta = tableReadyToAssign(t, mo);
    if (rta >= 0) return;
    const rec = s.profile.budgets[mo];
    for (const key of ["brokerageInvesting", "vacation", "emergencyFund", "homeMaintenance", "christmasHolidays"]) {
      const id = C[key].id;
      const have = (rec && rec.assigned && rec.assigned[id]) || 0;
      if (have <= 0) continue;
      const cut = Math.min(have, -rta + 100);
      s.assign(id, mo, have - cut);
      fixed += 1;
      break;
    }
  });
  if (!fixed) break;
}

/* ---- Sanity checks ------------------------------------------------------ */
const finalIdx = buildMonthIndex(s.profile);
const table = buildBudgetTable(s.profile, addMonths(CURRENT_MONTH, 2), finalIdx);
const problems = [];
eachMonth(FIRST_MONTH, addMonths(CURRENT_MONTH, 2), (y, m, mo) => {
  const rta = tableReadyToAssign(table, mo);
  if (rta < 0) problems.push("RTA negative in " + mo + ": " + (rta / 100).toFixed(2));
});
/* On-budget account balances must never dip below zero (cards excepted). */
for (const acct of [A.checking, A.ef, A.house, A.cash]) {
  let bal = acct.openingBalance;
  const rows = s.profile.transactions.filter((t) => t.accountId === acct.id).sort((a, b) => a.date < b.date ? -1 : 1);
  let min = Infinity, minDate = "";
  for (const t of rows) { bal += t.amount; if (bal < min) { min = bal; minDate = t.date; } }
  if (min < 0) problems.push(acct.name + " went to " + (min / 100).toFixed(2) + " on " + minDate);
}
if (problems.length) { console.error("SANITY PROBLEMS:\n  " + problems.join("\n  ")); process.exitCode = 1; }

/* ---- Export -------------------------------------------------------------- */
const exportData = buildExport(s.profile);
const devOut = resolve(__dirname, "..", "_sample");
mkdirSync(devOut, { recursive: true });
writeFileSync(resolve(devOut, "sample.json"), JSON.stringify(exportData, null, 2));
const shippedOut = resolve(__dirname, "..", "src", "assets", "sample");
mkdirSync(shippedOut, { recursive: true });
const shipped = JSON.stringify(exportData);
writeFileSync(resolve(shippedOut, "sample.json"), shipped);

const p = s.profile;
const overspent = p.categories.filter((c) => tableCategoryRow(table, c.id, CURRENT_MONTH).available < 0).map((c) => c.name);
console.log("Wrote src/assets/sample/sample.json (" + Math.round(shipped.length / 1024) + " KB) and _sample/sample.json");
console.log("  accounts:     ", p.accounts.length, "(" + p.accounts.filter((a) => !a.onBudget).length + " tracking)");
console.log("  categories:   ", p.categories.length, "in", p.categoryGroups.length, "groups");
console.log("  transactions: ", p.transactions.length, "(" + p.transactions.filter((t) => t.splits).length + " splits,", p.transactions.filter((t) => t.transferTxnId).length / 2, "transfers,", p.transactions.filter((t) => t.reconciled).length, "reconciled)");
console.log("  scheduled:    ", p.scheduled.length, " goals:", p.goals.length, " cuts:", p.reductions.length, " payees:", p.payees.length, " rules:", p.rules.categorize.length + p.rules.normalizePayee.length);
console.log("  budget months:", Object.keys(p.budgets).length, Object.keys(p.budgets).sort()[0], "->", Object.keys(p.budgets).sort().pop());
console.log("  date span:    ", p.transactions.map((t) => t.date).sort()[0], "->", p.transactions.map((t) => t.date).sort().pop(), " anchor", TODAY);
for (const mo of ["2021-12", "2022-12", "2023-12", "2024-12", "2025-12", CURRENT_MONTH, addMonths(CURRENT_MONTH, 1), addMonths(CURRENT_MONTH, 2)]) console.log("  RTA " + mo + ": " + (tableReadyToAssign(table, mo) / 100).toFixed(2) + "  inflow " + ((finalIdx.inflow[mo] || 0) / 100).toFixed(0) + "  assigned " + ((finalIdx.assignedTotal[mo] || 0) / 100).toFixed(0));
console.log("  overspent now:", overspent.join(", ") || "none");
console.log("  net worth:    ", (s.netWorth() / 100).toFixed(2), " checking:", (runningBalance(p, A.checking.id) / 100).toFixed(2), " EF:", (runningBalance(p, A.ef.id) / 100).toFixed(2));
console.log("  due today:    ", s.dueScheduled().length);
{
  let env = 0; for (const c of p.categories) env += Math.max(0, tableCategoryRow(table, c.id, CURRENT_MONTH).available);
  console.log("  envelopes now:", (env / 100).toFixed(2), " top:", p.categories.map((c) => [c.name, tableCategoryRow(table, c.id, CURRENT_MONTH).available]).sort((a, b) => b[1] - a[1]).slice(0, 6).map((x) => x[0] + " " + (x[1] / 100).toFixed(0)).join(", "));
}
