/**
 * Isi atlas zona Lembaga (1024 × 2048): 8 papan nama sekre (dari sekre.data.js), 12 stiker, papan
 * pengumuman, 3 spanduk ormawa, nama gedung (stadion mini, student center, rusunawa) dan plang FH.
 * Semua teks generik [INFERENSI] kecuali nama BEM/DPM & nama gedung OSM; tagline "UNGGUL DAN BERMARTABAT"
 * = tagline Milad 60 UNRI ([S], riset §6).
 */
import { createCanvasAtlas, fitFont } from '../../world/props/unri/atlas.js';
import { drawPapanNama, PAPAN_NAMA_SEKRE } from '../../world/props/unri/papanNamaSekre.js';
import { drawSpanduk, SPANDUK } from '../../world/props/unri/spanduk.js';
import { drawPapanPengumuman, PAPAN_PENGUMUMAN } from '../../world/props/unri/papanPengumuman.js';
import { toCss } from '../../world/props/canvasText.js';

export const STICKERS = Object.freeze([
  { teks: 'HIDUP MAHASISWA!', bentuk: 'bulat', latar: 0xc8102e, warna: 0xffffff },
  { teks: 'UNRI', bentuk: 'bulat', latar: 0x7ec8ee, warna: 0x0d3b66 },
  { teks: 'KAMPUS BIRU LANGIT', bentuk: 'kotak', latar: 0x7ec8ee, warna: 0xffffff },
  { teks: 'SALAM LESTARI', bentuk: 'bulat', latar: 0x2e7d32, warna: 0xffffff },
  { teks: 'PERS', bentuk: 'kotak', latar: 0x1b1b1b, warna: 0xf2c200 },
  { teks: 'SENI', bentuk: 'bulat', latar: 0x6a1b9a, warna: 0xffffff },
  { teks: 'DONOR DARAH', bentuk: 'kotak', latar: 0xe53935, warna: 0xffffff },
  { teks: 'BERSIH ITU SEHAT', bentuk: 'kotak', latar: 0x00897b, warna: 0xffffff },
  { teks: 'OPREC', bentuk: 'bulat', latar: 0xf9a825, warna: 0x1b1b1b },
  { teks: 'RAPAT TIAP KAMIS', bentuk: 'kotak', latar: 0xffffff, warna: 0xc8102e },
  { teks: 'LANCANG KUNING', bentuk: 'bulat', latar: 0xf2c200, warna: 0x1f7a3a },
  { teks: 'DILARANG MEROKOK', bentuk: 'bulat', latar: 0xffffff, warna: 0xc8102e },
].map(Object.freeze));

export const NOTICES = Object.freeze(['OPEN RECRUITMENT', 'RAPAT PLENO', 'JADWAL PIKET', 'LOMBA DEBAT', 'PENGUMUMAN', 'KEHILANGAN']);

export const SPANDUK_TEKS = Object.freeze([
  { judul: 'OPEN RECRUITMENT ANGGOTA BARU', sub: 'DAFTAR DI SEKRETARIAT — KAMPUS BIRU LANGIT', latar: 0xf2c200, teks: 0x0d3b66, aksen: 0xc8102e },
  { judul: 'MUSYAWARAH BESAR ORMAWA', sub: 'SEKRETARIAT LEMBAGA MAHASISWA UNIVERSITAS RIAU', latar: 0x0d3b66, teks: 0xffffff, aksen: 0xf2c200 },
  { judul: 'SELAMAT DATANG MAHASISWA BARU', sub: 'UNIVERSITAS RIAU — UNGGUL DAN BERMARTABAT', latar: 0x1f7a3a, teks: 0xffffff, aksen: 0xf2c200 },
].map(Object.freeze));

export const NAMA_GEDUNG = Object.freeze({
  'nama:stadion': { judul: 'STADION MINI UNIVERSITAS RIAU', latar: 0x123a6b, teks: 0xffffff, w: 960, h: 72 },
  'nama:sc': { judul: 'STUDENT CENTER', sub: 'UNIVERSITAS RIAU', latar: 0x111111, teks: 0xffffff, w: 512, h: 128 },
  'nama:rusun': { judul: 'RUSUNAWA MAHASISWA', sub: 'UNIVERSITAS RIAU', latar: 0xe9e4d8, teks: 0x0d3b66, w: 512, h: 128 },
  'plang:fh': { judul: 'DILARANG MASUK', sub: 'AREA PROYEK', latar: 0xffffff, teks: 0xc8102e, w: 256, h: 128 },
});

function drawSticker(ctx, w, h, s) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = toCss(s.latar);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2;
  if (s.bentuk === 'bulat') {
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.46, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillRect(w * 0.04, h * 0.22, w * 0.92, h * 0.56);
    ctx.strokeRect(w * 0.04, h * 0.22, w * 0.92, h * 0.56);
  }
  ctx.fillStyle = toCss(s.warna);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const words = s.teks.split(' ');
  const lines = words.length > 2 ? [words.slice(0, 2).join(' '), words.slice(2).join(' ')] : [s.teks];
  lines.forEach((line, i) => {
    fitFont(ctx, line, w * 0.8, h * 0.2, 'bold');
    ctx.fillText(line, w / 2, h / 2 + (i - (lines.length - 1) / 2) * h * 0.2);
  });
}

function drawNama(ctx, w, h, { judul, sub = '', latar, teks }) {
  ctx.fillStyle = toCss(latar);
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = toCss(teks);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  fitFont(ctx, judul, w * 0.92, h * (sub ? 0.42 : 0.62), 'bold');
  ctx.fillText(judul, w / 2, sub ? h * 0.4 : h / 2);
  if (sub) {
    fitFont(ctx, sub, w * 0.8, h * 0.2, 'bold');
    ctx.fillText(sub, w / 2, h * 0.76);
  }
}

/** Atlas zona (satu tekstur untuk semua decal kanvas region). */
export function createLembagaAtlas(rooms) {
  const cells = [
    ...rooms.map((r) => ({ id: `sign:${r.index}`, w: PAPAN_NAMA_SEKRE.px.w, h: PAPAN_NAMA_SEKRE.px.h, draw: (ctx, w, h) => drawPapanNama(ctx, w, h, r) })),
    ...STICKERS.map((s, k) => ({ id: `stiker:${k}`, w: 96, h: 96, draw: (ctx, w, h) => drawSticker(ctx, w, h, s) })),
    { id: 'papan:pengumuman', w: PAPAN_PENGUMUMAN.px.w, h: PAPAN_PENGUMUMAN.px.h, draw: (ctx, w, h) => drawPapanPengumuman(ctx, w, h, { notices: NOTICES }) },
    ...SPANDUK_TEKS.map((t, k) => ({ id: `spanduk:${k}`, w: SPANDUK.px.w, h: SPANDUK.px.h, draw: (ctx, w, h) => drawSpanduk(ctx, w, h, t) })),
    ...Object.entries(NAMA_GEDUNG).map(([id, n]) => ({ id, w: n.w, h: n.h, draw: (ctx, w, h) => drawNama(ctx, w, h, n) })),
  ];
  return createCanvasAtlas({ width: 1024, height: 2048, pad: 4, cells });
}
