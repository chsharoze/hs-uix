import Fuse from "fuse.js";

// ═══════════════════════════════════════════════════════════════════════════
// Shared query primitives for grid/board surfaces (DataTable, Kanban)
//
// Before this module these helpers and the filter/search pipeline were
// copy-pasted, character-for-character, into DataTable.jsx and Kanban.jsx. A
// fix in one copy left the other broken. This concentrates them in one place
// so the rules of "what each filter type means" and "how search matches" live
// once and are unit-testable without mounting a 1,800-line component.
//
// NOTE: Feed.jsx uses the generic chip/reset helpers here, but deliberately
// keeps its own filtering pipeline because it relies on path-based `getValue()`
// accessors and string-coercing equality. Merging that pipeline would change
// Feed behavior.
// ═══════════════════════════════════════════════════════════════════════════

/** The "no selection" value for a filter, by control type. */
export const getEmptyFilterValue = (filter) => {
  const type = filter.type || "select";
  if (type === "multiselect") return [];
  if (type === "dateRange") return { from: null, to: null };
  if (Object.prototype.hasOwnProperty.call(filter, "emptyValue")) return filter.emptyValue;
  return "";
};

/** Whether a filter currently constrains the data (i.e. has a real value). */
export const isFilterActive = (filter, value) => {
  const type = filter.type || "select";
  if (type === "multiselect") return Array.isArray(value) && value.length > 0;
  if (type === "dateRange") return value && (value.from || value.to);
  if (value == null) return false;
  if (Object.prototype.hasOwnProperty.call(filter, "emptyValue")) return value !== filter.emptyValue;
  return !!value;
};

/** Human-readable chip label for a HubSpot date value object. */
export const formatDateChip = (dateObj) => {
  if (!dateObj) return "";
  const { year, month, date } = dateObj;
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", year: "numeric",
  }).format(new Date(year, month, date));
};

/** Convert a HubSpot date value object to an epoch-ms timestamp. */
export const dateToTimestamp = (dateObj) => {
  if (!dateObj) return null;
  return new Date(dateObj.year, dateObj.month, dateObj.date).getTime();
};

/** Build an object of empty values for every filter in a config list. */
export const getEmptyFilterValues = (filters, options = {}) => {
  const out = {};
  for (const filter of filters || []) {
    out[filter.name] = typeof options.getEmptyValue === "function"
      ? options.getEmptyValue(filter)
      : getEmptyFilterValue(filter);
  }
  return out;
};

/** Return a new filter-values object with one filter, or all filters, reset. */
export const resetFilterValues = (filters, values = {}, key = "all", options = {}) => {
  if (key === "all") return getEmptyFilterValues(filters, options);
  const filter = (filters || []).find((item) => item.name === key);
  const emptyValue = filter
    ? (typeof options.getEmptyValue === "function" ? options.getEmptyValue(filter) : getEmptyFilterValue(filter))
    : (options.fallbackEmptyValue ?? "");
  return { ...(values || {}), [key]: emptyValue };
};

const findOptionLabel = (filter, value) =>
  (filter.options || []).find((option) => option.value === value)?.label || value;

/** Build standard active-filter chip descriptors from filter config + values. */
export const buildActiveFilterChips = (filters, values = {}, options = {}) => {
  const chips = [];
  const isActive = options.isFilterActive || isFilterActive;
  const dateFormatter = options.formatDate || formatDateChip;
  const dateJoiner = options.dateJoiner ?? " ";

  for (const filter of filters || []) {
    const value = values?.[filter.name];
    if (!isActive(filter, value)) continue;

    const type = filter.type || "select";
    const prefix = filter.chipLabel || filter.placeholder || filter.label || filter.name;

    if (type === "multiselect") {
      const labels = (Array.isArray(value) ? value : [])
        .map((item) => findOptionLabel(filter, item))
        .join(", ");
      chips.push({ key: filter.name, label: `${prefix}: ${labels}` });
    } else if (type === "dateRange") {
      const parts = [];
      if (value?.from) parts.push(`${options.dateFromPrefix ?? "from "}${dateFormatter(value.from)}`);
      if (value?.to) parts.push(`${options.dateToPrefix ?? "to "}${dateFormatter(value.to)}`);
      chips.push({ key: filter.name, label: `${prefix}: ${parts.join(dateJoiner)}` });
    } else {
      chips.push({ key: filter.name, label: `${prefix}: ${findOptionLabel(filter, value)}` });
    }
  }

  return chips;
};

/** Stable string fingerprint of a value (used to detect query changes). */
export const toStableKey = (value) => {
  try {
    return JSON.stringify(value);
  } catch (_error) {
    return String(value);
  }
};

/**
 * Apply a set of filters to rows. Mirrors the exact branching previously
 * inlined in DataTable and Kanban: custom filterFn override, multiselect
 * "any of", dateRange (inclusive end-of-day), else strict equality.
 *
 * @param {Array<object>} rows
 * @param {Array<object>} filters   filter configs ({ name, type, filterFn })
 * @param {Record<string, any>} values  current value per filter name
 */
export const filterRows = (rows, filters, values = {}) => {
  let result = rows;

  for (const filter of filters || []) {
    const value = values[filter.name];
    if (!isFilterActive(filter, value)) continue;

    const type = filter.type || "select";

    if (filter.filterFn) {
      result = result.filter((row) => filter.filterFn(row, value));
    } else if (type === "multiselect") {
      // "Any of" matching
      result = result.filter((row) => value.includes(row[filter.name]));
    } else if (type === "dateRange") {
      const fromTs = dateToTimestamp(value.from);
      const toTs = value.to ? dateToTimestamp(value.to) + 86400000 - 1 : null; // end of day
      result = result.filter((row) => {
        const rowTs = new Date(row[filter.name]).getTime();
        if (Number.isNaN(rowTs)) return false;
        if (fromTs && rowTs < fromTs) return false;
        if (toTs && rowTs > toTs) return false;
        return true;
      });
    } else {
      // Default: exact match
      result = result.filter((row) => row[filter.name] === value);
    }
  }

  return result;
};

/**
 * Search rows by term across the given fields. The CALLER owns the guard for
 * *when* to search (DataTable and Kanban differ on trimming / enable flags);
 * this function only does the matching when given a non-empty term and fields.
 * Falsy field values are treated as non-matches, matching both prior callers.
 *
 * @param {Array<object>} rows
 * @param {string} term
 * @param {Array<string>} fields
 * @param {{ fuzzy?: boolean, fuzzyOptions?: object }} [opts]
 */
export const searchRows = (rows, term, fields, opts = {}) => {
  const { fuzzy = false, fuzzyOptions } = opts;
  const t = String(term ?? "").toLowerCase();
  if (!t || !fields || fields.length === 0) return rows;

  if (fuzzy) {
    const fuse = new Fuse(rows, {
      keys: fields,
      threshold: 0.4,
      distance: 100,
      ignoreLocation: true,
      ...fuzzyOptions,
    });
    return fuse.search(t).map((r) => r.item);
  }

  return rows.filter((row) =>
    fields.some((field) => {
      const val = row[field];
      return val && String(val).toLowerCase().includes(t);
    })
  );
};
