/**
 * Data jaringan MRT & LRT Pekanbaru (mode Kota) serta matematika jalur & jadwal kereta murni.
 * Koordinat dunia (+X timur, +Z selatan, meter dari pusat Stadion Utama Riau).
 * Posisi stasiun diselaraskan dengan landmark kota di landmarks.data.js & fastTravel.js.
 */

export const TRANSIT_LINES = Object.freeze([
  {
    id: 'mrt',
    name: 'MRT Pekanbaru',
    color: '#1d7be0',
    accent: '#f5b82e',
    elevation: 11.5,
    deckWidth: 7.6,
    trackOffset: 1.75,
    pillarSpacing: 58,
    cars: 4,
    carLength: 14,
    carGap: 1.2,
    carWidth: 2.8,
    carHeight: 3.1,
    trains: 3,
    speed: 32,
    dwellSec: 2.6,
    stations: Object.freeze([
      { id: 'mrt-unri', name: 'Stasiun UNRI Panam', x: -980, z: 720 },
      { id: 'mrt-stadion', name: 'Stasiun Stadion Utama Riau', x: 0, z: 260 },
      { id: 'mrt-panam', name: 'Stasiun Simpang Panam', x: 1650, z: -680 },
      { id: 'mrt-soekarno-hatta', name: 'Stasiun Soekarno-Hatta', x: 3120, z: -1120 },
      { id: 'mrt-living-world', name: 'Stasiun Living World / SKA', x: 3420, z: -1910, interchange: true },
      { id: 'mrt-nangka', name: 'Stasiun Tuanku Tambusai', x: 4920, z: -2320 },
      { id: 'mrt-plaza-citra', name: 'Stasiun Plaza Citra', x: 6350, z: -2950 },
      { id: 'mrt-zapin', name: 'Stasiun Tugu Zapin / Gubernur', x: 6420, z: -3780 },
      { id: 'mrt-annur', name: 'Stasiun Masjid An-Nur', x: 6720, z: -4760 },
      { id: 'mrt-mall-pku', name: 'Stasiun Mall Pekanbaru', x: 6440, z: -5350 },
    ]),
  },
  {
    id: 'lrt',
    name: 'LRT Pekanbaru',
    color: '#10a37f',
    accent: '#f5b82e',
    elevation: 15.0,
    deckWidth: 6.4,
    trackOffset: 1.45,
    pillarSpacing: 58,
    cars: 3,
    carLength: 12,
    carGap: 1.0,
    carWidth: 2.4,
    carHeight: 2.8,
    trains: 3,
    speed: 28,
    dwellSec: 2.4,
    stations: Object.freeze([
      { id: 'lrt-bandara', name: 'Stasiun Bandara SSK II', x: 6460, z: 2020 },
      { id: 'lrt-mtq', name: 'Stasiun Bandar Serai / MTQ', x: 7320, z: 620 },
      { id: 'lrt-museum', name: 'Stasiun Museum Sang Nila Utama', x: 7150, z: -1180 },
      { id: 'lrt-sudirman-sel', name: 'Stasiun Sudirman Selatan', x: 5650, z: -2120 },
      { id: 'lrt-living-world', name: 'Stasiun Living World / SKA', x: 3310, z: -1935, interchange: true },
      { id: 'lrt-arengka-utara', name: 'Stasiun Soekarno-Hatta Utara', x: 3180, z: -3650 },
      { id: 'lrt-ciputra', name: 'Stasiun Ciputra Seraya', x: 4540, z: -5710 },
      { id: 'lrt-senapelan', name: 'Stasiun Senapelan / Siak', x: 5850, z: -5960 },
    ]),
  },
]);

/** Interpolasi Catmull-Rom 1D dengan tension ringan agar tikungan mulus tanpa melenceng jauh. */
function catmullRom(p0, p1, p2, p3, t, tension = 0.35) {
  const t2 = t * t;
  const t3 = t2 * t;
  const m1 = tension * (p2 - p0);
  const m2 = tension * (p3 - p1);
  return (2 * t3 - 3 * t2 + 1) * p1 + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2 + (t3 - t2) * m2;
}

/**
 * Bangun sampel polyline halus melewati seluruh stasiun jalur.
 * Mengembalikan `{ line, pts, cum, len, stationS }`.
 */
export function buildTrack(line, subdivPerSeg = 14) {
  const st = line.stations;
  const pts = [];
  const stationIdx = [];

  for (let i = 0; i < st.length - 1; i += 1) {
    const p0 = st[Math.max(0, i - 1)];
    const p1 = st[i];
    const p2 = st[i + 1];
    const p3 = st[Math.min(st.length - 1, i + 2)];
    if (i === 0) {
      stationIdx.push(0);
      pts.push([p1.x, p1.z]);
    }
    for (let k = 1; k <= subdivPerSeg; k += 1) {
      const t = k / subdivPerSeg;
      pts.push([
        catmullRom(p0.x, p1.x, p2.x, p3.x, t),
        catmullRom(p0.z, p1.z, p2.z, p3.z, t),
      ]);
      if (k === subdivPerSeg) stationIdx.push(pts.length - 1);
    }
  }

  const cum = new Float64Array(pts.length);
  for (let i = 1; i < pts.length; i += 1) {
    cum[i] = cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  const stationS = stationIdx.map((idx) => cum[idx]);
  return { line, pts, cum, len: cum[pts.length - 1], stationS };
}

/**
 * Sampel posisi & vektor arah satuan pada jarak `s` (m) sepanjang track.
 * Menulis ke `out`: `{ x, z, ux, uz }`.
 */
export function sampleTrackAt(track, s, out = { x: 0, z: 0, ux: 1, uz: 0 }) {
  const { cum, pts, len } = track;
  const t = Math.min(len, Math.max(0, s));
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= t) lo = mid; else hi = mid;
  }
  const segLen = cum[hi] - cum[lo] || 1;
  const f = (t - cum[lo]) / segLen;
  out.x = pts[lo][0] + (pts[hi][0] - pts[lo][0]) * f;
  out.z = pts[lo][1] + (pts[hi][1] - pts[lo][1]) * f;
  out.ux = (pts[hi][0] - pts[lo][0]) / segLen;
  out.uz = (pts[hi][1] - pts[lo][1]) / segLen;
  return out;
}

/**
 * Bangun tabel segmen jadwal pulang-pergi (berhenti `dwellSec` di setiap stasiun).
 * Tiap segmen: `{ t0, t1, s0, s1, dir }`.
 */
export function buildSchedule(track) {
  const { stationS, line } = track;
  const { speed, dwellSec } = line;
  const segs = [];
  let t = 0;

  const pushLeg = (fromIdx, toIdx, dir) => {
    const s0 = stationS[fromIdx];
    const s1 = stationS[toIdx];
    const travel = Math.max(1, Math.abs(s1 - s0) / speed);
    segs.push({ t0: t, t1: t + travel, s0, s1, dir });
    t += travel;
    segs.push({ t0: t, t1: t + dwellSec, s0: s1, s1, dir });
    t += dwellSec;
  };

  for (let i = 0; i < stationS.length - 1; i += 1) pushLeg(i, i + 1, 1);
  for (let i = stationS.length - 1; i > 0; i -= 1) pushLeg(i, i - 1, -1);

  return { segs, cycleSec: t || 1 };
}

/** Smoothstep 0..1 untuk akselerasi & deselerasi halus antar stasiun. */
const easeInOut = (u) => u * u * (3 - 2 * u);

/**
 * Hitung jarak sepanjang rel `s` dan arah `dir` (+1 atau -1) kereta ke-`trainIdx` pada waktu `timeSec`.
 * Mengembalikan `{ s, dir }`.
 */
export function trainStateAt(schedule, trainIdx, trainCount, timeSec, out = { s: 0, dir: 1 }) {
  const { segs, cycleSec } = schedule;
  const phase = (trainIdx / Math.max(1, trainCount)) * cycleSec;
  const t = (((timeSec + phase) % cycleSec) + cycleSec) % cycleSec;

  let lo = 0;
  let hi = segs.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const seg = segs[mid];
    if (t < seg.t0) hi = mid - 1;
    else if (t > seg.t1) lo = mid + 1;
    else {
      const span = seg.t1 - seg.t0 || 1;
      const u = (t - seg.t0) / span;
      out.s = seg.s0 + (seg.s1 - seg.s0) * easeInOut(u);
      out.dir = seg.dir;
      return out;
    }
  }
  out.s = segs[0]?.s0 ?? 0;
  out.dir = 1;
  return out;
}
