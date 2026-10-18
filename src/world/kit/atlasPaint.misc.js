/**
 * Pelukis sel atlas: benda kecil (tandon, etalase, tempat wudu, rak sandal, bendera, tangga), sel potong
 * alami (besi tulangan, ilalang, jemuran almamater, tanaman pot) dan fasad LOD1 (satu bay dilukis datar).
 * GLOW_RECTS: area menyala per sel (pecahan 0..1 dari sel, koordinat canvas atas→bawah) untuk peta emisif.
 */
import { blotches, mottle, rgba, speckle, streaks } from './atlasPaint.surfaces.js';

const BIRU_LANGIT = [126, 182, 224]; // almamater UNRI "biru langit" [T]

/** Persegi dalam pecahan sel. */
const fr = (ctx, w, h, [x, y, rw, rh], color) => {
  ctx.fillStyle = color;
  ctx.fillRect(x * w, y * h, rw * w, rh * h);
};

function gelap(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, rgba(20, 22, 24));
  g.addColorStop(1, rgba(40, 42, 44));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function besi(ctx, w, h, rnd) {
  mottle(ctx, w, h, rnd, [86, 92, 96], 0.05, 4);
  streaks(ctx, w, h, rnd, 6, [140, 80, 40], 0.3);
}

function kayuTiang(ctx, w, h, rnd) {
  mottle(ctx, w, h, rnd, [132, 88, 54], 0.06, 4);
  ctx.strokeStyle = rgba(80, 52, 30, 0.4);
  for (let i = 0; i < 10; i += 1) {
    const x = rnd.next() * w;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x + 6, h * 0.3, x - 6, h * 0.7, x + 3, h);
    ctx.stroke();
  }
}

function tandon(ctx, w, h) {
  for (let y = 0; y < h; y += 16) {
    const g = ctx.createLinearGradient(0, y, 0, y + 16);
    g.addColorStop(0, rgba(232, 140, 60));
    g.addColorStop(0.5, rgba(214, 118, 44));
    g.addColorStop(1, rgba(170, 90, 30));
    ctx.fillStyle = g;
    ctx.fillRect(0, y, w, 16);
  }
}

function lisplang(ctx, w, h, rnd) {
  mottle(ctx, w, h, rnd, [246, 245, 240], 0.01, 8);
  const g = ctx.createLinearGradient(0, h * 0.6, 0, h);
  g.addColorStop(0, rgba(90, 86, 80, 0));
  g.addColorStop(1, rgba(90, 86, 80, 0.35));
  ctx.fillStyle = g;
  ctx.fillRect(0, h * 0.6, w, h * 0.4);
}

function talang(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, rgba(210, 214, 216));
  g.addColorStop(0.5, rgba(150, 156, 160));
  g.addColorStop(1, rgba(110, 114, 118));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function papanKosong(ctx, w, h) {
  ctx.fillStyle = rgba(22, 22, 24);
  ctx.fillRect(0, 0, w, h);
}

/** Spanduk menu kantin: blok warna + baris "teks" semu (tanpa kata — isi menu asli tidak diketahui). */
function spandukMenu(ctx, w, h, rnd) {
  ctx.fillStyle = rgba(246, 206, 60);
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = rgba(200, 40, 40);
  ctx.fillRect(0, 0, w, h * 0.3);
  ctx.fillStyle = rgba(40, 40, 40);
  for (let i = 0; i < 4; i += 1) ctx.fillRect(w * 0.3 + i * w * 0.16, h * 0.42, w * 0.12, h * 0.12);
  for (let i = 0; i < 4; i += 1) ctx.fillRect(w * 0.3 + i * w * 0.16, h * 0.66, w * 0.08 + rnd.next() * w * 0.05, h * 0.1);
  ctx.fillStyle = rgba(255, 255, 255);
  ctx.beginPath();
  ctx.arc(w * 0.14, h * 0.62, h * 0.26, 0, Math.PI * 2);
  ctx.fill();
}

function etalase(ctx, w, h, rnd) {
  ctx.fillStyle = rgba(200, 204, 208);
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = rgba(70, 80, 88);
  ctx.fillRect(6, 6, w - 12, h * 0.62);
  const dishes = [[200, 120, 40], [240, 220, 160], [120, 160, 70], [180, 60, 40], [230, 200, 90]];
  for (let s = 0; s < 2; s += 1) {
    for (let i = 0; i < 6; i += 1) {
      ctx.fillStyle = rgba(...rnd.pick(dishes));
      ctx.beginPath();
      ctx.ellipse(20 + i * (w - 40) / 5, 26 + s * h * 0.28, 14, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = rgba(255, 255, 255, 0.3);
  ctx.fillRect(6, 6, w - 12, 8);
  ctx.fillStyle = rgba(150, 110, 70);
  ctx.fillRect(0, h * 0.68, w, h * 0.32);
}

function tempatWudu(ctx, w, h, rnd) {
  mottle(ctx, w, h, rnd, [210, 226, 232], 0.02, 16);
  ctx.fillStyle = rgba(150, 165, 170, 0.8);
  for (let y = 0; y < h; y += 16) ctx.fillRect(0, y, w, 1);
  for (let x = 0; x < w; x += 16) ctx.fillRect(x, 0, 1, h);
  for (let i = 0; i < 6; i += 1) {
    const x = (i + 0.5) * (w / 6);
    ctx.fillStyle = rgba(200, 204, 208);
    ctx.fillRect(x - 3, h * 0.35, 6, 14);
    ctx.fillRect(x - 3, h * 0.35 + 10, 12, 4);
  }
  ctx.fillStyle = rgba(90, 96, 100);
  ctx.fillRect(0, h * 0.86, w, h * 0.14);
}

function rakSandal(ctx, w, h, rnd) {
  ctx.fillStyle = rgba(110, 78, 50);
  ctx.fillRect(0, 0, w, h);
  const colors = [[30, 30, 30], [40, 80, 160], [200, 60, 60], [230, 200, 60], [90, 90, 90], [240, 240, 240]];
  for (let s = 0; s < 3; s += 1) {
    const y = 6 + s * (h / 3);
    ctx.fillStyle = rgba(150, 110, 70);
    ctx.fillRect(0, y + h / 3 - 10, w, 4);
    for (let x = 6; x < w - 20; x += 22) {
      if (rnd.chance(0.25)) continue;
      ctx.fillStyle = rgba(...rnd.pick(colors));
      ctx.fillRect(x, y + h / 3 - 18, 18, 8);
    }
  }
}

function mejaBangku(ctx, w, h, rnd) {
  for (let y = 0; y < h; y += 16) {
    const k = 0.85 + rnd.next() * 0.25;
    ctx.fillStyle = rgba(170 * k, 120 * k, 76 * k);
    ctx.fillRect(0, y, w, 15);
  }
  speckle(ctx, w, h, rnd, 120, [60, 40, 20], 0.3, 1.5);
}

function bendera(ctx, w, h) {
  ctx.fillStyle = rgba(206, 17, 38);
  ctx.fillRect(0, 0, w, h / 2);
  ctx.fillStyle = rgba(250, 250, 250);
  ctx.fillRect(0, h / 2, w, h / 2);
}

function potTanah(ctx, w, h, rnd) {
  mottle(ctx, w, h, rnd, [178, 96, 60], 0.06, 4);
  ctx.fillStyle = rgba(150, 78, 48);
  ctx.fillRect(0, 0, w, h * 0.16);
}

function tangga(ctx, w, h, rnd) {
  mottle(ctx, w, h, rnd, [210, 206, 198], 0.03, 4);
  for (let y = 0; y < h; y += 32) {
    ctx.fillStyle = rgba(120, 116, 108, 0.6);
    ctx.fillRect(0, y, w, 3);
  }
}

function besiTulangan(ctx, w, h, rnd) {
  ctx.clearRect(0, 0, w, h);
  for (let i = 0; i < 4; i += 1) {
    const x = w * (0.2 + i * 0.2);
    ctx.strokeStyle = rgba(130 + rnd.next() * 30, 70, 36);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x, h);
    ctx.lineTo(x + (rnd.next() - 0.5) * 6, h * 0.2);
    ctx.quadraticCurveTo(x + 4, h * 0.05, x + 18 * (rnd.chance(0.5) ? 1 : -1), h * 0.08 + rnd.next() * 10);
    ctx.stroke();
  }
}

/** Rumpun rumput tinggi; `plume` = malai alang-alang putih. */
function grass(ctx, w, h, rnd, blades, plume) {
  ctx.clearRect(0, 0, w, h);
  for (let i = 0; i < blades; i += 1) {
    const x = w * (0.1 + rnd.next() * 0.8);
    const top = h * (0.05 + rnd.next() * 0.45);
    const lean = (rnd.next() - 0.5) * w * 0.4;
    const k = 0.75 + rnd.next() * 0.4;
    ctx.strokeStyle = rgba(110 * k, 150 * k, 60 * k);
    ctx.lineWidth = 2 + rnd.next() * 2;
    ctx.beginPath();
    ctx.moveTo(x, h);
    ctx.quadraticCurveTo(x + lean * 0.3, (h + top) / 2, x + lean, top);
    ctx.stroke();
    if (plume && rnd.chance(0.35)) {
      ctx.fillStyle = rgba(236, 232, 214, 0.95);
      ctx.beginPath();
      ctx.ellipse(x + lean, top, 3, 10, lean / w, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Jemuran: tali + almamater biru langit, kaus, handuk (pola umum asrama/sekre [INF]). */
function jemuran(ctx, w, h, rnd) {
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = rgba(60, 60, 60);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 12);
  ctx.quadraticCurveTo(w / 2, 22, w, 12);
  ctx.stroke();
  const clothes = [BIRU_LANGIT, BIRU_LANGIT, [240, 240, 236], [40, 40, 44], [200, 60, 60], [230, 200, 80], [90, 140, 90]];
  let x = 6;
  while (x < w - 30) {
    const cw = 30 + rnd.next() * 30;
    const ch = 60 + rnd.next() * 90;
    const c = rnd.pick(clothes);
    ctx.fillStyle = rgba(...c);
    ctx.fillRect(x, 16, cw, ch);
    if (c === BIRU_LANGIT) { // lengan jaket
      ctx.fillRect(x - 6, 18, 6, ch * 0.7);
      ctx.fillRect(x + cw, 18, 6, ch * 0.7);
      ctx.fillStyle = rgba(30, 50, 90);
      ctx.fillRect(x + cw / 2 - 1, 18, 2, ch);
    }
    ctx.fillStyle = rgba(0, 0, 0, 0.12);
    ctx.fillRect(x, 16, cw, 6);
    x += cw + 8 + rnd.next() * 10;
  }
}

function tanamanPot(ctx, w, h, rnd) {
  ctx.clearRect(0, 0, w, h);
  for (let i = 0; i < 26; i += 1) {
    const a = -Math.PI / 2 + (rnd.next() - 0.5) * 2.4;
    const len = h * (0.3 + rnd.next() * 0.45);
    const k = 0.7 + rnd.next() * 0.4;
    ctx.fillStyle = rgba(60 * k, 120 * k, 50 * k);
    ctx.save();
    ctx.translate(w / 2, h * 0.95);
    ctx.rotate(a + Math.PI / 2);
    ctx.beginPath();
    ctx.ellipse(0, -len / 2, 8 + rnd.next() * 8, len / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ── Fasad LOD1: satu bay satu lantai dilukis datar (dinding netral; diwarnai palet) ───────────────
const LOD1 = {
  kuliah: { win: [0.25, 0.3, 0.5, 0.42], roster: [0.25, 0.12, 0.5, 0.12] },
  adb: { screen: [0, 0.04, 1, 0.78] },
  lab: { win: [0.2, 0.36, 0.6, 0.34], clere: [0.1, 0.06, 0.8, 0.12] },
  rusun: { door: [0.08, 0.22, 0.24, 0.62], win: [0.48, 0.32, 0.36, 0.3], rail: [0, 0.6, 1, 0.26] },
  polos: { win: [0.36, 0.34, 0.28, 0.3] },
  aula: { win: [0.3, 0.22, 0.4, 0.36], vent: [0.1, 0.05, 0.8, 0.08] },
  jalusi: { jal: [0.22, 0.3, 0.56, 0.42] },
};

function lod1Base(ctx, w, h, rnd) {
  mottle(ctx, w, h, rnd, [240, 237, 230], 0.015, 16);
  fr(ctx, w, h, [0, 0.88, 1, 0.12], rgba(150, 150, 148)); // plint
  fr(ctx, w, h, [0, 0, 1, 0.03], rgba(200, 196, 188)); // balok lantai
  fr(ctx, w, h, [0, 0, 0.04, 1], rgba(226, 222, 214)); // kolom
}

function lod1Window(ctx, w, h, rect, lit) {
  fr(ctx, w, h, rect, lit ? rgba(240, 220, 170) : rgba(52, 60, 68));
  ctx.fillStyle = rgba(200, 214, 224, lit ? 0.25 : 0.45);
  const [x, y, rw, rh] = rect;
  for (let k = 0; k < 8; k += 1) ctx.fillRect(x * w, (y + (k / 8) * rh) * h, rw * w, 2);
  ctx.fillStyle = rgba(190, 194, 198);
  ctx.fillRect((x + rw / 2) * w - 2, y * h, 4, rh * h);
}

function lod1(kind, lit) {
  const spec = LOD1[kind];
  return (ctx, w, h, rnd) => {
    lod1Base(ctx, w, h, rnd);
    if (spec.roster) fr(ctx, w, h, spec.roster, rgba(150, 146, 138));
    if (spec.win) lod1Window(ctx, w, h, spec.win, lit);
    if (spec.clere) lod1Window(ctx, w, h, spec.clere, false);
    if (spec.vent) fr(ctx, w, h, spec.vent, rgba(120, 124, 128));
    if (spec.jal) {
      fr(ctx, w, h, spec.jal, rgba(122, 82, 50));
      for (let k = 0; k < 10; k += 1) fr(ctx, w, h, [spec.jal[0], spec.jal[1] + (k / 10) * spec.jal[3], spec.jal[2], 0.012], rgba(70, 46, 28));
    }
    if (spec.door) fr(ctx, w, h, spec.door, rgba(120, 82, 52));
    if (spec.rail) {
      for (let k = 0; k < 16; k += 1) fr(ctx, w, h, [k / 16, spec.rail[1], 0.012, spec.rail[3]], rgba(64, 74, 70));
      fr(ctx, w, h, [0, spec.rail[1], 1, 0.02], rgba(64, 74, 70));
    }
    if (spec.screen) {
      fr(ctx, w, h, spec.screen, rgba(196, 96, 47));
      ctx.fillStyle = rgba(120, 60, 30, lit ? 0.35 : 0.6);
      for (let y = 0; y < h * 0.8; y += 10) for (let x = (y / 10) % 2 ? 5 : 0; x < w; x += 10) ctx.fillRect(x, h * 0.04 + y, 4, 4);
    }
  };
}

function lod1Mangkrak(ctx, w, h, rnd) {
  mottle(ctx, w, h, rnd, [176, 172, 164], 0.05, 8);
  fr(ctx, w, h, [0.08, 0.06, 0.84, 0.8], rgba(40, 42, 44));
  blotches(ctx, w, h, rnd, 6, [110, 106, 98], 0.3, 10, 30);
  streaks(ctx, w, h, rnd, 6, [140, 80, 40], 0.3);
}

function lod1Kantin(ctx, w, h, rnd) {
  mottle(ctx, w, h, rnd, [230, 226, 218], 0.02, 16);
  fr(ctx, w, h, [0.06, 0.12, 0.88, 0.88], rgba(70, 64, 58));
  fr(ctx, w, h, [0.06, 0.66, 0.88, 0.08], rgba(150, 110, 70));
}

export const GLOW_RECTS = Object.freeze({
  'nako-nyala': [[0.06, 0.06, 0.88, 0.88]],
  'kaca-biru-nyala': [[0.04, 0.36, 0.92, 0.6]],
  lampu: [[0.08, 0.4, 0.84, 0.2]],
  'lod1-kuliah-nyala': [LOD1.kuliah.win],
  'lod1-adb-nyala': [[0.12, 0.24, 0.76, 0.06], [0.12, 0.5, 0.76, 0.06]],
  'lod1-rusun-nyala': [LOD1.rusun.win],
});

export const MISC_PAINTERS = Object.freeze({
  gelap,
  besi,
  'kayu-tiang': kayuTiang,
  tandon,
  lisplang,
  talang,
  'papan-kosong': papanKosong,
  'spanduk-menu': spandukMenu,
  etalase,
  'tempat-wudu': tempatWudu,
  'rak-sandal': rakSandal,
  'meja-bangku': mejaBangku,
  bendera,
  'pot-tanah': potTanah,
  tangga,
  'besi-tulangan': besiTulangan,
  'ilalang-kecil': (ctx, w, h, rnd) => grass(ctx, w, h, rnd, 26, false),
  ilalang: (ctx, w, h, rnd) => grass(ctx, w, h, rnd, 70, true),
  jemuran,
  'tanaman-pot': tanamanPot,
  'lod1-kuliah': lod1('kuliah', false),
  'lod1-kuliah-nyala': lod1('kuliah', true),
  'lod1-adb': lod1('adb', false),
  'lod1-adb-nyala': lod1('adb', true),
  'lod1-lab': lod1('lab', false),
  'lod1-rusun': lod1('rusun', false),
  'lod1-rusun-nyala': lod1('rusun', true),
  'lod1-mangkrak': lod1Mangkrak,
  'lod1-polos': lod1('polos', false),
  'lod1-kantin': lod1Kantin,
  'lod1-aula': lod1('aula', false),
  'lod1-jalusi': lod1('jalusi', false),
});
