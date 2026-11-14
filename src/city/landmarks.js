/**
 * Landmark hero mode Kota (model Blender 3 tingkat LOD, lihat docs/kota/DAFTAR-IKON.md).
 * Tiap landmark = 1 draw call: hanya satu tingkat LOD yang tampil, dipilih menurut jarak kamera → landmark.
 * Data posisi dari OSM (jejak), yaw = pencocokan arah jejak [INFERENSI sisi depan].
 */
import * as THREE from 'three';
import { FACADE_UNIFORMS } from './facade.js';
import { GENERATED_LANDMARKS } from './landmarks.data.js';

export const LANDMARK_Y = -0.05;

/**
 * Malam: ceruk/jendela gelap (luminans < 0,05) menyala hangat, seluruh permukaan disorot lembut (masjid biasa diterangi lampu sorot).
 * Memakai `uNight` bersama fasad kota (facade.js), diperbarui sistem city.stream tiap frame.
 */
export function applyLandmarkNight(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = FACADE_UNIFORMS.uNight;
    shader.fragmentShader = `uniform float uNight;
${shader.fragmentShader}`.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      #ifdef USE_COLOR
        float lmLum = dot(vColor.rgb, vec3(0.299, 0.587, 0.114));
        float lmWin = 1.0 - smoothstep(0.03, 0.06, lmLum);
        totalEmissiveRadiance += uNight * (lmWin * vec3(1.0, 0.78, 0.4) * 0.95 + (1.0 - lmWin) * vColor.rgb * 0.2);
      #endif`,
    );
  };
  material.customProgramCacheKey = () => 'landmarkNight';
  return material;
}

/** `lod`: batas jarak (m) ke LOD1 dan LOD2. `files`: GLB di public/models/landmark/ (LOD0 terdetail dulu). */
export const LANDMARKS = Object.freeze([
  {
    id: 'an-nur', name: 'Masjid Agung An-Nur', x: 6823.0, z: -4760.1, yaw: 1.117, // depan (+Z model) → timur-tenggara (cos26°, sin26°) ke plaza; citra satelit
    // jarak kamera ≈ 1300 m × zoom kota (zoom 0,4–9): LOD0 sampai zoom ±1, LOD1 sampai ±2,1, sisanya LOD2
    files: ['an-nur-lod0.glb', 'an-nur-lod1.glb', 'an-nur-lod2.glb'], lod: [1300, 2800],
  },
  // Jembatan: model memakai koordinat dunia relatif ke titik tengah garis OSM (yaw 0); lihat assets-src/blender/landmark/jembatan.py
  {
    id: 'jembatan-siak-1', name: 'Jembatan Siak I (Leighton)', x: 5294.0, z: -6345.0, yaw: 0,
    files: ['jembatan-siak-1-lod0.glb', 'jembatan-siak-1-lod1.glb', 'jembatan-siak-1-lod2.glb'], lod: [1300, 2800],
  },
  {
    id: 'jembatan-siak-3', name: 'Jembatan Siak III', x: 5535.0, z: -6441.0, yaw: 0,
    files: ['jembatan-siak-3-lod0.glb', 'jembatan-siak-3-lod1.glb', 'jembatan-siak-3-lod2.glb'], lod: [1300, 2800],
  },
  {
    id: 'jembatan-siak-4', name: 'Jembatan Siak IV', x: 6467.2, z: -6184.0, yaw: 0,
    files: ['jembatan-siak-4-lod0.glb', 'jembatan-siak-4-lod1.glb', 'jembatan-siak-4-lod2.glb'], lod: [1300, 2800],
  },  ...GENERATED_LANDMARKS, // bangunan, tugu, bandara: assets-src/blender/landmark/bangunan.py
]);

/**
 * Pilih indeks LOD dengan histeresis 12% agar tidak berkedip di batas.
 * @param {number} dist jarak (m); @param {number} current LOD sekarang; @param {number[]} limits batas naik [d1, d2]
 */
export function pickLod(dist, current, limits) {
  const H = 0.12;
  let lod = 0;
  for (let i = 0; i < limits.length; i += 1) {
    const edge = limits[i] * (current > i ? 1 - H : 1 + H);
    if (dist > edge) lod = i + 1;
  }
  return lod;
}

/** Jarak efektif kamera → landmark: kamera setinggi `distance` di atas fokus, landmark berjarak mendatar dari fokus. */
export function landmarkDistance(distance, focus, lm) {
  return Math.hypot(distance, lm.x - focus.x, lm.z - focus.z);
}

/**
 * @param {{parent: THREE.Object3D, baseUrl?: string, loadGltf: (url: string) => Promise<{scene: THREE.Object3D}>, logger?: {error: Function}}} o
 */
export function createLandmarks({ parent, baseUrl = '/', loadGltf, logger = console, list = LANDMARKS }) {
  const group = new THREE.Group();
  group.name = 'landmark';
  group.visible = false;
  parent.add(group);
  const material = applyLandmarkNight(new THREE.MeshLambertMaterial({ vertexColors: true }));
  material.name = 'landmark:warna';
  const entries = list.map((def) => ({ def, lods: [], lod: 0, root: new THREE.Group() }));
  const owned = [material];
  let disposed = false;

  const ready = Promise.all(entries.map(async (e) => {
    e.root.name = `landmark:${e.def.id}`;
    e.root.position.set(e.def.x, LANDMARK_Y, e.def.z);
    e.root.rotation.y = e.def.yaw;
    for (const file of e.def.files) {
      try {
        const gltf = await loadGltf(`${baseUrl}models/landmark/${file}`);
        let mesh = null;
        gltf.scene.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
        if (!mesh) throw new Error('GLB tanpa mesh');
        mesh.material = material;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.removeFromParent();
        owned.push(mesh.geometry);
        e.lods.push(mesh);
      } catch (err) {
        logger.error(`Landmark ${e.def.id} ${file} gagal:`, err);
        e.lods.push(null);
      }
    }
    for (const m of e.lods) if (m) { m.visible = false; e.root.add(m); }
    if (!disposed) group.add(e.root);
  }));

  const show = (e, lod) => {
    // jatuh ke LOD terdekat yang berhasil dimuat
    let use = lod;
    while (use > 0 && !e.lods[use]) use -= 1;
    while (use < e.lods.length - 1 && !e.lods[use]) use += 1;
    e.lods.forEach((m, i) => { if (m) m.visible = i === use; });
  };

  return {
    group, ready,
    setActive(on) { group.visible = Boolean(on); },
    /** Tiap frame saat pratinjau: `focus` {x,z}, `distance` kamera→fokus (m). */
    update({ focus, distance }) {
      if (!group.visible) return;
      for (const e of entries) {
        const lod = pickLod(landmarkDistance(distance, focus, e.def), e.lod, e.def.lod);
        if (lod !== e.lod || !e.lods.some((m) => m?.visible)) { e.lod = lod; show(e, lod); }
      }
    },
    stats: () => ({ landmarks: entries.length, lod: entries.map((e) => e.lod) }),
    dispose() {
      disposed = true;
      group.removeFromParent();
      for (const r of owned) r.dispose?.();
    },
  };
}
