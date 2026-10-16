/**
 * Lepas geometri, material, dan tekstur di bawah `root`, lalu kosongkan anak-anaknya.
 * Sumber daya milik `scope` (ResourceScope) dilewati: scope yang melepasnya di scope.dispose().
 * Setiap sumber daya dilepas sekali walau dibagi banyak mesh. Lapisan engine: tanpa impor three.
 * @param {import('three').Object3D|null} root
 * @param {{scope?: {owns(resource: object): boolean}|null}} [opts]
 * @returns {{geometries:number, materials:number, textures:number}} jumlah yang benar-benar dilepas
 */
export function disposeTree(root, { scope = null } = {}) {
  const counts = { geometries: 0, materials: 0, textures: 0 };
  if (!root) return counts;
  const geometries = new Set();
  const materials = new Set();
  const instanced = [];
  root.traverse((o) => {
    if (o.geometry?.isBufferGeometry) geometries.add(o.geometry);
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m?.isMaterial) materials.add(m);
    if (o.isInstancedMesh) instanced.push(o);
  });
  const textures = new Set();
  for (const m of materials) {
    for (const v of Object.values(m)) if (v?.isTexture) textures.add(v);
    for (const u of Object.values(m.uniforms ?? {})) if (u?.value?.isTexture) textures.add(u.value);
  }
  const release = (set, key) => {
    for (const r of set) {
      if (scope?.owns(r)) continue;
      r.dispose();
      counts[key] += 1;
    }
  };
  release(geometries, 'geometries');
  release(materials, 'materials');
  release(textures, 'textures');
  for (const mesh of instanced) mesh.dispose();
  root.clear();
  return counts;
}
