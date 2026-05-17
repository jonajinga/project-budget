import { describe, it, expect } from "vitest";
import { makeHost } from "./helpers.js";
import { categoriesSlice } from "../src/assets/js/store/slices/categories.js";
import { accountsSlice } from "../src/assets/js/store/slices/accounts.js";

function build() {
  return makeHost([categoriesSlice, accountsSlice]);
}

describe("categoriesSlice", () => {
  it("addCategoryGroup appends with the right name + bumps lists", () => {
    var h = build();
    var g = h.addCategoryGroup("Food");
    expect(g).toBeTruthy();
    expect(g.name).toBe("Food");
    expect(h.profile.categoryGroups).toHaveLength(1);
    expect(h._listVersion).toBeGreaterThan(0);
  });

  it("addCategory attaches to its group + bumps lists", () => {
    var h = build();
    var g = h.addCategoryGroup("Food");
    var c = h.addCategory({ name: "Groceries", groupId: g.id });
    expect(c.name).toBe("Groceries");
    expect(c.groupId).toBe(g.id);
    expect(h.profile.categories).toHaveLength(1);
  });

  it("renameCategory updates the name + preserves the id", () => {
    var h = build();
    var g = h.addCategoryGroup("Food");
    var c = h.addCategory({ name: "Old", groupId: g.id });
    h.renameCategory(c.id, "New");
    var found = h.findCategory(c.id);
    expect(found.name).toBe("New");
  });

  it("deleteCategoryGroup unparents but keeps its categories", () => {
    var h = build();
    var g = h.addCategoryGroup("Food");
    h.addCategory({ name: "Groceries", groupId: g.id });
    h.addCategory({ name: "Coffee", groupId: g.id });
    h.deleteCategoryGroup(g.id);
    expect(h.profile.categoryGroups).toHaveLength(0);
    /* Categories themselves stay; their groupId gets cleared by the
       domain implementation so they appear under "Ungrouped". */
    expect(h.profile.categories).toHaveLength(2);
  });

  it("moveCategory reparents and renumbers sortIndex", () => {
    var h = build();
    var a = h.addCategoryGroup("A");
    var b = h.addCategoryGroup("B");
    var c1 = h.addCategory({ name: "C1", groupId: a.id });
    var c2 = h.addCategory({ name: "C2", groupId: a.id });
    h.moveCategory(c2.id, b.id, 0);
    expect(h.findCategory(c2.id).groupId).toBe(b.id);
    expect(h.findCategory(c2.id).sortIndex).toBe(0);
    /* c1 stays in A. */
    expect(h.findCategory(c1.id).groupId).toBe(a.id);
  });

  it("moveCategoryGroup reorders groups by sortIndex", () => {
    var h = build();
    var a = h.addCategoryGroup("A");
    var b = h.addCategoryGroup("B");
    var c = h.addCategoryGroup("C");
    /* Move A from index 0 to index 2. */
    h.moveCategoryGroup(a.id, 2);
    var ordered = h.profile.categoryGroups
      .slice()
      .sort(function (x, y) { return x.sortIndex - y.sortIndex; })
      .map(function (g) { return g.name; });
    expect(ordered).toEqual(["B", "C", "A"]);
  });

  it("toggleCategoryGroupCollapsed flips persistent state", () => {
    var h = build();
    var g = h.addCategoryGroup("Food");
    expect(h.isCatGroupCollapsed(g.id)).toBe(false);
    h.toggleCategoryGroupCollapsed(g.id);
    expect(h.isCatGroupCollapsed(g.id)).toBe(true);
    /* And persists on the group object. */
    expect(h.findCategoryGroup(g.id).collapsed).toBe(true);
  });

  it("setAllCatGroupsCollapsed sets every group at once", () => {
    var h = build();
    h.addCategoryGroup("A");
    h.addCategoryGroup("B");
    h.addCategoryGroup("C");
    h.setAllCatGroupsCollapsed(true);
    expect(h.allCatGroupsCollapsed()).toBe(true);
    h.setAllCatGroupsCollapsed(false);
    expect(h.allCatGroupsCollapsed()).toBe(false);
  });

  it("categoriesFlat returns Group / Name strings, skips hidden", () => {
    var h = build();
    var g = h.addCategoryGroup("Food");
    h.addCategory({ name: "Groceries", groupId: g.id });
    var hidden = h.addCategory({ name: "Coffee", groupId: g.id });
    /* Hide one. */
    h.profile.categories.find(function (c) { return c.id === hidden.id; }).hidden = true;
    var flat = h.categoriesFlat();
    /* categoriesFlat returns visible cats with Group / Name format. */
    expect(flat.map(function (x) { return x.name; })).toContain("Food / Groceries");
    expect(flat.map(function (x) { return x.name; })).not.toContain("Food / Coffee");
  });

  it("isIncomeGroup honors kind=income; name fallback works too", () => {
    var h = build();
    var g = h.addCategoryGroup("Income");
    /* New groups default to kind: "expense" (from schema), so the
       Income group only matches via the name fallback. */
    g.kind = undefined;
    expect(h.isIncomeGroup(g)).toBe(true);
    g.kind = "expense";
    expect(h.isIncomeGroup(g)).toBe(false);
    g.kind = "income";
    expect(h.isIncomeGroup(g)).toBe(true);
  });
});
