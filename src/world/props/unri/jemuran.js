/**
 * P09 jemuran almamater: dua tiang besi + tali, tiga jas almamater biru langit ("Kampus Biru Langit", [T];
 * nada warna persis [INF]) dengan bordir lambang kuning kecil di dada kiri. Asal = tengah alas, tali sejajar X.
 */
import * as THREE from 'three';
import { mergeAll } from '../../siteutil/rounded.js';
import { currentScope } from '../../../engine/ResourceScope.js';
import { boxAt, paint, meshOf } from './geom.js';

export const JEMURAN = Object.freeze({ w: 2, d: 0.1, h: 1.8 });
export const ALMAMATER_BIRU_LANGIT = 0x7ec8ee;
const LAMBANG_KUNING = 0xf2c200;
const JACKET_X = Object.freeze([-0.62, 0, 0.62]);

function jacketsGeometry() {
  return mergeAll(JACKET_X.flatMap((x) => [
    paint(boxAt(0.46, 0.62, 0.07, x, 1.06, 0), ALMAMATER_BIRU_LANGIT),
    paint(boxAt(0.1, 0.5, 0.045, x - 0.28, 1.16, 0), ALMAMATER_BIRU_LANGIT),
    paint(boxAt(0.1, 0.5, 0.045, x + 0.28, 1.16, 0), ALMAMATER_BIRU_LANGIT),
    paint(boxAt(0.2, 0.05, 0.1, x, 1.66, 0), 0x5fa9d4), // kerah = tebal maksimum 0,1 m
    paint(boxAt(0.07, 0.08, 0.004, x - 0.12, 1.48, -0.037), LAMBANG_KUNING),
    paint(boxAt(0.02, 0.05, 0.02, x, 1.7, 0), 0x444444),
  ]));
}

const framGeo = () => currentScope().get('unri:jemuran:rangka', () => mergeAll([
  boxAt(0.04, JEMURAN.h, 0.04, -(JEMURAN.w / 2 - 0.02), 0, 0),
  boxAt(0.04, JEMURAN.h, 0.04, JEMURAN.w / 2 - 0.02, 0, 0),
  boxAt(JEMURAN.w - 0.04, 0.012, 0.012, 0, 1.74, 0),
]));
const jacketGeo = () => currentScope().get('unri:jemuran:jas', jacketsGeometry);
const matFrame = () => currentScope().get('unri:jemuran:matRangka', () => new THREE.MeshStandardMaterial({ color: 0x7d858a, roughness: 0.6, metalness: 0.4 }));
const matJas = () => currentScope().get('unri:jemuran:matJas', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));

export function createJemuran() {
  const g = new THREE.Group();
  g.name = 'P09-jemuran-almamater';
  g.add(meshOf(framGeo(), matFrame(), 'jemuranRangka', { cast: true }));
  g.add(meshOf(jacketGeo(), matJas(), 'jemuranJas', { cast: true }));
  return g;
}
