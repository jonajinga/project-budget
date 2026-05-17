import { describe, it, expect } from "vitest";
import { newProfile, newCategoryGroup, newCategory } from "../src/assets/js/store/schema.js";
import {
  matchCategorizeRule, matchNormalizeRule, applyRules,
  addCategorizeRule, addNormalizeRule, updateRule, deleteRule, moveRule,
} from "../src/assets/js/domain/rules.js";

function seed() {
  var p = newProfile("Rules test");
  var g = newCategoryGroup("Food", 0);
  p.categoryGroups.push(g);
  var groceries = newCategory({ name: "Groceries", groupId: g.id, sortIndex: 0 });
  var coffee    = newCategory({ name: "Coffee",    groupId: g.id, sortIndex: 1 });
  p.categories.push(groceries, coffee);
  return { profile: p, groceries: groceries, coffee: coffee };
}

describe("rules domain", () => {
  it("matchCategorizeRule respects matchType variants", () => {
    var s = seed();
    addCategorizeRule(s.profile, { pattern: "whole foods", matchType: "contains", categoryId: s.groceries.id });
    addCategorizeRule(s.profile, { pattern: "^STARBUCKS",  matchType: "regex",    categoryId: s.coffee.id });
    addCategorizeRule(s.profile, { pattern: "Costco",      matchType: "starts-with", categoryId: s.groceries.id });
    expect(matchCategorizeRule(s.profile, "Whole Foods Mkt 123")?.categoryId).toBe(s.groceries.id);
    expect(matchCategorizeRule(s.profile, "STARBUCKS #4567")?.categoryId).toBe(s.coffee.id);
    expect(matchCategorizeRule(s.profile, "Costco Wholesale")?.categoryId).toBe(s.groceries.id);
    expect(matchCategorizeRule(s.profile, "Random payee")).toBeNull();
  });

  it("first matching rule wins (priority order)", () => {
    var s = seed();
    addCategorizeRule(s.profile, { pattern: "amazon",       matchType: "contains", categoryId: s.coffee.id });
    addCategorizeRule(s.profile, { pattern: "amazon fresh", matchType: "contains", categoryId: s.groceries.id });
    /* "Amazon Fresh" matches BOTH; first rule (coffee) wins. */
    expect(matchCategorizeRule(s.profile, "Amazon Fresh #2")?.categoryId).toBe(s.coffee.id);
  });

  it("disabled rules are skipped", () => {
    var s = seed();
    var r = addCategorizeRule(s.profile, { pattern: "amazon", matchType: "contains", categoryId: s.coffee.id });
    r.enabled = false;
    expect(matchCategorizeRule(s.profile, "Amazon Fresh")).toBeNull();
  });

  it("rule pointing at deleted category id is ignored", () => {
    var s = seed();
    addCategorizeRule(s.profile, { pattern: "test", matchType: "contains", categoryId: "deleted-id" });
    expect(matchCategorizeRule(s.profile, "Test payee")).toBeNull();
  });

  it("invalid regex silently skips (does not throw)", () => {
    var s = seed();
    addCategorizeRule(s.profile, { pattern: "[unclosed", matchType: "regex", categoryId: s.coffee.id });
    expect(matchCategorizeRule(s.profile, "anything")).toBeNull();
  });

  it("applyRules: normalize fires before categorize", () => {
    var s = seed();
    addNormalizeRule(s.profile, { pattern: "WHOLEFDS", matchType: "starts-with", replacement: "Whole Foods" });
    addCategorizeRule(s.profile, { pattern: "whole foods", matchType: "contains", categoryId: s.groceries.id });
    var result = applyRules(s.profile, "WHOLEFDS MKT 1234", null);
    expect(result.name).toBe("Whole Foods");
    expect(result.categoryId).toBe(s.groceries.id);
  });

  it("applyRules falls back to the caller-supplied category id when no rule matches", () => {
    var s = seed();
    var result = applyRules(s.profile, "Random", s.coffee.id);
    expect(result.categoryId).toBe(s.coffee.id);
  });

  it("moveRule shifts priority and clamps at the ends", () => {
    var s = seed();
    var a = addCategorizeRule(s.profile, { pattern: "a", matchType: "contains", categoryId: s.groceries.id });
    var b = addCategorizeRule(s.profile, { pattern: "b", matchType: "contains", categoryId: s.groceries.id });
    var c = addCategorizeRule(s.profile, { pattern: "c", matchType: "contains", categoryId: s.groceries.id });
    moveRule(s.profile, "categorize", c.id, -2);
    expect(s.profile.rules.categorize.map(function (r) { return r.pattern; })).toEqual(["c", "a", "b"]);
    moveRule(s.profile, "categorize", c.id, -5); // clamp at top
    expect(s.profile.rules.categorize[0].pattern).toBe("c");
  });

  it("deleteRule returns true on hit, false on miss", () => {
    var s = seed();
    var r = addCategorizeRule(s.profile, { pattern: "x", matchType: "contains", categoryId: s.coffee.id });
    expect(deleteRule(s.profile, "categorize", r.id)).toBe(true);
    expect(deleteRule(s.profile, "categorize", "missing")).toBe(false);
  });

  it("updateRule patches in place + returns the updated rule", () => {
    var s = seed();
    var r = addCategorizeRule(s.profile, { pattern: "old", matchType: "contains", categoryId: s.coffee.id });
    var updated = updateRule(s.profile, "categorize", r.id, { pattern: "new", enabled: false });
    expect(updated.pattern).toBe("new");
    expect(updated.enabled).toBe(false);
  });
});
