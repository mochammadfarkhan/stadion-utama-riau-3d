/**
 * Pintu ganda biru sekre ERC (pintu D5) dari luar, sama dengan interior (src/interiors/sekre/perabot/pintu.js) dan foto asli
 * (docs/research/sekre-erc-foto.md): dua daun navy berpanel 2 × 0,85 m × 2,2 m, gagang tarik stainless vertikal, kusen putih.
 * Ditempel di depan bukaan pintu tunggal bawaan GLB h09 (menutupinya). Koordinat lokal-gedung (x timur, z selatan).
 */
import * as THREE from 'three';
import { boxAt, paint } from '../../world/props/unri/geom.js';
import { mergeAll } from '../../world/siteutil/rounded.js';
import { UKM_DOORS, PLAYER_DOOR_ID } from './sekreUkm.data.js';

export const PINTU_D5 = Object.freeze({ leaf: 0.85, h: 2.2, floorY: 0.45, out: 0.04 });
const NAVY = 0x1f3768;
const NAVY_PANEL = 0x182d58;
const STAINLESS = 0xcfd8dc;
const KUSEN = 0xf2f2ee;

/** Geometri (lokal-gedung, sudah diwarnai) pintu ganda di anchor pintu `id`; normal keluar dinding = arah muka pintu. */
export function pintuGandaGeometry(id = PLAYER_DOOR_ID, { leaf, h, floorY, out } = PINTU_D5) {
  const d = UKM_DOORS.find((v) => v.id === id);
  if (!d) return null;
  const parts = [];
  const w = leaf * 2;
  // dibangun dengan muka menghadap −Z lokal, lalu diputar ke normal pintu
  parts.push(paint(boxAt(w + 0.16, 0.08, 0.1, 0, h, 0), KUSEN));                    // kusen atas
  for (const s of [-1, 1]) parts.push(paint(boxAt(0.08, h, 0.1, s * (leaf + 0.04), 0, 0), KUSEN)); // kusen samping
  for (const s of [-1, 1]) {
    const cx = s * leaf / 2;
    parts.push(paint(boxAt(leaf - 0.01, h - 0.01, 0.05, cx, 0, -0.01), NAVY));
    for (const fx of [-0.18, 0.18]) for (const y of [0.3, 0.95, 1.6]) parts.push(paint(boxAt(0.28, 0.5, 0.01, cx + fx, y, -0.04), NAVY_PANEL));
    const hx = s * 0.08; // gagang di sisi tengah (daun bertemu)
    parts.push(paint(boxAt(0.025, 0.6, 0.025, hx, 0.75, -0.09), STAINLESS));
    for (const y of [0.78, 1.32]) parts.push(paint(boxAt(0.015, 0.015, 0.05, hx, y, -0.06), STAINLESS));
  }
  const geo = mergeAll(parts.map((g) => (g.index ? g.toNonIndexed() : g)));
  const yaw = Math.atan2(-d.normal[0], -d.normal[1]); // −Z lokal → normal keluar
  geo.rotateY(yaw);
  geo.translate(d.x + d.normal[0] * out, floorY, d.z + d.normal[1] * out);
  return geo;
}

/** Mesh pintu ganda D5 (satu draw call). */
export function createPintuGandaD5() {
  const geo = pintuGandaGeometry();
  if (!geo) return null;
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.1 }));
  mesh.name = 'ukm-gedung:pintu-ganda-D5';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
