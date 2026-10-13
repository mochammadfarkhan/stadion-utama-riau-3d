/**
 * Papan nama "STADION UTAMA RIAU" (huruf timbul kotak-kotak) di fasad utara
 * dan logo PON XVIII (lingkaran emas) di fasad barat. Menghadap keluar bangunan.
 */
import {
  BoxGeometry, CircleGeometry, Group, Mesh, MeshLambertMaterial, MeshStandardMaterial, TorusGeometry, Vector2,
} from 'three';
import { COLORS } from '../../config/constants.js';
import { Materials } from '../materials.js';
import { surfaceMaps, TILE_M } from '../textures/surfaces.js';
import { createBlockText } from '../props/BlockText.js';
import { frameAt, framePoint } from './ovalFrame.js';
import { louvreKAt } from './profiles.js';

const NAME_TEXT = 'STADION UTAMA RIAU';
const NAME_U = 0;          // utara
const NAME_Y = 12.5;
const NAME_CELL = 0.32;
const NAME_DEPTH = 0.45;
const NAME_K_OFFSET = -0.035; // di depan bidang louvre
const BACKING_PAD = 1.0;
const BACKING_THICK = 0.3;
const BACKING_ROUGHNESS = 0.7;
const BACKING_NORMAL_SCALE = 0.4;

const LOGO_U = 0.75;       // barat
const LOGO_Y = 20;
const LOGO_RADIUS = 4;
const LOGO_TUBE = 0.35;
const LOGO_K_OFFSET = -0.02;
const LOGO_DISC_COLOR = 0x1f6b3a;

/** Letakkan group pada (u, k, y) menghadap keluar. */
function placeOutward(group, u, k, y) {
  group.position.copy(framePoint(u, k, y));
  group.rotation.y = frameAt(u).yaw;
  return group;
}

/**
 * Material pelat latar navy berpanel ACP (seam vertikal tiap 0,4 m + noise).
 * UV BoxGeometry 0..1 → repeat = ukuran pelat / tile agar skala seam tetap meter.
 */
function createBackingMaterial(w, h) {
  const maps = surfaceMaps('metalSeam', TILE_M.metalSeam);
  Object.values(maps).forEach((t) => t.repeat.set(w / TILE_M.metalSeam, h / TILE_M.metalSeam));
  const mat = new MeshStandardMaterial({
    color: COLORS.navy, roughness: BACKING_ROUGHNESS, metalness: 0.15, ...maps,
    normalScale: new Vector2(BACKING_NORMAL_SCALE, BACKING_NORMAL_SCALE),
  });
  mat.name = 'signBacking';
  mat.userData.baseRoughness = BACKING_ROUGHNESS;
  return mat;
}

/** @returns {Group} papan nama (huruf balok emas) dengan pelat latar navy bertekstur ACP */
export function createNameBoard({ text = NAME_TEXT, u = NAME_U, y = NAME_Y } = {}) {
  const group = new Group();
  group.name = 'name-board';
  const letters = createBlockText(text, { cell: NAME_CELL, depth: NAME_DEPTH });
  const { width, height } = letters.userData;
  const bw = width + BACKING_PAD * 2;
  const bh = height + BACKING_PAD * 2;
  const backing = new Mesh(new BoxGeometry(bw, bh, BACKING_THICK), createBackingMaterial(bw, bh));
  backing.position.z = -NAME_DEPTH / 2 - BACKING_THICK / 2;
  backing.name = 'backing';
  backing.castShadow = true;
  letters.children.forEach((c) => { c.castShadow = true; });
  group.add(backing, letters);
  placeOutward(group, u, louvreKAt(y) + NAME_K_OFFSET, y);
  group.userData = { text, width, height };
  return group;
}

/** @returns {Group} cincin emas + cakram hijau + teks "PON XVIII" */
export function createPonLogo({ u = LOGO_U, y = LOGO_Y } = {}) {
  const group = new Group();
  group.name = 'pon-logo';
  const ring = new Mesh(new TorusGeometry(LOGO_RADIUS, LOGO_TUBE, 12, 48), Materials.gold());
  ring.name = 'ring';
  ring.castShadow = true;
  const disc = new Mesh(new CircleGeometry(LOGO_RADIUS - LOGO_TUBE * 0.5, 48), new MeshLambertMaterial({ color: LOGO_DISC_COLOR }));
  disc.name = 'disc';
  disc.position.z = -0.1;
  const pon = createBlockText('PON', { cell: 0.3, depth: 0.3 });
  pon.position.y = 1.0;
  const xviii = createBlockText('XVIII', { cell: 0.22, depth: 0.3 });
  xviii.position.y = -1.1;
  group.add(ring, disc, pon, xviii);
  placeOutward(group, u, louvreKAt(y) + LOGO_K_OFFSET, y);
  return group;
}
