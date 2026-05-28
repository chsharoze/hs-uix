import { useRef, useEffect, useCallback } from "react";
import { useDebounce } from "@hubspot/ui-extensions";

// ═══════════════════════════════════════════════════════════════════════════
// Shared interaction hooks for grid/board surfaces (DataTable, Kanban).
//
// Two fiddly, easy-to-get-wrong stateful patterns were reimplemented
// identically in both components. Centralizing them keeps the subtle timing
// behavior (debounce-settle, prime-on-controlled) in one place.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Debounced dispatch. Returns an `onChange(next)` handler:
 *   - debounce > 0: arms a pending value; the dispatch fires once the debounced
 *     `value` settles to that pending value.
 *   - debounce <= 0: dispatches immediately.
 *
 * The component still owns the live input state (used as the field value and
 * passed in as `value`); this hook only owns the pending-ref / settle dance.
 *
 * @param {any} value         the live (controlled-by-component) search value
 * @param {number} debounceMs
 * @param {(value: any) => void} dispatch
 * @returns {(next: any) => void}
 */
export const useDebouncedDispatch = (value, debounceMs, dispatch) => {
  const debounced = useDebounce(value, debounceMs > 0 ? debounceMs : 300);
  const pendingRef = useRef(null);

  useEffect(() => {
    if (debounceMs <= 0) return;
    if (pendingRef.current == null) return;
    if (debounced !== pendingRef.current) return;
    const next = pendingRef.current;
    pendingRef.current = null;
    dispatch(next);
  }, [debounceMs, debounced, dispatch]);

  return useCallback(
    (next) => {
      if (debounceMs > 0) {
        pendingRef.current = next;
      } else {
        pendingRef.current = null;
        dispatch(next);
      }
    },
    [debounceMs, dispatch]
  );
};

/**
 * Clear uncontrolled selection memory when the query fingerprint changes.
 *
 * Primes its internal ref (without clearing) while disabled or controlled, so
 * the first real change after becoming active doesn't spuriously clear.
 *
 * @param {object} args
 * @param {string} args.resetKey     stable fingerprint of search/filters/sort + reset key
 * @param {boolean} args.enabled     selection is enabled
 * @param {boolean} args.isControlled selection is externally controlled
 * @param {() => void} args.clearSelection
 */
export const useSelectionReset = ({ resetKey, enabled, isControlled, clearSelection }) => {
  const ref = useRef("");
  useEffect(() => {
    if (!enabled || isControlled) {
      ref.current = resetKey;
      return;
    }
    if (ref.current && ref.current !== resetKey) {
      clearSelection();
    }
    ref.current = resetKey;
  }, [resetKey, enabled, isControlled, clearSelection]);
};
