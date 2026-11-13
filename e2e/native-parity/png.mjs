//! Just enough PNG for the parity comparator, on Node's own zlib: read an 8-bit, non-interlaced PNG (what Playwright,
//! WebKit and GPUI's `render_to_image` write) as RGBA, and write RGBA as a PNG.
import { deflateSync, inflateSync } from "node:zlib";

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

/** @returns {{ width: number, height: number, data: Uint8Array }} `data` is RGBA, row after row. */
export function decodePng(buffer) {
  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(SIGNATURE)) throw new Error("not a PNG file");
  let header;
  let palette = null;
  let transparency = null;
  const parts = [];
  for (let at = 8; at + 8 <= buffer.length;) {
    const length = buffer.readUInt32BE(at);
    const type = buffer.toString("latin1", at + 4, at + 8);
    const body = buffer.subarray(at + 8, at + 8 + length);
    if (body.length !== length) throw new Error("truncated PNG");
    if (type === "IHDR") header = { width: body.readUInt32BE(0), height: body.readUInt32BE(4), depth: body[8], color: body[9], interlace: body[12] };
    else if (type === "PLTE") palette = body;
    else if (type === "tRNS") transparency = body;
    else if (type === "IDAT") parts.push(body);
    else if (type === "IEND") break;
    at += 12 + length;
  }
  if (!header) throw new Error("PNG has no header");
  const { width, height, depth, color, interlace } = header;
  if (depth !== 8 || interlace !== 0 || !(color in CHANNELS)) throw new Error(`unsupported PNG (bit depth ${depth}, colour type ${color}, interlace ${interlace}): need 8-bit, not interlaced`);
  if (color === 3 && !palette) throw new Error("indexed PNG without a palette");
  const channels = CHANNELS[color];
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(parts));
  if (raw.length !== (stride + 1) * height) throw new Error("PNG pixel data has the wrong size");
  const rows = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? rows[dst + x - channels] : 0;
      const up = y > 0 ? rows[dst - stride + x] : 0;
      const upLeft = y > 0 && x >= channels ? rows[dst - stride + x - channels] : 0;
      let predictor;
      if (filter === 0) predictor = 0;
      else if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - upLeft);
        predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      } else throw new Error(`PNG row ${y} has filter ${filter}`);
      rows[dst + x] = (raw[src + x] + predictor) & 255;
    }
  }
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const p = i * channels;
    let r, g, b, a = 255;
    if (color === 6) [r, g, b, a] = [rows[p], rows[p + 1], rows[p + 2], rows[p + 3]];
    else if (color === 2) [r, g, b] = [rows[p], rows[p + 1], rows[p + 2]];
    else if (color === 0) r = g = b = rows[p];
    else if (color === 4) { r = g = b = rows[p]; a = rows[p + 1]; }
    else { const k = rows[p]; [r, g, b] = [palette[k * 3], palette[k * 3 + 1], palette[k * 3 + 2]]; a = transparency && k < transparency.length ? transparency[k] : 255; }
    data.set([r, g, b, a], i * 4);
  }
  return { width, height, data };
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(...buffers) {
  let c = 0xffffffff;
  for (const buffer of buffers) for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, body) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, "latin1");
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(head.subarray(4), body), 0);
  return Buffer.concat([head, body, tail]);
}

/** @param {{ width: number, height: number, data: Uint8Array }} image RGBA */
export function encodePng({ width, height, data }) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) rows.set(data.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  return Buffer.concat([SIGNATURE, chunk("IHDR", header), chunk("IDAT", deflateSync(rows)), chunk("IEND", Buffer.alloc(0))]);
}
