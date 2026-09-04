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
- [ ] **S7 Sticky table headers.** `.table--sticky-head` does nothing
  where the card is an overflow container, which is the register today
  and any long table later. Needs a measured offset.

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
- [~] **P3 Recurring.** Amount, Post button and row menu are off screen
  at tablet width; phone cards are about 400 pixels each. In progress.
- [~] **P4 Accounts.** Column header repeats seven times, columns do
  not line up between groups, phone pills and names are clipped. In
  progress.
- [ ] **P5 Calendar.** Phone view is unlabelled coloured blobs and a
  six-row toolbar. Needs an agenda list, with the grid as a picker.

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
- [ ] **U1 Backup and import.** Mostly prose, half-width cards leaving
  an empty column, a raw file input where the page promises a drop
  zone.
- [ ] **U5 Tools and reports index.** Grids leave an orphan tile on the
  last row.
- [ ] **U7 Dashboard PDF export.** Skips five widgets at every width,
  because two chart hosts render without the identifier the export
  looks up.

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
