/**
 * Motor parkir padat [T: "parkir motor sangat padat", riset §4]: lot stadion mini (way 938379741, ±270 siang),
 * lot rusunawa (way 938379740, ±150), deret rapat di sisi utara & mulut selasar sekretariat (±20). Motor lot =
 * placeholder low-poly instanced tanpa bayangan (8 draw call untuk semua lot); motor sekretariat (dilihat dari dekat)
 * ditingkatkan ke GLB A01/A02 bila MOTOR_GLB_READY. Grup tidak digabung (InstancedMesh).
 */
import * as THREE from 'three';
import { withScope } from '../../engine/ResourceScope.js';
import { createMotorPlaceholders, loadMotorInstances, MOTOR_GLB_READY } from '../../world/props/unri/motor.js';
import { LEMBAGA_LAYOUT } from './layout.js';
import { staged } from './staged.js';

export const SEKRE_MOTOR_GROUP = 'lembaga-motor-sekre';
const KINDS = Object.freeze(['bebek', 'matic']);

/** Kelompokkan motor per jenis, y dari tanah. */
export function motorsByKind(list, heightAt) {
  const out = { bebek: [], matic: [] };
  for (const m of list) out[m.kind === 'matic' ? 'matic' : 'bebek'].push({ x: m.x, y: heightAt(m.x, m.z), z: m.z, rotY: m.rotY });
  return out;
}

function kindGroup(name, byKind, opts) {
  const g = new THREE.Group();
  g.name = name;
  for (const kind of KINDS) {
    const sub = createMotorPlaceholders(kind, byKind[kind], { ...opts, seed: opts.seed + (kind === 'matic' ? 7 : 0) });
    sub.name = `${name}:${kind}`;
    g.add(sub);
  }
  return g;
}

/** @param {{heightAt:(lx:number,lz:number)=>number, layout?:object}} opts */
export function createParkingBuilder({ heightAt, layout = LEMBAGA_LAYOUT }) {
  return staged('lembaga-parkir', [
    () => kindGroup('lembaga-motor-lot', motorsByKind([...layout.lots.stadionMini.motors, ...layout.lots.rusunawa.motors], heightAt), { seed: 31, cellSize: 0, castShadow: false }),
    () => kindGroup(SEKRE_MOTOR_GROUP, motorsByKind(layout.teras.motors, heightAt), { seed: 53, cellSize: 0 }),
  ], null, { merge: false });
}

/**
 * Ganti placeholder motor sekretariat dengan GLB instanced (bila siap). Placeholder disembunyikan hanya
 * bila GLB jenis itu berhasil. Panggil setelah parkir terpasang di `root`.
 * @returns {Promise<{failed:string[], replaced:string[]}>}
 */
export async function upgradeSekreMotors({ root, scope, heightAt, layout = LEMBAGA_LAYOUT, isCancelled = () => false, ready = MOTOR_GLB_READY }) {
  const result = { failed: [], replaced: [] };
  const holder = root.getObjectByName(SEKRE_MOTOR_GROUP);
  if (!ready || !holder) return result;
  const byKind = motorsByKind(layout.teras.motors, heightAt);
  await Promise.all(KINDS.map(async (kind) => {
    if (!byKind[kind].length) return;
    const glb = await withScope(scope, () => loadMotorInstances(kind, byKind[kind], { seed: 53 + (kind === 'matic' ? 7 : 0), isCancelled }));
    if (isCancelled()) return;
    const placeholder = holder.getObjectByName(`${SEKRE_MOTOR_GROUP}:${kind}`);
    if (!glb) {
      result.failed.push(kind);
      return;
    }
    holder.add(glb);
    if (placeholder) placeholder.visible = false;
    result.replaced.push(kind);
  }));
  return result;
}
