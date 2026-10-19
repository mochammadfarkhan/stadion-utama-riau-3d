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
export const LOT_MOTOR_GROUP = 'lembaga-motor-lot';
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
    () => kindGroup(LOT_MOTOR_GROUP, motorsByKind([...layout.lots.stadionMini.motors, ...layout.lots.rusunawa.motors], heightAt), { seed: 31, cellSize: 0, castShadow: false }),
    () => kindGroup(SEKRE_MOTOR_GROUP, motorsByKind(layout.teras.motors, heightAt), { seed: 53, cellSize: 0 }),
  ], null, { merge: false });
}

/** Ambang LOD sel lot (m, dari kamera): model ±1k segitiga ≤ LOT_LOD.lo, siluet ±110 segitiga ≤ LOT_LOD.hidden, lebih jauh tak digambar. */
export const LOT_LOD = Object.freeze({ lo: 70, hidden: 300 });
const LOT_CELL = 36;

/** Bagi daftar posisi (lokal) ke sel LOT_CELL m: [{ cx, cz, items }] dengan items relatif terhadap pusat sel. */
export function cellsOf(byKindList, cell = LOT_CELL) {
  const cells = new Map();
  for (const p of byKindList) {
    const cx = (Math.floor(p.x / cell) + 0.5) * cell;
    const cz = (Math.floor(p.z / cell) + 0.5) * cell;
    const key = `${cx}_${cz}`;
    const e = cells.get(key) ?? { cx, cz, items: [] };
    e.items.push({ ...p, x: p.x - cx, z: p.z - cz });
    cells.set(key, e);
  }
  return [...cells.values()];
}

/**
 * Ganti placeholder motor dengan GLB instanced (bila siap): teras sekretariat = model detail (dilihat dari dekat); lot stadion
 * mini & rusunawa (±410 motor) = satu THREE.LOD per sel 36 m: model ±1k segitiga di dekat, siluet ±110 segitiga ≤ 300 m, di luar itu
 * tak digambar (LOD otomatis di render, tanpa sistem tambahan). Placeholder disembunyikan hanya bila GLB jenis itu berhasil.
 * Panggil setelah parkir terpasang di `root`.
 * @returns {Promise<{failed:string[], replaced:string[]}>}
 */
export async function upgradeSekreMotors({ root, scope, heightAt, layout = LEMBAGA_LAYOUT, isCancelled = () => false, ready = MOTOR_GLB_READY }) {
  const result = { failed: [], replaced: [] };
  if (!ready) return result;
  const sets = [
    { name: SEKRE_MOTOR_GROUP, list: layout.teras.motors, seed: 53, lod: false },
    { name: LOT_MOTOR_GROUP, list: [...layout.lots.stadionMini.motors, ...layout.lots.rusunawa.motors], seed: 31, lod: true },
  ];
  await Promise.all(sets.flatMap((set) => {
    const holder = root.getObjectByName(set.name);
    if (!holder) return [];
    const byKind = motorsByKind(set.list, heightAt);
    return KINDS.map(async (kind) => {
      if (!byKind[kind].length) return;
      const seed = set.seed + (kind === 'matic' ? 7 : 0);
      const load = (variant, positions) => withScope(scope, () => loadMotorInstances(kind, positions, { seed, variant, isCancelled }));
      let glb;
      if (!set.lod) {
        glb = await load('hi', byKind[kind]);
      } else {
        const cells = await Promise.all(cellsOf(byKind[kind]).map(async (cell) => {
          const [lo, far] = await Promise.all([load('lo', cell.items), load('far', cell.items)]);
          return lo && far ? { cell, lo, far } : null;
        }));
        if (!isCancelled() && cells.every(Boolean)) {
          glb = new THREE.Group();
          for (const { cell, lo, far } of cells) {
            const lod = new THREE.LOD();
            lod.position.set(cell.cx, 0, cell.cz);
            lod.addLevel(lo, 0);
            lod.addLevel(far, LOT_LOD.lo);
            lod.addLevel(new THREE.Group(), LOT_LOD.hidden);
            glb.add(lod);
          }
        }
      }
      if (isCancelled()) return;
      const placeholder = holder.getObjectByName(`${set.name}:${kind}`);
      if (!glb) {
        result.failed.push(`${set.name}:${kind}`);
        return;
      }
      glb.name = `${set.name}:${kind}:glb`;
      holder.add(glb);
      if (placeholder) placeholder.visible = false;
      result.replaced.push(`${set.name}:${kind}`);
    });
  }));
  return result;
}
