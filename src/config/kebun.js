/**
 * Mini game kebun dekat sekre ERC (koordinat DUNIA, +X timur, +Z selatan). Lahan rumput antara lintasan stadion
 * mini (tepi timur x ≈ −186) dan Jl. Prof. Aras Mulyadi (sumbu x ≈ −139): petak 8 × 5 @ 2 m + rumah panggung
 * menghadap timur ke jalan. Letak & bentuk [INFERENSI] (bukan fasilitas nyata kampus). Juga konfigurasi mode pemain.
 */
import { BIKE } from './constants.js';

export const KEBUN = Object.freeze({
  /** sudut barat laut petak (0,0); petak [col,row] berpusat di origin + (col+0.5, row+0.5)·tile */
  origin: Object.freeze({ x: -168, z: 968 }),
  cols: 8,
  rows: 5,
  tile: 2,
  house: Object.freeze({ x: -162, z: 988, yaw: Math.PI / 2, w: 6, d: 5, porch: 1.5 }),
  visibleRadius: 260, // m: di luar ini grup kebun disembunyikan (0 draw call)
  reach: 1.6,         // m: jangkauan aksi E di depan pemain
  price: 6000,        // Rp per panen cabai
  seedPrice: 1000,    // Rp per benih
  growHours: 3,       // jam dunia per tahap tumbuh (hanya saat tersiram)
});

/** Pusat petak [col,row] (dunia). */
export function tileCenter(col, row, k = KEBUN) {
  return { x: k.origin.x + (col + 0.5) * k.tile, z: k.origin.z + (row + 0.5) * k.tile };
}

/** Indeks petak di (x,z) dunia, atau -1 bila di luar lahan. */
export function tileIndexAt(x, z, k = KEBUN) {
  const col = Math.floor((x - k.origin.x) / k.tile);
  const row = Math.floor((z - k.origin.z) / k.tile);
  if (col < 0 || row < 0 || col >= k.cols || row >= k.rows) return -1;
  return row * k.cols + col;
}

/** Cincin footprint rumah + teras (dunia, untuk collider). */
export function houseRing(k = KEBUN) {
  const { x, z, yaw, w, d, porch } = k.house;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  // lokal: x lebar, z kedalaman (depan +z = teras); dunia = rotasi yaw (maju lokal +Z → (sin, cos))
  const local = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2 + porch], [-w / 2, d / 2 + porch]];
  return Object.freeze(local.map(([lx, lz]) => Object.freeze([x + lx * c + lz * s, z - lx * s + lz * c])));
}

/** Mode pemain: urutan tombol F. */
export const PLAYER_MODES = Object.freeze(['jalan', 'sepeda', 'traktor']);
export const MODE_LABEL = Object.freeze({ jalan: 'Jalan kaki', sepeda: 'Sepeda', traktor: 'Traktor' });

/** Jalan kaki: A/D memutar badan di tempat, W/S maju/mundur, Shift lari. */
export const WALK = Object.freeze({ walk: 1.6, run: 4.2, back: 1.0, accel: 8, turnRate: 2.6 });

/** Traktor: sepeda kinematik yang lambat, berat, tanpa condong. */
export const TRACTOR = Object.freeze({
  ...BIKE,
  maxSpeed: 4.2, sprintSpeed: 6, accel: 1.8, brake: 5, drag: 0.9,
  wheelRadius: 0.62, leanMax: 0, wheelBase: 1.7, steerMax: 0.6, steerRate: 3, steerSpeedFactor: 0.05,
  reverseSpeed: 2, reverseAccel: 1.5, pedalRatio: 0, kSlope: 0.3, climbLoss: 1,
});
