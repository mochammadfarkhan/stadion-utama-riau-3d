/**
 * Huruf timbul dari kotak-kotak (InstancedMesh) berdasarkan font bitmap 5×7.
 * Tidak butuh FontLoader/document — aman di Node. Teks dipusatkan di origin, menghadap +Z.
 */
import { BoxGeometry, Group, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { COLORS } from '../../config/constants.js';
import { instancedFromMatrices } from '../util/instancing.js';
import { BLOCK_FONT, GLYPH_H, GLYPH_W } from './blockFont.js';

const DEFAULT_CELL = 0.3;
const DEFAULT_DEPTH = 0.3;
const CHAR_GAP = 1; // sel kosong antar huruf

/** Kumpulkan posisi sel terisi untuk sebuah string (satuan sel, origin kiri-bawah). */
function collectCells(text) {
  const cells = [];
  const chars = [...String(text).toUpperCase()];
  chars.forEach((ch, ci) => {
    const glyph = BLOCK_FONT[ch] ?? BLOCK_FONT[' '];
    const x0 = ci * (GLYPH_W + CHAR_GAP);
    glyph.forEach((row, r) => {
      for (let c = 0; c < GLYPH_W; c++) {
        if (row[c] === '#') cells.push({ x: x0 + c, y: GLYPH_H - 1 - r });
      }
    });
  });
  const width = chars.length * (GLYPH_W + CHAR_GAP) - CHAR_GAP;
  return { cells, width, height: GLYPH_H };
}

/**
 * @param {string} text
 * @param {{cell?:number, depth?:number, color?:number, material?:import('three').Material}} opts
 * @returns {Group} userData: { width, height, text }
 */
export function createBlockText(text, { cell = DEFAULT_CELL, depth = DEFAULT_DEPTH, color = COLORS.gold, material } = {}) {
  const group = new Group();
  group.name = `block-text:${text}`;
  const { cells, width, height } = collectCells(text);
  const mat = material ?? new MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.6 });
  const geom = new BoxGeometry(cell, cell, depth);
  const q = new Quaternion();
  const s = new Vector3(1, 1, 1);
  const offX = (-width / 2 + 0.5) * cell;
  const offY = (-height / 2 + 0.5) * cell;
  const mats = cells.map((c) => new Matrix4().compose(new Vector3(offX + c.x * cell, offY + c.y * cell, 0), q, s));
  if (mats.length > 0) {
    group.add(instancedFromMatrices(geom, mat, mats, 'block-text-cells'));
  }
  group.userData = { width: width * cell, height: height * cell, text };
  return group;
}
