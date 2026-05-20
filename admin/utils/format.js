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

const extractHtmlTitle = (s) => {
  if (typeof s !== "string") return null;
  const m = s.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? m[1].trim() : null;
};

const httpStatusMessage = (status) => {
  switch (status) {
    case 413: return "Request body too large — uploaded archive exceeded the reverse-proxy or Strapi body-size limit. "
      + "Check `client_max_body_size` in the nginx/proxy config and `strapi::body` limits in config/middlewares.js.";
    case 502: return "Bad gateway — the admin upstream is not reachable. "
      + "One or more admin replicas may be restarting, crashed, or still booting.";
    case 503: return "Service unavailable — admin upstream is temporarily not accepting requests.";
    case 504: return "Gateway timeout — admin took too long to respond. "
      + "For large archives, raise `proxy_read_timeout` / `proxy_send_timeout` in the nginx config.";
    case 401: return "Unauthorized — admin session may have expired. Reload the admin and sign in again.";
    case 403: return "Forbidden — your account does not have permission for this action.";
    case 404: return "Not found — the plugin endpoint is missing. The plugin may not be loaded.";
    case 500: return "Internal server error — check the admin container logs for the stack trace.";
    default: return null;
  }
};

export const readServerError = (e) => {
  const status = e?.response?.status ?? e?.status;
  const html = looksLikeHtml(e?.response?.data) ? e.response.data : null;

  if (html || isHtmlJsonError(e)) {
    const fromStatus = httpStatusMessage(status);
    if (fromStatus) return `${fromStatus} (HTTP ${status})`;
    const title = extractHtmlTitle(html);
    return `Server returned an HTML error page instead of JSON${status ? ` (HTTP ${status})` : ""}${title ? ` — ${title}` : ""}. Check admin container logs.`;
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
