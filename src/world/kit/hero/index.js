/**
 * Builder hero (spec §7.1): `(plan, kitMaterials, ctx) => PartList`. M3 memasang PLACEHOLDER berukuran
 * footprint untuk SEMUA id hero (geometri arketipe pengganti HERO_STANDIN + penanda bentuk khas); M4
 * (sekretariat-lembaga, stadion-mini, student-center) dan M6 (rektorat, masjid, gerbang, ggm) mengganti isi
 * entri di sini tanpa mengubah kunci. ctx = { lod }.
 */
import { HERO_IDS } from '../archetypes.js';
import { cellUv } from '../atlas.js';
import { createKitSink, linearColor } from '../kitBuilder.js';
import { appendBuildingSteps } from '../kitAssemble.js';
import { facePoint, primaryFace } from '../planGeom.js';
import { yawOf } from '../kitShapes.js';
import { domeOnRoof } from '../roofs.js';

const KREM = linearColor(0xeee2c2);
const OKER = linearColor(0xc79a3c);
const MOZAIK = linearColor(0xd9d2f0); // [INF placeholder] mozaik putih-ungu → diganti N04 (M6)
const WHITE = [1, 1, 1];

/**
 * Placeholder umum: rakit plan dengan arketipe pengganti (plan.kit) + tambahan opsional. Fungsi builder
 * memiliki `.steps(sink, plan, mats, ctx)` (generator) agar klaster bisa memotong perakitan per sisi.
 */
function placeholder(extra) {
  function* steps(sink, plan, mats, ctx = {}) {
    yield* appendBuildingSteps(sink, plan, { lod: ctx.lod ?? 0 });
    if (extra && (ctx.lod ?? 0) === 0) extra(sink, plan, ctx);
  }
  const build = (plan, mats, ctx = {}) => {
    const sink = createKitSink();
    for (const _ of steps(sink, plan, mats, ctx)) { /* semua langkah */ }
    return sink.toParts(mats, `${plan.archetype}:${plan.id}`);
  };
  build.steps = steps;
  return build;
}

/** Rektorat: blok tengah menonjol berkaca biru vertikal di sisi depan [T foto 2016]. */
function rektoratFront(sink, plan) {
  const face = primaryFace(plan.masses[0]);
  const w = Math.min(14, face.len * 0.22);
  const y0 = plan.baseY + plan.floorH[0];
  const y1 = plan.baseY + plan.height + 1.2;
  const [x, z] = facePoint(face, face.len / 2, 0.6);
  sink.opak.box(x, (y0 + y1) / 2, z, w, y1 - y0, 1.2, yawOf(face), cellUv('kaca-biru'), WHITE);
}

/** Masjid: drum + kubah mozaik + mahkota di atas massa utama [T foto 2023; bentuk final N04 M6]. */
function masjidDome(sink, plan) {
  const { obb } = plan.masses[0];
  domeOnRoof(sink.opak, obb.cx, obb.cz, plan.baseY + plan.height + 0.9, Math.min(obb.w, obb.d) * 0.2, { wall: KREM, trim: OKER, roof: MOZAIK, white: OKER });
}

/** GGM: atap kerucut di atas silinder poligon [T bentuk gasing; kondisi 2026 R]. */
function ggmCone(sink, plan) {
  const m = plan.masses[0];
  const cx = m.obb.cx;
  const cz = m.obb.cz;
  const y = plan.baseY + plan.height;
  const r = cellUv('seng-karat');
  const color = linearColor(0x8c969e);
  m.ring.forEach((p, i) => {
    const q = m.ring[(i + 1) % m.ring.length];
    sink.opak.tri([q[0], y, q[1]], [p[0], y, p[1]], [cx, y + 9, cz], [[r.u1, r.v0], [r.u0, r.v0], [(r.u0 + r.u1) / 2, r.v1]], color);
  });
}

/** Gerbang: dua pilar + balok di atas jalan, dari OBB massa 0 (posisi final M6). */
function gerbang(plan, mats) {
  const sink = createKitSink();
  const { obb } = plan.masses[0];
  const c = Math.cos(obb.yaw);
  const s = Math.sin(obb.yaw);
  const at = (lx) => [obb.cx + lx * c, obb.cz - lx * s];
  const h = 7.5;
  for (const lx of [-obb.w / 2 + 0.8, obb.w / 2 - 0.8]) {
    const [x, z] = at(lx);
    sink.opak.box(x, plan.baseY + h / 2, z, 1.6, h, Math.max(1.6, obb.d), obb.yaw, cellUv('plester'), KREM);
  }
  sink.opak.box(obb.cx, plan.baseY + h - 0.6, obb.cz, obb.w, 1.2, Math.max(1.2, obb.d * 0.8), obb.yaw, cellUv('beton'), OKER);
  return sink.toParts(mats, `${plan.archetype}:${plan.id}`);
}

/** Tribun Stadion Mini: 10 undakan beton naik ke belakang + dinding belakang [INF bentuk]. */
function tribun(plan, mats) {
  const sink = createKitSink();
  const { obb } = plan.masses[0];
  const rows = 10;
  const step = obb.d / rows;
  const c = Math.cos(obb.yaw);
  const s = Math.sin(obb.yaw);
  for (let i = 0; i < rows; i += 1) {
    const lz = obb.d / 2 - step * (i + 0.5);
    const h = 0.45 * (i + 1);
    sink.opak.box(obb.cx + lz * s, plan.groundY + h / 2, obb.cz + lz * c, obb.w, h, step, obb.yaw, cellUv('beton'), linearColor(0xd6d2c8));
  }
  return sink.toParts(mats, `${plan.archetype}:${plan.id}`);
}

export const HERO_BUILDERS = Object.freeze({
  'hero:rektorat': placeholder(rektoratFront),
  'hero:masjid-arfaunnas': placeholder(masjidDome),
  'hero:gerbang-sm-amin': gerbang,
  'hero:ggm': placeholder(ggmCone),
  'hero:sekretariat-lembaga': placeholder(),
  'hero:student-center': placeholder(),
  'hero:stadion-mini': tribun,
});

if (HERO_IDS.some((id) => !HERO_BUILDERS[id])) throw new Error('HERO_BUILDERS tidak lengkap');
