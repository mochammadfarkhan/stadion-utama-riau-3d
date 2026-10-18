/**
 * Pelukis sel atlas: permukaan dinding, atap, lantai (canvas 2D). Setiap pelukis `(ctx, w, h, rnd)` menggambar
 * di (0,0)–(w,h) yang sudah ditranslasi & diklip ke sel; `rnd` = createRandom(seed sel). Sel bertanda tint
 * digambar netral terang (warna palet dari warna vertex). Skala acuan: 256 px ≈ satu bay 3,6 m.
 */

/** Warna CSS dari rgb/alpha. */
export const rgba = (r, g, b, a = 1) => `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;

/** Isi rata + variasi halus per blok 8 px (tekstur plester/beton). */
export function mottle(ctx, w, h, rnd, base, amp, block = 8) {
  for (let y = 0; y < h; y += block) {
    for (let x = 0; x < w; x += block) {
      const k = 1 + (rnd.next() * 2 - 1) * amp;
      ctx.fillStyle = rgba(base[0] * k, base[1] * k, base[2] * k);
      ctx.fillRect(x, y, block, block);
    }
  }
}

/** Bercak lembut acak (lingkaran gradasi). */
export function blotches(ctx, w, h, rnd, n, color, alpha, rMin, rMax) {
  for (let i = 0; i < n; i += 1) {
    const x = rnd.next() * w;
    const y = rnd.next() * h;
    const r = rMin + rnd.next() * (rMax - rMin);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(...color, alpha));
    g.addColorStop(1, rgba(...color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

/** Bintik kecil (pori/debu). */
export function speckle(ctx, w, h, rnd, n, color, alpha, size = 1.5) {
  ctx.fillStyle = rgba(...color, alpha);
  for (let i = 0; i < n; i += 1) ctx.fillRect(rnd.next() * w, rnd.next() * h, size, size);
}

/** Lelehan air hujan vertikal dari atas (noda kusam di bawah ambang/atap). */
export function streaks(ctx, w, h, rnd, n, color, alpha, maxLen = 0.6) {
  for (let i = 0; i < n; i += 1) {
    const x = rnd.next() * w;
    const y0 = rnd.next() * h * 0.3;
    const len = h * (0.15 + rnd.next() * maxLen);
    const g = ctx.createLinearGradient(0, y0, 0, y0 + len);
    g.addColorStop(0, rgba(...color, alpha));
    g.addColorStop(1, rgba(...color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x, y0, 1 + rnd.next() * 3, len);
  }
}

/** Garis retak tipis acak berliku. */
export function crack(ctx, x, y, len, rnd, color = [70, 66, 60], alpha = 0.45) {
  ctx.strokeStyle = rgba(...color, alpha);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  let cx = x;
  let cy = y;
  for (let i = 0; i < 8; i += 1) {
    cx += (rnd.next() - 0.5) * len * 0.3;
    cy += len / 8;
    ctx.lineTo(cx, cy);
  }
  ctx.stroke();
}

/** Grid nat (ubin) dengan garis gelap & sorot terang. */
export function grout(ctx, w, h, cw, ch, color, alpha, width = 2, offsetRows = false) {
  ctx.fillStyle = rgba(...color, alpha);
  for (let y = 0; y <= h; y += ch) ctx.fillRect(0, y - width / 2, w, width);
  for (let y = 0, row = 0; y < h; y += ch, row += 1) {
    const off = offsetRows && row % 2 ? cw / 2 : 0;
    for (let x = -off; x <= w; x += cw) ctx.fillRect(x - width / 2, y, width, ch);
  }
}

const PLASTER = [244, 241, 234];

function plester(ctx, w, h, rnd) {
  mottle(ctx, w, h, rnd, PLASTER, 0.012);
  blotches(ctx, w, h, rnd, 14, [205, 200, 188], 0.08, 20, 60);
  speckle(ctx, w, h, rnd, 500, [150, 145, 135], 0.25, 1);
  const g = ctx.createLinearGradient(0, h * 0.86, 0, h);
  g.addColorStop(0, rgba(120, 110, 95, 0));
  g.addColorStop(1, rgba(120, 110, 95, 0.18));
  ctx.fillStyle = g;
  ctx.fillRect(0, h * 0.86, w, h * 0.14);
}

function plesterKusam(ctx, w, h, rnd) {
  plester(ctx, w, h, rnd);
  streaks(ctx, w, h, rnd, 22, [95, 92, 84], 0.22);
  blotches(ctx, w, h * 0.25, rnd, 6, [72, 86, 60], 0.18, 10, 30); // lumut di bawah talang
  ctx.save();
  ctx.translate(0, h * 0.78);
  blotches(ctx, w, h * 0.22, rnd, 10, [62, 74, 52], 0.22, 10, 26); // lumut cipratan tanah
  ctx.restore();
  crack(ctx, w * (0.2 + rnd.next() * 0.6), h * 0.1, h * 0.5, rnd);
}

function beton(ctx, w, h, rnd) {
  mottle(ctx, w, h, rnd, [222, 220, 214], 0.02, 4);
  for (let y = 32; y < h; y += 32) {
    ctx.fillStyle = rgba(150, 146, 138, 0.35);
    ctx.fillRect(0, y, w, 1);
    ctx.fillStyle = rgba(255, 255, 255, 0.25);
    ctx.fillRect(0, y + 1, w, 1);
  }
  speckle(ctx, w, h, rnd, 700, [120, 116, 108], 0.35, 1.2);
  blotches(ctx, w, h, rnd, 8, [170, 166, 156], 0.12, 15, 45);
}

function betonMentah(ctx, w, h, rnd) {
  mottle(ctx, w, h, rnd, [190, 186, 177], 0.05, 4);
  blotches(ctx, w, h, rnd, 18, [120, 116, 106], 0.25, 8, 40);
  for (let i = 0; i < 5; i += 1) { // keropos (honeycomb)
    const x = rnd.next() * w;
    const y = rnd.next() * h;
    ctx.fillStyle = rgba(70, 66, 60, 0.55);
    for (let k = 0; k < 40; k += 1) ctx.fillRect(x + (rnd.next() - 0.5) * 22, y + (rnd.next() - 0.5) * 14, 2, 2);
  }
  streaks(ctx, w, h, rnd, 10, [140, 80, 40], 0.3, 0.5); // karat besi
  for (let y = 40; y < h; y += 40) {
    ctx.fillStyle = rgba(110, 106, 98, 0.4);
    ctx.fillRect(0, y, w, 1);
  }
}

function betonCoret(ctx, w, h, rnd) {
  betonMentah(ctx, w, h, rnd);
  const colors = [[220, 40, 50], [30, 30, 30], [40, 90, 200], [240, 200, 30], [255, 255, 255]];
  for (let i = 0; i < 6; i += 1) {
    ctx.strokeStyle = rgba(...rnd.pick(colors), 0.85);
    ctx.lineWidth = 3 + rnd.next() * 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    let x = rnd.next() * w * 0.8 + w * 0.1;
    let y = h * (0.35 + rnd.next() * 0.45);
    ctx.moveTo(x, y);
    for (let k = 0; k < 5; k += 1) {
      const nx = x + (rnd.next() - 0.3) * 50;
      const ny = y + (rnd.next() - 0.5) * 40;
      ctx.quadraticCurveTo(x + (rnd.next() - 0.5) * 60, y + (rnd.next() - 0.5) * 60, nx, ny);
      x = nx;
      y = ny;
    }
    ctx.stroke();
  }
}

function bataMerah(ctx, w, h, rnd) {
  ctx.fillStyle = rgba(150, 142, 130);
  ctx.fillRect(0, 0, w, h);
  const bw = 48;
  const bh = 16;
  for (let y = 0, row = 0; y < h; y += bh, row += 1) {
    for (let x = row % 2 ? -bw / 2 : 0; x < w; x += bw) {
      const k = 0.85 + rnd.next() * 0.3;
      ctx.fillStyle = rgba(168 * k, 78 * k, 52 * k);
      ctx.fillRect(x + 2, y + 2, bw - 3, bh - 3);
    }
  }
  speckle(ctx, w, h, rnd, 400, [60, 30, 20], 0.3, 1.5);
}

function keramikDinding(ctx, w, h, rnd) {
  mottle(ctx, w, h, rnd, [246, 246, 243], 0.01, 32);
  grout(ctx, w, h, 32, 32, [170, 172, 170], 0.9, 2);
  ctx.fillStyle = rgba(255, 255, 255, 0.35);
  for (let y = 0; y < h; y += 32) for (let x = 0; x < w; x += 32) ctx.fillRect(x + 4, y + 4, 10, 2);
}

function kayuPapan(ctx, w, h, rnd) {
  for (let x = 0; x < w; x += 32) {
    const k = 0.85 + rnd.next() * 0.25;
    ctx.fillStyle = rgba(214 * k, 196 * k, 170 * k);
    ctx.fillRect(x, 0, 32, h);
    ctx.strokeStyle = rgba(120, 95, 70, 0.25);
    for (let g = 0; g < 5; g += 1) {
      ctx.beginPath();
      const gx = x + 4 + rnd.next() * 24;
      ctx.moveTo(gx, 0);
      ctx.bezierCurveTo(gx + 4, h * 0.3, gx - 4, h * 0.6, gx + 2, h);
      ctx.stroke();
    }
    ctx.fillStyle = rgba(60, 45, 30, 0.7);
    ctx.fillRect(x, 0, 2, h);
  }
}

function seng(ctx, w, h, rnd, rust = false) {
  const ribs = 16;
  const rw = w / ribs;
  for (let x = 0; x < w; x += 1) {
    const ph = ((x % rw) / rw) * Math.PI * 2;
    const k = 0.82 + 0.18 * (0.5 + 0.5 * Math.cos(ph));
    ctx.fillStyle = rgba(226 * k, 230 * k, 233 * k);
    ctx.fillRect(x, 0, 1, h);
  }
  ctx.fillStyle = rgba(90, 96, 100, 0.35); // sambungan lembar
  ctx.fillRect(0, Math.round(h * 0.68), w, 2);
  for (let x = rw / 2; x < w; x += rw * 2) { // baris paku
    ctx.fillStyle = rgba(70, 72, 74, 0.6);
    ctx.fillRect(x - 1, h * 0.1, 2, 2);
    ctx.fillRect(x - 1, h * 0.66, 2, 2);
  }
  streaks(ctx, w, h, rnd, 12, [110, 112, 112], 0.14, 0.8);
  if (rust) { // karat halus: rembesan dari baris paku + tepi bawah lembar (bukan bercak acak)
    for (let x = rw / 2; x < w; x += rw * 2) {
      const g = ctx.createLinearGradient(0, h * 0.1, 0, h * 0.1 + h * (0.12 + rnd.next() * 0.2));
      g.addColorStop(0, rgba(150, 82, 38, 0.35));
      g.addColorStop(1, rgba(150, 82, 38, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - 2, h * 0.1, 4, h * 0.32);
    }
    const g = ctx.createLinearGradient(0, h * 0.82, 0, h);
    g.addColorStop(0, rgba(140, 78, 36, 0));
    g.addColorStop(1, rgba(140, 78, 36, 0.3));
    ctx.fillStyle = g;
    ctx.fillRect(0, h * 0.82, w, h * 0.18);
  }
}

function genteng(ctx, w, h, rnd) {
  ctx.fillStyle = rgba(150, 140, 132);
  ctx.fillRect(0, 0, w, h);
  const tw = 32;
  const th = 32;
  for (let y = 0, row = 0; y < h; y += th, row += 1) {
    for (let x = row % 2 ? -tw / 2 : 0; x < w; x += tw) {
      const k = 0.88 + rnd.next() * 0.2;
      const g = ctx.createLinearGradient(0, y, 0, y + th);
      g.addColorStop(0, rgba(205 * k, 200 * k, 194 * k));
      g.addColorStop(0.8, rgba(238 * k, 234 * k, 228 * k));
      g.addColorStop(1, rgba(150 * k, 144 * k, 138 * k));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x + 1, y);
      ctx.lineTo(x + tw - 1, y);
      ctx.lineTo(x + tw - 1, y + th - 6);
      ctx.quadraticCurveTo(x + tw / 2, y + th + 2, x + 1, y + th - 6);
      ctx.fill();
    }
  }
  blotches(ctx, w, h, rnd, 10, [60, 70, 50], 0.18, 10, 30);
}

function atapBeton(ctx, w, h, rnd) {
  mottle(ctx, w, h, rnd, [205, 203, 198], 0.03, 8);
  blotches(ctx, w, h, rnd, 12, [120, 118, 112], 0.2, 20, 70);
  blotches(ctx, w, h, rnd, 5, [70, 80, 60], 0.15, 10, 30);
  speckle(ctx, w, h, rnd, 500, [90, 88, 84], 0.3, 1.2);
}

function keramikLantai(ctx, w, h, rnd) {
  for (let y = 0; y < h; y += 64) {
    for (let x = 0; x < w; x += 64) {
      const k = 0.96 + rnd.next() * 0.06;
      ctx.fillStyle = rgba(236 * k, 228 * k, 210 * k);
      ctx.fillRect(x, y, 64, 64);
    }
  }
  speckle(ctx, w, h, rnd, 300, [170, 160, 140], 0.25, 1.5);
  grout(ctx, w, h, 64, 64, [150, 142, 128], 0.9, 2);
  blotches(ctx, w, h, rnd, 6, [150, 130, 100], 0.12, 20, 50); // bekas sandal/tanah
}

function rabat(ctx, w, h, rnd) {
  mottle(ctx, w, h, rnd, [214, 210, 202], 0.035, 4);
  speckle(ctx, w, h, rnd, 900, [110, 105, 98], 0.35, 1.5);
  for (let i = 0; i < 3; i += 1) crack(ctx, rnd.next() * w, 0, h, rnd, [80, 76, 70], 0.5);
}

function plafon(ctx, w, h, rnd) {
  mottle(ctx, w, h, rnd, [246, 245, 241], 0.01, 16);
  grout(ctx, w, h, 64, 128, [175, 172, 165], 0.8, 2);
  blotches(ctx, w, h, rnd, 3, [170, 140, 90], 0.18, 10, 30); // bekas bocor
}

function plint(ctx, w, h, rnd) {
  mottle(ctx, w, h, rnd, [196, 196, 194], 0.05, 4);
  speckle(ctx, w, h, rnd, 1200, [70, 70, 70], 0.4, 1.5);
  const g = ctx.createLinearGradient(0, h * 0.5, 0, h);
  g.addColorStop(0, rgba(120, 90, 60, 0));
  g.addColorStop(1, rgba(120, 90, 60, 0.4)); // cipratan tanah merah
  ctx.fillStyle = g;
  ctx.fillRect(0, h * 0.5, w, h * 0.5);
}

export const SURFACE_PAINTERS = Object.freeze({
  plester,
  'plester-kusam': plesterKusam,
  beton,
  'beton-mentah': betonMentah,
  'beton-coret': betonCoret,
  'bata-merah': bataMerah,
  'keramik-dinding': keramikDinding,
  'kayu-papan': kayuPapan,
  seng: (ctx, w, h, rnd) => seng(ctx, w, h, rnd, false),
  'seng-karat': (ctx, w, h, rnd) => seng(ctx, w, h, rnd, true),
  genteng,
  'atap-beton': atapBeton,
  'keramik-lantai': keramikLantai,
  rabat,
  plafon,
  plint,
});
