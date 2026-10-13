/**
 * Dekal permukaan: satu InstancedMesh bidang tipis alpha-blended dari atlas
 * dekal (1 material, 1 geometri ⇒ 1 draw call). Sub-rect UV per instance
 * lewat atribut `aUvRect` (u0, v0, du, dv) yang memetakan ulang vMapUv di
 * shader Lambert (onBeforeCompile).
 */
import * as THREE from 'three';
import { createDecalAtlas } from './textures/decalAtlas.js';
import { createDecalLayout } from './Decals.layout.js';

const RENDER_ORDER = 1;           // setelah tanah/jalan (renderOrder 0)
const ALPHA_TEST = 0.05;
const POLY_OFFSET = -2;           // tarik dekal ke arah kamera (anti z-fighting)
const HALF_PI = Math.PI / 2;

/** Sisipkan atribut aUvRect & petakan vMapUv ke sub-rect atlas. */
function patchShader(shader) {
  shader.vertexShader = `attribute vec4 aUvRect;\n${shader.vertexShader}`.replace(
    '#include <uv_vertex>',
    '#include <uv_vertex>\n#ifdef USE_MAP\n  vMapUv = aUvRect.xy + uv * aUvRect.zw;\n#endif',
  );
}

function createDecalMaterial(texture) {
  const mat = new THREE.MeshLambertMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    alphaTest: ALPHA_TEST,
    polygonOffset: true,
    polygonOffsetFactor: POLY_OFFSET,
    polygonOffsetUnits: POLY_OFFSET,
  });
  mat.name = 'dekalAtlas';
  mat.onBeforeCompile = patchShader;
  mat.customProgramCacheKey = () => 'dekalAtlas-uvRect';
  return mat;
}

/** Matriks instance: horizontal = rebah di bidang XZ; vertical = tegak menghadap +Z lokal. */
function decalMatrix(item, width, height, tmp) {
  tmp.euler.set(item.vertical ? 0 : -HALF_PI, item.rotY ?? 0, 0, 'YXZ');
  tmp.quat.setFromEuler(tmp.euler);
  tmp.pos.set(item.x, item.y ?? 0, item.z);
  tmp.scale.set(width, height, 1);
  return tmp.matrix.compose(tmp.pos, tmp.quat, tmp.scale);
}

/** Isi matriks & aUvRect untuk semua item. */
function fillInstances(mesh, items, atlas) {
  const rects = new Float32Array(items.length * 4);
  const tmp = {
    euler: new THREE.Euler(), quat: new THREE.Quaternion(), pos: new THREE.Vector3(),
    scale: new THREE.Vector3(), matrix: new THREE.Matrix4(),
  };
  items.forEach((item, i) => {
    const r = atlas.uv(item.name);
    const height = item.scale ?? 1;
    const width = height * (item.aspect ?? r.du / r.dv);
    mesh.setMatrixAt(i, decalMatrix(item, width, height, tmp));
    rects.set([r.u0, r.v0, r.du, r.dv], i * 4);
  });
  mesh.geometry.setAttribute('aUvRect', new THREE.InstancedBufferAttribute(rects, 4));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
}

/**
 * @param {{items?: ReadonlyArray<{name:string,x:number,y?:number,z:number,rotY?:number,scale?:number,aspect?:number,vertical?:boolean}>}} [opts]
 * @returns {THREE.Group} grup berisi satu InstancedMesh 'dekal'
 */
export function createDecals({ items = createDecalLayout() } = {}) {
  const group = new THREE.Group();
  group.name = 'dekal';
  if (!items.length) return group;
  const atlas = createDecalAtlas();
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), createDecalMaterial(atlas.texture), items.length);
  mesh.name = 'dekalInstanced';
  mesh.renderOrder = RENDER_ORDER;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  fillInstances(mesh, items, atlas);
  group.add(mesh);
  return group;
}
