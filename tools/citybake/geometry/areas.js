/**
 * Poligon datar (air, landuse, atap datar) → segitiga menghadap +Y. Triangulasi memakai
 * THREE.ShapeUtils.triangulateShape (earcut; three sudah dependensi proyek dan dapat diimpor di Node).
 */
import { ShapeUtils, Vector2 } from 'three';
import { addUpTriangle } from './meshBuilder.js';

/**
 * Tambah poligon (dengan lubang) pada ketinggian y.
 * @param {ReturnType<import('./meshBuilder.js').createMeshBuilder>} builder
 * @param {Array<Array<[number, number]>>} rings [luar, ...lubang] (tile-lokal, terbuka)
 * @param {number} y
 * @param {[number, number, number]} rgb warna linear
 * @returns {number} jumlah segitiga yang ditambahkan
 */
export function addFlatPolygon(builder, rings, y, rgb) {
  const [outer, ...holes] = rings;
  if (!outer || outer.length < 3) return 0;
  const contour = outer.map(([x, z]) => new Vector2(x, z));
  const holeVecs = holes.filter((h) => h.length >= 3).map((h) => h.map(([x, z]) => new Vector2(x, z)));
  const faces = ShapeUtils.triangulateShape(contour, holeVecs);
  // triangulateShape dapat membuang titik ujung duplikat secara in-place: pakai array setelah dipanggil.
  const verts = [...contour, ...holeVecs.flat()];
  const base = builder.vertexCount;
  for (const v of verts) builder.addVertex(v.x, y, v.y, 0, 1, 0, rgb);
  const xz = (i) => [verts[i - base].x, verts[i - base].y];
  for (const [a, b, c] of faces) addUpTriangle(builder, base + a, base + b, base + c, xz);
  return faces.length;
}
