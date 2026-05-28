import { describe, it, expect } from "vitest";
import {
  getDependsOnName,
  getDependsOnDisplay,
  getDependsOnLabel,
  getDependsOnMessage,
  resolveDependentCascade,
} from "./formDependencies.js";
import { getEmptyValue } from "./formValues.js";

describe("dependsOn accessors", () => {
  const field = { dependsOnConfig: { field: "country", label: "Region", message: "pick first" } };
  it("reads config", () => {
    expect(getDependsOnName(field)).toBe("country");
    expect(getDependsOnLabel(field)).toBe("Region");
    expect(getDependsOnMessage(field)).toBe("pick first");
  });
  it("display defaults to grouped", () => {
    expect(getDependsOnDisplay(field)).toBe("grouped");
    expect(getDependsOnDisplay({ dependsOnConfig: { display: "inline" } })).toBe("inline");
  });
  it("undefined for fields without config", () => {
    expect(getDependsOnName({})).toBeFalsy();
  });
});

describe("resolveDependentCascade", () => {
  // country -> state (options depend on country)
  const fields = [
    { name: "country", type: "select" },
    {
      name: "state",
      type: "select",
      dependsOnConfig: { field: "country" },
      options: (v) => (v.country === "US" ? [{ value: "CA" }, { value: "NY" }] : [{ value: "ON" }]),
    },
  ];
  const getEmptyValueForField = getEmptyValue;

  it("passes the changed value through unchanged when no dependents", () => {
    const fieldsNoDep = [{ name: "a", type: "text" }];
    const out = resolveDependentCascade({ name: "a", value: "x", fields: fieldsNoDep, values: { a: "" }, getEmptyValueForField });
    expect(out.newValues).toEqual({ a: "x" });
    expect(out.changedDependents).toEqual([]);
  });

  it("clears a dependent scalar value that is no longer valid", () => {
    const out = resolveDependentCascade({
      name: "country",
      value: "CA-country", // makes state options = [ON]; "CA" no longer valid
      fields,
      values: { country: "US", state: "CA" },
      getEmptyValueForField,
    });
    expect(out.newValues.state).toBe(""); // empty value for select
    expect(out.changedDependents).toEqual(["state"]);
  });

  it("keeps a dependent value that is still valid", () => {
    const out = resolveDependentCascade({
      name: "country",
      value: "US",
      fields,
      values: { country: "US", state: "CA" },
      getEmptyValueForField,
    });
    expect(out.newValues.state).toBe("CA");
    expect(out.changedDependents).toEqual([]);
  });

  it("filters invalid entries from a dependent multiselect", () => {
    const msFields = [
      { name: "group", type: "select" },
      {
        name: "tags",
        type: "multiselect",
        dependsOnConfig: { field: "group" },
        options: (v) => (v.group === "a" ? [{ value: "x" }, { value: "y" }] : [{ value: "z" }]),
      },
    ];
    const out = resolveDependentCascade({
      name: "group",
      value: "b", // tags options become [z]; x,y invalid
      fields: msFields,
      values: { group: "a", tags: ["x", "y"] },
      getEmptyValueForField,
    });
    expect(out.newValues.tags).toEqual([]);
    expect(out.changedDependents).toEqual(["tags"]);
  });

  it("cascades transitively (country -> state -> city)", () => {
    const chain = [
      { name: "country", type: "select" },
      {
        name: "state", type: "select", dependsOnConfig: { field: "country" },
        options: (v) => (v.country === "US" ? [{ value: "CA" }] : [{ value: "ON" }]),
      },
      {
        name: "city", type: "select", dependsOnConfig: { field: "state" },
        options: (v) => (v.state === "CA" ? [{ value: "SF" }] : [{ value: "TO" }]),
      },
    ];
    const out = resolveDependentCascade({
      name: "country",
      value: "CA", // -> state options [ON]; "CA" invalid -> cleared; -> city options [TO]; "SF" invalid -> cleared
      fields: chain,
      values: { country: "US", state: "CA", city: "SF" },
      getEmptyValueForField,
    });
    expect(out.newValues.state).toBe("");
    expect(out.newValues.city).toBe("");
    expect(out.changedDependents).toContain("state");
    expect(out.changedDependents).toContain("city");
  });

  it("does not mutate the input values object", () => {
    const values = { country: "US", state: "CA" };
    resolveDependentCascade({ name: "country", value: "X", fields, values, getEmptyValueForField });
    expect(values).toEqual({ country: "US", state: "CA" });
  });
});
