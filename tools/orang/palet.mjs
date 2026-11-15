/**
 * Varian palet pack orang (tekstur 256 px bersama semua karakter): warna baju dari palet vendor terpilih × warna kulit
 * (asli "terang" dan "sawo" = baris kulit terang digeser ke cokelat sawo matang, penduduk Pekanbaru [INFERENSI]).
 * Sumber mentah: data-src/vendor-people/ (tidak di-commit). Keluaran: public/models/orang/palet-<baju>-<kulit>.png.
 *   node tools/orang/palet.mjs
 */
import { mkdirSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = join(ROOT, '..', 'stadion-utama-riau-3d', 'data-src', 'vendor-people');
const OUT = join(ROOT, 'public', 'models', 'orang');

/** Palet baju terpilih (warna kalem, cocok kampus): kunci → berkas vendor. Urutan = indeks palet di runtime. */
export const BAJU = Object.freeze({
  biru: 'people_pal.png',
  abu: 'TEXTURES/people_pal_s1.png',
  merah: 'TEXTURES/people_pal_s2.png',
  gelap: 'TEXTURES/people_pal_s4.png',
  krem: 'TEXTURES/people_pal_s5.png',
  hitam: 'TEXTURES/people_pal_s14.png',
  hijau: 'TEXTURES/people_pal_s18.png',
  navy: 'TEXTURES/people_pal_s22.png',
});
/** Blok kulit di palet 256 px: x 12..171; baris terang y 21..49, baris cokelat y 50..78. */
const SKIN = { x0: 12, x1: 172, terang: [21, 50], cokelat: [50, 79] };
const SAWO = 0.6; // porsi warna cokelat yang dicampur ke baris terang

async function build() {
  mkdirSync(OUT, { recursive: true });
  for (const [key, file] of Object.entries(BAJU)) {
    const { data, info } = await sharp(join(SRC, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    await sharp(data, { raw: info }).png({ compressionLevel: 9 }).toFile(join(OUT, `palet-${key}-terang.png`));
    const out = Buffer.from(data);
    const [t0, t1] = SKIN.terang;
    const rows = t1 - t0;
    for (let y = t0; y < t1; y += 1) {
      const ySrc = SKIN.cokelat[0] + Math.min(rows - 1, y - t0);
      for (let x = SKIN.x0; x < SKIN.x1; x += 1) {
        const i = (y * info.width + x) * 4;
        const j = (ySrc * info.width + x) * 4;
        for (let c = 0; c < 3; c += 1) out[i + c] = Math.round(data[i + c] * (1 - SAWO) + data[j + c] * SAWO);
      }
    }
    await sharp(out, { raw: info }).png({ compressionLevel: 9 }).toFile(join(OUT, `palet-${key}-sawo.png`));
  }
  console.log('palet', Object.keys(BAJU).length * 2);
}

await build();
