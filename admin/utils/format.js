export const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const k = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** k;
  // 2 decimals for KB+ so the displayed number matches what Windows File
  // Explorer shows in the Details column (which rounds to whole KB).
  const decimals = k === 0 ? 0 : 2;
  return `${value.toFixed(decimals)} ${units[k]}`;
};

export const formatBytesExact = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 bytes";
  return `${bytes.toLocaleString("en-US")} bytes`;
};

export const formatDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
};

export const formatElapsed = (ms) => {
  if (!Number.isFinite(ms) || ms < 0) return "0s";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
};

const looksLikeHtml = (s) => typeof s === "string" && /^\s*</.test(s);

const isHtmlJsonError = (e) =>
  /Unexpected token '<'|is not valid JSON/i.test(e?.message || "")
  || looksLikeHtml(e?.response?.data);

export const readServerError = (e) => {
  if (isHtmlJsonError(e)) {
    return "Server returned an HTML error page instead of JSON — the archive likely exceeded the body-size limit. "
      + "Raise `strapi::body` limits in config/middlewares.js (jsonLimit/formLimit/textLimit/formidable.maxFileSize) and restart Strapi.";
  }
  return (
    e?.response?.data?.error?.message
    || e?.response?.data?.error
    || e?.message
    || "Unknown error"
  );
};

export const originOf = (file) => {
  if (file.startsWith("uploaded-")) return "Uploaded";
  if (file.startsWith("export-")) return "Manual export";
  if (file.startsWith("backup-")) return "Auto (cron)";
  return "Other";
};

export const cellToString = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};
