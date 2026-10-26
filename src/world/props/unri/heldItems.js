/**
 * Model item di tangan pemain (GLB f06–f09 dari assets-src/blender/unri/f01_kebun.py; origin = titik genggam handR,
 * depan +Z, bawah −Y). Pabrik memetakan definisi item (config/items.js) → {object, carry, work, shoulder}: carry =
 * kemiringan rotation.x saat dibawa, work = saat dipakai (mata cangkul sampai ke tanah), shoulder = dipanggul (lengan
 * kanan ditekuk ke pundak, gagang menjulur ke belakang seperti petani membawa cangkul).
 * Label kantong benih diwarnai per jenis (material dikloning sekali per jenis). Klon dibuat sekali per item lalu dipakai ulang.
 */
export const HELD_MODELS = Object.freeze({
  cangkul: 'models/unri/f06-cangkul.glb',
  gembor: 'models/unri/f07-gembor.glb',
  benih: 'models/unri/f08-benih.glb',
  'hasil-cabai': 'models/unri/f09-hasil-cabai.glb',
  'hasil-jagung': 'models/unri/f09-hasil-jagung.glb',
  'hasil-terong': 'models/unri/f09-hasil-terong.glb',
});

const LABEL_COLOR = Object.freeze({ cabai: 0xd7261e, jagung: 0xe9c33a, terong: 0x6b2f80 });
const TILT = Object.freeze({ cangkul: Object.freeze({ carry: -0.7, work: 1.1, shoulder: true }) });
const NO_TILT = Object.freeze({ carry: 0, work: 0, shoulder: false });

/** Kunci model untuk definisi item; null = tidak ada model (tangan kosong). */
export function heldModelKey(def) {
  if (!def) return null;
  if (def.kind === 'tool') return HELD_MODELS[def.tool] ? def.tool : null;
  if (def.kind === 'seed') return 'benih';
  if (def.kind === 'crop') return HELD_MODELS[`hasil-${def.crop}`] ? `hasil-${def.crop}` : null;
  return null;
}

/**
 * @param {Record<string, import('three').Object3D>} sources kunci HELD_MODELS → scene GLB (cache loadModel, jangan dispose)
 * @returns {{get(id:string, def:object|null): ({object:import('three').Object3D, carry:number, work:number, shoulder:boolean}|null),
 *   dispose():void}}
 */
export function createHeldItemFactory(sources) {
  const cache = new Map();
  const ownMaterials = [];
  const tintLabel = (obj, crop) => {
    obj.traverse((o) => {
      if (!o.isMesh || !o.material?.name?.includes('label')) return;
      const m = o.material.clone();
      m.color.setHex(LABEL_COLOR[crop] ?? 0xffffff);
      ownMaterials.push(m);
      o.material = m;
    });
  };
  return {
    get(id, def) {
      if (!id) return null;
      if (cache.has(id)) return cache.get(id);
      const key = heldModelKey(def);
      const src = key ? sources[key] : null;
      if (!src) return null;
      const object = src.clone(true);
      object.name = `dipegang:${id}`;
      object.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
      if (def.kind === 'seed') tintLabel(object, def.crop);
      const item = { object, ...(TILT[key] ?? NO_TILT) };
      cache.set(id, item);
      return item;
    },
    dispose() {
      for (const { object } of cache.values()) object.removeFromParent();
      cache.clear();
      for (const m of ownMaterials) m.dispose();
    },
  };
}
