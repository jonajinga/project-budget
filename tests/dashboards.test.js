import { describe, it, expect } from "vitest";
import { makeHost } from "./helpers.js";
import { dashboardsSlice } from "../src/assets/js/store/slices/dashboards.js";
import { DEFAULT_LAYOUT, widgetSpec, clampSize } from "../src/assets/js/domain/dashboard-widgets.js";

function build() {
  return makeHost([dashboardsSlice]);
}

describe("dashboardsSlice — seeding", () => {
  it("seeds one default dashboard on first read, not on every read", () => {
    const h = build();
    expect(h.profile.dashboards).toEqual([]);
    const first = h.dashboardList();
    expect(first).toHaveLength(1);
    expect(first[0].name).toBe("Overview");
    expect(first[0].widgets).toHaveLength(DEFAULT_LAYOUT.length);

    /* Reading again must not add a second one. A seeder that runs per read
       silently multiplies dashboards on a page that polls. */
    h.dashboardList();
    h.dashboardList();
    expect(h.profile.dashboards).toHaveLength(1);
  });

  it("every seeded widget is a type the catalogue knows", () => {
    const h = build();
    for (const w of h.dashboardList()[0].widgets) {
      expect(widgetSpec(w.type), `unknown widget type ${w.type}`).toBeTruthy();
      expect(w.id).toBeTruthy();
    }
  });
});

describe("dashboardsSlice — widget operations", () => {
  it("moveWidget reorders, and order is the only thing that changes", () => {
    const h = build();
    const d = h.dashboardList()[0];
    const before = d.widgets.map((w) => w.type);
    const moving = d.widgets[0];

    h.moveWidget(d.id, moving.id, 3);

    const after = h.findDashboard(d.id).widgets.map((w) => w.type);
    expect(after).not.toEqual(before);
    expect(after[3]).toBe(before[0]);
    /* Same set, same length — a reorder must not drop or duplicate. */
    expect([...after].sort()).toEqual([...before].sort());
  });

  /* A negative index is the case the clamp actually earns its keep on.
     splice(999, 0, x) already appends, so a test using a large index passes
     with the clamp removed -- it asserts what JavaScript does for free, not
     what this code does. splice(-2, 0, x) inserts NEAR THE END, so without
     the clamp a widget dragged past the left edge lands in the wrong place.
     A drag handler computing -1 is not hypothetical: pointer maths does it
     the moment you drag above the first row. */
  it("moveWidget clamps a NEGATIVE index to the front", () => {
    const h = build();
    const d = h.dashboardList()[0];
    const moving = d.widgets[4];

    h.moveWidget(d.id, moving.id, -3);

    const after = h.findDashboard(d.id).widgets;
    expect(after[0].id).toBe(moving.id);
    expect(after).toHaveLength(d.widgets.length);
  });

  it("moveWidget clamps an out-of-range index instead of losing the widget", () => {
    const h = build();
    const d = h.dashboardList()[0];
    const n = d.widgets.length;
    const moving = d.widgets[0];

    h.moveWidget(d.id, moving.id, 999);

    const after = h.findDashboard(d.id).widgets;
    expect(after).toHaveLength(n);
    expect(after[after.length - 1].id).toBe(moving.id);
  });

  it("resizeWidget clamps to the widget's own minimum, not a global one", () => {
    const h = build();
    const d = h.dashboardList()[0];
    const hero = d.widgets.find((w) => w.type === "hero");
    const spec = widgetSpec("hero");

    h.resizeWidget(d.id, hero.id, 1, 1);

    const after = h.findDashboard(d.id).widgets.find((w) => w.id === hero.id);
    expect(after.w).toBe(spec.minW);
    expect(after.h).toBe(spec.minH);
  });

  it("resizeWidget cannot exceed the grid width", () => {
    const h = build();
    const d = h.dashboardList()[0];
    const w = d.widgets[0];
    h.resizeWidget(d.id, w.id, 99, 3);
    expect(h.findDashboard(d.id).widgets.find((x) => x.id === w.id).w).toBe(12);
  });

  it("refuses a second copy of a singleton widget", () => {
    const h = build();
    const d = h.dashboardList()[0];
    const n = d.widgets.length;
    expect(widgetSpec("hero").singleton).toBe(true);

    const added = h.addWidget(d.id, "hero");

    expect(added).toBeNull();
    expect(h.findDashboard(d.id).widgets).toHaveLength(n);
  });

  it("allows a second copy of a non-singleton widget", () => {
    const h = build();
    const d = h.dashboardList()[0];
    const n = d.widgets.length;
    expect(widgetSpec("top-categories").singleton).toBeFalsy();

    const added = h.addWidget(d.id, "top-categories");

    expect(added).toBeTruthy();
    expect(h.findDashboard(d.id).widgets).toHaveLength(n + 1);
  });

  it("removeWidget takes exactly one, by id", () => {
    const h = build();
    const d = h.dashboardList()[0];
    const n = d.widgets.length;
    const target = d.widgets[2];

    h.removeWidget(d.id, target.id);

    const after = h.findDashboard(d.id).widgets;
    expect(after).toHaveLength(n - 1);
    expect(after.find((w) => w.id === target.id)).toBeUndefined();
  });
});

describe("dashboardsSlice — dashboard CRUD", () => {
  it("refuses to delete the last dashboard", () => {
    const h = build();
    const d = h.dashboardList()[0];

    const ok = h.deleteDashboard(d.id);

    expect(ok).toBe(false);
    expect(h.dashboardList()).toHaveLength(1);
  });

  it("soft-deletes rather than dropping the record, so undo can restore it", () => {
    const h = build();
    const first = h.dashboardList()[0];
    h.createDashboard("Second", []);

    h.deleteDashboard(first.id);

    expect(h.dashboardList()).toHaveLength(1);
    /* Still on the profile, just flagged — the project's rule about never
       hard-deleting user data. */
    expect(h.profile.dashboards).toHaveLength(2);
    const raw = h.profile.dashboards.find((d) => d.id === first.id);
    expect(raw.deletedAt).toBeTruthy();
  });

  it("deleting the active dashboard moves you to a surviving one", () => {
    const h = build();
    const first = h.dashboardList()[0];
    const second = h.createDashboard("Second", []);
    expect(h.activeDashboardId()).toBe(second.id);

    h.deleteDashboard(second.id);

    expect(h.activeDashboardId()).toBe(first.id);
    expect(h.activeDashboard()).toBeTruthy();
  });

  it("duplicate copies the layout but not the widget ids", () => {
    const h = build();
    const d = h.dashboardList()[0];

    const copy = h.duplicateDashboard(d.id);

    expect(copy.id).not.toBe(d.id);
    expect(copy.widgets.map((w) => w.type)).toEqual(d.widgets.map((w) => w.type));
    /* Shared ids would mean editing one dashboard's widget addressed the
       other's. */
    const ids = new Set(d.widgets.map((w) => w.id));
    for (const w of copy.widgets) expect(ids.has(w.id)).toBe(false);
  });
});

describe("dashboardsSlice — portability", () => {
  it("the exported definition carries layout and no figures", () => {
    const h = build();
    const def = h.exportDefinition(h.dashboardList()[0].id);

    expect(def.kind).toBe("projectbudget.dashboard");
    expect(def.widgets.length).toBe(DEFAULT_LAYOUT.length);
    /* The whole privacy argument for layout-sharing rests on this: the
       payload must not contain anything derived from the user's money. */
    const json = JSON.stringify(def);
    expect(json).not.toMatch(/transactions|accounts"\s*:\s*\[|balance|payee/i);
    for (const w of def.widgets) {
      expect(Object.keys(w).sort()).toEqual(["h", "settings", "type", "w"]);
    }
  });

  it("import round-trips a layout", () => {
    const h = build();
    const d = h.dashboardList()[0];
    h.resizeWidget(d.id, d.widgets[0].id, 8, 5);
    const def = h.exportDefinition(d.id);

    const imported = h.importDefinition(def);

    expect(imported).toBeTruthy();
    expect(imported.widgets.map((w) => w.type)).toEqual(def.widgets.map((w) => w.type));
    expect(imported.widgets[0].w).toBe(8);
    expect(imported.widgets[0].h).toBe(5);
  });

  it("import drops widget types this version does not know", () => {
    const h = build();
    const payload = {
      kind: "projectbudget.dashboard",
      formatVersion: 1,
      name: "From the future",
      widgets: [
        { type: "recent", w: 6, h: 4, settings: {} },
        { type: "quantum-forecast", w: 6, h: 4, settings: {} },
      ],
    };

    const d = h.importDefinition(payload);

    expect(d.widgets).toHaveLength(1);
    expect(d.widgets[0].type).toBe("recent");
  });

  it("import clamps hostile sizes rather than trusting the file", () => {
    const h = build();
    const d = h.importDefinition({
      kind: "projectbudget.dashboard",
      formatVersion: 1,
      name: "Bad sizes",
      widgets: [{ type: "recent", w: 400, h: -3, settings: {} }],
    });

    expect(d.widgets[0].w).toBeLessThanOrEqual(12);
    expect(d.widgets[0].h).toBeGreaterThan(0);
  });

  it("refuses a file that is not a dashboard", () => {
    const h = build();
    const before = h.dashboardList().length;

    expect(h.importDefinition({ kind: "projectbudget.transactions", rows: [] })).toBeNull();
    expect(h.importDefinition("not json at all")).toBeNull();
    expect(h.importDefinition({ kind: "projectbudget.dashboard", widgets: [] })).toBeNull();

    expect(h.dashboardList()).toHaveLength(before);
  });
});

describe("clampSize", () => {
  it("falls back to the spec default when handed nonsense", () => {
    const spec = widgetSpec("recent");
    expect(clampSize("recent", NaN, NaN)).toEqual({ w: spec.w, h: spec.h });
    expect(clampSize("recent", "abc", null)).toEqual({ w: spec.w, h: spec.h });
  });
});
