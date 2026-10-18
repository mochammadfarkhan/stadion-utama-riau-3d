/**
 * Logika murni kehidupan kampus UNRI (spec §8.4): kepadatan mahasiswa per jam game, jalur jalan kaki dari data
 * ground distrik (format M2: `walks` = trotoar/selasar/footway, `roads` = badan jalan), pembagian kolam NPC per
 * sel 250 m, langkah pejalan bolak-balik di polyline, titik bangku diskusi, dan tingkat isi parkir motor.
 * Tanpa three/DOM; fungsi tidak memutasi masukan.
 */

export const CELL_SIZE = 250;

/**
 * Pita kepadatan (jam mulai, inklusif). Spec §8.4: 07–17 ramai, 17–21 sedang, malam sepi.
 * 05–07 pagi awal = [INFERENSI].
 */
export const DENSITY_BANDS = Object.freeze([
  Object.freeze({ from: 0, level: 0.05 }),
  Object.freeze({ from: 5, level: 0.25 }),
  Object.freeze({ from: 7, level: 1 }),
  Object.freeze({ from: 17, level: 0.45 }),
  Object.freeze({ from: 21, level: 0.05 }),
]);
/** Lama transisi linier setelah awal pita (jam) agar NPC tidak muncul/hilang serentak. */
export const DENSITY_RAMP_H = 0.5;

const wrapHour = (h) => ((h % 24) + 24) % 24;

/** Tingkat kepadatan 0..1 untuk jam game; nilai tak hingga dianggap malam. */
export function studentDensity(hour) {
  if (!Number.isFinite(hour)) return DENSITY_BANDS[0].level;
  const h = wrapHour(hour);
  let i = 0;
  for (let k = 0; k < DENSITY_BANDS.length; k += 1) if (h >= DENSITY_BANDS[k].from) i = k;
  const band = DENSITY_BANDS[i];
  const prev = DENSITY_BANDS[(i + DENSITY_BANDS.length - 1) % DENSITY_BANDS.length];
  const t = (h - band.from) / DENSITY_RAMP_H;
  return t >= 1 ? band.level : prev.level + (band.level - prev.level) * t;
}

/**
 * Isi parkir motor per jenis area: `ic` = parkir Integrated Classroom (padat siang hari, riset §4 [S]);
 * `kampus` = area parkir lain [INFERENSI].
 */
export const MOTOR_FILL = Object.freeze({
  ic: Object.freeze({ base: 0.12, gain: 0.85, max: 0.97 }),
  kampus: Object.freeze({ base: 0.05, gain: 0.6, max: 0.8 }),
});

/** Fraksi slot parkir yang terisi (0..1) pada jam game untuk jenis area. */
export function motorFill(hour, kind = 'kampus') {
  const f = MOTOR_FILL[kind] ?? MOTOR_FILL.kampus;
  return Math.min(f.max, f.base + f.gain * studentDensity(hour));
}

/** Kelas jalan kampus yang punya bahu untuk pejalan (jalan utama tepi kampus tidak). */
export const SHOULDER_CLASSES = Object.freeze([
  'tertiary', 'tertiary_link', 'unclassified', 'residential', 'service', 'living_street',
]);
/** Jarak jalur pejalan dari tepi badan jalan (m) [INFERENSI]. */
export const SHOULDER_GAP = 0.9;

/** Titik polyline [[x, z], …] dari data ground (bersarang atau datar), dikali `scale`; titik tak hingga dibuang. */
export function toPoints(pts, scale = 1) {
  if (!Array.isArray(pts)) return [];
  if (pts.length && Array.isArray(pts[0])) {
    return pts.filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1])).map((p) => [p[0] * scale, p[1] * scale]);
  }
  const out = [];
  for (let i = 0; i + 1 < pts.length; i += 2) {
    if (Number.isFinite(pts[i]) && Number.isFinite(pts[i + 1])) out.push([pts[i] * scale, pts[i + 1] * scale]);
  }
  return out;
}

/** Polyline tergeser tegak lurus sejauh `d` ke arah normal (−dz, dx); titik dengan arah merosot dilewati. */
export function offsetPolyline(pts, d) {
  const out = [];
  for (let i = 0; i < pts.length; i += 1) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    if (len < 1e-6) continue;
    out.push([Number((pts[i][0] - (dz / len) * d).toFixed(6)), Number((pts[i][1] + (dx / len) * d).toFixed(6))]);
  }
  return out;
}

/** Jalur terukur {pts, cum, length, kind}; null bila < 2 titik atau lebih pendek dari minLength. */
export function measurePath(pts, kind, minLength = 8, side = 0) {
  if (!Array.isArray(pts) || pts.length < 2) return null;
  const cum = [0];
  for (let i = 1; i < pts.length; i += 1) {
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  const length = cum[cum.length - 1];
  return length >= minLength ? Object.freeze({ pts, cum, length, kind, side }) : null;
}

/**
 * Jalur pejalan dari satu chunk ground M2: semua `walks` (trotoar, selasar, footway) + kedua bahu jalan kampus
 * (kelas SHOULDER_CLASSES; offset lebar/2 + SHOULDER_GAP). Lebar `w` dalam meter; `scale` hanya untuk titik.
 */
export function pathsFromGround(ground, { scale = 1 } = {}) {
  const walks = (ground?.walks ?? []).map((w) => measurePath(toPoints(w.pts, scale), 'walk'));
  const shoulders = (ground?.roads ?? [])
    .filter((r) => SHOULDER_CLASSES.includes(r.cls) && Number.isFinite(r.w))
    .flatMap((r) => {
      const pts = toPoints(r.pts, scale);
      const d = r.w / 2 + SHOULDER_GAP;
      // side = +1 bila jalur di sisi kiri jalan (arah gambar), −1 di kanan: dipakai bangku agar menghadap jalan dari luar.
      return [measurePath(offsetPolyline(pts, d), 'bahu', 8, 1), measurePath(offsetPolyline(pts, -d), 'bahu', 8, -1)];
    });
  return [...walks, ...shoulders].filter(Boolean);
}

/** Titik pada jarak s sepanjang jalur (dijepit) + yaw arah jalur (konvensi maju = (sin, cos)). */
export function pointAt(path, s) {
  const { pts, cum, length } = path;
  const t = Math.min(Math.max(s, 0), length);
  let i = 1;
  while (i < cum.length - 1 && cum[i] < t) i += 1;
  const a = pts[i - 1];
  const b = pts[i];
  const seg = cum[i] - cum[i - 1] || 1;
  const k = (t - cum[i - 1]) / seg;
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  return { x: a[0] + dx * k, z: a[1] + dz * k, yaw: Math.atan2(dx, dz) };
}

/** Potong jalur menjadi n potongan sama panjang (≤ maxLen) yang bersambung. */
export function chopPath(path, maxLen = 120) {
  if (path.length <= maxLen) return [path];
  const n = Math.ceil(path.length / maxLen);
  const step = path.length / n;
  const out = [];
  for (let k = 0; k < n; k += 1) {
    const s0 = k * step;
    const s1 = (k + 1) * step;
    const a = pointAt(path, s0);
    const b = pointAt(path, s1);
    const inner = path.pts.filter((_, i) => path.cum[i] > s0 && path.cum[i] < s1);
    const piece = measurePath([[a.x, a.z], ...inner, [b.x, b.z]], path.kind, 0, path.side);
    if (piece) out.push(piece);
  }
  return out;
}

export const cellKeyOf = (x, z, size = CELL_SIZE) => `${Math.floor(x / size)}_${Math.floor(z / size)}`;

/** Pusat sel dari kunci "cx_cz". */
export function cellCenter(key, size = CELL_SIZE) {
  const [cx, cz] = key.split('_').map(Number);
  return { x: (cx + 0.5) * size, z: (cz + 0.5) * size };
}

/** Potongan jalur (≤ maxLen) dikelompokkan per sel menurut titik tengahnya. @returns {Map<string, object[]>} */
export function bucketPaths(paths, { size = CELL_SIZE, maxLen = 120 } = {}) {
  const out = new Map();
  for (const piece of paths.flatMap((p) => chopPath(p, maxLen))) {
    const mid = pointAt(piece, piece.length / 2);
    const key = cellKeyOf(mid.x, mid.z, size);
    out.set(key, [...(out.get(key) ?? []), piece]);
  }
  return out;
}

/** Panjang jalur (m) per mahasiswa saat ramai [INFERENSI kepadatan visual]; batas per sel (budget). */
export const STUDENT_SPACING = 28;
export const MAX_PER_CELL = 10;

/** Jumlah mahasiswa sebuah sel: min(panjang/spacing, max) × kepadatan, dibulatkan. */
export function targetCount(pathLength, density, { spacing = STUDENT_SPACING, max = MAX_PER_CELL } = {}) {
  if (!(pathLength > 0) || !(density > 0)) return 0;
  return Math.round(Math.min(pathLength / spacing, max) * density);
}

/**
 * Bagi kolam NPC ke sel: sel terdekat dulu (seri: kunci), tiap sel maks `want`. @returns {Map<string, number>}
 * @param {Array<{key:string, want:number, dist:number}>} requests
 */
export function allocateStudents(requests, poolSize) {
  const sorted = [...requests].sort((a, b) => a.dist - b.dist || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  let left = Math.max(0, Math.floor(poolSize));
  const out = new Map();
  for (const r of sorted) {
    const n = Math.min(left, Math.max(0, Math.floor(r.want)));
    out.set(r.key, n);
    left -= n;
  }
  return out;
}

export const WALK_SPEED = Object.freeze([1.0, 1.5]);
export const END_PAUSE = Object.freeze([1.5, 6]);
export const LATERAL = 0.8;

/** RNG deterministik mulberry32 (sim tidak boleh mengimpor entities/util). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash FNV-1a 32 bit untuk benih per kunci sel. */
export function hashString(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Pejalan baru di posisi acak jalur. */
export function createWalker(path, rng) {
  return Object.freeze({
    s: rng() * path.length,
    dir: rng() < 0.5 ? 1 : -1,
    speed: WALK_SPEED[0] + (WALK_SPEED[1] - WALK_SPEED[0]) * rng(),
    lateral: (rng() * 2 - 1) * LATERAL,
    pause: 0,
    phase: rng() * 10,
    mode: 'walk',
  });
}

/** Satu langkah: maju sepanjang jalur; di ujung berhenti sebentar lalu berbalik. dt tak valid → objek yang sama. */
export function stepWalker(w, path, dt, rng) {
  if (w.mode !== 'walk' || !(dt > 0)) return w;
  if (w.pause > 0) return { ...w, pause: Math.max(0, w.pause - dt) };
  const s = w.s + w.dir * w.speed * dt;
  if (s >= 0 && s <= path.length) return { ...w, s };
  const pause = END_PAUSE[0] + (END_PAUSE[1] - END_PAUSE[0]) * rng();
  return { ...w, s: Math.min(Math.max(s, 0), path.length), dir: -w.dir, pause };
}

/** Pose dunia pejalan: titik jalur + offset lateral ke kanan arah jalur (cos, −sin); yaw searah gerak. */
export function walkerPose(w, path) {
  const p = pointAt(path, w.s);
  const nx = Math.cos(p.yaw);
  const nz = -Math.sin(p.yaw);
  // `+ 0` menormalkan -0 agar hasil deterministik untuk perbandingan.
  return { x: p.x + nx * w.lateral + 0, z: p.z + nz * w.lateral + 0, yaw: w.dir > 0 ? p.yaw : p.yaw + Math.PI };
}

export const BENCH_SPACING = 85;
export const BENCH_OFFSET = 2.4;
export const SEAT_OFFSET = 0.45;

/**
 * Bangku diskusi (P04, "bangku diskusi di bawah pohon" riset §4 [T]) di sisi kanan jalur `walk` tiap
 * BENCH_SPACING m; panjang bangku sejajar jalur. Bahu jalan (`bahu`) hanya mendapat bangku bila `shoulderSpacing`
 * diberikan (OSM kampus hanya punya segelintir footway): bangku di sisi LUAR bahu (menjauhi badan jalan), menghadap
 * jalur. @returns {Array<{x,z,rotY,pathYaw}>}
 */
export function benchSpotsFromPaths(paths, { spacing = BENCH_SPACING, offset = BENCH_OFFSET, shoulderSpacing = null } = {}) {
  const out = [];
  for (const p of paths) {
    const shoulder = p.kind === 'bahu';
    if (p.kind !== 'walk' && !(shoulder && shoulderSpacing)) continue;
    const step = shoulder ? shoulderSpacing : spacing;
    // Sisi kanan arah jalur (k = 1) = luar untuk bahu kanan jalan; bahu kiri jalan (side +1) dibalik ke kiri.
    const k = shoulder && p.side > 0 ? -1 : 1;
    for (let s = step / 2; s < p.length; s += step) {
      const q = pointAt(p, s);
      out.push(Object.freeze({
        x: q.x + Math.cos(q.yaw) * offset * k,
        z: q.z - Math.sin(q.yaw) * offset * k,
        rotY: q.yaw - (Math.PI / 2) * k,
        pathYaw: q.yaw,
        face: -(Math.PI / 2) * k, // arah hadap kursi relatif pathYaw (menuju jalur)
      }));
    }
  }
  return out;
}

/** Dua kursi per bangku (±SEAT_OFFSET sepanjang bangku), menghadap jalur. */
export function seatsOf(spots) {
  return spots.flatMap((b) => [-1, 1].map((k) => Object.freeze({
    x: b.x + Math.sin(b.pathYaw) * SEAT_OFFSET * k,
    z: b.z + Math.cos(b.pathYaw) * SEAT_OFFSET * k,
    yaw: b.pathYaw + (b.face ?? -Math.PI / 2),
  })));
}

export const SIT_SHARE = 0.25;

/** Jumlah mahasiswa yang duduk di sel: ±25% dari total, dibatasi kursi tersedia. */
export function sitterCount(total, seats) {
  return Math.min(seats, Math.round(total * SIT_SHARE));
}
