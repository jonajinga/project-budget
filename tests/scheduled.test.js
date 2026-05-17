import { describe, it, expect } from "vitest";
import { makeHost } from "./helpers.js";
import { accountsSlice } from "../src/assets/js/store/slices/accounts.js";
import { categoriesSlice } from "../src/assets/js/store/slices/categories.js";
import { scheduledSlice } from "../src/assets/js/store/slices/scheduled.js";

function build() {
  var h = makeHost([accountsSlice, categoriesSlice, scheduledSlice]);
  h.addCategoryGroup("Bills");
  var groupId = h.profile.categoryGroups[0].id;
  var cat = h.addCategory({ name: "Internet", groupId: groupId });
  var acct = h.addAccount({ name: "Checking", type: "checking" });
  return { host: h, cat: cat, acct: acct };
}

describe("scheduledSlice", () => {
  it("addSchedule creates with the requested frequency + bumps lists", () => {
    var ctx = build();
    var before = ctx.host._listVersion;
    var s = ctx.host.addSchedule({
      template: { accountId: ctx.acct.id, payeeName: "Verizon", categoryId: ctx.cat.id, amount: -8000, memo: "", cleared: false },
      frequency: "monthly",
      nextDate: "2024-02-15",
    });
    expect(s).toBeTruthy();
    expect(s.frequency).toBe("monthly");
    expect(s.nextDate).toBe("2024-02-15");
    expect(ctx.host._listVersion).toBeGreaterThan(before);
  });

  it("setSchedulePaused toggles flag + replaces the record by reference", () => {
    var ctx = build();
    var s = ctx.host.addSchedule({
      template: { accountId: ctx.acct.id, payeeName: "X", amount: -100 },
      frequency: "monthly",
      nextDate: "2024-02-01",
    });
    var paused = ctx.host.setSchedulePaused(s.id, true);
    expect(paused.paused).toBe(true);
    var unpaused = ctx.host.setSchedulePaused(s.id, false);
    expect(unpaused.paused).toBe(false);
  });

  it("removeSchedule deletes from the list", () => {
    var ctx = build();
    var s = ctx.host.addSchedule({
      template: { accountId: ctx.acct.id, payeeName: "X", amount: -100 },
      frequency: "monthly",
      nextDate: "2024-02-01",
    });
    expect(ctx.host.profile.scheduled).toHaveLength(1);
    ctx.host.removeSchedule(s.id);
    expect(ctx.host.profile.scheduled).toHaveLength(0);
  });

  it("updateSchedule patches fields + bumps lists", () => {
    var ctx = build();
    var s = ctx.host.addSchedule({
      template: { accountId: ctx.acct.id, payeeName: "X", amount: -100 },
      frequency: "monthly",
      nextDate: "2024-02-01",
    });
    ctx.host.updateSchedule(s.id, { nextDate: "2024-03-01" });
    var updated = ctx.host.profile.scheduled.find(function (x) { return x.id === s.id; });
    expect(updated.nextDate).toBe("2024-03-01");
  });
});
