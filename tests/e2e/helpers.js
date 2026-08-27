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

  /* Only /app/* has the store. The public site -- marketing pages, docs, the
     blog, /style-guide/ -- deliberately does not load it since the split in
     layouts/marketing.njk, so waiting for it there burns the full 5s + 6s and
     then carries on anyway. theme-contrast.spec.js drives /style-guide/ once
     per theme, so that quietly added ~11s x 13 themes and pushed the sweep
     past its own 10-minute budget: 40s before, 24 minutes after, failing with
     "Target page, context or browser has been closed".

     Both waits are swallowed by design, which is exactly why this went slow
     rather than red. */
  if (route.startsWith("/app/")) {
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
  } else {
    /* Alpine still runs the header and theme picker on the public site. */
    await page
      .waitForFunction(() => !!window.Alpine, { timeout: 5000 })
      .catch(() => {});
  }

  return { errors, bad };
}
