import { describe, it, expect } from "vitest";
import {
  getEmptyFilterValue,
  getEmptyFilterValues,
  resetFilterValues,
  buildActiveFilterChips,
  isFilterActive,
  formatDateChip,
  dateToTimestamp,
  toStableKey,
  filterRows,
  searchRows,
} from "./query.js";

describe("getEmptyFilterValue", () => {
  it("returns [] for multiselect", () => {
    expect(getEmptyFilterValue({ type: "multiselect" })).toEqual([]);
  });
  it("returns {from,to} for dateRange", () => {
    expect(getEmptyFilterValue({ type: "dateRange" })).toEqual({ from: null, to: null });
  });
  it("returns '' for select / default", () => {
    expect(getEmptyFilterValue({ type: "select" })).toBe("");
    expect(getEmptyFilterValue({})).toBe("");
  });
});

describe("getEmptyFilterValues / resetFilterValues", () => {
  const filters = [
    { name: "stage" },
    { name: "owners", type: "multiselect" },
    { name: "when", type: "dateRange" },
  ];

  it("builds an empty values object for all filters", () => {
    expect(getEmptyFilterValues(filters)).toEqual({
      stage: "",
      owners: [],
      when: { from: null, to: null },
    });
  });

  it("resets one filter while preserving the others", () => {
    expect(resetFilterValues(filters, { stage: "open", owners: ["1"], other: "x" }, "owners"))
      .toEqual({ stage: "open", owners: [], other: "x" });
  });

  it("resets all filters", () => {
    expect(resetFilterValues(filters, { stage: "open", owners: ["1"] }, "all"))
      .toEqual({ stage: "", owners: [], when: { from: null, to: null } });
  });

  it("supports custom empty values", () => {
    expect(getEmptyFilterValues([{ name: "type" }], { getEmptyValue: () => "all" }))
      .toEqual({ type: "all" });
  });

  it("supports filter-level emptyValue", () => {
    expect(getEmptyFilterValue({ name: "type", emptyValue: "all" })).toBe("all");
    expect(isFilterActive({ name: "type", emptyValue: "all" }, "all")).toBe(false);
    expect(isFilterActive({ name: "type", emptyValue: "all" }, "email")).toBe(true);
  });
});

describe("isFilterActive", () => {
  it("multiselect active only with non-empty array", () => {
    expect(isFilterActive({ type: "multiselect" }, [])).toBe(false);
    expect(isFilterActive({ type: "multiselect" }, ["a"])).toBe(true);
    expect(isFilterActive({ type: "multiselect" }, undefined)).toBe(false);
  });
  it("dateRange active with either bound", () => {
    expect(isFilterActive({ type: "dateRange" }, { from: null, to: null })).toBeFalsy();
    expect(isFilterActive({ type: "dateRange" }, { from: { year: 2024, month: 0, date: 1 }, to: null })).toBeTruthy();
  });
  it("select active with truthy value", () => {
    expect(isFilterActive({}, "")).toBe(false);
    expect(isFilterActive({}, "x")).toBe(true);
  });
});

describe("dateToTimestamp / formatDateChip", () => {
  it("round-trips a date object to a timestamp", () => {
    const obj = { year: 2024, month: 0, date: 15 };
    expect(dateToTimestamp(obj)).toBe(new Date(2024, 0, 15).getTime());
  });
  it("returns null/'' for missing input", () => {
    expect(dateToTimestamp(null)).toBeNull();
    expect(formatDateChip(null)).toBe("");
  });
  it("formats a chip label", () => {
    expect(formatDateChip({ year: 2024, month: 0, date: 15 })).toBe("Jan 15, 2024");
  });
});

describe("buildActiveFilterChips", () => {
  it("builds labels for select, multiselect, and dateRange filters", () => {
    const chips = buildActiveFilterChips(
      [
        { name: "stage", placeholder: "Stage", options: [{ label: "Open", value: "open" }] },
        { name: "owners", type: "multiselect", label: "Owners", options: [{ label: "Ann", value: "a" }, { label: "Bob", value: "b" }] },
        { name: "when", type: "dateRange", chipLabel: "Date" },
      ],
      {
        stage: "open",
        owners: ["a", "b"],
        when: { from: { year: 2024, month: 0, date: 1 }, to: { year: 2024, month: 0, date: 31 } },
      }
    );

    expect(chips).toEqual([
      { key: "stage", label: "Stage: Open" },
      { key: "owners", label: "Owners: Ann, Bob" },
      { key: "when", label: "Date: from Jan 1, 2024 to Jan 31, 2024" },
    ]);
  });

  it("supports custom active detection and date label options", () => {
    const chips = buildActiveFilterChips(
      [{ name: "created", type: "dateRange", placeholder: "Created" }],
      { created: { from: "2024-01-01", to: "2024-01-31" } },
      {
        isFilterActive: (_filter, value) => !!value.from || !!value.to,
        formatDate: (value) => value,
        dateFromPrefix: "",
        dateToPrefix: "",
        dateJoiner: " – ",
      }
    );

    expect(chips).toEqual([{ key: "created", label: "Created: 2024-01-01 – 2024-01-31" }]);
  });
});

describe("toStableKey", () => {
  it("serializes JSON-able values", () => {
    expect(toStableKey({ a: 1 })).toBe('{"a":1}');
  });
  it("falls back to String() on cyclic values", () => {
    const cyclic = {};
    cyclic.self = cyclic;
    expect(typeof toStableKey(cyclic)).toBe("string");
  });
});

describe("filterRows", () => {
  const rows = [
    { id: 1, stage: "a", n: 10, when: "2024-01-10" },
    { id: 2, stage: "b", n: 20, when: "2024-02-10" },
    { id: 3, stage: "a", n: 30, when: "2024-03-10" },
  ];

  it("returns all rows when no filters active", () => {
    expect(filterRows(rows, [{ name: "stage" }], { stage: "" })).toEqual(rows);
    expect(filterRows(rows, [], {})).toEqual(rows);
  });

  it("exact match (select)", () => {
    const out = filterRows(rows, [{ name: "stage" }], { stage: "a" });
    expect(out.map((r) => r.id)).toEqual([1, 3]);
  });

  it("multiselect = any of", () => {
    const out = filterRows(rows, [{ name: "stage", type: "multiselect" }], { stage: ["b", "a"] });
    expect(out.map((r) => r.id)).toEqual([1, 2, 3]);
  });

  it("dateRange inclusive of end-of-day", () => {
    const out = filterRows(rows, [{ name: "when", type: "dateRange" }], {
      when: { from: { year: 2024, month: 1, date: 1 }, to: { year: 2024, month: 1, date: 28 } },
    });
    expect(out.map((r) => r.id)).toEqual([2]);
  });

  it("custom filterFn overrides type branching", () => {
    const out = filterRows(rows, [{ name: "n", filterFn: (row, v) => row.n >= v }], { n: 20 });
    expect(out.map((r) => r.id)).toEqual([2, 3]);
  });

  it("composes multiple filters (AND)", () => {
    const out = filterRows(
      rows,
      [{ name: "stage" }, { name: "n", filterFn: (row, v) => row.n > v }],
      { stage: "a", n: 15 }
    );
    expect(out.map((r) => r.id)).toEqual([3]);
  });
});

describe("searchRows", () => {
  const rows = [
    { id: 1, name: "Acme Corp", note: 0 },
    { id: 2, name: "Beta LLC", note: "" },
    { id: 3, name: "Acme Holdings", note: false },
  ];

  it("returns all rows for empty term or no fields", () => {
    expect(searchRows(rows, "", ["name"])).toEqual(rows);
    expect(searchRows(rows, "acme", [])).toEqual(rows);
    expect(searchRows(rows, null, ["name"])).toEqual(rows);
  });

  it("literal case-insensitive substring match", () => {
    const out = searchRows(rows, "acme", ["name"]);
    expect(out.map((r) => r.id)).toEqual([1, 3]);
  });

  it("treats falsy field values as non-matches", () => {
    // note holds 0 / "" / false — none should match a term
    expect(searchRows(rows, "0", ["note"])).toEqual([]);
  });

  it("fuzzy search returns matches via Fuse", () => {
    const out = searchRows(rows, "acme", ["name"], { fuzzy: true });
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((r) => r.name.includes("Acme"))).toBe(true);
  });
});
