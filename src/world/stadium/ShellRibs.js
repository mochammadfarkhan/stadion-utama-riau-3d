/**
 * Rib busur masif putih-krem (ACP) keliling oval + selembayung "X" di ujung utara & selatan.
 * Tiap rib = ExtrudeGeometry penampang persegi mengikuti CatmullRomCurve3 (frame rotasi-minimal, tanpa twist).
 */
import { CatmullRomCurve3, ExtrudeGeometry, Group, Mesh, Shape, Vector3 } from 'three';
import { STADIUM } from '../../config/constants.js';
import { Materials } from '../materials.js';
import { frameAt, framePoint } from './ovalFrame.js';
import { RIB_PROFILE, SELEMBAYUNG_PROFILE } from './profiles.js';

const RIB_THICK = 1.4;   // tebal (arah radial)
const RIB_WIDTH = 3.2;   // lebar (arah keliling)
const RIB_STEPS = 48;
const END_RIB_SCALE = 0.85; // rusuk selembayung sedikit lebih ramping

/** Penampang persegi rib: x = tebal (normal kurva), y = lebar (binormal). */
function ribShape(scale = 1) {
  const hx = (RIB_THICK * scale) / 2;
  const hy = (RIB_WIDTH * scale) / 2;
  const s = new Shape();
  s.moveTo(-hx, -hy);
  s.lineTo(hx, -hy);
  s.lineTo(hx, hy);
  s.lineTo(-hx, hy);
  s.closePath();
  return s;
}

/** Kurva rib pada u dari profil (k, y[, s]); s = offset tangensial meter (dikali sign). */
function ribCurve(u, profile, sign = 1) {
  const f = frameAt(u);
  const pts = profile.map((p) => {
    const v = framePoint(u, p.k, p.y);
    const s = (p.s ?? 0) * sign;
    return v.add(new Vector3(f.tx * s, 0, f.tz * s));
  });
  return new CatmullRomCurve3(pts, false, 'centripetal');
}

function createRibMesh(curve, shape, material, name) {
  const geom = new ExtrudeGeometry(shape, { steps: RIB_STEPS, bevelEnabled: false, extrudePath: curve });
  geom.computeBoundingSphere();
  const mesh = new Mesh(geom, material);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Pasangan rusuk menyilang di ujung (selembayung). */
function createSelembayung(u, material) {
  const g = new Group();
  g.name = `selembayung-${u}`;
  const shape = ribShape(END_RIB_SCALE);
  g.add(createRibMesh(ribCurve(u, SELEMBAYUNG_PROFILE, 1), shape, material, 'rusuk-a'));
  g.add(createRibMesh(ribCurve(u, SELEMBAYUNG_PROFILE, -1), shape, material, 'rusuk-b'));
  return g;
}

/**
 * @param {{count?:number}} opts jumlah rib (genap; ujung ±Z menjadi selembayung)
 */
export function createRibs({ count = STADIUM.ribCount } = {}) {
  const group = new Group();
  group.name = 'ribs';
  const material = Materials.acp();
  const shape = ribShape();
  const half = count / 2;
  for (let i = 0; i < count; i++) {
    const u = i / count;
    const isEnd = i === 0 || i === half;
    if (isEnd) group.add(createSelembayung(u, material));
    else group.add(createRibMesh(ribCurve(u, RIB_PROFILE), shape, material, `rib-${i}`));
  }
  return group;
}
