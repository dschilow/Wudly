/**
 * Extension build: bundles the three entry points with esbuild, copies the
 * static assets and generates the toolbar icons (pure Node — no image deps).
 * `node build.mjs --watch` rebuilds on change for local development.
 */
import { build, context } from 'esbuild';
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const watch = process.argv.includes('--watch');
const outdir = 'dist';

const options = {
  entryPoints: ['src/content.ts', 'src/background.ts', 'src/options.ts'],
  bundle: true,
  format: 'iife',
  target: 'chrome110',
  outdir,
  sourcemap: watch ? 'inline' : false,
  minify: !watch,
  logLevel: 'info',
};

function copyStatic() {
  cpSync('public', outdir, { recursive: true });
  mkdirSync(`${outdir}/icons`, { recursive: true });
  for (const size of [16, 32, 48, 128]) {
    writeFileSync(`${outdir}/icons/icon${size}.png`, iconPng(size));
  }
}

/* ------------------------------------------------------------------ *
 * Icon generator: the Wudly "Signal" mark — ink rounded square with the
 * accent-green signal dot — rendered into a minimal RGBA PNG by hand so the
 * build needs no image library.
 * ------------------------------------------------------------------ */

function iconPng(size) {
  const INK = [12, 13, 18, 255]; // #0c0d12
  const ACCENT = [10, 160, 106, 255]; // #0aa06a
  const px = new Uint8Array(size * size * 4); // transparent by default
  const radius = size * 0.22;
  const cx = size / 2;
  const cy = size / 2;
  const dot = size * 0.28;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!insideRoundedRect(x + 0.5, y + 0.5, size, radius)) continue;
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      const color = d <= dot ? ACCENT : INK;
      px.set(color, (y * size + x) * 4);
    }
  }
  return encodePng(size, size, px);
}

function insideRoundedRect(x, y, size, r) {
  if (x < 0 || y < 0 || x > size || y > size) return false;
  const nx = Math.max(r - x, x - (size - r), 0);
  const ny = Math.max(r - y, y - (size - r), 0);
  return nx * nx + ny * ny <= r * r;
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const scanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    scanlines[y * (1 + width * 4)] = 0; // filter: none
    Buffer.from(rgba.buffer, y * width * 4, width * 4).copy(
      scanlines,
      y * (1 + width * 4) + 1,
    );
  }
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(scanlines)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

let crcTable;
function crc32(buf) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of buf) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/* Execution last — top-level await must not run before the declarations above. */
if (watch) {
  const ctx = await context(options);
  copyStatic();
  await ctx.watch();
} else {
  await build(options);
  copyStatic();
}
