/* What changed, written for the people who use the app.
 *
 * House rules for entries, so the page stays worth reading:
 *   - Say what a person will notice, not what the code does. "Restoring
 *     a deleted transaction now works on a phone", never "refactored
 *     the trash table".
 *   - No jargon, no class names, no commit hashes.
 *   - `kind` is one of: fixed, added, improved, changed.
 *   - `detail` is optional and answers "why did that happen?" for
 *     anyone curious. One or two sentences.
 *   - Newest release first; entries within a release in the order a
 *     person would care about them.
 *
 * `date` is the day the work landed, ISO, and drives the page's
 * grouping and its "what's new since you were last here" marker.
 */
export default [
  {
    version: "2026.09.04",
    date: "2026-09-04",
    title: "A sweep across every screen",
    summary:
      "Every page in the app was checked at desktop, tablet and phone size. Money is written the same way everywhere, tables stop hiding the numbers on small screens, and two reports that had been drawing nothing now draw again.",
    entries: [
      {
        kind: "fixed",
        title: "Amounts always show cents, everywhere",
        detail:
          "Some screens rounded to whole dollars and the sidebar shortened totals to things like $27.8k, so the same balance could appear three different ways. Every amount now reads in full, with cents and thousands separators.",
      },
      {
        kind: "fixed",
        title: "Two reports that showed an empty box now show their charts",
        detail:
          "Monthly trends and assignment history depend on a charting library that was only being loaded for three other reports, so they quietly rendered nothing at all.",
      },
      {
        kind: "improved",
        title: "The cashflow projection opens in under two seconds",
        detail:
          "It used to take about sixteen seconds with a full budget, because it recalculated each category's entire history once for every goal in every projected month.",
      },
      {
        kind: "fixed",
        title: "The register keeps its amount and row menu on screen",
        detail:
          "On a tablet the table was wider than the space it had, so the memo, amount, cleared mark and row actions all sat past the right edge. On a phone each row was four lines tall; it is two now, and shows the account as well.",
      },
      {
        kind: "improved",
        title: "The dashboard fits on a phone",
        detail:
          "It was about twenty screens long with every card open. Cards fold now, the top four stay open, and the app remembers which ones you leave open on that device.",
      },
      {
        kind: "fixed",
        title: "Account names are no longer cut off mid-word",
        detail:
          "Names like \"Home value (Zestimate)\" were being sliced. They end in an ellipsis now, with the full name on hover.",
      },
      {
        kind: "fixed",
        title: "Deleted transactions can be restored from a phone",
        detail:
          "The trash list ran off the side of a phone screen after the account column, which put the Restore button out of reach.",
      },
      {
        kind: "improved",
        title: "The health check says what matters in one line",
        detail:
          "Seven passing checks each took a full card to report nothing, which buried the one check that had found something.",
      },
      {
        kind: "fixed",
        title: "Months read as months",
        detail:
          "Report tables and chart axes printed raw values like 2025-10, and axes sometimes showed a bare 10, which is ambiguous when a chart spans two years.",
      },
      {
        kind: "fixed",
        title: "The savings rate chart is readable again",
        detail:
          "A single month with almost no income produced a rate far off the scale and flattened the other eleven months into a straight line. The chart now fits the normal range and names the unusual month underneath.",
      },
      {
        kind: "changed",
        title: "One Add button instead of a floating one",
        detail:
          "The floating button sat on top of table columns and chart corners. Adding a transaction is now in the bottom bar on a phone and in the top bar on larger screens.",
      },
      {
        kind: "added",
        title: "This changelog",
        detail:
          "So you can see what changed without reading the code.",
      },
    ],
  },
  {
    version: "2026.09.03",
    date: "2026-09-03",
    title: "Cuts, and a history for every category",
    summary:
      "A planned cut is a promise to spend less in one category than you used to. This release gives cuts their own page, and gives every category and group a page showing what it has actually done over time.",
    entries: [
      {
        kind: "added",
        title: "A Cuts page",
        detail:
          "Shows what your cuts are planned to save each month, what they have actually saved, what that adds up to over a year, and how each one has held month by month. Each cut is measured against what the category averaged in the three months before it started, so the savings are real rather than aspirational.",
      },
      {
        kind: "added",
        title: "A history page for every category and group",
        detail:
          "Spending against what you assigned, what was left at each month end, averages over three, six and twelve months, the trend, goal history, top payees and the transactions themselves. Reachable from the menu next to any category or group on the budget screen.",
      },
      {
        kind: "improved",
        title: "A fuller sample budget",
        detail:
          "The sample household now spans five years of history and eighteen months of plans, with every account type, goal type and report populated.",
      },
    ],
  },
];
