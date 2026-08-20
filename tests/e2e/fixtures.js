/* Playwright fixtures for Project Budget.
 *
 * These seed localStorage DIRECTLY rather than letting the app auto-load the
 * bundled sample. That decoupling is deliberate and load-bearing: Phase 1
 * changes what a first-time visitor sees (store.js:_bootFromLocalStorage stops
 * auto-loading the sample). If the fixtures depended on that behaviour, the
 * entire suite would break the moment Phase 1 landed -- exactly when it is most
 * needed.
 *
 *   seeded  -- the full 1,399-transaction sample household
 *   empty   -- a valid profile with no data (mirrors newProfile() in schema.js)
 *   virgin  -- nothing in localStorage; a genuine first-time visitor
 */
import { test as base, expect } from "@playwright/test";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

/* The app's OWN import + schema functions, reused verbatim.
 *
 * This is not a convenience -- it is what makes the fixture faithful. The app
 * loads the sample via parseFile() -> importAsNew() (store.js:421-423), and
 * parseFile runs migrate(). An earlier version of this fixture stored the raw
 * sample.json profile instead, skipping migrate(), and produced three
 * false-positive route failures. A fixture that does not match the real load
 * path turns the whole gate into noise. */
import { parseFile, importAsNew } from "../../src/assets/js/io/import-json.js";
import { newProfile } from "../../src/assets/js/store/schema.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SITE = join(ROOT, "_site");

const sample = JSON.parse(
  readFileSync(join(ROOT, "src/assets/sample/sample.json"), "utf8")
);

/* Built once per worker -- parseFile on a 1,399-transaction bundle is not free. */
let _seededProfile = null;
function seededProfile() {
  if (_seededProfile) return _seededProfile;
  const parsed = parseFile(JSON.stringify(sample));
  if (!parsed.ok) throw new Error("sample.json failed to parse: " + parsed.error);
  _seededProfile = importAsNew(parsed, { name: "Sample household" });
  return _seededProfile;
}

/* Key layout comes from store/persist.js:10-16 and store/profile.js:41-48.
   `active` is written with writeRaw, so it is a bare string, NOT JSON --
   wrapping it in quotes here would silently break profile loading. */
const K = {
  profiles: "projectbudget:profiles",
  profile: (id) => "projectbudget:profile:" + id,
  active: "projectbudget:active",
  sampleFlag: "projectbudget:sample-loaded-v2",
};

function indexEntry(p) {
  return { id: p.id, name: p.name, lastOpenedAt: p.updatedAt, schemaVersion: p.schemaVersion };
}

/* Uses the app's own newProfile() so the empty fixture cannot drift from the
   real shape as the schema evolves. */
function emptyProfile() {
  return newProfile("Empty test profile");
}

/* Values are written uncompressed. persist.js:80 falls back to raw JSON for
   any payload lacking the "PB2:" prefix, so plain JSON round-trips fine and
   stays readable when debugging a failing test in devtools. */
async function seed(context, profile) {
  await context.addInitScript(
    ([entries, activeKey, activeId, flagKey]) => {
      try {
        for (const [k, v] of entries) localStorage.setItem(k, v);
        localStorage.setItem(activeKey, activeId);
        /* Set the sample flag so the pre-Phase-1 auto-loader can never fire
           and race the seeded profile. */
        localStorage.setItem(flagKey, "1");
      } catch (_e) { /* private browsing -- test will assert on that path */ }
    },
    [
      [
        [K.profiles, JSON.stringify([indexEntry(profile)])],
        [K.profile(profile.id), JSON.stringify(profile)],
      ],
      K.active,
      profile.id,
      K.sampleFlag,
    ]
  );
}

export const test = base.extend({
  seeded: async ({ context }, use) => {
    await seed(context, seededProfile());
    await use(context);
  },
  empty: async ({ context }, use) => {
    await seed(context, emptyProfile());
    await use(context);
  },
  virgin: async ({ context }, use) => {
    /* Nothing seeded. Explicitly clear so a reused browser context from a
       prior test cannot leak state into a "first visit" assertion. */
    await context.addInitScript(() => {
      try { localStorage.clear(); } catch (_e) {}
    });
    await use(context);
  },
});

export { expect };

/* Routes are DISCOVERED from the build rather than hard-coded. A new page
   added in six months is then covered by the a11y and smoke gates
   automatically -- a static list would quietly leave it unchecked. */
export function appRoutes() {
  if (!existsSync(SITE)) throw new Error("_site missing -- run `npm run build` first.");
  const out = [];
  (function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "index.html") {
        const rel = relative(SITE, dir).split(sep).join("/");
        out.push(rel ? `/${rel}/` : "/");
      }
    }
  })(SITE);
  return out.sort();
}

export function appOnlyRoutes() {
  return appRoutes().filter((r) => r.startsWith("/app/"));
}
