import React from "react";
import { Text } from "@hubspot/ui-extensions";

const h = React.createElement;

const resolveLabel = (label, count) => {
  if (typeof label === "function") return label(count);
  if (label && typeof label === "object") return count === 1 ? label.singular : label.plural;
  return label || "items";
};

export const formatCollectionCount = ({ shown, total, label = "items", formatter }) => {
  const resolvedShown = Number(shown ?? total ?? 0);
  const resolvedTotal = Number(total ?? resolvedShown);
  if (typeof formatter === "function") return formatter(resolvedShown, resolvedTotal);
  const resolvedLabel = resolveLabel(label, resolvedTotal);
  return resolvedShown === resolvedTotal
    ? `${resolvedTotal} ${resolvedLabel}`
    : `${resolvedShown} of ${resolvedTotal} ${resolvedLabel}`;
};

/** Shared microcopy count text for collection toolbars. */
export const CollectionCount = ({
  shown,
  total,
  label,
  text,
  formatter,
  bold = false,
  variant = "microcopy",
  format,
}) => h(
  Text,
  {
    variant,
    format: format || (bold ? { fontWeight: "bold" } : undefined),
  },
  text ?? formatCollectionCount({ shown, total, label, formatter })
);
