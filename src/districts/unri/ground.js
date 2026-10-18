/**
 * Permukaan keras distrik per chunk & LOD (spec §5.3): aspal (+ marka putus-putus tengah jalan utama), trotoar
 * beton, paving parkir/plaza, rumput lapangan — ter-drape pada permukaan aman-mesh chunk, dipotong tepat ke
 * persegi chunk, digabung SATU mesh per material (≤ 5 draw call/chunk). Nama mesh `<dasar>+<key>` dengan dasar
 * `aspal`, `trotoar`, `plazaPaving`, `rumput` = nama registry basah Weather.wet (dipotong di '+').
 * LOD1 (> 600 m): tanpa marka/trotoar, lift + LOD1_EXTRA_LIFT. Juga tintTerrainRoot (warna vertex terrain).
 */
import { Float32BufferAttribute, Group, Mesh, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DRAPE, drapePolygon, drapePolyline } from '../../world/terrain/drape.js';
import { polylineLength, slicePolyline } from '../../geo/lineClip.js';
import { surfaceColors } from './surfaceTint.js';

export const MARKED_CLASSES = Object.freeze(['primary', 'secondary', 'tertiary', 'primary_link', 'secondary_link', 'tertiary_link']);
/** Marka putus-putus putih tengah jalur (foto drone 2016) [INFERENSI ukuran: garis 3 m, celah 5 m, lebar 12 cm]. */
export const DASH = Object.freeze({ length: 3, gap: 5, width: 0.12, minRoadWidth: 6 });
/** Tambahan lift LOD1: presisi depth ±0,13 m di 800 m (near 0,3 / far 2.500, depth 24-bit). */
export const LOD1_EXTRA_LIFT = 0.2;
/** Pecahan drape LOD1 (m): sel permukaan LOD1 16 m, jadi 8 m cukup (LOD0 memakai DRAPE.segment/maxEdge = 2 m). */
export const LOD1_SEGMENT = 8;

/** Interval [s0, s1] marka sepanjang polyline sepanjang `length` m (mulai gap/2). */
export function dashIntervals(length, dash = DASH) {
  const out = [];
  for (let s = dash.gap / 2; s + dash.length <= length; s += dash.length + dash.gap) out.push([s, s + dash.length]);
  return out;
}

/** Gabung geometri tak-kosong menjadi satu Mesh bernama (sumber dilepas); null bila semuanya kosong. */
export function mergedMesh(list, material, name) {
  const geos = list.filter((g) => (g.getAttribute('position')?.count ?? 0) > 0);
  for (const g of list) if (!geos.includes(g)) g.dispose();
  if (geos.length === 0) return null;
  const geometry = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
  if (geos.length > 1) for (const g of geos) g.dispose();
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.userData.ownsGeometry = true;
  return mesh;
}

/**
 * Generator (titik potong scheduler tiap jalan/area) → Group permukaan keras chunk.
 * @param {ReturnType<import('./groundData.js').parseGroundChunk>} data
 * @param {{heightAt: Function, normalAt: Function}} surface createChunkSurface untuk LOD ini
 * @param {{lod: number, materials: object, rect: {minX:number,minZ:number,maxX:number,maxZ:number}, key: string}} opts
 */
export function* buildGroundMeshes(data, surface, { lod, materials, rect, key }) {
  const extra = lod === 0 ? 0 : LOD1_EXTRA_LIFT;
  const seg = lod === 0 ? {} : { segment: LOD1_SEGMENT, maxEdge: LOD1_SEGMENT };
  const opts = (lift) => ({ lift: lift + extra, clipRect: rect, ...seg });
  const geos = { aspal: [], marka: [], trotoar: [], plazaPaving: [], rumput: [] };
  for (const r of data.roads) {
    geos.aspal.push(drapePolyline(r.pts, r.w, surface, opts(DRAPE.lift.road)));
    if (lod === 0 && MARKED_CLASSES.includes(r.cls) && r.w >= DASH.minRoadWidth) {
      for (const [s0, s1] of dashIntervals(polylineLength(r.pts))) {
        geos.marka.push(drapePolyline(slicePolyline(r.pts, s0, s1), DASH.width, surface, opts(DRAPE.lift.marking)));
      }
    }
    yield;
  }
  if (lod === 0) {
    for (const w of data.walks) geos.trotoar.push(drapePolyline(w.pts, w.w, surface, opts(DRAPE.lift.walk)));
    yield;
  }
  for (const a of data.areas) {
    if (a.kind === 'water') continue;
    const pitch = a.kind === 'pitch';
    (pitch ? geos.rumput : geos.plazaPaving).push(drapePolygon(a.rings, surface, opts(pitch ? DRAPE.lift.pitch : DRAPE.lift.paving)));
    yield;
  }
  const mats = { aspal: materials.asphalt, marka: materials.marking, trotoar: materials.walk, plazaPaving: materials.paving, rumput: materials.pitch };
  const out = new Group();
  out.name = `unri:keras:${key}`;
  for (const [name, list] of Object.entries(geos)) {
    const mesh = mergedMesh(list, mats[name], `${name}+${key}`);
    if (mesh) out.add(mesh);
  }
  return out;
}

const _v = new Vector3();

/**
 * Warnai semua mesh di bawah `root` (mesh terrain chunk M1) dari bobot permukaan: atribut `color` per simpul
 * (posisi dunia → bilinear grid bobot), material diganti `material` (vertexColors), ditandai permukaan basah.
 */
export function tintTerrainRoot(root, weights, origin, material, tints) {
  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    if (!o.isMesh) return;
    const pos = o.geometry.getAttribute('position');
    const xz = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i += 1) {
      _v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      xz[2 * i] = _v.x;
      xz[2 * i + 1] = _v.z;
    }
    o.geometry.setAttribute('color', new Float32BufferAttribute(surfaceColors(xz, weights, origin, tints), 3));
    o.material = material;
    o.userData.wetSurface = true;
  });
}
