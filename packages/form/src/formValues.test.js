import { describe, it, expect } from "vitest";
import {
  isPlainObject,
  getEmptyValue,
  isValueEmpty,
  isDateValueObject,
  isTimeValueObject,
  compareDateValues,
  compareTimeValues,
  deepEqual,
  deepClone,
} from "./formValues.js";

describe("getEmptyValue", () => {
  it("booleans for toggle/checkbox", () => {
    expect(getEmptyValue({ type: "toggle" })).toBe(false);
    expect(getEmptyValue({ type: "checkbox" })).toBe(false);
  });
  it("arrays for multiselect/checkboxGroup/repeater", () => {
    expect(getEmptyValue({ type: "multiselect" })).toEqual([]);
    expect(getEmptyValue({ type: "repeater" })).toEqual([]);
  });
  it("undefined for numbers/dates/display", () => {
    expect(getEmptyValue({ type: "number" })).toBeUndefined();
    expect(getEmptyValue({ type: "date" })).toBeUndefined();
    expect(getEmptyValue({ type: "display" })).toBeUndefined();
  });
  it("empty string by default", () => {
    expect(getEmptyValue({ type: "text" })).toBe("");
  });
});

describe("isValueEmpty", () => {
  it("null/undefined are empty", () => {
    expect(isValueEmpty(undefined, { type: "text" })).toBe(true);
    expect(isValueEmpty(null, { type: "text" })).toBe(true);
  });
  it("whitespace string is empty", () => {
    expect(isValueEmpty("   ", { type: "text" })).toBe(true);
    expect(isValueEmpty("x", { type: "text" })).toBe(false);
  });
  it("empty array is empty", () => {
    expect(isValueEmpty([], { type: "multiselect" })).toBe(true);
  });
  it("false counts as empty only for toggle/checkbox", () => {
    expect(isValueEmpty(false, { type: "toggle" })).toBe(true);
    expect(isValueEmpty(false, { type: "text" })).toBe(false);
  });
});

describe("date/time value objects", () => {
  it("recognizes well-formed shapes", () => {
    expect(isDateValueObject({ year: 2024, month: 0, date: 1 })).toBe(true);
    expect(isTimeValueObject({ hours: 9, minutes: 30 })).toBe(true);
    expect(isDateValueObject({ year: 2024 })).toBe(false);
    expect(isTimeValueObject({ hours: 9 })).toBe(false);
  });
  it("compares dates and times", () => {
    expect(compareDateValues({ year: 2024, month: 0, date: 1 }, { year: 2023, month: 11, date: 31 })).toBeGreaterThan(0);
    expect(compareTimeValues({ hours: 9, minutes: 0 }, { hours: 9, minutes: 30 })).toBeLessThan(0);
  });
});

describe("isPlainObject", () => {
  it("distinguishes plain objects", () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject(new Date())).toBe(false);
    expect(isPlainObject(null)).toBe(false);
  });
});

describe("deepEqual", () => {
  it("compares nested structures", () => {
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });
  it("compares dates by time", () => {
    expect(deepEqual(new Date(0), new Date(0))).toBe(true);
    expect(deepEqual(new Date(0), new Date(1))).toBe(false);
  });
});

describe("deepClone", () => {
  it("clones without sharing references", () => {
    const src = { a: [1, 2], d: new Date(5), nested: { x: 1 } };
    const out = deepClone(src);
    expect(out).toEqual(src);
    expect(out.a).not.toBe(src.a);
    expect(out.nested).not.toBe(src.nested);
    expect(out.d).not.toBe(src.d);
  });
});
