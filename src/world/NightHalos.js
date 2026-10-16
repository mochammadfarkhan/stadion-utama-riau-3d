/**
 * Halo cahaya malam: titik aditif lembut di lensa floodlight atap dan bohlam PJU. Tanpa PointLight
 * baru (nol biaya per piksel) dan hanya 2 draw call (`Points`). Tanpa halo, lampu malam tampak
 * sebagai titik putih datar karena tidak ada bloom di rantai post-processing.
 */
import * as THREE from 'three';

const FLOOD_COLOR = 0xfff1dc;
const LAMP_COLOR = 0xffd9a0;
const FLOOD_SIZE = 9;      // m (sizeAttenuation)
const LAMP_SIZE = 3.2;
const FLOOD_OPACITY = 0.85;
const LAMP_OPACITY = 0.75;

/** Posisi dunia semua instans lensa floodlight (InstancedMesh dengan material 'lensaFloodlight') di bawah `root`. */
export function floodLensPositions(root) {
  const out = [];
  const m = new THREE.Matrix4();
  const c = new THREE.Vector3();
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isInstancedMesh || o.material?.name !== 'lensaFloodlight') return;
    o.geometry.computeBoundingBox();
    const center = o.geometry.boundingBox.getCenter(new THREE.Vector3());
    for (let i = 0; i < o.count; i += 1) {
      o.getMatrixAt(i, m);
      c.copy(center).applyMatrix4(m).applyMatrix4(o.matrixWorld);
      out.push({ x: c.x, y: c.y, z: c.z });
    }
  });
  return out;
}

/** Kurva kemunculan halo dari tingkat lampu 0..1: muncul belakangan (kuadrat) agar senja tidak mencolok. */
export function haloLevel(level) {
  if (!Number.isFinite(level)) return 0;
  const t = Math.min(1, Math.max(0, level));
  return t * t;
}

/** Tekstur radial lembut (inti terang → tepi transparan). */
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePoints(positions, { color, size, opacity, map }) {
  const arr = new Float32Array(positions.length * 3);
  positions.forEach((p, i) => arr.set([p.x, p.y, p.z], i * 3));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const mat = new THREE.PointsMaterial({
    map, color, size, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending, fog: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.userData.maxOpacity = opacity;
  pts.frustumCulled = false;
  pts.visible = false;
  return pts;
}

/**
 * @param {THREE.Object3D} parent grup pemilik halo
 * @param {{x:number, y:number, z:number}[]} lampPositions posisi bohlam PJU yang menyala
 * @param {THREE.Object3D} [lensRoot] tempat mencari lensa floodlight (default: parent)
 * @returns {{setLevel(level:number):void}}
 */
export function createNightHalos(parent, lampPositions, lensRoot = parent) {
  if (typeof document === 'undefined') return { setLevel() {} }; // Node/tes
  const map = glowTexture();
  const group = new THREE.Group();
  group.name = 'halo-malam';
  const sets = [
    makePoints(floodLensPositions(lensRoot), { color: FLOOD_COLOR, size: FLOOD_SIZE, opacity: FLOOD_OPACITY, map }),
    makePoints(lampPositions, { color: LAMP_COLOR, size: LAMP_SIZE, opacity: LAMP_OPACITY, map }),
  ];
  group.add(...sets);
  parent.add(group);
  return {
    setLevel(level) {
      const k = haloLevel(level);
      for (const s of sets) {
        s.material.opacity = s.userData.maxOpacity * k;
        s.visible = k > 0.01;
      }
    },
  };
}
