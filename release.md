# Release Draft

Current version: `2.0.1`

Recommended bump: `minor` — this release adds the new `Calendar` subpath/component and several new shared exports, while keeping existing APIs backward-compatible.

Suggested command:

```bash
npm run release:minor
```

Suggested next version: `2.1.0`

## GitHub Release Notes

```md
### Features
- **Calendar:** Add `hs-uix/calendar`, a presentational calendar with Month, Week, Day, and Agenda views; Today/previous/next/view toolbar; search and filter support; click-to-open event overlays; multi-day event rendering; overflow popovers; all-day/time-grid support; range-loading hooks; render override slots; labels; and `calendar.d.ts`.
- **Calendar:** Add robust date coercion and timezone-aware rendering, including `timeZone`, `defaultTimeZone`, `onTimeZoneChange`, `showTimeZoneSelect`, `timeZoneOptions`, and date utility exports for zoned formatting.
- **Common components:** Add the `Icon` wrapper plus icon registry helpers (`ICONS`, `ICON_NAMES`, `NATIVE_ICON_NAME_LIST`, `makeIconDataUri`, `svgToIconEntry`) and a `build:icons` pipeline.
- **Common components:** Export shared collection toolbar primitives: `CollectionToolbar`, `CollectionFilterControl`, `ActiveFilterChips`, `CollectionSortSelect`, `CollectionCount`, and `formatCollectionCount`.
- **Utils:** Export shared query helpers including `getEmptyFilterValues`, `resetFilterValues`, and `buildActiveFilterChips`; filter configs now support `emptyValue`.

### Improvements
- **DataTable:** Inline-edit `select` and `multiselect` cells now render their dropdowns directly in discrete edit mode instead of requiring an extra click.
- **DataTable:** Record counts now sit beside the title when there are no search/filter toolbar controls, avoiding an unnecessary two-line header.
- **DataTable / Kanban / Feed / Calendar:** Standardize toolbar, filter chips, clear-all behavior, count alignment, empty states, and loading states across collection-style components.
- **Kanban:** Use Feed-style compact transparent sort select in the toolbar.
- **Feed:** Add active filter chips, clear/reset behavior, `showFilterBadges`, `showClearFiltersButton`, and filter `chipLabel` support.
- **FormBuilder:** Keep repeater reorder controls aligned by always rendering move buttons and disabling invalid directions; tighten repeater add-button spacing.
- **CrmLookupSelect:** Preserve selected options as live search results change and improve debounce/loading/no-results states.

### CRM fixes
- **CRM search:** Add `hs_object_id` as a stable tiebreaker sort in `buildCrmSearchConfig`, fixing cursor pagination overlap/short-page behavior.
- **CrmDataTable / CrmKanban:** Lazily fetch additional HubSpot CRM cursor pages as the user pages or loads more, while keeping client-side search/sort/filter over loaded batches by default.
- **CrmKanban:** Add the board analog of `CrmDataTable` with optional stage derivation, client-side grouping/search/filter/sort, server-side opt-in, and partial-result messaging.

### Internal / tooling
- **Architecture:** Move component package sources under `src/`, remove deprecated workspace package manifests/configs, and build all subpaths from root `tsup` entries.
- **Tests:** Add Vitest coverage for query helpers, CRM adapters, calendar date utilities, form value/validation/dependency helpers, and DataTable edit validation. Current suite: 94 passing tests.
```

## Pre-Release Checklist

- [x] Update `CHANGELOG.md` with the 2.1.0 release notes
- [x] Run `npm test`
- [x] Run `npm run build`
- [ ] Review `git diff` for unrelated workspace changes
- [ ] Commit release-ready changes
- [ ] Run `npm run release:minor`
- [ ] Create/publish the GitHub release using the notes above
