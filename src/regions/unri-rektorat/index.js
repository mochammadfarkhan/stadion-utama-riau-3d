// src/regions/unri-rektorat/index.js
/**
 * Region handmade "unri-rektorat" (M6, spec §8.3): Gedung Rektorat (H04) + kanopi biru & selembayung emas (N03) + huruf
 * puncak (N02), taman depan & tiang bendera, poros taman (akasia ramping + palem + bangku + PJU), Danau
 * Buatan (air dari distrik; batu pijakan, papan batu N01, trotoar tinggi), taman Putaran Jl. Mukhtar
 * Luthfi, Perpustakaan lama (4 massa 2 lt). build() cepat (< 30 ms): perakitan bertahap lewat ctx.schedule
 * setelah chunk terrain mask termuat; konten statis digabung per material (budget ≤ 250 draw call).
 * `ready` selesai setelah antrean + model GLB N01–N02 (gagal → placeholder prosedural tetap, spec §10).
 */
import * as THREE from 'three';
import { defineRegion, validateBuild } from '../Region.js';
import { disposeTree } from '../../engine/disposeTree.js';
import { withScope } from '../../engine/ResourceScope.js';
import { createModelGroup, placeModels } from '../../world/assets/models.js';
import { mergeByMaterial } from '../../world/util/merge.js';
import { REKTORAT_ID, REKTORAT_PLACEMENT, REKTORAT_ACTIVATION } from './placement.js';
import { REKTORAT_MASK } from './mask.js';
import { REKTORAT_PADS } from './pads.js';
import { LAYOUT } from './layout.js';
import { rektoratColliders } from './collider.js';
import { createSiteEnv, waitForTerrain } from './env.js';
import { runStaged, freezeSubtree } from './staged.js';
import { buildRektorat, buildRektoratGround, ROOF_Y, LEVEL } from './rektorat.js';
import { buildPerpustakaan } from './perpustakaan.js';
import { buildPorosTaman } from './porosTaman.js';
import { buildDanau } from './danau.js';
import { buildBundaran } from './bundaran.js';
import { createRektoratProxy } from './proxy.js';

export { REKTORAT_ID, REKTORAT_PLACEMENT };
/** Budget draw call region hero aktif (spec §9.1). */
export const REKTORAT_DRAW_BUDGET = 250;
const EMPTY_RESULT = Object.freeze({ placed: 0, failed: [], replaced: [] });

/** Model GLB final (Blender) N01–N02, region-lokal (N03 prosedural: GLB merah lama dilepas, lihat rektorat.js); `replaces` = nama grup placeholder prosedural. */
export function rektoratModelItems(env) {
  const pb = LAYOUT.papanBatu;
  const y0 = env.hAt(0, 0);
  return [
    { path: 'models/unri/n02-huruf-nama-rektorat.glb', x: 17.55, y: y0 + ROOF_Y + LEVEL.atik / 2 - 0.75, z: 0, rotY: -Math.PI / 2, replaces: 'N02' },
    { path: 'models/unri/n01-papan-batu-unri.glb', x: pb.x, y: env.hAt(pb.x, pb.z), z: pb.z, rotY: pb.yaw, replaces: 'N01' },
  ];
}

/** Lampu malam (DUNIA) untuk TimeOfDay.registerLamps: semua PJU region. */
export function rektoratNightLights(layout = LAYOUT) {
  return {
    lamps: layout.pju.map((p) => ({ x: p.x + REKTORAT_PLACEMENT.x, z: p.z + REKTORAT_PLACEMENT.z })),
    floods: [],
  };
}

/** Material GLB bernama "…emisif" menyala malam lewat registry TimeOfDay (tidak bercahaya siang). */
function tagNightMaterials(root) {
  root.traverse((o) => {
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m?.isMaterial || !/emisif/i.test(m.name ?? '') || !m.emissive) continue;
      if (m.emissive.getHex() === 0) m.emissive.setHex(0xffe2b0);
      m.emissiveIntensity = 0;
      m.userData.nightEmissive = { on: 1.3, off: 0 };
    }
  });
}

/** Gabung konten statis per material; geometri sumber yang tak terpakai lagi & tak dimiliki scope dilepas. */
function mergeRaw(raw, scope) {
  const merged = mergeByMaterial(raw);
  merged.name = 'rektoratStatis';
  const live = new Set();
  merged.traverse((o) => { if (o.geometry) live.add(o.geometry); });
  raw.traverse((o) => {
    const g = o.geometry;
    if (g?.isBufferGeometry && !live.has(g) && !scope.owns(g)) g.dispose();
  });
  raw.clear();
  return merged;
}

const POV_DEFS = Object.freeze([
  Object.freeze({ id: 'rektorat-poros', label: 'Rektorat dari poros taman', eye: [125, 9, 4.2], target: [12, 11, 0], fov: 50 }),
  Object.freeze({ id: 'danau-udara', label: 'Danau Buatan (udara)', eye: [330, 70, -70], target: [215, 0, 40], fov: 55 }),
]);

function poseOf(def, frame, ctx, out) {
  const e = frame.toWorld(def.eye[0], def.eye[2]);
  const t = frame.toWorld(def.target[0], def.target[2]);
  const h = (p) => ctx?.terrain?.heightAt?.(p.x, p.z) ?? 0;
  return Object.assign(out, { px: e.x, py: h(e) + def.eye[1], pz: e.z, tx: t.x, ty: h(t) + def.target[1], tz: t.z, fov: def.fov });
}

/** POV milik region (spec §4.3): pose(frame, ctx, out?) → {px,py,pz,tx,ty,tz,fov} dunia. */
export const REKTORAT_POVS = Object.freeze(POV_DEFS.map((d) => Object.freeze({
  id: d.id, label: d.label, pose: (frame, ctx, out = {}) => poseOf(d, frame, ctx, out),
})));

function buildRektoratRegion(ctx) {
  const { scope } = ctx;
  if (!scope) throw new TypeError('Region unri-rektorat: ctx.scope (ResourceScope) wajib');
  const env = createSiteEnv(ctx);
  const root = new THREE.Group();
  root.name = `region:${REKTORAT_ID}`;
  root.userData.ready = false;
  const content = new THREE.Group();
  content.name = 'rektoratKonten';
  root.add(content);
  const models = createModelGroup();
  content.add(models);
  const raw = new THREE.Group(); // tidak dipasang ke scene: digabung per material di langkah terakhir
  raw.name = 'rektoratMentah';
  const attach = (obj) => {
    content.add(obj);
    freezeSubtree(obj);
  };
  const steps = [
    () => raw.add(buildRektoratGround(env)),
    () => { const r = buildRektorat(env); raw.add(r.raw); attach(r.placeholders); },
    () => raw.add(buildPerpustakaan(env, scope)),
    () => { const p = buildPorosTaman(env); raw.add(p.raw); attach(p.instanced); },
    () => { const d = buildDanau(env); raw.add(d.raw); attach(d.placeholders); },
    () => raw.add(buildBundaran(env)),
    () => attach(mergeRaw(raw, scope)),
  ];
  let disposed = false;
  let run = null;
  const isCancelled = () => disposed;
  const ready = waitForTerrain(env)
    .then(() => {
      if (disposed) return false;
      run = runStaged({ steps, scope, schedule: ctx.schedule ?? null, isCancelled });
      return run.promise;
    })
    .then((ok) => {
      if (!ok || disposed || ctx.loadModels === false) return { ...EMPTY_RESULT, cancelled: !ok || disposed };
      return withScope(scope, () => placeModels(models, rektoratModelItems(env), { world: content, isCancelled }))
        .then((res) => {
          tagNightMaterials(models);
          return res;
        });
    })
    .catch((err) => {
      console.error('Region unri-rektorat: perakitan gagal, konten parsial dipertahankan:', err);
      return { ...EMPTY_RESULT, failed: [{ path: 'region:unri-rektorat', error: String(err?.message ?? err) }], cancelled: false };
    })
    .then((res) => {
      if (!disposed) root.userData.ready = true;
      return res;
    });

  return validateBuild({
    group: root,
    colliders: rektoratColliders,
    minimapLayer: () => {}, // peta dasar region di-bake per region oleh M0 (Minimap2D.setBaseLayer)
    systems: [],
    nightLights: rektoratNightLights(),
    lateRoot: content,
    lateRootWet: true, // overlay paving/rumput/trotoar datang bertahap → registry basah setelah ready (Task 15)
    layout: LAYOUT,
    ready,
    dispose() {
      if (disposed) return;
      disposed = true;
      run?.cancel();
      root.removeFromParent();
      disposeTree(raw, { scope });
      disposeTree(root, { scope });
      scope.dispose();
    },
  }, REKTORAT_ID);
}

export const unriRektoratRegion = defineRegion({
  id: 'unri-rektorat', // = REKTORAT_ID; literal agar grep plan M7 (Task 0 Step 5) menemukannya
  placement: REKTORAT_PLACEMENT,
  mask: REKTORAT_MASK,
  activation: REKTORAT_ACTIVATION,
  pads: REKTORAT_PADS,
  povs: REKTORAT_POVS,
  proxy: (ctx) => createRektoratProxy(ctx ?? {}),
  build: async (ctx) => buildRektoratRegion(ctx ?? {}),
});
