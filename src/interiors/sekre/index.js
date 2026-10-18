/**
 * Interior sekre (spec §8.2): createSekreInterior({ exitTo }) → InteriorDef (defineInterior, spec §4.8).
 * exitTo dari composition root (sekreExitTo() M4 di main.js) karena src/interiors tidak boleh mengimpor
 * regions. Build: scene sendiri (matrixWorldAutoUpdate false; App.render memperbarui matriks sekali per frame),
 * perabot/papan/ruang statis digabung per material (budget ≤ 150 draw call), NPC terjadwal, cahaya, suara,
 * GLB di belakang layar (placeholder tampil dulu), papan digambar ulang setelah font siap. Semua dibangun di
 * ResourceScope interior (ctx.scope) sehingga material Humanoid/GLB dilepas bersama scope saat keluar.
 */
import * as THREE from 'three';
import { defineInterior } from '../Interior.js';
import { createRoomCollider } from '../roomCollider.js';
import { withScope } from '../../engine/ResourceScope.js';
import { freezeStatic } from '../../engine/freezeStatic.js';
import { mergeByMaterial } from '../../world/util/merge.js';
import { lightingPreset } from '../../sim/dayCycle.js';
import { ROOM, SPAWN, SOLIDS, TALL_SOLIDS, ROOM_YAW_OFFSET } from './data.js';
import { buildRoom } from './room.js';
import { buildFurniture, createSekreMaterials } from './furniture.js';
import { buildBoards } from './boards.js';
import { createSekreNpcs } from './npcs.js';
import { createSekreInteractables } from './interactables.js';
import { createSekreLighting } from './lighting.js';
import { createSekreAudio } from './audio.js';
import { SEKRE_PHOTO_PRESETS } from './photo.js';

export const SEKRE_ID = 'sekre';
const FALLBACK_PRESET = lightingPreset(12);

/** Gabung semua mesh statis per material; geometri sumber yang sudah tergabung dilepas. */
export function mergeStatic(root) {
  const sources = new Set();
  root.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && o.geometry) sources.add(o.geometry); });
  const merged = mergeByMaterial(root);
  const used = new Set();
  merged.traverse((o) => { if (o.geometry) used.add(o.geometry); });
  for (const g of sources) if (!used.has(g)) g.dispose();
  return merged;
}

/** @param {{exitTo:{region:string,x:number,z:number,yaw:number}}} opts */
export function createSekreInterior({ exitTo }) {
  return defineInterior({
    id: SEKRE_ID, label: 'Sekretariat', size: { w: ROOM.w, d: ROOM.d, h: ROOM.h }, spawn: SPAWN, exitTo, build: buildSekre,
  });
}

/**
 * @param {{scope:object, renderer?:THREE.WebGLRenderer|null, audioBus?:object|null, time?:object|null,
 *   weather?:object|null, door?:{worldYaw:number}|null, fov?:number, setExposure?:(v:number)=>void}} ctx
 */
async function buildSekre(ctx) {
  let disposed = false;
  const scene = new THREE.Scene();
  scene.name = 'interior:sekre';
  scene.matrixWorldAutoUpdate = false;
  scene.background = new THREE.Color(0x9fb4c8);
  const camera = new THREE.PerspectiveCamera(Number.isFinite(ctx.fov) ? ctx.fov : 70, 1, 0.05, 80);
  camera.name = 'kamera-sekre';
  const roomYaw = Number.isFinite(ctx.door?.worldYaw) ? ctx.door.worldYaw + ROOM_YAW_OFFSET : 0;

  const { materials, room, furniture, boards, npcs, lighting } = withScope(ctx.scope, () => {
    const mats = createSekreMaterials(ctx.renderer ?? null);
    const furn = buildFurniture({ materials: mats });
    return {
      materials: mats,
      room: buildRoom({ renderer: ctx.renderer ?? null }),
      furniture: furn,
      boards: buildBoards({ renderer: ctx.renderer ?? null, materials: mats }),
      npcs: createSekreNpcs({ props: furn.props }),
      lighting: createSekreLighting({ renderer: ctx.renderer ?? null, scene }),
    };
  });
  const staticRoot = new THREE.Group();
  staticRoot.add(room.staticGroup, furniture.staticGroup, boards.group);
  const merged = mergeStatic(staticRoot);
  merged.name = 'sekre-statis';
  scene.add(merged, room.dynamicGroup, furniture.dynamicGroup, npcs.group, lighting.group);
  freezeStatic(merged);

  const colliders = createRoomCollider({
    halfW: ROOM.w / 2, halfD: ROOM.d / 2, solids: SOLIDS, tallSolids: TALL_SOLIDS, blockers: () => npcs.blockers(),
  });
  const audio = createSekreAudio({ audioBus: ctx.audioBus ?? null });
  const interactables = createSekreInteractables({ furniture, lighting, audio });
  const isCancelled = () => disposed;
  const ready = Promise.allSettled([
    withScope(ctx.scope, () => furniture.loadModels(isCancelled)),
    boards.redrawWhenFontsReady(isCancelled),
  ]);

  const hour = () => (Number.isFinite(ctx.time?.hour) ? ctx.time.hour : 12);
  const rain = () => (Number.isFinite(ctx.weather?.intensity) ? ctx.weather.intensity : 0);
  const systems = [
    { id: 'interior.sekre.npcs', phase: 'sim', update: (dt) => npcs.update(dt, hour()) },
    {
      id: 'interior.sekre.props',
      phase: 'sim',
      update: (dt) => {
        furniture.update(dt);
        interactables.update();
        room.update(dt, { rain: rain() });
      },
    },
    {
      id: 'interior.sekre.lighting',
      phase: 'world',
      update: (dt) => lighting.update(dt, {
        hour: hour(), preset: ctx.time?.preset ?? FALLBACK_PRESET, azimuthOffsetDeg: ctx.time?.overrides?.azimuthOffset ?? 0,
        roomYaw, rain: rain(), laptopActive: npcs.isActive('laptop'), tlMaterial: materials.tl, screenMaterial: materials.screen,
        setExposure: ctx.setExposure,
      }),
    },
    {
      id: 'interior.sekre.audio',
      phase: 'world',
      update: (dt) => audio.update(dt, { fanOn: furniture.fanOn, rain: rain(), talkers: npcs.talkers, gitar: npcs.isActive('gitar') }),
    },
  ];

  return {
    scene,
    camera,
    colliders,
    interactables: interactables.items,
    photoPresets: SEKRE_PHOTO_PRESETS,
    systems,
    ready,
    /** Akses dev/E2E (window.__sim.portal.current.built.debug). */
    debug: { npcs, lighting, furniture },
    /** Sumber daya di luar pohon scene; pohon scene + scope dilepas portal. */
    dispose() {
      disposed = true;
      audio.dispose();
      npcs.dispose();
      lighting.dispose();
      furniture.dispose();
    },
  };
}
