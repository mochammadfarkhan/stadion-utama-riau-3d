/**
 * Detail stadion jauh: benda kecil (tribun, perlengkapan, perabot plaza, parkiran, rambu) disembunyikan bila pemain
 * lebih jauh dari HIDE_AT dari pusat region; muncul lagi di bawah SHOW_AT (histeresis agar tidak berkedip di batas).
 * Atap, fasad, dan tanah tetap tampil sebagai penanda. Fungsi murni; sistem per-frame ada di index.js.
 */
export const FAR_DETAIL = Object.freeze({ hideAt: 650, showAt: 560 });

/**
 * @param {boolean} hidden status sebelumnya (true = detail sedang disembunyikan)
 * @param {number} dist jarak datar fokus ke pusat region (m)
 * @returns {boolean} status baru
 */
export function nextFarHidden(hidden, dist, { hideAt, showAt } = FAR_DETAIL) {
  if (!Number.isFinite(dist)) return hidden;
  if (hidden) return dist > showAt;
  return dist > hideAt;
}

/**
 * Sembunyikan/tampilkan lewat layer 0 (bukan `visible`): `placeModels({replaces})` menyembunyikan objek prosedural
 * lewat `visible`, jadi menyalakannya kembali akan menampilkan objek ganda. Layer 0 diuji juga oleh pass bayangan.
 * Kembalikan true bila ada perubahan.
 */
export function applyFarHidden(objects, hidden) {
  let changed = false;
  for (const root of objects) {
    root.traverse((o) => {
      if (o.layers.isEnabled(0) === hidden) {
        if (hidden) o.layers.disable(0);
        else o.layers.enable(0);
        changed = true;
      }
    });
  }
  return changed;
}

/**
 * Penjaga stateful untuk sistem region. `?nofar` di URL mematikannya (pembanding ukur performa).
 * @param {Array<import('three').Object3D>} objects
 */
export function createFarGate(objects, config = FAR_DETAIL) {
  let hidden = false;
  const disabled = typeof location !== 'undefined' && new URLSearchParams(location.search).has('nofar');
  return {
    get hidden() { return hidden; },
    update(focus) {
      if (disabled || !focus) return;
      const next = nextFarHidden(hidden, Math.hypot(focus.x, focus.z), config);
      if (next === hidden) return;
      hidden = next;
      applyFarHidden(objects, hidden);
    },
  };
}
