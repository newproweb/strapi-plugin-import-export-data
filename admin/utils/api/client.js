import pluginId from "../../pluginId";

export const basePath = `/${pluginId}`;

export const toQuery = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (typeof value === "object") return query.set(key, JSON.stringify(value));
    query.set(key, String(value));
  });
  return query.toString();
};

export const readAuthToken = () => {
  try {
    const raw = localStorage.getItem("jwtToken");
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  const match = document.cookie.match(/(?:^|;\s*)jwtToken=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
};

export const getBackendUrl = () =>
  (typeof window !== "undefined" && window.strapi?.backendURL) || "";
