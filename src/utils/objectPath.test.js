import { describe, it, expect } from "vitest";
import { getByPath } from "./objectPath.js";

describe("getByPath", () => {
  const obj = { a: { b: { c: 42 } }, name: "x", nil: null };

  it("reads nested dotted paths", () => {
    expect(getByPath(obj, "a.b.c")).toBe(42);
    expect(getByPath(obj, "name")).toBe("x");
  });

  it("returns undefined for missing or broken paths", () => {
    expect(getByPath(obj, "a.x.y")).toBeUndefined();
    expect(getByPath(obj, "nil.deep")).toBeUndefined();
    expect(getByPath(obj, "")).toBeUndefined();
    expect(getByPath(obj, undefined)).toBeUndefined();
  });

  it("invokes accessor functions", () => {
    expect(getByPath(obj, (o) => o.a.b.c)).toBe(42);
  });

  it("coerces non-string paths via String()", () => {
    expect(getByPath({ 1: "one" }, 1)).toBe("one");
  });
});
