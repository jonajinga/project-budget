/* Shared navigation helper.
 *
 * Every /app/ page renders through Alpine, so asserting on DOM before Alpine
 * has booted produces flaky, meaningless failures. This waits for the store to
 * exist and for the loading overlay to clear before handing back control.
 */
export async function gotoApp(page, route) {
  const errors = [];
  const bad = [];
  page.on("pageerror", (e) => errors.push(`${route}: ${e.message}`));
  page.on("response", (r) => {
    if (r.status() >= 400) bad.push(`${route}: ${r.status()} ${r.url()}`);
  });

  await page.goto(route, { waitUntil: "domcontentloaded" });

  /* store.js:298-303 has a hard 4s safety timeout on the loading flag, so
     5s here is comfortably past the app's own worst case. */
  await page
    .waitForFunction(
      () => window.Alpine && window.Alpine.store && window.Alpine.store("budget"),
      { timeout: 5000 }
    )
    .catch(() => {});
  await page
    .waitForFunction(
      () => {
        const s = window.Alpine?.store?.("budget");
        return s ? s.loading === false : false;
      },
      { timeout: 6000 }
    )
    .catch(() => {});

  return { errors, bad };
}
