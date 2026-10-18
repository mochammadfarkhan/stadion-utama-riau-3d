/**
 * Kehidupan kampus (spec UNRI §8.4): komposisi mahasiswa, satpam, parkir motor, dan props kampus (lambang, halte) di atas umpan data ground (groundFeed),
 * satu sistem fase `sim`. Humanoid lewat `services.npc` (D1); tanpa services distrik tetap jalan tanpa NPC.
 * Data ground diteruskan setelah chunk terrain-nya ada (`terrain.has`) agar tinggi bangku/kursi benar; batas
 * tunggu TERRAIN_WAIT_MS (chunk terrain gagal = datar, spec §10).
 */
import * as THREE from 'three';
import { withScope } from '../../engine/ResourceScope.js';
import { createGroundFeed, defaultFetchJson } from './groundFeed.js';
import { createStudents } from './students.js';
import { createGuards } from './guards.js';
import { createMotorParking } from './motorParking.js';
import { createCampusProps } from './campusProps.js';

/** Satuan titik ground (Task 0 Step 4): 1 = meter dunia, 0.1 = desimeter. */
export const GROUND_SCALE = 1;
const TERRAIN_WAIT_MS = 10000;

/**
 * @param {{scope:object, terrain:object, scheduler:object, services?:object, baseUrl:string, chunkKeys:string[],
 *   fetchJson?:(url:string)=>Promise<object>, now?:() => number, logger?:object}} opts
 *   baseUrl = direktori distrik (berakhiran '/'); chunkKeys = manifest.ground.chunks.
 */
export function createCampusLife({
  scope, terrain, scheduler, services = {}, baseUrl, chunkKeys = [], fetchJson = defaultFetchJson, now = () => performance.now(), logger = console,
}) {
  const group = new THREE.Group();
  group.name = 'kehidupanKampus';
  const npc = services.npc ?? null;
  const camera = services.camera ?? null;
  const hour = typeof services.hour === 'function' ? services.hour : () => 12;
  const withNpc = Boolean(npc && camera);
  const students = withNpc ? createStudents({ npc, terrain, scheduler, scope, hour, camera, groundScale: GROUND_SCALE }) : null;
  const guards = withNpc ? createGuards({ npc, terrain, scheduler, scope, camera }) : null;
  const excludeAt = typeof services.excludeAt === 'function' ? services.excludeAt : () => false;
  const motors = createMotorParking({ scope, terrain, scheduler, hour, camera, excludeAt, groundScale: GROUND_SCALE, logger });
  const props = createCampusProps({ scope, terrain, logger });
  const parts = [students, guards, motors, props].filter(Boolean);
  parts.forEach((p) => group.add(p.group));
  const consumers = [students, motors].filter(Boolean);

  const waiting = new Map(); // chunkKey -> { data, since }
  const added = new Set();
  const terrainReady = (key) => typeof terrain.has !== 'function' || terrain.has(key);
  const flushWaiting = () => {
    for (const [key, w] of [...waiting]) {
      if (!terrainReady(key) && now() - w.since < TERRAIN_WAIT_MS) continue;
      waiting.delete(key);
      added.add(key);
      withScope(scope, () => consumers.forEach((c) => c.addGroundChunk(key, w.data)));
    }
  };

  let disposed = false;
  const feed = createGroundFeed({
    baseUrl, chunkKeys, fetchJson, logger,
    onAdd: (key, data) => { if (!disposed) waiting.set(key, { data, since: now() }); },
    onRemove: (key) => {
      waiting.delete(key);
      if (added.delete(key)) consumers.forEach((c) => c.removeGroundChunk(key));
    },
  });

  const system = {
    id: 'unri.kehidupan',
    phase: 'sim',
    update(dt, frame) {
      const focus = frame?.focus ?? frame?.bikePos ?? null;
      if (focus) feed.update(focus);
      flushWaiting();
      students?.update(dt, focus);
      guards?.update(dt);
      motors.update(dt);
      props.update(dt);
    },
  };

  return {
    group,
    systems: [system],
    students,
    guards,
    motors,
    props,
    feed,
    dispose() {
      disposed = true;
      feed.dispose();
      parts.forEach((p) => p.dispose());
      group.removeFromParent();
    },
  };
}
