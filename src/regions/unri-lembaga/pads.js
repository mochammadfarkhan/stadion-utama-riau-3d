/**
 * Pad terrain hero (spec §4.3 `pads`, §5.2 langkah 7): campusbake meratakan terrain di dalam ring ke
 * median tanah (blend 4 m). Ring region-lokal; `lembagaPadsWorld()` untuk tools/campusbake/config.js.
 */
import { convexHull, ringBounds } from '../../geo/polygon.js';
import { toWorld } from '../../geo/regionTransform.js';
import { FOOTPRINTS, LEMBAGA_PLACEMENT, fromSekre, SEKRE_SIZE } from './placement.js';
import { boxRing } from './sekreUkm.data.js';

/** Margin pad sekretariat dari dinding (m): sisi panjang 5 (motor parkir + pagar), ujung selasar 6 (teras). */
export const SEKRE_PAD_MARGIN = Object.freeze({ x: 5, z: 6 });
const SC_PAD_MARGIN = 6;

/** Kotak dunia pad area sekre UKM blok biru (dokumen sekre-ukm §3): gedung + halaman, kompleks lapangan, gubuk panahan. */
export const UKM_PAD_BOXES = Object.freeze({
  gedung: Object.freeze({ minX: -121, maxX: -78, minZ: 996, maxZ: 1034 }),
  lapangan: Object.freeze({ minX: -125, maxX: -46, minZ: 912, maxZ: 964 }),
  gubuk: Object.freeze({ minX: -119, maxX: -105, minZ: 966, maxZ: 999 }),
});

const freeze = (pts) => Object.freeze(pts.map(([x, z]) => Object.freeze([x, z])));

function sekretariatPad() {
  const hx = SEKRE_SIZE.width / 2 + SEKRE_PAD_MARGIN.x;
  const hz = SEKRE_SIZE.length / 2 + SEKRE_PAD_MARGIN.z;
  return freeze([[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]].map(([bx, bz]) => {
    const p = fromSekre(bx, bz);
    return [p.x, p.z];
  }));
}

function rectAround(ring, m) {
  const b = ringBounds(ring);
  return freeze([[b.minX - m, b.minZ - m], [b.maxX + m, b.minZ - m], [b.maxX + m, b.maxZ + m], [b.minX - m, b.maxZ + m]]);
}

export const LEMBAGA_PADS = Object.freeze([
  Object.freeze({ id: 'sekretariat', ring: sekretariatPad(), y: 'median' }),
  Object.freeze({ id: 'stadion-mini', ring: freeze(convexHull([...FOOTPRINTS.stadionMini, ...FOOTPRINTS.tribun])), y: 'median' }),
  Object.freeze({ id: 'student-center', ring: rectAround(FOOTPRINTS.studentCenter, SC_PAD_MARGIN), y: 'median' }),
  ...Object.entries(UKM_PAD_BOXES).map(([k, b]) => Object.freeze({ id: `ukm-${k}`, ring: boxRing(b), y: 'median' })),
]);

/** Pad dalam koordinat DUNIA (dipakai tools/campusbake/config.js). */
export function lembagaPadsWorld(placement = LEMBAGA_PLACEMENT, pads = LEMBAGA_PADS) {
  return pads.map((p) => ({
    id: `unri-lembaga:${p.id}`,
    y: p.y,
    ring: p.ring.map(([x, z]) => {
      const w = toWorld(placement, x, z);
      return [w.x, w.z];
    }),
  }));
}
