import { describe, it, expect } from "vitest";
import { buildCrmSearchConfig } from "./crmSearchAdapters.js";

describe("buildCrmSearchConfig", () => {
  it("lets filterMap take precedence over the default propertyMap filter mapping", () => {
    const config = buildCrmSearchConfig(
      { filters: { stage: "open" } },
      {
        objectType: "0-3",
        propertyMap: { stage: "dealstage" },
        filterMap: () => [{ filters: [{ propertyName: "pipeline", operator: "EQ", value: "sales" }] }],
      }
    );

    expect(config.filterGroups).toEqual([
      { filters: [{ propertyName: "pipeline", operator: "EQ", value: "sales" }] },
    ]);
  });

  it("uses propertyMap for lightweight default filter mapping when no filterMap is provided", () => {
    const config = buildCrmSearchConfig(
      { filters: { stage: "open" } },
      {
        objectType: "0-3",
        propertyMap: { stage: "dealstage" },
      }
    );

    expect(config.filterGroups).toEqual([
      { filters: [{ propertyName: "dealstage", operator: "EQ", value: "open" }] },
    ]);
  });
});
