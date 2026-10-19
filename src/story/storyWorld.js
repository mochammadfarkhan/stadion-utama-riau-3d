/**
 * Data cerita → koordinat dunia (M0 multi-region), murni. Titik di data cerita adalah titik ber-region
 * (story/points.js; tanpa `region` = 'stadion'); StoryDirector bekerja di koordinat dunia sehingga tujuan
 * di region mana pun dibandingkan langsung dengan posisi sepeda. Titik yang region-nya tidak dikenal
 * menjadi null (tujuan tak tercapai, penanda disembunyikan), bukan galat. Input tidak diubah.
 */
import { resolvePoint } from './points.js';

const resolveObjective = (o, frameOf) => {
  if (o.type === 'goto') return { ...o, target: resolvePoint(o.target, frameOf) };
  if (o.type === 'interact' && o.at) return { ...o, at: resolvePoint(o.at, frameOf) }; // M7: titik penanda opsional
  return o;
};

/** Chapter dengan target `goto` di koordinat dunia. */
export function resolveChapters(chapters, frameOf) {
  return chapters.map((c) => ({
    ...c,
    steps: c.steps.map((s) => ({ ...s, objective: resolveObjective(s.objective, frameOf) })),
  }));
}

/** NPC cerita dengan x/z dunia; NPC di region tak dikenal dibuang. */
export function resolveNpcs(npcs, frameOf) {
  return npcs.flatMap((n) => {
    const w = resolvePoint(n, frameOf);
    return w ? [{ ...n, x: w.x, z: w.z }] : [];
  });
}

/** Easter egg: pemicu jarak `at` ke dunia (radius dipertahankan); region tak dikenal → tanpa `at`. */
export function resolveEggs(eggs, frameOf) {
  return eggs.map((e) => {
    if (!e.at) return e;
    const w = resolvePoint(e.at, frameOf);
    return { ...e, at: w ? { ...w, radius: e.at.radius } : undefined };
  });
}

/** Titik jangkar pemicu khusus (eggTriggers) ke dunia; tak dikenal → null. */
export function resolveAnchors(anchors, frameOf) {
  return Object.fromEntries(Object.entries(anchors).map(([k, p]) => [k, resolvePoint(p, frameOf)]));
}
