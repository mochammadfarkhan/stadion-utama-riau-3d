/**
 * Papan & cetakan dinding sekre (spec §8.2; katalog S01–S06, kain bendera S08, label ordner S10, S26, S28):
 * digambar ke canvas dari data.js — bagan kabinet dengan kotak "foto" & nama, timeline proker di papan gabus,
 * whiteboard coretan rapat (tulisan tangan, bekas hapusan), dan satu atlas 1024² untuk cetakan kecil (kalender,
 * jadwal piket, 4 piagam, 4 poster, 12 label ordner, stiker, kain 3 bendera) → satu draw call;
 * noda bocor plafon memakai tekstur transparan sendiri.
 * Gambar ulang setelah font web siap (redrawWhenFontsReady) agar huruf Inter dipakai, bukan cadangan.
 */
import * as THREE from 'three';
import { makeRng } from '../../entities/util.js';
import {
  ASET, DOOR, ROOM, ORGANISASI, STRUKTUR, PROKER, BULAN_PROKER, CATATAN_RAPAT, KALENDER, PIKET, PIAGAM, POSTER,
  STIKER, DATA_CONTOH, TEKS, ordnerSlots,
} from './data.js';
import {
  makeCanvas, canvasTexture, fitFont, wrapLines, roundRect, tape, paperNoise, silhouette, atlasPlane, tint,
  FONT, HAND, ATLAS_SIZE,
} from './canvas.js';

/** Persegi atlas [x, y, w, h] piksel (origin kiri-atas). */
export const ATLAS = Object.freeze({
  kalender: [0, 0, 256, 384],
  piket: [256, 0, 256, 358],
  piagam: [[512, 0, 320, 240], [512, 240, 320, 240], [512, 480, 320, 240], [512, 720, 320, 240]],
  poster: [[0, 384, 224, 320], [224, 384, 224, 320], [0, 704, 224, 320], [224, 704, 224, 320]],
  ordner: Array.from({ length: 12 }, (_, i) => [448 + (i % 2) * 32, 384 + Math.floor(i / 2) * 64, 32, 64]),
  stiker: Array.from({ length: 6 }, (_, i) => [832 + (i % 2) * 96, Math.floor(i / 2) * 96, 96, 96]),
  stikerPintu: [832, 288, 192, 192],
  benderaOrganisasi: [832, 672, 192, 128],
  benderaUnri: [832, 800, 192, 128],
  benderaMerahPutih: [832, 928, 144, 96],
});

const BIRU_SPIDOL = '#1f4fa0';
const MERAH_SPIDOL = '#c0392b';
const HITAM_SPIDOL = '#222222';

function line(c, x1, y1, x2, y2, color = '#7b7364', width = 2.5) {
  c.strokeStyle = color;
  c.lineWidth = width;
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  c.stroke();
}

function pin(c, x, y, color = '#d32f2f') {
  c.fillStyle = 'rgba(0,0,0,0.25)';
  c.beginPath(); c.arc(x + 2, y + 3, 7, 0, Math.PI * 2); c.fill();
  c.fillStyle = color;
  c.beginPath(); c.arc(x, y, 7, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.6)';
  c.beginPath(); c.arc(x - 2, y - 2, 2.5, 0, Math.PI * 2); c.fill();
}

/** Kartu pengurus: kotak "foto" siluet + jabatan + nama. */
function personCard(c, x, y, cw, ch, jabatan, nama, accent) {
  c.fillStyle = 'rgba(0,0,0,0.12)';
  roundRect(c, x + 3, y + 4, cw, ch, 8);
  c.fill();
  c.fillStyle = '#ffffff';
  roundRect(c, x, y, cw, ch, 8);
  c.fill();
  c.fillStyle = accent;
  c.fillRect(x, y, 6, ch);
  silhouette(c, x + 12, y + 8, ch - 16, ch - 16);
  const tx = x + ch;
  const tw = cw - ch - 8;
  c.textAlign = 'left';
  c.textBaseline = 'alphabetic';
  c.fillStyle = accent;
  fitFont(c, jabatan.toUpperCase(), tw, { weight: 700, size: 13 });
  c.fillText(jabatan.toUpperCase(), tx, y + ch * 0.42);
  c.fillStyle = '#1d1d1d';
  fitFont(c, nama, tw, { weight: 700, size: 18 });
  c.fillText(nama, tx, y + ch * 0.75);
}

/** S01 bagan kabinet (1024 × 683 untuk papan 1,8 × 1,2 m). */
export function drawStruktur(c, w, h) {
  const rnd = makeRng(7);
  c.fillStyle = '#f4efe3';
  c.fillRect(0, 0, w, h);
  paperNoise(c, w, h, rnd, 1200);
  c.fillStyle = ORGANISASI.warna;
  c.fillRect(0, 0, w, 86);
  c.fillStyle = ORGANISASI.warna2;
  c.fillRect(0, 86, w, 6);
  c.fillStyle = '#ffffff';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  fitFont(c, 'STRUKTUR KEPENGURUSAN', w - 80, { weight: 800, size: 36 });
  c.fillText('STRUKTUR KEPENGURUSAN', w / 2, 32);
  const sub = `${ORGANISASI.nama} · ${ORGANISASI.kabinet} · ${ORGANISASI.periode}`.toUpperCase();
  fitFont(c, sub, w - 80, { weight: 600, size: 20 });
  c.fillText(sub, w / 2, 66);

  const cw = 230;
  const ch = 70;
  const row = (list, y) => list.map((_, i) => w / 2 + (i - (list.length - 1) / 2) * (cw + 30) - cw / 2).map((x) => ({ x, y }));
  const y1 = 108;
  const y2 = y1 + ch + 36;
  const y3 = y2 + ch + 52;
  const inti = row(STRUKTUR.inti, y1);
  const sekben = row(STRUKTUR.sekben, y2);
  line(c, w / 2, y1 + ch, w / 2, y3 - 22);
  line(c, sekben[0].x + cw / 2, y2 - 16, sekben.at(-1).x + cw / 2, y2 - 16);
  for (const s of sekben) line(c, s.x + cw / 2, y2 - 16, s.x + cw / 2, y2);
  STRUKTUR.inti.forEach((p, i) => personCard(c, inti[i].x, y1, cw, ch, p.jabatan, p.nama, ORGANISASI.warna));
  STRUKTUR.sekben.forEach((p, i) => personCard(c, sekben[i].x, y2, cw, ch, p.jabatan, p.nama, '#3d5a80'));
  const n = STRUKTUR.divisi.length;
  const dw = (w - 40 - (n - 1) * 12) / n;
  line(c, 20 + dw / 2, y3 - 22, w - 20 - dw / 2, y3 - 22);
  STRUKTUR.divisi.forEach((d, i) => {
    const x = 20 + i * (dw + 12);
    line(c, x + dw / 2, y3 - 22, x + dw / 2, y3);
    if (d.koor) personCard(c, x, y3, dw, ch, `Koor. ${d.nama}`, d.koor, '#2a9d8f');
    else personCard(c, x, y3, dw, ch, 'Anggota', ORGANISASI.singkatan, '#2a9d8f');
    c.fillStyle = '#3b3b3b';
    c.textAlign = 'left';
    d.anggota.forEach((a, k) => {
      fitFont(c, `• ${a}`, dw - 16, { weight: 500, size: 15 });
      c.fillText(`• ${a}`, x + 14, y3 + ch + 24 + k * 21);
    });
  });
  c.fillStyle = '#6b6153';
  c.textAlign = 'center';
  fitFont(c, `“${ORGANISASI.motto}”`, w - 360, { weight: 600, size: 22 });
  c.fillText(`“${ORGANISASI.motto}”`, w / 2 - 80, h - 70);
  tape(c, 26, 18, 70, 22, -0.6);
  tape(c, w - 26, 18, 70, 22, 0.6);
  tape(c, 26, h - 18, 70, 22, 0.6);
  tape(c, w - 26, h - 18, 70, 22, -0.6);
  c.save(); // catatan tempel
  c.translate(w - 160, h - 120);
  c.rotate(0.05);
  c.fillStyle = '#fff59d';
  c.fillRect(0, 0, 124, 84);
  c.fillStyle = BIRU_SPIDOL;
  c.font = `18px ${HAND}`;
  c.textAlign = 'left';
  c.fillText('foto blm', 10, 30);
  c.fillText('dicetak!!', 10, 58);
  c.restore();
  if (DATA_CONTOH) {
    c.fillStyle = 'rgba(0,0,0,0.45)';
    c.font = `500 11px ${FONT}`;
    c.textAlign = 'left';
    c.fillText(TEKS.contoh, 14, h - 8);
  }
}

const STATUS = Object.freeze({
  selesai: { warna: '#2e7d32', teks: '✓ selesai' },
  berjalan: { warna: '#ef6c00', teks: '● berjalan' },
  rencana: { warna: '#757575', teks: '○ rencana' },
});

/** S02 timeline proker di papan gabus (1024 × 683 untuk 1,5 × 1,0 m). */
export function drawProker(c, w, h) {
  const rnd = makeRng(9);
  c.fillStyle = '#c49a6c';
  c.fillRect(0, 0, w, h);
  for (let i = 0; i < 6000; i += 1) {
    c.fillStyle = `rgba(${rnd() < 0.5 ? '90,60,30' : '235,200,150'},${0.15 + rnd() * 0.2})`;
    c.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  c.fillStyle = '#fffdf6';
  c.fillRect(w / 2 - 260, 22, 520, 76);
  c.fillStyle = ORGANISASI.warna;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  fitFont(c, 'PROGRAM KERJA', 480, { weight: 800, size: 34 });
  c.fillText('PROGRAM KERJA', w / 2, 48);
  c.fillStyle = '#444444';
  const sub = `${ORGANISASI.kabinet} · ${ORGANISASI.periode}`;
  fitFont(c, sub, 480, { weight: 600, size: 16 });
  c.fillText(sub, w / 2, 80);
  pin(c, w / 2, 26);
  const x0 = 60;
  const x1 = w - 60;
  const ty = 360;
  line(c, x0, ty, x1, ty, '#2b2b2b', 5);
  c.fillStyle = '#2b2b2b';
  c.beginPath(); c.moveTo(x1 + 18, ty); c.lineTo(x1, ty - 10); c.lineTo(x1, ty + 10); c.closePath(); c.fill();
  const monthX = (i) => x0 + ((x1 - x0) * (i + 0.5)) / BULAN_PROKER.length;
  BULAN_PROKER.forEach((b, i) => {
    const x = monthX(i);
    line(c, x, ty - 8, x, ty + 8, '#2b2b2b', 3);
    c.fillStyle = '#fffdf6';
    c.fillRect(x - 22, ty + 14, 44, 22);
    c.fillStyle = '#333333';
    c.font = `700 14px ${FONT}`;
    c.fillText(b, x, ty + 25);
  });
  PROKER.forEach((pk, i) => {
    const x = monthX(BULAN_PROKER.indexOf(pk.bulan));
    const up = i % 2 === 0;
    const cw = 150;
    const chh = 104;
    const cx = Math.min(w - cw - 10, Math.max(10, x - cw / 2));
    const cy = up ? 128 : 430;
    line(c, x, ty, x, up ? cy + chh : cy, 'rgba(40,40,40,0.6)', 2);
    const st = STATUS[pk.status] ?? STATUS.rencana;
    c.save();
    c.translate(cx + cw / 2, cy + chh / 2);
    c.rotate((rnd() - 0.5) * 0.06);
    c.fillStyle = 'rgba(0,0,0,0.2)';
    c.fillRect(-cw / 2 + 3, -chh / 2 + 4, cw, chh);
    c.fillStyle = '#fffef7';
    c.fillRect(-cw / 2, -chh / 2, cw, chh);
    c.fillStyle = st.warna;
    c.fillRect(-cw / 2, -chh / 2, cw, 8);
    c.fillStyle = '#222222';
    c.textAlign = 'center';
    c.font = `700 16px ${FONT}`;
    wrapLines(c, pk.nama, cw - 16).slice(0, 3).forEach((l, k) => c.fillText(l, 0, -chh / 2 + 30 + k * 19));
    c.fillStyle = st.warna;
    c.font = `700 13px ${FONT}`;
    c.fillText(st.teks, 0, chh / 2 - 14);
    c.restore();
    pin(c, cx + cw / 2, cy + 6, ['#d32f2f', '#1976d2', '#388e3c', '#fbc02d'][i % 4]);
    if (pk.catatan) {
      c.fillStyle = MERAH_SPIDOL;
      c.font = `24px ${HAND}`;
      c.fillText(pk.catatan, cx + cw / 2 + 40, up ? cy + chh + 28 : cy - 14);
    }
  });
  c.textAlign = 'left';
  c.fillStyle = '#fffdf6';
  c.fillRect(20, h - 54, 360, 36);
  let lx = 32;
  for (const st of Object.values(STATUS)) {
    c.fillStyle = st.warna;
    c.font = `700 14px ${FONT}`;
    c.fillText(st.teks, lx, h - 36);
    lx += 112;
  }
  if (DATA_CONTOH) {
    c.fillStyle = 'rgba(255,255,255,0.75)';
    c.font = `500 11px ${FONT}`;
    c.textAlign = 'right';
    c.fillText(TEKS.contoh, w - 14, h - 8);
  }
}

/** S03 whiteboard coretan rapat (1024 × 768 untuk 1,2 × 0,9 m). */
export function drawWhiteboard(c, w, h) {
  const rnd = makeRng(13);
  c.fillStyle = '#f7f8f6';
  c.fillRect(0, 0, w, h);
  for (let i = 0; i < 14; i += 1) { // bekas hapusan
    const x = rnd() * w;
    const y = rnd() * h;
    const r = 60 + rnd() * 140;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(120,130,150,0.07)');
    g.addColorStop(1, 'rgba(120,130,150,0)');
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  c.textAlign = 'left';
  c.textBaseline = 'alphabetic';
  c.fillStyle = 'rgba(60,80,120,0.08)'; // tulisan lama yang tidak terhapus sempurna
  c.font = `40px ${HAND}`;
  c.fillText('kas bulan lalu: 350rb', 520, 300);
  c.fillText('rapat evaluasi', 80, 690);
  const R = CATATAN_RAPAT;
  c.fillStyle = BIRU_SPIDOL;
  fitFont(c, R.judul, w - 340, { weight: 400, size: 46, family: HAND });
  c.fillText(R.judul, 40, 72);
  c.strokeStyle = BIRU_SPIDOL;
  c.lineWidth = 3;
  c.beginPath();
  for (let x = 40; x < w - 320; x += 20) c.lineTo(x, 86 + Math.sin(x / 14) * 3);
  c.stroke();
  c.fillStyle = HITAM_SPIDOL;
  c.font = `26px ${HAND}`;
  c.fillText(R.tanggal, 44, 126);
  R.poin.forEach((pt, i) => {
    c.fillStyle = pt.includes('!!') ? MERAH_SPIDOL : HITAM_SPIDOL;
    fitFont(c, `- ${pt}`, w - 120, { weight: 400, size: 30, family: HAND });
    c.fillText(`- ${pt}`, 50, 182 + i * 56);
  });
  const tx = 50;
  const ty = 488;
  const colW = 210;
  const rowH = 52;
  c.strokeStyle = BIRU_SPIDOL;
  c.lineWidth = 3;
  c.strokeRect(tx, ty, colW * R.tabel.kolom.length, rowH * 2);
  for (let k = 1; k < R.tabel.kolom.length; k += 1) line(c, tx + colW * k, ty, tx + colW * k, ty + rowH * 2, BIRU_SPIDOL, 3);
  line(c, tx, ty + rowH, tx + colW * R.tabel.kolom.length, ty + rowH, BIRU_SPIDOL, 3);
  R.tabel.kolom.forEach((k, i) => {
    c.fillStyle = BIRU_SPIDOL;
    c.font = `28px ${HAND}`;
    c.fillText(k, tx + 14 + colW * i, ty + 36);
    c.fillStyle = HITAM_SPIDOL;
    c.fillText(R.tabel.isi[i], tx + 14 + colW * i, ty + rowH + 36);
  });
  c.fillStyle = MERAH_SPIDOL;
  c.font = `34px ${HAND}`;
  c.fillText(R.tenggat, w - 400, 548);
  c.strokeStyle = MERAH_SPIDOL;
  c.lineWidth = 3;
  c.beginPath();
  c.ellipse(w - 245, 536, 175, 40, -0.04, 0, Math.PI * 2);
  c.stroke();
  line(c, 640, 310, w - 300, 500, MERAH_SPIDOL, 3); // panah dari poin proposal
  c.beginPath(); c.moveTo(w - 300, 500); c.lineTo(w - 320, 482); c.moveTo(w - 300, 500); c.lineTo(w - 326, 500); c.stroke();
  c.strokeStyle = HITAM_SPIDOL; // orang lidi + semangat
  c.lineWidth = 3;
  const sx = 800;
  const sy = 640;
  c.beginPath(); c.arc(sx, sy - 40, 14, 0, Math.PI * 2); c.stroke();
  line(c, sx, sy - 26, sx, sy + 20, HITAM_SPIDOL, 3);
  line(c, sx, sy - 10, sx - 24, sy - 30, HITAM_SPIDOL, 3);
  line(c, sx, sy - 10, sx + 24, sy - 30, HITAM_SPIDOL, 3);
  line(c, sx, sy + 20, sx - 16, sy + 50, HITAM_SPIDOL, 3);
  line(c, sx, sy + 20, sx + 16, sy + 50, HITAM_SPIDOL, 3);
  c.fillStyle = BIRU_SPIDOL;
  c.font = `30px ${HAND}`;
  c.fillText(R.semangat, sx + 40, sy);
  c.save();
  c.translate(w - 260, 50);
  c.rotate(0.08);
  c.fillStyle = MERAH_SPIDOL;
  c.font = `24px ${HAND}`;
  c.fillText(R.sudut, 0, 0);
  c.restore();
}

// ---------- Atlas cetakan kecil ----------

function drawKalender(c, [x, y, w, h]) {
  const k = KALENDER;
  c.save();
  c.translate(x, y);
  c.fillStyle = '#fbfaf6';
  c.fillRect(0, 0, w, h);
  const g = c.createLinearGradient(0, 0, 0, h * 0.36);
  g.addColorStop(0, '#6fbfe8');
  g.addColorStop(1, '#d7eef8');
  c.fillStyle = g;
  c.fillRect(8, 8, w - 16, h * 0.34);
  c.fillStyle = '#2f5d50';
  c.fillRect(8, h * 0.29, w - 16, h * 0.05);
  c.fillStyle = '#efe6d2';
  c.fillRect(w * 0.3, h * 0.17, w * 0.4, h * 0.12);
  c.fillStyle = '#c0392b';
  c.fillRect(w * 0.26, h * 0.15, w * 0.48, h * 0.03);
  c.fillStyle = '#c0392b';
  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';
  fitFont(c, k.bulan, w - 20, { weight: 800, size: 24 });
  c.fillText(k.bulan, w / 2, h * 0.43);
  const days = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
  const gx = 10;
  const gy = h * 0.48;
  const cw = (w - 20) / 7;
  const chh = (h * 0.48) / 6;
  c.font = `700 12px ${FONT}`;
  days.forEach((d, i) => {
    c.fillStyle = i === 6 ? '#c0392b' : '#333333';
    c.fillText(d, gx + cw * i + cw / 2, gy);
  });
  c.font = `600 15px ${FONT}`;
  for (let day = 1; day <= k.jumlahHari; day += 1) {
    const cell = k.hariMulai + day - 1;
    const col = cell % 7;
    const rowI = Math.floor(cell / 7);
    const cx = gx + cw * col + cw / 2;
    const cy = gy + 20 + chh * rowI;
    c.fillStyle = col === 6 || k.libur.includes(day) ? '#c0392b' : '#222222';
    c.fillText(String(day), cx, cy);
    if (k.tanda[day]) {
      c.strokeStyle = 'rgba(200,30,30,0.85)';
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(cx, cy - 5, cw * 0.44, chh * 0.42, 0.2, 0, Math.PI * 2);
      c.stroke();
    }
  }
  c.fillStyle = BIRU_SPIDOL;
  c.font = `16px ${HAND}`;
  c.textAlign = 'left';
  c.fillText(k.coretan, 12, h - 10);
  c.restore();
}

function drawPiket(c, [x, y, w, h]) {
  c.save();
  c.translate(x, y);
  c.fillStyle = '#fffef8';
  c.fillRect(0, 0, w, h);
  c.fillStyle = '#264653';
  c.fillRect(0, 0, w, 40);
  c.fillStyle = '#ffffff';
  c.font = `800 18px ${FONT}`;
  c.textAlign = 'center';
  c.fillText('JADWAL PIKET', w / 2, 27);
  const rowH = (h - 60) / PIKET.length;
  PIKET.forEach((pk, i) => {
    const ry = 50 + i * rowH;
    c.fillStyle = i % 2 ? '#f1ede2' : '#fffef8';
    c.fillRect(6, ry, w - 12, rowH - 2);
    c.textAlign = 'left';
    c.fillStyle = '#264653';
    c.font = `800 14px ${FONT}`;
    c.fillText(pk.hari.toUpperCase(), 14, ry + 20);
    c.fillStyle = '#333333';
    fitFont(c, pk.nama.join(', '), w - 70, { weight: 500, size: 13 });
    c.fillText(pk.nama.join(', '), 14, ry + 40);
    if (pk.centang) {
      c.strokeStyle = '#2a9d8f';
      c.lineWidth = 3;
      c.beginPath(); c.moveTo(w - 36, ry + 24); c.lineTo(w - 28, ry + 32); c.lineTo(w - 14, ry + 14); c.stroke();
    }
  });
  c.restore();
}

function drawPiagam(c, [x, y, w, h], pg) {
  c.save();
  c.translate(x, y);
  c.fillStyle = '#fbf6e4';
  c.fillRect(0, 0, w, h);
  c.strokeStyle = '#b8892f';
  c.lineWidth = 6;
  c.strokeRect(10, 10, w - 20, h - 20);
  c.lineWidth = 1.5;
  c.strokeRect(18, 18, w - 36, h - 36);
  c.textAlign = 'center';
  c.fillStyle = '#7a5a16';
  fitFont(c, pg.judul, w - 60, { weight: 800, size: 22 });
  c.fillText(pg.judul, w / 2, 54);
  c.fillStyle = '#555555';
  c.font = `500 12px ${FONT}`;
  c.fillText('diberikan kepada', w / 2, 78);
  c.fillStyle = '#222222';
  fitFont(c, pg.kepada, w - 60, { weight: 700, size: 17 });
  c.fillText(pg.kepada, w / 2, 102);
  c.font = `500 13px ${FONT}`;
  wrapLines(c, pg.isi, w - 70).slice(0, 3).forEach((l, i) => c.fillText(l, w / 2, 128 + i * 17));
  c.strokeStyle = 'rgba(40,70,160,0.55)';
  c.lineWidth = 3;
  c.beginPath(); c.arc(w * 0.3, h - 50, 22, 0, Math.PI * 2); c.stroke();
  c.strokeStyle = '#1f2f6f';
  c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(w * 0.58, h - 44); c.bezierCurveTo(w * 0.64, h - 70, w * 0.7, h - 28, w * 0.78, h - 56); c.stroke();
  c.fillStyle = '#444444';
  c.font = `500 11px ${FONT}`;
  c.fillText(String(pg.tahun), w * 0.68, h - 24);
  c.restore();
}

function drawPoster(c, [x, y, w, h], ps, rnd) {
  c.save();
  c.translate(x, y);
  const g = c.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, ps.warna);
  g.addColorStop(1, ps.warna2);
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  c.globalAlpha = 0.22;
  c.fillStyle = '#ffffff';
  for (let i = 0; i < 6; i += 1) {
    c.beginPath(); c.arc(rnd() * w, rnd() * h, 10 + rnd() * 40, 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;
  c.fillStyle = '#ffffff';
  c.textAlign = 'center';
  c.font = `700 11px ${FONT}`;
  c.fillText(ORGANISASI.nama.toUpperCase(), w / 2, 22);
  fitFont(c, ps.judul, w - 24, { weight: 900, size: 34 });
  c.fillText(ps.judul, w / 2, h * 0.36);
  c.font = `600 15px ${FONT}`;
  wrapLines(c, ps.sub, w - 30).slice(0, 3).forEach((l, i) => c.fillText(l, w / 2, h * 0.36 + 30 + i * 19));
  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.fillRect(0, h - 64, w, 64);
  c.fillStyle = '#ffffff';
  c.font = `700 15px ${FONT}`;
  c.fillText(ps.tanggal, w / 2, h - 38);
  c.font = `500 12px ${FONT}`;
  c.fillText(ps.tempat, w / 2, h - 18);
  c.fillStyle = 'rgba(255,250,235,0.22)'; // pudar terkena cahaya
  c.fillRect(0, 0, w, h);
  tape(c, 16, 10, 40, 14, -0.5);
  tape(c, w - 16, 10, 40, 14, 0.5);
  c.restore();
}

function drawOrdnerLabel(c, [x, y, w, h], label) {
  c.save();
  c.translate(x, y);
  c.fillStyle = '#f5f1e6';
  c.fillRect(2, 2, w - 4, h - 4);
  c.strokeStyle = '#999999';
  c.strokeRect(2, 2, w - 4, h - 4);
  c.translate(w / 2, h / 2);
  c.rotate(-Math.PI / 2);
  c.fillStyle = '#1a1a1a';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  fitFont(c, label, h - 8, { weight: 800, size: 14 });
  c.fillText(label, 0, 0);
  c.restore();
}

function drawStiker(c, [x, y, w, h], text, i) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const r = w * 0.44;
  c.save();
  if (text === 'NO SMOKING') {
    c.fillStyle = '#ffffff';
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#424242';
    c.fillRect(cx - r * 0.55, cy - 4, r * 1.1, 8);
    c.strokeStyle = '#d32f2f';
    c.lineWidth = 7;
    c.beginPath(); c.arc(cx, cy, r - 4, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(cx - r * 0.65, cy - r * 0.65); c.lineTo(cx + r * 0.65, cy + r * 0.65); c.stroke();
  } else {
    c.fillStyle = ['#6fbfe8', '#ffffff', '#f4a261', '#2a9d8f', ORGANISASI.warna, '#e9c46a'][i % 6];
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#ffffff';
    c.lineWidth = 4;
    c.stroke();
    c.fillStyle = i === 1 ? '#222222' : '#ffffff';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const lines = text.split(' ');
    lines.forEach((l, k) => {
      fitFont(c, l, r * 1.6, { weight: 800, size: 16 });
      c.fillText(l, cx, cy + (k - (lines.length - 1) / 2) * 17);
    });
  }
  c.restore();
}

function drawStikerPintu(c, [x, y, w, h]) {
  c.save();
  c.fillStyle = '#ffffff';
  roundRect(c, x + 6, y + 6, w - 12, h - 12, 12);
  c.fill();
  c.strokeStyle = ORGANISASI.warna;
  c.lineWidth = 5;
  c.stroke();
  c.fillStyle = ORGANISASI.warna;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  fitFont(c, 'HARAP KETUK PINTU', w - 30, { weight: 800, size: 22 });
  c.fillText('HARAP KETUK PINTU', x + w / 2, y + h * 0.36);
  c.fillStyle = '#333333';
  fitFont(c, 'LEPAS ALAS KAKI', w - 30, { weight: 700, size: 18 });
  c.fillText('LEPAS ALAS KAKI', x + w / 2, y + h * 0.6);
  c.font = `14px ${HAND}`;
  c.fillStyle = BIRU_SPIDOL;
  c.fillText('makasih :)', x + w / 2, y + h * 0.8);
  c.restore();
}

function drawNoda(c, [x, y, w, h]) {
  c.save();
  const cx = x + w / 2;
  const cy = y + h / 2;
  for (let k = 0; k < 4; k += 1) { // cincin noda rembesan atap
    const r = (w / 2) * (1 - k * 0.2);
    const g = c.createRadialGradient(cx, cy, r * 0.6, cx, cy, r);
    g.addColorStop(0, 'rgba(150,120,70,0)');
    g.addColorStop(0.85, `rgba(150,120,70,${0.18 + k * 0.04})`);
    g.addColorStop(1, 'rgba(150,120,70,0)');
    c.fillStyle = g;
    c.fillRect(x, y, w, h);
  }
  c.restore();
}

/** Lambang disederhanakan: segi lima hijau lumut + perahu layar kuning emas (riset §6), BUKAN reproduksi resmi. */
function drawLambangSederhana(c, cx, cy, r) {
  c.fillStyle = '#4b6b2a';
  c.beginPath();
  for (let i = 0; i < 5; i += 1) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  c.closePath();
  c.fill();
  c.strokeStyle = '#e8c547';
  c.lineWidth = r * 0.08;
  c.stroke();
  c.fillStyle = '#e8c547';
  c.beginPath();
  c.moveTo(cx - r * 0.55, cy + r * 0.2);
  c.quadraticCurveTo(cx, cy + r * 0.55, cx + r * 0.55, cy + r * 0.2);
  c.closePath();
  c.fill();
  c.fillRect(cx - r * 0.03, cy - r * 0.5, r * 0.06, r * 0.7);
  c.beginPath();
  c.moveTo(cx + r * 0.03, cy - r * 0.45);
  c.lineTo(cx + r * 0.4, cy + r * 0.1);
  c.lineTo(cx + r * 0.03, cy + r * 0.1);
  c.closePath();
  c.fill();
}

function drawBendera(c) {
  const [ox, oy, ow, oh] = ATLAS.benderaOrganisasi;
  c.fillStyle = ORGANISASI.warna;
  c.fillRect(ox, oy, ow, oh);
  c.fillStyle = '#ffffff';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  fitFont(c, ORGANISASI.singkatan, ow - 30, { weight: 900, size: 48 });
  c.fillText(ORGANISASI.singkatan, ox + ow / 2, oy + oh / 2);
  const [ux, uy, uw, uh] = ATLAS.benderaUnri; // warna dasar biru langit = [INFERENSI]
  c.fillStyle = '#6fbfe8';
  c.fillRect(ux, uy, uw, uh);
  drawLambangSederhana(c, ux + uw / 2, uy + uh * 0.42, uh * 0.3);
  c.fillStyle = '#123a5c';
  fitFont(c, 'UNIVERSITAS RIAU', uw - 20, { weight: 800, size: 16 });
  c.fillText('UNIVERSITAS RIAU', ux + uw / 2, uy + uh * 0.86);
  const [mx, my, mw, mh] = ATLAS.benderaMerahPutih;
  c.fillStyle = '#ce1126';
  c.fillRect(mx, my, mw, mh / 2);
  c.fillStyle = '#ffffff';
  c.fillRect(mx, my + mh / 2, mw, mh / 2);
}

/** Atlas 1024² semua cetakan kecil. */
export function drawAtlas(c, w, h) {
  const rnd = makeRng(17);
  c.clearRect(0, 0, w, h);
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, w, h);
  drawKalender(c, ATLAS.kalender);
  drawPiket(c, ATLAS.piket);
  PIAGAM.forEach((pg, i) => drawPiagam(c, ATLAS.piagam[i], pg));
  POSTER.forEach((ps, i) => drawPoster(c, ATLAS.poster[i], ps, rnd));
  ordnerSlots().forEach((o, i) => drawOrdnerLabel(c, ATLAS.ordner[i], o.label));
  STIKER.forEach((s, i) => drawStiker(c, ATLAS.stiker[i], s, i));
  drawStikerPintu(c, ATLAS.stikerPintu);
  drawBendera(c);
}

// ---------- Mesh ----------

/** Bidang dinding: rotasi y = hadap (normal +Z menghadap arah hadap). */
function wallPlane(geo, mat, it, offset = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(it.x + Math.sin(it.hadap) * offset, it.y, it.z + Math.cos(it.hadap) * offset);
  m.rotation.y = it.hadap;
  m.receiveShadow = true;
  return m;
}

/**
 * Bingkai persegi (4 batang) di bidang XY lokal, menghadap `hadap`. Batang = Mesh terpisah dengan material
 * bersama; semuanya tergabung per material oleh mergeStatic (index.js), jadi tidak menambah draw call.
 */
function frameMesh(w, h, depth, bar, color, mat, it) {
  const g = new THREE.Group();
  for (const [bw, bh, x, y] of [[w, bar, 0, h / 2 - bar / 2], [w, bar, 0, -h / 2 + bar / 2], [bar, h, -w / 2 + bar / 2, 0], [bar, h, w / 2 - bar / 2, 0]]) {
    const m = new THREE.Mesh(tint(new THREE.BoxGeometry(bw, bh, depth).translate(x, y, 0), color), mat);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  }
  g.position.set(it.x, it.y, it.z);
  g.rotation.y = it.hadap;
  return g;
}

/**
 * @param {{renderer?: THREE.WebGLRenderer|null, materials: {prop: THREE.Material, metal: THREE.Material}}} opts
 * @returns {{group: THREE.Group, redrawWhenFontsReady(isCancelled: () => boolean): Promise<void>}}
 */
export function buildBoards({ renderer = null, materials }) {
  const group = new THREE.Group();
  group.name = 'sekre-papan';
  const surfaces = [];
  const surface = (w, h, draw) => {
    const canvas = makeCanvas(w, h);
    draw(canvas.getContext('2d'), w, h);
    const tex = canvasTexture(canvas, renderer);
    surfaces.push({ canvas, tex, draw, w, h });
    return tex;
  };
  const board = (map, roughness) => new THREE.MeshStandardMaterial({ map, roughness });
  const strukturMat = board(surface(1024, 683, drawStruktur), 0.85);
  const prokerMat = board(surface(1024, 683, drawProker), 0.95);
  const wbMat = board(surface(1024, 768, drawWhiteboard), 0.35);
  const atlasMat = new THREE.MeshStandardMaterial({
    map: surface(ATLAS_SIZE, ATLAS_SIZE, drawAtlas), roughness: 0.8, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });

  const S01 = ASET.S01.items[0];
  group.add(frameMesh(1.84, 1.24, 0.03, 0.025, '#b0b7bd', materials.metal, S01));
  group.add(wallPlane(new THREE.PlaneGeometry(1.8, 1.2), strukturMat, S01, 0.016));
  const S02 = ASET.S02.items[0];
  group.add(frameMesh(1.54, 1.04, 0.035, 0.03, '#8d6e63', materials.prop, S02));
  group.add(wallPlane(new THREE.PlaneGeometry(1.5, 1.0), prokerMat, S02, 0.016));
  const S03 = ASET.S03.items[0];
  group.add(frameMesh(1.24, 0.94, 0.05, 0.025, '#c9ccd0', materials.metal, S03));
  group.add(wallPlane(new THREE.PlaneGeometry(1.2, 0.9), wbMat, S03, 0.02));
  const tray = new THREE.Group(); // baki spidol + 2 spidol + penghapus
  tray.position.set(S03.x, S03.y - 0.47, S03.z);
  tray.rotation.y = S03.hadap;
  for (const g of [
    tint(new THREE.BoxGeometry(1.0, 0.015, 0.06).translate(0, 0, 0.04), '#c9ccd0'),
    tint(new THREE.CylinderGeometry(0.009, 0.009, 0.13, 8).rotateZ(Math.PI / 2).translate(-0.2, 0.017, 0.05), '#1565c0'),
    tint(new THREE.CylinderGeometry(0.009, 0.009, 0.13, 8).rotateZ(Math.PI / 2).translate(-0.04, 0.017, 0.05), '#c62828'),
    tint(new THREE.BoxGeometry(0.13, 0.03, 0.05).translate(0.25, 0.022, 0.045), '#37474f'),
  ]) tray.add(new THREE.Mesh(g, materials.prop));
  group.add(tray);

  const atlasMesh = (w, h, rect, it, offset = 0) => group.add(wallPlane(atlasPlane(w, h, rect), atlasMat, it, offset));
  atlasMesh(0.4, 0.6, ATLAS.kalender, ASET.S04.items[0]);
  atlasMesh(0.3, 0.42, ATLAS.piket, ASET.S05.items[0]);
  ASET.S06.items.forEach((it, i) => {
    group.add(frameMesh(0.4, 0.3, 0.02, 0.025, '#4e342e', materials.prop, it));
    atlasMesh(0.35, 0.26, ATLAS.piagam[i], it, 0.011);
  });
  ASET.S26.items.forEach((it) => atlasMesh(0.42, 0.6, ATLAS.poster[it.poster], it));
  ASET.S28.items.forEach((it) => atlasMesh(0.1, 0.1, ATLAS.stiker[it.stiker], it));
  ordnerSlots().forEach((o, i) => {
    const label = new THREE.Mesh(atlasPlane(0.05, 0.1, ATLAS.ordner[i]), atlasMat);
    label.position.set(o.x, o.y + 0.2, o.z - 0.152);
    label.rotation.set(0, Math.PI, -o.miring);
    group.add(label);
  });
  const nodaCanvas = makeCanvas(256, 256); // noda bocor di plafon: tekstur transparan sendiri (+1 draw call)
  drawNoda(nodaCanvas.getContext('2d'), [0, 0, 256, 256]);
  const nodaMat = new THREE.MeshStandardMaterial({
    map: canvasTexture(nodaCanvas, renderer), transparent: true, depthWrite: false, roughness: 0.95,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  const noda = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), nodaMat);
  noda.position.set(0.9, ROOM.h - 0.004, 2.0);
  noda.rotation.x = Math.PI / 2;
  group.add(noda);
  const hinge = new THREE.Group(); // stiker di sisi dalam daun pintu (mengikuti engsel S30)
  hinge.position.set(DOOR.x0, 0, DOOR.z);
  hinge.rotation.y = DOOR.openRad;
  const doorSticker = new THREE.Mesh(atlasPlane(0.18, 0.18, ATLAS.stikerPintu), atlasMat);
  doorSticker.position.set(0.45, 1.5, 0.05); // di depan panel hias daun pintu (permukaan z 0,046)
  hinge.add(doorSticker);
  group.add(hinge);
  const S08 = ASET.S08.items[0]; // kain 3 bendera meja (tiang dibuat furniture.js)
  const stand = new THREE.Group();
  stand.position.set(S08.x, S08.y, S08.z);
  stand.rotation.y = S08.hadap + Math.PI;
  [ATLAS.benderaOrganisasi, ATLAS.benderaUnri, ATLAS.benderaMerahPutih].forEach((rect, i) => {
    const flag = new THREE.Mesh(atlasPlane(0.18, 0.12, rect), atlasMat);
    flag.position.set(-0.1 + i * 0.1 + 0.09, 0.52, 0);
    flag.rotation.y = Math.PI;
    stand.add(flag);
  });
  group.add(stand);

  return {
    group,
    /** Gambar ulang semua kanvas setelah font web (Inter) & tulisan tangan siap. */
    async redrawWhenFontsReady(isCancelled = () => false) {
      if (typeof document === 'undefined' || !document.fonts?.load) return;
      try {
        await Promise.all([document.fonts.load(`800 32px "Inter Variable"`), document.fonts.load(`400 24px "Segoe Print"`)]);
      } catch {
        return; // font cadangan sudah dipakai saat build
      }
      if (isCancelled()) return;
      for (const s of surfaces) {
        s.draw(s.canvas.getContext('2d'), s.w, s.h);
        s.tex.needsUpdate = true;
      }
    },
  };
}
