import { getFetchClient } from "@strapi/strapi/admin";

import { basePath, toQuery } from "./client";

export const fetchContentTypes = async () => {
  const { get } = getFetchClient();
  const { data } = await get(`${basePath}/content-types`);
  return data?.data ?? [];
};

export const fetchContentType = async (uid) => {
  const { get } = getFetchClient();
  const { data } = await get(`${basePath}/content-types/${encodeURIComponent(uid)}`);
  return data?.data ?? null;
};

export const fetchLocales = async () => {
  const { get } = getFetchClient();
  const { data } = await get(`${basePath}/locales`);
  return data?.data ?? [];
};

export const previewData = async (params) => {
  const { get } = getFetchClient();
  const { data } = await get(`${basePath}/preview?${toQuery(params)}`);
  return data?.data;
};
