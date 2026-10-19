/**
 * Gedung FH Panam (way 327366046, 3 lt, bentuk U) — "belum dipakai; 2015 dinding & listrik belum selesai;
 * lahan sengketa HTJ" [T, riset §2]. Cangkang K10 mangkrak dirender DISTRIK (rangka beton, besi menjuntai,
 * coretan, tanpa kaca). Region menambah: ilalang rapat V08 (pita 9 m + halaman U), pagar seng proyek
 * berkarat 4 ruas, plang "DILARANG MASUK — AREA PROYEK" [INFERENSI], gundukan tanah urug & besi tulangan.
 */
import * as THREE from 'three';
import { createIlalang, scatterIlalang } from '../../world/props/unri/ilalang.js';
import { boxAt, facePlane } from '../../world/props/unri/geom.js';
import { createRandom } from '../../world/siteutil/rng.js';
import { FOOTPRINTS } from './placement.js';
import { LEMBAGA_LAYOUT } from './layout.js';
import { staged, meshesByMaterial } from './staged.js';

export const ILALANG_FH = Object.freeze({ count: 1600, band: 9, seed: 23 });
const PANEL = Object.freeze({ w: 2.4, h: 2.0 });

function sengPanels(fences, heightAt) {
  const rnd = createRandom(616);
  const seng = [];
  const kayu = [];
  for (const f of fences) {
    const [ax, az] = f.a;
    const [bx, bz] = f.b;
    const len = Math.hypot(bx - ax, bz - az);
    const yaw = Math.atan2(bx - ax, bz - az);
    const n = Math.max(1, Math.round(len / PANEL.w));
    for (let k = 0; k < n; k += 1) {
      if (rnd.chance(0.12)) continue; // panel hilang/roboh
      const t = (k + 0.5) / n;
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      const y = heightAt(x, z);
      const tilt = rnd.range(-0.06, 0.06);
      seng.push(new THREE.BoxGeometry(0.02, PANEL.h, len / n - 0.03).rotateX(tilt).rotateY(yaw).translate(x, y + PANEL.h / 2 + 0.05, z));
      kayu.push(new THREE.BoxGeometry(0.08, PANEL.h + 0.3, 0.08).translate(ax + (bx - ax) * (k / n), y + (PANEL.h + 0.3) / 2, az + (bz - az) * (k / n)));
    }
  }
  return { seng, kayu };
}

/** @param {{heightAt:(lx:number,lz:number)=>number, mats:object, atlas:object, layout?:object}} opts */
export function createFhDetailBuilder({ heightAt, mats, atlas, layout = LEMBAGA_LAYOUT }) {
  const fh = layout.fh;
  return staged('fh-panam-detail', [
    () => createIlalang(scatterIlalang(FOOTPRINTS.fhPanam, ILALANG_FH).map((p) => ({ ...p, y: heightAt(p.x, p.z) }))),
    () => {
      const { seng, kayu } = sengPanels(fh.fences, heightAt);
      const mounds = fh.mounds.map((m) => new THREE.ConeGeometry(m.r, m.r * 0.55, 10).translate(m.x, heightAt(m.x, m.z) + m.r * 0.275, m.z));
      const rebar = [];
      for (let k = 0; k < 9; k += 1) {
        const m = fh.mounds[0];
        rebar.push(new THREE.BoxGeometry(0.03, 0.03, 6).rotateY(0.6 + k * 0.02).translate(m.x + 2.5, heightAt(m.x, m.z) + 0.05 + (k % 3) * 0.03, m.z + 1.5 + k * 0.05));
      }
      const p = fh.plang;
      const plangBoard = [boxAt(0.1, 2.2, 0.1, 0, 0, 0.05), boxAt(1.4, 0.7, 0.04, 0, 1.4, 0)];
      const g = meshesByMaterial('fh-detail', [[mats.seng2, seng], [mats.kayu, kayu], [mats.tanah, mounds], [mats.baja, rebar]], { cast: true });
      const plang = meshesByMaterial('fh-plang', [[mats.putih, plangBoard]]);
      plang.add(new THREE.Mesh(facePlane(1.3, 0.62, { y: 1.75, z: -0.021, cell: atlas.cell('plang:fh') }), mats.atlas));
      plang.position.set(p.x, heightAt(p.x, p.z), p.z);
      plang.rotation.y = p.rotY;
      return [g, plang];
    },
  ]);
}
