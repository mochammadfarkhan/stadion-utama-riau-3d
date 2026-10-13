/**
 * Perlengkapan interior stadion: floodlight lingkar atap (instanced), speaker line array,
 * videotron utara/selatan, patung serindit, tunnel pemain, papan jadwal, tempat sampah, kios.
 */
import * as THREE from 'three';
import { STADIUM } from '../../config/constants.js';
import { createEllipseArcTable, ellipseAngleAtArc, ellipsePoint, createCanvasTexture } from './ovalMath.js';
import {
  createSerinditStatue, createScheduleBoard, createTrashBins, createKiosks,
} from './Fixtures.props.js';

const FLOOD_COUNT = 200;
const FLOOD_A = STADIUM.innerSemiX + 8;   // elips bukaan atap
const FLOOD_B = STADIUM.innerSemiZ + 8;
const FLOOD_Y = STADIUM.roofHeight - 4;
const FLOOD_BODY = Object.freeze({ w: 0.6, h: 0.5, d: 0.4 });
const LENS_COLOR = 0xffffff;
const SPEAKER_SPACING = 20;
const SPEAKER_Y = STADIUM.roofHeight - 7;
const VIDEOTRON_W = 18;
const VIDEOTRON_H = 9;
const VIDEOTRON_Y = 31;                    // di atas dinding belakang tier atas (±28 m)
const VIDEOTRON_OFFSET = 40;               // offset radial dari elips dasar
const SCORE_TEXT = 'RIAU 0 - 0 TAMU';

/** Matriks instance merata di elips (a,b) pada ketinggian y, menghadap pusat lapangan. */
function ringTransforms(a, b, y, count, lookAtGround) {
  const table = createEllipseArcTable(a, b);
  const dummy = new THREE.Object3D();
  const spacing = table.total / count;
  return Array.from({ length: count }, (_, i) => {
    const p = ellipsePoint(a, b, ellipseAngleAtArc(table, (i + 0.5) * spacing));
    dummy.position.set(p.x, y, p.z);
    dummy.lookAt(0, lookAtGround ? 0 : y, 0);
    dummy.updateMatrix();
    return dummy.matrix.clone();
  });
}

function instanced(geometry, material, matrices, name) {
  const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
  matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = false;
  mesh.computeBoundingSphere();
  mesh.name = name;
  return mesh;
}

/**
 * Floodlight ±200 unit di lingkar dalam atap: badan gelap + lensa emissive (2 draw call).
 * @returns {THREE.Group}
 */
export function createFloodlights(opts = {}) {
  const count = opts.count ?? FLOOD_COUNT;
  const group = new THREE.Group();
  group.name = 'floodlight';
  const matrices = ringTransforms(FLOOD_A, FLOOD_B, FLOOD_Y, count, true);
  const body = new THREE.BoxGeometry(FLOOD_BODY.w, FLOOD_BODY.h, FLOOD_BODY.d);
  const lens = new THREE.BoxGeometry(FLOOD_BODY.w - 0.1, FLOOD_BODY.h - 0.1, 0.05).translate(0, 0, FLOOD_BODY.d / 2 + 0.02);
  group.add(instanced(body, new THREE.MeshLambertMaterial({ color: 0x2b2f33 }), matrices, 'floodBody'));
  group.add(instanced(lens, createLensMaterial(), matrices, 'floodLens'));
  group.userData.count = count;
  return group;
}

/** Lensa floodlight: emissive putih; TimeOfDay menaikkan emissiveIntensity saat malam (userData.nightEmissive). */
function createLensMaterial() {
  const mat = new THREE.MeshStandardMaterial({ color: LENS_COLOR, emissive: LENS_COLOR, emissiveIntensity: 0.3, roughness: 0.4, metalness: 0 });
  mat.name = 'lensaFloodlight';
  mat.userData.nightEmissive = { on: 8.0, off: 0.3 };
  return mat;
}

/** Speaker line array tiap 20 m, digantung di bawah lingkar atap. */
function createSpeakers() {
  const a = FLOOD_A - 1.5;
  const b = FLOOD_B - 1.5;
  const total = createEllipseArcTable(a, b).total;
  const count = Math.floor(total / SPEAKER_SPACING);
  const matrices = ringTransforms(a, b, SPEAKER_Y, count, false);
  const geom = new THREE.BoxGeometry(0.45, 1.4, 0.45);
  return instanced(geom, new THREE.MeshLambertMaterial({ color: 0x111111 }), matrices, 'speaker');
}

/** Material layar skor: CanvasTexture bila ada document, else biru gelap. */
function createScreenMaterial() {
  const tex = createCanvasTexture(1024, 512, (ctx, w, h) => {
    ctx.fillStyle = '#060b1f';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 120px sans-serif';
    ctx.fillText(SCORE_TEXT, w / 2, h / 2 + 20);
    ctx.fillStyle = '#f2b705';
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText('STADION UTAMA RIAU', w / 2, 100);
    ctx.fillText("45'", w / 2, h - 70);
  });
  return tex ? new THREE.MeshBasicMaterial({ map: tex }) : new THREE.MeshBasicMaterial({ color: 0x0b1a4a });
}

/** Videotron satu sisi (sign −1 utara, +1 selatan): layar + rangka hitam. */
function createVideotron(sign, screenMat) {
  const group = new THREE.Group();
  group.name = sign < 0 ? 'videotronUtara' : 'videotronSelatan';
  const z = sign * (STADIUM.innerSemiZ + VIDEOTRON_OFFSET);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(VIDEOTRON_W + 1, VIDEOTRON_H + 1, 0.6), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  frame.position.set(0, VIDEOTRON_Y, z + sign * 0.35);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(VIDEOTRON_W, VIDEOTRON_H), screenMat);
  screen.position.set(0, VIDEOTRON_Y, z);
  screen.rotation.y = sign > 0 ? Math.PI : 0; // menghadap pusat lapangan
  group.add(frame, screen);
  return group;
}

/**
 * Semua perlengkapan interior.
 * @param {{floodCount?: number}} opts
 * @returns {THREE.Group}
 */
export function createFixtures(opts = {}) {
  const group = new THREE.Group();
  group.name = 'fixtures';
  const screenMat = createScreenMaterial();
  group.add(
    createFloodlights({ count: opts.floodCount }), createSpeakers(),
    createVideotron(-1, screenMat), createVideotron(1, screenMat),
    createSerinditStatue(), createScheduleBoard(),
    createTrashBins(), createKiosks(),
  );
  return group;
}
