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
  { id: 'sekre-motor-timur', area: 'sekre', eye: w(-196, 1.6, 1094), look: w(-213, 0.7, 1091.5), fov: 58 },
  { id: 'sekre-motor-dekat', area: 'sekre', eye: w(-205, 1.3, 1095), look: w(-212, 0.6, 1091.8), fov: 55 },
  { id: 'sekre-motor-barat', area: 'sekre', eye: w(-236, 1.6, 1095.5), look: w(-228, 0.7, 1096.5), fov: 58 },
  { id: 'sekre-motor-atas', area: 'sekre', eye: w(-214, 13, 1102), look: w(-215, 0, 1091), fov: 55 },
  { id: 'motor-ic-mata', area: 'motor', eye: w(-962, 1.7, 996), look: w(-962, 0.7, 970), fov: 62 },
  { id: 'motor-ic-dekat', area: 'motor', eye: w(-948, 1.4, 986), look: w(-950, 0.6, 968), fov: 58 },
  { id: 'motor-ic-atas', area: 'motor', eye: w(-965, 42, 1012), look: w(-965, 0, 967), fov: 55 },
  { id: 'motor-ic-malam', area: 'motor', hour: 23, eye: w(-962, 1.7, 996), look: w(-962, 0.7, 970), fov: 62 },
  { id: 'lot-mini-mata', area: 'lot', eye: w(-328, 1.7, 1010), look: w(-350, 0.7, 985), fov: 60 },
  { id: 'lot-mini-atas', area: 'lot', eye: w(-338, 34, 1022), look: w(-340, 0, 985), fov: 55 },
  { id: 'lot-mini-jauh', area: 'lot', eye: w(-250, 2.5, 1040), look: w(-345, 0.7, 985), fov: 55 },
  { id: 'lambang-depan', area: 'props', eye: w(-1071, 1.7, 2092), look: w(-1071, 2.0, 2078), fov: 55 },
  { id: 'lambang-dekat', area: 'props', eye: w(-1070, 1.8, 2084), look: w(-1071, 2.0, 2078), fov: 50 },
  { id: 'lambang-atas', area: 'props', eye: w(-1060, 12, 2098), look: w(-1071, 1.5, 2078), fov: 55 },
  { id: 'sekre-teras-depan', area: 'sekre', eye: w(-206, 1.7, 1120), look: w(-219, 1.2, 1100), fov: 62 },
];
