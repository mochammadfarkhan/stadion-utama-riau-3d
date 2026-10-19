// src/world/kit/hero/ornaments.js
/**
 * Registry placeholder ornamen GLB hero DISTRIK (M6). Hero distrik digabung per material per klaster
 * (spec §4.6/§7.4), jadi pola `replaces` (menyembunyikan objek bernama) tidak berlaku. Hero builder
 * menandai material placeholder per assetId (mis. 'N04'); lapisan app (src/app/heroOrnaments.js) memuat
 * GLB final lalu menyembunyikan placeholder lewat material.visible — tetap berlaku walau klaster
 * dibangun ulang (material baru yang ditandai mengikuti status terkini). Tanpa three: hanya objek material.
 */
const placeholders = new Map(); // assetId -> Set<Material>
const loaded = new Set();

/** Tandai `material` sebagai placeholder `assetId`; dikembalikan apa adanya (dipakai inline). */
export function markPlaceholder(assetId, material) {
  if (!material?.isMaterial) throw new TypeError('markPlaceholder: material wajib');
  let set = placeholders.get(assetId);
  if (!set) {
    set = new Set();
    placeholders.set(assetId, set);
  }
  if (set.has(material)) return material;
  set.add(material);
  material.userData.placeholderFor = assetId;
  material.visible = !loaded.has(assetId);
  material.addEventListener('dispose', () => set.delete(material));
  return material;
}

/** GLB `assetId` dimuat (true) / dilepas (false): placeholder disembunyikan / ditampilkan. */
export function setOrnamentLoaded(assetId, isLoaded) {
  if (isLoaded) loaded.add(assetId);
  else loaded.delete(assetId);
  for (const m of placeholders.get(assetId) ?? []) m.visible = !isLoaded;
}

export const isOrnamentLoaded = (assetId) => loaded.has(assetId);
export const placeholderCount = (assetId) => placeholders.get(assetId)?.size ?? 0;

/** Kosongkan registry (tes); placeholder yang tersisa ditampilkan lagi. */
export function resetOrnaments() {
  for (const set of placeholders.values()) for (const m of set) m.visible = true;
  placeholders.clear();
  loaded.clear();
}
