/**
 * Gabung mesh polos (hanya beda warna cat) jadi SATU Mesh ber-vertex-color,
 * supaya gerobak ber-10 material tidak jadi 10 draw call.
 *
 * mergeVertexColors(group): mesh "polos" (material tunggal tanpa map/alphaMap/emissiveMap/
 * normalMap, tidak transparan, opacity 1, tak emisif, bukan instanced/skinned/dinamis, visible)
 * dipanggang ke satu geometri non-indexed (position, normal, color; transform dunia dipanggang
 * seperti mergeByMaterial) dengan `material.color` jadi atribut color. Satu Mesh per `side`
 * (maks 2). Material hasil = MeshLambertMaterial bersama tingkat modul: sumber Standard/Phong
 * kehilangan kilapnya (tidak penting untuk benda kecil seperti gerobak).
 * Sisanya (bertekstur, transparan, emisif, instanced, dll.) dilewatkan ke mergeByMaterial
 * apa adanya, jadi perilaku untuk mesh itu tidak berubah.
 *
 * Kontrak sama dengan mergeByMaterial: group asal DIPINDAH-ISI (mesh polos dilepas dari
 * induknya, sisanya dipindah ke group hasil); jangan pakai group asal lagi. Geometri &
 * material sumber tidak di-dispose.
 */
import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshLambertMaterial, DoubleSide, FrontSide } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mergeByMaterial } from './mergeByMaterial.js';

const TEXTURE_SLOTS = ['map', 'alphaMap', 'emissiveMap', 'normalMap'];
const sharedMats = new Map(); // side → material gabungan bersama

function sharedMaterial(side) {
  if (!sharedMats.has(side)) {
    const m = new MeshLambertMaterial({ vertexColors: true, side });
    m.name = 'gabung:warna';
    sharedMats.set(side, m);
  }
  return sharedMats.get(side);
}

/** Mesh polos = layak dipanggang jadi vertex color. */
function isPlain(obj) {
  if (!obj.isMesh || obj.isInstancedMesh || obj.isSkinnedMesh || obj.isBatchedMesh) return false;
  if (obj.userData?.dynamic || obj.userData?.update || !obj.visible) return false;
  const mat = obj.material;
  if (!mat || Array.isArray(mat) || !mat.color) return false;
  if (!obj.geometry?.attributes?.position) return false;
  if (TEXTURE_SLOTS.some((k) => mat[k])) return false;
  if (mat.transparent || mat.opacity !== 1) return false;
  if (mat.emissive && mat.emissive.getHex() !== 0) return false;
  return mat.side === FrontSide || mat.side === DoubleSide;
}

/** Salinan geometri non-indexed (position, normal, color) dengan transform dunia + warna cat. */
function bakeGeometry(mesh) {
  const src = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
  const pos = src.attributes.position;
  const n = pos.count;
  const position = new Float32Array(n * 3);
  const color = new Float32Array(n * 3);
  const col = mesh.material.color;
  const vc = mesh.material.vertexColors ? src.attributes.color : null;
  for (let i = 0; i < n; i++) {
    position[i * 3] = pos.getX(i); position[i * 3 + 1] = pos.getY(i); position[i * 3 + 2] = pos.getZ(i);
    color[i * 3] = col.r * (vc ? vc.getX(i) : 1);
    color[i * 3 + 1] = col.g * (vc ? vc.getY(i) : 1);
    color[i * 3 + 2] = col.b * (vc ? vc.getZ(i) : 1);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(position, 3));
  const nrm = src.attributes.normal;
  if (nrm) {
    const normal = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { normal[i * 3] = nrm.getX(i); normal[i * 3 + 1] = nrm.getY(i); normal[i * 3 + 2] = nrm.getZ(i); }
    g.setAttribute('normal', new Float32BufferAttribute(normal, 3));
  }
  g.setAttribute('color', new Float32BufferAttribute(color, 3));
  if (!nrm) g.computeVertexNormals();
  g.applyMatrix4(mesh.matrixWorld);
  if (src !== mesh.geometry) src.dispose();
  return g;
}

/**
 * @param {Group} group group statis yang sudah diposisikan
 * @param {{name?:string}} [opts]
 * @returns {Group} group baru: maks 2 Mesh `gabung:warna` + sisa mesh via mergeByMaterial
 */
export function mergeVertexColors(group, { name } = {}) {
  group.updateMatrixWorld(true);
  const bySide = new Map(); // side → mesh[]
  group.traverse((obj) => {
    if (obj !== group && isPlain(obj)) {
      if (!bySide.has(obj.material.side)) bySide.set(obj.material.side, []);
      bySide.get(obj.material.side).push(obj);
    }
  });
  const plain = [...bySide.values()].flat();
  plain.forEach((m) => m.parent.remove(m)); // sisanya diurus mergeByMaterial (matrixWorld induk tetap valid)

  const root = mergeByMaterial(group);
  if (name !== undefined) root.name = name;
  for (const [side, meshes] of bySide) {
    const geos = meshes.map(bakeGeometry);
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) continue;
    merged.computeBoundingSphere();
    const mesh = new Mesh(merged, sharedMaterial(side));
    mesh.name = `gabung:warna+${meshes.length}`;
    mesh.castShadow = meshes.some((m) => m.castShadow);
    mesh.receiveShadow = meshes.some((m) => m.receiveShadow);
    root.add(mesh);
  }
  return root;
}
