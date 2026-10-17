import * as THREE from 'three';
import { instancePart, localMatrix, placeObject } from '../siteutil/instanceParts.js';
import { createRandom } from '../siteutil/rng.js';
import { chubbyCylinder, dome, mergeAll } from '../siteutil/rounded.js';
import { currentScope } from '../../engine/ResourceScope.js';

/**
 * Tong sampah gaya cozy: silinder gemuk + tutup kubah (hijau organik / biru
 * anorganik, pastel) dengan tiang penyangga pendek berujung bulat.
 */
export const TRASH_BIN = Object.freeze({
  radius: 0.3, height: 0.68, lidH: 0.16, postH: 1.0,
  colors: { hijau: 0x81c784, biru: 0x64b5f6, tiang: 0x90a4ae },
});
const BASE_Y = TRASH_BIN.postH * 0.3;

/** Badan + tutup kubah digabung (satu material, satu warna per-instance). */
function bodyGeometry() {
  const body = chubbyCylinder(TRASH_BIN.radius, TRASH_BIN.radius * 0.88, TRASH_BIN.height, 12)
    .translate(0, BASE_Y + TRASH_BIN.height / 2, 0);
  const lid = dome(TRASH_BIN.radius + 0.04, TRASH_BIN.lidH / (TRASH_BIN.radius + 0.04), 12)
    .translate(0, BASE_Y + TRASH_BIN.height + 0.02, 0);
  const knob = new THREE.SphereGeometry(0.05, 6, 4).translate(0, BASE_Y + TRASH_BIN.height + TRASH_BIN.lidH + 0.02, 0);
  return mergeAll([body, lid, knob]);
}

/** Tiang penyangga: silinder + bola kecil di ujung atas. */
function postGeometry() {
  const pole = new THREE.CylinderGeometry(0.035, 0.045, TRASH_BIN.postH, 6).translate(0, TRASH_BIN.postH / 2, 0);
  const cap = new THREE.SphereGeometry(0.05, 6, 4).translate(0, TRASH_BIN.postH, 0);
  return mergeAll([pole, cap]);
}

const bodyGeo = () => currentScope().get('TrashBin:bodyGeo', () => bodyGeometry());
const postGeo = () => currentScope().get('TrashBin:postGeo', () => postGeometry());
const postMat = () => currentScope().get('TrashBin:postMat', () => new THREE.MeshLambertMaterial({ color: TRASH_BIN.colors.tiang }));
const POST_OFFSET_Z = -TRASH_BIN.radius - 0.05;

function colorHex(kind) {
  return kind === 'biru' ? TRASH_BIN.colors.biru : TRASH_BIN.colors.hijau;
}

/** Satu tong sampah. opts: { kind: 'hijau'|'biru', x, z, rotY } */
export function createTrashBin(opts = {}) {
  const g = new THREE.Group();
  g.name = 'tongSampah';
  const body = new THREE.Mesh(bodyGeo(), new THREE.MeshLambertMaterial({ color: colorHex(opts.kind) }));
  const post = new THREE.Mesh(postGeo(), postMat());
  post.position.z = POST_OFFSET_Z;
  g.add(body, post);
  g.userData.kind = opts.kind ?? 'hijau';
  return placeObject(g, opts);
}

/** Banyak tong sampah instanced dengan warna per-instance. positions: [{x,z,rotY?,kind?}] */
export function createTrashBins(positions = [], opts = {}) {
  const g = new THREE.Group();
  g.name = 'tongSampah';
  if (positions.length === 0) return g;
  const rnd = createRandom(opts.seed ?? 7);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const body = instancePart({ geometry: bodyGeo(), material: mat, name: 'badan' }, positions); // tanpa bayangan: kecil
  const post = instancePart({ geometry: postGeo(), material: postMat(), matrix: localMatrix(0, 0, POST_OFFSET_Z), name: 'tiang' }, positions);
  const c = new THREE.Color();
  positions.forEach((p, i) => body.setColorAt(i, c.setHex(colorHex(p.kind ?? (rnd.chance(0.5) ? 'hijau' : 'biru')))));
  body.instanceColor.needsUpdate = true;
  g.add(body, post);
  g.userData.count = positions.length;
  return g;
}
