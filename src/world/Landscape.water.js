import * as THREE from 'three';
import { SITE, COLORS } from '../config/constants.js';
import { ellipseDiscGeometry } from './siteutil/ellipseGeo.js';
import { rippleTexture } from './siteutil/proceduralTextures.js';
import { ZONES } from './Landscape.zones.js';

/**
 * Elemen air: danau, sungai kecil + parit, jembatan besi rangka.
 * Animasi ringan lewat userData.update (offset tekstur & opacity) tanpa Water addon.
 */
const WATER_Y = 0.035;
const BANK_Y = 0.025;
const RIVER = Object.freeze({ length: 620, bankWidth: 10, ditchOffset: 16, ditchWidth: 2.2, ditchDepth: 0.8 });
const BRIDGE = Object.freeze({ length: 14, width: 3.2, deckH: 0.3, trussH: 2.4, bays: 6, color: 0x7b8394 });

const WATER = Object.freeze({ roughness: 0.3, opacity: 0.85, opacityWave: 0.02, riverTint: 0x6fc4c2 });
const bankMat = new THREE.MeshLambertMaterial({ color: 0xcdb98f });
const steelMat = new THREE.MeshStandardMaterial({ color: BRIDGE.color, roughness: 0.85, metalness: 0 });
const ditchMat = new THREE.MeshLambertMaterial({ color: 0xbdb9ae });

/** Material air toska pastel (matte, agak transparan) dengan tekstur riak. */
export function createWaterMaterial(tint = COLORS.water) {
  return new THREE.MeshStandardMaterial({
    color: tint,
    roughness: WATER.roughness,
    metalness: 0,
    transparent: true,
    opacity: WATER.opacity,
    map: rippleTexture(8),
  });
}

/** Fungsi animasi: geser offset riak & modulasi opacity tipis. */
export function animateWater(material, dt, t) {
  if (material.map) material.map.offset.set(t * 0.012, t * 0.008);
  material.opacity = WATER.opacity + Math.sin(t * 0.9) * WATER.opacityWave;
}

/** Danau: cakram elips biru + tepi tanah. */
export function createLake() {
  const { x, z } = SITE.lakeCenter;
  const { semiX, semiZ } = ZONES.lake;
  const g = new THREE.Group();
  g.name = 'danau';
  const bank = new THREE.Mesh(ellipseDiscGeometry(semiX + 5, semiZ + 5), bankMat);
  bank.position.y = BANK_Y;
  bank.receiveShadow = true;
  g.add(bank);
  const mat = createWaterMaterial();
  const water = new THREE.Mesh(ellipseDiscGeometry(semiX, semiZ), mat);
  water.position.y = WATER_Y;
  water.name = 'airDanau';
  g.add(water);
  g.position.set(x, 0, z);
  g.userData.waterMaterial = mat;
  return g;
}

/** Sungai kecil memanjang sumbu Z + parit beton paralel. */
export function createRiver(waterMat = createWaterMaterial(WATER.riverTint)) {
  const g = new THREE.Group();
  g.name = 'sungai';
  const bank = new THREE.Mesh(new THREE.PlaneGeometry(RIVER.bankWidth, RIVER.length), bankMat);
  bank.rotation.x = -Math.PI / 2;
  bank.position.set(SITE.riverX, BANK_Y, 0);
  g.add(bank);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(SITE.riverWidth, RIVER.length), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(SITE.riverX, WATER_Y, 0);
  water.name = 'airSungai';
  g.add(water);
  // parit beton (dinding + air gelap)
  const ditchX = SITE.riverX + RIVER.ditchOffset;
  const wall = new THREE.Mesh(new THREE.BoxGeometry(RIVER.ditchWidth + 0.6, RIVER.ditchDepth, RIVER.length * 0.8), ditchMat);
  wall.position.set(ditchX, 0.1, 0);
  g.add(wall);
  const ditchWater = new THREE.Mesh(new THREE.PlaneGeometry(RIVER.ditchWidth, RIVER.length * 0.8), waterMat);
  ditchWater.rotation.x = -Math.PI / 2;
  ditchWater.position.set(ditchX, 0.52, 0);
  g.add(ditchWater);
  g.userData.waterMaterial = waterMat;
  return g;
}

/** Satu sisi rangka (truss) jembatan: chord atas/bawah, tiang, diagonal. */
function trussSide(zOffset) {
  const side = new THREE.Group();
  const bayLen = BRIDGE.length / BRIDGE.bays;
  const chord = new THREE.BoxGeometry(BRIDGE.length, 0.12, 0.12);
  const top = new THREE.Mesh(chord, steelMat);
  top.position.set(0, BRIDGE.trussH, zOffset);
  const bottom = new THREE.Mesh(chord, steelMat);
  bottom.position.set(0, BRIDGE.deckH, zOffset);
  side.add(top, bottom);
  const post = new THREE.BoxGeometry(0.1, BRIDGE.trussH - BRIDGE.deckH, 0.1);
  const diagLen = Math.hypot(bayLen, BRIDGE.trussH - BRIDGE.deckH);
  const diag = new THREE.BoxGeometry(0.08, diagLen, 0.08);
  for (let i = 0; i <= BRIDGE.bays; i += 1) {
    const x = -BRIDGE.length / 2 + i * bayLen;
    const p = new THREE.Mesh(post, steelMat);
    p.position.set(x, (BRIDGE.trussH + BRIDGE.deckH) / 2, zOffset);
    side.add(p);
    if (i === BRIDGE.bays) break;
    const d = new THREE.Mesh(diag, steelMat);
    d.position.set(x + bayLen / 2, (BRIDGE.trussH + BRIDGE.deckH) / 2, zOffset);
    d.rotation.z = (i % 2 === 0 ? 1 : -1) * Math.atan2(bayLen, BRIDGE.trussH - BRIDGE.deckH);
    side.add(d);
  }
  return side;
}

/** Jembatan besi rangka tanpa atap melintang sungai (memanjang sumbu X). */
export function createSteelBridge() {
  const g = new THREE.Group();
  g.name = 'jembatanBesi';
  const deck = new THREE.Mesh(new THREE.BoxGeometry(BRIDGE.length, BRIDGE.deckH, BRIDGE.width), ditchMat);
  deck.position.y = BRIDGE.deckH / 2 + 0.4;
  deck.castShadow = true;
  deck.receiveShadow = true;
  g.add(deck);
  const half = BRIDGE.width / 2;
  [trussSide(-half), trussSide(half)].forEach((s) => {
    s.position.y = 0.4;
    g.add(s);
  });
  // balok lintang atas
  const beam = new THREE.BoxGeometry(0.1, 0.1, BRIDGE.width);
  for (let i = 0; i <= BRIDGE.bays; i += 1) {
    const b = new THREE.Mesh(beam, steelMat);
    b.position.set(-BRIDGE.length / 2 + (i * BRIDGE.length) / BRIDGE.bays, BRIDGE.trussH + 0.4, 0);
    g.add(b);
  }
  // abutment beton dua ujung
  const abut = new THREE.BoxGeometry(2, 0.6, BRIDGE.width + 0.6);
  [-1, 1].forEach((s) => {
    const a = new THREE.Mesh(abut, ditchMat);
    a.position.set(s * (BRIDGE.length / 2 + 0.8), 0.3, 0);
    g.add(a);
  });
  g.position.set(SITE.riverX, 0, SITE.bridgeZ);
  return g;
}
