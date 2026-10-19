/**
 * Laporan bake terrain (spec §5.2 langkah 10): min/max/rerata y di dalam distrik, h_ref, tanjakan maks
 * per jalan (diukur ulang pada grid akhir), jumlah chunk, ukuran byte. Peringatan tidak menggagalkan bake.
 */
import { resamplePolyline, maxGradeOf } from './terrain/roads.js';
import { sampleGrid } from './terrain/grid.js';

const kb = (b) => `${(b / 1024).toFixed(1)} KB`;
/** Toleransi ukur ulang: grid 4 m + bilinear menambah ±1% di tikungan/simpang. */
export const GRADE_TOLERANCE = 0.01;

/**
 * @param {{grid:object, data:Float64Array, weights:Float32Array, chunks:Array<{key:string, buffer:{byteLength:number}}>, stats:object}} baked
 * @param {Array<{id:string, cls:string, line:Array<[number,number]>}>} roads
 * @param {{maxGrade:number, budgetBytes:number}} limits
 * @returns {{lines:string[], warnings:string[], summary:object}}
 */
export function terrainReport(baked, roads, { maxGrade, budgetBytes }) {
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < baked.data.length; i += 1) {
    if (!(baked.weights[i] > 0)) continue;
    const y = baked.data[i];
    min = Math.min(min, y);
    max = Math.max(max, y);
    sum += y;
    count += 1;
  }
  const grades = roads.map((r) => {
    const { pts, s } = resamplePolyline(r.line, baked.grid.step);
    const inside = pts.map(([x, z]) => sampleGrid(baked.grid, baked.weights, x, z) > 0);
    const values = pts.map(([x, z]) => sampleGrid(baked.grid, baked.data, x, z));
    return { id: r.id, cls: r.cls, grade: inside.some(Boolean) ? maxGradeOf(values, s) : 0 };
  }).sort((a, b) => b.grade - a.grade || (a.id < b.id ? -1 : 1));
  const bytes = baked.chunks.reduce((s, c) => s + c.buffer.byteLength, 0);
  const steep = grades.filter((g) => g.grade > maxGrade + GRADE_TOLERANCE);
  const summary = {
    min: count ? min : 0, max: count ? max : 0, mean: count ? sum / count : 0, hRef: baked.stats.hRef,
    chunks: baked.chunks.length, bytes, roads: grades.length, steep: steep.length, ms: baked.stats.ms,
  };
  const lines = [
    `Terrain: ${summary.chunks} chunk, ${kb(bytes)}, h_ref ${summary.hRef.toFixed(2)} m, ${(summary.ms / 1000).toFixed(1)} s`,
    `  y di distrik: min ${summary.min.toFixed(2)} m, maks ${summary.max.toFixed(2)} m, rerata ${summary.mean.toFixed(2)} m`,
    `  Jalan: ${grades.length}, tanjakan > ${((maxGrade + GRADE_TOLERANCE) * 100).toFixed(0)}%: ${steep.length}`,
    ...grades.slice(0, 8).map((g) => `    ${g.id.padEnd(12)} ${g.cls.padEnd(14)} ${(g.grade * 100).toFixed(2)}%`),
    ...baked.stats.water.map((w) => `  Air ${w.id} (${w.name ?? '-'}): muka ${w.level} m, dasar ${w.bed} m`),
  ];
  const warnings = [];
  if (bytes > budgetBytes) warnings.push(`terrain ${kb(bytes)} > anggaran ${kb(budgetBytes)}`);
  for (const g of steep.slice(0, 10)) warnings.push(`jalan ${g.id} (${g.cls}) tanjakan ${(g.grade * 100).toFixed(1)}% setelah pad/air`);
  return { lines, warnings, summary };
}
