import * as THREE from 'three';
import { SITE } from '../../config/constants.js';
import { makeTextMaterial, dropLetters } from '../siteutil/textCanvas.js';
import { placeObject } from '../siteutil/instanceParts.js';
import { createRandom } from '../siteutil/rng.js';

/**
 * Gapura kawasan di Jl. Naga Sakti: dua pilar besar berkeramik + balok atas
 * bergaya tanjak/selembayung, papan "SELAMAT DATANG ...", opsi damaged
 * (huruf rontok, keramik lepas, bercak gelap).
 */
export const GAPURA = Object.freeze({
  span: 16, pillarW: 1.6, pillarH: 7, beamH: 1.2, signW: 13, signH: 1.0,
  text: 'SELAMAT DATANG DI KAWASAN STADION UTAMA RIAU',
  missingLetters: [3, 11, 24, 33, 40],
  colors: { keramik: 0xe9e4d6, balok: 0x7a1f1f, emas: 0xd4a017, tanjak: 0xb5891d, bercak: 0x5a5247 },
});
/** Kanvas papan: 2048×160 (aspek ≈ 13:1 sesuai signW:signH), font tebal kontras tinggi. */
const SIGN_TEXT = Object.freeze({ bg: '#7a1f1f', fg: '#f6e3a1', width: 2048, height: 160, font: 'bold 124px sans-serif', padding: 48 });

const tileMat = new THREE.MeshLambertMaterial({ color: GAPURA.colors.keramik });
const beamMat = new THREE.MeshLambertMaterial({ color: GAPURA.colors.balok });
const goldMat = new THREE.MeshStandardMaterial({ color: GAPURA.colors.emas, metalness: 0.5, roughness: 0.4 });
const tanjakMat = new THREE.MeshLambertMaterial({ color: GAPURA.colors.tanjak });
const stainMat = new THREE.MeshLambertMaterial({ color: GAPURA.colors.bercak });

/** Dua pilar + pondasi. */
function createPillars() {
  const g = new THREE.Group();
  g.name = 'pilar';
  const geo = new THREE.BoxGeometry(GAPURA.pillarW, GAPURA.pillarH, GAPURA.pillarW);
  const baseGeo = new THREE.BoxGeometry(GAPURA.pillarW + 0.6, 0.5, GAPURA.pillarW + 0.6);
  [-1, 1].forEach((s) => {
    const p = new THREE.Mesh(geo, tileMat);
    p.position.set(s * GAPURA.span / 2, GAPURA.pillarH / 2, 0);
    p.castShadow = true;
    const b = new THREE.Mesh(baseGeo, beamMat);
    b.position.set(s * GAPURA.span / 2, 0.25, 0);
    g.add(p, b);
  });
  return g;
}

/** Selembayung: dua bilah bersilang di ujung balok. */
function createSelembayung(x, y) {
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(0.12, 2.2, 0.12);
  [-0.5, 0.5].forEach((rz) => {
    const m = new THREE.Mesh(geo, goldMat);
    m.position.set(x, y + 0.9, 0);
    m.rotation.z = rz;
    g.add(m);
  });
  return g;
}

/** Balok atas + mahkota tanjak (prisma segitiga) + selembayung di kedua ujung. */
function createTopBeam() {
  const g = new THREE.Group();
  g.name = 'balokAtas';
  const beamY = GAPURA.pillarH + GAPURA.beamH / 2;
  const beam = new THREE.Mesh(new THREE.BoxGeometry(GAPURA.span + GAPURA.pillarW, GAPURA.beamH, GAPURA.pillarW), beamMat);
  beam.position.y = beamY;
  beam.castShadow = true;
  g.add(beam);
  const tri = new THREE.Shape([new THREE.Vector2(-3.2, 0), new THREE.Vector2(3.2, 0), new THREE.Vector2(1.2, 1.6), new THREE.Vector2(0, 2.3), new THREE.Vector2(-1.6, 1.4)]);
  const crown = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 1.0, bevelEnabled: false }), tanjakMat);
  crown.position.set(0, GAPURA.pillarH + GAPURA.beamH, -0.5);
  crown.castShadow = true;
  g.add(crown);
  g.add(createSelembayung(-GAPURA.span / 2, GAPURA.pillarH + GAPURA.beamH));
  g.add(createSelembayung(GAPURA.span / 2, GAPURA.pillarH + GAPURA.beamH));
  return g;
}

/** Papan tulisan dua sisi (utara menghadap Naga Sakti). */
function createSign(damaged) {
  const text = damaged ? dropLetters(GAPURA.text, GAPURA.missingLetters) : GAPURA.text;
  const mat = makeTextMaterial(text, SIGN_TEXT);
  const geo = new THREE.PlaneGeometry(GAPURA.signW, GAPURA.signH);
  const g = new THREE.Group();
  g.name = 'papanNama';
  [-1, 1].forEach((s) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(0, GAPURA.pillarH + GAPURA.beamH / 2, s * (GAPURA.pillarW / 2 + 0.02));
    m.rotation.y = s < 0 ? Math.PI : 0;
    g.add(m);
  });
  g.userData.text = text;
  return g;
}

/** Kerusakan: keramik lepas di tanah & bercak gelap di pilar. */
function createDamage(seed) {
  const rnd = createRandom(seed);
  const g = new THREE.Group();
  g.name = 'kerusakan';
  const tileGeo = new THREE.BoxGeometry(0.3, 0.02, 0.3);
  for (let i = 0; i < 10; i += 1) {
    const t = new THREE.Mesh(tileGeo, tileMat);
    const s = rnd.chance(0.5) ? -1 : 1;
    t.position.set(s * GAPURA.span / 2 + rnd.range(-1.6, 1.6), 0.51 + rnd.range(0, 0.06), rnd.range(1.0, 2.2));
    t.rotation.set(rnd.range(-0.3, 0.3), rnd.range(0, 3.14), rnd.range(-0.2, 0.2));
    g.add(t);
  }
  const stainGeo = new THREE.BoxGeometry(0.5, 0.7, 0.02);
  for (let i = 0; i < 6; i += 1) {
    const st = new THREE.Mesh(stainGeo, stainMat);
    const s = rnd.chance(0.5) ? -1 : 1;
    st.position.set(s * GAPURA.span / 2 + rnd.range(-0.5, 0.5), rnd.range(0.8, 5.5), GAPURA.pillarW / 2 + 0.01);
    g.add(st);
  }
  return g;
}

/** Gapura lengkap. opts: { damaged=true, x, z, rotY, seed } */
export function createGapura(opts = {}) {
  const damaged = opts.damaged ?? true;
  const g = new THREE.Group();
  g.name = 'gapura';
  g.add(createPillars(), createTopBeam(), createSign(damaged));
  if (damaged) g.add(createDamage(opts.seed ?? 3));
  g.userData.damaged = damaged;
  return placeObject(g, { x: opts.x ?? 0, z: opts.z ?? SITE.gapuraZ, rotY: opts.rotY ?? 0 });
}
