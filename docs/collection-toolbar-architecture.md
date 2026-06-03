# Collection toolbar architecture

`DataTable`, `Kanban`, `Feed`, and `Calendar` all expose a collection-style toolbar: search, filters, active filter chips, optional sort, and optional counts/actions. This document captures the shared layer so future changes do not drift back into one-off toolbar implementations.

## Shared primitives

The shared UI pieces live in `src/common-components/` and are exported from `hs-uix/common-components`:

- `CollectionToolbar` — layout shell for search, inline/overflow filters, active chips, a right-side slot, and an optional footer.
- `CollectionFilterControl` — renders the common filter config vocabulary (`select`, `multiselect`, `dateRange`).
- `ActiveFilterChips` — renders removable active filter chips plus optional `Clear all`.
- `CollectionSortSelect` — compact transparent sort `Select` used by Feed and Kanban.
- `CollectionCount` / `formatCollectionCount` — standardized microcopy count rendering.

Shared query helpers live in `src/utils/query.js` and are exported from `hs-uix/utils`:

- `getEmptyFilterValue`
- `getEmptyFilterValues`
- `resetFilterValues`
- `buildActiveFilterChips`
- `filterRows`
- `searchRows`

## What the shared toolbar owns

`CollectionToolbar` owns only layout and control rendering:

- Search input rendering
- Inline filter row
- Overflow filter toggle and overflow row
- Active filter chip row
- Right-side slot placement
- Optional footer placement
- Unique generated input/select names

It is deliberately controlled-only. Parent components still own query state, data fetching, filtering, sorting, pagination, and callbacks.

## What stays view-specific

Do not push these into `CollectionToolbar`:

- DataTable column-header sorting
- Kanban stage bucketing, metrics, and per-stage counts
- Calendar date navigation / view switching / range calculation
- Feed tabs, grouping, expansion/collapse, and path-based filtering pipeline
- Server-side fetching behavior
- Selection bars

Those pieces should be passed as slots or handled by the parent view.

## Right-side alignment

The toolbar defaults to `rightAlignSelf="end"`. This is intentional.

When active filter chips or overflow filters create a second/third left-side row, counts and right-side controls should align with the lowest toolbar row, not the first search/filter row. This preserves the DataTable behavior users expect: counts ride on the same visual line as the active chips.

Components can override via `rightAlignSelf`, but the default should stay `end`.

## Left/right sizing

`CollectionToolbar` accepts `leftFlex` and `rightFlex`.

Defaults are `3 / 1` (75/25), which works for DataTable, Kanban, and Feed. Calendar uses `3 / 2` (60/40) because its right side has Today, previous, next, and view controls.

## Multiple toolbars in one extension

HubSpot controls use `name` attributes internally. Duplicate names can cause confusing behavior when multiple tables/boards/feeds/calendars render in the same extension.

`CollectionToolbar` appends a per-toolbar suffix generated with React `useId()` to child search/filter names by default. Consumers can pass `idPrefix` for a stable suffix or `uniqueNames={false}` to opt out.

## Feed filtering caveat

Feed uses the shared chip/reset helpers, but intentionally keeps its own filter/search pipeline. Feed supports path/accessor-based values and string-coercing equality; replacing that pipeline with the DataTable/Kanban `filterRows` helper would change behavior.

## Public API posture

The collection primitives are exported intentionally for custom collection views. They should be treated as supported low-level building blocks, but the packaged components remain the recommended entry point for most users.
