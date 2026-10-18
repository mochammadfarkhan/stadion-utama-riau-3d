import * as THREE from 'three';
import { instanceParts } from '../../siteutil/instanceParts.js';
import { chubbyCylinder, mergeAll } from '../../siteutil/rounded.js';
import { currentScope } from '../../../engine/ResourceScope.js';

/**
 * P05 tong-sampah-kampus (katalog aset, 0,5 × 0,5 × 0,9 m): silinder gemuk + tutup. Satu material putih, warna
 * per instans bergantian oranye/hijau (organik/anorganik) [INFERENSI].
 */
export const TONG_SAMPAH_KAMPUS = Object.freeze({ radius: 0.25, height: 0.9, colors: Object.freeze([0xe57c23, 0x3f8f4a]) });

function bodyGeometry() {
  const { radius: r, height: h } = TONG_SAMPAH_KAMPUS;
  const bodyH = h - 0.08;
  return mergeAll([
    chubbyCylinder(r, r * 0.88, bodyH, 12).translate(0, bodyH / 2, 0),
    new THREE.CylinderGeometry(r * 1.05, r * 1.05, 0.08, 12).translate(0, h - 0.04, 0),
  ]);
}

const bodyGeo = () => currentScope().get('tongSampahKampus:bodyGeo', bodyGeometry);
const bodyMat = () => currentScope().get('tongSampahKampus:bodyMat', () => new THREE.MeshLambertMaterial({ color: 0xffffff }));

/** positions: [{x, y, z}] → Group 'unri:tongSampah' (satu InstancedMesh). */
export function createTongSampahKampusInstances(positions) {
  const g = instanceParts([{ geometry: bodyGeo(), material: bodyMat(), name: 'tongSampahKampus' }], positions, 'unri:tongSampah');
  const c = new THREE.Color();
  for (const mesh of g.children) {
    for (let i = 0; i < mesh.count; i += 1) mesh.setColorAt(i, c.setHex(TONG_SAMPAH_KAMPUS.colors[i % 2]));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
  return g;
}
