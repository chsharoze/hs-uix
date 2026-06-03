# Next Release (unreleased)

## Changes
- `showClearFiltersButton` now defaults to the value of `showFilterBadges` (was always `true`). Setting `showFilterBadges={false}` now hides the "Clear all" reset button by default too; pass `showClearFiltersButton={true}` to keep the reset without chips. Behavior is unchanged when `showFilterBadges` is left at its `true` default. ([#10](https://github.com/05bmckay/hs-uix/issues/10))
- The record count now sits on the title row when a `title` is set and the toolbar has no left-hand content (search and filters hidden), instead of always rendering in the toolbar's right column. A count-only header now sits on one line instead of stacking; the count still rides in the toolbar whenever search/filter controls are present.

## Docs
- Update README to use `hs-uix` / `hs-uix/datatable` import paths and the main `hs-uix` npm package (was still referencing the legacy `hubspot-datatable` standalone name).
- Document `onEditStart`, `onEditCancel`, `labels` (i18n), `filterInlineLimit`, `showSearch`, `showSelectionBar`, and the `renderSelectionBar` / `renderEmptyState` / `renderLoadingState` / `renderErrorState` override hooks in the DataTable Props reference table.
- Add `sortOrder`, `sortComparator`, and column-level `footer` to the Column Definition reference table. Correct `label` to `ReactNode` and widen `truncate` to include `number`.
- Correct the `GroupBy.label` return type to `ReactNode`.
- Drop the outdated `hubspot-datatable-demo` link block.
- Refresh `AGENT.md` to describe the current monorepo layout and the root-only release flow.
