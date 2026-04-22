"use strict";

const toBuffer = ({ data, binary }) => {
  if (Buffer.isBuffer(data)) return data;
  if (binary) return Buffer.from(data);
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return Buffer.from(text, "utf-8");
};

module.exports = { toBuffer };
