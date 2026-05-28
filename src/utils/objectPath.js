// ═══════════════════════════════════════════════════════════════════════════
// objectPath — read a value off an object by dotted path or accessor function.
//
// This exact helper was defined independently in BOTH crmSearchAdapters.js and
// common-components/CrmLookupSelect.js. Two copies of "how we read a property
// off a CRM record" drift apart silently; this concentrates it in one place.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @param {object} obj
 * @param {string | ((obj: object) => any)} path  dotted path ("a.b.c") or fn
 * @returns {any} the value at the path, or undefined
 */
export const getByPath = (obj, path) => {
  if (!path) return undefined;
  if (typeof path === "function") return path(obj);
  return String(path)
    .split(".")
    .reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
};
