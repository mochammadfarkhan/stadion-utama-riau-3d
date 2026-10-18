/**
 * H02 hero:stadion-mini — Stadion Mini UNRI (way 327364388, kapasitas 5.000 [T]). Fakta: tapak oval
 * ±124 × 202 m, lapangan sepak bola way 327366049 (76,45 × 111,77 m), tribun barat way 282225436 (136,5 ×
 * 19,1 m + tonjolan VIP). [INFERENSI, tanpa foto]: lintasan 6 lajur tanah merah (bentuk tapak oval), tribun
 * beton 16 undakan menghadap timur dengan atap seng di bagian VIP + tiang baja, papan nama di lisplang atap,
 * rumput lapangan kampus dengan bagian aus di mulut gawang & lingkaran tengah. Tanpa lampu sorot.
 * Marka/gawang/bendera = modul FIFA standar stadion (world/stadium/Pitch.markings.js, 105 × 68 m).
 */
import * as THREE from 'three';
import { RENDER_LAYERS } from '../../config/constants.js';
import { stadiumShape, stadiumPath, flatShapeGeometry, mergeFlat, createCanvasTexture } from '../../world/stadium/ovalMath.js';
import { createMarkings, createGoals, createCornerFlags } from '../../world/stadium/Pitch.markings.js';
import { surfaceMaps } from '../../world/textures/surfaces.js';
import { currentScope } from '../../engine/ResourceScope.js';
import { boxAt, paint, facePlane, quad } from '../../world/props/unri/geom.js';
import { PITCH_FRAME, TRIBUN } from './placement.js';
import { faceToward } from './layout.js';
import { staged, meshesByMaterial } from './staged.js';
import { evenSteps, rowPoints, stairSteps } from './generators.js';

export const TRACK_MINI = Object.freeze({ halfStraight: 50, kerb: 39, lanes: 6, laneW: 1.22, margin: 0.5 });
const OUTER = TRACK_MINI.kerb + TRACK_MINI.lanes * TRACK_MINI.laneW;
const GRASS_Y = 0.08;
const TRACK_Y = 0.07;
const MARK_Y = 0.07;
const TIER = Object.freeze({ rows: 16, tread: 0.8, rise: 0.4, podium: 1.0, walk: 1.0 });
const ROOF = Object.freeze({ back: 11.0, front: 10.2, frontX: 6.0, overZ: 1.0 });
const COLUMN_Z = Object.freeze(rowPoints({ from: [0, -25], dir: [0, 1], count: 5, step: 12.5 }).map(([, z]) => z));

/** Kanvas rumput satu lembar untuk seluruh infield (78 × 178 m): strip potong + aus tanah. */
function drawLapangan(ctx, w, h) {
  const stripes = 14;
  for (let i = 0; i < stripes; i += 1) {
    ctx.fillStyle = i % 2 ? '#6f9a3d' : '#78a443';
    ctx.fillRect(0, (i * h) / stripes, w, h / stripes + 1);
  }
  const worn = [[0.5, 0.5, 0.06], [0.5, 0.2, 0.05], [0.5, 0.8, 0.05], [0.5, 0.215, 0.025], [0.5, 0.785, 0.025]];
  for (const [u, v, r] of worn) {
    const g = ctx.createRadialGradient(u * w, v * h, 0, u * w, v * h, r * w * 2);
    g.addColorStop(0, 'rgba(160,120,80,0.75)');
    g.addColorStop(1, 'rgba(160,120,80,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  for (let i = 0; i < 1500; i += 1) {
    ctx.fillStyle = i % 3 ? 'rgba(40,70,20,0.10)' : 'rgba(200,190,120,0.10)';
    ctx.fillRect((i * 97) % w, (i * 61) % h, 2, 2);
  }
}

const mats = () => currentScope().get('lembaga:stadionMini:mats', () => {
  const grassTex = createCanvasTexture(256, 512, drawLapangan);
  if (grassTex) {
    const sx = 2 * TRACK_MINI.kerb;
    const sz = 2 * (TRACK_MINI.halfStraight + TRACK_MINI.kerb);
    grassTex.repeat.set(1 / sx, 1 / sz);
    grassTex.offset.set(0.5, 0.5);
  }
  const named = (m, n) => {
    m.name = n;
    m.userData.baseRoughness = m.roughness;
    return m;
  };
  return {
    rumput: named(new THREE.MeshStandardMaterial({ color: grassTex ? 0xffffff : 0x74a040, roughness: 0.95, ...(grassTex ? { map: grassTex } : {}) }), 'rumputStadionMini'),
    lintasan: named(new THREE.MeshStandardMaterial({ color: 0xa65a3c, roughness: 1, ...surfaceMaps('concrete', 1.2) }), 'lintasanTanahMerah'),
    garis: named(new THREE.MeshBasicMaterial({ color: 0xf2efe8, transparent: true, opacity: 0.8, polygonOffset: true, polygonOffsetFactor: -1 }), 'garisLajur'),
  };
});

/**
 * Permukaan basah SINKRON (registerWet saat mount): rumput infield ('rumput') & lintasan ('joggingTrack').
 * @param {{heightAt:(lx:number, lz:number)=>number}} opts
 */
export function createStadionMiniSurfaces({ heightAt }) {
  const m = mats();
  const y = heightAt(PITCH_FRAME.x, PITCH_FRAME.z);
  const g = new THREE.Group();
  g.name = 'H02-permukaan';
  g.position.set(PITCH_FRAME.x, y, PITCH_FRAME.z);
  g.rotation.y = PITCH_FRAME.yaw;
  const grass = new THREE.Mesh(flatShapeGeometry(stadiumShape(TRACK_MINI.halfStraight, TRACK_MINI.kerb), [], 48).translate(0, GRASS_Y, 0), m.rumput);
  grass.name = 'rumput';
  const track = new THREE.Mesh(flatShapeGeometry(
    stadiumShape(TRACK_MINI.halfStraight, OUTER + TRACK_MINI.margin),
    [stadiumPath(TRACK_MINI.halfStraight, TRACK_MINI.kerb)], 48,
  ).translate(0, TRACK_Y, 0), m.lintasan);
  track.name = 'joggingTrack';
  for (const s of [grass, track]) {
    s.receiveShadow = true;
    s.layers.enable(RENDER_LAYERS.minimap);
  }
  g.add(grass, track);
  return g;
}

function laneLines() {
  const geos = [];
  for (let k = 0; k <= TRACK_MINI.lanes; k += 1) {
    const r = TRACK_MINI.kerb + k * TRACK_MINI.laneW;
    geos.push(flatShapeGeometry(stadiumShape(TRACK_MINI.halfStraight, r + 0.03), [stadiumPath(TRACK_MINI.halfStraight, r - 0.03)], 48).translate(0, TRACK_Y + 0.01, 0));
  }
  return mergeFlat(geos);
}

/** Profil undakan tribun (x lokal-tribun, y): muka timur di +depth/2, 16 baris naik ke barat. */
function tierShape(D) {
  const s = new THREE.Shape();
  s.moveTo(-D, 0);
  s.lineTo(D, 0);
  s.lineTo(D, 0.15);
  s.lineTo(D - TIER.walk, 0.15);
  s.lineTo(D - TIER.walk, TIER.podium);
  stairSteps({ rows: TIER.rows, tread: TIER.tread, rise: TIER.rise, frontX: D - TIER.walk, base: TIER.podium }).forEach(({ x, y }, k) => {
    s.lineTo(x, y);
    if (k < TIER.rows - 1) s.lineTo(x, y + TIER.rise);
  });
  s.lineTo(-D, TIER.podium + (TIER.rows - 1) * TIER.rise);
  s.closePath();
  return s;
}

function tribunGeometries() {
  const D = TRIBUN.depth / 2;
  const L = TRIBUN.length;
  const topY = TIER.podium + (TIER.rows - 1) * TIER.rise;
  const v = TRIBUN.vip;
  const beton = [
    new THREE.ExtrudeGeometry(tierShape(D), { depth: L, bevelEnabled: false }).translate(0, 0, -L / 2),
  ];
  const beton2 = [boxAt(0.2, 1.1, L, -D + 0.1, topY, 0), boxAt(0.25, 1.05, L, D - TIER.walk - 0.12, 0, 0)];
  const cat = [];
  for (let k = 0; k < TIER.rows; k += 1) {
    const x = D - TIER.walk - k * TIER.tread - 0.04;
    cat.push(paint(boxAt(0.06, 0.012, L, x, TIER.podium + k * TIER.rise, 0), k % 4 === 0 ? 0x2f6db5 : 0xe0b13a));
  }
  const baja = [boxAt(0.05, 0.05, L, D - TIER.walk + 0.05, TIER.podium + 1.0, 0)];
  for (const z of evenSteps(-L / 2 + 1.5, L / 2 - 1.5, 3, 0)) baja.push(boxAt(0.05, 1.0, 0.05, D - TIER.walk + 0.05, TIER.podium, z));
  const roofBack = v.x0 - 0.5;
  for (const z of COLUMN_Z) {
    baja.push(boxAt(0.25, ROOF.back - 0.2, 0.25, v.x0 + 0.3, 0, z));
    const frontBase = TIER.podium + Math.max(0, Math.floor((D - TIER.walk - ROOF.frontX + 1.4) / TIER.tread)) * TIER.rise;
    baja.push(boxAt(0.25, ROOF.front - frontBase - 0.2, 0.25, ROOF.frontX - 1.4, frontBase, z));
    const len = Math.hypot(ROOF.frontX - roofBack, ROOF.back - ROOF.front);
    const ang = Math.atan2(ROOF.back - ROOF.front, ROOF.frontX - roofBack);
    baja.push(new THREE.BoxGeometry(len, 0.35, 0.2).rotateZ(-ang).translate((ROOF.frontX + roofBack) / 2, (ROOF.back + ROOF.front) / 2 - 0.25, z));
  }
  const z0 = v.z0 - ROOF.overZ;
  const z1 = v.z1 + ROOF.overZ;
  const slope = Math.hypot(ROOF.frontX - roofBack, ROOF.back - ROOF.front);
  const seng = [quad(
    [[roofBack, ROOF.back, z1], [ROOF.frontX, ROOF.front, z1], [ROOF.frontX, ROOF.front, z0], [roofBack, ROOF.back, z0]],
    [[z1, 0], [z1, slope], [z0, slope], [z0, 0]],
  )];
  const dinding = [boxAt(v.x1 - v.x0, topY, v.z1 - v.z0, (v.x0 + v.x1) / 2, 0, (v.z0 + v.z1) / 2)];
  const gelap = [];
  for (const z of evenSteps(v.z0 + 3, v.z1 - 3, 4, 0)) {
    for (const y0 of [1.2, 4.4]) gelap.push(boxAt(0.02, 1.2, 1.6, v.x0 - 0.01, y0, z));
  }
  for (const z of [v.z0 + 8, (v.z0 + v.z1) / 2, v.z1 - 8]) gelap.push(boxAt(0.02, 2.4, 1.4, v.x0 - 0.012, 0, z));
  for (const z of evenSteps(-L / 2 + 2, L / 2 - 2, 4, 0)) {
    if (z > v.z0 - 1 && z < v.z1 + 1) continue;
    gelap.push(boxAt(0.02, 0.6, 0.6, -D - 0.01, 5.2, z));
  }
  return { beton, beton2, cat, baja, seng, dinding, gelap, sign: { x: ROOF.frontX + 0.06, y: ROOF.front - 0.85, z: (v.z0 + v.z1) / 2 } };
}

/**
 * @param {{heightAt:(lx:number, lz:number)=>number, mats:object, atlas:object}} opts mats = lembagaMaterials().mats
 */
export function createStadionMiniBuilder({ heightAt, mats: lm, atlas }) {
  const pitchY = heightAt(PITCH_FRAME.x, PITCH_FRAME.z);
  const tribY = heightAt(TRIBUN.frame.x, TRIBUN.frame.z);
  const pitchGroup = (obj) => {
    obj.position.set(PITCH_FRAME.x, pitchY + MARK_Y, PITCH_FRAME.z);
    obj.rotation.y = PITCH_FRAME.yaw;
    return obj;
  };
  return staged('H02-stadion-mini', [
    () => [
      pitchGroup(createMarkings()), pitchGroup(createGoals()), pitchGroup(createCornerFlags()),
      (() => {
        const lines = new THREE.Mesh(laneLines(), mats().garis);
        lines.name = 'garisLajur';
        lines.position.set(PITCH_FRAME.x, pitchY, PITCH_FRAME.z);
        lines.rotation.y = PITCH_FRAME.yaw;
        return lines;
      })(),
    ],
    () => {
      const t = tribunGeometries();
      const g = meshesByMaterial('H02-tribun', [[lm.beton, [...t.beton, ...t.beton2]], [lm.dinding, t.dinding]], { cast: true });
      const roof = meshesByMaterial('H02-atap', [[lm.seng, t.seng]], { cast: true, minimap: true, layer: RENDER_LAYERS.minimap });
      const detail = meshesByMaterial('H02-detail', [[lm.vcolor, t.cat], [lm.baja, t.baja], [lm.gelap, t.gelap]]);
      const sign = new THREE.Mesh(facePlane(16, 1.2, { cell: atlas.cell('nama:stadion') }), lm.atlas);
      sign.name = 'H02-nama';
      sign.position.set(t.sign.x, t.sign.y, t.sign.z);
      sign.rotation.y = faceToward(1, 0);
      const back = new THREE.Mesh(boxAt(0.1, 1.4, 16.4, t.sign.x - 0.07, t.sign.y - 0.7, t.sign.z), lm.baja);
      const wrap = new THREE.Group();
      wrap.position.set(TRIBUN.frame.x, tribY, TRIBUN.frame.z);
      wrap.rotation.y = TRIBUN.frame.yaw;
      wrap.add(g, roof, detail, sign, back);
      return wrap;
    },
  ]);
}
