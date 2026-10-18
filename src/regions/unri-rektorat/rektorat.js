// src/regions/unri-rektorat/rektorat.js
/**
 * Gedung Rektorat Universitas Riau (OSM way 282225347) — hero region H04. Rujukan [T]: foto drone 2016
 * Commons "Taman_Unri.jpg" (CC BY-SA 4.0): putih, ±5 lantai, simetris; blok tengah menonjol berkaca biru
 * vertikal dengan huruf nama di puncak; sayap kiri/kanan dengan pita sunshade horizontal berulang; atap
 * datar dengan parapet gelap; kanopi beratap merah di depan (bentuk selembayung TIDAK terkonfirmasi →
 * limas merah sederhana di 4 tiang, N03). Palem & tiang bendera ada di porosTaman.js.
 * [INFERENSI]: tinggi lantai (4,2 + 4 × 3,6 m), podium 0,9 m + 4 anak tangga, 5 bilah kaca, teks huruf
 * puncak "UNIVERSITAS RIAU" & warnanya, papan nama granit, ruang mesin & tandon atap, fasad belakang = sayap.
 * Region-lokal; massa diangkat ke tanah pad (env.hAt(0, 0)); permukaan depan di-drape terpisah.
 */
import * as THREE from 'three';
import { MATS, BAY } from './materials.js';
import { REKTORAT_MASSA } from './site.data.js';
import { LAYOUT } from './layout.js';
import { drapePolygonLocal } from './env.js';
import { reliefTextParts } from '../../world/kit/hero/reliefText.js';
import { makeTextMaterial } from '../../world/siteutil/textCanvas.js';

export const LEVEL = Object.freeze({ podium: 0.9, l1: 4.2, atas: 3.6, jumlah: 5, parapet: 1.1, atik: 3.0 });
/** y lantai ke-k (0 = lantai dasar di atas podium) relatif tanah pad. */
export const floorY = (k) => (k === 0 ? LEVEL.podium : LEVEL.podium + LEVEL.l1 + (k - 1) * LEVEL.atas);
/** Atas pelat atap (19,5 m). */
export const ROOF_Y = floorY(LEVEL.jumlah);
const BAND = 0.9;   // spandrel putih di bawah pita jendela
const INSET = 0.25; // pita kaca masuk dari muka fasad
const SHADE = 0.9;  // tonjolan sunshade
const winH = (k) => (k === 0 ? 2.6 : 2.1);
const { slab: S, tengah: T, kanopi: K } = REKTORAT_MASSA;

/** Kotak [x0,x1]×[y0,y1]×[z0,z1] sebagai Mesh di `group`. */
export function addBox(group, mat, [x0, x1], [y0, y1], [z0, z1], { cast = true, name = 'rektorat' } = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat);
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  m.castShadow = cast;
  m.receiveShadow = true;
  m.name = name;
  group.add(m);
  return m;
}

/** Bidang tegak menghadap +X (sx 1) / −X (sx −1) di x; `uOffset` → UV per bay (peta lampu malam). */
function addPlaneX(group, mat, x, sx, [z0, z1], [y0, y1], { name = 'rektorat', uOffset = null } = {}) {
  const len = z1 - z0;
  const g = new THREE.PlaneGeometry(len, y1 - y0);
  if (uOffset !== null) {
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i += 1) uv.setX(i, (uv.getX(i) * len) / BAY / 16 + uOffset);
  }
  const m = new THREE.Mesh(g, mat);
  m.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
  m.position.set(x, (y0 + y1) / 2, (z0 + z1) / 2);
  m.receiveShadow = true;
  m.name = name;
  group.add(m);
  return m;
}

/** Bidang tegak menghadap +Z (sz 1) / −Z (sz −1) di z. */
function addPlaneZ(group, mat, z, sz, [x0, x1], [y0, y1], name = 'rektorat') {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), mat);
  m.rotation.y = sz > 0 ? 0 : Math.PI;
  m.position.set((x0 + x1) / 2, (y0 + y1) / 2, z);
  m.receiveShadow = true;
  m.name = name;
  group.add(m);
  return m;
}

/** Mullion putih tipis tiap bay di pita jendela. */
function mullions(group, xb, sx, [z0, z1], ys) {
  const xs = sx > 0 ? [xb, xb + 0.22] : [xb - 0.22, xb];
  for (let z = z0 + BAY; z < z1 - 0.2; z += BAY) addBox(group, MATS.dinding(), xs, ys, [z - 0.06, z + 0.06], { cast: false, name: 'rektoratMullion' });
}

/** Fasad timur (dua sayap) & barat (penuh): per lantai spandrel, pita kaca masuk 0,25 m, dinding atas, sunshade. */
function wingFacades(group) {
  const sides = [
    { sx: 1, segs: [[S.z0, T.z0], [T.z1, S.z1]] },
    { sx: -1, segs: [[S.z0, S.z1]] },
  ];
  for (let k = 0; k < LEVEL.jumlah; k += 1) {
    const yF = floorY(k);
    const yW0 = yF + BAND;
    const yW1 = yW0 + winH(k);
    const yN = floorY(k + 1);
    for (const { sx, segs } of sides) {
      const xf = sx * S.x1;
      const xb = sx * (S.x1 - INSET);
      const wall = [Math.min(xb, xf), Math.max(xb, xf)];
      const shade = sx > 0 ? [S.x1, S.x1 + SHADE] : [-S.x1 - SHADE, -S.x1];
      for (const zr of segs) {
        addBox(group, MATS.dinding(), wall, [yF, yW0], zr);
        addPlaneX(group, MATS.kacaPita(), xb + sx * 0.01, sx, zr, [yW0, yW1], { name: 'rektoratPita', uOffset: k * 0.37 + (sx > 0 ? 0 : 0.5) });
        addBox(group, MATS.dinding(), wall, [yW1, yN], zr);
        addBox(group, MATS.dinding(), shade, [yW1, yW1 + 0.15], zr, { name: 'rektoratSunshade' });
        mullions(group, xb, sx, zr, [yW0, yW1]);
      }
    }
  }
}

/** Badan slab, plint granit, fasad ujung (jendela tangga + list), atap datar, parapet gelap, mesin & tandon. */
function slabBody(group) {
  addBox(group, MATS.dinding(), [S.x0 + INSET, S.x1 - INSET], [0, ROOF_Y], [S.z0, S.z1]);
  addBox(group, MATS.granit(), [S.x0 - 0.1, S.x1 + 0.1], [0, LEVEL.podium], [S.z0 - 0.1, S.z1 + 0.1]);
  for (const [z, sz] of [[S.z0, -1], [S.z1, 1]]) {
    addPlaneZ(group, MATS.kacaPita(), z + sz * 0.01, sz, [-1.0, 1.0], [floorY(1), ROOF_Y - 0.8], 'rektoratJendelaTangga');
    for (let k = 0; k < LEVEL.jumlah; k += 1) {
      const y = floorY(k) + BAND + winH(k);
      addBox(group, MATS.dinding(), [S.x0, S.x1], [y, y + 0.15], sz < 0 ? [z - 0.2, z] : [z, z + 0.2], { name: 'rektoratList' });
    }
  }
  addBox(group, MATS.atap(), [S.x0 + 0.25, S.x1 - 0.25], [ROOF_Y, ROOF_Y + 0.06], [S.z0 + 0.25, S.z1 - 0.25], { cast: false, name: 'rektoratAtap' });
  const pY = [ROOF_Y, ROOF_Y + LEVEL.parapet];
  addBox(group, MATS.parapet(), [S.x0, S.x0 + 0.25], pY, [S.z0, S.z1]);
  addBox(group, MATS.parapet(), [S.x0, S.x1], pY, [S.z0, S.z0 + 0.25]);
  addBox(group, MATS.parapet(), [S.x0, S.x1], pY, [S.z1 - 0.25, S.z1]);
  addBox(group, MATS.parapet(), [S.x1 - 0.25, S.x1], pY, [S.z0, T.z0]);
  addBox(group, MATS.parapet(), [S.x1 - 0.25, S.x1], pY, [T.z1, S.z1]);
  addBox(group, MATS.mesin(), [-7, -1], [ROOF_Y, ROOF_Y + 3], [-20, -15]);
  addBox(group, MATS.mesin(), [-7, -1], [ROOF_Y, ROOF_Y + 3], [15, 20]);
  for (const z of [-21, 21]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.2, 16), MATS.tandon());
    t.position.set(4, ROOF_Y + 1.1, z);
    t.castShadow = true;
    t.name = 'rektoratTandon';
    group.add(t);
  }
}

/** Blok tengah: 6 sirip putih + 5 bilah kaca biru vertikal (lt 2–5), lobi kaca hangat lt 1, atik puncak. */
function centralBlock(group) {
  const xg = T.x1 - 0.3; // muka kaca, masuk 0,3 m dari muka sirip
  const y0 = floorY(1);
  addBox(group, MATS.dinding(), [T.x0 - 0.3, xg], [0, ROOF_Y], [T.z0, T.z1]);
  addBox(group, MATS.granit(), [T.x0, T.x1 + 0.1], [0, LEVEL.podium], [T.z0 - 0.1, T.z1 + 0.1]);
  const fins = 6;
  const finW = 0.6;
  const pane = (T.z1 - T.z0 - fins * finW) / (fins - 1);
  for (let i = 0; i < fins; i += 1) {
    const zc = T.z0 + finW / 2 + i * (finW + pane);
    addBox(group, MATS.dinding(), [xg, T.x1 + 0.4], [y0 - 0.3, ROOF_Y], [zc - finW / 2, zc + finW / 2], { name: 'rektoratSirip' });
  }
  for (let i = 0; i < fins - 1; i += 1) {
    const z0 = T.z0 + finW + i * (finW + pane);
    addPlaneX(group, MATS.kacaBiru(), xg + 0.01, 1, [z0, z0 + pane], [y0, ROOF_Y - 0.15], { name: 'rektoratKacaBiru' });
    for (let k = 2; k <= LEVEL.jumlah - 1; k += 1) addBox(group, MATS.dinding(), [xg, xg + 0.12], [floorY(k) - 0.08, floorY(k) + 0.08], [z0, z0 + pane], { cast: false, name: 'rektoratTransom' });
  }
  for (const [z, sz] of [[T.z0, -1], [T.z1, 1]]) addPlaneZ(group, MATS.kacaBiru(), z + sz * 0.01, sz, [13.4, 15.4], [y0, ROOF_Y - 0.15], 'rektoratKacaSamping');
  addPlaneX(group, MATS.lobi(), xg + 0.01, 1, [-7.2, 7.2], [LEVEL.podium, y0 - 0.4], { name: 'rektoratLobi' });
  for (const z of [-7.2, -3.6, 0, 3.6, 7.2]) addBox(group, MATS.parapet(), [xg, xg + 0.1], [LEVEL.podium, y0 - 0.4], [z - 0.06, z + 0.06], { cast: false, name: 'rektoratKusen' });
  addBox(group, MATS.dinding(), [xg, T.x1], [y0 - 0.4, y0 - 0.3], [T.z0, T.z1]);
  addBox(group, MATS.dinding(), [T.x0 - 0.3, T.x1 + 0.3], [ROOF_Y, ROOF_Y + LEVEL.atik], [T.z0 - 0.3, T.z1 + 0.3], { name: 'rektoratAtik' });
  addBox(group, MATS.parapet(), [T.x0 - 0.35, T.x1 + 0.35], [ROOF_Y + LEVEL.atik, ROOF_Y + LEVEL.atik + 0.2], [T.z0 - 0.35, T.z1 + 0.35]);
}

/** Teras lobi granit 0,9 m + 4 anak tangga 0,18 × 0,35 m ke drop-off. */
function terasTangga(group) {
  const t = LAYOUT.teras;
  const xTop = t.x1 - 4 * 0.35;
  addBox(group, MATS.granit(), [t.x0, xTop], [0, LEVEL.podium], [t.z0, t.z1], { name: 'rektoratTeras' });
  for (let i = 0; i < 4; i += 1) {
    addBox(group, MATS.tangga(), [xTop + i * 0.35, xTop + (i + 1) * 0.35], [0, LEVEL.podium - (i + 1) * 0.18], [t.z0, t.z1], { name: 'rektoratTangga' });
  }
}

/** Papan nama granit hitam (N05 gaya) di taman depan, menghadap timur. */
function papanNama() {
  const p = LAYOUT.papanNama;
  const g = new THREE.Group();
  g.name = 'rektoratPapanNama';
  g.position.set(p.x, 0, p.z);
  addBox(g, MATS.granit(), [-0.3, 0.3], [0, 0.6], [-p.w / 2 - 0.2, p.w / 2 + 0.2]);
  addBox(g, MATS.parapet(), [-0.08, 0.08], [0.6, 0.6 + p.h], [-p.w / 2, p.w / 2]);
  const text = new THREE.Mesh(
    new THREE.PlaneGeometry(p.w - 0.3, p.h - 0.25),
    makeTextMaterial('REKTORAT UNIVERSITAS RIAU', { bg: '#1c1f24', fg: '#f2f2f2', width: 1024, height: 192, font: 'bold 110px sans-serif', padding: 32 }),
  );
  text.rotation.y = Math.PI / 2;
  text.position.set(0.09, 0.6 + p.h / 2, 0);
  text.name = 'rektoratPapanNamaTeks';
  g.add(text);
  return g;
}

/** N02 placeholder: huruf timbul "UNIVERSITAS RIAU" 17 × 1,5 m di muka atik, menghadap timur, menyala malam. */
function hurufPuncak() {
  const g = new THREE.Group();
  g.name = 'N02';
  for (const p of reliefTextParts({ key: 'rektorat:N02', text: 'UNIVERSITAS RIAU', width: 17.0, height: 1.5, color: '#d9b75a', shade: '#6b5a2a', nightGlow: 1.3 })) {
    const m = new THREE.Mesh(p.geometry, p.material);
    m.applyMatrix4(p.matrix);
    m.name = p.name;
    g.add(m);
  }
  g.rotation.y = -Math.PI / 2; // −Z ruang-teks → +X (timur)
  g.position.set(T.x1 + 0.3 + 0.07, ROOF_Y + LEVEL.atik / 2, 0);
  return g;
}

/** N03 placeholder: kanopi limas merah di 4 tiang putih di atas drop-off (tonjolan depan OSM 8,6 × 8,3). */
function kanopiMerah() {
  const g = new THREE.Group();
  g.name = 'N03';
  const eave = 3.3;
  const fascia = 0.45;
  const xc = (K.x0 + K.x1) / 2;
  const zc = (K.z0 + K.z1) / 2;
  const w = K.x1 - K.x0 + 1.0;
  const d = K.z1 - K.z0 + 1.0;
  const [x0, x1, z0, z1] = [xc - w / 2, xc + w / 2, zc - d / 2, zc + d / 2];
  for (const p of LAYOUT.kanopiTiang) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, eave, 12), MATS.dinding());
    post.position.set(p.x, eave / 2, p.z);
    post.castShadow = true;
    post.name = 'N03tiang';
    g.add(post);
  }
  addBox(g, MATS.dinding(), [x0, x1], [eave, eave + fascia], [z0, z0 + 0.25], { name: 'N03lisplang' });
  addBox(g, MATS.dinding(), [x0, x1], [eave, eave + fascia], [z1 - 0.25, z1], { name: 'N03lisplang' });
  addBox(g, MATS.dinding(), [x0, x0 + 0.25], [eave, eave + fascia], [z0, z1], { name: 'N03lisplang' });
  addBox(g, MATS.dinding(), [x1 - 0.25, x1], [eave, eave + fascia], [z0, z1], { name: 'N03lisplang' });
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.5, d - 0.5).rotateX(Math.PI / 2), MATS.plafon());
  ceiling.position.set(xc, eave + 0.02, zc);
  ceiling.name = 'N03plafon';
  g.add(ceiling);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0), MATS.merah());
  roof.scale.set(w + 0.6, 1.6, d + 0.6);
  roof.position.set(xc, eave + fascia, zc);
  roof.castShadow = true;
  roof.name = 'N03atap';
  g.add(roof);
  return g;
}

/**
 * Massa Rektorat. raw = statis (digabung per material oleh index.js); placeholders = N02 & N03 (tidak
 * digabung agar GLB final dapat menyembunyikannya lewat `replaces`).
 * @returns {{raw: THREE.Group, placeholders: THREE.Group}}
 */
export function buildRektorat(env) {
  const y0 = env.hAt(0, 0);
  const raw = new THREE.Group();
  raw.name = 'rektorat';
  raw.position.y = y0;
  slabBody(raw);
  wingFacades(raw);
  centralBlock(raw);
  terasTangga(raw);
  raw.add(papanNama());
  const placeholders = new THREE.Group();
  placeholders.name = 'rektoratPlaceholder';
  placeholders.position.y = y0;
  placeholders.add(hurufPuncak(), kanopiMerah());
  return { raw, placeholders };
}

/** Permukaan depan (drape, tinggi dunia): paving entrance & jalur fasad, rumput taman depan & pulau parkir. */
export function buildRektoratGround(env) {
  const g = new THREE.Group();
  g.name = 'rektoratPermukaan';
  const add = (geo, mat, name) => {
    const m = new THREE.Mesh(geo, mat);
    m.name = name;
    m.receiveShadow = true;
    g.add(m);
  };
  add(drapePolygonLocal(env, LAYOUT.plazaDepan, { lift: 0.06, maxEdge: 2 }), MATS.paving(), 'plazaPaving');
  add(drapePolygonLocal(env, LAYOUT.jalurFasad, { lift: 0.06, maxEdge: 2 }), MATS.paving(), 'plazaPaving');
  for (const r of LAYOUT.rumputDepan) add(drapePolygonLocal(env, r, { lift: 0.04, maxEdge: 2 }), MATS.rumput(), 'rumput');
  add(drapePolygonLocal(env, LAYOUT.pulauParkir, { lift: 0.08, maxEdge: 2 }), MATS.rumput(), 'rumput');
  return g;
}
