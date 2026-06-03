// ═══════════════════════════════════════════════════════════════════════════
// Form value model — pure helpers for empty values, emptiness, deep equality,
// cloning, and HubSpot date/time value-object shapes.
//
// Extracted verbatim from FormBuilder.jsx so the value semantics live behind a
// small, directly-testable interface instead of being buried among ~3,000
// lines of component code. The validation engine (formValidation.js) and the
// dependency resolver (formDependencies.js) both build on this module.
// ═══════════════════════════════════════════════════════════════════════════

export const isPlainObject = (value) =>
  Object.prototype.toString.call(value) === "[object Object]";

export const getEmptyValue = (field) => {
  switch (field.type) {
    case "toggle":
    case "checkbox":
      return false;
    case "multiselect":
    case "checkboxGroup":
      return [];
    case "number":
    case "stepper":
    case "currency":
      return undefined;
    case "date":
    case "time":
    case "datetime":
      return undefined;
    case "display":
    case "slot":
    case "crmPropertyList":
    case "crmAssociationPropertyList":
      return undefined; // these field types have no form value
    case "repeater":
      return [];
    default:
      return "";
  }
};

export const isValueEmpty = (value, field) => {
  if (value === undefined || value === null) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  // false is a valid value for toggles/checkboxes — not "empty" unless required means "must be checked"
  if ((field.type === "toggle" || field.type === "checkbox") && value === false) return true;
  return false;
};

export const isDateValueObject = (value) =>
  isPlainObject(value) &&
  Number.isInteger(value.year) &&
  Number.isInteger(value.month) &&
  Number.isInteger(value.date);

export const isTimeValueObject = (value) =>
  isPlainObject(value) &&
  Number.isInteger(value.hours) &&
  Number.isInteger(value.minutes);

export const compareDateValues = (a, b) => {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.date - b.date;
};

export const compareTimeValues = (a, b) => {
  if (a.hours !== b.hours) return a.hours - b.hours;
  return a.minutes - b.minutes;
};

export const deepEqual = (a, b) => {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (a == null || b == null) return false;

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  if (isPlainObject(a) && isPlainObject(b)) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    for (const key of aKeys) {
      if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
      if (!deepEqual(a[key], b[key])) return false;
    }
    return true;
  }

  return false;
};

export const deepClone = (value) => {
  if (Array.isArray(value)) return value.map(deepClone);
  if (value instanceof Date) return new Date(value.getTime());
  if (isPlainObject(value)) {
    const next = {};
    for (const key of Object.keys(value)) {
      next[key] = deepClone(value[key]);
    }
    return next;
  }
  return value;
};
