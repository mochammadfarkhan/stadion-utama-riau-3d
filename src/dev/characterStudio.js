/**
 * Studio karakter (DEV, tidak ikut build produksi): /karakter-studio.html — scene three.js terpisah untuk mencoba kit
 * chibi Blender + tipe NPC tanpa memuat dunia (detik, bukan menit). Parameter URL (juga diatur dari panel):
 *   tipe=all|jogger|mahasiswa|dosen|pengunjung|anak|satpam   n=2 (varian per tipe)   seed=1
 *   anim=idle|walk|run|diam|pose:<id>   cam=depan|samping|belakang|34|dekat|profil   putar=1   hijab=1 (varian ke-2 berhijab)
 *   kit=0 (bentuk prosedural lama, pembanding)   bersih=1 (sembunyikan panel; dipakai skrip bidikan)
 * window.__studio = { ready, stats } untuk tools/shots/studio.mjs.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createHumanoid, animateIdle, animateWalk, animateRun } from '../entities/Humanoid.js';
import { applyPose, POSES } from '../entities/Humanoid.poses.js';
import { HUMANOID_KIT_PATH, setHumanoidKit, clearHumanoidKit } from '../entities/Humanoid.kit.js';
import { NPC_TYPES, NPC_TYPE_LABELS, outfitForNpcType } from '../entities/npcTypes.js';
import { makeRng } from '../entities/util.js';

const params = new URLSearchParams(window.location.search);
const state = {
  tipe: params.get('tipe') ?? 'all',
  n: Math.max(1, Math.min(6, Number(params.get('n') ?? 2))),
  seed: Number(params.get('seed') ?? 1),
  anim: params.get('anim') ?? 'idle',
  cam: params.get('cam') ?? 'depan',
  putar: params.get('putar') === '1',
  hijab: params.get('hijab') !== '0',
  kit: params.get('kit') !== '0',
};
if (params.get('bersih') === '1') document.body.classList.add('bersih');

const SPACING = 1.1;
const HIJAB_COLORS = [0x16a085, 0x8e44ad, 0xf5f5f5, 0x2c3e50, 0xff8fb1];
const CAMS = Object.freeze({
  depan: { dir: [0, 0.12, 1], fit: 1 },
  samping: { dir: [1, 0.12, 0], fit: 1 },
  belakang: { dir: [0, 0.15, -1], fit: 1 },
  34: { dir: [0.75, 0.3, 1], fit: 1 },
  dekat: { dir: [0, 0.05, 1], fit: 0.32, close: true },
  profil: { dir: [0, 0.05, 1], fit: 0.32, close: true, turn: Math.PI / 2 }, // tiap orang diputar 90°: profil berjajar
});

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb9b2a8);
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7f72, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(3, 6, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 4, bottom: -2 });
scene.add(sun);
const ground = new THREE.Mesh(new THREE.CircleGeometry(12, 48), new THREE.MeshLambertMaterial({ color: 0xa69d91 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.05, 100);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

let people = [];
const lineup = new THREE.Group();
scene.add(lineup);

/** Daftar [tipe, seed, berhijab] sesuai state. */
function variants() {
  const types = state.tipe === 'all' ? NPC_TYPES : [state.tipe];
  return types.flatMap((t) => Array.from({ length: state.n }, (_, k) => [t, state.seed + k * 8, state.hijab && k === 1 && t !== 'satpam']));
}

/** Pakaian satu varian; varian berhijab ikut busana sopan seperti generator. */
function outfitOf(type, seed, hijab, i) {
  const o = outfitForNpcType(type, makeRng(seed));
  if (!hijab) return o;
  const modest = type === 'anak' ? {} : { longSleeve: true, bottom: o.bottom === 'shorts' || o.bottom === 'skirt' ? 'longskirt' : o.bottom };
  return { ...o, ...modest, hair: null, hat: null, hijab: HIJAB_COLORS[i % HIJAB_COLORS.length] };
}

function rebuild() {
  for (const p of people) p.h.group.removeFromParent();
  const list = variants();
  people = list.map(([type, seed, hijab], i) => {
    const h = createHumanoid(outfitOf(type, seed, hijab, i));
    h.group.position.x = (i - (list.length - 1) / 2) * SPACING;
    h.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    lineup.add(h.group);
    return { h, type, phase: i * 0.7 };
  });
  frame();
  updateStats();
}

/** Arahkan kamera agar barisan pas di layar (cam=dekat: hanya bagian tengah, setinggi dada-kepala). */
function frame() {
  const c = CAMS[state.cam] ?? CAMS.depan;
  const width = Math.max(1.2, people.length * SPACING) * c.fit;
  for (const p of people) p.h.group.rotation.y = c.turn ?? 0;
  const target = new THREE.Vector3(0, c.close ? 1.25 : 0.85, 0);
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const dist = Math.max((width / 2) / Math.tan(vfov / 2) / camera.aspect, (c.close ? 0.9 : 2) / Math.tan(vfov / 2)) * 1.15;
  const dir = new THREE.Vector3(...c.dir).normalize();
  camera.position.copy(target).addScaledVector(dir, dist);
  controls.target.copy(target);
  controls.update();
}

function updateStats() {
  let tris = 0;
  let meshes = 0;
  people[0]?.h.group.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    meshes += 1;
    tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
  });
  window.__studio.stats = { people: people.length, trianglesPerHumanoid: Math.round(tris), meshesPerHumanoid: meshes, kit: state.kit };
  document.getElementById('stats').textContent =
    `${people.length} orang · ${Math.round(tris)} segitiga & ${meshes} mesh per orang · kit ${state.kit ? 'Blender' : 'prosedural'}`;
}

function animate(p, t) {
  const tt = t + p.phase;
  if (state.anim === 'walk') animateWalk(p.h, tt * 1.6);
  else if (state.anim === 'run') animateRun(p.h, tt * 2.2);
  else if (state.anim.startsWith('pose:')) applyPose(p.h, state.anim.slice(5), tt);
  else if (state.anim === 'idle') animateIdle(p.h, tt);
}

/** Panel kontrol kecil; setiap perubahan ditulis ke URL agar bisa dibagikan/diulang. */
function buildPanel() {
  const panel = document.getElementById('panel');
  const select = (key, label, options) => {
    const el = document.createElement('select');
    for (const [value, text] of options) el.add(new Option(text, value, false, String(state[key]) === String(value)));
    el.onchange = () => { state[key] = key === 'n' ? Number(el.value) : el.value; apply(key); };
    const wrap = document.createElement('label');
    wrap.append(label, el);
    panel.append(wrap);
  };
  const toggle = (key, label) => {
    const el = document.createElement('input');
    el.type = 'checkbox';
    el.checked = state[key];
    el.onchange = () => { state[key] = el.checked; apply(key); };
    const wrap = document.createElement('label');
    wrap.append(el, label);
    panel.append(wrap);
  };
  select('tipe', 'Tipe', [['all', 'Semua'], ...NPC_TYPES.map((t) => [t, NPC_TYPE_LABELS[t]])]);
  select('n', 'Varian', [1, 2, 3, 4].map((v) => [v, String(v)]));
  select('anim', 'Animasi', [['idle', 'Diam napas'], ['walk', 'Jalan'], ['run', 'Lari'], ['diam', 'Kaku'],
    ...Object.keys(POSES).map((id) => [`pose:${id}`, `Pose ${id}`])]);
  select('cam', 'Kamera', Object.keys(CAMS).map((k) => [k, k]));
  toggle('hijab', 'Varian hijab');
  toggle('putar', 'Putar');
  toggle('kit', 'Kit Blender');
}

async function apply(key) {
  const url = new URL(window.location.href);
  url.searchParams.set(key, typeof state[key] === 'boolean' ? (state[key] ? '1' : '0') : state[key]);
  window.history.replaceState(null, '', url);
  if (key === 'kit') await loadKit();
  if (key === 'cam') frame();
  else if (key !== 'anim' && key !== 'putar') rebuild();
}

async function loadKit() {
  if (!state.kit) { clearHumanoidKit(); return; }
  const base = import.meta.env?.BASE_URL ?? '/';
  const gltf = await new GLTFLoader().loadAsync(`${base}${HUMANOID_KIT_PATH}`);
  setHumanoidKit(gltf.scene);
}

window.__studio = { ready: false, stats: null };
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  if (state.putar) lineup.rotation.y = t * 0.6;
  for (const p of people) animate(p, t);
  controls.update();
  renderer.render(scene, camera);
});

buildPanel();
loadKit()
  .catch((err) => console.error('Kit karakter gagal dimuat; memakai bentuk prosedural:', err))
  .then(() => { rebuild(); window.__studio.ready = true; });
