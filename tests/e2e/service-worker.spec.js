import { test, expect } from "./fixtures.js";

/* The service worker's cache version must move with the build.
 *
 * It used to be a hand-typed constant with a comment asking whoever edited
 * the file to bump it. It was last bumped on 2026-05-17 and then never again,
 * while every asset URL on every page carried ?v=<build hash> and changed on
 * every single build.
 *
 * The consequence is not subtle and it is not theoretical: a returning browser
 * kept serving the May build of the CSS and JS out of a cache keyed on a
 * frozen string, while fetching current HTML from the network. New markup
 * driven by an old script renders as a blank screen with dead controls, and
 * every fix shipped in between is invisible to the person who already has the
 * site open. It was reported from a real browser as "it seems entirely broken"
 * while the whole test suite was green, because the suite always runs in a
 * fresh context where no service worker has ever installed.
 *
 * A version a human has to remember to change is a version that goes stale.
 * This test is what makes that structural rather than hopeful.
 */

test("the service worker cache version is tied to the build, not hand-typed", async ({ page }) => {
  const sw = await (await page.request.get("/sw.js")).text();

  const version = /CACHE_VERSION\s*=\s*"([^"]+)"/.exec(sw);
  expect(version, "sw.js must declare a CACHE_VERSION").toBeTruthy();

  /* The same token the asset URLs use. If these can drift apart, they will. */
  const html = await (await page.request.get("/app/")).text();
  const assetHash = /global\.css\?v=([a-z0-9]+)/.exec(html);
  expect(assetHash, "the page should cache-bust its CSS with a build hash").toBeTruthy();

  expect(
    version[1],
    "the cache version must contain the build hash, or a deploy leaves returning browsers on stale assets"
  ).toContain(assetHash[1]);

  /* Guard the specific shape of the old bug: a literal date someone typed. */
  expect(
    /^pb-v?\d{4}-\d{2}-\d{2}/.test(version[1]),
    "a hand-typed dated version is exactly what went stale before"
  ).toBe(false);
});
