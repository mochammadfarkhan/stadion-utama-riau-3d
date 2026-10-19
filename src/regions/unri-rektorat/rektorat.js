// src/regions/unri-rektorat/rektorat.js
/**
 * Gedung Rektorat Universitas Riau (OSM way 282225347) — hero region H04. Rujukan [T]: foto drone 2016
 * Commons "Taman_Unri.jpg" (CC BY-SA 4.0): putih, ±5 lantai, simetris; blok tengah menonjol berkaca biru
 * vertikal dengan huruf nama di puncak; sayap kiri/kanan dengan pita sunshade horizontal berulang; atap
 * datar dengan parapet gelap. Street View Jan 2025 [T, docs/research §8b] mengoreksi kanopi: atap datar
 * BIRU berlisplang bertulis "REKTORAT" di atas tiang bulat biru-abu, dengan SELEMBAYUNG emas (gable
 * segitiga berukir, tanduk bersilang di puncak) di atas kanopi (N03); halaman depan: kerb kuning-hitam,
 * pagar tanaman, lampu taman hitam berlentera. Palem & tiang bendera ada di porosTaman.js.
 * [INFERENSI]: tinggi lantai (4,2 + 4 × 3,6 m), podium 0,9 m + 4 anak tangga, 5 bilah kaca, ukuran & motif
 * selembayung (pola rebung/belah ketupat disederhanakan), teks huruf
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

const SELEMBAYUNG = Object.freeze({ lebar: 7.0, tinggi: 5.0, papan: 0.34, tebal: 0.3 });
const KANOPI = Object.freeze({ eave: 3.3, slab: 0.8 });

/** Batang emas dari a ke b di bidang XY lokal (tebal `t`, dalam `d` ke arah Z). */
function batang(g, mat, [ax, ay], [bx, by], t, d, name) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(bx - ax, by - ay), t, d), mat);
  m.position.set((ax + bx) / 2, (ay + by) / 2, 0);
  m.rotation.z = Math.atan2(by - ay, bx - ax);
  m.castShadow = true;
  m.name = name;
  g.add(m);
  return m;
}

/** Segitiga datar [(x0,y0),(x1,y0),(0,yApex)] diekstrusi `depth` ke +Z. */
function segitiga(w, h, depth) {
  const sh = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h)]);
  return new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false });
}

/**
 * Selembayung emas [T Street View 2025; motif INFERENSI]: dua papan layar miring, dua garis dalam, latar
 * gelap, deret pucuk rebung di dasar, belah ketupat berukir, tulang tengah, dan tanduk bersilang di puncak.
 * Bidang gable menghadap +Z lokal (diputar ke +X dunia oleh pemanggil).
 */
function selembayung() {
  const { lebar: W, tinggi: H, papan, tebal } = SELEMBAYUNG;
  const half = W / 2;
  const emas = MATS.emas();
  const gelap = MATS.emasGelap();
  const g = new THREE.Group();
  g.name = 'N03selembayung';
  const back = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-half, 0), new THREE.Vector2(half, 0), new THREE.Vector2(0, H)])), gelap);
  back.position.z = -0.02;
  back.name = 'N03selembayungLatar';
  g.add(back);
  batang(g, emas, [-half, 0], [0, H], papan, tebal, 'N03papanLayar');
  batang(g, emas, [half, 0], [0, H], papan, tebal, 'N03papanLayar');
  batang(g, emas, [-half, 0], [half, 0], 0.26, tebal, 'N03papanDasar');
  for (const [d, yb] of [[0.75, 0.5], [1.35, 0.9]]) {
    const hw = half * (1 - yb / H) - d;
    const apex = H - (d * H) / half;
    batang(g, emas, [-hw, yb], [0, apex], 0.1, 0.12, 'N03garisDalam');
    batang(g, emas, [hw, yb], [0, apex], 0.1, 0.12, 'N03garisDalam');
    batang(g, emas, [-hw, yb], [hw, yb], 0.1, 0.12, 'N03garisDalam');
  }
  batang(g, emas, [0, 0.5], [0, H - 0.3], 0.12, 0.14, 'N03tulang');
  const rebung = segitiga(0.62, 0.95, 0.1);
  for (let i = -3; i <= 3; i += 1) {
    const m = new THREE.Mesh(rebung, emas);
    m.position.set(i * 0.68, 0.6, 0);
    m.name = 'N03rebung';
    g.add(m);
  }
  const wajik = new THREE.BoxGeometry(0.26, 0.26, 0.1);
  for (let row = 0, y = 1.8; y < H - 0.9; row += 1, y += 0.5) {
    const lim = half * (1 - y / H) - 1.3;
    for (let x = row % 2 ? -lim + 0.3 : -lim; x <= lim + 1e-6; x += 0.6) {
      const m = new THREE.Mesh(wajik, emas);
      m.position.set(x, y, 0);
      m.rotation.z = Math.PI / 4;
      m.name = 'N03wajik';
      g.add(m);
    }
  }
  for (const sx of [-1, 1]) {
    const horn = batang(g, emas, [0, 0], [0, 2.0], 0.1, 0.1, 'N03tanduk');
    horn.position.set(0, H + 0.5, 0);
    horn.rotation.z = sx * 0.42;
  }
  const kuncup = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.45, 8), emas);
  kuncup.position.set(0, H + 1.6, 0);
  kuncup.name = 'N03kuncup';
  g.add(kuncup);
  return g;
}

/** Dua bidang atap pelana dari gable depan ke fasad, ridge datar di y = tinggi gable. */
function atapPelana(xFront, xBack, base) {
  const { lebar: W, tinggi: H } = SELEMBAYUNG;
  const hw = W / 2;
  const v = [
    [xFront, base, -hw], [xFront, base + H, 0], [xBack, base + H, 0], [xBack, base, -hw],
    [xFront, base, hw], [xFront, base + H, 0], [xBack, base + H, 0], [xBack, base, hw],
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(v.flat(), 3));
  geo.setIndex([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6]);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, MATS.biru());
  m.castShadow = true;
  m.name = 'N03atapPelana';
  return m;
}

/**
 * N03 placeholder [T Street View 2025]: kanopi atap datar biru di 4 tiang bulat biru-abu, lisplang
 * bertulis "REKTORAT", selembayung emas + atap pelana biru di atasnya. GLB `n03-kanopi-merah-rektorat`
 * (versi merah lama) tidak lagi dipasang; ganti bila ada GLB biru dari Blender.
 */
function kanopiBiru() {
  const g = new THREE.Group();
  g.name = 'N03';
  const { eave, slab } = KANOPI;
  const xc = (K.x0 + K.x1) / 2;
  const zc = (K.z0 + K.z1) / 2;
  const w = K.x1 - K.x0 + 1.0;
  const d = K.z1 - K.z0 + 1.0;
  const [x0, x1, z0, z1] = [xc - w / 2, xc + w / 2, zc - d / 2, zc + d / 2];
  for (const p of LAYOUT.kanopiTiang) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, eave, 14), MATS.biruTiang());
    post.position.set(p.x, eave / 2, p.z);
    post.castShadow = true;
    post.name = 'N03tiang';
    g.add(post);
    addBox(g, MATS.dinding(), [p.x - 0.4, p.x + 0.4], [0, 0.3], [p.z - 0.4, p.z + 0.4], { name: 'N03kaki' });
    addBox(g, MATS.dinding(), [p.x - 0.36, p.x + 0.36], [eave - 0.2, eave], [p.z - 0.36, p.z + 0.36], { name: 'N03kepala' });
  }
  addBox(g, MATS.biru(), [x0, x1], [eave, eave + slab], [z0, z1], { name: 'N03lisplang' });
  addBox(g, MATS.dinding(), [x0 - 0.05, x1 + 0.05], [eave + slab, eave + slab + 0.1], [z0 - 0.05, z1 + 0.05], { name: 'N03lisTepi' });
  const teks = new THREE.Mesh(
    new THREE.PlaneGeometry(5.4, 0.6),
    makeTextMaterial('REKTORAT', { bg: '#2b5ea7', fg: '#16233a', width: 1024, height: 128, font: 'bold 104px sans-serif', padding: 12 }),
  );
  teks.rotation.y = Math.PI / 2;
  teks.position.set(x1 + 0.01, eave + slab / 2, zc);
  teks.name = 'N03teks';
  g.add(teks);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.5, d - 0.5).rotateX(Math.PI / 2), MATS.plafon());
  ceiling.position.set(xc, eave - 0.01, zc);
  ceiling.name = 'N03plafon';
  g.add(ceiling);
  const xg = x1 - 0.9;
  const baseY = eave + slab + 0.1;
  const gable = selembayung();
  gable.rotation.y = Math.PI / 2;
  gable.position.set(xg, baseY, zc);
  g.add(gable, atapPelana(xg, K.x0 - 0.4, baseY));
  return g;
}

/** Tiang lampu taman hitam klasik: dua lentera krem pada palang (menyala malam). */
function lampuTaman(group, p) {
  const g = new THREE.Group();
  g.name = 'lampuTaman';
  g.position.set(p.x, 0, p.z);
  const tiang = MATS.tiangLampu();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.5, 8), tiang);
  base.position.y = 0.25;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.07, 2.7, 8), tiang);
  pole.position.y = 1.85;
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.0), tiang);
  bar.position.y = 3.05;
  g.add(base, pole, bar);
  for (const sz of [-0.5, 0.5]) {
    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.14, 0.42, 6), MATS.lentera());
    lantern.position.set(0, 3.32, sz);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.22, 6), tiang);
    cap.position.set(0, 3.64, sz);
    g.add(lantern, cap);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.name = o.name || 'lampuTamanBagian'; } });
  group.add(g);
}

/** Halaman depan [T Street View 2025]: kerb kuning-hitam, pagar tanaman berbunga, lampu taman klasik. */
function halamanDepan(group) {
  const plaza = LAYOUT.plazaDepan;
  const [xa, xb] = [plaza[0][0], plaza[2][0]];
  const [za, zb] = [plaza[0][1], plaza[2][1]];
  const blok = 1.2;
  const kerb = (x0, x1, z0, z1, i) => addBox(group, i % 2 ? MATS.kerbHitam() : MATS.kerbKuning(), [x0, x1], [0, 0.16], [z0, z1], { cast: false, name: 'kerbKuningHitam' });
  let i = 0;
  for (let z = za; z < zb - 1e-6; z += blok, i += 1) kerb(xb, xb + 0.3, z, Math.min(z + blok, zb), i);
  for (const zEdge of [za - 0.3, zb]) {
    for (let x = xa, j = 0; x < xb - 1e-6; x += blok, j += 1) kerb(x, Math.min(x + blok, xb), zEdge, zEdge + 0.3, j);
  }
  for (const [zz, sz] of [[za - 1.1, -1], [zb + 0.8, 1]]) {
    addBox(group, MATS.semak(), [xa + 0.3, xb - 0.5], [0, 0.6], [zz - 0.35, zz + 0.35], { name: 'pagarTanaman' });
    for (let x = xa + 1.2; x < xb - 1; x += 2.1) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), MATS.bunga());
      b.position.set(x, 0.68, zz + sz * 0.05);
      b.name = 'semakBunga';
      group.add(b);
    }
  }
  for (const p of LAYOUT.lampuTaman) lampuTaman(group, p);
}

/**
 * Massa Rektorat. raw = statis (digabung per material oleh index.js); placeholders = N02 & N03 (kanopi biru + selembayung; tidak
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
  halamanDepan(raw);
  const placeholders = new THREE.Group();
  placeholders.name = 'rektoratPlaceholder';
  placeholders.position.y = y0;
  placeholders.add(hurufPuncak(), kanopiBiru());
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
