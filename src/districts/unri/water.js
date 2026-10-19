/**
 * Air distrik per chunk (spec §5.3, §5.2.8): bidang datar di muka air (`level` hasil bake) untuk Danau Buatan &
 * Waduk UNRI yang dipahat terrain M1 (tepi bidang tersembunyi di bawah tanggul), dan pita parit gelap ter-drape
 * (lebar 1 m) di dasar cekungan parit (LOD0 saja). Mesh `air+<key>` (tidak ikut registry basah), `parit+<key>`.
 */
import { BufferGeometry, Float32BufferAttribute, Group, ShapeUtils, Vector2 } from 'three';
import { DRAPE, drapePolyline } from '../../world/terrain/drape.js';
import { mergedMesh } from './ground.js';
import { distanceToRings, refineTriangles } from './waterEdge.js';
import { applyStyleSwap } from '../../engine/pbrSwap.js';
import { styleState } from '../../engine/styleState.js';

/** Tepi terpanjang segitiga air (m): cukup halus agar gradasi dangkal->dalam terbentuk, murah untuk badan air kampus. */
export const WATER_MAX_EDGE = 3;

/**
 * Poligon datar (dengan lubang) di y = level, UV dunia, normal +Y, segitiga menghadap atas. Atribut `edgeDist`
 * = jarak simpul ke tepi air (m) untuk gradasi/busa air kartun; `maxEdge` > 0 memecah segitiga agar ada simpul
 * di dalam bidang; tepi yang menempel pada `rect` (garis potong chunk) tidak dihitung sebagai tepi air.
 */
export function waterPlaneGeometry(rings, level, { maxEdge = 0, rect = null, heightAt = null } = {}) {
  const [outer, ...holes] = rings;
  const contour = outer.map(([x, z]) => new Vector2(x, z));
  const holeVecs = holes.map((h) => h.map(([x, z]) => new Vector2(x, z)));
  const faces = ShapeUtils.triangulateShape(contour, holeVecs);
  const base = [...contour, ...holeVecs.flat()];
  const refined = refineTriangles(base.map((v) => [v.x, v.y]), faces, maxEdge);
  const verts = refined.verts.map(([x, y]) => new Vector2(x, y));
  const edge = verts.map((v) => distanceToRings(v.x, v.y, rings, rect));
  // kedalaman di bawah muka air di tiap simpul (level - tanah): busa mengikuti garis air sungguhan, bukan poligon
  const shore = heightAt ? verts.map((v) => Math.max(-4, Math.min(30, level - heightAt(v.x, v.y)))) : edge;
  const pos = [];
  const nor = [];
  const uv = [];
  for (const v of verts) {
    pos.push(v.x, level, v.y);
    nor.push(0, 1, 0);
    uv.push(v.x, v.y);
  }
  const idx = [];
  for (const [a, b, c] of refined.faces) {
    const up = (verts[b].y - verts[a].y) * (verts[c].x - verts[a].x) - (verts[b].x - verts[a].x) * (verts[c].y - verts[a].y);
    if (up >= 0) idx.push(a, b, c);
    else idx.push(a, c, b);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setAttribute('edgeDist', new Float32BufferAttribute(edge, 1));
  g.setAttribute('shoreDepth', new Float32BufferAttribute(shore, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/** Generator → Group air + parit chunk. */
export function* buildWaterMeshes(data, surface, { lod, materials, rect, key }) {
  const out = new Group();
  out.name = `unri:air:${key}`;
  const planes = data.areas.filter((a) => a.kind === 'water').map((a) => waterPlaneGeometry(a.rings, a.level, { maxEdge: WATER_MAX_EDGE, rect, heightAt: surface?.heightAt }));
  const air = mergedMesh(planes, materials.water, `air+${key}`);
  if (air) {
    if (typeof materials.waterToon === 'function') { // kartun/facet: air bergradasi + busa tepi + kilau matahari
      air.userData.pbrSwap = { asli: materials.water, pbr: () => materials.waterToon() };
      applyStyleSwap(air, styleState.style, styleState.terrainQuality);
    }
    out.add(air);
  }
  yield;
  if (lod === 0) {
    const ribbons = data.ditches.map((d) => drapePolyline(d.pts, d.w, surface, { lift: DRAPE.lift.ditch, clipRect: rect }));
    const parit = mergedMesh(ribbons, materials.ditch, `parit+${key}`);
    if (parit) out.add(parit);
  }
  return out;
}
