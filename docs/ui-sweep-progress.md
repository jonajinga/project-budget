# UI sweep: running task list

Companion to `docs/ui-sweep-plan.md`, which holds the findings and Jon's
decisions. This file is the checklist. Updated as each item lands.

Legend: [x] done and checked  ·  [~] in progress  ·  [ ] not started

## Shared layers

- [x] **S1 One money format.** Cents everywhere, thousands separators,
  sign before the symbol. Replaced fifteen local formatters and
  twenty-one inline table cells with one store formatter. Abbreviations
  like "$27.8k" are gone from all 45 routes.
- [x] **S2 Responsive table recipe.** One set of classes every table
  uses: `.col-p3` hides a column at 1024 and below, `.col-p2` below 600,
  money and actions never hide; `.table-scroll` for scrolling inside a
  card; `.table--stack` turns rows into cards on phones. Documented in
  the style guide.
- [x] **S3 Tile strips.** Two-up on phones, three-up on tablets, auto
  on desktop. Values shrink before they truncate; labels use two lines
  on phones rather than being cut off. Removed eleven truncated labels
  across eight routes.
- [x] **S4 One Add button.** The floating button covered table columns
  and chart corners, and the tab bar had already hidden it on phones,
  so it appeared at no width at all. Removed. The tab bar carries Add
  below 768; the top bar carries it above.
- [x] **S5 Charts draw, fit and label.** Trends and assignment history
  rendered nothing because the d3 library was only loaded for three
  other reports. Inline charts now draw at their measured width with
  labels chosen so none collide.
- [x] **S6 Sidebar totals.** Group totals showed "$27.8k"; they show
  full amounts on their own line.
- [x] **S7 Sticky table headers.** Solved while doing the accounts
  page. A card sets `overflow-x`, which makes it a scrollport, so a
  header inside it pins to a box that never scrolls vertically and
  appears not to stick at all. The fix, and the 4rem offset for the
  site header, are written into the style guide. The accounts header
  now stays put; the register still needs it applied.

## Daily pages

- [x] **P1 Register.** The table sized itself to its content and
  ignored its card: at 1440 the Actions column hung outside, and at
  1024 the memo, amount, cleared mark and actions were all off screen.
  Fixed layout, memo gives way first, phone rows halved from 104 to 57
  pixels while showing more. Verified independently.
- [x] **P2 Dashboard.** Account names were cut mid-word, bill payees
  printed over their amounts at tablet width, and the phone page was
  7,776 pixels tall. Names now ellipsis with a tooltip, cards fold on
  phones with the top four open and the choice remembered, and the page
  is 2,961 pixels. Verified independently.
- [x] **P3 Recurring.** At tablet width the table was 785 pixels inside
  a 697 pixel card, so the Post button and row menu sat past the edge of
  the screen and were reachable only by discovering that the card
  scrolls sideways. Fixed layout, payee absorbs the slack, frequency
  gives way first. Post moved from 1060 to 928 and the row menu from
  1096 to 964, both inside the 1024 viewport. Phone cards went from 258
  to 61 pixels each and the page from 11,731 to 3,572. Posting works at
  both sizes with a 44 pixel tap target. Verified independently, and
  the shared tile strip on five other pages is untouched.
- [x] **P4 Accounts.** The page rendered a separate table per group,
  so the header was stated seven times and the Type column began at a
  different place in every group: 78 pixels of spread at desktop, 46 at
  tablet, now zero. One table, one header, columns from a colgroup. All
  21 account names carry a tooltip where none did; three that were cut
  off on a phone are not; three group titles that ran to two or three
  lines fit on one; and the excluded-total pill that ended 90 pixels
  past the phone screen no longer overflows. Verified independently.
- [x] **P5 Calendar.** The phone toolbar wrapped to six rows because
  the filter disclosure it was always styled for had never had its
  markup written. Six rows to four, 330 pixels to 172. Below 600 the
  grid drops to a picker with one dot per day that has entries, and an
  agenda underneath lists only the days with something on them, with
  payee, account, category and amount on each row. Three truncated
  money values in the period tiles are gone. Author-checked headlessly
  at 390: 21 day groups, 50 rows, no page errors. Still four rows
  rather than three - the kebab keeps a row of its own and I did not
  find why.

## Reports

- [x] **R0 Projection speed.** Took sixteen seconds to open; now under
  two. It was recomputing a category's whole history once per goal per
  month.
- [x] **R1 Months read as months.** Tables, tiles and chart axes showed
  raw keys like "2025-10", and axes showed a bare "10", ambiguous
  across a two-year window.
- [x] **R2 Savings rate chart.** One month at minus seven hundred
  percent flattened the other eleven into a line. The axis fits the
  bulk and names the outlier underneath.
- [ ] **R3 Report tables and tiles.** Column priorities and phone
  stacking across all fifteen reports; several still drop their money
  columns on a phone.
- [ ] **R4 Remaining chart quality.** Sankey labels collide, the
  treemap clips its labels, the heatmap has no legend and hides values
  at tablet width, the debt chart uses one colour.

## Utility pages

- [x] **U2 Health check.** Seven passing checks each took a 140-pixel
  card to say "0 findings"; each is one 37-pixel row now, so the one
  check with something to report stands out.
- [x] **U3 Diagnostics.** Reported "Profile count: 0" with a profile
  open, because it built its text before the profile loaded.
- [x] **U4 Trash and profiles on phones.** The trash table ran off
  screen after the account column, so nothing could be restored from a
  phone. Both tables stack now and the Restore button never hides.
- [x] **U6 Excluded accounts spacing.** Ran words together because the
  build's HTML minifier trims whitespace at the edge of a text node.
- [~] **U1 Backup and import.** Import done: it opens on a drop zone
  that fills the window, with the prose behind the info button. It was
  the worst case in the audit - 240 pixels of title and prose, 190 of
  control, 460 of nothing. Backup is with the utility worker.
- [ ] **U5 Tools and reports index.** Grids leave an orphan tile on the
  last row.
- [ ] **U7 Dashboard PDF export.** Skips five widgets at every width,
  because two chart hosts render without the identifier the export
  looks up.

## App chrome (S8, added 2026-09-04)

Jon: every page should look like the budget page, which is the only one
that reads as an app. His decision: no page header at all. The sidebar
already says which page you are on, so the visible name goes and only
the controls stay. The h1 survives as visually-hidden for screen
readers, and print.css puts it back on paper.

This supersedes decision 3 in the plan, which said every page keeps a
one-line lead. It does not; the lead moves behind the info button.

- [x] **S8 The shared layer.** `.app-toolbar` is one full-bleed strip
  under the app header. `.panel` is a card that has stopped floating.
  `.app-page--flush` bleeds a whole page for a route that is one
  continuous data surface; `.app-gutter` gives one child its gutter
  back. `.app-filters` is a collapsible filter row for pages with more
  controls than a strip can hold, with a count badge so a filter that
  is on is never hidden silently. Written up in
  `docs/app-chrome-guide.md`.
- [x] **Import**, **Accounts**, **Register**, **Recurring**,
  **Dashboard**, **Cuts**, **Category**. Each drops its masthead and
  merges its own second row of controls into the one strip. Where the
  first row of real content sits, measured by a verifier who built both
  commits: accounts 452 to 345, dashboard 268 to 157, category 207 to
  133, recurring 525 to 280, calendar phone toolbar 308 to 172.

  These replace the figures first written here. Two of them were wrong:
  the category baseline of 290 matched nothing on the page at any
  width, and the recurring pair described the page with its filter row
  open rather than in its default state. The real recurring improvement
  is larger than was claimed, which is not the point -- a number nobody
  re-measured does not belong in a progress document.
- [x] **Verified, after a rejection.** An independent verifier
  rejected the first pass and found four real defects, all of them on
  the one page whose structure differs from the rest:
  - the phone toolbar collapsed its left group to zero instead of
    scrolling, so the category page rendered its own name three pixels
    wide with no way to read it;
  - the print rule looked for the heading by position and by a class
    (`app-page__inner`) that existed nowhere in the repo, so the
    category sheet printed with no name on it at all;
  - the hidden heading said "Category" rather than which category;
  - the recurring filter badge counted the sort order, which
    `clearFilters()` did not reset, so a "1" could appear with no Clear
    button to remove it.

  All four are fixed and re-checked: the strip now overflows and
  scrolls (526px of content in a 390px row, nothing clipped), the
  category name reads in full, the note moved behind its own button,
  print emits "Category: Dining out" at full width, and changing only
  the sort no longer raises a badge.
- [ ] **The 15 report pages and the reports hub.** With a worker.
- [ ] **The 20 utility and form pages.** With a worker.
- [ ] The report and utility pages have not been checked by anyone.

## New work

- [x] **C1 Changelog page.** Live at `/changelog/`, linked from the
  site footer and from the app's Help section. Entries are written for
  people who do not read code: what you will notice, and one line
  underneath saying why it happened. Content lives in
  `src/_data/changelog.js`, whose header states the house rules for
  writing an entry. Two releases are written up so far.

## Build and tooling fixed along the way

- [x] PurgeCSS was deleting any rule whose attribute is set by Alpine,
  so the dashboard chart widgets were missing a rule in every build.
- [x] The sweep script was over-reporting: it counted screen-reader
  labels as clipped text, flagged scrollable tables as page overflow,
  measured a spam honeypot input parked off screen, and measured the
  sidebar and tab bar on all 45 routes.
