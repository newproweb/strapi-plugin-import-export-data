export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const readDispositionHeader = (response) =>
  response?.headers?.["content-disposition"] || response?.headers?.get?.("content-disposition");

export const extractFilename = (response, fallback = "export") => {
  const header = readDispositionHeader(response);
  if (!header) return fallback;
  const match = /filename\*?=(?:UTF-8''|")?([^";]+)"?/i.exec(header);
  return match ? decodeURIComponent(match[1]) : fallback;
};
