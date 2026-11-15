/**
 * Ruang uji (DEV, tidak ikut build produksi): /ruang-uji.html — ruangan kecil bergaya sekre (lantai keramik 60 cm,
 * dinding plester, jendela bersinar matahari, grid 1 m, tiang ukur 1,7 m) untuk memeriksa SATU model atau karakter
 * tanpa memuat dunia. Parameter URL (juga dari panel):
 *   model=<path relatif public>[,<path>…]   mis. models/sekre-hq/meja.glb
 *   orang=<id pack>                          mis. kasual-pria-g (pack orang, src/entities/Orang.js)
 *   anim=<klip>                              klip pack (jalan-p, diam-w, …) atau klip bawaan GLB; kosong = pose bind
 *   palet=<baju>-<kulit>                     mis. biru-sawo
 *   cam=depan|samping|belakang|34|atas|dekat  putar=1 (model berputar)  tulang=1 (SkeletonHelper)
 *   cahaya=siang|sore|malam                   bersih=1 (sembunyikan panel; untuk skrip bidikan)
 * window.__uji = { ready, info } dipakai tools/shots/uji.mjs.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  ORANG_KARAKTER, ORANG_BAJU, ORANG_KULIT, loadOrangAssets, createOrangFactory, playOrang,
} from '../entities/Orang.js';

const params = new URLSearchParams(window.location.search);
const state = {
  model: params.get('model') ?? '',
  orang: params.get('orang') ?? (params.get('model') ? '' : 'kasual-pria-g'),
  anim: params.get('anim') ?? 'diam-p',
  palet: params.get('palet') ?? 'biru-sawo',
  cam: params.get('cam') ?? '34',
  putar: params.get('putar') === '1',
  tulang: params.get('tulang') === '1',
  cahaya: params.get('cahaya') ?? 'siang',
};
if (params.get('bersih') === '1') document.body.classList.add('bersih');
window.__uji = { ready: false, info: null };

const BASE = import.meta.env.BASE_URL;
const ROOM = { w: 6, d: 6, h: 3.2 };

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fb4c8);
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.02, 60);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.9, 0);

// ---------- ruangan ----------
function canvasTex(w, h, draw, repeat = 1) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  return t;
}
const keramik = canvasTex(256, 256, (c, w, h) => {
  c.fillStyle = '#eceae4';
  c.fillRect(0, 0, w, h);
  c.strokeStyle = '#c9c5bb';
  c.lineWidth = 3;
  c.strokeRect(1.5, 1.5, w - 3, h - 3);
}, ROOM.w / 0.6);
const grid = canvasTex(256, 256, (c, w, h) => { // garis meter tipis di atas keramik
  c.clearRect(0, 0, w, h);
  c.strokeStyle = 'rgba(40,60,90,0.45)';
  c.lineWidth = 2;
  c.strokeRect(0, 0, w, h);
}, ROOM.w);
const plester = canvasTex(256, 256, (c, w, h) => {
  c.fillStyle = '#e9e6df';
  c.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i += 1) {
    c.fillStyle = `rgba(${(i * 37) % 2 ? '120,110,95' : '255,255,250'},0.05)`;
    c.fillRect((i * 97) % w, (i * 53) % h, 2, 2);
  }
}, 2);
const lantai = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: keramik, roughness: 0.25 }));
lantai.receiveShadow = true;
const gridMesh = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d).rotateX(-Math.PI / 2).translate(0, 0.002, 0),
  new THREE.MeshBasicMaterial({ map: grid, transparent: true, depthWrite: false }));
const dindingMat = new THREE.MeshStandardMaterial({ map: plester, roughness: 0.9 });
const dinding = new THREE.Group();
const wall = (w, h, x, z, ry) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), dindingMat);
  m.position.set(x, h / 2, z);
  m.rotation.y = ry;
  m.receiveShadow = true;
  dinding.add(m);
};
wall(ROOM.w, ROOM.h, 0, -ROOM.d / 2, 0);                  // belakang
wall(ROOM.d, ROOM.h, -ROOM.w / 2, 0, Math.PI / 2);        // kiri
// dinding kanan berjendela (dua potong + ambang atas/bawah)
const win = { z0: -1.0, z1: 1.0, y0: 0.9, y1: 2.3 };
for (const [z0, z1] of [[-ROOM.d / 2, win.z0], [win.z1, ROOM.d / 2]]) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(z1 - z0, ROOM.h), dindingMat);
  m.position.set(ROOM.w / 2, ROOM.h / 2, (z0 + z1) / 2);
  m.rotation.y = -Math.PI / 2;
  dinding.add(m);
}
for (const [y0, y1] of [[0, win.y0], [win.y1, ROOM.h]]) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(win.z1 - win.z0, y1 - y0), dindingMat);
  m.position.set(ROOM.w / 2, (y0 + y1) / 2, 0);
  m.rotation.y = -Math.PI / 2;
  dinding.add(m);
}
const plafon = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d).rotateX(Math.PI / 2).translate(0, ROOM.h, 0), new THREE.MeshStandardMaterial({ color: 0xf4f3ef, roughness: 1 }));
// tiang ukur 1,7 m (tiap 10 cm berganti warna) di pojok kiri belakang
const tiang = new THREE.Group();
for (let i = 0; i < 17; i += 1) {
  const s = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.04), new THREE.MeshLambertMaterial({ color: i % 2 ? 0xd84a3a : 0xf3f3f3 }));
  s.position.set(-ROOM.w / 2 + 0.3, 0.05 + i * 0.1, -ROOM.d / 2 + 0.3);
  tiang.add(s);
}
scene.add(lantai, gridMesh, dinding, plafon, tiang);

// ---------- cahaya ----------
const hemi = new THREE.HemisphereLight(0xffffff, 0x8a7f72, 0.8);
const sun = new THREE.DirectionalLight(0xffffff, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 20 });
sun.shadow.bias = -0.0005;
sun.target.position.set(0, 0, 0);
const lampu = new THREE.PointLight(0xfff4e0, 0, 0, 2);
lampu.position.set(0, ROOM.h - 0.2, 0);
scene.add(hemi, sun, sun.target, lampu);
const CAHAYA = {
  siang: { hemi: 0.9, sun: 3, sunPos: [6, 5, 1], sunColor: 0xffffff, lampu: 0, bg: 0x9fb4c8 },
  sore: { hemi: 0.25, sun: 4.5, sunPos: [6, 2.2, -1.5], sunColor: 0xffb070, lampu: 0, bg: 0x6d5a4a },
  malam: { hemi: 0.08, sun: 0, sunPos: [6, 5, 1], sunColor: 0xffffff, lampu: 12, bg: 0x101522 },
};
function applyCahaya() {
  const c = CAHAYA[state.cahaya] ?? CAHAYA.siang;
  hemi.intensity = c.hemi;
  sun.intensity = c.sun;
  sun.color.setHex(c.sunColor);
  sun.position.set(...c.sunPos);
  lampu.intensity = c.lampu;
  scene.background.setHex(c.bg);
}

// ---------- muatan ----------
const loader = new GLTFLoader();
const loadGlb = (path) => loader.loadAsync(`${BASE}${path}`).then((g) => { g.scene.animations = g.animations ?? []; return g.scene; });
let orangAssets = null;
let factory = null;
const stage = new THREE.Group();
scene.add(stage);
let active = { obj: null, h: null, mixer: null, helper: null, clips: [] };
const clock = new THREE.Clock();

function countTris(root) {
  let tris = 0;
  let meshes = 0;
  root.traverse((o) => {
    if (!o.isMesh) return;
    meshes += 1;
    const g = o.geometry;
    tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
  });
  return { tris: Math.round(tris), meshes };
}

function measure(root) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (o.isSkinnedMesh) { o.computeBoundingBox(); box.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld)); } else box.expandByObject(o);
  });
  return box;
}

async function load() {
  window.__uji.ready = false;
  stage.clear();
  active.helper?.removeFromParent();
  active = { obj: null, h: null, mixer: null, helper: null, clips: [] };
  if (state.orang) {
    orangAssets ??= await loadOrangAssets(loadGlb, BASE);
    factory ??= orangAssets && createOrangFactory(orangAssets);
    const [baju, kulit] = state.palet.split('-');
    const h = factory?.create(state.orang, baju, kulit ?? 'sawo');
    if (h) {
      stage.add(h.group);
      active = { obj: h.group, h, mixer: h.mixer, helper: null, clips: [...factory.clips.keys()] };
    }
  } else {
    const paths = state.model.split(',').map((s) => s.trim()).filter(Boolean);
    const roots = await Promise.all(paths.map(loadGlb));
    roots.forEach((r, i) => {
      r.position.x = (i - (roots.length - 1) / 2) * 1.4;
      r.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      stage.add(r);
    });
    const clips = roots.flatMap((r) => r.animations);
    const mixer = clips.length ? new THREE.AnimationMixer(roots[0]) : null;
    const clip = clips.find((c) => c.name === state.anim) ?? null;
    if (mixer && clip) mixer.clipAction(clip).play();
    active = { obj: stage, h: null, mixer, helper: null, clips: clips.map((c) => c.name) };
  }
  if (state.tulang && active.obj) {
    active.helper = new THREE.SkeletonHelper(active.obj);
    scene.add(active.helper);
  }
  tick(0);
  const box = measure(stage);
  const size = box.getSize(new THREE.Vector3());
  frame(box);
  const t = countTris(stage);
  window.__uji.info = {
    ukuran: size.toArray().map((v) => +v.toFixed(3)), min: box.min.toArray().map((v) => +v.toFixed(3)),
    segitiga: t.tris, mesh: t.meshes, klip: active.clips,
  };
  renderPanel();
  window.__uji.ready = true;
}

const CAMS = { depan: [0, 0.15, 1], samping: [1, 0.15, 0], belakang: [0, 0.2, -1], 34: [0.8, 0.35, 1], atas: [0.01, 1, 0.01], dekat: [0.2, 0.1, 1] };
function frame(box) {
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  if (!Number.isFinite(center.x) || size.length() === 0) { center.set(0, 0.9, 0); size.set(1, 1.8, 1); }
  const dir = new THREE.Vector3(...(CAMS[state.cam] ?? CAMS[34])).normalize();
  const r = Math.max(size.x, size.y, size.z) * (state.cam === 'dekat' ? 0.45 : 1);
  const dist = Math.min(5.2, Math.max(0.6, r / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.75));
  controls.target.copy(center);
  camera.position.copy(center).addScaledVector(dir, dist);
  controls.update();
}

function tick(dt) {
  if (active.h && state.anim) playOrang(active.h, factory.clips, state.anim, (active.h.t = (active.h.t ?? 0) + dt), dt);
  else if (active.h) active.h.skinned?.skeleton.pose();
  else active.mixer?.update(dt);
  if (state.putar) stage.rotation.y += dt * 0.6;
}

// ---------- panel ----------
const panel = document.getElementById('panel');
const infoEl = document.getElementById('info');
function sel(label, value, options, onChange) {
  const l = document.createElement('label');
  l.textContent = label;
  const s = document.createElement('select');
  for (const o of options) s.append(new Option(o || '—', o, o === value, o === value));
  s.onchange = () => onChange(s.value);
  l.append(s);
  return l;
}
function syncUrl() {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(state)) if (v !== '' && v !== false) p.set(k, v === true ? '1' : v);
  history.replaceState(null, '', `?${p}`);
}
function renderPanel() {
  panel.replaceChildren(
    sel('orang', state.orang, ['', ...Object.keys(ORANG_KARAKTER)], (v) => { state.orang = v; syncUrl(); load(); }),
    sel('anim', state.anim, ['', ...active.clips], (v) => { state.anim = v; syncUrl(); }),
    sel('palet', state.palet, ORANG_BAJU.flatMap((b) => ORANG_KULIT.map((k) => `${b}-${k}`)), (v) => { state.palet = v; syncUrl(); load(); }),
    sel('kamera', state.cam, Object.keys(CAMS), (v) => { state.cam = v; syncUrl(); frame(measure(stage)); }),
    sel('cahaya', state.cahaya, Object.keys(CAHAYA), (v) => { state.cahaya = v; syncUrl(); applyCahaya(); }),
  );
  const i = window.__uji.info;
  infoEl.textContent = i ? `ukuran ${i.ukuran.join(' × ')} m · ${i.segitiga} segitiga · ${i.mesh} mesh · ${renderer.info.render.calls} draw` : '';
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
applyCahaya();
renderer.setAnimationLoop(() => {
  tick(Math.min(0.05, clock.getDelta()));
  controls.update();
  renderer.render(scene, camera);
});
load().catch((err) => { console.error(err); infoEl.textContent = `GAGAL: ${err.message}`; window.__uji.ready = true; window.__uji.error = String(err); });
