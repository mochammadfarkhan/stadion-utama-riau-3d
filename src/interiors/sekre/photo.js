/**
 * Mode foto sekre (spec §8.2): 4 preset kamera (tombol 1–4 saat mode foto P: lesehan, pintu, pojok, atas) +
 * pose intip jendela. Pose ruang-lokal { position:[x,y,z], target:[x,y,z], fov }. Kamera bebas & batasnya
 * diatur InteriorCameraRig; preset "pintu" berdiri di selasar menatap ke dalam lewat kusen.
 */
const pose = (position, target, fov) => Object.freeze({ position: Object.freeze(position), target: Object.freeze(target), fov });
const preset = (id, label, p) => Object.freeze({ id, label, pose: p });

export const SEKRE_PHOTO_PRESETS = Object.freeze([
  preset('lesehan', 'Lesehan', pose([0.6, 0.7, 1.5], [-1.2, 0.55, 0.0], 70)),
  preset('pintu', 'Dari pintu', pose([2.3, 1.6, -3.9], [-0.2, 0.95, 1.5], 68)),
  preset('pojok', 'Pojok ruangan', pose([-2.8, 3.2, 2.75], [1.0, 0.7, -1.2], 78)),
  preset('atas', 'Dari atas', pose([0, 3.8, 0.3], [0, 0, 0.55], 95)),
]);

/** Intip jendela nako: menatap selasar serong ke kanan (ke ujung yang terbuka). */
export const WINDOW_PEEK = pose([-1.575, 1.5, -2.86], [3.5, 1.15, -5.6], 60);
