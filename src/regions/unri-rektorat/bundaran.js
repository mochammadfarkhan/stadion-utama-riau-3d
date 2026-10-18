// src/regions/unri-rektorat/bundaran.js
/**
 * Taman tengah Putaran Jl. Mukhtar Luthfi / Depan Rektorat (OSM way 327363975): putaran-U mengelilingi
 * ujung timur danau; daratan di dalamnya = bulan sabit berumput dengan kerb beton rendah [T geometri OSM;
 * isi taman INFERENSI: rumput, palem pengapit papan batu N01, PJU — palem & PJU dari LAYOUT/porosTaman].
 */
import * as THREE from 'three';
import { LAYOUT } from './layout.js';
import { MATS } from './materials.js';
import { drapePolygonLocal, kerbWall } from './env.js';

/** @returns {THREE.Group} raw statis (digabung oleh index.js) */
export function buildBundaran(env) {
  const g = new THREE.Group();
  g.name = 'bundaranPutaran';
  const ring = LAYOUT.tamanBundaran;
  const lawn = new THREE.Mesh(drapePolygonLocal(env, ring, { lift: 0.05, maxEdge: 2 }), MATS.rumput());
  lawn.name = 'rumput';
  lawn.receiveShadow = true;
  const kerb = new THREE.Mesh(kerbWall(env, [...ring, ring[0]], 0, 0.15, 1.5), MATS.betonDS());
  kerb.name = 'kerb';
  kerb.receiveShadow = true;
  g.add(lawn, kerb);
  return g;
}
