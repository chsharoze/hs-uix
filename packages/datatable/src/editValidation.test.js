import { describe, it, expect } from "vitest";
import { editValidationError } from "./editValidation.js";

describe("editValidationError", () => {
  it("treats true / undefined / null as valid", () => {
    expect(editValidationError(true)).toBeNull();
    expect(editValidationError(undefined)).toBeNull();
    expect(editValidationError(null)).toBeNull();
  });

  it("returns a custom string message", () => {
    expect(editValidationError("Too long")).toBe("Too long");
  });

  it("falls back to 'Invalid value' for other failure values", () => {
    expect(editValidationError(false)).toBe("Invalid value");
    expect(editValidationError(0)).toBe("Invalid value");
    expect(editValidationError({})).toBe("Invalid value");
  });
});
