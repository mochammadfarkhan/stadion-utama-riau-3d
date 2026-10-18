/**
 * Mode foto sekre (spec §8.2): 4 preset kamera (tombol 1–4 saat mode foto P: lesehan, pintu, pojok, atas) +
 * pose intip jendela. Pose ruang-lokal { position:[x,y,z], target:[x,y,z], fov }. Kamera bebas & batasnya
 * diatur InteriorCameraRig; preset "pintu" berdiri di selasar menatap ke dalam lewat kusen.
 */
const pose = (position, target, fov) => Object.freeze({ position: Object.freeze(position), target: Object.freeze(target), fov });
const preset = (id, label, p) => Object.freeze({ id, label, pose: p });

export const SEKRE_PHOTO_PRESETS = Object.freeze([
  preset('lesehan', 'Lesehan', pose([1.1, 0.65, 2.0], [-0.6, 0.5, 0.4], 62)),
  preset('pintu', 'Dari pintu', pose([1.7, 1.6, -3.9], [-0.1, 0.95, 1.5], 68)),
  preset('pojok', 'Pojok ruangan', pose([-1.85, 2.55, 2.75], [0.8, 0.7, -1.2], 78)),
  preset('atas', 'Dari atas', pose([0, 3.0, 0.3], [0, 0, 0.55], 95)),
]);

/** Intip jendela nako: menatap selasar serong ke kanan (ke ujung yang terbuka). */
export const WINDOW_PEEK = pose([-0.9, 1.5, -2.86], [3.5, 1.15, -5.6], 60);
