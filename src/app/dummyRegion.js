/**
 * Region uji "dummy" (M0): membuktikan kontrak multi-region tanpa konten kampus — streaming ber-histeresis,
 * proxy (1 draw call), POV region, base layer minimap, dan build inkremental lewat ctx.schedule (satu kotak per
 * potongan scheduler). Dipakai tes dan mode dev `?dummyRegion=1` (pusat default (0, 1100): selatan stadion,
 * dekat calon zona sekre). Bukan konten produksi (main.js memuatnya hanya di mode dev).
 */
import * as THREE from 'three';
import { defineRegion, validateBuild } from '../regions/Region.js';
import { disposeTree } from '../engine/disposeTree.js';
import { RENDER_LAYERS } from '../config/constants.js';

export const DUMMY_REGION_ID = 'dummy';
export const DUMMY_HALF = 40;   // setengah sisi mask persegi (m)
export const DUMMY_BOXES = 12;  // kotak yang dipasang inkremental
const RING_RADIUS = 25;
const BOX = 6;
const GROUND_LIFT = 0.05;       // di atas tanah tile kota (hindari z-fighting)
const POV_HEIGHT = 120;
const POV_BACK = 90;

/**
 * @param {{id?: string, x?: number, z?: number, yaw?: number, mountRadius?: number, unmountRadius?: number, boxes?: number}} [opts]
 */
export function createDummyRegion({
  id = DUMMY_REGION_ID, x = 0, z = 1100, yaw = 0, mountRadius = 700, unmountRadius = 900, boxes = DUMMY_BOXES,
} = {}) {
  return defineRegion({
    id,
    placement: { x, z, yaw },
    mask: [[-DUMMY_HALF, -DUMMY_HALF], [DUMMY_HALF, -DUMMY_HALF], [DUMMY_HALF, DUMMY_HALF], [-DUMMY_HALF, DUMMY_HALF]],
    activation: { center: { x, z }, mountRadius, unmountRadius },
    proxy: ({ scope }) => {
      const mesh = new THREE.Mesh(
        scope.get('dummy.proxy.geo', () => new THREE.BoxGeometry(DUMMY_HALF * 2, BOX, DUMMY_HALF * 2)),
        scope.get('dummy.proxy.mat', () => new THREE.MeshBasicMaterial({ color: 0x8a8f99 })),
      );
      mesh.position.y = BOX / 2;
      const group = new THREE.Group();
      group.name = `proxy:${id}`;
      group.add(mesh);
      return { group, dispose() {} }; // sumber daya milik scope proxy; manager yang melepasnya
    },
    povs: [{
      id: 'atas',
      label: 'Region uji dari atas',
      pose: (frame) => {
        const c = frame.toWorld(0, 0);
        return { px: c.x, py: POV_HEIGHT, pz: c.z + POV_BACK, tx: c.x, ty: 0, tz: c.z };
      },
    }],
    build: async ({ scope, schedule, heightAtLocal }) => {
      if (!scope || typeof schedule !== 'function') throw new TypeError(`Region "${id}": ctx.scope dan ctx.schedule wajib`);
      const group = new THREE.Group();
      group.name = `region:${id}`;
      const ground = new THREE.Mesh(
        scope.get('dummy.ground.geo', () => new THREE.PlaneGeometry(DUMMY_HALF * 2, DUMMY_HALF * 2).rotateX(-Math.PI / 2)),
        scope.get('dummy.ground.mat', () => new THREE.MeshStandardMaterial({ color: 0x9fb38a })),
      );
      ground.position.y = GROUND_LIFT;
      ground.layers.enable(RENDER_LAYERS.minimap);
      group.add(ground);
      const boxGeo = scope.get('dummy.box.geo', () => new THREE.BoxGeometry(BOX, BOX, BOX));
      const boxMat = scope.get('dummy.box.mat', () => new THREE.MeshStandardMaterial({ color: 0xd9a441 }));
      schedule(function* pasangKotak() {
        for (let i = 0; i < boxes; i += 1) {
          const a = (i / boxes) * Math.PI * 2;
          const lx = Math.cos(a) * RING_RADIUS;
          const lz = Math.sin(a) * RING_RADIUS;
          const box = new THREE.Mesh(boxGeo, boxMat);
          box.position.set(lx, (heightAtLocal?.(lx, lz) ?? 0) + BOX / 2, lz);
          box.layers.enable(RENDER_LAYERS.minimap);
          group.add(box); // ditambah setelah freezeStatic: matriksnya tetap diperbarui normal
          yield;
        }
      });
      return validateBuild({
        group,
        colliders: { isWalkable: () => true, isCameraClear: () => true },
        minimapLayer: () => {},
        systems: [],
        dispose() {
          group.removeFromParent();
          disposeTree(group, { scope });
          scope.dispose();
        },
      }, id);
    },
  });
}
