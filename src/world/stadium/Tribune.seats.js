/**
 * Kursi tribun: InstancedMesh per sektor (16) + 1 InstancedMesh VIP.
 * Penempatan merata lewat tabel panjang busur elips per baris; satu Object3D dummy.
 * Warna blok "pixel" dari palet dengan variasi pudar; sektor utara ~3% kursi hilang.
 * Kursi yang jatuh di koridor terowongan gate utama (baris rendah) dilewati.
 */
import * as THREE from 'three';
import { STADIUM } from '../../config/constants.js';
import {
  createEllipseArcTable, ellipseAngleAtArc, ellipseArcAtAngle, ellipsePoint, mergeFlat, mulberry32,
} from './ovalMath.js';
import {
  BASE_A, BASE_B, ROW_DEPTH, SECTOR_COUNT, VOMITORY_W, WEST_THETA, sectorIndexOf,
} from './Tribune.layout.js';
import { GAP_HALF, arcInRanges, corridorArcRanges, isRowCut } from './tunnelLayout.js';

export const DEFAULT_PALETTE = Object.freeze([0xf2b705, 0xe8711c, 0xd62828, 0x1f7a3a, 0x1d4e89]);
export const SEAT_PITCH = 0.75;      // 0.5 m kursi + celah; menghasilkan ±38 rb kursi
const SEAT_INSET = 0.45;             // posisi kursi di tengah tread
const SEAT_W = STADIUM.seatWidth - 0.04;
const BLOCK_COLS = 6;                // lebar blok warna (kursi)
const BLOCK_ROWS = 2;                // tinggi blok warna (baris)
const MISSING_RATIO = 0.03;
const VIP_ROWS = Object.freeze({ from: 6, to: 14 });
const VIP_HALF_ARC = 11;             // ± meter dari pusat barat
const VIP_SCALE = 1.35;
const VIP_COLOR = 0x152238;
const COLOR_FADE = 0.18;

/** Geometri kursi: dudukan + sandaran (depan = +Z lokal). */
export function createSeatGeometry(scale = 1) {
  const seat = new THREE.BoxGeometry(SEAT_W, 0.06, 0.42).translate(0, 0.42, 0.02);
  const back = new THREE.BoxGeometry(SEAT_W, 0.46, 0.05).translate(0, 0.66, -0.2);
  const g = mergeFlat([seat, back]);
  if (scale !== 1) g.scale(scale, scale, scale);
  return g;
}

function hashInt(a, b, c) {
  let h = (a * 73856093) ^ (b * 19349663) ^ (c * 83492791);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return (h ^ (h >>> 15)) >>> 0;
}

/** Warna kursi: blok palet + variasi pudar kecil (deterministik). */
function seatColor(palette, tierIdx, row, col, rng, target) {
  const idx = hashInt(tierIdx + 1, row / BLOCK_ROWS | 0, col / BLOCK_COLS | 0) % palette.length;
  target.setHex(palette[idx]);
  target.offsetHSL(0, -rng() * COLOR_FADE, (rng() - 0.5) * 0.08);
  return target;
}

/** Posisi busur batas sektor pada tabel baris ini (untuk celah vomitory). */
function vomitoryArcs(table) {
  const step = (Math.PI * 2) / SECTOR_COUNT;
  return Array.from({ length: SECTOR_COUNT + 1 }, (_, k) =>
    k === SECTOR_COUNT ? table.total : ellipseArcAtAngle(table, k * step));
}

function nearVomitory(arcs, s) {
  return arcs.some((b) => Math.abs(s - b) < VOMITORY_W / 2);
}

/** Rentang busur koridor terowongan pada baris ini (kosong bila baris di atas terowongan). */
function tunnelRanges(table, rowBaseY) {
  return isRowCut(rowBaseY) ? corridorArcRanges(table, GAP_HALF + SEAT_W / 2) : [];
}

/** Tempatkan satu baris kursi ke bucket sektor / VIP. */
function placeRow(ctx, tier, tierIdx, row) {
  const offset = tier.offset0 + row * ROW_DEPTH + SEAT_INSET;
  const table = createEllipseArcTable(BASE_A + offset, BASE_B + offset);
  const arcs = vomitoryArcs(table);
  const tunnels = tunnelRanges(table, tier.y0 + row * tier.rise);
  const sWest = ellipseArcAtAngle(table, WEST_THETA);
  const y = tier.y0 + (row + 1) * tier.rise;
  const vipRow = tierIdx === 0 && row >= VIP_ROWS.from && row <= VIP_ROWS.to;
  const n = Math.floor(table.total / ctx.pitch);
  for (let j = 0; j < n; j++) {
    const s = (j + 0.5) * ctx.pitch;
    if (nearVomitory(arcs, s) || arcInRanges(tunnels, s, table.total)) continue;
    const theta = ellipseAngleAtArc(table, s);
    const sector = sectorIndexOf(theta);
    const isVip = vipRow && Math.abs(s - sWest) < VIP_HALF_ARC;
    if (!isVip && ctx.sectors[sector].isNorth && ctx.rng() < MISSING_RATIO) continue;
    const p = ellipsePoint(table.a, table.b, theta);
    ctx.dummy.position.set(p.x, y, p.z);
    ctx.dummy.lookAt(0, y, 0);
    ctx.dummy.updateMatrix();
    const bucket = isVip ? ctx.vip : ctx.buckets[sector];
    bucket.matrices.push(...ctx.dummy.matrix.elements);
    bucket.colors.push(isVip ? ctx.vipColor : seatColor(ctx.palette, tierIdx, row, j, ctx.rng, ctx.tmpColor).clone());
  }
}

/** Buat InstancedMesh dari bucket matriks+warna. */
function buildInstanced(bucket, geometry, material, name) {
  const count = bucket.matrices.length / 16;
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    m.fromArray(bucket.matrices, i * 16);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, bucket.colors[i]);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  mesh.name = name;
  return mesh;
}

/**
 * Kursi semua tier.
 * @returns {{group: THREE.Group, total: number, vip: number, perSector: number[]}}
 */
export function createTribuneSeats(layout, sectors, opts = {}) {
  const ctx = {
    pitch: opts.seatPitch ?? SEAT_PITCH,
    palette: opts.palette ?? DEFAULT_PALETTE,
    rng: mulberry32(opts.seed ?? 2012),
    sectors,
    dummy: new THREE.Object3D(),
    tmpColor: new THREE.Color(),
    vipColor: new THREE.Color(VIP_COLOR),
    buckets: sectors.map(() => ({ matrices: [], colors: [] })),
    vip: { matrices: [], colors: [] },
  };
  layout.tiers.forEach((tier, tierIdx) => {
    for (let row = 0; row < tier.rows; row++) placeRow(ctx, tier, tierIdx, row);
  });
  const geom = createSeatGeometry();
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const group = new THREE.Group();
  group.name = 'kursi';
  const perSector = ctx.buckets.map((b, i) => {
    group.add(buildInstanced(b, geom, mat, `kursiSektor${i}`));
    return b.matrices.length / 16;
  });
  const vipMesh = buildInstanced(ctx.vip, createSeatGeometry(VIP_SCALE), new THREE.MeshLambertMaterial({ color: 0xffffff }), 'kursiVIP');
  group.add(vipMesh);
  const vip = ctx.vip.matrices.length / 16;
  return { group, total: perSector.reduce((a, b) => a + b, 0) + vip, vip, perSector };
}
