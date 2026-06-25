// Generates valid solid-color PNG placeholder assets so Expo's icon pipeline
// (jimp) can process them. Pure Node (zlib + manual PNG chunks), no deps.
// Replace these with real brand artwork before a store release.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

/** Solid RGBA PNG of size×size in the given [r,g,b]. */
function solidPng(size, [r, g, b]) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // raw image: each row = filter byte (0) + size*4 pixels
  const row = Buffer.alloc(1 + size * 4);
  for (let x = 0; x < size; x++) {
    row[1 + x * 4] = r;
    row[1 + x * 4 + 1] = g;
    row[1 + x * 4 + 2] = b;
    row[1 + x * 4 + 3] = 255;
  }
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const dir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(dir, { recursive: true });

const DARK = [12, 13, 18]; // #0c0d12 — Wudly background
const GREEN = [10, 160, 106]; // #0aa06a — Wudly accent

const files = {
  'icon.png': solidPng(1024, GREEN),
  'adaptive-icon.png': solidPng(1024, GREEN),
  'splash.png': solidPng(1024, DARK),
  'favicon.png': solidPng(48, GREEN),
};

for (const [name, buf] of Object.entries(files)) {
  fs.writeFileSync(path.join(dir, name), buf);
  console.log(`wrote ${name} (${buf.length} bytes)`);
}
