/* Release notes. Newest first. Linked from /changelog/.
   Conventional commits in git provide the raw history; this file is the
   human-curated summary. */

export default [
  {
    version: "0.1.0",
    date: "2026-05-15",
    summary: "First public preview. Profiles, accounts, register, envelope budget, reports, and import/export are all functional. Splits, transfers, reconciliation, and the four goal types are in place.",
    highlights: [
      "Profile management with daily local backups (14-day window)",
      "Six account types, account groups, per-account register, transfers, reconciliation",
      "Envelope budget with credit-card payment categories and four goal types",
      "Seven D3 reports: income vs expense, net worth, spending, trends, debt, assignment history, projection",
      "Import from JSON, CSV (Chase, Capital One, Discover, Mint, Actual), OFX, QFX, QIF, GoCardless",
      "Print stylesheets per page",
      "Light + dark themes",
    ],
  },
];
