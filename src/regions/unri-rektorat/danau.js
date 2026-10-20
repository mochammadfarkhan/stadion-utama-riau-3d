// src/regions/unri-rektorat/danau.js
/**
 * Danau Buatan Universitas Riau (OSM way 373856980). Air digambar distrik (src/districts/unri/water.js, M2);
 * region menambah P11 batu pijakan beton menyeberangi danau [T foto 2016; lintasan INFERENSI], trotoar
 * beton tinggi sisi danau [T foto 2016], dan N01 papan batu lengkung "UNIVERSITAS RIAU" [T] (placeholder
 * prosedural; GLB final menggantikan lewat replaces 'N01'), serta titian beton di atas gorong-gorong keluaran
 * danau (OSM way 783152923 footway bridge=yes; M2 sengaja tidak men-drape-nya) [T posisi; bentuk INFERENSI].
 */
import * as THREE from 'three';
import { createRng } from '../../world/util/random.js';
import { reliefTextMaterial } from '../../world/kit/hero/reliefText.js';
import { DANAU_RING, TITIAN } from './site.data.js';
import { LAYOUT } from './layout.js';
import { MATS } from './materials.js';
import { drapePolylineLocal, kerbWall } from './env.js';
import { addBox } from './rektorat.js';
import { dermaga } from './dermaga.js';

export const DANAU = Object.freeze({
  batu: 0.8,        // sisi batu pijakan (m)
  timbul: 0.12,     // puncak batu di atas muka air
  offsetMuka: 0.4,  // muka air = tanah terendah di tepi − 0,4 m (spec §5.2 butir 8; = tools/campusbake/ground/waterLevel.js M2); kenop setel bila beda
  trotoar: Object.freeze({ lebar: 2.0, tinggi: 0.25 }),
  papan: Object.freeze({ R: 7, tebal: 0.5, huruf: 'UNIVERSITAS RIAU' }),
});

/** Muka air (y): tanah terendah di titik tepi ring − offsetMuka. */
export function waterLevel(env, ring = DANAU_RING) {
  return Math.min(...ring.map(([x, z]) => env.hAt(x, z))) - DANAU.offsetMuka;
}

function batuPijakan(group, env) {
  const top = waterLevel(env) + DANAU.timbul;
  const rnd = createRng(373856980);
  for (const s of LAYOUT.batuPijakan) {
    const bottom = Math.min(env.hAt(s.x, s.z) - 0.2, top - 0.3);
    const m = new THREE.Mesh(new THREE.BoxGeometry(DANAU.batu, top - bottom, DANAU.batu), MATS.beton());
    m.position.set(s.x, (top + bottom) / 2, s.z);
    m.rotation.y = (rnd() - 0.5) * 0.5;
    m.castShadow = true;
    m.receiveShadow = true;
    m.name = 'batuPijakan';
    group.add(m);
  }
}

function trotoarDanau(group, env) {
  const { lebar, tinggi } = DANAU.trotoar;
  const pts = LAYOUT.trotoarDanau;
  const top = new THREE.Mesh(drapePolylineLocal(env, pts, lebar, { lift: tinggi, segment: 2 }), MATS.trotoar());
  top.name = 'trotoar';
  top.receiveShadow = true;
  group.add(top);
  for (const off of [lebar / 2, -lebar / 2]) {
    const wall = new THREE.Mesh(kerbWall(env, pts, off, tinggi), MATS.betonDS());
    wall.name = 'kerb';
    wall.receiveShadow = true;
    group.add(wall);
  }
}

/**
 * Denah papan (lokal papan: X sepanjang papan, −Z = depan) di bidang bentuk XY; y bentuk = −z denah karena
 * ExtrudeGeometry diputar rotateX(−π/2). Busur cekung ke depan (pusat (0, −R)), tebal ke belakang.
 */
function papanShape(w, R, t) {
  const half = Math.asin(w / 2 / R);
  const n = 24;
  const shape = new THREE.Shape();
  for (let i = 0; i <= n; i += 1) {
    const a = -half + (2 * half * i) / n;
    const x = R * Math.sin(a);
    const y = R - R * Math.cos(a);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  for (let i = n; i >= 0; i -= 1) {
    const a = -half + (2 * half * i) / n;
    shape.lineTo((R + t) * Math.sin(a), R - (R + t) * Math.cos(a));
  }
  shape.closePath();
  return shape;
}

/** N01 placeholder: papan batu lengkung + alas beton + huruf kuningan melengkung. */
function papanBatu(env) {
  const p = LAYOUT.papanBatu;
  const { R, tebal, huruf } = DANAU.papan;
  const g = new THREE.Group();
  g.name = 'N01';
  g.position.set(p.x, env.hAt(p.x, p.z), p.z);
  g.rotation.y = p.yaw;
  const alas = new THREE.Mesh(new THREE.BoxGeometry(p.w + 0.4, 0.2, 1.4), MATS.beton());
  alas.position.set(0, 0.1, -0.05);
  alas.receiveShadow = true;
  alas.name = 'N01alas';
  const body = new THREE.Mesh(
    new THREE.ExtrudeGeometry(papanShape(p.w, R, tebal), { depth: p.h - 0.2, bevelEnabled: false, curveSegments: 1 }).rotateX(-Math.PI / 2),
    MATS.batu(),
  );
  body.position.y = 0.2;
  body.castShadow = true;
  body.receiveShadow = true;
  body.name = 'N01batu';
  const strip = new THREE.PlaneGeometry(4.9, 0.42, 32, 1).rotateY(Math.PI);
  const pos = strip.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const a = pos.getX(i) / R;
    pos.setX(i, R * Math.sin(a));
    pos.setZ(i, -R + R * Math.cos(a) - 0.03);
  }
  strip.computeVertexNormals();
  const letters = new THREE.Mesh(strip, reliefTextMaterial('unri-rektorat:N01', huruf, { color: '#c9a24a' }));
  letters.position.y = 1.05;
  letters.name = 'N01huruf';
  g.add(alas, body, letters);
  return g;
}

/** Titian: lantai beton 2 m sepanjang way OSM + sandaran & tiang besi + kepala jembatan di kedua ujung. */
function titian(group, env) {
  const [[ax, az], [bx, bz]] = TITIAN;
  const len = Math.hypot(bx - ax, bz - az);
  const top = Math.max(env.hAt(ax, az), env.hAt(bx, bz)) + 0.35;
  const g = new THREE.Group();
  g.name = 'titianDanau';
  g.position.set((ax + bx) / 2, 0, (az + bz) / 2);
  g.rotation.y = Math.atan2(bx - ax, bz - az); // sumbu panjang titian = +Z lokal
  addBox(g, MATS.beton(), [-1.0, 1.0], [top - 0.3, top], [-len / 2 - 0.5, len / 2 + 0.5], { name: 'titianLantai' });
  for (const sx of [-1, 1]) {
    addBox(g, MATS.parapet(), [sx * 0.95 - 0.04, sx * 0.95 + 0.04], [top + 0.95, top + 1.0], [-len / 2, len / 2], { cast: false, name: 'titianSandaran' });
    for (let z = -len / 2; z <= len / 2 + 1e-6; z += 1.5) {
      addBox(g, MATS.parapet(), [sx * 0.95 - 0.03, sx * 0.95 + 0.03], [top, top + 0.95], [z - 0.03, z + 0.03], { cast: false, name: 'titianTiang' });
    }
  }
  for (const z of [-len / 2, len / 2]) addBox(g, MATS.beton(), [-1.1, 1.1], [top - 2.0, top - 0.3], [z - 0.3, z + 0.3], { name: 'titianKepala' });
  group.add(g);
}

/** Dermaga kayu (M8 P2): geladak sedikit di atas muka air, tiang sampai dasar; papan+tiang `unri:kayu`, tali terpisah. */
function dermagaKayu(group, env) {
  const cfg = LAYOUT.dermaga;
  const deckY = Math.max(waterLevel(env) + 0.5, env.hAt(cfg.start[0], cfg.start[1]) + 0.1);
  const d = dermaga({ ...cfg, deckY, bedY: waterLevel(env) - 1.5 });
  for (const b of d.boxes) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(b.sx, b.sy, b.sz), b.kind === 'tali' ? MATS.tali() : MATS.kayu());
    m.position.set(b.x, b.y, b.z);
    m.rotation.y = b.yaw;
    m.castShadow = b.kind !== 'tali';
    m.receiveShadow = true;
    m.name = b.kind === 'tali' ? 'dermagaTali' : 'dermagaKayu';
    group.add(m);
  }
}

/** @returns {{raw: THREE.Group, placeholders: THREE.Group}} */
export function buildDanau(env) {
  const raw = new THREE.Group();
  raw.name = 'danauRektorat';
  batuPijakan(raw, env);
  trotoarDanau(raw, env);
  titian(raw, env);
  dermagaKayu(raw, env);
  const placeholders = new THREE.Group();
  placeholders.name = 'danauPlaceholder';
  placeholders.add(papanBatu(env));
  return { raw, placeholders };
}
