// ═══════════════════════════════════════════════════════════════════════════
// Form dependency / cascade resolution.
//
// When a parent field changes, dependent fields' option lists are recomputed
// and any now-invalid dependent values are filtered (multiselect) or cleared
// (scalar). This previously lived as a BFS queue walk inside
// handleFieldChange — a pure algorithm trapped in a useCallback, exercisable
// only by mounting the form and clicking. Extracted here so cascade scenarios
// (multi-level chains, cycles, value-no-longer-valid) are table-testable.
//
// resolveDependentCascade is pure: empty-value generation is injected via
// `getEmptyValueForField` so plugin field types stay supported without
// coupling this module to the component's fieldTypes registry.
// ═══════════════════════════════════════════════════════════════════════════

import { resolveOptions } from "./formValidation.js";

export const getDependsOnName = (field) =>
  field.dependsOnConfig && field.dependsOnConfig.field;

export const getDependsOnDisplay = (field) =>
  (field.dependsOnConfig && field.dependsOnConfig.display) || "grouped";

export const getDependsOnLabel = (field) =>
  field.dependsOnConfig && field.dependsOnConfig.label;

export const getDependsOnMessage = (field) =>
  field.dependsOnConfig && field.dependsOnConfig.message;

/**
 * Compute the next form values after a field change, cascading through
 * dependent fields. Returns the new values object and the list of dependent
 * field names whose values changed (so the caller can clear their errors).
 *
 * @param {object} args
 * @param {string} args.name                 changed field name
 * @param {any} args.value                    new value
 * @param {Array<object>} args.fields         all field configs
 * @param {Record<string, any>} args.values   current form values
 * @param {(field: object) => any} args.getEmptyValueForField
 * @returns {{ newValues: Record<string, any>, changedDependents: string[] }}
 */
export const resolveDependentCascade = ({ name, value, fields, values, getEmptyValueForField }) => {
  const newValues = { ...values, [name]: value };
  const queue = [name];
  const visited = new Set();
  const changedDependents = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    fields.forEach((dep) => {
      const parentName = getDependsOnName(dep);
      if (parentName !== current || dep.name === current) return;
      if (!dep.options) return;

      const depOptions = resolveOptions(dep, newValues);
      const depValue = newValues[dep.name];
      if (depValue == null || depValue === "") return;
      const validValues = new Set(depOptions.map((o) => o.value));

      let nextDepValue = depValue;
      let changed = false;
      if (Array.isArray(depValue)) {
        const filtered = depValue.filter((v) => validValues.has(v));
        if (filtered.length !== depValue.length) {
          nextDepValue = filtered;
          changed = true;
        }
      } else if (!validValues.has(depValue)) {
        nextDepValue = getEmptyValueForField(dep);
        changed = true;
      }

      if (changed) {
        newValues[dep.name] = nextDepValue;
        queue.push(dep.name);
        changedDependents.push(dep.name);
      }
    });
  }

  return { newValues, changedDependents };
};
