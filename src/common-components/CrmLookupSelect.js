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
  // Remember options the user has picked so a selected value stays valid even
  // after the live search results (and the input) change underneath it.
  const [pickedOptions, setPickedOptions] = useState(EMPTY_ARRAY);
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

  // "Searching" covers both the in-flight request AND the debounce window where
  // the live input hasn't been applied to the search query yet — otherwise the
  // select briefly shows "no results" between a keystroke and the debounced fetch.
  const isSearching = dataSource.loading || inputValue.trim() !== (search || "").trim();
  const hasQuery = effectiveSearch.length > 0;

  const options = useMemo(() => {
    const remembered = [...(selectedOptions || EMPTY_ARRAY), ...pickedOptions];
    const baseOptions = mergeSelectedOptions(dataSource.options || EMPTY_ARRAY, remembered, value);
    if (isSearching && loadingOption) return [loadingOption, ...baseOptions];
    if (!isSearching && hasQuery && !baseOptions.length && noResultsOption) return [noResultsOption];
    return baseOptions;
  }, [dataSource.options, isSearching, hasQuery, selectedOptions, pickedOptions, value, loadingOption, noResultsOption]);

  // Capture the chosen option(s) into the picked-options cache before bubbling.
  const handleChange = (next) => {
    const nextValues = Array.isArray(next) ? next : next == null || next === "" ? EMPTY_ARRAY : [next];
    const picked = nextValues
      .map((v) => options.find((o) => o.value === v))
      .filter((o) => o && o.value !== loadingOption?.value && o.value !== noResultsOption?.value);
    if (picked.length) {
      setPickedOptions((prev) => {
        const byValue = new Map(prev.map((o) => [o.value, o]));
        picked.forEach((o) => byValue.set(o.value, o));
        return [...byValue.values()];
      });
    }
    if (onChange) onChange(next);
  };

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
    onChange: handleChange,
    onInput: (next) => {
      setInputValue(next || "");
      if (onSearchChange) onSearchChange(next || "");
    },
    ...selectProps,
  };

  return React.createElement(multiple ? MultiSelect : Select, commonProps);
};
