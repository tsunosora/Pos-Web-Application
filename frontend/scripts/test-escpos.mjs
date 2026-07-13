// frontend/scripts/test-escpos.mjs — jalankan: npx tsx scripts/test-escpos.mjs
import { rasterImage, BYTES_PER_ROW, initPrinter } from '../src/lib/thermal/escpos.ts';
import { imageDataToMono } from '../src/lib/thermal/raster.ts';
import assert from 'node:assert';

assert.deepEqual([...initPrinter()], [0x1b, 0x40], 'init salah');

// 1 baris penuh hitam (384 dot) → 48 byte 0xFF
const height = 1;
const mono = new Uint8Array(BYTES_PER_ROW * height).fill(0xff);
const out = rasterImage(mono, height);
assert.equal(out[0], 0x1d, 'GS');
assert.equal(out[1], 0x76, 'v');
assert.equal(out[2], 0x30, '0');
assert.equal(out[4], 48, 'xL bytes/row = 48');
assert.equal(out[6], 1, 'yL rows = 1');
assert.equal(out.length, 8 + 48, 'panjang header+data');

// packing bit: piksel (0,0) hitam → byte pertama MSB set
const img = { width: 384, height: 1, data: new Uint8ClampedArray(384 * 4) };
img.data[3] = 255; // alpha px0 (rgb 0,0,0 → hitam)
const { mono: m2 } = imageDataToMono(img, 160);
assert.equal(m2[0] & 0x80, 0x80, 'MSB px0 harus set');

console.log('OK semua assert ESC/POS lulus');
