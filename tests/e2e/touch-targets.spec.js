import { test, appOnlyRoutes } from "./fixtures.js";
import { gotoApp } from "./helpers.js";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "touch-target-census.json");

/* WCAG 2.2 SC 2.5.8 Target Size (Minimum), Level AA. SC 2.5.5 (Enhanced,
   AAA) wants 44. We measure both: 24 is the gate, 44 is the aspiration the
   codebase's own base.css comment claims to hit. */
const MIN_AA = 24;
const MIN_AAA = 44;

/* Report-only in Phase 0. It becomes a ratchet in Phase 4a, where the
   base.css 44px rule is rewritten to :where() -- that change silently resizes
   dozens of elements, and this census is the only way to see which. */
test("touch target census at 390px", async ({ seeded, viewport }) => {
  /* Only meaningful at phone width -- skip the desktop project rather than
     recording a second, misleading census at 1280px. */
  test.skip(!viewport || viewport.width > 500, "mobile viewport only");
  test.setTimeout(600_000);

  const census = {};
  const totals = { measured: 0, failAA: 0, failAAA: 0 };

  for (const route of appOnlyRoutes()) {
    const page = await seeded.newPage();
    await gotoApp(page, route);

    const found = await page.evaluate(
      ({ MIN_AA, MIN_AAA }) => {
        const SEL = 'a[href], button, [role="button"], input:not([type="hidden"]), select, textarea, [tabindex="0"]';
        const out = [];
        for (const el of document.querySelectorAll(SEL)) {
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) continue;          // not rendered
          const cs = getComputedStyle(el);
          if (cs.visibility === "hidden" || cs.display === "none") continue;

          /* The effective hit test. A control can render visually small and
             still be operable if a ::before overlay extends its hit area --
             getBoundingClientRect cannot see that, but elementFromPoint can,
             because a pseudo-element resolves to its owning element. Probe
             the corners of a MIN_AA box centred on the control. */
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          const h = MIN_AA / 2;
          const pts = [[cx - h, cy - h], [cx + h, cy - h], [cx - h, cy + h], [cx + h, cy + h]];
          let hits = 0;
          for (const [x, y] of pts) {
            if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
            const hit = document.elementFromPoint(x, y);
            if (hit && (hit === el || el.contains(hit) || hit.contains(el))) hits++;
          }
          const effective = hits === 4;

          const id =
            el.tagName.toLowerCase() +
            (el.className && typeof el.className === "string"
              ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
              : "");

          out.push({
            sel: id,
            w: Math.round(r.width),
            h: Math.round(r.height),
            effective,
            compact: el.hasAttribute("data-touch"),
          });
        }
        return out;
      },
      { MIN_AA, MIN_AAA }
    );

    for (const f of found) {
      totals.measured++;
      const passAA = f.effective || (f.w >= MIN_AA && f.h >= MIN_AA);
      const passAAA = f.w >= MIN_AAA && f.h >= MIN_AAA;
      if (!passAA) totals.failAA++;
      if (!passAAA) totals.failAAA++;
      if (!passAA) {
        const key = f.sel;
        census[key] ||= { smallest: `${f.w}x${f.h}`, count: 0, routes: [], compact: f.compact };
        census[key].count++;
        if (!census[key].routes.includes(route) && census[key].routes.length < 5) {
          census[key].routes.push(route);
        }
      }
    }
    await page.close();
  }

  const sorted = Object.fromEntries(
    Object.entries(census).sort((a, b) => b[1].count - a[1].count)
  );
  writeFileSync(OUT, JSON.stringify({ totals, failing: sorted }, null, 2) + "\n");

  console.log(
    `\nTouch targets at 390px: measured ${totals.measured}, ` +
      `below 24x24 effective: ${totals.failAA}, below 44x44 raw: ${totals.failAAA}`
  );
  console.log("Worst offenders (effective hit area under 24x24):");
  for (const [sel, d] of Object.entries(sorted).slice(0, 15)) {
    console.log(`  ${d.smallest.padEnd(9)} x${String(d.count).padEnd(4)} ${sel}${d.compact ? "  [data-touch]" : ""}`);
  }
});
