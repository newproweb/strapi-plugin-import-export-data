import { basePath, getBackendUrl, readAuthToken, toQuery } from "./client";

const parseFilename = (disposition) => {
  if (!disposition) return null;
  const match = /filename\*?=(?:UTF-8''|")?([^";]+)"?/i.exec(disposition);
  return match ? decodeURIComponent(match[1]) : null;
};

const readErrorDetail = async (response) => {
  try {
    return JSON.stringify(await response.json());
  } catch {
    return response.text().catch(() => "");
  }
};

export const exportData = async (params) => {
  const url = `${getBackendUrl()}${basePath}/export?${toQuery(params)}`;
  const token = readAuthToken();
  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "*/*",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    const detail = await readErrorDetail(response);
    const err = new Error(`Export failed (${response.status}): ${detail}`);
    err.status = response.status;
    throw err;
  }

  const blob = await response.blob();
  const filename = parseFilename(response.headers.get("content-disposition"));
  return { blob, filename };
};
