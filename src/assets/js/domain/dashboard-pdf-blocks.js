/* What each PANEL widget contributes to a PDF.
 *
 * Report widgets need nothing here: their view already says how to draw them
 * (a chart is captured, a table and a list go through pbDrawTable, a stat
 * through pbDrawKPIStrip), and their data comes from the same memoized store
 * method the screen reads. Five view kinds, one dispatch.
 *
 * The thirteen panels are the exception, because their markup is bespoke and
 * a PDF cannot screenshot an Alpine template. So each one says what it is, in
 * the two shapes the PDF primitives already understand:
 *
 *   { kind: "kpis",  kpis:    [{ label, value }] }
 *   { kind: "table", columns: ["..."], rows: [["..."]] }
 *
 * Every function takes the store and returns one of those. They read the same
 * store methods the panel markup reads, so there is no second data path to
 * drift - which was the objection to hand-laying-out a PDF in the first place,
 * and it only holds if this file stays a thin projection rather than growing
 * logic of its own.
 *
 * A source with no block here is not a crash: the composer skips it and says
 * so. But a registry test asserts every panel has one, so "skipped" is a
 * decision someone made rather than something that quietly happened.
 */

function money(store, cents) {
  var n = (cents || 0) / 100;
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export const PANEL_BLOCKS = {
  "panel:hero": function (store) {
    return {
      kind: "kpis",
      kpis: [
        { label: "Net worth", value: money(store, store.netWorth()) },
        { label: "Ready to Work", value: money(store, store.readyToAssign()) },
        { label: "Month", value: store.currentMonth || "" },
      ],
    };
  },

  "panel:kpis": function (store) {
    return {
      kind: "kpis",
      kpis: [
        { label: "Ready to Work", value: money(store, store.readyToAssign()) },
        { label: "Net worth", value: money(store, store.netWorth()) },
        { label: "Overspent", value: String(store.overspentCount(store.currentMonth) || 0) },
      ],
    };
  },

  "panel:alerts": function (store) {
    var alerts = store.dashboardAlerts() || [];
    return {
      kind: "table",
      columns: ["Alert"],
      rows: alerts.map(function (a) { return [String(a.message || a.title || "")]; }),
    };
  },

  "panel:insights": function () {
    /* Insights are generated for the screen from several store reads and are
       phrased as sentences; a table of one column would be a worse reading of
       them than simply leaving them out of a printed sheet. */
    return null;
  },

  "panel:accounts": function (store) {
    var accounts = (store.profile && store.profile.accounts) || [];
    return {
      kind: "table",
      columns: ["Account", "Balance"],
      rows: accounts
        .filter(function (a) { return !a.closed && !a.deletedAt; })
        .map(function (a) { return [a.name, money(store, store.accountBalance(a.id))]; }),
    };
  },

  "panel:cashflow": function (store) {
    var rows = store.reportIncomeVsExpense(null, 1) || [];
    var m = rows[rows.length - 1] || {};
    return {
      kind: "kpis",
      kpis: [
        { label: "In", value: money(store, m.income) },
        { label: "Out", value: money(store, m.expense) },
        { label: "Net", value: money(store, m.net) },
      ],
    };
  },

  "panel:income-expense": function (store) {
    var rows = store.reportIncomeVsExpense(null, 6) || [];
    return {
      kind: "table",
      columns: ["Month", "In", "Out", "Net"],
      rows: rows.map(function (r) {
        return [r.month, money(store, r.income), money(store, r.expense), money(store, r.net)];
      }),
    };
  },

  "panel:top-categories": function (store) {
    var rows = store.reportSpending(null, null) || [];
    return {
      kind: "table",
      columns: ["Category", "Spent"],
      rows: rows.slice(0, 10).map(function (r) { return [r.category, money(store, r.value)]; }),
    };
  },

  "panel:cashflow-30": function (store) {
    var rows = store.reportProjection(1) || [];
    return {
      kind: "table",
      columns: ["Month", "Expected"],
      rows: rows.map(function (r) { return [r.month, money(store, r.expected)]; }),
    };
  },

  "panel:upcoming-bills": function (store) {
    var bills = store.upcomingBills(14) || [];
    return {
      kind: "table",
      columns: ["Due", "Payee", "Amount"],
      rows: bills.map(function (b) {
        return [b.date || "", b.payeeName || b.payee || "", money(store, b.amount)];
      }),
    };
  },

  "panel:goals": function (store) {
    var goals = store.goalsNeedingAttention(20, store.currentMonth) || [];
    return {
      kind: "table",
      columns: ["Category", "Needs"],
      rows: goals.map(function (g) { return [g.category || g.name || "", money(store, g.needed)]; }),
    };
  },

  "panel:recent": function (store) {
    var txns = ((store.profile && store.profile.transactions) || [])
      .filter(function (t) { return !t.deletedAt; })
      .slice()
      .sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); })
      .slice(0, 15);
    return {
      kind: "table",
      columns: ["Date", "Payee", "Amount"],
      rows: txns.map(function (t) {
        return [t.date || "", store.payeeName ? store.payeeName(t.payeeId) || "" : "", money(store, t.amount)];
      }),
    };
  },

  "panel:quick-actions": function () {
    /* Buttons. There is nothing to print. */
    return null;
  },
};

/* null means "deliberately nothing to print", which is different from "no
   block exists" - the registry test distinguishes them. */
export function blockFor(sourceId, store) {
  var fn = PANEL_BLOCKS[sourceId];
  if (!fn) return undefined;
  try {
    return fn(store);
  } catch (err) {
    /* One panel that cannot read its data must not lose the whole document. */
    return null;
  }
}

export function hasBlock(sourceId) {
  return Object.prototype.hasOwnProperty.call(PANEL_BLOCKS, sourceId);
}
