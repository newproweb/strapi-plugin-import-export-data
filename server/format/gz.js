"use strict";

const zlib = require("zlib");

const GZIP_MAGIC = [0x1f, 0x8b];

const isGzipped = (input) => {
  if (!input) return false;
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.length >= 2 && buf[0] === GZIP_MAGIC[0] && buf[1] === GZIP_MAGIC[1];
};

const compress = (input) => {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input), "utf-8");
  return new Promise((resolve, reject) => {
    zlib.gzip(buf, (err, out) => (err ? reject(err) : resolve(out)));
  });
};

const decompress = (input) => {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return new Promise((resolve, reject) => {
    zlib.gunzip(buf, (err, out) => (err ? reject(err) : resolve(out)));
  });
};

// Back-compat wrapper in case any caller still uses `wrap(inner)` (kept so older
// integrations keep working; new code should use compress/decompress directly).
const wrap = (inner) => ({
  extension: `${inner?.extension || "bin"}.gz`,
  mime: "application/gzip",
  binary: true,
  async stringify(rows, opts) {
    const raw = await Promise.resolve(inner.stringify(rows, opts));
    return compress(raw);
  },

  async parse(input) {
    const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input, "base64");
    const plain = await decompress(buffer);
    return inner.binary ? inner.parse(plain) : inner.parse(plain.toString("utf-8"));
  },
});

module.exports = {
  GZIP_MAGIC,
  isGzipped,
  compress,
  decompress,
  wrap,
};
