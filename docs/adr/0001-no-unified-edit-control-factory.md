# ADR 0001 — No unified edit-control factory in DataTable

- Status: Accepted
- Date: 2026-05-28

## Context

`DataTable.jsx` has two parallel renderers for editable cells:
`renderEditControl` (discrete / click-to-edit) and `renderInlineControl`
(inline / always-on). Each is a ~13-case `switch` on `col.editType` mapping a
type to a HubSpot input component. An architecture review flagged the apparent
duplication and suggested a single "field-type adapter" factory shared by both.

## Decision

We will **not** extract a unified edit-control factory. Instead, only the pure,
genuinely-shared rule — interpreting an `editValidate` result into an error
message — was extracted into `editValidation.js` (`editValidationError`).

## Why

On close reading, the two renderers differ in nearly every wired prop, not just
the type switch:

- **Value source**: discrete reads draft state (`editValue`); inline reads the
  live row value (`row[col.field]`).
- **Change handler**: discrete `commit` (validate → `onRowEdit` → exit edit);
  inline `fire` (validate → `onRowEdit` immediately, no exit).
- **Blur**: discrete wires `onBlur` (exit / datetime-aware); inline has none.
- **Select**: discrete renders `variant="transparent"`; inline does not.
- **datetime**: discrete commits with `keepEditing` and a focus-aware blur;
  inline calls `fire` directly.
- **Error state**: discrete uses single `editError`; inline uses per-cell
  `inlineErrors[cellKey]`.

A factory would need ~10 parameters carrying all of the above. That interface
is nearly as complex as the body it replaces — a **shallow module** by the
project's own architecture vocabulary (interface ≈ implementation), with no net
gain in leverage or locality. It is also pure JSX with no unit-test surface in
the current harness (no React Testing Library), so on a published library the
change would carry real regression risk it cannot offset with tests.

The incidental duplication (the type→component switch) is cheaper to leave in
place than to hide behind a shallow seam. The one **deep** shared rule (what
counts as a validation failure, and the fallback message) now lives once in
`editValidation.js` and is unit-tested.

## Revisit if

- A third edit surface needs the same type switch (then the seam earns a second
  real adapter), or
- React Testing Library is added, removing the "untestable" objection, or
- The set of edit types grows large enough that the duplicated switch becomes a
  maintenance hotspot in practice.
