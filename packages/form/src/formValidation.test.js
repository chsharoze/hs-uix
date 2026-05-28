import { describe, it, expect } from "vitest";
import {
  isPromise,
  isAsyncFunction,
  normalizeValidatorResult,
  resolveRequired,
  resolveDisabled,
  resolveOptions,
  runDefaultFieldValidator,
  runCustomSyncValidators,
  collectAsyncValidatorPromises,
  runValidators,
} from "./formValidation.js";

describe("predicates", () => {
  it("isPromise / isAsyncFunction", () => {
    expect(isPromise(Promise.resolve())).toBe(true);
    expect(isPromise({})).toBeFalsy();
    expect(isAsyncFunction(async () => {})).toBe(true);
    expect(isAsyncFunction(() => {})).toBeFalsy();
  });
  it("normalizeValidatorResult collapses pass values to null", () => {
    expect(normalizeValidatorResult(true)).toBeNull();
    expect(normalizeValidatorResult(undefined)).toBeNull();
    expect(normalizeValidatorResult(false)).toBeNull();
    expect(normalizeValidatorResult("bad")).toBe("bad");
  });
});

describe("field-config resolution", () => {
  it("resolves static and function forms", () => {
    expect(resolveRequired({ required: true }, {})).toBe(true);
    expect(resolveRequired({ required: (v) => v.a === 1 }, { a: 1 })).toBe(true);
    expect(resolveDisabled({ disabled: (v) => !!v.lock }, { lock: 1 })).toBe(true);
    expect(resolveOptions({ options: (v) => [{ value: v.a }] }, { a: 5 })).toEqual([{ value: 5 }]);
    expect(resolveOptions({}, {})).toEqual([]);
  });
});

describe("runDefaultFieldValidator", () => {
  it("type-checks primitives", () => {
    expect(runDefaultFieldValidator(5, { type: "text", name: "n" }, {})).toMatch(/must be text/);
    expect(runDefaultFieldValidator("x", { type: "number", name: "n" }, {})).toMatch(/must be a number/);
    expect(runDefaultFieldValidator("x", { type: "toggle", name: "n" }, {})).toMatch(/true or false/);
  });
  it("validates select against options", () => {
    const field = { type: "select", name: "s", options: [{ value: "a" }] };
    expect(runDefaultFieldValidator("a", field, {})).toBeNull();
    expect(runDefaultFieldValidator("z", field, {})).toMatch(/invalid selection/);
  });
  it("validates date/time shapes", () => {
    expect(runDefaultFieldValidator({ year: 2024, month: 0, date: 1 }, { type: "date", name: "d" }, {})).toBeNull();
    expect(runDefaultFieldValidator({}, { type: "date", name: "d" }, {})).toMatch(/invalid date/);
  });
});

describe("runCustomSyncValidators", () => {
  it("returns first sync error, skips async", () => {
    const field = {
      validators: [
        () => true,
        (v) => (v > 0 ? true : "must be positive"),
      ],
    };
    expect(runCustomSyncValidators(5, field, {})).toBeNull();
    expect(runCustomSyncValidators(-1, field, {})).toBe("must be positive");
  });
  it("catches thrown errors", () => {
    const field = { validate: () => { throw new Error("boom"); } };
    expect(runCustomSyncValidators("x", field, {})).toBe("boom");
  });
});

describe("collectAsyncValidatorPromises", () => {
  it("collects only promise-returning validators", () => {
    const field = {
      validators: [() => true, async () => "later"],
      validate: () => Promise.resolve(true),
    };
    const proms = collectAsyncValidatorPromises("x", field, {}, {});
    expect(proms.length).toBe(2);
    expect(proms.every(isPromise)).toBe(true);
  });
});

describe("runValidators (orchestrator)", () => {
  it("required + empty yields required error", () => {
    expect(runValidators("", { type: "text", name: "n", label: "Name", required: true }, {}, {})).toBe("Name is required");
  });
  it("empty + optional passes", () => {
    expect(runValidators("", { type: "text", name: "n" }, {}, {})).toBeNull();
  });
  it("pattern mismatch", () => {
    const field = { type: "text", name: "n", pattern: /^\d+$/, patternMessage: "digits only" };
    expect(runValidators("abc", field, {}, {})).toBe("digits only");
    expect(runValidators("123", field, {}, {})).toBeNull();
  });
  it("min/max length", () => {
    expect(runValidators("ab", { type: "text", name: "n", minLength: 3 }, {}, {})).toMatch(/at least 3/);
    expect(runValidators("abcd", { type: "text", name: "n", maxLength: 3 }, {}, {})).toMatch(/no more than 3/);
  });
  it("min/max numeric value", () => {
    expect(runValidators(2, { type: "number", name: "n", min: 5 }, {}, {})).toMatch(/at least 5/);
    expect(runValidators(9, { type: "number", name: "n", max: 5 }, {}, {})).toMatch(/no more than 5/);
  });
  it("custom messages override defaults", () => {
    const out = runValidators("", { type: "text", name: "n", label: "Email", required: true }, {}, {}, {
      messages: { required: (label) => `${label} cannot be blank` },
    });
    expect(out).toBe("Email cannot be blank");
  });
  it("respects fieldTypes plugin isEmpty", () => {
    const fieldTypes = { custom: { isEmpty: (v) => v === "EMPTY" } };
    const field = { type: "custom", name: "c", label: "C", required: true };
    expect(runValidators("EMPTY", field, {}, fieldTypes)).toBe("C is required");
    expect(runValidators("filled", field, {}, fieldTypes)).toBeNull();
  });
  it("skips non-validating field types", () => {
    expect(runValidators(undefined, { type: "display", name: "d", required: true }, {}, {})).toBeNull();
  });
});
