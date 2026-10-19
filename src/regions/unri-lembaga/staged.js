/**
 * Rakitan bertahap untuk scheduler (spec §4.3): tiap langkah menambah objek ke grup mentah; finish()
 * menggabung per material (mergeByMaterial) sekali di akhir. Transform opsional = sub-frame bangunan.
 */
import * as THREE from 'three';
import { mergeByMaterial } from '../../world/util/merge.js';

/**
 * @param {string} name
 * @param {Array<() => (THREE.Object3D|THREE.Object3D[]|null|void)>} stepFns
 * @param {{x:number, y?:number, z:number, yaw?:number}|null} [frame]
 * @param {{merge?:boolean}} [opts] merge=false: grup mentah apa adanya (InstancedMesh tidak boleh digabung)
 * @returns {{steps: Array<() => void>, finish(): THREE.Group}}
 */
export function staged(name, stepFns, frame = null, { merge = true } = {}) {
  const raw = new THREE.Group();
  raw.name = name;
  if (frame) {
    raw.position.set(frame.x, frame.y ?? 0, frame.z);
    raw.rotation.y = frame.yaw ?? 0;
  }
  return {
    steps: stepFns.map((fn) => () => {
      const out = fn();
      for (const o of [out].flat()) if (o) raw.add(o);
    }),
    finish() {
      if (!merge) return raw;
      const merged = mergeByMaterial(raw);
      merged.name = name;
      return merged;
    },
  };
}

/** Group berisi satu Mesh per (material → daftar geometri) yang diberikan. */
export function meshesByMaterial(name, entries, { cast = false, minimap = false, layer = 1 } = {}) {
  const g = new THREE.Group();
  g.name = name;
  for (const [material, geos] of entries) {
    for (const geo of geos) {
      const m = new THREE.Mesh(geo, material);
      m.name = `${name}:${material.name}`;
      m.castShadow = cast;
      m.receiveShadow = true;
      if (minimap) m.layers.enable(layer);
      g.add(m);
    }
  }
  return g;
}
