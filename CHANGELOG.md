# Changelog

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
