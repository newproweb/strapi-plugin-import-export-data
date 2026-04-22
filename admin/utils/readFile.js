export const readFileAsText = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });

export const readFileAsBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result || "";
      const base64 = typeof result === "string" ? result.split(",").pop() : "";
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const extensionMap = [
  [".csv", "csv"],
  [".json", "json"],
  [".xlsx", "xlsx"],
  [".xls", "xlsx"],
  [".sql", "sql"],
];

const detectFormat = (stripped) => {
  const entry = extensionMap.find(([ext]) => stripped.endsWith(ext));
  return entry ? entry[1] : null;
};

export const getFormatFromFilename = (name = "") => {
  const lower = String(name).toLowerCase();
  const gzipped = lower.endsWith(".gz");
  const stripped = gzipped ? lower.slice(0, -3) : lower;
  const format = detectFormat(stripped);
  return format ? { format, gzipped } : null;
};
