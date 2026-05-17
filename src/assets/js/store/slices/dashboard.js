/* Dashboard slice — read-only widgets that aggregate over the active
   profile to drive the cards on /app/. None of these mutate the
   profile; they're all `this`-bound so the store's _listVersion read
   forces re-evaluation when something downstream changes. */

import { isPaymentCategory } from "../../domain/categories.js";
import { categoryRow, assigned as budgetAssigned } from "../../domain/budget.js";
import { occurrencesIn } from "../../domain/scheduled.js";

export const dashboardSlice = {
  /* Count of categories whose net (carry + assigned + activity) is
     below zero this month, plus the total deficit. Drives the
     "Overspent" KPI tile + the alert. */
  overspentCount(month) {
    if (!this.profile) return { count: 0, totalDeficit: 0 };
    void this._listVersion;
    var m = month || this.currentMonth;
    var count = 0, deficit = 0;
    var self = this;
    this.profile.categories.forEach(function (c) {
      if (isPaymentCategory(self.profile, c.id)) return;
      var row = categoryRow(self.profile, c.id, m);
      if (row.available < 0) {
        count += 1;
        deficit += Math.abs(row.available);
      }
    });
    return { count: count, totalDeficit: deficit };
  },

  /* Sum of every scheduled occurrence in the next `days` days plus
     the underlying schedule records so the dashboard can list them.
     Outflow shows as negative, inflow as positive — caller decides
     how to render. Each returned bill carries the resolved ISO date. */
  upcomingBills(days) {
    void this._listVersion;
    if (!this.profile || !this.profile.scheduled.length) {
      return { totalNet: 0, totalOut: 0, totalIn: 0, items: [] };
    }
    var today = new Date().toISOString().slice(0, 10);
    var horizon = new Date();
    horizon.setDate(horizon.getDate() + (days || 14));
    var endISO = horizon.toISOString().slice(0, 10);
    var items = [];
    var totalNet = 0, totalOut = 0, totalIn = 0;
    this.profile.scheduled.forEach(function (s) {
      var dates = occurrencesIn(s, today, endISO);
      dates.forEach(function (d) {
        var amt = (s.template && s.template.amount) || 0;
        items.push({
          schedId: s.id,
          date: d,
          amount: amt,
          payeeName: (s.template && s.template.payeeName) || "",
          payeeId: (s.template && s.template.payeeId) || null,
          accountId: (s.template && s.template.accountId) || null,
          categoryId: (s.template && s.template.categoryId) || null,
        });
        totalNet += amt;
        if (amt < 0) totalOut += amt;
        else totalIn += amt;
      });
    });
    items.sort(function (a, b) { return a.date.localeCompare(b.date); });
    return { totalNet: totalNet, totalOut: totalOut, totalIn: totalIn, items: items };
  },

  /* Goals sorted by furthest from this month's target, capped at
     `limit`. Used by the dashboard's "Needs attention" band. */
  goalsNeedingAttention(limit, month) {
    void this._listVersion;
    if (!this.profile || !this.profile.goals) return [];
    var m = month || this.currentMonth;
    var self = this;
    var rows = this.profile.goals.map(function (g) {
      var target = g.target || 0;
      var assignedThisMonth = budgetAssigned(self.profile, g.categoryId, m);
      var pct = target > 0 ? (assignedThisMonth / target) : 1;
      return {
        goal: g,
        categoryId: g.categoryId,
        categoryName: self.categoryName(g.categoryId) || "(deleted category)",
        assigned: assignedThisMonth,
        target: target,
        pct: pct,
        deficit: Math.max(0, target - assignedThisMonth),
      };
    });
    rows = rows.filter(function (r) { return r.pct < 1; });
    rows.sort(function (a, b) { return a.pct - b.pct; });
    return rows.slice(0, limit || 3);
  },

  /* Surface deterministic warnings the dashboard should highlight.
     Each alert returns { id, severity, text, href } where severity
     is "danger" | "warn" | "info" and href is the page that resolves
     the alert. Read-only — the user takes action from the link. */
  dashboardAlerts() {
    void this._listVersion;
    var out = [];
    if (!this.profile) return out;
    var today = new Date().toISOString().slice(0, 10);

    /* Rule 1: an on-budget account is negative (excludes credit
       cards + tracking-liabilities — those are expected to be
       negative). */
    var self = this;
    this.profile.accounts.forEach(function (a) {
      if (a.type === "credit" || a.type === "tracking-liability") return;
      var bal = self.accountBalance(a.id);
      if (bal < 0) {
        out.push({
          id: "neg-" + a.id,
          severity: "danger",
          text: a.name + " is overdrawn — balance " + ((bal / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })),
          href: "/app/register/?account=" + a.id,
        });
      }
    });

    /* Rule 2: scheduled templates whose nextDate is already in the
       past — the user missed one. */
    this.profile.scheduled.forEach(function (s) {
      if (s.nextDate && s.nextDate.slice(0, 10) < today) {
        var name = (s.template && s.template.payeeName) || "Scheduled item";
        out.push({
          id: "overdue-" + s.id,
          severity: "warn",
          text: name + " was due " + s.nextDate.slice(0, 10) + " — approve or skip.",
          href: "/app/scheduled/",
        });
      }
    });

    /* Rule 3: more than $100 sitting in Ready to Assign — nudge the
       user to assign it before it loses its job. */
    var rta = this.readyToAssign(this.currentMonth);
    if (rta > 10000) {
      out.push({
        id: "rta-unassigned",
        severity: "info",
        text: ((rta / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })) + " is unassigned this month.",
        href: "/app/budget/",
      });
    }

    /* Rule 4: zero transactions in the last 30 days — profile may
       be stale or abandoned. */
    var thirtyAgo = new Date(); thirtyAgo.setDate(thirtyAgo.getDate() - 30);
    var thirtyAgoISO = thirtyAgo.toISOString().slice(0, 10);
    var recentCount = this.profile.transactions.filter(function (t) {
      return t.date >= thirtyAgoISO;
    }).length;
    if (this.profile.transactions.length > 0 && recentCount === 0) {
      out.push({
        id: "no-recent-activity",
        severity: "info",
        text: "No transactions in the last 30 days — try the quick-add (N).",
        href: "/app/register/",
      });
    }

    /* Rule 5: any overspent category. Aggregated into one alert so
       long lists don't drown the panel. */
    var os = this.overspentCount();
    if (os.count > 0) {
      out.push({
        id: "overspent",
        severity: "warn",
        text: os.count + " categor" + (os.count === 1 ? "y" : "ies") + " overspent by " + ((os.totalDeficit / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })) + ".",
        href: "/app/budget/",
      });
    }

    /* Rule 6: accounts flagged exclude-from-net-worth. Reminder
       note (info, not warn) so users glancing at the dashboard
       remember that their displayed net worth omits these
       balances. Only fires when at least one account is excluded
       AND its total is non-zero. */
    var excludedSum = 0;
    var excludedCount = 0;
    this.profile.accounts.forEach(function (a) {
      if (a.closedAt) return;
      if (!a.excludeFromNetWorth) return;
      excludedCount += 1;
      excludedSum += self.accountBalance(a.id);
    });
    if (excludedCount > 0 && excludedSum !== 0) {
      out.push({
        id: "excluded-from-nw",
        severity: "info",
        text: excludedCount + " account" + (excludedCount === 1 ? "" : "s") + " totaling " + ((excludedSum / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })) + " excluded from net worth.",
        href: "/app/accounts/",
      });
    }

    return out;
  },
};
