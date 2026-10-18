/**
 * Daftar tampilan gerbang visual M7 (dipakai tools/shots/m7Visual.mjs). Koordinat dunia (ENU, +X timur, +Z selatan);
 * `eye`/`look` = [x, tinggi di atas tanah, z]. `auto` = sorot mahasiswa terdekat dari `near` [x, z].
 */
const w = (x, h, z) => [x, h, z];

export const VIEWS = [
  { id: 'mhs-jalan-mata', area: 'mahasiswa', auto: 'mahasiswa', near: [-206, 1118], dist: 7, dir: 0.6, eyeH: 1.7, fov: 60 },
  { id: 'mhs-jalan-dekat', area: 'mahasiswa', auto: 'mahasiswa', near: [-206, 1118], dist: 3.5, dir: -0.9, eyeH: 1.4, fov: 60 },
  { id: 'mhs-atas', area: 'mahasiswa', auto: 'mahasiswa', near: [-206, 1118], dist: 22, dir: 0.3, eyeH: 24, fov: 55 },
  { id: 'mhs-duduk-mata', area: 'mahasiswa', auto: 'duduk', near: [-206, 1118], dist: 5, dir: 0.5, eyeH: 1.5, fov: 60 },
  { id: 'mhs-duduk-atas', area: 'mahasiswa', auto: 'duduk', near: [-206, 1118], dist: 9, dir: -0.4, eyeH: 9, fov: 55 },
  { id: 'satpam-mata', area: 'satpam', eye: w(-1068, 1.7, 1318), look: w(-1074.7, 1.2, 1304), fov: 60 },
  { id: 'satpam-atas', area: 'satpam', eye: w(-1060, 18, 1325), look: w(-1074.7, 0, 1297), fov: 55 },
];
