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

export const downloadBackup = async (file, onProgress) => {
  // Strapi v5's `getFetchClient` always runs the response through `.json()` and
  // returns `{ data: [] }` on parse error — that turns every binary download
  // into a 0 KB file. Bypass it and use native fetch so we can stream the body
  // and report progress instead of blocking silently until the whole archive
  // has buffered into memory.
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

  const total = Number(response.headers.get("content-length")) || 0;
  const reader = response.body?.getReader?.();
  if (!reader) return { data: await response.blob() };

  const chunks = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (onProgress) onProgress(received, total);
  }

  return { data: new Blob(chunks) };
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

// Creates a time-limited download link for a backup and emails it to the
// given addresses and/or the recipients saved in plugin settings.
export const transferBackup = async (file, body = {}) => {
  const { post } = getFetchClient();
  const { data } = await post(`${basePath}/backup/${encoded(file)}/transfer`, body);
  return data?.data;
};

export const fullSeedPlan = async (file) => {
  const { get } = getFetchClient();
  const { data } = await get(`${basePath}/full-seed/${encoded(file)}/plan`);
  return data?.data;
};

export const fullSeedSync = async (file) => {
  const { post } = getFetchClient();
  const { data } = await post(`${basePath}/full-seed/${encoded(file)}/sync`, {});
  return data?.data;
};

export const getFullSeedPending = async () => {
  const { get } = getFetchClient();
  const { data } = await get(`${basePath}/full-seed/pending`);
  return data?.data ?? null;
};

export const clearFullSeedPending = async () => {
  const { del } = getFetchClient();
  await del(`${basePath}/full-seed/pending`);
};
