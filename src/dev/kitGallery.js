/**
 * Galeri arketipe kit gedung (DEV, tidak ikut build produksi): /kit-gallery.html?kit=all|K01..K12|hero
 * &lod=0|1 &malam=1 &atlas=1 &seed=N &cam=depan|atas. Spesimen footprint sintetis berukuran tipikal katalog
 * aset (§1) berjajar menghadap kamera (+Z), label di atasnya; window.__kitGallery = { ready, stats } untuk
 * skrip screenshot (tests/e2e/kitGallery.shot.mjs → docs/screenshots/unri/m3-*.jpg).
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createResourceScope } from '../engine/ResourceScope.js';
import { ARCHETYPE_IDS, VARIANTS } from '../world/kit/archetypes.js';
import { createKitMaterials, KIT_NIGHT } from '../world/kit/kitMaterials.js';
import { createKitSink } from '../world/kit/kitBuilder.js';
import { appendPlanSteps } from '../world/kit/buildBuilding.js';
import { planBuilding } from '../world/kit/planBuilding.js';
import { appendSigns, collectSigns, createSignAtlas } from '../world/kit/signs.js';
import { ATLAS_SIZE } from '../world/kit/atlas.js';

/** Spesimen: [arketipe, lebar(x), dalam(z), lantai, overrides, label]. Ukuran dari katalog aset §1. */
const SPECIMENS = Object.freeze({
  K01: [['K01', 40, 12, 1, {}, 'K01 kuliah-koridor 1 lt'], ['K01', 46, 15, 2, { roof: 'limas', palette: 'putih-seng' }, 'K01 2 lt limas'], ['K01', 30, 10, 1, { palette: 'krem-genteng' }, 'K01 genteng']],
  K02: [['K02', 35, 14, 2, { sign: 'GEDUNG DEKANAT' }, 'K02 dekanat']],
  K03: [['K03', 50, 24, 3, { variant: 'segitiga', sign: 'INTEGRATED CLASSROOM' }, 'K03 segitiga'], ['K03', 40, 20, 4, { variant: 'wajik', sign: 'HEALTH SCIENCES CENTER' }, 'K03 wajik'], ['K03', 34, 18, 3, { variant: 'vertikal', sign: 'INTEGRATED LABORATORY' }, 'K03 vertikal']],
  K04: [['K04', 30, 15, 1, {}, 'K04 lab-bengkel'], ['K04', 40, 12, 2, {}, 'K04 2 lt']],
  K05: [['K05', 30, 20, 1, { sign: 'AUDITORIUM' }, 'K05 aula']],
  K06: [['K06', 12, 12, 1, {}, 'K06 limas-tumpang'], ['K06', 14, 12, 1, { variant: 'kubah-kecil', roof: 'datar-parapet' }, 'K06 kubah-kecil']],
  K07: [['K07', 20, 10, 1, {}, 'K07 kantin'], ['K07', 22, 9, 1, { variant: 'parkir' }, 'K07 parkir']],
  K08: [['K08', 12, 10, 1, {}, 'K08 pendopo-kayu']],
  K09: [['K09', 69, 23, 5, {}, 'K09 rusun']],
  K10: [['K10', 40, 14, 3, { variant: 'rangka' }, 'K10 rangka'], ['K10', 50, 13, 3, { variant: 'beratap', roof: 'pelana' }, 'K10 beratap']],
  K11: [['K11', 6, 5, 1, { variant: 'pos' }, 'K11 pos'], ['K11', 7, 5, 1, { variant: 'toilet' }, 'K11 toilet'], ['K11', 8, 6, 1, {}, 'K11 gudang']],
  K12: [['K12', 0, 0, 3, {}, 'K12 ekstrusi (L tak siku)']],
  hero: [
    ['hero:rektorat', 64, 38, 5, { palette: 'putih', roof: 'datar-parapet', sign: 'REKTORAT UNIVERSITAS RIAU' }, 'hero:rektorat'],
    ['hero:masjid-arfaunnas', 30, 28, 2, { roof: 'datar-parapet' }, 'hero:masjid-arfaunnas'],
    ['hero:ggm', -82, -82, 4, {}, 'hero:ggm (lingkaran)'],
    ['hero:sekretariat-lembaga', 16.8, 15.7, 1, {}, 'hero:sekretariat-lembaga'],
    ['hero:student-center', 53, 51, 3, { variant: 'segitiga' }, 'hero:student-center'],
    ['hero:stadion-mini', 137, 25, 2, {}, 'hero:stadion-mini (tribun)'],
    ['hero:gerbang-sm-amin', 20, 4, 1, {}, 'hero:gerbang-sm-amin'],
  ],
});

const params = new URLSearchParams(window.location.search);
const which = params.get('kit') ?? 'all';
const lod = Number(params.get('lod') ?? 0) === 1 ? 1 : 0;
const night = params.get('malam') === '1';
const seedBase = Number(params.get('seed') ?? 1);

/** Ring persegi w × d berpusat (cx, 0), sisi panjang sejajar X. */
function rectRing(cx, w, d) {
  return [[cx - w / 2, -d / 2], [cx + w / 2, -d / 2], [cx + w / 2, d / 2], [cx - w / 2, d / 2]];
}

/** Lingkaran 16 sisi berdiameter d (GGM). */
function circleRing(cx, d) {
  return Array.from({ length: 16 }, (_, i) => [cx + (Math.cos((i / 16) * Math.PI * 2) * d) / 2, (Math.sin((i / 16) * Math.PI * 2) * d) / 2]);
}

/** Footprint tak beraturan untuk K12: L dengan satu sisi miring 20°. */
function irregularRing(cx) {
  return [[cx - 18, -10], [cx + 14, -10], [cx + 18, 2], [cx + 4, 10], [cx - 18, 10]];
}

function specimenList() {
  if (which === 'all') return ARCHETYPE_IDS.map((id) => SPECIMENS[id][0]);
  if (which === 'variasi') return ARCHETYPE_IDS.flatMap((id) => SPECIMENS[id]);
  return SPECIMENS[which] ?? SPECIMENS.K01;
}

function labelSprite(text) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(20,24,30,0.78)';
  g.fillRect(0, 0, 512, 96);
  g.fillStyle = '#fff';
  g.font = '600 40px Inter, Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 48);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
  s.scale.set(20, 3.75, 1);
  return s;
}

function setupScene() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(night ? 0x0d1424 : 0xbfe0f7);
  scene.add(new THREE.HemisphereLight(night ? 0x223355 : 0xdfefff, night ? 0x111111 : 0x7a8a5a, night ? 0.25 : 1.1));
  const sun = new THREE.DirectionalLight(night ? 0x8899cc : 0xfff1dc, night ? 0.15 : 2.4);
  sun.position.set(-60, 90, 70);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -300, right: 300, top: 300, bottom: -300, far: 600 });
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x9fbf6a }));
  ground.receiveShadow = true;
  scene.add(ground);
  const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.5, 3000);
  return { renderer, scene, camera, sun };
}

/** Tata letak grid: kolom = ceil(sqrt(n * 1,6)); sel selebar spesimen terlebar + 16 m. */
function gridLayout(list) {
  const cols = Math.min(list.length, Math.ceil(Math.sqrt(list.length * 1.6)));
  const cellW = Math.max(...list.map(([, w]) => Math.abs(w) || 36)) + 16;
  const cellD = Math.max(...list.map(([, , d]) => Math.abs(d) || 20)) + 26;
  const rows = Math.ceil(list.length / cols);
  return {
    span: Math.max(cols * cellW, rows * cellD),
    at: (i) => ({ x: ((i % cols) - (cols - 1) / 2) * cellW, z: (Math.floor(i / cols) - (rows - 1) / 2) * cellD }),
  };
}

function buildSpecimens(scene, mats) {
  const list = specimenList();
  const layout = gridLayout(list);
  const sink = createKitSink();
  const plans = [];
  const perSpecimen = [];
  list.forEach(([arch, w, d, levels, ov, label], i) => {
    const { x: cx, z: cz } = layout.at(i);
    const base = arch === 'K12' ? irregularRing(cx) : w < 0 ? circleRing(cx, -w) : rectRing(cx, w, d);
    const ring = base.map(([x, z]) => [x, z + cz]);
    const plan = planBuilding({ id: `galeri-${i}`, ring, levels, archetype: arch, overrides: ov, seed: seedBase * 7919 + i, front: [0, 1], groundY: () => 0 });
    const before = sink.triangles;
    for (const _ of appendPlanSteps(sink, plan, mats, { lod })) { /* semua langkah */ }
    plans.push(plan);
    perSpecimen.push({ label, kit: plan.kit, triangles: sink.triangles - before, fallback: plan.fallback });
    const s = labelSprite(label);
    s.position.set(cx, plan.baseY + plan.height + 9, cz);
    scene.add(s);
  });
  const signs = lod === 0 ? collectSigns(plans) : [];
  const atlas = signs.length ? createSignAtlas(signs.map((e) => e.sign)) : null;
  if (atlas) appendSigns(sink, signs, atlas);
  const root = new THREE.Group();
  for (const p of sink.toParts({ ...mats, papan: atlas?.material ?? null }, 'galeri')) {
    const m = new THREE.Mesh(p.geometry, p.material);
    m.castShadow = p.castShadow;
    m.receiveShadow = true;
    root.add(m);
  }
  scene.add(root);
  return { root, perSpecimen, span: layout.span };
}

function showAtlas(scene, mats, camera, controls) {
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(64, 64), new THREE.MeshBasicMaterial({ map: mats.textures.map, transparent: true }));
  plane.position.set(0, 34, 0);
  scene.add(plane);
  camera.position.set(0, 34, 92);
  controls.target.set(0, 34, 0);
}

function main() {
  const { renderer, scene, camera } = setupScene();
  const scope = createResourceScope('galeri-kit');
  const t0 = performance.now();
  const mats = createKitMaterials(scope, { anisotropy: renderer.capabilities.getMaxAnisotropy() });
  const atlasMs = performance.now() - t0;
  if (night) mats.opak.emissiveIntensity = KIT_NIGHT.on;
  const controls = new OrbitControls(camera, renderer.domElement);
  let stats = { perSpecimen: [] };
  if (params.get('atlas') === '1') showAtlas(scene, mats, camera, controls);
  else {
    const built = buildSpecimens(scene, mats);
    stats = { perSpecimen: built.perSpecimen };
    const dist = Math.max(60, built.span * 0.62);
    const top = params.get('cam') === 'atas';
    camera.position.set(-dist * 0.12, top ? dist * 0.9 : dist * 0.3, top ? dist * 0.4 : dist * 0.78);
    controls.target.set(0, 4, 0);
  }
  controls.update();
  renderer.render(scene, camera);
  stats.drawCalls = renderer.info.render.calls;
  stats.triangles = renderer.info.render.triangles;
  stats.atlasSize = ATLAS_SIZE;
  stats.atlasMs = Math.round(atlasMs);
  stats.variants = VARIANTS;
  window.__kitGallery = { ready: true, stats };
  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

main();
