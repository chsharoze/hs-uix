# hs-uix Roadmap

> **One package.** Everything ships as the single [`hs-uix`](https://www.npmjs.com/package/hs-uix)
> package, imported by subpath. The old scoped `@hs-uix/*` packages
> (`@hs-uix/datatable`, `@hs-uix/form`, …) are **deprecated** — do not publish or
> depend on them. The `src/<component>/` folders are internal source modules, not
> separately published packages.

```js
import { DataTable }   from "hs-uix/datatable";
import { FormBuilder } from "hs-uix/form";
import { Kanban }      from "hs-uix/kanban";
import { Feed }        from "hs-uix/feed";
import { Calendar }    from "hs-uix/calendar";
// shared building blocks
import { Icon }        from "hs-uix/common-components";
import { CrmDataTable } from "hs-uix/utils";
```

## Components

| Component | Subpath | Status | Summary |
|---|---|---|---|
| DataTable | `hs-uix/datatable` | Shipped | Filterable, sortable, paginated tables; inline edit; row selection; client & server modes |
| FormBuilder | `hs-uix/form` | Shipped | Declarative config-driven forms; validation; multi-step; repeaters; CRM helpers |
| Kanban | `hs-uix/kanban` | Shipped | Drag-free board; stage transitions; metrics; filters; server-side mode |
| Feed | `hs-uix/feed` | Shipped | Activity feed / timeline; grouping; search/filters; load-more |
| Calendar | `hs-uix/calendar` | Shipped | Month / Week / Day / Agenda views (+ experimental Gantt); overlays; search/filters |

Shared internals: `hs-uix/common-components` (Icon, AvatarStack, CollectionToolbar,
StatusTag helpers, SVG/data-URI builders) and `hs-uix/utils` (CRM search adapters,
query/filter helpers, formatters, `CrmDataTable` / `CrmKanban`).

---

## Future ideas

These are candidate enhancements, not commitments. Each lands as a minor bump to
the single `hs-uix` package.

### DataTable
- [ ] Column resizing & reordering
- [ ] Export to CSV
- [ ] Row expansion (detail row)

### FormBuilder
- [ ] Warn on dirty close (unsaved-changes confirmation)
- [ ] Field-level loading spinners while fetching options
- [ ] Schema generation from HubSpot property definitions

### Kanban
- [ ] WIP limits per stage
- [ ] Swimlanes (group rows by a second dimension)

### Feed
- [ ] Real-time append (prepend new items without full reload)
- [ ] Per-type icon/color presets

### Calendar
- [ ] Resource/lane view (rows = owners/resources)
- [ ] Drag-free reschedule via per-event action menu
- [ ] Promote Gantt out of experimental

---

## Repo layout

```
hs-uix/
├── package.json            ← the only published package (subpath exports)
├── index.d.ts              ← root barrel: re-exports every component + shared types
├── <component>.d.ts        ← per-subpath type entry (export * from ./src/<comp>/index)
├── tsup.config.js          ← one entry per subpath
└── src/
    ├── index.js            ← root barrel (mirrors index.d.ts)
    ├── datatable/          ← DataTable source, tests, README, index.d.ts
    ├── form/
    ├── kanban/
    ├── feed/
    ├── calendar/
    ├── common-components/  ← shared Icon / Collection* / SVG primitives
    └── utils/              ← CRM adapters, query helpers, formatters
```

## Build, test, release

```bash
npm run build     # tsup → dist/ (esm + cjs per subpath)
npm test          # vitest (src/**/*.test.{js,jsx})

# release the single package (from repo root)
npm run release:patch   # or release:minor / release:major
```
