/**
 * Lewati kerja per frame untuk subpohon yang tidak tampak. Lapisan engine: tanpa impor three.
 *
 * - `skipMatrixWhenHidden(root)`: `updateMatrixWorld` tidak turun ke `root` selama `root` atau leluhurnya
 *   `visible = false`. Dipakai karakter bertulang (pack orang: 29 tulang per orang); diukur 2026-11-15 mode Kota:
 *   ±2.600 tulang NPC tersembunyi tetap dihitung tiap frame (±2,8 ms di iGPU AMD). Saat tampak lagi, matriks
 *   dihitung ulang paksa sekali (perubahan posisi selama tersembunyi tidak hilang). `updateWorldMatrix`
 *   (dipakai `getWorldPosition`) tidak terpengaruh.
 * - `createLabelList()`: daftar objek CSS2D yang disisir ulang berkala, bukan seluruh scene tiap frame.
 */

/** Murni: true bila `o` atau salah satu leluhurnya tidak tampak. */
export function hiddenInChain(o) {
  for (let p = o; p; p = p.parent) if (p.visible === false) return true;
  return false;
}

/**
 * @template {{updateMatrixWorld(force?: boolean): void, visible: boolean, parent: object|null}} T
 * @param {T} root
 * @returns {T}
 */
export function skipMatrixWhenHidden(root) {
  const base = root.updateMatrixWorld;
  let stale = false;
  root.updateMatrixWorld = function updateMatrixWorldWhenShown(force) {
    if (hiddenInChain(this)) {
      stale = true;
      return;
    }
    base.call(this, force || stale);
    stale = false;
  };
  return root;
}

/** Murni: `o` tampak dan masih tergantung di `scene` (label region yang sudah dilepas tidak ikut digambar). */
export function shownIn(o, scene) {
  let p = o;
  for (; p; p = p.parent) {
    if (p.visible === false) return false;
    if (p === scene) return true;
  }
  return false;
}

/** Bingkai antar-penyisiran label (≈ 0,5 s pada 60 fps): label baru tampil paling lambat selama itu. */
export const LABEL_RESCAN_FRAMES = 30;

/**
 * Daftar label CSS2D sebuah scene. `refresh(scene)` menyisir ulang bila scene berganti atau sudah
 * `LABEL_RESCAN_FRAMES` bingkai; mengembalikan label yang tampak (rantai leluhur) dan menyembunyikan
 * elemen label yang leluhurnya tak tampak (tugas yang dulu dikerjakan CSS2DRenderer saat menyisir scene).
 */
export function createLabelList(rescanFrames = LABEL_RESCAN_FRAMES) {
  let scene = null;
  let all = [];
  let age = Infinity;
  const shown = [];
  return {
    refresh(nextScene) {
      age += 1;
      if (nextScene !== scene || age >= rescanFrames) {
        scene = nextScene;
        age = 0;
        all = [];
        nextScene.traverse((o) => { if (o.isCSS2DObject) all.push(o); });
      }
      shown.length = 0;
      for (const label of all) {
        if (shownIn(label, nextScene)) shown.push(label);
        else if (label.element) label.element.style.display = 'none';
      }
      return shown;
    },
  };
}
