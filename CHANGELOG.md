# Changelog

## Unreleased — Component fixes

- **New: `Icon`** — a drop-in superset of HubSpot's native `<Icon>`. When a
  request is fully native-expressible (a whitelisted `name`, a semantic `color`
  of `inherit`/`alert`/`warning`/`success`, and an `sm`/`md`/`lg` `size`) it
  **delegates to the real `<Icon>`**, preserving auto-sizing, `color="inherit"`,
  and screen-reader semantics. Otherwise it renders a registered SVG glyph as a
  data-URI `<Image>`, lifting all three native limits: unregistered/custom glyph
  names, any CSS color (not just the 4 semantic ones), and `xs`–`xl` tokens or an
  explicit pixel `size`. Multi-color / even-odd glyphs are supported via per-path
  `fill`/`fillRule`. _(Fallback caveat: a data-URI glyph can't inherit
  `currentColor`, so pass `color` explicitly.)_
- **New: icon registry & helpers** ship with `Icon` — `ICONS` (the custom glyph
  registry, ~248 glyphs scraped from HubSpot's web app merged with a
  hand-curated set), `ICON_NAMES` (its keys), and `NATIVE_ICON_NAME_LIST` (the
  native `<Icon>` name whitelist, sorted). Plus two utilities:
  `makeIconDataUri(nameOrEntry, { size, color })` returns `{ src, width, height }`
  (or `null` for an unknown name) for use anywhere an SVG data URI is needed, and
  `svgToIconEntry(rawSvg)` parses a copied `<svg>` string into a registry entry —
  dropping `<mask>`/`<defs>` and `currentColor` fills so `color` can recolor the
  glyph, while preserving explicit fills/fill-rules. New exported types:
  `IconProps`, `IconEntry`, `IconPath`, `IconPathObject`, `IconSize`,
  `IconDataUriResult`, `IconDataUriOptions`.
- **Tooling: icon build pipeline** — added a `build:icons` npm script
  (`node scripts/build-icons.mjs`) and a two-step authoring flow:
  `scripts/scrape-hs-icons.console.js` harvests `data-icon-name` SVGs from
  HubSpot's web app in the DevTools console, and `scripts/build-icons.mjs` merges
  the scraped JSON **additively** into the committed
  `src/common-components/icons.generated.js` (deterministic, alphabetically
  sorted for clean diffs; `--replace` to start fresh). The intermediate
  `scripts/scraped-icons.json` dump is gitignored.

- **CRM cursor pagination fixed** — `buildCrmSearchConfig` now appends a unique
  `hs_object_id` tiebreaker to every CRM search sort. CRM `after`-cursor paging
  is only deterministic over a totally-ordered set; with no sort (or a sort with
  ties) the order drifted between page requests, so cursors overlapped, pages
  came back short, and `hasMore` was wrong (the "blank/short page 2, page 3
  unreachable" bug). With the stable tiebreaker, all CRM result ordering is now
  deterministic.
- **CrmDataTable / CrmKanban now paginate client-side over a fetched batch and
  never use `useCrmSearch`'s cursor.** Beyond one batch they auto-refetch
  search/filter/sort server-side (each a fresh query's page 1) and show a
  "first N of M" note. This sidesteps a confirmed upstream `useCrmSearch` bug
  where `pagination.nextPage()` advances `after` by one page too far — see
  `docs/usecrmsearch-pagination-bug.md` for the minimal repro to file with HubSpot.

- **New: `CrmKanban`** — the board analog of `CrmDataTable`. Fetches one batch
  and groups / searches / filters / sorts client-side by default. `stages` is
  optional: pass it for real pipeline labels, or let stages auto-derive from the
  batch (labelled via `stageLabels` or prettified). Same `serverSide` opt-in and
  "first N of M" note. Removes the hand-wiring (params, data source, stage
  derivation, prop threading) the deal-board demo previously needed.

- **CrmDataTable**: now **fetches one batch (`pageLength`, default 100) and does
  search / sort / filter / pagination client-side by default** — a single
  request, no refetch per interaction, and pagination "just works" (in-memory
  slicing). When the result set exceeds the batch it shows a "first N of M" note
  rather than silently showing a partial view. `serverSide` remains an opt-in
  for very large datasets (cursor pagination via `useCrmSearch`). A built-in
  sort translator maps the active column sort to CRM `sorts` (honoring
  `propertyMap`) in server mode, so callers no longer hand-write a `sortMap`.
  The data-source options are memoized so the underlying config no longer churns
  every render. _(Previously `serverSide` defaulted to false with no batch
  strategy and server-side page 2 came back blank.)_
- **DataTable, Kanban, Feed**: consistent default empty and loading states —
  both now render the same `EmptyState` component (Tile-wrapped, `layout="vertical"`),
  so they match exactly with no layout shift. Empty uses the default illustration;
  loading uses the `building` illustration with a loading title + a short message
  (overridable via `labels.loadingMessage`). (Previously Kanban/Feed loading was
  a bare spinner.)
- **CrmLookupSelect**: a picked option now stays valid after the live search
  results change — the component remembers selected options internally (no need
  to pass `selectedOptions`). It also shows `loadingOption` during the debounce
  window (not just the in-flight request) and only shows `noResultsOption` once
  a query has settled, so it no longer flashes "no results" while typing.
- **FormBuilder**: repeater reorder controls always render now, disabled on the
  first row's "up" and the last row's "down", so rows stay column-aligned;
  `repeaterProps.renderMoveUp` / `renderMoveDown` receive a `disabled` flag.
- **FormBuilder**: tightened the spacing between the repeater "add" icon and its
  label (`gap="flush"` → `gap="xs"`).
- **DataTable, Kanban**: `showClearFiltersButton` now defaults to the value of
  `showFilterBadges` instead of always `true`. Hiding the active-filter chips
  (`showFilterBadges={false}`) now also hides the "Clear all" reset button by
  default, so a single prop suppresses both filter affordances. Callers who want
  the reset button without chips can still opt in with
  `showClearFiltersButton={true}`, and an explicit `false` is unchanged. The
  default with `showFilterBadges` left at `true` is identical to before.
  ([#10](https://github.com/05bmckay/hs-uix/issues/10))
- **DataTable**: the record count now sits on the title row when a `title` is set
  and the toolbar has no left-hand content (search and filters hidden), instead
  of always living in the toolbar's right column. Previously a count-only header
  stacked the title and count on two lines; now they share one line, and the
  count still rides in the toolbar whenever search/filter controls are present.

## Unreleased — Architecture refactor (no public API changes)

Internal restructuring to make the library more testable and AI-navigable.
**No public exports, props, or types changed** — every change is behind the
existing component interfaces and is behavior-preserving. A new test harness
(vitest) was added; **68 unit tests** now cover the extracted modules.

### Shared query pipeline
- New internal `src/utils/query.js`: the filter / search primitives and the
  filter+search pipeline that were **copy-pasted identically** into `DataTable`
  and `Kanban` (`getEmptyFilterValue`, `isFilterActive`, `formatDateChip`,
  `dateToTimestamp`, `toStableKey`, `filterRows`, `searchRows`) now live in one
  unit-tested place. `DataTable.jsx` and `Kanban.jsx` import from it.
  - _Feed keeps its own path-accessor filtering dialect on purpose — folding it
    in would have changed Feed's (string-coercing) behavior._

### FormBuilder validation & dependencies
- New `packages/form/src/formValues.js`: pure value model (empty values,
  emptiness, deep equality/clone, HubSpot date/time shape predicates).
- New `packages/form/src/formValidation.js`: the validation engine
  (required / type / pattern / min-max / custom sync + async validators,
  field-config resolution). Previously buried in the component and only
  reachable by mounting the form; now pure and directly tested.
- New `packages/form/src/formDependencies.js`: the dependent-field cascade
  (`resolveDependentCascade`) — formerly a BFS walk inside `handleFieldChange`,
  now a pure, table-tested function (multi-level chains, multiselect filtering,
  value-no-longer-valid clearing).

### CRM helpers
- New `src/utils/objectPath.js` (`getByPath`): removes a byte-for-byte
  duplicate definition that lived in both `crmSearchAdapters.js` and
  `CrmLookupSelect.js`.

### Shared interaction hooks
- New `src/utils/interactionHooks.js`: `useDebouncedDispatch` (search
  debounce-settle) and `useSelectionReset` (clear selection on query change) —
  the two stateful patterns that `DataTable` and `Kanban` each reimplemented.

### DataTable edit validation
- New `packages/datatable/src/editValidation.js` (`editValidationError`):
  the `editValidate`-result interpretation rule, previously duplicated in four
  places, now centralized and tested.
- See `docs/adr/0001-no-unified-edit-control-factory.md` for why the larger
  edit-control factory was **deliberately not** extracted (it would have been a
  shallow abstraction with no test surface).

### Tooling
- Added `vitest` dev dependency and `test` / `test:watch` scripts.
