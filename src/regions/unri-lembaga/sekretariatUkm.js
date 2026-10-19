/**
 * Hero H09 "Sekretariat UKM blok biru" (gedung L, atap seng biru kobalt) + tiang ring basket H10. Model utama dari
 * GLB Blender (public/models/unri/h09-sekre-ukm.glb): dimuat sesudah region terpasang lewat pola loadModel (cache per
 * ResourceScope, dilepas bersama region). Selama GLB belum ada (atau gagal) placeholder kotak berdiri. Papan nama
 * kanvas (N06) dipasang di tiap anchor pintu; bahan `unri:lampu-emisif` ikut siklus malam (`nightEmissive`).
 */
import * as THREE from 'three';
import { withScope } from '../../engine/ResourceScope.js';
import { freezeStatic } from '../../engine/freezeStatic.js';
import { loadModel } from '../../world/assets/models.js';
import { instanceParts } from '../../world/siteutil/instanceParts.js';
import { createCanvasAtlas } from '../../world/props/unri/atlas.js';
import { drawPapanNama, createPapanNamaSekre, PAPAN_NAMA_SEKRE } from '../../world/props/unri/papanNamaSekre.js';
import { boxAt, paint } from '../../world/props/unri/geom.js';
import { mergeAll } from '../../world/siteutil/rounded.js';
import { UKM_FRAME, UKM_LABELS, ukmSigns } from './sekreUkm.data.js';
import { UKM_LAYOUT } from './ukmLayout.js';
import { faceToward } from './layout.js';
import { staged } from './staged.js';

export const UKM_GROUP = 'ukm-gedung';
export const UKM_GLB = 'models/unri/h09-sekre-ukm.glb';
export const RING_GLB = 'models/unri/h10-ring-basket.glb';
const NIGHT_EMISSIVE = Object.freeze({ on: 2.6, off: 0 });
const LAMP_MATERIAL = 'unri:lampu-emisif';
const BOARD_MATERIAL = 'unri:papan-nama';

const PLACEHOLDER = Object.freeze({ wall: 0xe4e5df, roof: 0x2352c4, wallTop: 3.75, ridge: 5.77 });

/** Placeholder kotak: dua sayap dinding + dua atap datar biru (pengganti sampai GLB siap / bila gagal). */
function placeholderGeometry() {
  const wing = (x0, x1, z0, z1) => [
    paint(boxAt(x1 - x0, PLACEHOLDER.wallTop, z1 - z0, (x0 + x1) / 2, 0, (z0 + z1) / 2), PLACEHOLDER.wall),
    paint(boxAt(x1 - x0 + 1.8, 1.2, z1 - z0 + 1.8, (x0 + x1) / 2, PLACEHOLDER.wallTop, (z0 + z1) / 2), PLACEHOLDER.roof),
  ];
  return mergeAll([...wing(-17.35, 6.15, 4.2, 15.2), ...wing(6.15, 17.35, -15.2, 15.2)]);
}

/** Atlas papan nama: satu sel per label unik. */
function signAtlas(signs) {
  const labels = [...new Set(signs.map((s) => s.label))];
  const style = (label) => signs.find((s) => s.label === label);
  const { w, h } = PAPAN_NAMA_SEKRE.px;
  return createCanvasAtlas({
    width: 512, height: 512, pad: 4,
    cells: labels.map((label) => ({ id: label, w, h, draw: (ctx, cw, ch) => drawPapanNama(ctx, cw, ch, { nama: label, latar: style(label).latar, teks: style(label).teks }) })),
  });
}

/** @param {{baseY:number, mats:object}} opts mats = material region (putih untuk bingkai papan). */
export function createUkmHeroBuilder({ baseY, mats, labels = UKM_LABELS }) {
  const signs = ukmSigns(undefined, labels);
  const atlas = signAtlas(signs);
  const faceMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.8, ...(atlas.texture ? { map: atlas.texture } : {}),
  });
  faceMaterial.name = 'papanNamaUkm';
  const holderName = `${UKM_GROUP}:placeholder`;
  return staged(UKM_GROUP, [
    () => {
      const mesh = new THREE.Mesh(placeholderGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true }));
      mesh.name = holderName;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    },
    () => {
      const g = new THREE.Group();
      g.name = `${UKM_GROUP}:papan-nama`;
      for (const s of signs) {
        const board = createPapanNamaSekre({ cell: atlas.cell(s.label), faceMaterial, frameMaterial: mats.putih });
        board.position.set(s.x, s.y, s.z);
        board.rotation.y = faceToward(s.normal[0], s.normal[1]) + 0; // muka −Z papan menghadap normal keluar dinding
        g.add(board);
      }
      return g;
    },
  ], { x: UKM_FRAME.x, y: baseY, z: UKM_FRAME.z, yaw: 0 }, { merge: false });
}

/** Material emisif malam + sembunyikan papan kosong bawaan GLB (diganti papan kanvas). */
export function prepareUkmModel(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mat = o.material;
    if (mat?.name === LAMP_MATERIAL) {
      if (mat.emissive && mat.emissive.getHex() === 0) mat.emissive.set(0xffe2a8);
      mat.emissiveIntensity = NIGHT_EMISSIVE.off;
      mat.userData.nightEmissive = NIGHT_EMISSIVE;
    }
    if (mat?.name === BOARD_MATERIAL) o.visible = false;
  });
  return root;
}

function ringParts(source) {
  source.updateMatrixWorld(true);
  const parts = [];
  source.traverse((o) => {
    if (o.isMesh) parts.push({ geometry: o.geometry.clone().applyMatrix4(o.matrixWorld), material: o.material, castShadow: true, name: o.material?.name });
  });
  return parts;
}

/**
 * Muat GLB gedung + tiang ring; pasang ke `root` (konten region) dan sembunyikan placeholder. Gagal salah satu →
 * placeholder/tanpa ring dan galat dicatat di `failed`. Panggil setelah region terpasang.
 * @returns {Promise<{failed:string[], replaced:string[]}>}
 */
export async function upgradeUkmAssets({ root, scope, heightAt, layout = UKM_LAYOUT, isCancelled = () => false, logger = console }) {
  const result = { failed: [], replaced: [] };
  const hero = root.getObjectByName(UKM_GROUP);
  const load = (path) => withScope(scope, () => loadModel(path)).catch((err) => {
    logger.warn(`Model ${path} gagal dimuat, placeholder dipakai:`, err?.message ?? err);
    return null;
  });
  const [gedung, ring] = await Promise.all([load(UKM_GLB), load(RING_GLB)]);
  if (isCancelled()) return result;
  if (hero && gedung) {
    const obj = prepareUkmModel(gedung.clone(true));
    obj.name = `${UKM_GROUP}:glb`;
    hero.add(obj);
    const ph = hero.getObjectByName(`${UKM_GROUP}:placeholder`);
    if (ph) ph.visible = false;
    freezeStatic(hero);
    result.replaced.push(UKM_GROUP);
  } else {
    result.failed.push(UKM_GLB);
  }
  if (ring) {
    const positions = layout.courts.flatMap((c) => c.hoops.map((h) => {
      const x = c.x + h.x;
      const z = c.z + h.z;
      return { x, y: heightAt(x, z), z, rotY: h.facing > 0 ? Math.PI : 0 };
    }));
    const holder = withScope(scope, () => instanceParts(ringParts(ring), positions, 'ukm-ring-basket'));
    root.add(holder);
    freezeStatic(root);
    result.replaced.push(RING_GLB);
  } else {
    result.failed.push(RING_GLB);
  }
  return result;
}
