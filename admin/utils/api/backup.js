import { getFetchClient } from "@strapi/strapi/admin";

import { basePath, getBackendUrl, readAuthToken } from "./client";

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
  // Strapi v5's `getFetchClient` always runs the response through `.json()` and
  // returns `{ data: [] }` on parse error — that turns every binary download
  // into a 0 KB file. Bypass it and use native fetch so we can read the body
  // as a Blob directly.
  const url = `${getBackendUrl()}${basePath}/backup/${encoded(file)}/download`;
  const token = readAuthToken();
  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      Accept: "application/octet-stream, */*",
    },
  });

  if (!response.ok) {
    let message = `Download failed (HTTP ${response.status})`;
    try {
      const body = await response.json();
      message = body?.error?.message || message;
    } catch { /* not JSON */ }
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }

  const blob = await response.blob();
  const headerName = response.headers.get("content-disposition") || "";
  return { data: blob, headers: { "content-disposition": headerName } };
};

export const uploadBackup = async (file, { key = "" } = {}) => {
  const { post } = getFetchClient();
  const form = new FormData();
  form.append("file", file);
  if (key) form.append("key", key);
  const { data } = await post(`${basePath}/backup/upload`, form);
  return data?.data;
};

export const getBackupLimits = async () => {
  const { get } = getFetchClient();
  const { data } = await get(`${basePath}/backup/limits`);
  return data?.data ?? { maxFileSize: 0, busy: false };
};
