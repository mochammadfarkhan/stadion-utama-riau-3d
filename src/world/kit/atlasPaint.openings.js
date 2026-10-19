/**
 * Pelukis sel atlas: jendela (nako, jalusi, kaca biru), pintu, roster (5 pola), layar perforasi (3 motif),
 * railing, AC, exhaust, lampu TL. Sel potong memakai alfa (lubang = transparan, `destination-out`).
 */
import { blotches, rgba, speckle, streaks } from './atlasPaint.surfaces.js';

const ALU = [201, 205, 209];
const CURTAINS = [[150, 42, 52], [62, 92, 150], [222, 206, 172], [92, 132, 92], [196, 120, 60]];

function frame(ctx, x, y, w, h, t, color) {
  ctx.fillStyle = rgba(...color);
  ctx.fillRect(x, y, w, t);
  ctx.fillRect(x, y + h - t, w, t);
  ctx.fillRect(x, y, t, h);
  ctx.fillRect(x + w - t, y, t, h);
}

function interior(ctx, x, y, w, h, lit) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  if (lit) {
    g.addColorStop(0, rgba(246, 232, 196));
    g.addColorStop(1, rgba(226, 204, 160));
  } else {
    g.addColorStop(0, rgba(44, 50, 57));
    g.addColorStop(1, rgba(62, 68, 74));
  }
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

function curtain(ctx, x, y, w, h, rnd, lit) {
  const c = rnd.pick(CURTAINS);
  const cover = 0.4 + rnd.next() * 0.6;
  const cw = w * cover;
  const left = rnd.chance(0.5) ? x : x + w - cw;
  for (let i = 0; i < cw; i += 6) {
    const k = (lit ? 1.15 : 0.75) * (0.85 + 0.15 * Math.sin(i * 0.9));
    ctx.fillStyle = rgba(c[0] * k, c[1] * k, c[2] * k);
    ctx.fillRect(left + i, y, 6, h);
  }
}

/** Nako: dua daun, 10 bilah kaca miring per daun, bingkai aluminium. */
function nako(ctx, w, h, rnd, { tirai = false, lit = false } = {}) {
  ctx.fillStyle = rgba(...ALU);
  ctx.fillRect(0, 0, w, h);
  const t = Math.round(w * 0.04);
  const leafW = (w - 3 * t) / 2;
  for (let l = 0; l < 2; l += 1) {
    const x = t + l * (leafW + t);
    interior(ctx, x, t, leafW, h - 2 * t, lit);
    if (tirai || lit) curtain(ctx, x, t, leafW, h - 2 * t, rnd, lit);
    const slats = 10;
    const sh = (h - 2 * t) / slats;
    for (let s = 0; s < slats; s += 1) {
      const y = t + s * sh;
      const g = ctx.createLinearGradient(0, y, 0, y + sh);
      g.addColorStop(0, rgba(190, 210, 222, lit ? 0.25 : 0.55));
      g.addColorStop(0.7, rgba(120, 140, 155, lit ? 0.12 : 0.35));
      g.addColorStop(1, rgba(240, 248, 252, 0.7));
      ctx.fillStyle = g;
      ctx.fillRect(x, y + 1, leafW, sh - 1);
      ctx.fillStyle = rgba(150, 156, 160, 0.9); // klip bilah
      ctx.fillRect(x, y + sh - 2, 4, 2);
      ctx.fillRect(x + leafW - 4, y + sh - 2, 4, 2);
    }
  }
  frame(ctx, 0, 0, w, h, t, [176, 181, 186]);
  speckle(ctx, w, h, rnd, 60, [90, 90, 90], 0.2, 1);
}

function jalusiKayu(ctx, w, h, rnd) {
  ctx.fillStyle = rgba(122, 82, 50);
  ctx.fillRect(0, 0, w, h);
  const t = 12;
  const leafW = (w - 3 * t) / 2;
  for (let l = 0; l < 2; l += 1) {
    const x = t + l * (leafW + t);
    for (let y = t; y < h - t; y += 12) {
      ctx.fillStyle = rgba(150, 104, 64);
      ctx.fillRect(x, y, leafW, 8);
      ctx.fillStyle = rgba(70, 46, 28);
      ctx.fillRect(x, y + 8, leafW, 4);
    }
  }
  streaks(ctx, w, h, rnd, 10, [60, 40, 20], 0.2, 0.6);
}

function kacaBiru(ctx, w, h, rnd, lit = false) {
  ctx.fillStyle = rgba(64, 70, 78);
  ctx.fillRect(0, 0, w, h);
  const cols = 2;
  const rows = 3;
  const t = 6;
  const pw = (w - t * (cols + 1)) / cols;
  const ph = (h - t * (rows + 1)) / rows;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = t + c * (pw + t);
      const y = t + r * (ph + t);
      const g = ctx.createLinearGradient(x, y, x + pw, y + ph);
      g.addColorStop(0, rgba(150, 190, 220));
      g.addColorStop(0.55, rgba(70, 110, 150));
      g.addColorStop(1, rgba(110, 150, 185));
      ctx.fillStyle = g;
      ctx.fillRect(x, y, pw, ph);
      if (lit && r > 0) {
        ctx.fillStyle = rgba(250, 226, 170, 0.65);
        ctx.fillRect(x + 4, y + ph * 0.35, pw - 8, ph * 0.6);
      }
      ctx.fillStyle = rgba(255, 255, 255, 0.25);
      ctx.beginPath();
      ctx.moveTo(x + pw * 0.15, y);
      ctx.lineTo(x + pw * 0.35, y);
      ctx.lineTo(x, y + ph * 0.6);
      ctx.lineTo(x, y + ph * 0.3);
      ctx.fill();
    }
  }
  speckle(ctx, w, h, rnd, 40, [255, 255, 255], 0.2, 1);
}

function clerestory(ctx, w, h, rnd) {
  ctx.fillStyle = rgba(...ALU);
  ctx.fillRect(0, 0, w, h);
  const n = 4;
  const t = 6;
  const pw = (w - t * (n + 1)) / n;
  for (let i = 0; i < n; i += 1) {
    const x = t + i * (pw + t);
    interior(ctx, x, t, pw, h - 2 * t, false);
    ctx.fillStyle = rgba(190, 210, 222, 0.45);
    ctx.fillRect(x, t, pw, (h - 2 * t) * 0.45);
  }
  streaks(ctx, w, h, rnd, 6, [80, 80, 80], 0.2);
}

function kacaGelap(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, rgba(60, 74, 86));
  g.addColorStop(1, rgba(30, 38, 46));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  frame(ctx, 0, 0, w, h, 5, [70, 74, 78]);
}

function jalusiAlu(ctx, w, h) {
  ctx.fillStyle = rgba(60, 64, 68);
  ctx.fillRect(0, 0, w, h);
  for (let y = 6; y < h - 6; y += 10) {
    const g = ctx.createLinearGradient(0, y, 0, y + 7);
    g.addColorStop(0, rgba(225, 228, 230));
    g.addColorStop(1, rgba(150, 155, 160));
    ctx.fillStyle = g;
    ctx.fillRect(4, y, w - 8, 7);
  }
  frame(ctx, 0, 0, w, h, 4, [180, 184, 188]);
}

function acLuar(ctx, w, h, rnd) {
  ctx.fillStyle = rgba(236, 234, 226);
  ctx.fillRect(0, 0, w, h);
  const r = h * 0.36;
  const cx = w * 0.38;
  const cy = h * 0.5;
  ctx.fillStyle = rgba(60, 62, 64);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = rgba(200, 200, 196);
  ctx.lineWidth = 2;
  for (let k = 1; k <= 4; k += 1) {
    ctx.beginPath();
    ctx.arc(cx, cy, (r * k) / 4, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = rgba(150, 150, 146);
  for (let y = 10; y < h - 10; y += 6) ctx.fillRect(w * 0.76, y, w * 0.18, 3);
  streaks(ctx, w, h, rnd, 6, [120, 110, 90], 0.25);
}

function exhaust(ctx, w, h) {
  ctx.fillStyle = rgba(170, 174, 176);
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = rgba(40, 42, 44);
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, w * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = rgba(150, 154, 156);
  for (let k = 0; k < 6; k += 1) {
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate((k * Math.PI) / 3);
    ctx.fillRect(0, -5, w * 0.36, 10);
    ctx.restore();
  }
}

function lampu(ctx, w, h) {
  ctx.fillStyle = rgba(90, 92, 94);
  ctx.fillRect(0, h * 0.3, w, h * 0.4);
  ctx.fillStyle = rgba(255, 252, 240);
  ctx.fillRect(w * 0.08, h * 0.4, w * 0.84, h * 0.2);
}

function pintuKayu(ctx, w, h, rnd) {
  ctx.fillStyle = rgba(96, 64, 40);
  ctx.fillRect(0, 0, w, h);
  const t = 8;
  ctx.fillStyle = rgba(140, 94, 58);
  ctx.fillRect(t, t, w - 2 * t, h - 2 * t);
  for (let y = t + 6; y < h * 0.22; y += 7) { // krepyak ventilasi
    ctx.fillStyle = rgba(70, 46, 28);
    ctx.fillRect(t + 6, y, w - 2 * t - 12, 3);
  }
  ctx.strokeStyle = rgba(90, 60, 36);
  ctx.lineWidth = 3;
  ctx.strokeRect(t + 10, h * 0.27, w - 2 * t - 20, h * 0.3);
  ctx.strokeRect(t + 10, h * 0.62, w - 2 * t - 20, h * 0.3);
  ctx.fillStyle = rgba(210, 210, 205);
  ctx.fillRect(w - t - 18, h * 0.55, 10, 4);
  streaks(ctx, w, h, rnd, 8, [50, 30, 20], 0.15);
}

function pintuKaca(ctx, w, h) {
  ctx.fillStyle = rgba(...ALU);
  ctx.fillRect(0, 0, w, h);
  for (let l = 0; l < 2; l += 1) {
    const x = 6 + l * (w / 2 - 3);
    interior(ctx, x, 6, w / 2 - 9, h - 18, false);
    ctx.fillStyle = rgba(160, 190, 210, 0.45);
    ctx.fillRect(x, 6, w / 2 - 9, h * 0.4);
    ctx.fillStyle = rgba(220, 222, 224);
    ctx.fillRect(x + (l ? 4 : w / 2 - 17), h * 0.5, 4, 30);
  }
}

function pintuGanda(ctx, w, h, rnd) {
  ctx.fillStyle = rgba(88, 60, 38);
  ctx.fillRect(0, 0, w, h);
  interior(ctx, 8, 8, w - 16, h * 0.16, false); // jendela atas (bovenlicht)
  ctx.fillStyle = rgba(170, 196, 212, 0.5);
  ctx.fillRect(8, 8, w - 16, h * 0.08);
  for (let l = 0; l < 2; l += 1) {
    const x = 8 + l * (w / 2 - 4);
    const lw = w / 2 - 12;
    ctx.fillStyle = rgba(138, 92, 56);
    ctx.fillRect(x, h * 0.2, lw, h * 0.78);
    interior(ctx, x + 10, h * 0.25, lw - 20, h * 0.3, false);
    ctx.fillStyle = rgba(170, 196, 212, 0.4);
    ctx.fillRect(x + 10, h * 0.25, lw - 20, h * 0.12);
    ctx.strokeStyle = rgba(86, 56, 34);
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 10, h * 0.62, lw - 20, h * 0.3);
  }
  ctx.fillStyle = rgba(214, 214, 208);
  ctx.fillRect(w / 2 - 12, h * 0.6, 8, 4);
  ctx.fillRect(w / 2 + 4, h * 0.6, 8, 4);
  speckle(ctx, w, h, rnd, 80, [40, 30, 20], 0.2, 1);
}

function pintuGulung(ctx, w, h, rnd) {
  for (let y = 0; y < h; y += 8) {
    const g = ctx.createLinearGradient(0, y, 0, y + 8);
    g.addColorStop(0, rgba(170, 182, 176));
    g.addColorStop(0.6, rgba(140, 152, 146));
    g.addColorStop(1, rgba(96, 104, 100));
    ctx.fillStyle = g;
    ctx.fillRect(0, y, w, 8);
  }
  ctx.fillStyle = rgba(80, 86, 84);
  ctx.fillRect(0, h - 12, w, 12);
  ctx.fillRect(w / 2 - 14, h - 26, 28, 6);
  streaks(ctx, w, h, rnd, 14, [140, 80, 40], 0.3, 0.5);
  blotches(ctx, w, h, rnd, 6, [120, 70, 35], 0.25, 6, 20);
}

/**
 * Strip roster: 8 × 2 blok beton 20 × 20 cm (32 px) per sel 256 × 64 (satu ubin = 1,6 × 0,4 m) dengan lubang
 * `hole(ctx, s)` per blok; tepi lubang digelapkan sebagai kesan kedalaman, lubang dibuat transparan.
 */
function roster(hole) {
  return (ctx, w, h, rnd) => {
    const s = h / 2;
    ctx.fillStyle = rgba(160, 158, 152);
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += s) {
      for (let x = 0; x < w; x += s) {
        ctx.fillStyle = rgba(238, 236, 230);
        ctx.fillRect(x + 1.5, y + 1.5, s - 3, s - 3);
      }
    }
    speckle(ctx, w, h, rnd, 300, [130, 126, 118], 0.3, 1);
    const each = (fn) => {
      for (let y = 0; y < h; y += s) {
        for (let x = 0; x < w; x += s) {
          ctx.save();
          ctx.translate(x, y);
          ctx.beginPath();
          hole(ctx, s);
          fn();
          ctx.restore();
        }
      }
    };
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = rgba(150, 146, 138);
    each(() => ctx.stroke());
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    each(() => ctx.fill());
    ctx.restore();
  };
}

const ROSTER_HOLES = {
  kotak: (ctx, s) => {
    const c = (s - 6) / 3;
    for (let j = 0; j < 3; j += 1) for (let i = 0; i < 3; i += 1) ctx.rect(4 + i * c, 4 + j * c, c - 2.5, c - 2.5);
  },
  lingkaran: (ctx, s) => {
    ctx.moveTo(s / 2 + s * 0.33, s / 2);
    ctx.arc(s / 2, s / 2, s * 0.33, 0, Math.PI * 2);
  },
  silang: (ctx, s) => {
    const m = s / 2;
    const a = s * 0.36;
    const g = s * 0.06;
    ctx.moveTo(m, m - g); ctx.lineTo(m - a + g, m - a); ctx.lineTo(m + a - g, m - a); ctx.closePath();
    ctx.moveTo(m + g, m); ctx.lineTo(m + a, m - a + g); ctx.lineTo(m + a, m + a - g); ctx.closePath();
    ctx.moveTo(m, m + g); ctx.lineTo(m + a - g, m + a); ctx.lineTo(m - a + g, m + a); ctx.closePath();
    ctx.moveTo(m - g, m); ctx.lineTo(m - a, m + a - g); ctx.lineTo(m - a, m - a + g); ctx.closePath();
  },
  bunga: (ctx, s) => {
    const m = s / 2;
    const r = s * 0.16;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      ctx.moveTo(m + dx * r * 1.25 + r, m + dy * r * 1.25);
      ctx.arc(m + dx * r * 1.25, m + dy * r * 1.25, r, 0, Math.PI * 2);
    }
  },
  krawangan: (ctx, s) => {
    const rh = (s - 6) / 3;
    for (let j = 0; j < 3; j += 1) {
      const off = j % 2 ? s * 0.25 : 0;
      ctx.rect(Math.max(3, off + 3 - s * 0.25), 3 + j * rh, s * 0.42, rh - 2.5);
      ctx.rect(Math.min(s - 3 - s * 0.42, off + 3 + s * 0.25), 3 + j * rh, s * 0.42, rh - 2.5);
    }
  },
};

/** Layar logam perforasi (dicat netral terang; warna oranye-terakota dari palet `screen`). */
function layar(cut) {
  return (ctx, w, h, rnd) => {
    ctx.fillStyle = rgba(246, 240, 234);
    ctx.fillRect(0, 0, w, h);
    blotches(ctx, w, h, rnd, 6, [210, 200, 190], 0.15, 20, 60);
    ctx.fillStyle = rgba(150, 140, 130, 0.6);
    ctx.fillRect(0, 0, w, 3);
    ctx.fillRect(0, 0, 3, h);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    cut(ctx, w, h);
    ctx.fill();
    ctx.restore();
  };
}

const LAYAR_CUTS = {
  segitiga: (ctx, w, h) => { // baris segitiga berselang naik/turun (zig-zag) ±23 cm
    const s = 48;
    for (let j = 0; j * s < h; j += 1) {
      for (let i = -1; i * s < w + s; i += 1) {
        const x = i * s + (j % 2 ? s / 2 : 0);
        const y = j * s + 4;
        const up = (i + j) % 2 === 0;
        if (up) { ctx.moveTo(x + 6, y + s - 10); ctx.lineTo(x + s / 2, y + 4); ctx.lineTo(x + s - 6, y + s - 10); }
        else { ctx.moveTo(x + 6, y + 4); ctx.lineTo(x + s - 6, y + 4); ctx.lineTo(x + s / 2, y + s - 10); }
        ctx.closePath();
      }
    }
  },
  vertikal: (ctx, w, h) => { // celah vertikal berselang (Integrated Laboratory)
    for (let x = 12, k = 0; x < w - 10; x += 24, k += 1) {
      const off = k % 2 ? 44 : 10;
      for (let y = off; y < h - 30; y += 96) ctx.rect(x, y, 11, 78);
    }
  },
  wajik: (ctx, w, h) => { // kisi diagonal (HSC): lubang wajik besar, batang ±5 cm
    const s = 64;
    for (let y = -s; y < h + s; y += s / 2) {
      const row = Math.round(y / (s / 2));
      for (let x = -s; x < w + s; x += s) {
        const cx = x + (row % 2 ? s / 2 : 0);
        ctx.moveTo(cx, y + 6); ctx.lineTo(cx + s / 2 - 6, y + s / 2); ctx.lineTo(cx, y + s - 6); ctx.lineTo(cx - s / 2 + 6, y + s / 2);
        ctx.closePath();
      }
    }
  },
};

function railing(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = rgba(64, 74, 70);
  ctx.fillRect(0, 2, w, 10);
  ctx.fillRect(0, h - 22, w, 6);
  for (let x = 4; x < w; x += 16) ctx.fillRect(x, 12, 4, h - 30);
}

export const OPENING_PAINTERS = Object.freeze({
  nako: (ctx, w, h, rnd) => nako(ctx, w, h, rnd),
  'nako-tirai': (ctx, w, h, rnd) => nako(ctx, w, h, rnd, { tirai: true }),
  'nako-nyala': (ctx, w, h, rnd) => nako(ctx, w, h, rnd, { tirai: true, lit: true }),
  'jalusi-kayu': jalusiKayu,
  'kaca-biru': (ctx, w, h, rnd) => kacaBiru(ctx, w, h, rnd, false),
  'kaca-biru-nyala': (ctx, w, h, rnd) => kacaBiru(ctx, w, h, rnd, true),
  clerestory,
  'kaca-gelap': kacaGelap,
  'jalusi-alu': jalusiAlu,
  'ac-luar': acLuar,
  exhaust,
  lampu,
  'pintu-kayu': pintuKayu,
  'pintu-kaca': pintuKaca,
  'pintu-ganda': pintuGanda,
  'pintu-gulung': pintuGulung,
  'roster-kotak': roster(ROSTER_HOLES.kotak),
  'roster-lingkaran': roster(ROSTER_HOLES.lingkaran),
  'roster-silang': roster(ROSTER_HOLES.silang),
  'roster-bunga': roster(ROSTER_HOLES.bunga),
  'roster-krawangan': roster(ROSTER_HOLES.krawangan),
  'layar-segitiga': layar(LAYAR_CUTS.segitiga),
  'layar-vertikal': layar(LAYAR_CUTS.vertikal),
  'layar-wajik': layar(LAYAR_CUTS.wajik),
  railing,
});
