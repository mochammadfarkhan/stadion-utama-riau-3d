/**
 * Helper geometri props kampus UNRI. Semua geometri terindeks dengan position/normal/uv agar bisa digabung
 * mergeByMaterial; `paint` menambah atribut warna (material vertexColors) sehingga banyak benda berwarna
 * berbeda tetap satu draw call.
 */
import * as THREE from 'three';

/** Balok w×h×d, alas di y0, pusat (x, z). */
export function boxAt(w, h, d, x = 0, y0 = 0, z = 0) {
  return new THREE.BoxGeometry(w, h, d).translate(x, y0 + h / 2, z);
}

/** Atribut warna per-vertex seragam. */
export function paint(geometry, hex) {
  const c = new THREE.Color(hex);
  const n = geometry.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 1) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geometry;
}

/** Quad dari 4 sudut [x,y,z] berlawanan jarum jam dilihat dari sisi depan, UV per sudut. */
export function quad(corners, uvs = [[0, 0], [1, 0], [1, 1], [0, 1]]) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(corners.flat(), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs.flat(), 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  return g;
}

/** Petakan UV 0..1 geometri ke sel atlas {u0,u1,v0,v1}. */
export function uvToCell(geometry, cell) {
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i += 1) {
    uv.setXY(i, cell.u0 + uv.getX(i) * (cell.u1 - cell.u0), cell.v0 + uv.getY(i) * (cell.v1 - cell.v0));
  }
  uv.needsUpdate = true;
  return geometry;
}

/** Plane w×h menghadap −Z (muka depan prop), pusat (x, y, z), opsional UV sel atlas. */
export function facePlane(w, h, { x = 0, y = 0, z = 0, cell = null } = {}) {
  const g = new THREE.PlaneGeometry(w, h);
  if (cell) uvToCell(g, cell);
  return g.rotateY(Math.PI).translate(x, y, z);
}

/** Mesh bernama dengan flag bayangan. */
export function meshOf(geometry, material, name = '', { cast = false } = {}) {
  const m = new THREE.Mesh(geometry, material);
  m.name = name;
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
}
