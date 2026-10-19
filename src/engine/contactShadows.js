import * as THREE from 'three';
import { CONTACT_SHADOW } from '../config/lowpoly.js';

/**
 * Contact shadow murah: blob gelap bundar di tanah di bawah objek (pemain, pohon, NPC). Satu InstancedMesh = 1 draw call,
 * tanpa pass bayangan. Sumber titik didaftarkan lewat registerSource(fn(emit, focus)) (modul-level: region/distrik
 * mendaftar tanpa mengimpor manajer gaya).
 */
const sources = new Set();

/** @param {(emit: (x:number, z:number, r:number) => void, focus: {x:number, z:number}) => void} fn @returns {() => void} */
export function registerContactSource(fn) {
  sources.add(fn);
  return () => sources.delete(fn);
}

function blobTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.55)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

/** @param {{heightAt:(x:number,z:number)=>number}} opts */
export function createContactShadows({ heightAt }) {
  const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const tex = blobTexture();
  const mat = new THREE.MeshBasicMaterial({
    color: 0x10131c, alphaMap: tex, transparent: true, opacity: CONTACT_SHADOW.opacity, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, fog: true,
  });
  mat.name = 'contactShadow';
  const mesh = new THREE.InstancedMesh(geo, mat, CONTACT_SHADOW.max);
  mesh.name = 'contactShadows';
  mesh.frustumCulled = false;
  mesh.count = 0;
  mesh.renderOrder = 2;
  mesh.visible = false;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  let n = 0;
  const emit = (x, z, r) => {
    if (n >= CONTACT_SHADOW.max || !Number.isFinite(x + z + r)) return;
    p.set(x, heightAt(x, z) + CONTACT_SHADOW.y, z);
    s.set(r * 2, 1, r * 2);
    mesh.setMatrixAt(n, m.compose(p, q, s));
    n += 1;
  };
  return {
    mesh,
    get count() { return n; },
    setEnabled(on) { mesh.visible = Boolean(on); if (!on) mesh.count = 0; },
    update(focus, player) {
      if (!mesh.visible || !focus) return;
      n = 0;
      if (player) emit(player.x, player.z, CONTACT_SHADOW.playerRadius);
      for (const fn of sources) fn(emit, focus);
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() { geo.dispose(); mat.dispose(); tex.dispose(); mesh.dispose(); mesh.removeFromParent(); },
  };
}
