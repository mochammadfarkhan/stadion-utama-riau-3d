/**
 * Kapal maket prosedural untuk studio Skala Nusantara: Batavia (VOC 1628) dan Pinisi. Ukuran lambung dari sumber
 * (lihat episode); bentuk lambung, tinggi tiang, dan susunan layar = gaya maket [INFERENSI], bukan replika presisi.
 * Haluan menghadap +X, garis air y = 0. Tiap kapal = THREE.Group dengan userData.hull (parameter hullMath).
 */
import * as THREE from 'three';
import { hullGrid, deckAt, beamAt } from './hullMath.js';

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0, ...extra });

/** Mesh dengan bayangan menyala. */
function mesh(geo, material, name) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true;
  m.receiveShadow = true;
  if (name) m.name = name;
  return m;
}

/** Lambung + geladak + tutup buritan. `bands` = [[yAtas, warna], …] dari bawah: warna verteks menurut tinggi. */
function hullMeshes(h, bands) {
  const { positions, indices, S, K } = hullGrid(h);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const colors = new Float32Array(positions.length);
  const c = new THREE.Color();
  for (let i = 0; i < positions.length; i += 3) {
    const y = positions[i + 1];
    c.set((bands.find(([top]) => y <= top) ?? bands[bands.length - 1])[1]);
    colors.set([c.r, c.g, c.b], i);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  geo.computeVertexNormals();
  const out = [mesh(geo, mat(0xffffff, { vertexColors: true, side: THREE.DoubleSide }), 'lambung')];

  // Geladak: pita antara bibir kiri & kanan, sedikit di bawah bibir (dinding pagar terlihat).
  const deck = [];
  const idx = [];
  const drop = h.bulwark ?? 0.6;
  for (let i = 0; i <= S; i += 1) {
    const L = (i * (K + 1)) * 3;
    const R = (i * (K + 1) + K) * 3;
    deck.push(positions[L], positions[L + 1] - drop, positions[L + 2] * 0.97, positions[R], positions[R + 1] - drop, positions[R + 2] * 0.97);
    if (i < S) idx.push(2 * i, 2 * i + 2, 2 * i + 1, 2 * i + 1, 2 * i + 2, 2 * i + 3);
  }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.Float32BufferAttribute(deck, 3));
  dg.setIndex(idx);
  dg.computeVertexNormals();
  out.push(mesh(dg, mat(h.deckColor ?? 0xb98a55), 'geladak'));

  // Tutup buritan (transom): kipas dari titik tengah penampang u = 0.
  const fan = [];
  const fi = [];
  const cy = (deckAt(0, h) + positions[(K / 2) * 3 + 1]) / 2;
  fan.push(-h.length / 2, cy, 0);
  for (let k = 0; k <= K; k += 1) fan.push(positions[k * 3], positions[k * 3 + 1], positions[k * 3 + 2]);
  for (let k = 0; k < K; k += 1) fi.push(0, k + 2, k + 1);
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.Float32BufferAttribute(fan, 3));
  fg.setIndex(fi);
  fg.computeVertexNormals();
  out.push(mesh(fg, mat(bands[bands.length - 1][1], { side: THREE.DoubleSide }), 'buritan'));
  return out;
}

/** Tabung dari titik a ke b (tiang, ra, cucur). */
function rod(a, b, r, material) {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const len = va.distanceTo(vb);
  const m = mesh(new THREE.CylinderGeometry(r * 0.8, r, len, 10), material);
  m.position.copy(va).add(vb).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  return m;
}

/**
 * Layar = bidang bilinear dari 4 sudut (p00 bawah-belakang, p10 bawah-depan, p01 atas-belakang, p11 atas-depan;
 * segitiga = dua sudut sama), menggembung sejauh `belly` ke arah `dir`.
 */
function sail(p00, p10, p01, p11, dir, belly, material) {
  const N = 8;
  const pos = [];
  const idx = [];
  const P = [p00, p10, p01, p11].map((p) => new THREE.Vector3(...p));
  const d = new THREE.Vector3(...dir).normalize();
  const v = new THREE.Vector3();
  for (let j = 0; j <= N; j += 1) {
    for (let i = 0; i <= N; i += 1) {
      const a = i / N;
      const b = j / N;
      v.copy(P[0]).multiplyScalar((1 - a) * (1 - b))
        .addScaledVector(P[1], a * (1 - b)).addScaledVector(P[2], (1 - a) * b).addScaledVector(P[3], a * b)
        .addScaledVector(d, belly * Math.sin(Math.PI * a) * Math.sin(Math.PI * b));
      pos.push(v.x, v.y, v.z);
      if (i < N && j < N) {
        const q = j * (N + 1) + i;
        idx.push(q, q + 1, q + N + 1, q + 1, q + N + 2, q + N + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return mesh(g, material, 'layar');
}

/** Kotak (bangunan di geladak). */
function box(w, h, d, x, y, z, material) {
  const m = mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y + h / 2, z);
  return m;
}

/** Bendera kecil di puncak tiang: garis warna dari atas ke bawah. */
function flag(top, colors, w = 3, h = 1.8) {
  const g = new THREE.Group();
  colors.forEach((c, i) => {
    const m = mesh(new THREE.PlaneGeometry(w, h / colors.length), mat(c, { side: THREE.DoubleSide }));
    m.position.set(top[0] - w / 2, top[1] - (i + 0.5) * (h / colors.length), top[2]);
    g.add(m);
  });
  return g;
}

/**
 * Batavia (VOC, 1628). Lambung ±45 m (panjang asli tanpa cucur); 3 tiang layar persegi + layar latin di tiang
 * belakang + layar cucur. Kastil buritan tinggi khas kapal Belanda abad ke-17.
 */
export function createBatavia() {
  const h = {
    length: 45, beam: 10.5, draft: 4.6, freeboard: 4.2, sheerAft: 4.5, sheerFwd: 2.2,
    transom: 0.62, bowSharp: 1.9, sternFull: 2.6, round: 2.4, bulwark: 1, deckColor: 0xb08a5a,
  };
  const g = new THREE.Group();
  g.name = 'batavia';
  g.userData.hull = h;
  for (const m of hullMeshes(h, [[0.3, '#e6dcc4'], [h.freeboard + 1.4, '#5b3a22'], [h.freeboard + 2.2, '#c9962e'], [99, '#3d5a3a']])) g.add(m);

  const wood = mat(0x4a2e1a);
  const trim = mat(0xc9962e);
  const half = h.length / 2;
  const deckY = (u) => deckAt(u, h) - h.bulwark;
  // Kastil buritan bertingkat + kastil depan.
  g.add(box(9, 3.2, h.beam * 0.78, -half + 5.2, deckY(0.1), 0, wood));
  g.add(box(5, 2.4, h.beam * 0.62, -half + 3.6, deckY(0.1) + 3.2, 0, wood));
  g.add(box(0.5, 6, h.beam * 0.6, -half + 0.4, deckY(0.02), 0, trim)); // cermin buritan berukir
  g.add(box(6, 2.2, h.beam * 0.62 * beamAt(0.88, h), half - 6.5, deckY(0.88), 0, wood));

  const sailMat = mat(0xf1e7cf, { side: THREE.DoubleSide, roughness: 0.92 });
  const spar = mat(0x3a2414);
  // [x, tinggi di atas geladak, lebar ra bawah]
  const masts = [[half - 11, 34, 15], [-1, 41, 18], [-half + 10, 26, 0]];
  for (const [x, H, W] of masts) {
    const u = x / h.length + 0.5;
    const base = deckY(u);
    g.add(rod([x, base - 1, 0], [x, base + H, 0], 0.45, spar));
    if (W === 0) {
      // Tiang belakang: layar latin (segitiga miring).
      g.add(rod([x - 7, base + 5, 0], [x + 5, base + 18, 0], 0.2, spar));
      g.add(sail([x - 6.6, base + 5.4, 0], [x + 1, base + 6, 0], [x - 6.6, base + 5.4, 0], [x + 4.6, base + 17.6, 0], [0, 0, 1], 1.2, sailMat));
      g.add(flag([x, base + H + 1.8, 0], ['#d63b2f', '#f4f1e8', '#2e4f9e']));
      continue;
    }
    // Tiga tingkat layar persegi menyempit ke atas; menggembung ke depan (+X).
    const tiers = [[0.18, 0.46, 1], [0.5, 0.74, 0.72], [0.77, 0.93, 0.48]];
    for (const [b0, b1, k] of tiers) {
      const y0 = base + H * b0;
      const y1 = base + H * b1;
      const w0 = (W * k) / 2;
      const w1 = w0 * 0.86;
      g.add(rod([x, y1, -w1 - 0.6], [x, y1, w1 + 0.6], 0.18, spar));
      g.add(sail([x, y0, w0], [x, y0, -w0], [x, y1, w1], [x, y1, -w1], [1, 0, 0], 1.6 * k, sailMat));
    }
  }
  // Cucur (bowsprit) + layar cucur di bawahnya.
  const bowY = deckY(1) + 0.6;
  g.add(rod([half - 3, bowY, 0], [half + 11, bowY + 6, 0], 0.35, spar));
  g.add(sail([half + 6.5, bowY - 1.5, 3.6], [half + 6.5, bowY - 1.5, -3.6], [half + 7.6, bowY + 3.4, 3.2], [half + 7.6, bowY + 3.4, -3.2], [1, 0, 0], 0.8, sailMat));
  g.add(flag([masts[1][0], deckY(0.48) + masts[1][1] + 1.8, 0], ['#d63b2f', '#f4f1e8', '#2e4f9e']));
  return g;
}

/**
 * Pinisi (Sulawesi Selatan): lambung kayu ±35 m (pinisi besar; banyak yang 20-an m), 2 tiang, 7 layar:
 * 3 layar depan (jib), 2 layar utama bergaf, 2 layar puncak segitiga. Rumah geladak di buritan.
 */
export function createPinisi() {
  const h = {
    length: 35, beam: 8, draft: 3, freeboard: 2.4, sheerAft: 2.6, sheerFwd: 2.8,
    transom: 0.42, bowSharp: 1.35, sternFull: 2.2, round: 2.2, bulwark: 0.7, deckColor: 0xd2a874,
  };
  const g = new THREE.Group();
  g.name = 'pinisi';
  g.userData.hull = h;
  for (const m of hullMeshes(h, [[0.25, '#f3efe6'], [h.freeboard + 0.9, '#9a5f2e'], [h.freeboard + 1.5, '#f3efe6'], [99, '#7a4723']])) g.add(m);

  const half = h.length / 2;
  const deckY = (u) => deckAt(u, h) - h.bulwark;
  g.add(box(8, 2.3, h.beam * 0.62, -half + 6.5, deckY(0.18), 0, mat(0xf3efe6)));
  g.add(box(8.6, 0.3, h.beam * 0.7, -half + 6.5, deckY(0.18) + 2.3, 0, mat(0x8a5229)));

  const sailMat = mat(0xf7f3ea, { side: THREE.DoubleSide, roughness: 0.9 });
  const spar = mat(0x6b4020);
  const masts = [[4, 26], [-6, 23]]; // tiang depan sedikit lebih tinggi
  for (const [x, H] of masts) {
    const base = deckY(x / h.length + 0.5);
    g.add(rod([x, base - 1, 0], [x, base + H, 0], 0.32, spar));
    // Layar utama bergaf (trapesium) di belakang tiang; menggembung ke samping (+Z).
    const len = 9.5;
    g.add(rod([x, base + 2, 0], [x - len, base + 2.4, 0], 0.15, spar));
    g.add(rod([x, base + H * 0.62, 0], [x - len + 0.5, base + H * 0.62 + 3.2, 0], 0.15, spar));
    g.add(sail([x - len, base + 2.4, 0], [x - 0.3, base + 2.1, 0], [x - len + 0.5, base + H * 0.62 + 3.2, 0], [x - 0.3, base + H * 0.62, 0], [0, 0, 1], 1.3, sailMat));
    // Layar puncak segitiga di atas gaf.
    g.add(sail([x - len + 1.2, base + H * 0.62 + 3.1, 0], [x - 0.3, base + H * 0.64, 0], [x - 0.3, base + H - 0.6, 0], [x - 0.3, base + H - 0.6, 0], [0, 0, 1], 0.7, sailMat));
  }
  // Cucur panjang + 3 layar depan dari tiang depan ke cucur.
  const bowY = deckY(1) + 0.4;
  const tip = [half + 9, bowY + 3, 0];
  g.add(rod([half - 2, bowY, 0], tip, 0.25, spar));
  const fx = masts[0][0];
  const fBase = deckY(fx / h.length + 0.5);
  const jibs = [[half - 0.5, bowY + 0.6, 0.5], [half + 4, bowY + 1.6, 0.68], [half + 8.4, bowY + 2.8, 0.86]];
  for (const [jx, jy, k] of jibs) {
    const head = [fx + 0.4, fBase + masts[0][1] * k, 0];
    g.add(sail([fx + 1, fBase + 1.4, 0], [jx, jy, 0], head, head, [0, 0, 1], 0.9, sailMat));
  }
  g.add(flag([fx, fBase + masts[0][1] + 1.6, 0], ['#d32f2f', '#f4f1e8'], 2.6, 1.6));
  return g;
}
