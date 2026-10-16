/**
 * Laporan ringkas hasil bake + peringatan anggaran (tidak menggagalkan bake).
 */
import { BUDGET } from './config.js';

const kb = (b) => `${(b / 1024).toFixed(1)} KB`;
const mb = (b) => `${(b / 1024 / 1024).toFixed(2)} MB`;

/**
 * @param {object} manifest manifest hasil bake
 * @param {string[]} areaIds area yang baru di-bake (ditampilkan per tile)
 * @param {{tileBytes: number, totalBytes: number}} [budget]
 * @returns {{lines: string[], warnings: string[]}}
 */
export function summarize(manifest, areaIds, budget = BUDGET) {
  const lines = [];
  const warnings = [];
  for (const id of areaIds) {
    const tiles = manifest.tiles.filter((t) => t.area === id);
    const bytes = tiles.reduce((s, t) => s + t.bytes, 0);
    lines.push(`Area ${id}: ${tiles.length} tile, ${mb(bytes)}`);
    for (const t of tiles) {
      const near = t.lod[0].bytes + t.data.bytes;
      lines.push(`  ${t.key.padEnd(8)} LOD0 ${kb(t.lod[0].bytes).padStart(10)} ${String(t.lod[0].triangles).padStart(7)} seg | `
        + `LOD1 ${kb(t.lod[1].bytes).padStart(10)} ${String(t.lod[1].triangles).padStart(7)} seg | data ${kb(t.data.bytes)}`);
      if (near > budget.tileBytes) warnings.push(`tile ${t.key}: LOD0+data ${kb(near)} > ${kb(budget.tileBytes)}`);
    }
  }
  const total = manifest.tiles.reduce((s, t) => s + t.bytes, 0);
  lines.push(`Total manifest: ${manifest.tiles.length} tile, ${mb(total)}`);
  if (total > budget.totalBytes) warnings.push(`total ${mb(total)} > ${mb(budget.totalBytes)}`);
  return { lines, warnings };
}
