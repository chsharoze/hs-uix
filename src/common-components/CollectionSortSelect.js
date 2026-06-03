import React, { useId } from "react";
import { Select } from "@hubspot/ui-extensions";

const h = React.createElement;

const sanitizeId = (value) => String(value || "").replace(/[^a-zA-Z0-9_-]/g, "");

/** Shared transparent sort Select for collection toolbars. */
export const CollectionSortSelect = ({
  name = "collection-sort",
  value,
  options = [],
  placeholder = "Sort",
  onChange,
  includeEmpty = true,
  emptyValue = "",
  variant = "transparent",
  idPrefix,
  uniqueName = true,
}) => {
  const reactId = useId();
  const instanceId = sanitizeId(idPrefix || reactId);
  const resolvedName = uniqueName && name ? `${name}-${instanceId}` : name;
  const mappedOptions = (options || []).map((option) => ({
    label: option.label,
    value: option.value,
  }));

  return h(Select, {
    name: resolvedName,
    value: value ?? emptyValue,
    variant,
    placeholder,
    options: includeEmpty
      ? [{ label: placeholder, value: emptyValue }, ...mappedOptions]
      : mappedOptions,
    onChange,
  });
};
