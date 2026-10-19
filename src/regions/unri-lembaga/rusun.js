/**
 * Rusunawa mahasiswa (way 327366048, 5 lt [T]) — cangkang K09 dirender DISTRIK (balkon berjemuran, tangga
 * ujung, tandon atap). Region menambah detail hero [INFERENSI]: papan nama beton di pintu masuk lot parkir
 * (dari jalan servis barat), pos satpam P01 (satpam kampus [T]), 4 jemuran almamater di halaman belakang,
 * tong sampah. Motor parkir lot utara di parking.js.
 */
import * as THREE from 'three';
import { createGuardPost } from '../../world/props/GuardPost.js';
import { createJemuran } from '../../world/props/unri/jemuran.js';
import { createTrashBins } from '../../world/props/TrashBin.js';
import { boxAt, facePlane } from '../../world/props/unri/geom.js';
import { LEMBAGA_LAYOUT } from './layout.js';
import { staged, meshesByMaterial } from './staged.js';

const place = (obj, p, y) => {
  obj.position.set(p.x, y, p.z);
  obj.rotation.y = p.rotY ?? 0;
  return obj;
};

function signBoard(mats, atlas) {
  const g = meshesByMaterial('rusun-papan', [[mats.putih, [
    boxAt(0.2, 1.4, 0.2, -1.5, 0, 0), boxAt(0.2, 1.4, 0.2, 1.5, 0, 0), boxAt(3.4, 1.0, 0.2, 0, 1.0, 0),
  ]]], { cast: true });
  g.add(new THREE.Mesh(facePlane(3.1, 0.78, { y: 1.5, z: -0.101, cell: atlas.cell('nama:rusun') }), mats.atlas));
  return g;
}

/** @param {{heightAt:(lx:number,lz:number)=>number, mats:object, atlas:object, layout?:object}} opts */
export function createRusunDetailBuilder({ heightAt, mats, atlas, layout = LEMBAGA_LAYOUT }) {
  const r = layout.rusun;
  const h = (p) => heightAt(p.x, p.z);
  return staged('rusunawa-detail', [
    () => [
      place(signBoard(mats, atlas), r.sign, h(r.sign)),
      place(createGuardPost({ width: 2.5, depth: 2.5, wallHeight: 2.2 }), r.guardPost, h(r.guardPost)),
    ],
    () => [
      ...r.jemuran.map((p) => place(createJemuran(), p, h(p))),
      createTrashBins(r.trashBins.map((p) => ({ x: p.x, y: h(p), z: p.z, rotY: 0, kind: p.kind }))),
    ],
  ]);
}
