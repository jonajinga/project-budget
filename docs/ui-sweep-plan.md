# App-wide UI sweep: findings and plan

Date: 2026-09-04. Status: DRAFT, awaiting Jon's answers to the open
questions at the end. Nothing in this plan has been built.

## How the findings were gathered

Every app route (47, including the two new history pages) was loaded
headlessly with the sample household at 1440, 1024 and 390 pixels wide.
A script measured horizontal overflow, clipped text, wrapped names and
money formats, and took a full-page screenshot of each. Four reviewers
then read all 136 screenshots against the checklist of problems fixed on
the budget page. Claims that could be artifacts were checked in code.

Known artifacts, not defects: in a full-page capture the phone tab bar,
the floating add button and the left sidebar are fixed elements, so they
appear once mid-page. The budget grid scrolls inside a fixed-height
area, so it looks cut off in a tall capture. The export page is a
deliberate redirect to backup. The audit log defaults to 30 days, so its
rows were correct.

## Confirmed bugs (not layout)

1. **Trends and assignment-history reports draw nothing.** Their chart
   modules need d3, which is only loaded for spending, heatmap and
   sankey. The module returns silently. Fix: add both routes to the d3
   list in the layout and the router, or move the two charts to the
   inline SVG helper used by the history pages.
2. **Projection report takes 16 seconds** with the sample data at every
   width. Needs profiling; likely the projection walks all transactions
   per month per account.
3. **Diagnostics says "Profile count: 0"** because it builds its text at
   init before the profile has loaded.
4. **Savings-rate chart** shows a -772% outlier month that flattens the
   other eleven months, and prints one value as "$-4250.15".
5. **About this profile** prints "Excluded accounts:Sofia 529,Lucas 529"
   with no spaces.
6. **Calendar** week footers show "NET $0" for weeks that have entries,
   and per-day IN/OUT/NET footers appear in one week only.

## Systemic findings, by theme

### A. Money formatting (every page)

- KPI tiles drop cents on the dashboard and on every report
  ("$118,017", "$847,999"). Fifteen files carry a whole-dollar
  formatter.
- Report tables print cents but no thousands separators ("$229395.76")
  because twenty-one templates format inline with toFixed(2).
- Calendar abbreviates every amount ("-$1.9k"); heatmap cells show
  "$4k"; sidebar group totals show "$27.8k".
- Dashboard recent transactions and upcoming bills show whole dollars.

Proposed fix: one shared formatter on the store (cents always, sign
before the symbol, separators), used by every template. Chart axis
ticks may stay whole-dollar. Delete the fifteen local formatters and
the twenty-one inline toFixed sites.

### B. Tables at tablet and phone widths

- Desktop: the register table is wider than 1440 and clips its Actions
  column.
- Tablet (1024): register loses memo, amount, cleared and actions;
  recurring loses amount, Post and the menu; budget-vs-actual,
  subscriptions, debt and the new history tables wrap or clip.
- Phone (390): budget-vs-actual, payees, subscriptions, debt,
  projection, spending, trash, audit log and the history pages drop
  their money columns or push them off-screen. Trash cannot restore on
  phone. Profiles keeps a three-column table.
- Long tables (budget-vs-actual 68 rows, payees, audit log) have no
  sticky header. Accounts repeats its column header once per group.

Proposed fix: one responsive table recipe used everywhere: a column
priority attribute so low-value columns hide first and money and
actions never hide; horizontal scroll inside the card with a sticky
first column when it still does not fit; the phone card stack already
used on cuts, register and payees; sticky headers on tables over about
fifteen rows.

### C. KPI tile strips

- Four-up strips at 1024 truncate their headline value ("Brokerage…",
  "Rocket Mor…", "2026-05 · 7…") and wrap labels to two or three
  lines on every report.
- On phones the tiles stack one per row, so the dashboard opens with
  six near-empty tiles and reports with four.
- Five-tile strips leave a lone tile on the second row (cuts, dashboard).

Proposed fix: one strip recipe: two-up on phones, three-up on tablets,
auto-fit on desktop; values allowed to shrink in font size before they
truncate; labels never wrap.

### D. Names and labels

- Dashboard account tiles clip names ("Home value (Zestimat"); accounts
  on phone clips names and group pills; calendar chips truncate every
  payee and reduce to one letter at 1024; the calendar title becomes
  "S…".
- Year-over-year date inputs clip their own text at every width.
- Sidebar group labels truncate ("EVERYD…") and the sidebar clips its
  last account.

Proposed fix: apply the budget page rule everywhere: names single-line
with an ellipsis and a tooltip, never wrapped, never clipped mid-glyph;
give name columns the flexible width and numbers fixed widths.

### E. Dead space and page chrome

- Explanatory paragraphs open most pages and push controls down
  (backup, import, diagnostics, health-check, subscriptions, every
  report). Backup and diagnostics render prose cards at half width,
  leaving an empty column.
- Health check shows eight full-height cards, seven of them passing.
- Dashboard quick-actions card is mostly empty; the 30-day cashflow chart
  fills less than half its card; the phone dashboard is 8,000 pixels.
- Reports index and tools grids leave orphan tiles.
- Import has ~460 pixels of nothing above the footer and a raw file
  input.

Proposed fix: move page prose behind the info button pattern already
used on profiles; a shared page header with title, one-line lead and
actions on one row; charts sized to their cards; collapse passing
health checks; grids that never orphan a tile.

### F. Charts

- Category page axis labels collide ("Aug 26Sep 26"); cuts axis text is
  tiny on desktop.
- Sankey labels overlap on the right; treemap labels clip; heatmap has
  no legend and hides values at 1024; debt chart uses one colour.
- Income vs expense and net worth are the only two solid charts.

Proposed fix: fix the mini-chart helper (label thinning by measured
width, larger type on wide cards); replace or repair the d3 charts one
by one; add legends where series are not obvious.

### G. Calendar on phones

The phone calendar shows unlabeled coloured blobs with no payee, amount
or legend, and the toolbar becomes six stacked rows. This is a redesign,
not a fix: an agenda list per day with the month grid as a compact
picker.

### H. Register and recurring on phones

Register cards are very tall with the checkbox on its own line; recurring
cards repeat four labels each and run about 400 pixels tall for 37
rows. Both need a denser card: one line for date, payee and amount, a
second for account and category, and selection via a leading checkbox.

## Sequencing proposal

1. Shared layers first, because every page inherits them: money
   formatter, responsive table recipe, KPI strip recipe, page header and
   info-button pattern, mini-chart label fixes, phone tab-bar bottom
   padding.
2. Daily pages: register, dashboard, recurring, accounts, calendar.
3. Reports: fix the two blank charts and the projection speed first,
   then formatting and tables across all fifteen.
4. Utility pages: backup, import, health check, diagnostics, trash,
   profiles, tools, settings.
5. Verification per page: the sweep script re-run and compared, with
   each fix reverted once to prove the check sees it.

## Decisions (Jon, 2026-09-04)

1. **Money**: cents everywhere, sign before the symbol, thousands
   separators. The only exception is chart axis tick labels, which may
   show whole dollars. No "k" abbreviations anywhere, sidebar included.
2. **Tables**: phones get the stacked card layout already used on cuts,
   register and payees. Tablets hide low-value columns first (memo,
   group, notes) and never hide money or actions; if a table still does
   not fit it scrolls horizontally inside its card with a sticky first
   column. Tables over about fifteen rows get sticky headers.
3. **Page prose**: every page keeps a one-line lead. Longer text moves
   behind the round info button that opens a modal, the pattern on the
   Profiles page.
4. **Sequence**: shared layers first, then daily pages (register,
   dashboard, recurring, accounts, calendar), then reports, then
   utility pages.
5. **Report charts**: repair in place. Load d3 on the trends and
   assignment-history routes, then fix labels, legends and collisions
   chart by chart.
6. **Phone calendar**: agenda list per day with the month grid reduced
   to a compact date picker with dots.
7. **Phone dashboard**: KPI tiles two per row; widget cards collapsible,
   top four open by default, the rest collapsed, remembered per device.
8. **Delegation**: the session lead builds the shared layers on main.
   Page work goes to worker agents in worktrees under
   `~/dev/_worktrees`, each checked by a verifier that reverts the fix
   and re-runs the check before merge.
9. **Test gating**: workers and verifiers may run the headless sweep
   script and page-specific headless checks only. The unit and
   Playwright suites stay off until Jon says otherwise.
10. **Phone register and recurring cards**: two lines. Line one is a
    leading checkbox, date, payee and amount. Line two is account and
    category, with memo and cleared state as small marks. About 56
    pixels per row.
11. **Add button**: a regular Add button in the page header on desktop
    and tablet; the floating button remains on phones only.
12. **Sidebar**: cents on group totals, sidebar widened from about 232
    to 260 pixels, group labels single-line with an ellipsis, totals
    right-aligned.

13. **KPI values**: shrink the type one step before truncating, then
    ellipsis with a tooltip. Money never truncates; the strip drops a
    column instead.
14. **Utility pages**: passing health checks become one-line rows with
    a tick, only failing checks expand. Backup, import and diagnostics
    each become one full-width card with the controls and an info
    button.
15. **Projection speed**: in this sweep, as the first reports task.

Smaller decisions not asked (session lead's call, reversible): the
accounts page becomes one table with group section rows and a single
sticky header; calendar desktop chips show payee with an ellipsis and
the full amount; reports index and tools grids use auto-fill so no row
holds a lone tile; the heatmap gets a legend and keeps values at 1024.

## Task list

Shared layers (session lead, on main, in this order):

- S1 money: one store formatter, cents always; remove the 15 local
  whole-dollar formatters and the 21 inline toFixed sites; sidebar
  totals; calendar and heatmap values.
- S2 tables: responsive table recipe (column priority attribute, tablet
  scroll with sticky first column, phone card stack, sticky headers);
  documented in the style guide.
- S3 KPI strip: two-up phone, three-up tablet, auto-fit desktop, value
  shrink-then-ellipsis, labels never wrap.
- S4 page header: title, one-line lead, actions and Add button on one
  row; info-button modal partial; phone tab-bar bottom padding on
  every page; floating button phone-only.
- S5 charts: mini-chart label thinning and type size; d3 loaded for
  trends and assignment history; shared axis formatter.
- S6 sidebar: width 260, single-line labels, cents totals.

Page tasks (workers in worktrees, one per task, verifier before merge):

- P1 register: desktop width, tablet priority columns, phone two-line
  cards, recurring-due banner compacted.
- P2 dashboard: two-up tiles, collapsible widgets, account tile names,
  quick actions and cashflow card sizing, upcoming bills collisions.
- P3 recurring: tablet overflow, phone two-line cards, summary tiles.
- P4 accounts: single table with group rows and one sticky header,
  phone pills and names.
- P5 calendar: phone agenda layout, desktop chips and title, header
  pills, week footer math.
- R0 projection speed.
- R1 to R14: one task per report page; each applies S1 to S5 and fixes
  its own chart findings from this document.
- U1 backup and import, U2 health check, U3 diagnostics (timing bug),
  U4 trash and profiles phone tables, U5 tools and reports index grids,
  U6 about-this-profile, audit log, settings, payees, rules, shortcuts.
- H1 cuts and category pages: tablet table overflow, axis collisions,
  card fill.

Acceptance for every page task: the sweep script is re-run for that
route at all three widths and the relevant measured flags clear; the
verifier reverts the fix once and confirms the flag returns.
