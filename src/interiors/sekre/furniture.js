/**
 * Perabot sekre (katalog S07–S30 + kursi lipat, kertas, kabel). Placeholder prosedural berukuran PERSIS katalog;
 * statis → staticGroup (digabung per material oleh index.js), yang bergerak/diganti GLB → dynamicGroup.
 * Hidup: kipas (S14) berputar + menoleh, kertas di meja berkibar saat kipas menyala, dispenser (S13) mengisi gelas,
 * gitar (S19) berpindah ke tangan NPC, layar laptop (S17) emisif (dikendalikan lighting).
 * GLB final (GLB_ASET di data.js) dimuat ke container; gagal → placeholder tetap tampil.
 *
 * Satu model = satu berkas di perabot/ (alat bentuk bersama: perabot/bentuk.js). Menambah perabot: buat
 * perabot/<nama>.js yang mengekspor build<Nama>(m), impor di sini, lalu tempatkan di buildFurniture (statis atau container GLB).
 */
import * as THREE from 'three';
import { instantiateModel } from '../../world/assets/models.js';
import { loadPbr } from '../../world/textures/pbr.js';
import { TILE_M, tierForQuality } from '../../world/textures/pbrCore.js';
import { styleState } from '../../engine/styleState.js';
import { ASET, EKSTRA, GLB_ASET, GUITAR_HOLD } from './data.js';
import { makeCanvas, canvasTexture, tint } from './canvas.js';
import { drawKarpet } from './room.js';
import { PI, propRy, TMP_V, cyl, piece, placed } from './perabot/bentuk.js';
import { buildPiala } from './perabot/piala.js';
import { buildDispenser } from './perabot/dispenser.js';
import { buildKipas } from './perabot/kipas.js';
import { buildPrinter } from './perabot/printer.js';
import { buildLaptop } from './perabot/laptop.js';
import { buildGitar } from './perabot/gitar.js';
import { buildTas } from './perabot/tas.js';
import { buildMeja } from './perabot/meja.js';
import { buildKursi } from './perabot/kursi.js';
import { buildGelas } from './perabot/gelas.js';
import { buildSepatu } from './perabot/sepatu.js';
import { buildKarpet } from './perabot/karpet.js';
import { buildLemari } from './perabot/lemari.js';
import { buildOrdner } from './perabot/ordner.js';
import { buildKardus } from './perabot/kardus.js';
import { buildSpanduk } from './perabot/spanduk.js';
import { buildBenderaStand } from './perabot/benderaStand.js';
import { buildBantal } from './perabot/bantal.js';
import { buildStopkontak } from './perabot/stopkontak.js';
import { buildSaklar } from './perabot/saklar.js';
import { buildTL } from './perabot/lampuTL.js';
import { buildKabel } from './perabot/kabel.js';
import { buildJendela } from './perabot/jendela.js';
import { buildPintu } from './perabot/pintu.js';
import { buildPerlengkapanErc } from './perabot/perlengkapanErc.js';
import { buildSofaProyektor } from './perabot/sofaProyektor.js';
import { buildRuangBelakang } from './perabot/ruangBelakang.js';
import { buildKertas } from './perabot/kertas.js';
import { buildKursiUkir } from './perabot/kursiUkir.js';
import { buildRakSiku } from './perabot/rakSiku.js';
import { buildMejaDetail } from './perabot/mejaDetail.js';
import { buildPermadani, buildJasHujan } from './perabot/permadaniJas.js';

/**
 * Bahan perabot bertekstur (ambientCG CC0, public/textures): warna tetap dari warna verteks model, tekstur memberi serat/tenun/
 * kekasaran. Albedo dinormalkan ke warna rata-ratanya (color = 1/avg) sehingga warna verteks tidak ikut menggelap.
 * Besi cat: hanya normal + roughness (albedo bubuk hitam tidak dipakai). Harus dibuat di dalam withScope interior.
 */
const BAHAN = Object.freeze({
  kayuHalus: { avg: '#b0733f', albedo: true, roughness: 1, normalScale: 0.6 },
  kain: { avg: '#bababa', albedo: true, roughness: 1, normalScale: 0.9 },
  plastik: { avg: '#7e7e7e', albedo: true, roughness: 1, normalScale: 0.4 },
  catBesi: { albedo: false, roughness: 1, metalness: 0.35, normalScale: 0.5 },
});

function bahanMaterial(name) {
  const cfg = BAHAN[name];
  const tier = tierForQuality(styleState.terrainQuality);
  const kinds = cfg.albedo ? ['albedo', 'normal', 'orm'] : ['normal', 'orm'];
  const set = loadPbr(name, { tier, anisotropy: 4, kinds });
  const r = 1 / TILE_M[name];
  for (const t of [set.map, set.normalMap, set.roughnessMap]) t?.repeat.set(r, r);
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: cfg.roughness, metalness: cfg.metalness ?? 0,
    normalMap: set.normalMap ?? null, roughnessMap: set.roughnessMap ?? null,
    normalScale: new THREE.Vector2(cfg.normalScale, cfg.normalScale),
  });
  if (cfg.albedo && set.map) {
    mat.map = set.map;
    const avg = new THREE.Color(cfg.avg); // linear
    mat.color.setRGB(1 / Math.max(0.05, avg.r), 1 / Math.max(0.05, avg.g), 1 / Math.max(0.05, avg.b));
  }
  mat.name = `sekre:${name}`;
  mat.userData.metricUv = true;
  return mat;
}

/** Material bersama interior (dibuat sekali per build; dilepas lewat disposeTree scene). */
export function createSekreMaterials(renderer = null) {
  const karpetCanvas = makeCanvas(768, 1024);
  drawKarpet(karpetCanvas.getContext('2d'), 768, 1024);
  return {
    prop: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78 }),
    metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.65 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xd8ecf2, roughness: 0.05, transparent: true, opacity: 0.22, depthWrite: false }),
    galon: new THREE.MeshStandardMaterial({ color: 0x8cc4ea, roughness: 0.15, transparent: true, opacity: 0.5, depthWrite: false }),
    water: new THREE.MeshStandardMaterial({ color: 0xcfe8ff, roughness: 0.05, transparent: true, opacity: 0.65, depthWrite: false }),
    tl: new THREE.MeshStandardMaterial({ color: 0xf6f8ff, emissive: 0xeef4ff, emissiveIntensity: 0.15, roughness: 0.3 }),
    screen: new THREE.MeshStandardMaterial({ name: 'unri:layar-emisif', color: 0x0b0f14, emissive: 0x9cc4ff, emissiveIntensity: 0, roughness: 0.25 }),
    paper: new THREE.MeshStandardMaterial({ color: 0xf7f5ee, roughness: 0.9, side: THREE.DoubleSide }),
    karpet: new THREE.MeshStandardMaterial({ map: canvasTexture(karpetCanvas, renderer), roughness: 1 }),
    kayuHalus: bahanMaterial('kayuHalus'),
    kain: bahanMaterial('kain'),
    plastik: bahanMaterial('plastik'),
    catBesi: bahanMaterial('catBesi'),
  };
}

/**
 * @param {{materials: ReturnType<typeof createSekreMaterials>}} opts
 */
export function buildFurniture({ materials }) {
  const m = materials;
  const staticGroup = new THREE.Group();
  staticGroup.name = 'sekre-perabot';
  const dynamicGroup = new THREE.Group();
  dynamicGroup.name = 'sekre-perabot-dinamis';
  /** id aset → container dinamis (placeholder + GLB). */
  const containers = new Map();
  const addContainer = (id, it, child, k) => {
    const c = new THREE.Group();
    c.name = `${id}-${k}`;
    placed(c, it);
    if (it.skala) c.scale.setScalar(it.skala);
    if (it.miring) c.rotation.set(it.miring, propRy(it.hadap), 0, 'YXZ');
    c.add(child);
    dynamicGroup.add(c);
    containers.set(id, [...(containers.get(id) ?? []), c]);
    return c;
  };

  // statis: posisi dari data.js
  staticGroup.add(placed(buildMeja(m), ASET.S16.items[0]));
  staticGroup.add(placed(buildKursi(m), EKSTRA.kursiLipat));
  for (const it of EKSTRA.kursiUkir) staticGroup.add(placed(buildKursiUkir(m), it));
  staticGroup.add(placed(buildPermadani(), EKSTRA.permadani));
  staticGroup.add(placed(buildJasHujan(m), EKSTRA.jasHujan));
  staticGroup.add(placed(buildRakSiku(m), EKSTRA.rakSiku));
  staticGroup.add(placed(buildMejaDetail(m), EKSTRA.mejaDetail));
  staticGroup.add(placed(buildLemari(m), ASET.S09.items[0]));
  staticGroup.add(buildOrdner(m));
  staticGroup.add(placed(buildBenderaStand(m), ASET.S08.items[0]));
  ASET.S11.items.forEach((it) => staticGroup.add(placed(buildKardus(m), it)));
  ASET.S12.items.forEach((it) => {
    const s = placed(buildSpanduk(m), it);
    s.rotation.set(it.miring, propRy(it.hadap), 0, 'YXZ');
    staticGroup.add(s);
  });
  ASET.S18.items.forEach((it) => staticGroup.add(placed(buildGelas(m, it.isi), it)));
  ASET.S21.items.forEach((it) => staticGroup.add(placed(buildSepatu(m, it.warna), it)));
  staticGroup.add(buildKarpet(m, ASET.S22.items[0]));
  ASET.S23.items.forEach((it) => staticGroup.add(placed(buildBantal(m, it.warna), it)));
  staticGroup.add(buildTL(m));
  staticGroup.add(placed(buildStopkontak(m), ASET.S25.items[0]));
  staticGroup.add(buildKabel(m));
  staticGroup.add(placed(buildSaklar(m), ASET.S27.items[0]));
  staticGroup.add(buildJendela(m));
  staticGroup.add(buildPintu(m));
  staticGroup.add(buildPerlengkapanErc(m));
  staticGroup.add(buildSofaProyektor(m));
  staticGroup.add(buildRuangBelakang(m));

  // dinamis / dapat diganti GLB
  ASET.S07.items.forEach((it, k) => addContainer('S07', it, buildPiala(m), k));
  const dispenser = addContainer('S13', ASET.S13.items[0], buildDispenser(m), 0);
  const kipas = buildKipas(m);
  addContainer('S14', ASET.S14.items[0], kipas.group, 0);
  addContainer('S15', ASET.S15.items[0], buildPrinter(m), 0);
  ASET.S17.items.forEach((it, k) => addContainer('S17', it, buildLaptop(m), k));
  const gitarRest = ASET.S19.items[0];
  const guitar = addContainer('S19', gitarRest, buildGitar(m), 0);
  ASET.S20.items.forEach((it, k) => addContainer('S20', it, buildTas(m, it.warna), k));
  const papers = EKSTRA.kertas.map((it, i) => buildKertas(m, it, i));
  for (const p of papers) dynamicGroup.add(p.pivot);

  // dispenser: gelas + kucuran air + isi (animasi E)
  const pour = { t: -1 };
  const cup = new THREE.Group();
  cup.name = 'gelas-dispenser';
  cup.position.set(0.05, 0.51, -0.2);
  cup.visible = false;
  cup.add(piece([cyl(0.035, 0.03, 0.09, '#f5f5f5', { y: 0.045 })], m.glass, 'gelas', false));
  const fill = new THREE.Mesh(tint(new THREE.CylinderGeometry(0.031, 0.027, 0.085, 12).translate(0, 0.0425, 0), '#ffffff'), m.water);
  fill.scale.y = 0.02;
  const stream = new THREE.Mesh(tint(new THREE.CylinderGeometry(0.004, 0.004, 0.06, 6).translate(0, 0.12, 0), '#ffffff'), m.water);
  stream.visible = false;
  cup.add(fill, stream);
  dispenser.add(cup);

  const fan = { on: false, spin: 0, phase: 0, head: kipas.head, blades: kipas.blades };
  let time = 0;

  const restGuitar = () => {
    dynamicGroup.add(guitar);
    guitar.position.set(gitarRest.x, gitarRest.y, gitarRest.z);
    guitar.rotation.set(gitarRest.miring, propRy(gitarRest.hadap), 0, 'YXZ');
  };
  const holdGuitar = (spine) => {
    spine.add(guitar);
    guitar.position.fromArray(GUITAR_HOLD.pos);
    guitar.rotation.set(GUITAR_HOLD.rot[0], GUITAR_HOLD.rot[1], GUITAR_HOLD.rot[2], 'XYZ');
  };

  function bindFanModel(model) {
    let head = null;
    let blades = null;
    model.traverse((o) => {
      if (o.material?.name === 'unri:kipas-kepala') head = o;
      if (o.material?.name === 'unri:kipas-baling') blades = o;
    });
    if (!head || !blades) return;
    blades.geometry.computeBoundingBox();
    const c = blades.geometry.boundingBox.getCenter(new THREE.Vector3());
    blades.geometry.translate(-c.x, -c.y, -c.z);
    blades.position.add(c);
    const pivot = new THREE.Group();
    pivot.name = 'kepala-glb';
    pivot.position.set(0, 1.05, 0);
    model.add(pivot);
    model.updateMatrixWorld(true);
    pivot.attach(head);
    pivot.attach(blades);
    fan.head = pivot;
    fan.blades = blades;
  }

  /** Muat GLB final ke container (harus dipanggil di dalam withScope interior). */
  async function loadModels(isCancelled = () => false) {
    const jobs = [];
    for (const [id, path] of Object.entries(GLB_ASET)) {
      for (const container of containers.get(id) ?? []) {
        jobs.push(instantiateModel(path).then((model) => {
          if (isCancelled()) return;
          container.add(model);
          const ph = container.getObjectByName(`${id}-ph`);
          if (ph) ph.visible = false;
          if (id === 'S14') bindFanModel(model);
          if (id === 'S17') model.traverse((o) => { if (o.material?.name === 'unri:layar-emisif') o.material = m.screen; });
        }));
      }
    }
    const results = await Promise.allSettled(jobs);
    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length && !isCancelled()) console.warn(`Sekre: ${failed.length} model GLB gagal dimuat, placeholder prosedural dipakai.`, failed[0].reason);
    return { failed: failed.length };
  }

  return {
    staticGroup,
    dynamicGroup,
    containers,
    props: {
      /** Gelas untuk tangan NPC (pose drinkCup). */
      makeCup: () => piece([cyl(0.035, 0.03, 0.09, '#ffffff', { y: -0.045 }), cyl(0.032, 0.032, 0.004, '#5d4037', { y: -0.01 })], m.prop, 'gelas-npc', false),
      /** Spidol untuk tangan NPC (pose writeBoard). */
      makeMarker: () => piece([cyl(0.008, 0.008, 0.12, '#1565c0', { rx: PI / 2 }), cyl(0.009, 0.009, 0.03, '#111111', { z: 0.06, rx: PI / 2 })], m.prop, 'spidol-npc', false),
      holdGuitar,
      restGuitar,
    },
    get fanOn() { return fan.on; },
    toggleFan() {
      fan.on = !fan.on;
      return fan.on;
    },
    /** Mulai animasi isi gelas (≈1,6 s); false bila sedang mengisi. */
    pourWater() {
      if (pour.t >= 0) return false;
      pour.t = 0;
      cup.visible = true;
      fill.scale.y = 0.02;
      return true;
    },
    /** Posisi dunia badan gitar (mengikuti tangan NPC saat dimainkan). */
    guitarWorldPosition(out) {
      guitar.getWorldPosition(TMP_V);
      out.x = TMP_V.x;
      out.y = TMP_V.y + 0.4;
      out.z = TMP_V.z;
      return out;
    },
    update(dt) {
      const d = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
      time += d;
      fan.spin += ((fan.on ? 1 : 0) - fan.spin) * Math.min(1, d * (fan.on ? 0.8 : 0.4));
      if (fan.blades) fan.blades.rotation.z -= fan.spin * 26 * d;
      if (fan.on) fan.phase += d;
      if (fan.head) fan.head.rotation.y = 0.6 * Math.sin(fan.phase * 1.6);
      for (const p of papers) {
        const reach = Math.max(0.15, Math.min(1, 1.2 - p.dist / 4));
        p.pivot.rotation.x = -fan.spin * reach * (0.05 + 0.18 * (0.5 + 0.5 * Math.sin(time * 11 + p.phase)));
      }
      if (pour.t >= 0) {
        pour.t += d;
        stream.visible = pour.t < 1.6;
        fill.scale.y = Math.max(0.02, Math.min(1, pour.t / 1.6)) * 0.85;
        if (pour.t >= 1.6) pour.t = -1;
      }
    },
    loadModels,
    dispose() { restGuitar(); },
  };
}
