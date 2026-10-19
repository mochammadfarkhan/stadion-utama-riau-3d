/**
 * Teras & halaman Sekretariat [INFERENSI pola umum sekre ormawa, riset §3]: rak sepatu, sandal menumpuk,
 * galon kosong, papan pengumuman, jemuran almamater biru langit, pagar besi + 3 spanduk ormawa menghadap
 * jogging track, tong sampah, PJU zona (4 tiang, juga lampu malam region). Posisi dari LEMBAGA_LAYOUT.
 */
import * as THREE from 'three';
import { createRakSepatu } from '../../world/props/unri/rakSepatu.js';
import { createSandalTumpuk } from '../../world/props/unri/sandal.js';
import { createGalon } from '../../world/props/unri/galon.js';
import { createJemuran } from '../../world/props/unri/jemuran.js';
import { createPapanPengumuman } from '../../world/props/unri/papanPengumuman.js';
import { createSpanduk } from '../../world/props/unri/spanduk.js';
import { createTrashBins } from '../../world/props/TrashBin.js';
import { createLampPosts } from '../../world/props/LampPost.js';
import { SEKRE_DIM, LEMBAGA_LAYOUT } from './layout.js';
import { staged, meshesByMaterial } from './staged.js';

const FENCE_H = 1.2;
const BAR_STEP = 0.15;

const placed = (obj, p, y) => {
  obj.position.set(p.x, y, p.z);
  obj.rotation.y = p.rotY ?? 0;
  return obj;
};

/** Pagar besi: rel atas/bawah + jeruji tiap 15 cm + tiang (region-lokal). */
function fenceGeometries(t, heightAt) {
  const geos = [];
  for (const s of t.fenceSegments) {
    const [ax, az] = s.a;
    const [bx, bz] = s.b;
    const len = Math.hypot(bx - ax, bz - az);
    const yaw = Math.atan2(bx - ax, bz - az);
    const y = heightAt((ax + bx) / 2, (az + bz) / 2);
    for (const ry of [0.25, FENCE_H - 0.1]) {
      geos.push(new THREE.BoxGeometry(0.04, 0.04, len).rotateY(yaw).translate((ax + bx) / 2, y + ry, (az + bz) / 2));
    }
    const n = Math.floor(len / BAR_STEP);
    for (let k = 1; k < n; k += 1) {
      const f = k / n;
      geos.push(new THREE.BoxGeometry(0.02, FENCE_H - 0.2, 0.02).translate(ax + (bx - ax) * f, y + 0.1 + (FENCE_H - 0.2) / 2, az + (bz - az) * f));
    }
  }
  for (const p of t.fencePosts) geos.push(new THREE.BoxGeometry(0.06, FENCE_H + 0.1, 0.06).translate(p.x, heightAt(p.x, p.z) + (FENCE_H + 0.1) / 2, p.z));
  return geos;
}

/** @param {{heightAt:(lx:number, lz:number)=>number, mats:object, atlas:object, layout?:object}} opts */
export function createTerraceBuilder({ heightAt, mats, atlas, layout = LEMBAGA_LAYOUT }) {
  const t = layout.teras;
  const floorY = (p) => heightAt(p.x, p.z) + SEKRE_DIM.selasarY + 0.004;
  const at = (p, y) => ({ x: p.x, y, z: p.z, rotY: p.rotY ?? 0 });
  return staged('H01-teras', [
    () => [
      createRakSepatu(t.racks.map((p) => at(p, floorY(p)))),
      createSandalTumpuk(t.sandals.map((p) => at(p, floorY(p)))),
      createGalon(t.galons.map((p) => at(p, floorY(p)))),
    ],
    () => [
      placed(createPapanPengumuman({ cell: atlas.cell('papan:pengumuman'), faceMaterial: mats.atlas, woodMaterial: mats.kayu }), t.board, floorY(t.board)),
      placed(createJemuran(), t.jemuran, heightAt(t.jemuran.x, t.jemuran.z)),
      meshesByMaterial('H01-pagar', [[mats.besi, fenceGeometries(t, heightAt)]], { cast: true }),
      ...t.spanduk.map((p) => placed(createSpanduk({ cell: atlas.cell(p.cell), material: mats.spanduk, tieMaterial: mats.tali }), p, heightAt(p.x, p.z) + 0.72)),
    ],
    () => [
      createTrashBins(t.trashBins.map((p) => ({ ...at(p, floorY(p)), kind: p.kind }))),
      createLampPosts(layout.pju.map((p) => at(p, heightAt(p.x, p.z)))),
    ],
  ]);
}
