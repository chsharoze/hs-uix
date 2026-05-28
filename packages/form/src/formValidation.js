// ═══════════════════════════════════════════════════════════════════════════
// Form validation engine — required / type / pattern / min-max / custom
// sync + async validators, plus field-config resolution (required, disabled,
// options).
//
// Extracted verbatim from FormBuilder.jsx. Previously this lived inside the
// component as a tangle of helpers and useCallbacks, exercisable only by
// mounting the form. It is pure: given a field config + values, it returns an
// error string (or null) — the single highest-value test surface in the form.
// ═══════════════════════════════════════════════════════════════════════════

import {
  isPlainObject,
  isValueEmpty,
  isDateValueObject,
  isTimeValueObject,
  compareDateValues,
  compareTimeValues,
} from "./formValues.js";

export const isPromise = (value) => value && typeof value.then === "function";
export const isAsyncFunction = (fn) => fn && fn.constructor && fn.constructor.name === "AsyncFunction";

export const normalizeValidatorResult = (result) => {
  if (result === true || result === undefined || result === null || result === false) return null;
  return String(result);
};

export const resolveRequired = (field, allValues) => {
  if (typeof field.required === "function") return field.required(allValues);
  return !!field.required;
};

export const resolveDisabled = (field, allValues) => {
  if (typeof field.disabled === "function") return field.disabled(allValues);
  return !!field.disabled;
};

export const resolveOptions = (field, allValues) => {
  if (typeof field.options === "function") return field.options(allValues);
  return field.options || [];
};

export const runDefaultFieldValidator = (value, field, allValues) => {
  const errorPrefix = field.label || field.name;

  switch (field.type) {
    case "text":
    case "password":
    case "textarea":
      if (typeof value !== "string") return `${errorPrefix} must be text`;
      break;
    case "number":
    case "stepper":
    case "currency":
      if (typeof value !== "number" || Number.isNaN(value)) return `${errorPrefix} must be a number`;
      break;
    case "toggle":
    case "checkbox":
      if (typeof value !== "boolean") return `${errorPrefix} must be true or false`;
      break;
    case "select":
    case "radioGroup": {
      const options = resolveOptions(field, allValues);
      if (options.length > 0 && !options.some((o) => Object.is(o.value, value))) {
        return `${errorPrefix} has an invalid selection`;
      }
      break;
    }
    case "multiselect":
    case "checkboxGroup": {
      if (!Array.isArray(value)) return `${errorPrefix} must be a list`;
      const options = resolveOptions(field, allValues);
      if (options.length > 0) {
        const validValues = new Set(options.map((o) => o.value));
        const hasInvalid = value.some((item) => !validValues.has(item));
        if (hasInvalid) return `${errorPrefix} has an invalid selection`;
      }
      break;
    }
    case "date":
      if (!isDateValueObject(value)) return `${errorPrefix} has an invalid date`;
      break;
    case "time":
      if (!isTimeValueObject(value)) return `${errorPrefix} has an invalid time`;
      break;
    case "datetime": {
      if (!isPlainObject(value)) return `${errorPrefix} has an invalid date/time`;
      const hasDate = value.date !== undefined;
      const hasTime = value.time !== undefined;
      if (!hasDate && !hasTime) return `${errorPrefix} has an invalid date/time`;
      if (hasDate && !isDateValueObject(value.date)) return `${errorPrefix} has an invalid date`;
      if (hasTime && !isTimeValueObject(value.time)) return `${errorPrefix} has an invalid time`;
      break;
    }
    case "repeater":
      if (!Array.isArray(value)) return `${errorPrefix} has invalid rows`;
      break;
    default:
      break;
  }

  return null;
};

export const runCustomSyncValidators = (value, field, allValues) => {
  const validators = Array.isArray(field.validators) ? field.validators : [];
  for (const validator of validators) {
    if (isAsyncFunction(validator)) continue;
    try {
      const result = validator(value, allValues);
      if (isPromise(result)) continue;
      const err = normalizeValidatorResult(result);
      if (err) return err;
    } catch (err) {
      return err?.message || "Validation failed";
    }
  }

  if (field.validate && !isAsyncFunction(field.validate)) {
    try {
      const result = field.validate(value, allValues);
      if (!isPromise(result)) {
        const err = normalizeValidatorResult(result);
        if (err) return err;
      }
    } catch (err) {
      return err?.message || "Validation failed";
    }
  }

  return null;
};

export const collectAsyncValidatorPromises = (value, field, allValues, context) => {
  const promises = [];
  const validators = Array.isArray(field.validators) ? field.validators : [];
  for (const validator of validators) {
    try {
      const result = validator(value, allValues, context);
      if (isPromise(result)) promises.push(result);
    } catch (err) {
      promises.push(Promise.reject(err));
    }
  }

  if (field.validate) {
    try {
      const result = field.validate(value, allValues, context);
      if (isPromise(result)) promises.push(result);
    } catch (err) {
      promises.push(Promise.reject(err));
    }
  }

  return promises;
};

export const runValidators = (value, field, allValues, fieldTypes, options = {}) => {
  const includeCustomValidators = options.includeCustomValidators !== false;
  const msg = options.messages || {};
  // Display, CRM data, and fieldGroup fields have no direct validation
  if (field.type === "display" || field.type === "slot" || field.type === "crmPropertyList" || field.type === "crmAssociationPropertyList" || field.type === "fieldGroup") return null;

  // 1. Required (supports function form for conditional required)
  const isRequired = resolveRequired(field, allValues);
  // Check custom type isEmpty if available
  const plugin = fieldTypes && fieldTypes[field.type];
  const empty = plugin && plugin.isEmpty
    ? plugin.isEmpty(value)
    : isValueEmpty(value, field);
  if (isRequired && empty) {
    const fn = msg.required || ((label) => `${label} is required`);
    return typeof fn === "function" ? fn(field.label) : fn;
  }

  // Skip further validation if empty and not required
  if (empty) return null;

  // 2. Built-in type/shape validators
  if (field.useDefaultValidators !== false) {
    const typeError = runDefaultFieldValidator(value, field, allValues);
    if (typeError) return typeError;
  }

  // 3. Pattern (text/textarea/password only)
  if (field.pattern && typeof value === "string") {
    if (!field.pattern.test(value)) {
      return field.patternMessage || msg.invalidFormat || "Invalid format";
    }
  }

  // 4. Min/Max length (text/textarea)
  if (typeof value === "string") {
    if (field.minLength != null && value.length < field.minLength) {
      const fn = msg.minLength || ((min) => `Must be at least ${min} characters`);
      return typeof fn === "function" ? fn(field.minLength) : fn;
    }
    if (field.maxLength != null && value.length > field.maxLength) {
      const fn = msg.maxLength || ((max) => `Must be no more than ${max} characters`);
      return typeof fn === "function" ? fn(field.maxLength) : fn;
    }
  }

  // 5. Min/Max value (number/stepper/currency/date/time)
  if (typeof value === "number") {
    if (field.min != null && value < field.min) {
      const fn = msg.minValue || ((min) => `Must be at least ${min}`);
      return typeof fn === "function" ? fn(field.min) : fn;
    }
    if (field.max != null && value > field.max) {
      const fn = msg.maxValue || ((max) => `Must be no more than ${max}`);
      return typeof fn === "function" ? fn(field.max) : fn;
    }
  }

  if (field.type === "date" && isDateValueObject(value)) {
    if (field.min && isDateValueObject(field.min) && compareDateValues(value, field.min) < 0) {
      return field.minValidationMessage || "Date is too early";
    }
    if (field.max && isDateValueObject(field.max) && compareDateValues(value, field.max) > 0) {
      return field.maxValidationMessage || "Date is too late";
    }
  }

  if (field.type === "time" && isTimeValueObject(value)) {
    if (field.min && isTimeValueObject(field.min) && compareTimeValues(value, field.min) < 0) {
      return field.minValidationMessage || "Time is too early";
    }
    if (field.max && isTimeValueObject(field.max) && compareTimeValues(value, field.max) > 0) {
      return field.maxValidationMessage || "Time is too late";
    }
  }

  // 6. Custom validate (sync only — async handled separately)
  if (includeCustomValidators) {
    const customError = runCustomSyncValidators(value, field, allValues);
    if (customError) return customError;
  }

  return null;
};
