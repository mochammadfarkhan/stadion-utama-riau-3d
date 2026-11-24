/**
 * Peta rincian kota dari gambar Google Flow (assets-src/flow/*.png) → public/textures/kota/*.webp (512², bisa diulang).
 *   node tools/texbake/flowDetail.mjs
 * - genteng: luminans dinormalkan ke rata-rata 0,5 (shader mengalikan ×2 → warna atap per bangunan tetap).
 * - fasad-bay: warna dibagi warna dinding (rata-rata pojok kiri atas) → dinding ≈ 0,5, kaca tetap gelap kebiruan.
 * Tepi dilebur silang (crossfade) supaya sambungan ulangan tidak terlihat.
 */
import { Buffer } from 'node:buffer';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = join(ROOT, 'assets-src/flow');
const OUT = join(ROOT, 'public/textures/kota');
const SIZE = 512;

/** Lebur silang tepi kiri/atas dengan sisi seberangnya; hasil (w−m)×(h−m), mulus saat diulang. Murni. */
export function seamless(data, w, h, ch, m) {
  const ow = w - m;
  const oh = h - m;
  const at = (x, y, c) => data[(y * w + x) * ch + c];
  const out = new Float32Array(ow * oh * ch);
  for (let y = 0; y < oh; y += 1) {
    for (let x = 0; x < ow; x += 1) {
      const tx = x < m ? x / m : 1;
      const ty = y < m ? y / m : 1;
      for (let c = 0; c < ch; c += 1) {
        const a = at(x, y, c) * tx + at(x + ow, y, c) * (1 - tx);
        const b = y < m ? at(x, y + oh, c) * tx + at(Math.min(w - 1, x + ow), y + oh, c) * (1 - tx) : a;
        out[(y * ow + x) * ch + c] = a * ty + b * (1 - ty);
      }
    }
  }
  return { data: out, w: ow, h: oh };
}

async function load(name) {
  const { data, info } = await sharp(join(SRC, name)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: Float32Array.from(data), w: info.width, h: info.height };
}

async function save(name, px, w, h) {
  const buf = Buffer.from(Uint8Array.from(px, (v) => Math.max(0, Math.min(255, Math.round(v)))));
  await sharp(buf, { raw: { width: w, height: h, channels: 3 } }).resize(SIZE, SIZE, { kernel: 'lanczos3' }).webp({ quality: 88 }).toFile(join(OUT, name));
  console.log('tulis', name);
}

mkdirSync(OUT, { recursive: true });

{ // genteng → luminans rata-rata 127,5
  const g = await load('genteng.png');
  const s = seamless(g.data, g.w, g.h, 3, 48);
  let sum = 0;
  const lum = new Float32Array(s.w * s.h);
  for (let i = 0; i < lum.length; i += 1) { lum[i] = 0.299 * s.data[i * 3] + 0.587 * s.data[i * 3 + 1] + 0.114 * s.data[i * 3 + 2]; sum += lum[i]; }
  const k = 127.5 / (sum / lum.length);
  const px = new Float32Array(s.data.length);
  for (let i = 0; i < lum.length; i += 1) px[i * 3] = px[i * 3 + 1] = px[i * 3 + 2] = lum[i] * k;
  await save('genteng.webp', px, s.w, s.h);
}

{ // fasad: bagi warna dinding → dinding ≈ 127,5
  const f = await load('fasad-bay.png');
  const wall = [0, 0, 0];
  const n = 40;
  for (let y = 20; y < 20 + n; y += 1) for (let x = 20; x < 20 + n; x += 1) for (let c = 0; c < 3; c += 1) wall[c] += f.data[(y * f.w + x) * 3 + c];
  const px = new Float32Array(f.data.length);
  for (let i = 0; i < f.w * f.h; i += 1) for (let c = 0; c < 3; c += 1) { const v = (f.data[i * 3 + c] / (wall[c] / (n * n))) * 127.5; px[i * 3 + c] = v < 100 ? 12 + v * 1.15 : v; } // kaca gelap diangkat: terbaca biru dari kamera Kota
  await save('fasad.webp', px, f.w, f.h); // jendela di tengah; tepi sudah dinding polos → cukup tanpa lebur
}
