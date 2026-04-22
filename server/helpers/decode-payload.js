"use strict";

const looksBase64 = (text) => /^[A-Za-z0-9+/=\s]+$/.test(text) && text.length % 4 === 0;

const asUtf8Buffer = (text) => Buffer.from(text, "utf-8");

const decodeToBuffer = (fileContent, driver, gz) => {
  if (Buffer.isBuffer(fileContent)) return fileContent;
  if (typeof fileContent !== "string") return asUtf8Buffer(String(fileContent));
  if (!driver.binary && !looksBase64(fileContent)) return asUtf8Buffer(fileContent);

  try {
    const buffer = Buffer.from(fileContent, "base64");
    if (!gz.isGzipped(buffer) && !driver.binary) return asUtf8Buffer(fileContent);
    return buffer;
  } catch {
    return asUtf8Buffer(fileContent);
  }
};

const ungzipIfNeeded = async (buffer, gz) => {
  if (!gz.isGzipped(buffer)) return buffer;
  strapi.log.debug("[import-export] gzip detected in payload, decompressing");
  return gz.decompress(buffer);
};

const parsePayload = (driver, payload) =>
  driver.binary ? driver.parse(payload) : driver.parse(payload.toString("utf-8"));

const decodeRows = async (buffer, driver, gz) => {
  const payload = await ungzipIfNeeded(buffer, gz);
  const rows = await parsePayload(driver, payload);
  if (!Array.isArray(rows)) throw new Error("Parsed payload is not an array");
  return rows;
};

module.exports = { looksBase64, decodeToBuffer, decodeRows };
