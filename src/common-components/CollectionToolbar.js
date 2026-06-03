import React, { useId, useState } from "react";
import {
  Box,
  Button,
  Flex,
  SearchInput,
} from "@hubspot/ui-extensions";
import { ActiveFilterChips } from "./ActiveFilterChips.js";
import { CollectionFilterControl } from "./CollectionFilterControl.js";
import { Icon } from "./Icon.js";

const h = React.createElement;

const DEFAULT_LABELS = {
  filtersButton: "Filters",
  clearAll: "Clear all",
};

const isVisible = (config) => config && (config.visible ?? config.show ?? true);

/**
 * Shared toolbar shell for collection views: search, inline/overflow filters,
 * active chips, and a view-specific right-side slot.
 */
export const CollectionToolbar = ({
  search,
  filters,
  chips,
  right,
  footer,
  labels: labelOverrides,
  leftFlex = 3,
  rightFlex = 1,
  rightAlignSelf = "end",
  gap = "sm",
  idPrefix,
  uniqueNames = true,
}) => {
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const reactId = useId();
  const instanceId = String(idPrefix || reactId).replace(/[^a-zA-Z0-9_-]/g, "");
  const nameWithInstance = (name) => (
    uniqueNames && name ? `${name}-${instanceId}` : name
  );
  const labels = { ...DEFAULT_LABELS, ...(labelOverrides || {}) };

  const filterItems = Array.isArray(filters?.items) ? filters.items : [];
  const filterValues = filters?.values || {};
  const filterInlineLimit = filters?.inlineLimit ?? filterItems.length;
  const inlineFilters = filterItems.slice(0, filterInlineLimit);
  const overflowFilters = filterItems.slice(filterInlineLimit);

  const showSearch = isVisible(search);
  const hasSearch = showSearch && !!search;
  const hasFilters = inlineFilters.length > 0 || overflowFilters.length > 0;
  const hasChips = chips && Array.isArray(chips.items) && chips.items.length > 0;
  const hasLeft = hasSearch || hasFilters || hasChips;
  const hasRight = !!right;

  if (!hasLeft && !hasRight && !footer) return null;

  const filterLabels = { ...labels, ...(filters?.labels || {}) };

  // The native SearchInput's clear "x" emits onChange (not onInput). Wire onInput
  // for live typing when provided, but ALWAYS wire onChange — falling back to the
  // onInput handler — so the clear button resets the term even for callers that
  // only provide onInput (e.g. Calendar). Clearable defaults on.
  const searchHandler = search?.onChange || search?.onInput;
  const searchProps = hasSearch
    ? {
      name: nameWithInstance(search.name || "collection-search"),
      placeholder: search.placeholder,
      value: search.value,
      clearable: search.clearable !== false,
      ...(search.onInput ? { onInput: search.onInput } : {}),
      ...(searchHandler ? { onChange: searchHandler } : {}),
    }
    : null;

  const renderFilter = (filter) => h(CollectionFilterControl, {
    key: filter.name,
    namePrefix: nameWithInstance(filters?.namePrefix || "collection-filter"),
    filter,
    value: filterValues[filter.name],
    onChange: filters?.onChange,
    labels: filterLabels,
    includeAll: filters?.includeAll,
    allValue: filters?.allValue,
    selectVariant: filters?.selectVariant,
  });

  const left = hasLeft
    ? h(
      Box,
      { flex: leftFlex },
      h(
        Flex,
        { direction: "column", gap },
        (hasSearch || hasFilters)
          ? h(
            Flex,
            { direction: "row", align: "center", gap, wrap: "wrap" },
            hasSearch ? h(SearchInput, searchProps) : null,
            ...inlineFilters.map(renderFilter),
            overflowFilters.length > 0
              ? h(
                Button,
                {
                  variant: "transparent",
                  size: filters?.overflowButtonSize || "small",
                  onClick: () => setShowMoreFilters((prev) => !prev),
                },
                h(Icon, { name: "filter", size: "sm" }),
                " ",
                filters?.filtersButtonLabel || labels.filtersButton
              )
              : null
          )
          : null,
        showMoreFilters && overflowFilters.length > 0
          ? h(
            Flex,
            { direction: "row", align: "center", gap, wrap: "wrap" },
            ...overflowFilters.map(renderFilter)
          )
          : null,
        chips
          ? h(ActiveFilterChips, {
            chips: chips.items,
            showBadges: chips.showBadges,
            showClearAll: chips.showClearAll,
            clearAllLabel: chips.clearAllLabel || labels.clearAll,
            onRemove: chips.onRemove,
            gap: chips.gap || gap,
          })
          : null
      )
    )
    : null;

  const rightNode = hasRight
    ? h(
      Box,
      { flex: rightFlex, alignSelf: rightAlignSelf },
      h(Flex, { direction: "row", align: "center", gap, justify: "end", wrap: "wrap" }, right)
    )
    : null;

  return h(
    Flex,
    { direction: "column", gap: "xs" },
    h(Flex, { direction: "row", gap }, left, rightNode),
    footer || null
  );
};
