import * as THREE from 'three';
import { instancePart, localMatrix, placeObject } from '../siteutil/instanceParts.js';
import { createRandom } from '../siteutil/rng.js';

/**
 * Tong sampah bertutup (hijau organik / biru anorganik) dengan tiang penyangga.
 */
export const TRASH_BIN = Object.freeze({
  radius: 0.28, height: 0.75, lidH: 0.12, postH: 1.0,
  colors: { hijau: 0x2e8b3d, biru: 0x2d63b5, tiang: 0x555555 },
});

const bodyGeo = new THREE.CylinderGeometry(TRASH_BIN.radius, TRASH_BIN.radius * 0.85, TRASH_BIN.height, 12)
  .translate(0, TRASH_BIN.postH * 0.3 + TRASH_BIN.height / 2, 0);
const lidGeo = new THREE.CylinderGeometry(TRASH_BIN.radius * 0.6, TRASH_BIN.radius + 0.03, TRASH_BIN.lidH, 12)
  .translate(0, TRASH_BIN.postH * 0.3 + TRASH_BIN.height + TRASH_BIN.lidH / 2, 0);
const postGeo = new THREE.CylinderGeometry(0.03, 0.03, TRASH_BIN.postH, 6).translate(0, TRASH_BIN.postH / 2, 0);
const postMat = new THREE.MeshLambertMaterial({ color: TRASH_BIN.colors.tiang });

function colorHex(kind) {
  return kind === 'biru' ? TRASH_BIN.colors.biru : TRASH_BIN.colors.hijau;
}

/** Satu tong sampah. opts: { kind: 'hijau'|'biru', x, z, rotY } */
export function createTrashBin(opts = {}) {
  const g = new THREE.Group();
  g.name = 'tongSampah';
  const mat = new THREE.MeshLambertMaterial({ color: colorHex(opts.kind) });
  const body = new THREE.Mesh(bodyGeo, mat);
  const lid = new THREE.Mesh(lidGeo, mat);
  const post = new THREE.Mesh(postGeo, postMat);
  post.position.z = -TRASH_BIN.radius - 0.05;
  body.castShadow = true;
  g.add(body, lid, post);
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
  const body = instancePart({ geometry: bodyGeo, material: mat, castShadow: true, name: 'badan' }, positions);
  const lid = instancePart({ geometry: lidGeo, material: mat, name: 'tutup' }, positions);
  const post = instancePart({ geometry: postGeo, material: postMat, matrix: localMatrix(0, 0, -TRASH_BIN.radius - 0.05), name: 'tiang' }, positions);
  const c = new THREE.Color();
  positions.forEach((p, i) => {
    c.setHex(colorHex(p.kind ?? (rnd.chance(0.5) ? 'hijau' : 'biru')));
    body.setColorAt(i, c);
    lid.setColorAt(i, c);
  });
  body.instanceColor.needsUpdate = true;
  lid.instanceColor.needsUpdate = true;
  g.add(body, lid, post);
  g.userData.count = positions.length;
  return g;
}
