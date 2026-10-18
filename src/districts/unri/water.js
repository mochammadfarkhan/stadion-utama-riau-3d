/**
 * Air distrik per chunk (spec §5.3, §5.2.8): bidang datar di muka air (`level` hasil bake) untuk Danau Buatan &
 * Waduk UNRI yang dipahat terrain M1 (tepi bidang tersembunyi di bawah tanggul), dan pita parit gelap ter-drape
 * (lebar 1 m) di dasar cekungan parit (LOD0 saja). Mesh `air+<key>` (tidak ikut registry basah), `parit+<key>`.
 */
import { BufferGeometry, Float32BufferAttribute, Group, ShapeUtils, Vector2 } from 'three';
import { DRAPE, drapePolyline } from '../../world/terrain/drape.js';
import { mergedMesh } from './ground.js';

/** Poligon datar (dengan lubang) di y = level, UV dunia, normal +Y, segitiga menghadap atas. */
export function waterPlaneGeometry(rings, level) {
  const [outer, ...holes] = rings;
  const contour = outer.map(([x, z]) => new Vector2(x, z));
  const holeVecs = holes.map((h) => h.map(([x, z]) => new Vector2(x, z)));
  const faces = ShapeUtils.triangulateShape(contour, holeVecs);
  const verts = [...contour, ...holeVecs.flat()];
  const pos = [];
  const nor = [];
  const uv = [];
  for (const v of verts) {
    pos.push(v.x, level, v.y);
    nor.push(0, 1, 0);
    uv.push(v.x, v.y);
  }
  const idx = [];
  for (const [a, b, c] of faces) {
    const up = (verts[b].y - verts[a].y) * (verts[c].x - verts[a].x) - (verts[b].x - verts[a].x) * (verts[c].y - verts[a].y);
    if (up >= 0) idx.push(a, b, c);
    else idx.push(a, c, b);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/** Generator → Group air + parit chunk. */
export function* buildWaterMeshes(data, surface, { lod, materials, rect, key }) {
  const out = new Group();
  out.name = `unri:air:${key}`;
  const planes = data.areas.filter((a) => a.kind === 'water').map((a) => waterPlaneGeometry(a.rings, a.level));
  const air = mergedMesh(planes, materials.water, `air+${key}`);
  if (air) out.add(air);
  yield;
  if (lod === 0) {
    const ribbons = data.ditches.map((d) => drapePolyline(d.pts, d.w, surface, { lift: DRAPE.lift.ditch, clipRect: rect }));
    const parit = mergedMesh(ribbons, materials.ditch, `parit+${key}`);
    if (parit) out.add(parit);
  }
  return out;
}
