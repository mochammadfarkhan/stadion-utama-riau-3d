/**
 * Jalan beton Jl. Prof. Aras Mulyadi (menimpa aspal bake distrik di dalam region), marka nama jalan, parit beton U
 * terbuka, tiang listrik + kabel, dan PJU kampus area sekre UKM (foto Street View: perkerasan beton abu-abu bersambungan
 * pelat, parit U di tepi timur, tiang beton di tepi). Semua dari data/generator ukmRoads.data.js; material & tekstur
 * kanvas tilable disimpan sebagai objek polos di ResourceScope (dilepas bersama region).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { currentScope } from '../../engine/ResourceScope.js';
import { createLampPosts, LAMP_POST } from '../../world/props/LampPost.js';
import { hasDocument } from '../../world/props/canvasText.js';
import { createRandom } from '../../world/siteutil/rng.js';
import { ROAD_LAYOUT, ROAD_SPEC, ROAD_SURFACES, pjuHead } from './ukmRoads.data.js';
import { ribbonGeometry, ditchGeometry, utilityPoleGeometry, wireGeometry } from './ukmRoadGeo.js';
import { staged } from './staged.js';

export const JALAN_GROUP = 'ukm-jalan';
export const ROAD_NAME = Object.freeze(['JL. PROF. ARAS', 'MULYADI']);

function canvasTexture(w, h, draw, { repeat = true } = {}) {
  if (!hasDocument()) return null;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  draw(ctx, w, h, createRandom(7));
  const tex = new THREE.CanvasTexture(canvas);
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

const speckle = (ctx, w, h, rnd, n, tones, maxSize) => {
  for (let i = 0; i < n; i += 1) {
    ctx.fillStyle = tones[Math.floor(rnd.next() * tones.length)];
    ctx.fillRect(rnd.next() * w, rnd.next() * h, 1 + rnd.next() * maxSize, 1 + rnd.next() * maxSize);
  }
};

/** Pelat beton jalan: satu tile = lebar jalan × panjang pelat; sambungan di tengah dan tepi bawah, jejak roda, noda. */
function roadConcreteTexture() {
  return canvasTexture(256, 256, (ctx, w, h, rnd) => {
    ctx.fillStyle = '#a6a299';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 14; i += 1) { // bercak nada besar (pelat tidak rata warnanya)
      ctx.fillStyle = `rgba(${rnd.chance(0.5) ? '120,118,108' : '205,203,194'},0.09)`;
      ctx.beginPath();
      ctx.ellipse(rnd.next() * w, rnd.next() * h, 20 + rnd.next() * 46, 14 + rnd.next() * 30, rnd.next() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    speckle(ctx, w, h, rnd, 2600, ['#8f8b82', '#b3b0a6', '#7d7a71', '#a8a498'], 1.5);
    for (const x of [74, 184]) { // jejak roda
      ctx.fillStyle = 'rgba(70,66,58,0.10)';
      ctx.fillRect(x - 15, 0, 30, h);
    }
    ctx.fillStyle = '#5f5d56'; // sambungan melintang (tepi tile) + memanjang (tengah)
    ctx.fillRect(0, h - 2, w, 2);
    ctx.fillRect(0, 0, w, 1);
    ctx.fillRect(w / 2 - 1, 0, 2, h);
    ctx.fillStyle = 'rgba(96,78,52,0.30)'; // tanah terbawa di tepi
    ctx.fillRect(0, 0, 10, h);
    ctx.fillRect(w - 10, 0, 10, h);
    ctx.fillStyle = 'rgba(96,78,52,0.14)';
    ctx.fillRect(10, 0, 12, h);
    ctx.fillRect(w - 22, 0, 12, h);
  });
}

/** Beton parit/tutup pelat: lebih gelap, berlumut hijau tipis. */
function ditchConcreteTexture() {
  return canvasTexture(128, 128, (ctx, w, h, rnd) => {
    ctx.fillStyle = '#868a7c';
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, rnd, 1400, ['#7c7a72', '#a09d93', '#6f7560', '#646f50'], 1);
    ctx.fillStyle = 'rgba(70,90,50,0.16)';
    ctx.fillRect(0, h * 0.55, w, h * 0.45);
  });
}

/** Marka nama jalan putih pudar (alpha): dua baris, huruf dipanjangkan sepanjang arah jalan lewat rasio kanvas. */
function roadNameTexture() {
  return canvasTexture(512, 256, (ctx, w, h, rnd) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#f2f0e8';
    ctx.font = 'bold 66px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ROAD_NAME[0], w / 2, h * 0.3);
    ctx.fillText(ROAD_NAME[1], w / 2, h * 0.7);
    ctx.globalCompositeOperation = 'destination-out'; // cat terkelupas
    for (let i = 0; i < 700; i += 1) {
      ctx.fillStyle = `rgba(0,0,0,${0.25 + rnd.next() * 0.6})`;
      ctx.fillRect(rnd.next() * w, rnd.next() * h, 1 + rnd.next() * 4, 1 + rnd.next() * 3);
    }
    ctx.globalCompositeOperation = 'source-over';
  }, { repeat: false });
}

const offsetMat = (m, f) => {
  m.polygonOffset = true;
  m.polygonOffsetFactor = f;
  m.polygonOffsetUnits = f * 2;
  return m;
};

function roadsideKit() {
  const road = roadConcreteTexture();
  const ditch = ditchConcreteTexture();
  const name = roadNameTexture();
  const std = (opts) => new THREE.MeshStandardMaterial({ roughness: 0.95, ...opts });
  const kit = {
    roadMap: road,
    ditchMap: ditch,
    nameMap: name,
    road: offsetMat(std({ color: road ? 0xe6e0cf : 0xb6b5ae, ...(road ? { map: road } : {}) }), -4),
    ditch: std({ color: ditch ? 0xe2dcc8 : 0xa4a29a, ...(ditch ? { map: ditch } : {}), side: THREE.DoubleSide }),
    name: offsetMat(std({ color: 0xffffff, transparent: true, depthWrite: false, ...(name ? { map: name } : {}) }), -6),
    wire: new THREE.LineBasicMaterial({ color: 0x23262a }),
  };
  kit.road.name = 'jalanBetonUkm';
  kit.ditch.name = 'paritBetonUkm';
  kit.name.name = 'markaNamaJalanUkm';
  return kit;
}

const kitOf = () => currentScope().get('ukm:roadside', roadsideKit);

const mesh = (geo, mat, name, { cast = false } = {}) => {
  const m = new THREE.Mesh(geo, mat);
  m.name = name;
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
};

function roadSurfaceMesh(heightAt, kit) {
  const geos = ROAD_SURFACES.map((line) => ribbonGeometry(line, { width: ROAD_SPEC.width, heightAt, lift: 0.06, step: 2, cols: 2, vScale: 1 / ROAD_SPEC.jointLength }));
  return mesh(mergeGeometries(geos, false), kit.road, 'jalan-beton');
}

function roadNameMesh(heightAt, kit) {
  const geos = ROAD_LAYOUT.decals.map((d) => {
    const half = d.along / 2;
    // garis dari selatan ke utara-terbalik: t = −a agar normal kanan-polylineOffset = kanan pembaca; v turun sepanjang t
    const line = [[d.x + d.ax * half, d.z + d.az * half], [d.x - d.ax * half, d.z - d.az * half]];
    return ribbonGeometry(line, { width: d.across, heightAt, lift: 0.075, step: 1, cols: 2, vScale: -1 / d.along, vStart: 1 });
  });
  return mesh(mergeGeometries(geos, false), kit.name, 'marka-nama-jalan');
}

/** Parit + tutup pelat + tiang listrik beton dalam SATU mesh (material beton sama; tiang dibakar ke posisinya). */
function ditchMesh(heightAt, kit) {
  const pole = utilityPoleGeometry(ROAD_SPEC.pole);
  const poles = ROAD_LAYOUT.poles.map((p) => pole.clone().rotateY(p.rotY).translate(p.x, heightAt(p.x, p.z), p.z));
  pole.dispose();
  const geo = ditchGeometry(ROAD_LAYOUT.ditch, { ...ROAD_SPEC.ditch }, heightAt, ROAD_LAYOUT.caps, 1.5, poles);
  return mesh(geo, kit.ditch, 'parit-beton-u');
}

function wireObjects(heightAt, kit) {
  const wires = new THREE.LineSegments(wireGeometry(ROAD_LAYOUT.poles, ROAD_SPEC.pole.height, heightAt), kit.wire);
  wires.name = 'kabel-listrik';
  wires.frustumCulled = false;
  return wires;
}

/** PJU kampus (LampPost 9 m): instans, lengan menghadap jalan. */
export function ukmPjuPositions(heightAt) {
  return ROAD_LAYOUT.pju.map((p) => ({ x: p.x, y: heightAt(p.x, p.z), z: p.z, rotY: p.rotY }));
}

/** Kepala lampu (region-lokal + tinggi tanah) untuk registerLamps. */
export function ukmLampHeads(heightAt) {
  const reach = LAMP_POST.armLen - 0.1;
  return ROAD_LAYOUT.pju.map((p) => {
    const h = pjuHead(p, reach);
    return { x: h.x, z: h.z, y: heightAt(h.x, h.z) };
  });
}

/** @param {{heightAt:(lx:number, lz:number)=>number}} opts */
export function createUkmRoadsideBuilder({ heightAt }) {
  const kit = kitOf();
  return staged(JALAN_GROUP, [
    () => roadSurfaceMesh(heightAt, kit),
    () => roadNameMesh(heightAt, kit),
    () => ditchMesh(heightAt, kit),
    () => wireObjects(heightAt, kit),
    () => createLampPosts(ukmPjuPositions(heightAt)),
  ], null, { merge: false });
}
