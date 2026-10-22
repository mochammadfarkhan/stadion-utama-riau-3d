/**
 * Studio reels (DEV, tidak ikut build produksi): /reels.html — scene render terpisah 9:16 untuk video pendek
 * penjelasan. Memakai ulang interior sekre (ruang, perabot, papan, cahaya) tanpa jadwal NPC-nya; aktor, kamera, dan
 * teks dikendalikan berkas scene di src/dev/reels/scenes/. Waktu = nomor frame / fps (deterministik), jadi render
 * frame-demi-frame (tools/reels/render.mjs) menghasilkan video mulus walau tiap frame lambat.
 * Parameter URL: scene=<id>  t=<detik awal pratinjau>  render=1 (tanpa panel/loop; dikendalikan skrip)  aman=1 (zona aman)
 * window.__reel = { ready, error, fps, frames, durasi, frame(i) } untuk skrip render.
 */
import '@fontsource-variable/inter';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createHumanoid } from '../entities/Humanoid.js';
import { applyPose, POSES } from '../entities/Humanoid.poses.js';
import { HUMANOID_KIT_PATH, setHumanoidKit } from '../entities/Humanoid.kit.js';
import { createResourceScope, withScope } from '../engine/ResourceScope.js';
import { lightingPreset } from '../sim/dayCycle.js';
import { createSekreInterior } from '../interiors/sekre/index.js';
import { npcOutfit } from '../interiors/sekre/npcs.js';
import { NPCS, SLOTS } from '../interiors/sekre/data.js';
import { keyframes, activeAt, frameCount } from './reels/timeline.js';
import { REEL_SCENES } from './reels/scenes/index.js';

const params = new URLSearchParams(window.location.search);
const RENDER_MODE = params.get('render') === '1';
const ASPECT = 9 / 16;
const SKIP_SYSTEMS = new Set(['interior.sekre.npcs', 'interior.sekre.audio']); // NPC terjadwal & suara diganti skrip scene
const def = REEL_SCENES[params.get('scene') ?? 'sekre-duduk'] ?? Object.values(REEL_SCENES)[0];
const totalFrames = frameCount(def.durasi, def.fps);

if (RENDER_MODE) document.body.classList.add('render');
if (params.get('aman') === '1') document.body.classList.add('aman');
window.__reel = { ready: false, error: null, fps: def.fps, frames: totalFrames, durasi: def.durasi, frame: null };

const stage = document.getElementById('stage');
const teksEl = document.getElementById('teks');
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(RENDER_MODE ? window.devicePixelRatio : Math.min(2, window.devicePixelRatio));
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 0.9;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap; // sama dengan world/Lighting.js; cahaya sekre disetel untuk VSM
stage.prepend(renderer.domElement);

const cam = {
  pos: keyframes(def.kamera.pos),
  target: keyframes(def.kamera.target),
  fov: keyframes(def.kamera.fov ?? [{ t: 0, v: 55 }]),
};

/** Kotak 9:16 sebesar mungkin di jendela (mode render: jendela = ukuran video). */
function layout(camera) {
  const h = Math.min(window.innerHeight, window.innerWidth / ASPECT);
  const w = h * ASPECT;
  Object.assign(stage.style, { width: `${w}px`, height: `${h}px` });
  stage.style.setProperty('--h', `${h}px`);
  renderer.setSize(w, h, false);
  camera.aspect = ASPECT;
  camera.updateProjectionMatrix();
}

/** Aktor scene: Humanoid dari roster sekre, diletakkan di slot (atau x/z/yaw sendiri). */
function createActors(group, props) {
  const slotById = new Map(SLOTS.map((s) => [s.id, s]));
  return def.aktor.map((a, i) => {
    const npc = NPCS.find((n) => n.id === a.npc);
    if (!npc) throw new Error(`Reels: npc "${a.npc}" tidak ada di data sekre`);
    const slot = slotById.get(a.slot) ?? { x: 0, z: 0, yaw: 0, poseId: 'standTalk' };
    const poseId = a.pose ?? slot.poseId;
    if (typeof poseId === 'string' && !POSES[poseId]) throw new Error(`Reels: pose "${poseId}" tidak dikenal`);
    const h = createHumanoid(npcOutfit(npc));
    h.group.position.set(a.x ?? slot.x, 0, a.z ?? slot.z);
    h.group.rotation.y = a.yaw ?? slot.yaw;
    h.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    group.add(h.group);
    if (poseId === 'guitarStrum') props.holdGuitar(h.parts.spine);
    return { def: a, h, poseId, phase: i * 1.37 };
  });
}

function drawText(t) {
  const html = activeAt(def.teks, t).map(({ item, alpha }) => {
    const style = `opacity:${alpha.toFixed(3)};transform:translateY(${((1 - alpha) * 12).toFixed(1)}px)`;
    if (item.gaya === 'judul') return `<div class="judul" style="${style}"><b>${item.isi}</b>${item.kecil ? `<span>${item.kecil}</span>` : ''}</div>`;
    return `<div class="sub" style="${style}"><span>${item.isi}</span></div>`;
  }).join('');
  if (teksEl.innerHTML !== html) teksEl.innerHTML = html;
}

async function boot() {
  const scope = createResourceScope('reels');
  const time = { hour: def.jam, preset: lightingPreset(def.jam) };
  const kit = await new GLTFLoader().loadAsync(`${import.meta.env?.BASE_URL ?? '/'}${HUMANOID_KIT_PATH}`)
    .catch((err) => { console.warn('Kit karakter gagal dimuat; bentuk prosedural:', err); return null; });
  if (kit) setHumanoidKit(kit.scene);
  const built = await createSekreInterior({ exitTo: { region: 'reels', x: 0, z: 0, yaw: 0 } }).build({
    scope, renderer, time, fov: 55, setExposure: (v) => { renderer.toneMappingExposure = v * 0.92; },
  });
  const { scene, camera } = built;
  const npcs = built.debug.npcs;
  npcs.group.visible = false;
  const cast = new THREE.Group();
  cast.name = 'reels-aktor';
  scene.add(cast);
  const actors = withScope(scope, () => createActors(cast, built.debug.furniture.props));
  const activeSlots = new Set(def.aktor.map((a) => a.slot));
  npcs.isActive = (slotId) => activeSlots.has(slotId); // layar laptop menyala bila slot laptop dipakai aktor
  const systems = built.systems.filter((s) => !SKIP_SYSTEMS.has(s.id));
  const target = new THREE.Vector3();
  layout(camera);
  window.addEventListener('resize', () => layout(camera));

  /** Satu frame pada waktu t; dt = langkah sistem (cahaya, kipas, hujan). */
  function step(t, dt) {
    for (const s of systems) s.update(dt);
    for (const a of actors) {
      const poseId = typeof a.poseId === 'function' ? a.poseId(t) : a.poseId;
      applyPose(a.h, poseId, t + a.phase);
      a.def.gerak?.(t, a.h.parts);
    }
    const sway = def.goyang ?? 0;
    const [px, py, pz] = cam.pos(t);
    camera.position.set(
      px + sway * Math.sin(t * 1.3) + sway * 0.5 * Math.sin(t * 3.1),
      py + sway * 0.7 * Math.sin(t * 1.7 + 1),
      pz + sway * Math.sin(t * 0.9 + 2),
    );
    camera.lookAt(target.set(...cam.target(t)));
    camera.fov = cam.fov(t);
    camera.updateProjectionMatrix();
    scene.updateMatrixWorld();
    renderer.render(scene, camera);
    drawText(t);
  }

  await built.ready;
  await document.fonts.ready;
  // Pemanasan: cahaya interior menghaluskan nilai (lerp per dt) — jalankan 2 detik agar frame 0 sudah stabil.
  for (let i = 0; i < 60; i += 1) for (const s of systems) s.update(1 / 30);

  window.__reel.frame = (i) => step(i / def.fps, 1 / def.fps);
  window.__reel.debug = { scene, camera, renderer, actors };
  window.__reel.ready = true;
  if (!RENDER_MODE) startPreview(step);
}

/** Pratinjau: putar/jeda, geser waktu, zona aman. Waktu tetap terkuantisasi ke frame agar sama dengan hasil render. */
function startPreview(step) {
  const panel = document.getElementById('panel');
  panel.innerHTML = `<button id="putar">⏸</button><input id="geser" type="range" min="0" max="${totalFrames - 1}" value="0">
    <span id="waktu"></span><label><input id="aman" type="checkbox"> zona aman</label><span>${def.judul}</span>`;
  const geser = panel.querySelector('#geser');
  const waktu = panel.querySelector('#waktu');
  const tombol = panel.querySelector('#putar');
  let playing = true;
  let frame = Math.round(Number(params.get('t') ?? 0) * def.fps) % totalFrames;
  let acc = 0;
  let last = performance.now();
  tombol.onclick = () => { playing = !playing; tombol.textContent = playing ? '⏸' : '▶'; };
  geser.oninput = () => { frame = Number(geser.value); playing = false; tombol.textContent = '▶'; };
  panel.querySelector('#aman').checked = document.body.classList.contains('aman');
  panel.querySelector('#aman').onchange = (e) => document.body.classList.toggle('aman', e.target.checked);
  window.addEventListener('keydown', (e) => { if (e.code === 'Space') tombol.onclick(); });
  renderer.setAnimationLoop((now) => {
    acc += playing ? (now - last) / 1000 : 0;
    last = now;
    while (acc >= 1 / def.fps) { acc -= 1 / def.fps; frame = (frame + 1) % totalFrames; }
    step(frame / def.fps, 1 / def.fps);
    geser.value = String(frame);
    waktu.textContent = `${(frame / def.fps).toFixed(2)} / ${def.durasi}s`;
  });
}

boot().catch((err) => {
  console.error('Reels gagal dimuat:', err);
  window.__reel.error = String(err?.stack ?? err);
});
