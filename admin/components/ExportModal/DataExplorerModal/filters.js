import { STRING_TYPES } from "../../../constants/export";

export const buildSearchFilter = (collection, search) => {
  if (!search || !collection) return null;
  const keys = Object.entries(collection.attributes || {})
    .filter(([, a]) => STRING_TYPES.includes(a?.type))
    .map(([k]) => k);
  if (!keys.length) return null;
  return { $or: keys.map((k) => ({ [k]: { $containsi: search } })) };
};

export const buildDateFilter = (field, from, to) => {
  if (!field || (!from && !to)) return null;
  const range = {};
  if (from) range.$gte = new Date(from).toISOString();
  if (to) range.$lte = new Date(to).toISOString();
  return { [field]: range };
};

export const buildFilters = ({ collection, search, dateField, dateFrom, dateTo }) => {
  const filters = {};
  const searchFilter = buildSearchFilter(collection, search);
  if (searchFilter) Object.assign(filters, searchFilter);
  const dateFilter = buildDateFilter(dateField, dateFrom, dateTo);
  if (dateFilter) Object.assign(filters, dateFilter);
  return filters;
};

export const buildSort = (field, order) => (field ? `${field}:${order}` : undefined);
