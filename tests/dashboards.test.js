import { describe, it, expect } from "vitest";
import { makeHost } from "./helpers.js";
import { dashboardsSlice } from "../src/assets/js/store/slices/dashboards.js";
import { DEFAULT_LAYOUT, sourceSpec, viewSpec, clampSize } from "../src/assets/js/domain/dashboard-widgets.js";

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

  it("every seeded widget names a source and a view the registries know", () => {
    const h = build();
    for (const w of h.dashboardList()[0].widgets) {
      expect(sourceSpec(w.source), `unknown source ${w.source}`).toBeTruthy();
      expect(viewSpec(w.view), `unknown view ${w.view}`).toBeTruthy();
      expect(w.id).toBeTruthy();
      expect(w.params, "params must always be an object").toBeTypeOf("object");
    }
  });
});

describe("dashboardsSlice — widget operations", () => {
  it("moveWidget reorders, and order is the only thing that changes", () => {
    const h = build();
    const d = h.dashboardList()[0];
    const before = d.widgets.map((w) => w.source);
    const moving = d.widgets[0];

    h.moveWidget(d.id, moving.id, 3);

    const after = h.findDashboard(d.id).widgets.map((w) => w.source);
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
    const hero = d.widgets.find((w) => w.source === "panel:hero");
    const view = viewSpec(hero.view);

    h.resizeWidget(d.id, hero.id, 1, 1);

    const after = h.findDashboard(d.id).widgets.find((w) => w.id === hero.id);
    /* Minimums live on the VIEW now: the same data as a big number is legible
       at 2x2 where a chart is a smudge. */
    expect(after.w).toBe(view.minW);
    expect(after.h).toBe(view.minH);
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
    expect(sourceSpec("panel:hero").singleton).toBe(true);

    const added = h.addWidget(d.id, "panel:hero");

    expect(added).toBeNull();
    expect(h.findDashboard(d.id).widgets).toHaveLength(n);
  });

  it("allows a second copy of a non-singleton widget", () => {
    const h = build();
    const d = h.dashboardList()[0];
    const n = d.widgets.length;
    expect(sourceSpec("report:spending").singleton).toBeFalsy();

    const added = h.addWidget(d.id, "report:spending");

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
    expect(copy.widgets.map((w) => w.source)).toEqual(d.widgets.map((w) => w.source));
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
    expect(def.formatVersion).toBe(2);
    expect(def.widgets.length).toBe(DEFAULT_LAYOUT.length);
    /* The whole privacy argument for layout-sharing rests on this: the
       payload must not contain anything derived from the user's money. */
    const json = JSON.stringify(def);
    expect(json).not.toMatch(/transactions|accounts"\s*:\s*\[|balance|payee/i);
    for (const w of def.widgets) {
      expect(Object.keys(w).sort()).toEqual(["h", "params", "settings", "source", "title", "view", "w"]);
    }
  });

  it("import round-trips a layout", () => {
    const h = build();
    const d = h.dashboardList()[0];
    h.resizeWidget(d.id, d.widgets[0].id, 8, 5);
    const def = h.exportDefinition(d.id);

    const imported = h.importDefinition(def);

    expect(imported).toBeTruthy();
    expect(imported.widgets.map((w) => w.source)).toEqual(def.widgets.map((w) => w.source));
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
        { source: "panel:recent", w: 6, h: 4, settings: {} },
        { source: "report:quantum-forecast", w: 6, h: 4, settings: {} },
      ],
    };

    const d = h.importDefinition(payload);

    expect(d.widgets).toHaveLength(1);
    expect(d.widgets[0].source).toBe("panel:recent");
  });

  it("import clamps hostile sizes rather than trusting the file", () => {
    const h = build();
    const d = h.importDefinition({
      kind: "projectbudget.dashboard",
      formatVersion: 1,
      name: "Bad sizes",
      widgets: [{ source: "panel:recent", w: 400, h: -3, settings: {} }],
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
  it("falls back to the source default when handed nonsense", () => {
    const spec = sourceSpec("panel:recent");
    const view = "panel:recent";
    expect(clampSize("panel:recent", view, NaN, NaN)).toEqual({ w: spec.w, h: spec.h });
    expect(clampSize("panel:recent", view, "abc", null)).toEqual({ w: spec.w, h: spec.h });
  });
});

/* ---------------------------------------------------------------------------
   Registry consistency.

   These are the tests that stop this rotting. The registries are two lists of
   plain objects referring to each other and to store methods by NAME, so
   nothing but a test can tell you when a name stops resolving. Rename a report
   method, drop a chart module, mistype an id, and the failure would otherwise
   surface as an empty card on someone's dashboard.
   ------------------------------------------------------------------------- */

import { SOURCES, VIEWS, viewsForSource, normalizeWidget, legacyTypeToWidget } from "../src/assets/js/domain/dashboard-widgets.js";
import { reportsSlice } from "../src/assets/js/store/slices/reports.js";
import { dashboardSlice } from "../src/assets/js/store/slices/dashboard.js";

describe("registry consistency", () => {
  it("every source names a store method that exists", () => {
    const store = makeHost([dashboardsSlice, reportsSlice, dashboardSlice]);
    const missing = SOURCES
      .filter((s) => s.method)
      .filter((s) => typeof store[s.method] !== "function")
      .map((s) => `${s.id} -> ${s.method}()`);
    expect(missing, "sources naming a method the store does not have").toEqual([]);
  });

  it("every source offers at least one view that accepts its shape", () => {
    const orphans = SOURCES.filter((s) => viewsForSource(s).length === 0).map((s) => s.id);
    expect(orphans, "sources with no renderable view").toEqual([]);
  });

  it("every view id a source lists actually exists", () => {
    const known = new Set(VIEWS.map((v) => v.id));
    const dangling = [];
    for (const s of SOURCES) {
      for (const id of s.views) if (!known.has(id)) dangling.push(`${s.id} -> ${id}`);
    }
    expect(dangling, "sources pointing at views that do not exist").toEqual([]);
  });

  it("every source's defaultView is one of its own views", () => {
    const bad = SOURCES
      .filter((s) => s.views.indexOf(s.defaultView) === -1)
      .map((s) => `${s.id} defaults to ${s.defaultView}`);
    expect(bad).toEqual([]);
  });

  it("every declared param has a type the coercer understands", () => {
    const known = new Set(["int", "month", "range", "enum", "bool"]);
    const bad = [];
    for (const s of SOURCES) {
      for (const p of s.params || []) {
        if (!known.has(p.type)) bad.push(`${s.id}.${p.key} is "${p.type}"`);
        if (p.type === "enum" && !(p.options || []).length) bad.push(`${s.id}.${p.key} enum has no options`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("chart views name a module, generic views do not need one", () => {
    const bad = VIEWS.filter((v) => v.kind === "chart" && !v.module).map((v) => v.id);
    expect(bad, "chart views with no renderer module").toEqual([]);
  });
});

describe("v1 -> v2 upgrade", () => {
  /* The thirteen types a v1 profile could contain. If one of these stops
     upgrading, that widget silently disappears from an existing user's
     dashboard on their next load. */
  const LEGACY_TYPES = [
    "hero", "kpis", "alerts", "insights", "accounts", "cashflow",
    "income-expense", "top-categories", "cashflow-30", "upcoming-bills",
    "goals", "recent", "quick-actions",
  ];

  it("upgrades every legacy type without dropping one", () => {
    const dropped = LEGACY_TYPES.filter(
      (type) => !legacyTypeToWidget({ id: "x", type, w: 6, h: 4, settings: {} }, () => "id")
    );
    expect(dropped, "legacy widget types that no longer upgrade").toEqual([]);
  });

  it("preserves the stored geometry through the upgrade", () => {
    const up = legacyTypeToWidget({ id: "keepme", type: "recent", w: 5, h: 7, settings: {} }, () => "new");
    expect(up.id).toBe("keepme");
    expect(up.source).toBe("panel:recent");
    expect(up.w).toBe(5);
    expect(up.h).toBe(7);
  });

  it("is idempotent, because it runs on every read", () => {
    const once = legacyTypeToWidget({ id: "a", type: "goals", w: 12, h: 4 }, () => "id");
    const twice = legacyTypeToWidget(once, () => "id");
    expect(twice).toEqual(once);
  });

  it("a whole v1 dashboard upgrades on read, once, and then stays put", () => {
    const h = build();
    h.dashboardList();
    const d = h.profile.dashboards[0];
    /* Rewrite it as a v1 record, the way an older export would arrive. */
    d.widgets = LEGACY_TYPES.map((type, i) => ({ id: "legacy" + i, type, w: 6, h: 4, settings: {} }));

    const after = h.dashboardList()[0].widgets;
    expect(after).toHaveLength(LEGACY_TYPES.length);
    expect(after.every((w) => w.source && !w.type)).toBe(true);

    const snapshot = JSON.stringify(h.dashboardList()[0].widgets);
    h.dashboardList();
    expect(JSON.stringify(h.dashboardList()[0].widgets)).toBe(snapshot);
  });
});

describe("authored widgets", () => {
  it("places two widgets from one source with different params", () => {
    const h = build();
    const d = h.dashboardList()[0];

    const six = h.addWidget(d.id, { source: "report:income-expense", params: { count: 6 } });
    const twelve = h.addWidget(d.id, { source: "report:income-expense", params: { count: 12 } });

    expect(six).toBeTruthy();
    expect(twelve).toBeTruthy();
    expect(six.id).not.toBe(twelve.id);
    expect(six.params.count).toBe(6);
    expect(twelve.params.count).toBe(12);
  });

  it("refuses a view the source does not accept, falling back rather than dropping", () => {
    const h = build();
    const d = h.dashboardList()[0];
    /* A sankey renderer cannot draw a payee leaderboard. */
    const w = h.addWidget(d.id, { source: "report:payees", view: "chart:sankey" });
    expect(w).toBeTruthy();
    expect(w.view).not.toBe("chart:sankey");
    expect(sourceSpec("report:payees").views).toContain(w.view);
  });

  it("updateWidget records exactly one undo entry for a whole reconfiguration", () => {
    const h = build();
    const d = h.dashboardList()[0];
    const w = h.addWidget(d.id, { source: "report:spending" });

    let undos = 0;
    h._recordUndo = () => { undos++; };

    h.updateWidget(d.id, w.id, {
      title: "Groceries",
      view: "table",
      params: { fromMonth: "2024-01", toMonth: "2024-06" },
      w: 8, h: 6,
    });

    expect(undos, "title + view + params + size is one decision, so one entry").toBe(1);
    const after = h.findDashboard(d.id).widgets.find((x) => x.id === w.id);
    expect(after.title).toBe("Groceries");
    expect(after.view).toBe("table");
    expect(after.params.fromMonth).toBe("2024-01");
  });

  it("a user title wins over the source title, and survives a round trip", () => {
    const h = build();
    const d = h.dashboardList()[0];
    const w = h.addWidget(d.id, { source: "report:spending", title: "Eating out" });
    expect(h.widgetTitle(w)).toBe("Eating out");

    const back = h.importDefinition(h.exportDefinition(d.id));
    expect(back.widgets.some((x) => x.title === "Eating out")).toBe(true);
  });

  it("coerces hostile params instead of trusting them", () => {
    const w = normalizeWidget(
      { source: "report:income-expense", params: { count: 9999, endMonth: "not-a-month" } },
      () => "id"
    );
    expect(w.params.count).toBeLessThanOrEqual(36);
    expect(w.params.endMonth, "an unparseable month falls back to the default").toBeNull();
  });

  it("strips keys it does not declare, so an import cannot smuggle in a layout model", () => {
    const w = normalizeWidget(
      { source: "panel:recent", w: 6, h: 4, x: 3, y: 9, zIndex: 40, onclick: "alert(1)" },
      () => "id"
    );
    expect(Object.keys(w).sort()).toEqual(["h", "id", "params", "settings", "source", "title", "view", "w"]);
  });

  it("duplicateWidget copies the config but not the id, and refuses singletons", () => {
    const h = build();
    const d = h.dashboardList()[0];
    const w = h.addWidget(d.id, { source: "report:spending", params: { fromMonth: "2024-02" } });

    const copy = h.duplicateWidget(d.id, w.id);
    expect(copy.id).not.toBe(w.id);
    expect(copy.params.fromMonth).toBe("2024-02");

    const hero = h.findDashboard(d.id).widgets.find((x) => x.source === "panel:hero");
    expect(h.duplicateWidget(d.id, hero.id), "a singleton must not duplicate").toBeNull();
  });
});
