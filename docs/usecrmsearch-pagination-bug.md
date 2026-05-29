# Bug: `useCrmSearch` `pagination.nextPage()` skips a page (off-by-one offset)

## Summary
`useCrmSearch().pagination.nextPage()` advances the result cursor one page too far.
After page 1 (offset 0), a single `nextPage()` returns the rows at offset
`2 * pageLength` instead of `pageLength`, while `pagination.currentPage` correctly
reads `2`. The real "second page" (offset `pageLength`) is never reachable, every
page after the first is shifted forward by one, and `hasNextPage` flips to `false`
early.

It behaves as if the offset is derived from the post-increment page number:
`after = currentPage * pageLength` instead of `(currentPage - 1) * pageLength`.

## Environment
- `@hubspot/ui-extensions`: 0.14.0
- `platformVersion`: 2026.03
- React 18, UI Extensions (private app card)
- Reproduces in both local `hs project dev` and an uploaded production build, so it
  is not a React StrictMode dev artifact.

## Minimal reproduction
Drop this into a card extension, pointed at a portal with at least 15 contacts. It
uses the raw `useCrmSearch` hook (no third-party wrappers) and drives the cursor with
the hook's own `pagination.nextPage()`.

```jsx
import { useCrmSearch, Button, Flex, Text } from "@hubspot/ui-extensions";

const Repro = () => {
  const { results, total, pagination } = useCrmSearch({
    objectType: "0-1", // contacts
    properties: ["firstname", "lastname"],
    // Stable, unique sort so cursor paging is deterministic:
    sorts: [{ propertyName: "hs_object_id", direction: "ASCENDING" }],
    pageLength: 5,
  });

  return (
    <Flex direction="column" gap="sm">
      <Text>
        total: {total} | currentPage: {pagination.currentPage} | hasNextPage: {String(pagination.hasNextPage)}
      </Text>
      {/* Watch how this id list jumps after a single click */}
      <Text>ids: {results.map((r) => r.objectId).join(", ")}</Text>
      <Button disabled={!pagination.hasNextPage} onClick={() => pagination.nextPage()}>
        nextPage()
      </Button>
    </Flex>
  );
};
```

## Steps
1. Load the card. Page 1 shows the first 5 contacts (offset 0). Correct.
2. Click `nextPage()` exactly once.

## Observed
- `pagination.currentPage` becomes `2`.
- `results` are the contacts at offset 10 (the third page of 5), not offset 5.
- The contacts at offsets 5 to 9 (the real "page 2") are skipped entirely.
- `pagination.hasNextPage` becomes `false`, even though records remain.

## Expected
After one `nextPage()` from page 1, `results` should be the contacts at offset 5
(the next `pageLength`), with `currentPage` 2 and `hasNextPage` true (13 total, 10 shown).

## Evidence
Same portal (13 contacts), varying only `pageLength`, clicking `nextPage()` once from page 1:

| `pageLength` | page 1 | after one `nextPage()` | expected offset | actual offset |
|---|---|---|---|---|
| 5  | offset 0 (5 rows)  | offset 10 (last 3 rows) | 5  | 10 |
| 7  | offset 0 (7 rows)  | offset 14 (empty)       | 7  | 14 |
| 10 | offset 0 (10 rows) | offset 20 (empty)       | 10 | 20 |
| 20 | offset 0 (all 13)  | n/a, fits in one page   |    |    |

In every multi-page case the cursor lands at `2 * pageLength`, one page past where it
should. `pageLength: 10` only looks like it works on the first click because
`2 * 10 = 20` is already past the 13 total, so it just shows the tail; with a larger
dataset it would still skip offsets 10 to 19.

## Impact
Server-side pagination through `useCrmSearch` is unusable past page 1: you can't page
a result set without skipping records. And because the hook signature is
`Omit<FetchCrmSearchRequest, 'after'>`, callers can't pass or correct `after`
themselves. The `pagination` object is the only paging affordance, so there is no
application-level workaround.

## Suspected cause
The `after` offset for `nextPage()` looks like it's derived from the post-increment
page number, `currentPage * pageLength`, rather than `(currentPage - 1) * pageLength`.
`currentPage` itself increments correctly by 1; only the offset is doubled.

## Notes
- A unique, stable `sorts` (`hs_object_id` ascending) is included so the result order
  is deterministic across requests. The off-by-one is independent of sorting.
- Reproduced with `objectType: "0-1"` (contacts); the math is object-type agnostic.
