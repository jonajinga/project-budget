/* Age of money (phase 6): FIFO dollars - queue inflows by date, spend
 * oldest-first, report the amount-weighted average age in days of the
 * dollars consumed by the last 10 outflows. Hand-computed fixture. */
import { describe, it, expect } from "vitest";
import { newProfile } from "../src/assets/js/store/schema.js";
import { ageOfMoney, projectedAgeOfMoney } from "../src/assets/js/domain/insights.js";

function tiny() {
  const p = newProfile("aom");
  const txn = (date, amount, over) => p.transactions.push(Object.assign(
    { id: "t" + p.transactions.length, date, amount, accountId: "a1", categoryId: null, transferTxnId: null }, over));
  return { p, txn };
}

describe("ageOfMoney", () => {
  it("is null with no outflows", () => {
    const { p, txn } = tiny();
    txn("2025-01-01", 10000);
    expect(ageOfMoney(p, "2025-02-01")).toBeNull();
  });

  it("FIFO: spending consumes the oldest dollars first", () => {
    const { p, txn } = tiny();
    txn("2025-01-01", 10000);              /* 100 aged dollars */
    txn("2025-01-21", 10000);              /* 100 newer dollars */
    /* Spend 150 on Jan 31: 100 from Jan 1 (30 days) + 50 from Jan 21
       (10 days) -> weighted age = (100*30 + 50*10)/150 = 23.33 -> 23. */
    txn("2025-01-31", -15000, { categoryId: "c1" });
    expect(ageOfMoney(p, "2025-01-31")).toBe(23);
  });

  it("transfers are invisible to the FIFO", () => {
    const { p, txn } = tiny();
    txn("2025-01-01", 10000);
    txn("2025-01-15", -5000, { transferTxnId: "pair" });
    txn("2025-01-15", 5000, { transferTxnId: "pair" });
    txn("2025-01-31", -5000, { categoryId: "c1" });
    expect(ageOfMoney(p, "2025-01-31")).toBe(30);
  });

  it("only the LAST 10 outflows set the age", () => {
    const { p, txn } = tiny();
    txn("2025-01-01", 100000);
    /* 10 tiny old spends in February... */
    for (let i = 1; i <= 10; i++) txn("2025-02-0" + (i < 10 ? i : 9), -1000, { categoryId: "c1" });
    /* ...then 10 spends in June: only these count, and by June the
       remaining January dollars are ~150+ days old. */
    for (let i = 1; i <= 10; i++) txn("2025-06-1" + (i - 1), -1000, { categoryId: "c1" });
    const age = ageOfMoney(p, "2025-06-19");
    expect(age).toBeGreaterThan(140);
  });
});

describe("projectedAgeOfMoney", () => {
  it("adds monthlySaved / avgDailySpend days to the current age", () => {
    const { p, txn } = tiny();
    txn("2025-01-01", 100000);
    /* 90 days x 1000/day outflow ending at asOf. */
    for (let d = 0; d < 90; d++) {
      const dt = new Date(Date.UTC(2025, 0, 2 + d)).toISOString().slice(0, 10);
      txn(dt, -1000, { categoryId: "c1" });
    }
    const asOf = "2025-04-01";
    const current = ageOfMoney(p, asOf);
    /* Saving 30000/month against 1000/day spend -> +30 days. */
    expect(projectedAgeOfMoney(p, 30000, asOf)).toBe(current + 30);
  });

  it("with no spending it returns the current age unchanged", () => {
    const { p, txn } = tiny();
    txn("2025-01-01", 10000);
    expect(projectedAgeOfMoney(p, 50000, "2025-02-01")).toBeNull();
  });
});
