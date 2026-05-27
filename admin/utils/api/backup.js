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
  for (; ;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (onProgress) onProgress(received, total);
  }

  return { data: new Blob(chunks) };
};

export const uploadBackup = async (file, { key = "", onProgress } = {}) => {
  const form = new FormData();
  form.append("file", file);
  if (key) form.append("key", key);

  if (!onProgress) {
    const { post } = getFetchClient();
    const { data } = await post(`${basePath}/backup/upload`, form);
    return data?.data;
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${getBackendUrl()}${basePath}/backup/upload`);
    const token = readAuthToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded, e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText)?.data);
        } catch {
          reject(new Error("Invalid server response"));
        }
      } else {
        let msg = `Upload failed (HTTP ${xhr.status})`;
        try { msg = JSON.parse(xhr.responseText)?.error?.message || msg; } catch { /* ignore */ }
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed: network error"));
    xhr.onabort = () => reject(new Error("Upload aborted"));
    xhr.send(form);
  });
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
