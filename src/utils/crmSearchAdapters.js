import React, { useMemo, useRef, useState } from "react";
import { useCrmSearch } from "@hubspot/ui-extensions";
import { DataTable } from "../../packages/datatable/src/DataTable.jsx";
import { getByPath } from "./objectPath.js";

const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};

const isPlainObject = (value) =>
  value != null && Object.prototype.toString.call(value) === "[object Object]";

const coerceError = (error) => {
  if (!error) return false;
  if (typeof error === "string") return error;
  if (error.message) return error.message;
  return true;
};

const pickArray = (response) => {
  if (Array.isArray(response)) return response;
  if (!response) return EMPTY_ARRAY;
  return (
    response.results ||
    response.data ||
    response.items ||
    response.records ||
    response.objects ||
    EMPTY_ARRAY
  );
};

const pickTotal = (response, fallbackLength) => {
  if (!response || Array.isArray(response)) return fallbackLength;
  return (
    response.total ??
    response.totalCount ??
    response.totalResults ??
    response.paging?.total ??
    fallbackLength
  );
};

export const normalizeCrmSearchRecord = (record, options = EMPTY_OBJECT) => {
  const {
    idField = "id",
    objectIdField = "objectId",
    propertiesKey = "properties",
    flattenProperties = true,
    propertyValueKey,
    mapRecord,
  } = options;

  if (mapRecord) return mapRecord(record);

  const objectId =
    record?.objectId ??
    record?.id ??
    record?.hs_object_id ??
    getByPath(record, `${propertiesKey}.hs_object_id`);
  const properties = record?.[propertiesKey] || EMPTY_OBJECT;
  const flattened = {};

  if (flattenProperties && isPlainObject(properties)) {
    for (const [key, value] of Object.entries(properties)) {
      flattened[key] = propertyValueKey && isPlainObject(value) ? value[propertyValueKey] : value;
    }
  }

  return {
    ...(flattenProperties ? flattened : EMPTY_OBJECT),
    ...record,
    [idField]: objectId,
    [objectIdField]: objectId,
    [propertiesKey]: properties,
  };
};

export const normalizeCrmSearchRows = (response, options = EMPTY_OBJECT) => {
  const records = pickArray(response);
  return records.map((record) => normalizeCrmSearchRecord(record, options));
};

export const buildCrmSearchConfig = (params = EMPTY_OBJECT, options = EMPTY_OBJECT) => {
  const {
    objectType,
    properties = EMPTY_ARRAY,
    query,
    filterGroups,
    sorts,
    pageLength,
    propertyMap = EMPTY_OBJECT,
    filterMap,
    sortMap,
    baseConfig = EMPTY_OBJECT,
  } = options;

  const mappedFilters = filterMap
    ? filterMap(params.filters || EMPTY_OBJECT, params)
    : filterGroups;
  const mappedSorts = sortMap
    ? sortMap(params.sort || EMPTY_OBJECT, params)
    : sorts;

  const config = {
    ...baseConfig,
    objectType: objectType || baseConfig.objectType,
    properties: properties.length ? properties : baseConfig.properties,
    query: query ?? params.search ?? baseConfig.query,
    filterGroups: mappedFilters ?? baseConfig.filterGroups,
    sorts: mappedSorts ?? baseConfig.sorts,
    pageLength: pageLength ?? params.pageLength ?? baseConfig.pageLength,
  };

  if (propertyMap && Object.keys(propertyMap).length && params.filters) {
    // Lightweight default filter mapping for simple DataTable/Kanban select filters.
    // Anything complex should use filterMap for full HubSpot CRM search syntax.
    const filters = Object.entries(params.filters)
      .filter(([, value]) => value !== undefined && value !== null && value !== "" && !(Array.isArray(value) && value.length === 0))
      .map(([name, value]) => {
        const propertyName = propertyMap[name] || name;
        if (Array.isArray(value)) return { propertyName, operator: "IN", values: value };
        if (isPlainObject(value) && (value.from || value.to)) {
          const rangeFilters = [];
          if (value.from) rangeFilters.push({ propertyName, operator: "GTE", value: value.from });
          if (value.to) rangeFilters.push({ propertyName, operator: "LTE", value: value.to });
          return rangeFilters;
        }
        return { propertyName, operator: "EQ", value };
      })
      .flat();
    if (filters.length) config.filterGroups = [{ filters }];
  }

  Object.keys(config).forEach((key) => config[key] === undefined && delete config[key]);
  return config;
};

export const useCrmSearchDataSource = (params = EMPTY_OBJECT, options = EMPTY_OBJECT) => {
  const {
    format,
    row,
    rowIdField = "id",
    totalCount,
    loading,
    error,
    mapResponse,
  } = options;

  const config = useMemo(() => buildCrmSearchConfig(params, options), [params, options]);
  const response = useCrmSearch(config, format);

  return useMemo(() => {
    const rows = mapResponse
      ? mapResponse(response)
      : normalizeCrmSearchRows(response, { idField: rowIdField, ...(row || EMPTY_OBJECT) });
    const resolvedTotal =
      typeof totalCount === "function" ? totalCount(response) : totalCount ?? pickTotal(response, rows.length);

    return {
      data: rows,
      rows,
      response,
      loading: typeof loading === "function" ? loading(response) : loading ?? !!response?.isLoading,
      isLoading: typeof loading === "function" ? loading(response) : loading ?? !!response?.isLoading,
      error: typeof error === "function" ? error(response) : error ?? coerceError(response?.error),
      totalCount: resolvedTotal,
      rowIdField,
    };
  }, [response, mapResponse, row, rowIdField, totalCount, loading, error]);
};

export const crmSearchResultToOption = (row, options = EMPTY_OBJECT) => {
  const {
    label = "name",
    value = "objectId",
    description,
    fallbackLabel = "Untitled record",
    mapOption,
  } = options;
  if (mapOption) return mapOption(row);
  const option = {
    label: getByPath(row, label) ?? getByPath(row, "properties.name") ?? fallbackLabel,
    value: getByPath(row, value) ?? getByPath(row, "id") ?? getByPath(row, "objectId"),
  };
  const desc = getByPath(row, description);
  if (desc != null && desc !== "") option.description = desc;
  return option;
};

export const useCrmSearchOptions = (params = EMPTY_OBJECT, options = EMPTY_OBJECT) => {
  const dataSource = useCrmSearchDataSource(params, options);
  const optionConfig = options.option || options;

  return useMemo(() => ({
    ...dataSource,
    options: dataSource.rows.map((row) => crmSearchResultToOption(row, optionConfig)),
  }), [dataSource, optionConfig]);
};

export const makeCrmSearchSelectField = (field, searchOptions) => ({
  type: "select",
  ...field,
  options: searchOptions.options || EMPTY_ARRAY,
  loading: searchOptions.loading || searchOptions.isLoading || field?.loading,
});

export const makeCrmSearchMultiSelectField = (field, searchOptions) => ({
  type: "multiselect",
  ...field,
  options: searchOptions.options || EMPTY_ARRAY,
  loading: searchOptions.loading || searchOptions.isLoading || field?.loading,
});

const CRM_OBJECT_TYPES = {
  contact: "0-1",
  contacts: "0-1",
  company: "0-2",
  companies: "0-2",
  deal: "0-3",
  deals: "0-3",
};

const prettifyPropertyName = (name) =>
  String(name || "")
    .replace(/^hs_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const inferCrmColumns = (properties = EMPTY_ARRAY) =>
  properties.map((property) => ({
    field: property,
    label: prettifyPropertyName(property),
    sortable: true,
  }));

const normalizeAutoFilterFields = (autoFilters, properties = EMPTY_ARRAY) => {
  if (!autoFilters) return EMPTY_ARRAY;
  if (Array.isArray(autoFilters)) return autoFilters;
  if (typeof autoFilters === "object" && Array.isArray(autoFilters.fields)) return autoFilters.fields;
  return properties.filter((property) => !["id", "objectId", "hs_object_id", "email", "firstname", "lastname", "name", "domain"].includes(property));
};

const buildAutoFiltersFromRows = ({ rows, fields, labelsRef, maxOptions = 25 }) => {
  if (!fields.length) return EMPTY_ARRAY;
  for (const row of rows || EMPTY_ARRAY) {
    for (const field of fields) {
      const value = getByPath(row, field);
      if (value == null || value === "" || Array.isArray(value) || isPlainObject(value)) continue;
      if (!labelsRef.current[field]) labelsRef.current[field] = new Map();
      const map = labelsRef.current[field];
      if (map.size < maxOptions || map.has(value)) map.set(value, String(value));
    }
  }

  return fields
    .map((field) => {
      const map = labelsRef.current[field];
      if (!map || map.size === 0 || map.size > maxOptions) return null;
      return {
        name: field,
        label: prettifyPropertyName(field),
        placeholder: `Any ${prettifyPropertyName(field).toLowerCase()}`,
        options: Array.from(map.entries()).map(([value, label]) => ({ value, label })),
      };
    })
    .filter(Boolean);
};

export const resolveCrmObjectType = (objectType) =>
  CRM_OBJECT_TYPES[objectType] || objectType;

/**
 * Beautiful DataTable backed by HubSpot's useCrmSearch in a few lines.
 *
 * Example:
 * <CrmDataTable
 *   objectType="contacts"
 *   properties={["firstname", "lastname", "email"]}
 * />
 */
export const CrmDataTable = ({
  objectType,
  properties = EMPTY_ARRAY,
  columns,
  title,
  pageLength = 100,
  pageSize = 10,
  serverSide = false,
  filters,
  autoFilters = false,
  autoFilterMaxOptions = 25,
  filterMap,
  propertyMap,
  sortMap,
  searchFields,
  searchPlaceholder,
  format = { propertiesToFormat: "all" },
  mapRecord,
  rowIdField = "objectId",
  dataTableProps = EMPTY_OBJECT,
  ...props
}) => {
  const [params, setParams] = useState({ search: "", filters: {}, sort: {}, page: 1 });
  const resolvedProperties = useMemo(() => properties, [properties]);
  const resolvedColumns = useMemo(
    () => columns || inferCrmColumns(resolvedProperties),
    [columns, resolvedProperties]
  );
  const resolvedSearchFields = searchFields || resolvedProperties;
  const autoFilterFields = useMemo(
    () => normalizeAutoFilterFields(autoFilters, resolvedProperties),
    [autoFilters, resolvedProperties]
  );
  const autoFilterLabelsRef = useRef({});
  const defaultPropertyMap = useMemo(
    () => Object.fromEntries(resolvedProperties.map((property) => [property, property])),
    [resolvedProperties]
  );

  const dataSource = useCrmSearchDataSource(params, {
    objectType: resolveCrmObjectType(objectType),
    properties: resolvedProperties,
    pageLength,
    format,
    filterMap,
    propertyMap: propertyMap || defaultPropertyMap,
    sortMap,
    rowIdField,
    row: {
      idField: rowIdField,
      mapRecord: mapRecord || ((record) => ({ objectId: record.objectId, ...record.properties })),
    },
  });

  const pagination = dataSource.response?.pagination;
  const effectivePageSize = serverSide ? (pagination?.pageSize || pageLength) : pageSize;
  const generatedFilters = useMemo(
    () => buildAutoFiltersFromRows({
      rows: dataSource.data,
      fields: autoFilterFields,
      labelsRef: autoFilterLabelsRef,
      maxOptions: autoFilterMaxOptions,
    }),
    [dataSource.data, autoFilterFields, autoFilterMaxOptions]
  );
  const resolvedFilters = filters || generatedFilters;

  return React.createElement(DataTable, {
    title: title || `${prettifyPropertyName(objectType)} records`,
    serverSide,
    data: dataSource.data,
    loading: dataSource.loading || dataSource.response?.isRefetching,
    error: dataSource.error,
    totalCount: serverSide ? dataSource.totalCount : undefined,
    page: serverSide ? (pagination?.currentPage || params.page) : undefined,
    columns: resolvedColumns,
    rowIdField,
    pageSize: effectivePageSize,
    filters: resolvedFilters,
    filterValues: params.filters,
    sort: params.sort,
    searchFields: resolvedSearchFields,
    searchValue: params.search,
    searchPlaceholder: searchPlaceholder || `Search ${prettifyPropertyName(objectType).toLowerCase()}...`,
    searchDebounce: 300,
    onParamsChange: (next) => {
      setParams((prev) => ({ ...prev, ...next }));
      if (serverSide && next.page === 1) pagination?.reset?.();
    },
    onPageChange: serverSide ? ((page) => {
      setParams((prev) => ({ ...prev, page }));
      const currentPage = pagination?.currentPage || params.page || 1;
      if (page > currentPage) pagination?.nextPage?.();
      else if (page < currentPage) pagination?.previousPage?.();
    }) : undefined,
    ...dataTableProps,
    ...props,
  });
};
