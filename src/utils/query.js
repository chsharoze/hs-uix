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
// NOTE: Feed.jsx deliberately does NOT use this module. Feed filters with a
// path-based `getValue()` accessor and string-coercing equality; merging it in
// would change Feed's behavior. Its pipeline stays in Feed.jsx on purpose.
// ═══════════════════════════════════════════════════════════════════════════

/** The "no selection" value for a filter, by control type. */
export const getEmptyFilterValue = (filter) => {
  const type = filter.type || "select";
  if (type === "multiselect") return [];
  if (type === "dateRange") return { from: null, to: null };
  return "";
};

/** Whether a filter currently constrains the data (i.e. has a real value). */
export const isFilterActive = (filter, value) => {
  const type = filter.type || "select";
  if (type === "multiselect") return Array.isArray(value) && value.length > 0;
  if (type === "dateRange") return value && (value.from || value.to);
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
export const filterRows = (rows, filters, values) => {
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
