import { Upload } from "tus-js-client";

import { basePath, getBackendUrl, readAuthToken } from "./client";

const DEFAULT_CHUNK_SIZE = 8 * 1024 * 1024;
const DEFAULT_RETRY_DELAYS = [0, 1000, 3000, 5000, 10000];

const buildAuthHeader = () => {
  const token = readAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const buildMetadata = (file, key) => {
  const meta = {
    filename: file.name,
    filetype: file.type || "application/octet-stream",
  };
  if (key) meta.encryptionKey = key;
  return meta;
};

const finalizeUpload = async ({ uploadUrl, authHeader, fileName }) => {
  const id = uploadUrl.split("/").filter(Boolean).pop();
  const response = await fetch(`${uploadUrl}/finalize`, {
    method: "POST",
    headers: { ...authHeader, "Content-Type": "application/json" },
    body: JSON.stringify({ fileName }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let message = `Tus finalize failed (HTTP ${response.status})`;
    try { message = JSON.parse(text)?.error?.message || message; } catch { /* not JSON */ }
    throw new Error(message);
  }

  const body = await response.json();
  return body?.data ?? { id };
};

export const uploadBackupTus = (file, {
  key = "",
  onProgress,
  chunkSize = DEFAULT_CHUNK_SIZE,
  retryDelays = DEFAULT_RETRY_DELAYS,
} = {}) => new Promise((resolve, reject) => {
  const endpoint = `${getBackendUrl()}${basePath}/backup/upload/tus`;
  const authHeader = buildAuthHeader();

  const upload = new Upload(file, {
    endpoint,
    headers: authHeader,
    chunkSize,
    retryDelays,
    metadata: buildMetadata(file, key),
    onError: reject,
    onProgress: (loaded, total) => onProgress?.(loaded, total),
    onSuccess: () => {
      finalizeUpload({ uploadUrl: upload.url, authHeader, fileName: file.name })
        .then(resolve)
        .catch(reject);
    },
  });

  upload.start();
});
