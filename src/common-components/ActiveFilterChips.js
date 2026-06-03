import React from "react";
import { Button, Flex, Tag } from "@hubspot/ui-extensions";

const h = React.createElement;

/** Shared active-filter chips row with optional one-click reset. */
export const ActiveFilterChips = ({
  chips = [],
  showBadges = true,
  showClearAll = true,
  clearAllLabel = "Clear all",
  onRemove,
  gap = "sm",
}) => {
  if (!Array.isArray(chips) || chips.length === 0) return null;
  if (!showBadges && !showClearAll) return null;

  return h(
    Flex,
    { direction: "row", align: "center", gap, wrap: "wrap" },
    ...(showBadges
      ? chips.map((chip) => h(
        Tag,
        {
          key: chip.key,
          variant: "default",
          onDelete: () => onRemove?.(chip.key),
        },
        chip.label
      ))
      : []),
    showClearAll
      ? h(
        Button,
        {
          variant: "transparent",
          size: "extra-small",
          onClick: () => onRemove?.("all"),
        },
        clearAllLabel
      )
      : null
  );
};
