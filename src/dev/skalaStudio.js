/**
 * Studio Skala Nusantara (DEV, tidak ikut build produksi): /skala.html — video pendek 9:16 perbandingan skala
 * bergaya maket isometrik (kamera ortografis, bayangan lembut, penggaris & figur 1,7 m). Episode = data + build()
 * di src/dev/skala/episodes/. Waktu = nomor frame / fps (deterministik), dirender oleh tools/reels/render.mjs --page skala.
 * Parameter URL: ep=<id>  t=<detik awal pratinjau>  render=1 (tanpa panel/loop)  aman=1 (zona aman)
 * window.__reel = { ready, error, fps, frames, durasi, frame(i) } (antarmuka sama dengan studio reels).
 */
import '@fontsource-variable/inter';
import * as THREE from 'three';
import { keyframes, activeAt, frameCount } from './reels/timeline.js';
import { createDiorama, createRuler } from './skala/diorama.js';
import { SKALA_EPISODES } from './skala/episodes/index.js';

const params = new URLSearchParams(window.location.search);
const RENDER_MODE = params.get('render') === '1';
const ASPECT = 9 / 16;
const def = SKALA_EPISODES[params.get('ep') ?? params.get('scene')] ?? Object.values(SKALA_EPISODES)[0];
const totalFrames = frameCount(def.durasi, def.fps);
const DEG = Math.PI / 180;

if (RENDER_MODE) document.body.classList.add('render');
if (params.get('aman') === '1') document.body.classList.add('aman');
window.__reel = { ready: false, error: null, fps: def.fps, frames: totalFrames, durasi: def.durasi, frame: null };

const stage = document.getElementById('stage');
const teksEl = document.getElementById('teks');
const labelEl = document.getElementById('label');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(RENDER_MODE ? window.devicePixelRatio : Math.min(2, window.devicePixelRatio));
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.localClippingEnabled = true; // clipBelowSea (kapal karam)
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
stage.prepend(renderer.domElement);

const cam = {
  target: keyframes(def.kamera.target),
  azimut: keyframes(def.kamera.azimut),
  elevasi: keyframes(def.kamera.elevasi),
  tinggi: keyframes(def.kamera.tinggi),
};
let stageH = 1;
let stageW = 1;

function layout() {
  stageH = Math.min(window.innerHeight, window.innerWidth / ASPECT);
  stageW = stageH * ASPECT;
  Object.assign(stage.style, { width: `${stageW}px`, height: `${stageH}px` });
  stage.style.setProperty('--h', `${stageH}px`);
  renderer.setSize(stageW, stageH, false);
}

/** Teks layar (HTML sederhana dari berkas episode lokal). gaya: judul | sub | narasi | banding (kiri vs kanan). */
function drawText(t) {
  const html = activeAt(def.teks, t).map(({ item, alpha }) => {
    const style = `opacity:${alpha.toFixed(3)};transform:translateY(${((1 - alpha) * 12).toFixed(1)}px)`;
    if (item.gaya === 'judul') return `<div class="judul" style="${style}"><b>${item.isi}</b>${item.kecil ? `<span>${item.kecil}</span>` : ''}</div>`;
    if (item.gaya === 'banding') {
      return `<div class="banding" style="${style}"><i>${item.isi}</i><div class="kiri"><small>Batavia</small><b>${item.kiri}</b></div>`
        + `<div class="kanan"><small>Pinisi</small><b>${item.kanan}</b></div></div>`;
    }
    return `<div class="sub${item.gaya === 'narasi' ? ' narasi' : ''}" style="${style}"><span>${item.isi}</span></div>`;
  }).join('');
  if (teksEl.innerHTML !== html) teksEl.innerHTML = html;
}

async function boot() {
  layout();
  const diorama = createDiorama();
  const { scene } = diorama;
  const built = def.build({ scene, seaY: diorama.seaY });
  const rulers = (def.ukur ?? []).map((u) => {
    const r = createRuler(u.a, u.b, u.warna);
    scene.add(r.group);
    return { def: u, r };
  });
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 600);
  const target = new THREE.Vector3();
  const v = new THREE.Vector3();
  window.addEventListener('resize', layout);

  /** Titik dunia → piksel di #stage; null bila di belakang kamera/di luar layar. */
  const toScreen = (p) => {
    v.copy(p).project(camera);
    if (Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) return null;
    return [(v.x * 0.5 + 0.5) * stageW, (-v.y * 0.5 + 0.5) * stageH];
  };
  const tag = (xy, isi, warna, alpha) => (xy
    ? `<div class="tag" style="left:${xy[0].toFixed(1)}px;top:${xy[1].toFixed(1)}px;--c:${warna};opacity:${alpha.toFixed(3)}">${isi}</div>`
    : '');

  function step(t) {
    diorama.update(t);
    built.update(t);
    const H = cam.tinggi(t);
    Object.assign(camera, { left: (-H * ASPECT) / 2, right: (H * ASPECT) / 2, top: H / 2, bottom: -H / 2 });
    const az = cam.azimut(t) * DEG;
    const el = cam.elevasi(t) * DEG;
    target.set(...cam.target(t));
    camera.position.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(250).add(target);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(); // kamera tidak di dalam scene: perbarui sebelum proyeksi label (bukan frame lalu)
    scene.updateMatrixWorld();

    let labels = '';
    for (const { def: u, r } of rulers) {
      const on = t >= u.dari && t < u.sampai;
      const k = on ? (t - u.dari) / u.tumbuh : 0;
      const tip = r.set(k);
      if (on) {
        const e = Math.min(1, k);
        labels += tag(toScreen(tip.clone().setY(tip.y + 1.4)), `${Math.round(u.nilai * e * e * (3 - 2 * e))} m`, u.warna, Math.min(1, (t - u.dari) * 4, (u.sampai - t) * 4));
      }
    }
    for (const { item, alpha } of activeAt(def.label ?? [], t)) {
      const obj = built.objects[item.di];
      if (!obj?.visible) continue;
      const p = obj.localToWorld(new THREE.Vector3(...(item.offset ?? [0, 0, 0])));
      labels += tag(toScreen(p), typeof item.isi === 'function' ? item.isi(t) : item.isi, item.warna, alpha);
    }
    if (labelEl.innerHTML !== labels) labelEl.innerHTML = labels;
    renderer.render(scene, camera);
    drawText(t);
  }

  await document.fonts.ready;
  window.__reel.frame = (i) => step(i / def.fps);
  window.__reel.debug = { scene, camera, renderer, objects: built.objects };
  window.__reel.ready = true;
  if (!RENDER_MODE) startPreview(step);
}

/** Pratinjau: putar/jeda, geser waktu, zona aman (waktu terkuantisasi ke frame = sama dengan hasil render). */
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
    step(frame / def.fps);
    geser.value = String(frame);
    waktu.textContent = `${(frame / def.fps).toFixed(2)} / ${def.durasi}s`;
  });
}

boot().catch((err) => {
  console.error('Studio skala gagal dimuat:', err);
  window.__reel.error = String(err?.stack ?? err);
});
