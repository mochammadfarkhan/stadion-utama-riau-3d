import * as THREE from 'three';
import { PI, box, rbox, cyl, ball, piece, groupOf } from './bentuk.js';
import { kx } from '../data.js';
import { makeCanvas, canvasTexture } from '../canvas.js';

/** Layar proyeksi di dinding timur (kode di laptop yang diproyeksikan, seperti di foto). */
export function drawProyeksi(c, w, h) {
  c.fillStyle = '#0f1a2e';
  c.fillRect(0, 0, w, h);
  const COLORS = ['#7fb8ff', '#9be28f', '#f2c97d', '#d0d7e2', '#ff8fa3'];
  for (let i = 0; i < 22; i += 1) {
    c.fillStyle = COLORS[(i * 7) % COLORS.length];
    const indent = ((i * 5) % 4) * 28;
    c.fillRect(24 + indent, 22 + i * 21, 60 + ((i * 53) % 220), 9);
  }
  c.fillStyle = 'rgba(80,140,255,0.25)';
  c.fillRect(0, 0, 12, h);
}

/** Sofa kulit coklat di dinding barat + helm di sandaran, proyektor di atas boks plastik, dan layar proyeksi (E). */
export function buildSofaProyektor(m) {
  const LEATHER = '#9a5b34';
  const DARK = '#7d4528';
  const SX = kx(-1.62);
  const sofa = [
    rbox(0.86, 0.4, 2.2, 0.06, LEATHER, { x: SX, y: 0.3, z: 0.5 }),
    rbox(0.2, 0.5, 2.2, 0.07, DARK, { x: SX - 0.33, y: 0.62, z: 0.5 }),
    rbox(0.86, 0.5, 0.2, 0.07, DARK, { x: SX, y: 0.5, z: -0.5 }),
    rbox(0.86, 0.5, 0.2, 0.07, DARK, { x: SX, y: 0.5, z: 1.5 }),
    box(0.8, 0.1, 2.1, '#3a2b22', { x: SX, y: 0.05, z: 0.5 }),
    ball(0.15, '#1b1b1f', { x: SX + 0.1, y: 0.66, z: 0.2 }),
    ball(0.15, '#2b2b30', { x: SX + 0.1, y: 0.66, z: 0.55 }),
  ];
  const PX = kx(-0.95);
  const projector = [box(0.28, 0.1, 0.22, '#e9e6dc', { x: PX, y: 0.4, z: -0.75 }), cyl(0.04, 0.04, 0.03, '#2b2b30', { x: PX + 0.13, y: 0.4, z: -0.75, rz: PI / 2 })];
  const canvas = makeCanvas(512, 340);
  drawProyeksi(canvas.getContext('2d'), 512, 340);
  const tex = canvasTexture(canvas, null);
  const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent: true, opacity: 0.92 });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.93), mat);
  screen.name = 'layar-proyeksi';
  screen.position.set(2.985, 2.1, 1.15);
  screen.rotation.y = -PI / 2;
  return groupOf('sofa-proyektor', piece(sofa, m.plastik, 'sofa'), piece(projector, m.plastik, 'proyektor', false), screen);
}
