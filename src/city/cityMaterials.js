/**
 * Material bersama tile kota, dipilih berdasarkan NAMA mesh ("Format tile v1"): landuse, water, roads,
 * buildings_walls, buildings_roofs. Warna dari vertex color (COLOR_0, linear). Lapisan datar digambar
 * tanpa menulis depth dengan renderOrder −3/−2/−1 (urutan segitiga menentukan visibilitas; tanah &
 * objek region yang digambar sesudahnya menutupi landuse kota yang menjorok ke mask). Tanah dasar kota
 * (renderOrder −4, y = −0,05) mengisi celah landuse. Tekstur jendela tidak dibuat: tile v1 tanpa UV.
 */
import * as THREE from 'three';

export const CITY_LAYERS = Object.freeze({
  ground: Object.freeze({ renderOrder: -4, flat: true }),
  landuse: Object.freeze({ renderOrder: -3, flat: true }),
  water: Object.freeze({ renderOrder: -2, flat: true }),
  roads: Object.freeze({ renderOrder: -1, flat: true }),
  buildings_walls: Object.freeze({ renderOrder: 0, flat: false }),
  buildings_roofs: Object.freeze({ renderOrder: 0, flat: false }),
});

export const CITY_GROUND_COLOR = 0xb9b59a; // tanah/rumput kering netral di bawah landuse

/** @returns {{forMesh(name:string): THREE.Material|null, layerOf(name:string): object|null, owns(r:object): boolean, ground: THREE.Material, dispose(): void}} */
export function createCityMaterials() {
  const flat = (name, Ctor, extra = {}) => {
    const m = new Ctor({ vertexColors: true, depthWrite: false, ...extra });
    m.name = `kota:${name}`;
    return m;
  };
  const solid = (name) => {
    const m = new THREE.MeshLambertMaterial({ vertexColors: true });
    m.name = `kota:${name}`;
    return m;
  };
  const byName = {
    landuse: flat('landuse', THREE.MeshLambertMaterial),
    water: flat('water', THREE.MeshStandardMaterial, { roughness: 0.35, metalness: 0 }),
    roads: flat('roads', THREE.MeshLambertMaterial),
    buildings_walls: solid('buildings_walls'),
    buildings_roofs: solid('buildings_roofs'),
  };
  const ground = new THREE.MeshLambertMaterial({ color: CITY_GROUND_COLOR, depthWrite: true });
  ground.name = 'kota:ground';
  const all = new Set([...Object.values(byName), ground]);
  return {
    forMesh: (name) => byName[name] ?? null,
    layerOf: (name) => CITY_LAYERS[name] ?? null,
    owns: (r) => all.has(r),
    ground,
    dispose() { for (const m of all) m.dispose(); },
  };
}

/**
 * Pasang material & aturan render pada scene GLB tile (di tempat). Mesh dengan nama tak dikenal
 * disembunyikan (kontrak dilanggar) agar placeholder putih tidak tampil.
 * @returns {{meshes: number, triangles: number}}
 */
export function applyCityMaterials(root, materials) {
  let meshes = 0;
  let triangles = 0;
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mat = materials.forMesh(o.name);
    const layer = materials.layerOf(o.name);
    if (!mat || !layer) {
      o.visible = false;
      return;
    }
    o.material.dispose?.(); // placeholder bawaan GLB
    o.material = mat;
    o.renderOrder = layer.renderOrder;
    o.castShadow = !layer.flat;
    o.receiveShadow = true;
    meshes += 1;
    triangles += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
  });
  return { meshes, triangles };
}
