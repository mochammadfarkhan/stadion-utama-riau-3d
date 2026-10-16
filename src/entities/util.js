/**
 * Utilitas bersama untuk modul entitas: material per ResourceScope, RNG deterministik, dan helper matematika kecil.
 */
import * as THREE from 'three';
import { currentScope } from '../engine/ResourceScope.js';

/**
 * Material Lambert yang di-cache per warna agar jumlah material tetap kecil
 * (ratusan Humanoid berbagi material yang sama).
 * @param {number} color hex
 * @param {{emissive?: number, side?: number}} [extra]
 */
export function matFor(color, extra = {}) {
  const key = `${color}|${extra.emissive ?? 0}|${extra.side ?? 0}`;
  return currentScope().get(`entities:mat:${key}`, () => new THREE.MeshLambertMaterial({
    color,
    emissive: extra.emissive ?? 0x000000,
    side: extra.side ?? THREE.FrontSide,
  }));
}

/**
 * RNG deterministik (mulberry32) agar tata letak kerumunan stabil antar reload.
 * @param {number} seed
 * @returns {() => number} fungsi yang mengembalikan [0,1)
 */
export function makeRng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pilih elemen acak dari array menggunakan rng yang diberikan. */
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

/** Angka acak dalam rentang [min, max). */
export function range(rng, min, max) {
  return min + (max - min) * rng();
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Normalisasi sudut ke rentang (-PI, PI]. */
export function wrapAngle(a) {
  let r = a % (Math.PI * 2);
  if (r > Math.PI) r -= Math.PI * 2;
  if (r <= -Math.PI) r += Math.PI * 2;
  return r;
}

/** Interpolasi sudut lewat jalur terpendek. */
export function lerpAngle(a, b, t) {
  return a + wrapAngle(b - a) * t;
}

/** true bila semua komponen bilangan hingga (guard NaN dari sim). */
export function isFiniteXZ(p) {
  return !!p && Number.isFinite(p.x) && Number.isFinite(p.z);
}

/** Yaw (rotasi Y) agar model yang menghadap +Z lokal mengarah ke vektor (dx, dz). */
export function yawFromDir(dx, dz) {
  return Math.atan2(dx, dz);
}

/** Sudut kecil untuk kondisi "hampir tidak bergerak". */
export const EPS_MOVE = 1e-4;

/** Apakah kode berjalan di browser dengan DOM (untuk guard CSS2D/Canvas). */
export const HAS_DOM = typeof document !== 'undefined';
