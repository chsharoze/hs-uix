// ═══════════════════════════════════════════════════════════════════════════
// Inline/discrete edit validation result coercion.
//
// The rule for interpreting a column `editValidate(value, row)` return — which
// values mean "valid" and what message a failure produces — was duplicated in
// four places across DataTable's two edit-control renderers. Centralized here
// as one pure, testable function.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Interpret the result of a column `editValidate` callback.
 * `true` / `undefined` / `null` mean valid. A string is a custom error
 * message; any other truthy-failure value falls back to "Invalid value".
 *
 * @param {any} result
 * @returns {string | null} error message, or null when valid
 */
export const editValidationError = (result) => {
  if (result === true || result === undefined || result === null) return null;
  return typeof result === "string" ? result : "Invalid value";
};
