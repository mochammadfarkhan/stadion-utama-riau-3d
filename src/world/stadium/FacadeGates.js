/**
 * Gate penonton: terowongan pendek (jamb + langit-langit), kusen, nomor gate (CanvasTexture bila
 * ada document), dan untuk gate utama (utara & barat) kanopi selembayung segitiga + ornamen songkok.
 * Frame lokal tiap gate: X = tangen, Y = atas, +Z = keluar bangunan.
 */
import { BoxGeometry, ExtrudeGeometry, Group, Mesh, Shape, SphereGeometry } from 'three';
import { Materials } from '../materials.js';
import { createSign } from '../props/Signage.js';
import { GATES } from './gateLayout.js';
import { frameAt, framePoint } from './ovalFrame.js';

const WALL_K = 0.02;
const TUNNEL_DEPTH = 6;
const JAMB_THICK = 0.5;
const FRAME_THICK = 0.4;
const FRAME_PROTRUDE = 0.3;
const SIGN_W = 2.6;
const SIGN_H = 0.8;
const CANOPY_DEPTH = 4;
const CANOPY_APEX = 3;
const CANOPY_OVERHANG = 2;
const ORNAMENT_LEN = 3.5;
const ORNAMENT_TILT = 0.45;

function box(w, h, d, material, x, y, z, name) {
  const m = new Mesh(new BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.name = name;
  return m;
}

/** Terowongan masuk: dua jamb + langit-langit, mengarah ke dalam (−Z). */
function createTunnel(gate) {
  const g = new Group();
  g.name = 'tunnel';
  const half = gate.width / 2 + JAMB_THICK / 2;
  const zc = -TUNNEL_DEPTH / 2;
  const dark = Materials.concreteDark();
  g.add(box(JAMB_THICK, gate.height, TUNNEL_DEPTH, dark, -half, gate.height / 2, zc, 'jamb-l'));
  g.add(box(JAMB_THICK, gate.height, TUNNEL_DEPTH, dark, half, gate.height / 2, zc, 'jamb-r'));
  g.add(box(gate.width + JAMB_THICK * 2, JAMB_THICK, TUNNEL_DEPTH, dark, 0, gate.height + JAMB_THICK / 2, zc, 'ceiling'));
  return g;
}

/** Kusen emas menonjol keluar. */
function createFrame(gate) {
  const g = new Group();
  g.name = 'frame';
  const gold = Materials.gold();
  const x = gate.width / 2 + FRAME_THICK / 2;
  g.add(box(FRAME_THICK, gate.height + FRAME_THICK, FRAME_THICK, gold, -x, (gate.height + FRAME_THICK) / 2, FRAME_PROTRUDE, 'kusen-l'));
  g.add(box(FRAME_THICK, gate.height + FRAME_THICK, FRAME_THICK, gold, x, (gate.height + FRAME_THICK) / 2, FRAME_PROTRUDE, 'kusen-r'));
  g.add(box(gate.width + FRAME_THICK * 2, FRAME_THICK, FRAME_THICK, gold, 0, gate.height + FRAME_THICK / 2, FRAME_PROTRUDE, 'kusen-top'));
  return g;
}

/** Kanopi selembayung: prisma segitiga + dua rusuk emas menyilang + songkok. */
function createCanopy(gate) {
  const g = new Group();
  g.name = 'canopy';
  const w = gate.width + CANOPY_OVERHANG * 2;
  const shape = new Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(0, CANOPY_APEX);
  shape.closePath();
  const roof = new Mesh(new ExtrudeGeometry(shape, { depth: CANOPY_DEPTH, bevelEnabled: false }), Materials.acp());
  roof.position.set(0, gate.height + FRAME_THICK + 0.6, -1);
  roof.castShadow = true;
  roof.name = 'canopy-roof';
  g.add(roof);
  const apexY = roof.position.y + CANOPY_APEX;
  const zc = roof.position.z + CANOPY_DEPTH;
  [-1, 1].forEach((s) => {
    const horn = box(0.25, ORNAMENT_LEN, 0.25, Materials.gold(), 0, apexY + ORNAMENT_LEN * 0.3, zc, 'selembayung');
    horn.rotation.z = s * ORNAMENT_TILT;
    g.add(horn);
  });
  const songkok = new Mesh(new SphereGeometry(0.6, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), Materials.dark());
  songkok.position.set(0, apexY, zc);
  songkok.name = 'songkok';
  g.add(songkok);
  return g;
}

function createGateGroup(gate) {
  const g = new Group();
  g.name = `gate-${gate.id}`;
  const f = frameAt(gate.u);
  g.position.copy(framePoint(gate.u, WALL_K, 0));
  g.rotation.y = f.yaw;
  g.add(createTunnel(gate), createFrame(gate));
  const label = gate.main ? `GATE ${gate.id} ${gate.name}` : `GATE ${gate.id}`;
  const sign = createSign({ text: label, width: SIGN_W, height: SIGN_H, bg: 0x1b2a4a, fg: 0xf2c200, border: 0xf2c200 });
  sign.position.set(0, gate.height + FRAME_THICK + SIGN_H / 2 + 0.15, FRAME_PROTRUDE + 0.05);
  g.add(sign);
  if (gate.main) g.add(createCanopy(gate));
  g.userData = { id: gate.id, u: gate.u, main: gate.main, width: gate.width, height: gate.height };
  return g;
}

/** @returns {Group} semua gate dari GATES (userData per gate: id, u, main, width, height) */
export function createGates() {
  const group = new Group();
  group.name = 'gates';
  GATES.forEach((gate) => group.add(createGateGroup(gate)));
  return group;
}
