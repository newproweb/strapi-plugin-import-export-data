export const PLAIN_TYPES = new Set([
  "string", "text", "uid", "email", "integer", "biginteger",
  "float", "decimal", "boolean", "date", "datetime", "time", "enumeration",
]);

export const STRING_TYPES = ["string", "text", "uid", "email"];

export const BACKUP_FORMATS = [
  { id: "tar.gz", label: "tar.gz", hint: "Compressed — recommended", tone: "primary", encrypt: false, compress: true, requiresKey: false },
  { id: "tar", label: "tar", hint: "Uncompressed, inspectable", tone: "neutral", encrypt: false, compress: false, requiresKey: false },
  { id: "tar.gz.enc", label: "tar.gz.enc", hint: "Encrypted + compressed", tone: "warning", encrypt: true, compress: true, requiresKey: true },
  { id: "tar.enc", label: "tar.enc", hint: "Encrypted only", tone: "warning", encrypt: true, compress: false, requiresKey: true },
];

export const BACKUP_TAGS = ["database", "backup", "strapi-cli", "tar", "gzip"];

export const TONE_COLORS = {
  primary: { bg: "primary100", text: "primary700", border: "primary200" },
  warning: { bg: "warning100", text: "warning700", border: "warning200" },
  neutral: { bg: "neutral150", text: "neutral800", border: "neutral200" },
};

export const CRON_PRESETS = [
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every day at 02:00", value: "0 2 * * *" },
  { label: "Every Sunday at 03:00", value: "0 3 * * 0" },
  { label: "Every 15 minutes", value: "*/15 * * * *" },
];

export const PAGE_SIZE_OPTIONS = ["10", "25", "50", "100"];
