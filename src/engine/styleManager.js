import * as THREE from 'three';
import {
  ANGLED_SHADOW_EXTENT, ATMOSPHERE, GRADING, LOWPOLY_EXCLUDE, LOWPOLY_SAVINGS, STYLES,
} from '../config/lowpoly.js';
import { createContactShadows } from './contactShadows.js';
import { applyStyleSwap } from './pbrSwap.js';
import { deriveStyleFactors, setStyleState, styleState } from './styleState.js';
import { effectiveTerrainQuality, resolveTerrainQuality } from './terrainQuality.js';

const SCAN_INTERVAL = 1.5; // detik antar penelusuran material baru (region/distrik/model yang dimuat kemudian)
const SHADOW_SIZES = Object.freeze({ mati: 0, rendah: 1024, sedang: 2048, tinggi: 4096 });

/** Nama material masuk daftar kecuali (kaca, air, langit, ...)? */
export function isExcludedName(name, list = LOWPOLY_EXCLUDE) {
  const n = String(name ?? '').toLowerCase();
  return list.some((k) => n.includes(k));
}

/** Material yang boleh diubah (PBR/Lambert/Phong; ShaderMaterial buatan sendiri dilewati). */
export function isStylable(mat) {
  return Boolean(mat && (mat.isMeshStandardMaterial || mat.isMeshLambertMaterial || mat.isMeshPhongMaterial));
}

/**
 * Terapkan gaya ke satu material (idempoten; `stash` WeakMap menyimpan nilai asli agar bisa kembali ke 'asli').
 * facet: flatShading (kecuali nama di daftar kecuali). kartun/facet: anisotropi 1 dan tanpa normal map kecil.
 * @returns {boolean} true bila ada perubahan yang butuh recompile
 */
export function styleMaterial(mat, style, stash, exclude = LOWPOLY_EXCLUDE) {
  if (!isStylable(mat)) return false;
  if (mat.userData?.pbr) return false; // material PBR (tanah splat, jalan) menangani gayanya sendiri lewat pbrSwap
  let orig = stash.get(mat);
  if (!orig) {
    orig = { flat: Boolean(mat.flatShading), normalMap: mat.normalMap ?? null, aniso: mat.map?.anisotropy ?? null };
    stash.set(mat, orig);
  }
  const lowpoly = style !== 'asli';
  const wantFlat = style === 'facet' && !isExcludedName(mat.name, exclude) ? true : orig.flat;
  const wantNormal = lowpoly ? null : orig.normalMap;
  let changed = false;
  if (Boolean(mat.flatShading) !== wantFlat) { mat.flatShading = wantFlat; changed = true; }
  if ((mat.normalMap ?? null) !== wantNormal) { mat.normalMap = wantNormal; changed = true; }
  if (mat.map && orig.aniso !== null) mat.map.anisotropy = lowpoly ? 1 : orig.aniso;
  if (changed) mat.needsUpdate = true;
  return changed;
}

/**
 * Manajer gaya grafis terpusat. Mengikuti 'graphics.gayaGrafis' + mode kamera: material (scan berkala menangkap
 * region/distrik/model yang dimuat kemudian), grading, atmosfer, bayangan, LOD (styleState), contact shadow.
 */
export function createStyleManager({ store, app, scene, lighting, rig, time = null, crowd = null, bike, terrain, streamLoadRadius = 1000 }) {
  const stash = new WeakMap();
  const applied = new WeakMap(); // material -> gaya yang sudah diterapkan
  const appliedSwap = new WeakMap(); // objek ber-pbrSwap -> "gaya:kualitas" yang terpasang
  let rawQuality = 'tinggi';
  let qualityTimer = 0;
  const contact = createContactShadows({ heightAt: terrain.heightAt });
  scene.add(contact.mesh);
  const sun = lighting?.userData?.sun ?? null;
  const hemiSky = new THREE.Color(ATMOSPHERE.hemiSkyTint);
  const hemiGround = new THREE.Color(ATMOSPHERE.hemiGroundTint);
  let style = 'asli';
  let scanTimer = 0;
  let needScan = true;

  const scan = () => {
    const swapKey = `${style}:${styleState.terrainQuality}`;
    scene.traverse((o) => {
      if (o.userData?.pbrSwap && appliedSwap.get(o) !== swapKey) { // material per gaya/kualitas tanah (kartun/facet = PBR)
        applyStyleSwap(o, style, styleState.terrainQuality);
        appliedSwap.set(o, swapKey);
      }
      const m = o.material;
      if (!m) return;
      for (const mat of Array.isArray(m) ? m : [m]) {
        if (applied.get(mat) === style) continue;
        styleMaterial(mat, style, stash);
        applied.set(mat, style);
      }
    });
    needScan = false;
  };

  const applyEnvironment = () => {
    const angled = rig.mode === 'angled';
    const f = deriveStyleFactors(style, angled, LOWPOLY_SAVINGS);
    const saving = f.lod !== 1;
    setStyleState({ style, angled, ...f });
    app.setGrading?.(GRADING[style] ?? null);
    app.setPixelCap?.(f.pixelCap);
    app.setAO?.(style === 'asli' ? Boolean(store.get('graphics.ao')) : false);
    app.setVignette?.(style === 'asli' ? Boolean(store.get('graphics.vignette')) : false);
    crowd?.setDensity?.(store.get('graphics.crowdDensity') * f.density);
    time?.setFogLimit?.(streamLoadRadius * f.tileLoad);
    contact.setEnabled(style !== 'asli');
    lighting?.userData?.setShadowExtent?.(angled ? ANGLED_SHADOW_EXTENT : lighting.userData.shadowExtentDefault);
    if (sun?.shadow) { // ukuran peta bayangan: 1024 saat hemat, selain itu pengaturan kualitas
      const size = saving ? LOWPOLY_SAVINGS.shadowMapSize : SHADOW_SIZES[store.get('graphics.shadowQuality')];
      if (size > 0 && sun.shadow.mapSize.x !== size) {
        sun.shadow.mapSize.set(size, size);
        sun.shadow.map?.dispose?.();
        sun.shadow.map = null;
        sun.shadow.needsUpdate = true;
      }
    }
  };

  /** Kualitas tanah PBR: pengaturan manual atau otomatis dari resolusi render efektif (histeresis); facet = tanpa normal. */
  const updateTerrainQuality = () => {
    rawQuality = resolveTerrainQuality(store.get('graphics.tanahPbr'), rawQuality, app.pixelRatio ?? 1);
    if (setStyleState({ terrainQuality: effectiveTerrainQuality(style, rawQuality) })) needScan = true;
  };

  const setStyle = (next) => {
    const s = STYLES.includes(next) ? next : 'asli';
    if (s === style && !needScan) return;
    style = s;
    needScan = true;
    scanTimer = 0;
    applyEnvironment();
    updateTerrainQuality();
  };

  const unsubs = [store.bind('graphics.gayaGrafis', setStyle), store.bind('graphics.tanahPbr', updateTerrainQuality)];
  let lastAngled = rig.mode === 'angled';
  applyEnvironment();

  const system = {
    id: 'style',
    phase: 'world',
    update(dt, ctx) {
      const angled = rig.mode === 'angled';
      if (angled !== lastAngled) { lastAngled = angled; applyEnvironment(); }
      qualityTimer -= dt;
      if (qualityTimer <= 0) { qualityTimer = 1; if (style !== 'asli') updateTerrainQuality(); }
      scanTimer -= dt;
      if ((needScan || style !== 'asli') && scanTimer <= 0) { scanTimer = SCAN_INTERVAL; scan(); }
      if (style === 'asli') return;
      // Sesudah TimeOfDay & Weather (urutan pendaftaran): atmosfer gaya ditumpuk tiap frame.
      if (scene.fog) { scene.fog.near *= ATMOSPHERE.fogScale; scene.fog.far *= ATMOSPHERE.fogScale; }
      const hemi = lighting?.userData?.hemi;
      if (hemi) {
        hemi.intensity *= ATMOSPHERE.hemiBoost;
        hemi.color.lerp(hemiSky, ATMOSPHERE.hemiTintMix);
        hemi.groundColor.lerp(hemiGround, ATMOSPHERE.hemiTintMix);
      }
      contact.update(ctx.focus, bike?.state);
    },
    dispose() {},
  };

  return {
    system,
    get style() { return style; },
    contact,
    rescan() { needScan = true; scanTimer = 0; },
    dispose() {
      for (const u of unsubs) u();
      style = 'asli';
      applyEnvironment();
      scan();
      contact.dispose();
    },
  };
}
