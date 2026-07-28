/**
 * Generates minimal but valid PWA icon PNGs using raw Node.js (no deps).
 *
 * Creates:
 *   public/icons/icon-192.png      (192×192, teal brand colour)
 *   public/icons/icon-512.png      (512×512, teal brand colour)
 *   public/icons/apple-touch-icon.png (180×180, teal brand colour)
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(OUT, { recursive: true });

// ─── CRC-32 ───────────────────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ─── PNG chunk ────────────────────────────────────────────────────────────────

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.concat([typeBytes, data]);
  const lenBuf = Buffer.allocUnsafe(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcOut = Buffer.allocUnsafe(4);
  crcOut.writeUInt32BE(crc32(crcBuf), 0);
  return Buffer.concat([lenBuf, typeBytes, data, crcOut]);
}

// ─── Icon builder ─────────────────────────────────────────────────────────────

function buildIcon(size, r, g, b) {
  // IHDR
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(size,  0); // width
  ihdr.writeUInt32BE(size,  4); // height
  ihdr[8]  = 8;  // bit depth
  ihdr[9]  = 2;  // colour type: RGB (no alpha — fully opaque)
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace

  // Raw scanlines: each row = [filter=0, r, g, b, r, g, b, …]
  const rowLen = 1 + size * 3;
  const raw = Buffer.allocUnsafe(rowLen * size);
  for (let y = 0; y < size; y++) {
    const base = y * rowLen;
    raw[base] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      raw[base + 1 + x * 3]     = r;
      raw[base + 1 + x * 3 + 1] = g;
      raw[base + 1 + x * 3 + 2] = b;
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Axia aqua: #00c8c8 → RGB(0, 200, 200)
const R = 0, G = 200, B = 200;

fs.writeFileSync(path.join(OUT, 'icon-192.png'),       buildIcon(192, R, G, B));
fs.writeFileSync(path.join(OUT, 'icon-512.png'),       buildIcon(512, R, G, B));
fs.writeFileSync(path.join(OUT, 'apple-touch-icon.png'), buildIcon(180, R, G, B));

console.log('PWA icons written to', OUT);
