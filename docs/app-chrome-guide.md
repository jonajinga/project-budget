# Converting a page to the app chrome (S8)

Read this before converting any `/app/*` route. The shared layer is
`src/assets/css/partials/app-chrome.css` and
`src/_includes/partials/app-toolbar.njk`. `src/pages/app/import.njk` is
the worked example.

## What changed and why

Every app route except the budget page opened with a 2.75rem display
heading and a paragraph of explanation. That is 180 to 240 pixels of
the window spent before the first number, and it is the reason those
pages read as a website while the budget page reads as an app.

Jon's decision, 2026-09-04: **no page header at all.** The sidebar
already says which page you are on. The visible page name goes; only
the controls stay.

This supersedes decision 3 in `docs/ui-sweep-plan.md`, which said every
page keeps a one-line lead. It does not.

## The conversion, step by step

### 1. Replace the masthead with the toolbar

Before:

    <div class="app-page" x-data="fooView()">
      <header class="app-page__header">
        <div>
          <p class="eyebrow">Something</p>
          <h1 class="app-page__title">Trash</h1>
          <p class="app-page__lead">Two or three sentences of prose.</p>
        </div>
        <button class="btn btn--danger">Empty trash</button>
      </header>

After:

    {% from "partials/app-toolbar.njk" import appToolbar %}
    {% from "partials/page-info.njk" import pageInfo %}
    <div class="app-page app-page--dense" x-data="fooView()">
      {% call appToolbar("Trash") %}
        <div class="app-toolbar__group">
          <span class="app-toolbar__context" x-text="count + ' items'"></span>
        </div>
        <div class="app-toolbar__actions">
          <button class="btn btn--danger">Empty trash</button>
          {% call pageInfo(id="trash", title="About the trash", label="How the trash works") %}
            <p>Two or three sentences of prose, moved here.</p>
          {% endcall %}
        </div>
      {% endcall %}

Rules:

- The string passed to `appToolbar()` becomes the visually-hidden `h1`.
  Keep it short and keep it the page's real name: it is what a screen
  reader announces and what prints at the top of the sheet.
- Drop the `.eyebrow` above the old title. With no masthead it has
  nothing to sit above.
- Every lead paragraph moves into a `pageInfo` modal. Do not delete the
  words; they are the only explanation the page has. `id` must be
  unique on the page.
- **Empty-state paragraphs are not leads.** `register`, `accounts` and
  `calendar` carry `x-show`-gated text like "Load or create a profile".
  Leave those exactly where they are.
- The info button goes last in `.app-toolbar__actions`, after the real
  buttons.
- Three pages hand-roll their own info button and modal
  (`accounts/index.njk`, `payees.njk`, `scheduled.njk`). Replace those
  with the `pageInfo` macro rather than keeping two patterns.

### 2. Pull the page's own toolbar up into the strip

Most pages render a second row of controls below the header - a search
box, a range picker, a count, `report-toolbar`, `rec-toolbar`. Move
those into the strip. Two rows of chrome become one. That is most of
what makes the budget page feel dense.

Order within the strip: context and filters left, actions right.
`.app-toolbar__sep` draws a hairline between two clusters.

### 2b. More filters than a strip can hold

Some pages have too many filters for one row. Recurring has a search box
and four selects; in the strip they made it three rows and 160 pixels
tall at 1024, which is worse than the masthead it replaced.

The pattern for that case, already built and working on
`src/pages/app/scheduled.njk`: the strip keeps the search box and a
**Filters** toggle; the selects move into a `.app-filters` row directly
under the strip that is collapsed by default.

    <button type="button" class="btn btn--ghost app-toolbar__filter-toggle"
            @click="filtersOpen = !filtersOpen"
            :aria-expanded="filtersOpen.toString()"
            aria-controls="foo-filters">
      Filters
      <span class="app-toolbar__filter-count" x-show="activeFilterCount()" x-cloak
            x-text="activeFilterCount()"></span>
    </button>
    ...
    <div class="app-filters" id="foo-filters" x-show="filtersOpen" x-cloak>
      <div class="field">...</div>
      <button class="btn btn--ghost" x-show="hasActiveFilter()" x-cloak
              @click="clearFilters()">Clear</button>
    </div>

Add `filtersOpen: false` and an `activeFilterCount()` to the page's
Alpine factory. **The badge is not optional.** A filter that is on and
hidden inside a collapsed row is a user staring at a short list
wondering where their rows went. Count only what the row actually
holds - if the search box stays in the strip, do not count it.

It is a row rather than a floating popover on purpose: a popover needs
anchor positioning, and this app's fixed-position menus break under any
ancestor transform (STATE.md trap 5). A row has no positioning to get
wrong at any width.

Use it when the strip would otherwise carry more than about three
controls plus the actions. Two selects, leave them in the strip.

### 3. Pick the page's body shape

- **One continuous data surface** (a full-width table: accounts,
  register, payees, scheduled, trash, report tables). Use
  `class="app-page app-page--flush"` and
  `{% call appToolbar("Name", flush=true) %}`. The page bleeds to the
  window edges like the budget grid, and the strip sits directly on it.
- **A few distinct objects** (settings sections, the profile list).
  Use `app-page--dense` and keep `.card`.
- **A single control with nothing to show yet** (import, backup).
  Use `app-page--dense app-page--fill`, and put `app-grow` on the
  element that should absorb the leftover height.

Use `.panel` rather than `.card` when the block is a surface the page's
data lives on rather than a separate object. `.panel__head` gives it a
small uppercase title bar; `.panel__body--flush` removes the padding so
a table can meet the edges.

### 4. Titles that are data, not labels

The register's account name, the category page's category and the
calendar's month name the thing you are looking at, not the screen you
are on. Those stay visible, small, via `appToolbarSubject`:

    {% call appToolbarSubject("Register", '<span x-text="accountName()"></span>') %}
      ...controls...
    {% endcall %}

The first argument is still the screen-reader heading. The second is
raw HTML so it can be Alpine-bound.

## Traps

1. **Shell cwd resets between Bash calls.** Prefix every command with
   `cd <your worktree> &&`.
2. **A new CSS partial is invisible until registered** in
   `CSS_PARTIAL_ORDER` in `eleventy.config.js`, and any new class
   prefix needs a line in *both* PurgeCSS safelists. `app-toolbar`,
   `app-page` and `panel` are already there.
3. **Do not make the toolbar sticky.** The site header is sticky at
   `4rem` and every sticky table head in the app is offset `top: 4rem`
   against it.
4. **`p { max-width: 70ch }` is global.** A paragraph that should span
   a panel needs an override.
5. **Overflow menus are `position: fixed`.** Any `transform` on an
   ancestor breaks them, so do not add one to the strip.
6. ASCII only in source. No em dashes, no smart quotes, no emoji.

## What "done" means

For each route, at 1440, 1024 and 390:

- no horizontal overflow that is not inside a scroll container
- the strip reaches both edges of the main area
- nothing the page used to explain has been lost - it is in the modal
- the first row of real content sits within ~60 pixels of the app header
- money still shows cents, names still ellipsis with a tooltip

Measure the last one with `_audit/sweep.mjs` (see `STATE.md` for how to
seed the sample profile). Record the before and after height of the
first content row; that number is the point of the exercise.
