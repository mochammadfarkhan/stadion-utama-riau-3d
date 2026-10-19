/**
 * Geometri murni grammar fasad (dipakai planBuilding & planRules): massa kotak/poligon, sisi dinding,
 * sisi luar vs dalam antar-massa, bay, peran sisi. Konvensi sisi: `a` = ujung kiri dilihat dari luar,
 * `b` = kanan, normal luar n = (−Rz, Rx) dengan R = (b − a)/len. Massa kotak berurutan '-z', '+x', '+z',
 * '-x' (frame lokal OBB). Murni (tanpa three).
 */
import { cleanRing, orientRing, pointInPolygon } from '../../geo/polygon.js';
import { computeObb, toWorld } from './obb.js';

export const PLAN = Object.freeze({
  plinthLift: 0.15,        // lantai di atas median tanah (spec §7.2 langkah 2)
  minCorridorDepth: 7,     // massa lebih sempit (sisi pendek) tidak diberi selasar
  minWall: 2,              // sisi kotak dinding minimum setelah dimundurkan
  eaveInset: 0.5,          // dinding mundur dari tepi footprint pada atap miring (footprint OSM = garis atap)
  parapetH: 0.9,
  sample: 0.5,             // langkah sampel sisi luar/dalam (m)
  probe: 0.4,              // jarak uji keluar dari sisi untuk deteksi sisi dalam antar-massa
  minBayFace: 1.2,         // interval luar lebih pendek tidak diberi bay
  litChance: Object.freeze({ K01: 0.15, K02: 0.35, K03: 0.5, K04: 0.2, K05: 0.1, K06: 0.4, K09: 0.6, K11: 0.5, K12: 0.25 }),
  tiraiChance: 0.3,
  signMaxW: 14,
});

export const FACE_IDS = Object.freeze(['-z', '+x', '+z', '-x']);

/** Median (salinan terurut); 0 untuk array kosong. */
export function median(values) {
  const s = [...values].sort((a, b) => a - b);
  const n = s.length;
  if (n === 0) return 0;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

/** Tinggi lantai per tingkat: [lantai dasar, atas, atas, …]. */
export function floorHeights(arch, floors) {
  return Array.from({ length: floors }, (_, i) => (i === 0 ? arch.floorH : arch.upperH));
}

/** Sisi dinding dari titik kiri `a` ke kanan `b` (dilihat dari luar). */
export function makeFace(id, a, b) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const rx = (b[0] - a[0]) / len;
  const rz = (b[1] - a[1]) / len;
  return { id, a, b, n: [-rz, rx], len, role: 'sisi', exterior: [[0, len]], bays: 0, dot: 0 };
}

/** Titik pada sisi sejauh u dari a, digeser `out` meter keluar (normal). */
export function facePoint(face, u, out = 0) {
  const t = u / face.len;
  return [
    face.a[0] + (face.b[0] - face.a[0]) * t + face.n[0] * out,
    face.a[1] + (face.b[1] - face.a[1]) * t + face.n[1] * out,
  ];
}

/** Yaw three.js yang membuat +Z lokal objek menghadap normal luar sisi. */
export function faceYaw(face) {
  return Math.atan2(face.n[0], face.n[1]);
}

export const exteriorLength = (face) => face.exterior.reduce((s, [a, b]) => s + (b - a), 0);

/** Interval [u0,u1] sisi yang menghadap luar (tidak tertutup footprint massa lain). */
export function exteriorIntervals(face, others) {
  if (others.length === 0) return [[0, face.len]];
  const n = Math.max(1, Math.round(face.len / PLAN.sample));
  const step = face.len / n;
  const out = [];
  let start = null;
  for (let i = 0; i < n; i += 1) {
    const [px, pz] = facePoint(face, (i + 0.5) * step, PLAN.probe);
    const covered = others.some((ring) => pointInPolygon(px, pz, ring));
    if (!covered && start === null) start = i * step;
    if (covered && start !== null) {
      out.push([start, i * step]);
      start = null;
    }
  }
  if (start !== null) out.push([start, face.len]);
  return out;
}

/** Ring footprint OBB (dunia, positif). */
export function obbRing(obb) {
  const c = [[-obb.w / 2, -obb.d / 2], [obb.w / 2, -obb.d / 2], [obb.w / 2, obb.d / 2], [-obb.w / 2, obb.d / 2]];
  return c.map(([x, z]) => {
    const p = toWorld(obb, x, z);
    return [p.x, p.z];
  });
}

/** Normal luar dunia sisi lokal OBB. */
export function localNormal(id, yaw) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const v = { '-z': [0, -1], '+x': [1, 0], '+z': [0, 1], '-x': [-1, 0] }[id];
  return [v[0] * c + v[1] * s, -v[0] * s + v[1] * c];
}

/** Sisi selasar lokal menurut corridorSide & arah ke jalan terdekat `front` ([fx,fz] satuan). */
export function corridorFaces(side, obb, front) {
  if (side === 'tidak') return [];
  if (side === 'keliling') return [...FACE_IDS];
  if (side === 'dua') return ['-z', '+z'];
  const f = front ?? [0, 1];
  const dot = (id) => {
    const n = localNormal(id, obb.yaw);
    return n[0] * f[0] + n[1] * f[1];
  };
  const toward = dot('+z') >= dot('-z') ? '+z' : '-z';
  if (side === 'belakang') return [toward === '+z' ? '-z' : '+z'];
  return [toward];
}

/** Empat sisi kotak dinding dari mundur per sisi (insets). */
function wallBox(obb, insets) {
  const x0 = -obb.w / 2 + insets['-x'];
  const x1 = obb.w / 2 - insets['+x'];
  const z0 = -obb.d / 2 + insets['-z'];
  const z1 = obb.d / 2 - insets['+z'];
  const w = (x, z) => {
    const p = toWorld(obb, x, z);
    return [p.x, p.z];
  };
  const A = w(x0, z0);
  const B = w(x1, z0);
  const C = w(x1, z1);
  const D = w(x0, z1);
  // tepi ring positif p_i → p_{i+1}; ujung kiri dari luar = p_{i+1}
  return { faces: [makeFace('-z', B, A), makeFace('+x', C, B), makeFace('+z', D, C), makeFace('-x', A, D)], wall: { x0, x1, z0, z1 } };
}

/**
 * Massa kotak: footprint OBB, sisi dalam (bersinggungan massa lain) tanpa mundur & tanpa selasar,
 * selasar di sisi luar terpilih, dinding mundur sedalam selasar / tritisan.
 */
export function boxMass(obb, arch, corridorSide, front, others, pitched) {
  const want = obb.d >= PLAN.minCorridorDepth ? corridorFaces(corridorSide, obb, front) : [];
  const zero = { '-z': 0, '+x': 0, '+z': 0, '-x': 0 };
  const probe = wallBox(obb, zero);
  const inner = new Set();
  for (const f of probe.faces) {
    f.exterior = exteriorIntervals(f, others);
    if (exteriorLength(f) < 0.5 * f.len) inner.add(f.id);
  }
  let corridor = want.filter((id) => !inner.has(id) && exteriorLength(probe.faces[FACE_IDS.indexOf(id)]) > 0.9 * obb.w);
  const eave = pitched ? Math.min(PLAN.eaveInset, arch.roof.overhang / 2) : 0;
  const insetFor = (id) => (inner.has(id) ? 0 : corridor.includes(id) ? arch.corridor.depth : eave);
  let insets = Object.fromEntries(FACE_IDS.map((id) => [id, insetFor(id)]));
  let built = wallBox(obb, insets);
  if (built.wall.x1 - built.wall.x0 < PLAN.minWall || built.wall.z1 - built.wall.z0 < PLAN.minWall) {
    corridor = [];
    insets = Object.fromEntries(FACE_IDS.map((id) => [id, insetFor(id)]));
    built = wallBox(obb, insets);
  }
  for (const f of built.faces) f.exterior = exteriorIntervals(f, others);
  return {
    kind: 'kotak', obb, ring: obbRing(obb), wall: built.wall, faces: built.faces, insets,
    corridor: { faces: corridor, depth: corridor.length ? arch.corridor.depth : 0 },
  };
}

/** Massa poligon (K12): sisi = tepi ring (dunia, positif), tanpa selasar. */
export function polygonMass(ring, holes = []) {
  const outer = orientRing(cleanRing(ring), true);
  const inner = holes.map((h) => orientRing(cleanRing(h), false)).filter((h) => h.length >= 3);
  const edges = (r, tag) => r.map((p, i) => makeFace(`${tag}${i}`, r[(i + 1) % r.length], p)).filter((f) => f.len > 0.05);
  const faces = [...edges(outer, 'e'), ...inner.flatMap((h, k) => edges(h, `h${k}-`))];
  return { kind: 'poligon', obb: computeObb(outer), ring: outer, holes: inner, faces, insets: null, corridor: { faces: [], depth: 0 } };
}

/** Bay per interval luar: n = round(len / bay), lebar dibagi rata (spec §7.2 langkah 3). */
export function makeBays(face, bay) {
  const out = [];
  for (const [s, e] of face.exterior) {
    const len = e - s;
    if (len < PLAN.minBayFace) continue;
    const n = Math.max(1, Math.round(len / bay));
    for (let i = 0; i < n; i += 1) out.push({ u0: s + (len * i) / n, u1: s + (len * (i + 1)) / n });
  }
  face.bays = out.length;
  return out;
}

/** Peran sisi: 'selasar' | 'depan' (paling menghadap jalan) | 'belakang' | 'sisi'. */
export function assignRoles(mass, front) {
  const f = front ?? [0, 1];
  let best = null;
  for (const face of mass.faces) {
    face.dot = face.n[0] * f[0] + face.n[1] * f[1];
    if (exteriorLength(face) > 1 && (!best || face.dot > best.dot)) best = face;
  }
  const corr = mass.corridor.faces;
  for (const face of mass.faces) {
    if (corr.includes(face.id)) face.role = 'selasar';
    else if (corr.length === 0 && face === best) face.role = 'depan';
    else if (best && face.dot < -0.7) face.role = 'belakang';
    else face.role = 'sisi';
  }
}

/** Sisi utama massa (papan nama, ornamen depan): selasar/depan yang paling menghadap jalan. */
export function primaryFace(mass) {
  const cands = mass.faces.filter((f) => f.role === 'selasar' || f.role === 'depan');
  const list = cands.length ? cands : mass.faces;
  return list.reduce((best, f) => (f.dot > best.dot ? f : best), list[0]);
}
