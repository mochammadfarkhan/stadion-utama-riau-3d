/**
 * Galeri tekstur PBR (DEV, tidak ikut build produksi): /tekstur-gallery.html?tier=512|256 — 13 set pada bola (kiri) dan
 * bidang berskala nyata (kanan), pencahayaan matahari + hemisphere, label dan hitungan memori GPU (byte tekstur terhitung
 * + renderer.info.memory.textures). window.__texGallery = { ready, stats() } untuk skrip screenshot.
 */
import * as THREE from 'three';
import { createResourceScope, withScope } from '../engine/ResourceScope.js';
import { loadPbr, pbrManifest, pbrMemory } from '../world/textures/pbr.js';
import { TILE_M } from '../world/textures/pbrCore.js';

const params = new URLSearchParams(window.location.search);
const tier = Number(params.get('tier') ?? 512);
const COLS = 5;
const CELL = 2.3;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a2d34);
scene.add(new THREE.HemisphereLight(0xcfe4ff, 0x6b5a45, 1.1));
const sun = new THREE.DirectionalLight(0xfff0d8, 2.6);
sun.position.set(-4, 7, 6);
scene.add(sun);

const names = Object.keys(TILE_M);
const rows = Math.ceil(names.length / COLS);
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 50);
const width = COLS * CELL * 2;
const height = rows * CELL + 0.4;

function fit() {
  const aspect = window.innerWidth / window.innerHeight;
  const halfW = Math.max(width / 2, (height / 2) * aspect);
  camera.left = -halfW; camera.right = halfW;
  camera.top = halfW / aspect; camera.bottom = -halfW / aspect;
  camera.position.set(0, 0, 20);
  camera.updateProjectionMatrix();
}
fit();
window.addEventListener('resize', () => { renderer.setSize(window.innerWidth, window.innerHeight); fit(); });

const scope = createResourceScope('galeri-tekstur');
const labels = [];
const readies = [];
const sphereGeo = new THREE.SphereGeometry(0.62, 48, 32);
const planeGeo = new THREE.PlaneGeometry(1.5, 1.5);

function material(pbr) {
  return new THREE.MeshStandardMaterial({
    map: pbr.map, normalMap: pbr.normalMap, aoMap: pbr.aoMap, roughnessMap: pbr.roughnessMap, roughness: 1, metalness: 0,
  });
}

names.forEach((name, i) => {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  const cx = (col - (COLS - 1) / 2) * CELL * 2;
  const cy = ((rows - 1) / 2 - row) * CELL;
  const pbr = withScope(scope, () => loadPbr(name, { tier }));
  readies.push(pbr.ready);
  const mat = material(pbr);
  // Bola: satu tile = TILE_M m pada bola berdiameter ~1,24 m. Bidang 1,5 m: repeat nyata (1,5 / TILE_M).
  const sphere = new THREE.Mesh(sphereGeo.clone(), mat);
  sphere.geometry.getAttribute('uv').array.forEach((v, k, a) => { a[k] = v * 3.8 / TILE_M[name] * 0.6; });
  sphere.position.set(cx - 1.0, cy + 0.2, 0);
  const planeMat = mat.clone();
  const plane = new THREE.Mesh(planeGeo.clone(), planeMat);
  plane.geometry.getAttribute('uv').array.forEach((v, k, a) => { a[k] = v * 1.5 / TILE_M[name]; });
  plane.position.set(cx + 1.0, cy + 0.2, 0);
  plane.rotation.x = -0.35;
  scene.add(sphere, plane);
  const el = document.createElement('div');
  el.className = 'lbl';
  el.textContent = `${name} · ${TILE_M[name]} m`;
  document.body.appendChild(el);
  labels.push({ el, pos: new THREE.Vector3(cx, cy - 1.1, 0) });
});

const hud = document.getElementById('hud');
const stats = () => {
  const m = pbrMemory();
  return { tier, sets: names.length, bytesPbr: m.bytes, mbPbr: Number((m.bytes / 1048576).toFixed(2)), glTextures: renderer.info.memory.textures };
};
function frame() {
  renderer.render(scene, camera);
  for (const l of labels) {
    const p = l.pos.clone().project(camera);
    l.el.style.left = `${((p.x + 1) / 2) * window.innerWidth}px`;
    l.el.style.top = `${((1 - p.y) / 2) * window.innerHeight}px`;
  }
  const s = stats();
  hud.textContent = `tier ${s.tier} · ${s.sets} set · tekstur PBR ${s.mbPbr} MB · GL ${s.glTextures} tekstur`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__texGallery = {
  ready: pbrManifest().then(() => Promise.all(readies)).then((r) => r.every(Boolean)),
  stats,
};
