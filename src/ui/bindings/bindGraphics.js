/**
 * Binding grup "graphics" (store -> App/Lighting/Crowd).
 * shadowQuality: 'mati' | 'rendah' | 'sedang' | 'tinggi' -> ukuran shadow map.
 */

import { styleState } from '../../engine/styleState.js';

export const SHADOW_MAP_SIZES = Object.freeze({ mati: 0, rendah: 1024, sedang: 2048, tinggi: 4096 });

/**
 * Terapkan kualitas bayangan ke DirectionalLight: buang shadow map lama agar
 * renderer membuat ulang pada ukuran baru.
 */
export function applyShadowQuality(sun, quality) {
  if (!sun?.shadow) return;
  const size = SHADOW_MAP_SIZES[quality] ?? SHADOW_MAP_SIZES.sedang;
  sun.castShadow = size > 0;
  if (size > 0) sun.shadow.mapSize.set(size, size);
  sun.shadow.map?.dispose?.();
  sun.shadow.map = null;
  sun.shadow.needsUpdate = true;
}

/**
 * @param {object} store
 * @param {{ app: object, lighting?: object, crowd?: object }} ctx
 * @returns {() => void} unsubscribe
 */
export function bindGraphics(store, { app, lighting = null, crowd = null }) {
  const unsubs = [];
  const on = (key, fn) => unsubs.push(store.bind(key, fn));
  const sun = lighting?.userData?.sun ?? null;

  on('graphics.shadowQuality', (q) => applyShadowQuality(sun, styleState.lod !== 1 && q !== 'mati' ? 'rendah' : q)); // gaya hemat: 1024 px
  on('graphics.pixelRatio', (v) => app.setPixelRatio?.(v));
  on('graphics.adaptiveResolution', (v) => app.setAdaptiveResolution?.(v));
  on('graphics.ao', (v) => app.setAO?.(v && styleState.style === 'asli')); // kartun/facet: tanpa GTAO
  on('graphics.vignette', (v) => app.setVignette?.(v && styleState.style === 'asli'));
  on('graphics.outline', (v) => app.setOutline?.(v));
  on('graphics.gayaGrafis', (g) => { // tema UI mengikuti gaya (perkamen hanya di kartun)
    if (typeof document !== 'undefined') document.documentElement.dataset.gaya = g;
  });
  on('graphics.crowdDensity', (v) => crowd?.setDensity?.(v * styleState.density));

  return () => { for (const u of unsubs) u(); };
}
