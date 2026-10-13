/**
 * Struktur truss baja di bawah atap (terlihat dari dalam): chord atas mengikuti profil atap,
 * chord bawah lurus, batang vertikal, dan balok cincin — satu InstancedMesh batang unit.
 */
import { BoxGeometry, Group } from 'three';
import { Materials } from '../materials.js';
import { instancedFromMatrices, segmentMatrix } from '../util/instancing.js';
import { framePoint } from './ovalFrame.js';
import { ROOF_PROFILE, roofYAt } from './profiles.js';

const RADIAL_COUNT = 40;
const CHORD_SIZE = 0.5;
const WEB_SIZE = 0.28;
const TOP_DROP = 1.2;      // jarak chord atas di bawah lembaran atap
const BOTTOM_DROP_OUT = 5.5;
const BOTTOM_DROP_IN = 4.5;
const K_OUT = 0.03;
const K_IN = 0.97;
const RING_KS = [0.3, 0.7];

/** Titik chord atas pada (u, k). */
function topPoint(u, k) {
  return framePoint(u, k, roofYAt(k) - TOP_DROP);
}

/** Titik chord bawah (lurus dari luar ke dalam). */
function bottomPoint(u, k) {
  const f = (k - K_OUT) / (K_IN - K_OUT);
  const y = (roofYAt(K_OUT) - BOTTOM_DROP_OUT) * (1 - f) + (roofYAt(K_IN) - BOTTOM_DROP_IN) * f;
  return framePoint(u, k, y);
}

/** Batang satu rangka radial: chord atas (polyline), chord bawah, vertikal. */
function collectRadial(u, chords, webs) {
  const ks = ROOF_PROFILE.map((p) => Math.min(Math.max(p.k, K_OUT), K_IN));
  for (let i = 0; i < ks.length - 1; i++) {
    chords.push(segmentMatrix(topPoint(u, ks[i]), topPoint(u, ks[i + 1]), CHORD_SIZE));
  }
  chords.push(segmentMatrix(bottomPoint(u, K_OUT), bottomPoint(u, K_IN), CHORD_SIZE));
  ks.forEach((k) => webs.push(segmentMatrix(topPoint(u, k), bottomPoint(u, k), WEB_SIZE)));
  // diagonal sederhana antar titik profil
  for (let i = 0; i < ks.length - 1; i++) {
    webs.push(segmentMatrix(topPoint(u, ks[i]), bottomPoint(u, ks[i + 1]), WEB_SIZE));
  }
}

/** Balok cincin menghubungkan rangka radial bersebelahan. */
function collectRings(count, chords) {
  for (let i = 0; i < count; i++) {
    const u0 = (i + 0.5) / count;
    const u1 = (i + 1.5) / count;
    RING_KS.forEach((k) => chords.push(segmentMatrix(topPoint(u0, k), topPoint(u1, k), CHORD_SIZE)));
  }
}

/** @param {{radialCount?:number}} opts */
export function createTruss({ radialCount = RADIAL_COUNT } = {}) {
  const group = new Group();
  group.name = 'truss';
  const chords = [];
  const webs = [];
  for (let i = 0; i < radialCount; i++) collectRadial((i + 0.5) / radialCount, chords, webs);
  collectRings(radialCount, chords);
  const unit = new BoxGeometry(1, 1, 1);
  group.add(instancedFromMatrices(unit, Materials.steel(), chords, 'truss-chords'));
  group.add(instancedFromMatrices(unit, Materials.steel(), webs, 'truss-webs'));
  return group;
}
