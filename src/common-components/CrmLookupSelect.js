import React, { useMemo, useState } from "react";
import { MultiSelect, Select, useDebounce } from "@hubspot/ui-extensions";
import { resolveCrmObjectType, useCrmSearchOptions } from "../utils/crmSearchAdapters.js";
import { getByPath } from "../utils/objectPath.js";

const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};

const makeOptionConfig = ({ option, labelProperty, valueProperty, descriptionProperty }) => ({
  label: labelProperty || option?.label || "name",
  value: valueProperty || option?.value || "objectId",
  description: descriptionProperty || option?.description,
  fallbackLabel: option?.fallbackLabel,
  mapOption: option?.mapOption,
});

const mergeSelectedOptions = (options, selectedOptions, value) => {
  const selected = Array.isArray(selectedOptions)
    ? selectedOptions
    : selectedOptions
      ? [selectedOptions]
      : EMPTY_ARRAY;
  if (!selected.length) return options;

  const values = new Set(options.map((opt) => opt.value));
  const activeValues = new Set(Array.isArray(value) ? value : value == null || value === "" ? [] : [value]);
  const missing = selected.filter((opt) => activeValues.has(opt.value) && !values.has(opt.value));
  return missing.length ? [...missing, ...options] : options;
};

/**
 * CRM-backed lookup select. Typing in the select's search input updates the CRM
 * search query after a debounce; returned records become the select options.
 */
export const CrmLookupSelect = ({
  objectType,
  properties = EMPTY_ARRAY,
  name,
  label,
  value,
  onChange,
  multiple = false,
  placeholder,
  description,
  tooltip,
  required,
  readOnly,
  error,
  validationMessage,
  variant,
  debounce = 300,
  minSearchLength = 0,
  pageLength = 20,
  option,
  labelProperty,
  valueProperty = "objectId",
  descriptionProperty,
  selectedOptions,
  format,
  row,
  baseConfig,
  query,
  onSearchChange,
  noResultsOption,
  loadingOption,
  selectProps = EMPTY_OBJECT,
}) => {
  const [inputValue, setInputValue] = useState(query || "");
  const debouncedInput = useDebounce(inputValue, debounce > 0 ? debounce : 1);
  const search = debounce > 0 ? debouncedInput : inputValue;
  const effectiveSearch = search && search.length >= minSearchLength ? search : "";

  const optionConfig = useMemo(
    () => makeOptionConfig({ option, labelProperty, valueProperty, descriptionProperty }),
    [option, labelProperty, valueProperty, descriptionProperty]
  );

  const dataSource = useCrmSearchOptions(
    { search: effectiveSearch },
    {
      objectType: resolveCrmObjectType(objectType),
      properties,
      pageLength,
      format,
      baseConfig,
      row: row || { mapRecord: (record) => ({ objectId: record.objectId, ...record.properties }) },
      option: optionConfig,
    }
  );

  const options = useMemo(() => {
    const baseOptions = mergeSelectedOptions(dataSource.options || EMPTY_ARRAY, selectedOptions, value);
    if (dataSource.loading && loadingOption) return [loadingOption, ...baseOptions];
    if (!dataSource.loading && !baseOptions.length && noResultsOption) return [noResultsOption];
    return baseOptions;
  }, [dataSource.options, dataSource.loading, selectedOptions, value, loadingOption, noResultsOption]);

  const commonProps = {
    name,
    label,
    value: multiple ? value || EMPTY_ARRAY : value,
    options,
    placeholder: placeholder || (dataSource.loading ? "Searching CRM..." : "Search CRM records..."),
    description,
    tooltip,
    required,
    readOnly,
    error: error || !!dataSource.error,
    validationMessage: validationMessage || (typeof dataSource.error === "string" ? dataSource.error : undefined),
    variant,
    onChange,
    onInput: (next) => {
      setInputValue(next || "");
      if (onSearchChange) onSearchChange(next || "");
    },
    ...selectProps,
  };

  return React.createElement(multiple ? MultiSelect : Select, commonProps);
};
