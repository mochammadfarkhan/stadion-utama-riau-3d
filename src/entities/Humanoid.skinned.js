/**
 * Humanoid → satu SkinnedMesh rigid: 1 draw call per orang (interior berisi banyak NPC dekat kamera; Humanoid
 * biasa ±17 mesh). Setiap pivot (body, spine, kepala, bahu, siku, tangan, pinggul, lutut) menjadi satu tulang;
 * setiap vertex ikut tepat satu tulang (bobot 1) sehingga bentuknya sama persis dengan Humanoid biasa.
 * Animasi tetap menulis ke pivot (Humanoid.anim / Humanoid.poses), lalu sync() menyalin transform pivot ke
 * tulang. Mesh asli DICABUT dari pohon (bukan disembunyikan) agar geometri bersama (Humanoid.dim GEO) tidak
 * ikut dilepas disposeTree pemilik scene; grup tangan (handL/handR) tetap ada untuk properti yang dipegang.
 * Warna = atribut vertex (warna material × warna vertex bila ada); material Lambert bersama per ResourceScope.
 * dispose() melepas tekstur tulang skeleton (tidak terjangkau disposeTree).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { currentScope } from '../engine/ResourceScope.js';

export const SKIN_PIVOTS = Object.freeze([
  'body', 'spine', 'headPivot', 'shoulderL', 'elbowL', 'handL', 'shoulderR', 'elbowR', 'handR', 'hipL', 'kneeL', 'hipR', 'kneeR',
]);
const WHITE = new THREE.Color(0xffffff);

const skinnedMaterial = () => currentScope().get('humanoid:skinnedMaterial', () => new THREE.MeshLambertMaterial({
  vertexColors: true, side: THREE.DoubleSide,
}));

/** Salinan non-indexed (posisi, normal, warna, skinIndex/skinWeight satu tulang) dalam ruang grup. */
function bakePiece(mesh, boneIndex) {
  const src = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', src.getAttribute('position').clone());
  if (src.getAttribute('normal')) geo.setAttribute('normal', src.getAttribute('normal').clone());
  else geo.computeVertexNormals();
  geo.applyMatrix4(mesh.matrixWorld);
  const n = geo.attributes.position.count;
  const base = mesh.material?.color ?? WHITE;
  const vc = src.getAttribute('color');
  const color = new Float32Array(n * 3);
  const skinIndex = new Uint16Array(n * 4);
  const skinWeight = new Float32Array(n * 4);
  for (let i = 0; i < n; i += 1) {
    color[i * 3] = base.r * (vc ? vc.getX(i) : 1);
    color[i * 3 + 1] = base.g * (vc ? vc.getY(i) : 1);
    color[i * 3 + 2] = base.b * (vc ? vc.getZ(i) : 1);
    skinIndex[i * 4] = boneIndex;
    skinWeight[i * 4] = 1;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(color, 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
  src.dispose();
  return geo;
}

/**
 * @param {{group: THREE.Group, parts: Record<string, THREE.Object3D>}} humanoid hasil createHumanoid (belum dipose)
 * @returns {{mesh: THREE.SkinnedMesh, skeleton: THREE.Skeleton, sync(): void, dispose(): void}}
 */
export function bakeSkinnedHumanoid(humanoid) {
  const { group, parts } = humanoid;
  const lod = group.userData.humanoidLod;
  if (lod) {
    lod.mesh.removeFromParent();
    lod.mesh.geometry.dispose();
    delete group.userData.humanoidLod;
  }
  group.position.set(0, 0, 0);
  group.rotation.set(0, 0, 0);
  group.scale.set(1, 1, 1);
  group.updateMatrixWorld(true);
  const pivots = SKIN_PIVOTS.map((name) => {
    if (!parts[name]) throw new Error(`bakeSkinnedHumanoid: pivot "${name}" tidak ada`);
    return parts[name];
  });
  const boneOf = new Map(pivots.map((p, i) => [p, i]));
  const bones = pivots.map((p, i) => {
    const b = new THREE.Bone();
    b.name = SKIN_PIVOTS[i];
    b.position.copy(p.position);
    b.quaternion.copy(p.quaternion);
    b.scale.copy(p.scale);
    return b;
  });
  pivots.forEach((p, i) => { if (i > 0) bones[boneOf.get(p.parent)].add(bones[i]); });

  const meshes = [];
  parts.body.traverse((o) => { if (o.isMesh && o.visible && o.geometry?.attributes?.position) meshes.push(o); });
  const pieces = meshes.map((m) => {
    let p = m.parent;
    while (p && !boneOf.has(p)) p = p.parent;
    return bakePiece(m, boneOf.get(p) ?? 0);
  });
  for (const m of meshes) m.removeFromParent();
  const geometry = mergeGeometries(pieces, false);
  pieces.forEach((g) => g.dispose());
  if (!geometry) throw new Error('bakeSkinnedHumanoid: penggabungan geometri gagal');

  const mesh = new THREE.SkinnedMesh(geometry, skinnedMaterial());
  mesh.name = 'humanoidSkinned';
  mesh.castShadow = true;
  mesh.frustumCulled = false; // pose duduk/rebahan keluar dari bounding sphere pose diam
  mesh.add(bones[0]);
  group.add(mesh);
  group.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  mesh.bind(skeleton);
  return {
    mesh,
    skeleton,
    sync() {
      for (let i = 0; i < pivots.length; i += 1) {
        const p = pivots[i];
        const b = bones[i];
        b.position.copy(p.position);
        b.quaternion.copy(p.quaternion);
        b.scale.copy(p.scale);
      }
    },
    dispose() { skeleton.dispose(); },
  };
}
