import { getFetchClient } from "@strapi/strapi/admin";

import { basePath } from "./client";

const encoded = (file) => encodeURIComponent(file);

export const listBackups = async () => {
  const { get } = getFetchClient();
  const { data } = await get(`${basePath}/backup`);
  return data?.data ?? [];
};

export const createBackup = async (options = {}) => {
  const { post } = getFetchClient();
  const { data } = await post(`${basePath}/backup`, options);
  return data?.data;
};

export const deleteBackup = async (file) => {
  const { del } = getFetchClient();
  const { data } = await del(`${basePath}/backup/${encoded(file)}`);
  return data?.data;
};

export const restoreBackup = async (file, options = {}) => {
  const { post } = getFetchClient();
  const { data } = await post(`${basePath}/backup/${encoded(file)}/restore`, options);
  return data?.data;
};

export const downloadBackup = async (file) => {
  const { get } = getFetchClient();
  return get(`${basePath}/backup/${encoded(file)}/download`, { responseType: "blob" });
};

export const uploadBackup = async (file, { key = "" } = {}) => {
  const { post } = getFetchClient();
  const form = new FormData();
  form.append("file", file);
  if (key) form.append("key", key);
  const { data } = await post(`${basePath}/backup/upload`, form);
  return data?.data;
};
