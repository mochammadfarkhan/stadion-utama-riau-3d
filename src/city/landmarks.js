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
 * Tampilan landmark: siang = kaca biru bergradasi sudut pandang + kusen 3 m pada pita jendela gelap, dinding sedikit lebih jenuh dan gelap di kaki;
 * malam = jendela (luminans < 0,05) menyala hangat, seluruh permukaan disorot lembut (masjid biasa diterangi lampu sorot).
 * Memakai `uNight` bersama fasad kota (facade.js), diperbarui sistem city.stream tiap frame. Tanpa tekstur/draw call baru.
 */
export function applyLandmarkNight(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = FACADE_UNIFORMS.uNight;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLmP;\nvarying vec3 vLmN;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvLmN = normalize(mat3(modelMatrix) * objectNormal);')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLmP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = `uniform float uNight;
${shader.fragmentShader}`.replace('#include <common>', '#include <common>\nvarying vec3 vLmP;\nvarying vec3 vLmN;').replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      #ifdef USE_COLOR
        vec3 lmN = normalize(vLmN);
        float lmWall = 1.0 - step(0.5, abs(lmN.y));
        float lmLumD = dot(vColor.rgb, vec3(0.299, 0.587, 0.114));
        float lmGlass = (1.0 - smoothstep(0.03, 0.06, lmLumD)) * lmWall;
        float lmDist = distance(vLmP, cameraPosition);
        vec3 lmV = normalize(cameraPosition - vLmP);
        float lmFres = pow(1.0 - abs(dot(lmV, lmN)), 2.0);
        float lmU = dot(vLmP.xz, vec2(-lmN.z, lmN.x));
        float lmPanel = fract(sin(dot(floor(vec2(lmU / 3.0, vLmP.y / 3.2)), vec2(12.9898, 78.233))) * 43758.5453);
        vec3 lmGlassC = mix(vec3(0.05, 0.16, 0.32), vec3(0.25, 0.45, 0.70), clamp(0.25 + 0.6 * lmFres + 0.25 * lmPanel, 0.0, 1.0));
        float lmMull = step(0.93, fract(lmU / 3.0)) * (1.0 - smoothstep(250.0, 700.0, lmDist));
        lmGlassC = mix(lmGlassC, vec3(0.62, 0.66, 0.70), lmMull);
        lmGlassC *= (1.0 - 0.85 * uNight);
        vec3 lmBase = diffuseColor.rgb;
        float lmGray = dot(lmBase, vec3(0.299, 0.587, 0.114));
        lmBase = mix(vec3(lmGray), lmBase, 1.25) * mix(1.0, mix(0.70, 1.0, smoothstep(0.0, 7.0, vLmP.y)), lmWall);
        // warna netral (abu/putih) saja yang dihangatkan: kubah, skylight, aksen berwarna tidak tersentuh
        float lmMax = max(vColor.r, max(vColor.g, vColor.b));
        float lmNeutral = 1.0 - smoothstep(0.30, 0.48, (lmMax - min(vColor.r, min(vColor.g, vColor.b))) / max(lmMax, 0.001));
        lmBase = mix(lmBase, lmBase * vec3(1.18, 1.0, 0.70), lmNeutral * lmWall); // dinding: krem hangat, bukan abu kebiruan
        // atap datar terang di atas tanah: beton hangat + sambungan panel 8 m (memudar 300–900 m); aspal gelap dibiarkan
        float lmRoof = step(0.5, lmN.y) * step(2.0, vLmP.y) * smoothstep(0.2, 0.35, lmLumD) * lmNeutral;
        vec2 lmSeam = abs(fract(vLmP.xz / 8.0) - 0.5);
        float lmLine = step(0.47, max(lmSeam.x, lmSeam.y)) * (1.0 - smoothstep(300.0, 900.0, lmDist));
        lmBase = mix(lmBase, vec3(0.62, 0.50, 0.38) * (0.75 + 0.5 * lmGray) * (1.0 - 0.18 * lmLine), lmRoof);
        diffuseColor.rgb = mix(max(lmBase, 0.0), lmGlassC, lmGlass);
      #endif`,
    ).replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      #ifdef USE_COLOR
        float lmLum = dot(vColor.rgb, vec3(0.299, 0.587, 0.114));
        float lmWin = 1.0 - smoothstep(0.03, 0.06, lmLum);
        totalEmissiveRadiance += uNight * (lmWin * vec3(1.0, 0.78, 0.4) * 0.95 + (1.0 - lmWin) * vColor.rgb * 0.2);
      #endif`,
    );
  };
  material.customProgramCacheKey = () => 'landmarkLook3';
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

/** Jarak mendatar maks (m) fokus → landmark saat bukan pratinjau (berjalan/bersepeda); kamera pemain far 2500. */
export const LANDMARK_WALK_RANGE = 2200;

/**
 * Landmark dimuat malas: GLB sebuah landmark baru diminta saat fokus masuk jangkauan (`LANDMARK_WALK_RANGE`;
 * pratinjau Kota = tanpa batas via `setPreview(true)`). Di luar jangkauan, root disembunyikan.
 * @param {{parent: THREE.Object3D, baseUrl?: string, loadGltf: (url: string) => Promise<{scene: THREE.Object3D}>, logger?: {error: Function}}} o
 */
export function createLandmarks({ parent, baseUrl = '/', loadGltf, logger = console, list = LANDMARKS }) {
  const group = new THREE.Group();
  group.name = 'landmark';
  parent.add(group);
  const material = applyLandmarkNight(new THREE.MeshLambertMaterial({ vertexColors: true }));
  material.name = 'landmark:warna';
  const entries = list.map((def) => {
    const root = new THREE.Group();
    root.name = `landmark:${def.id}`;
    root.position.set(def.x, LANDMARK_Y, def.z);
    root.rotation.y = def.yaw;
    root.visible = false;
    return { def, lods: [], lod: 0, root, loading: null };
  });
  const owned = [material];
  let disposed = false;
  let range = LANDMARK_WALK_RANGE;

  const load = (e) => {
    e.loading ??= (async () => {
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
    })();
    return e.loading;
  };

  const show = (e, lod) => {
    // jatuh ke LOD terdekat yang berhasil dimuat
    let use = lod;
    while (use > 0 && !e.lods[use]) use -= 1;
    while (use < e.lods.length - 1 && !e.lods[use]) use += 1;
    e.lods.forEach((m, i) => { if (m) m.visible = i === use; });
  };

  return {
    group,
    /** Promise semua landmark yang sudah diminta dimuat (getter: dihitung saat diakses). */
    get ready() { return Promise.all(entries.map((e) => e.loading).filter(Boolean)); },
    setActive(on) { group.visible = Boolean(on); },
    /** Pratinjau Kota: jangkauan tanpa batas; selain itu `LANDMARK_WALK_RANGE`. */
    setPreview(on) { range = on ? Infinity : LANDMARK_WALK_RANGE; },
    /** Tiap frame: `focus` {x,z}, `distance` kamera→fokus (m). Muat malas landmark yang masuk jangkauan. */
    update({ focus, distance }) {
      if (!group.visible) return;
      for (const e of entries) {
        if (Math.hypot(e.def.x - focus.x, e.def.z - focus.z) > range) { e.root.visible = false; continue; }
        e.root.visible = true;
        if (!e.loading) { load(e); continue; }
        if (e.lods.length < e.def.files.length) continue; // masih memuat
        const lod = pickLod(landmarkDistance(distance, focus, e.def), e.lod, e.def.lod);
        if (lod !== e.lod || !e.lods.some((m) => m?.visible)) { e.lod = lod; show(e, lod); }
      }
    },
    stats: () => ({ landmarks: entries.length, loaded: entries.filter((e) => e.loading).length, lod: entries.map((e) => e.lod) }),
    dispose() {
      disposed = true;
      group.removeFromParent();
      for (const r of owned) r.dispose?.();
    },
  };
}
