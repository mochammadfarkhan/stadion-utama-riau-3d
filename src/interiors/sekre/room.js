/**
 * Ruang sekre (spec §8.2): dinding plester putih kusam dengan bekas selotip, lantai keramik krem 40 × 40 cm + plint
 * keramik, plafon gipsum (panel 1,2 m, sekrup, noda bocor di atlas papan), bukaan jendela nako & pintu di dinding
 * selasar (z = −3), dan latar selasar luar sederhana: lantai semen (basah saat hujan), atap, dinding ruang
 * tetangga, fasad deret seberang (canvas berpapan nama), rak sepatu & sandal di depan pintu, dan hujan yang
 * terlihat di kedua ujung selasar yang terbuka. Semua tekstur dari canvas (tanpa foto berlisensi).
 * Mengembalikan staticGroup (digabung per material oleh index.js) + dynamicGroup (hujan) + update().
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeRng } from '../../entities/util.js';
import { ROOM, WINDOW, DOOR, SELASAR, SELASAR_SEBERANG } from './data.js';
import { makeCanvas, canvasTexture, fitFont, diamond, tint, FONT } from './canvas.js';
import { styleState } from '../../engine/styleState.js';
import { loadPbr } from '../../world/textures/pbr.js';
import { TILE_M, tierForQuality } from '../../world/textures/pbrCore.js';

const PLESTER_M = 2.0; // meter per ulangan tekstur plester
const KERAMIK_M = 0.8; // 2 × 2 ubin 40 cm
const PLAFON_M = 1.2;  // panel gipsum 1,2 m
const PLINT_H = 0.1;
const RAIN_DROPS = 320;
const RAIN_SPEED = 9;  // m/s
const DRY = new THREE.Color('#a29d90');
const WET = new THREE.Color('#6f6a60');

// ---------- Gambar tekstur ----------

export function drawPlester(c, w, h, seed = 11) {
  const rnd = makeRng(seed);
  c.fillStyle = '#e8e3d6';
  c.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i += 1) { // belang cat & noda transparan
    const x = rnd() * w;
    const y = rnd() * h;
    const r = 6 + rnd() * 40;
    const tone = rnd() < 0.5 ? '255,252,240' : '196,188,168';
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${tone},${0.05 + rnd() * 0.08})`);
    g.addColorStop(1, `rgba(${tone},0)`);
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 6; i += 1) { // rembesan tipis dari bawah
    const x = rnd() * w;
    const len = h * (0.2 + rnd() * 0.5);
    const g = c.createLinearGradient(0, h - len, 0, h);
    g.addColorStop(0, 'rgba(150,140,115,0)');
    g.addColorStop(1, 'rgba(150,140,115,0.10)');
    c.fillStyle = g;
    c.fillRect(x, h - len, 2 + rnd() * 6, len);
  }
  for (let i = 0; i < 14; i += 1) { // bekas selotip (sebagian masih tersisa pitanya), tepi sobek
    const x = rnd() * (w - 60);
    const y = rnd() * (h - 30);
    const tw = 24 + rnd() * 46;
    const th = 9 + rnd() * 9;
    c.save();
    c.translate(x, y);
    c.rotate((rnd() - 0.5) * 0.5);
    const leftover = rnd() < 0.35;
    c.fillStyle = leftover ? 'rgba(226,212,160,0.75)' : 'rgba(250,244,220,0.55)';
    c.beginPath();
    c.moveTo(0, 0);
    for (let k = 0; k <= 6; k += 1) c.lineTo((tw * k) / 6, (k % 2) * 2);
    c.lineTo(tw, th);
    for (let k = 6; k >= 0; k -= 1) c.lineTo((tw * k) / 6, th - (k % 2) * 2);
    c.closePath();
    c.fill();
    if (!leftover) {
      c.strokeStyle = 'rgba(120,110,90,0.12)';
      c.lineWidth = 1;
      c.stroke();
    }
    c.restore();
  }
  for (let i = 0; i < 10; i += 1) { // lubang paku
    c.fillStyle = 'rgba(70,60,50,0.55)';
    c.beginPath();
    c.arc(rnd() * w, rnd() * h, 1.2 + rnd(), 0, Math.PI * 2);
    c.fill();
  }
  c.strokeStyle = 'rgba(90,80,70,0.12)';
  for (let i = 0; i < 8; i += 1) { // goresan
    const x = rnd() * w;
    const y = rnd() * h;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + (rnd() - 0.5) * 50, y + (rnd() - 0.5) * 12);
    c.stroke();
  }
}

export function drawKeramik(c, w, h, seed = 21) {
  const rnd = makeRng(seed);
  const n = 2;
  const tw = w / n;
  const th = h / n;
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      const v = (rnd() - 0.5) * 10;
      c.fillStyle = `rgb(${232 + v},${216 + v},${184 + v})`;
      c.fillRect(i * tw, j * th, tw, th);
      for (let k = 0; k < 900; k += 1) {
        c.fillStyle = `rgba(${rnd() < 0.5 ? '150,130,100' : '255,250,235'},${0.05 + rnd() * 0.08})`;
        c.fillRect(i * tw + rnd() * tw, j * th + rnd() * th, 1 + rnd() * 2, 1 + rnd() * 2);
      }
      const g = c.createLinearGradient(i * tw, j * th, (i + 1) * tw, (j + 1) * th);
      g.addColorStop(0, 'rgba(255,255,255,0.06)');
      g.addColorStop(1, 'rgba(0,0,0,0.04)');
      c.fillStyle = g;
      c.fillRect(i * tw, j * th, tw, th);
    }
  }
  c.strokeStyle = '#b9ad97'; // nat
  c.lineWidth = 3;
  for (let i = 0; i <= n; i += 1) {
    c.beginPath(); c.moveTo(i * tw, 0); c.lineTo(i * tw, h); c.stroke();
    c.beginPath(); c.moveTo(0, i * th); c.lineTo(w, i * th); c.stroke();
  }
}

export function drawPlafon(c, w, h, seed = 31) {
  const rnd = makeRng(seed);
  c.fillStyle = '#f0efe9';
  c.fillRect(0, 0, w, h);
  for (let k = 0; k < 1500; k += 1) {
    c.fillStyle = `rgba(180,175,160,${rnd() * 0.06})`;
    c.fillRect(rnd() * w, rnd() * h, 2, 2);
  }
  c.strokeStyle = 'rgba(160,155,140,0.55)'; // sambungan papan gipsum
  c.lineWidth = 2;
  c.strokeRect(1, 1, w - 2, h - 2);
  c.fillStyle = 'rgba(120,115,100,0.5)'; // kepala sekrup
  for (let i = 1; i < 6; i += 1) {
    for (const y of [8, h - 8]) {
      c.beginPath();
      c.arc((w * i) / 6, y, 1.5, 0, Math.PI * 2);
      c.fill();
    }
  }
}

function rosette(c, x, y, r, a, b) {
  c.fillStyle = a;
  for (let i = 0; i < 4; i += 1) {
    const ang = (i * Math.PI) / 2;
    c.beginPath();
    c.ellipse(x + Math.cos(ang) * r * 0.7, y + Math.sin(ang) * r * 0.7, r * 0.55, r * 0.3, ang, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = b;
  c.beginPath();
  c.arc(x, y, r * 0.35, 0, Math.PI * 2);
  c.fill();
}

/** Karpet ambal merah marun bermotif (S22, 3 × 4 m → kanvas 3:4). */
export function drawKarpet(c, w, h, seed = 41) {
  const rnd = makeRng(seed);
  const MARUN = '#6e1a26';
  const MARUN2 = '#8a2433';
  const EMAS = '#cf9e4a';
  const KREM = '#ecdcb6';
  const NAVY = '#1f2444';
  c.fillStyle = MARUN;
  c.fillRect(0, 0, w, h);
  const band = (inset, width, color) => {
    c.strokeStyle = color;
    c.lineWidth = width;
    c.strokeRect(inset + width / 2, inset + width / 2, w - 2 * inset - width, h - 2 * inset - width);
  };
  band(0, 46, NAVY);
  band(10, 4, EMAS);
  band(36, 4, EMAS);
  band(46, 10, MARUN2);
  c.fillStyle = EMAS;
  for (let x = 30; x < w - 20; x += 36) { diamond(c, x, 23, 9, 13); diamond(c, x, h - 23, 9, 13); }
  for (let y = 30; y < h - 20; y += 36) { diamond(c, 23, y, 13, 9); diamond(c, w - 23, y, 13, 9); }
  const cx = w / 2;
  const cy = h / 2;
  for (const [r, col] of [[260, NAVY], [230, EMAS], [218, MARUN2], [170, KREM], [158, MARUN], [110, EMAS], [96, NAVY], [52, EMAS], [40, MARUN2]]) {
    c.fillStyle = col;
    diamond(c, cx, cy, r * 0.8, r);
  }
  for (const [x, y] of [[56, 56], [w - 56, 56], [56, h - 56], [w - 56, h - 56]]) {
    c.fillStyle = EMAS; diamond(c, x, y, 70, 90);
    c.fillStyle = MARUN2; diamond(c, x, y, 56, 72);
    c.fillStyle = NAVY; diamond(c, x, y, 26, 34);
  }
  for (let y = 110; y < h - 100; y += 72) {
    for (let x = 100; x < w - 90; x += 72) {
      const ox = x + (Math.round(y / 72) % 2) * 36;
      if (Math.hypot((ox - cx) / 0.8, y - cy) < 290) continue;
      rosette(c, ox, y, 10, EMAS, KREM);
    }
  }
  for (let k = 0; k < 7000; k += 1) { // serat
    c.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,230,200'},${rnd() * 0.06})`;
    c.fillRect(rnd() * w, rnd() * h, 1, 2 + rnd() * 3);
  }
  const fade = c.createRadialGradient(cx, cy * 1.1, 40, cx, cy, h * 0.6); // pudar di area paling sering diduduki
  fade.addColorStop(0, 'rgba(255,220,200,0.10)');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = fade;
  c.fillRect(0, 0, w, h);
}

/** Fasad deret sekre seberang selasar (latar jendela & pintu). */
export function drawFacade(c, w, h, names, seed = 51) {
  const rnd = makeRng(seed);
  c.fillStyle = '#e3dccb';
  c.fillRect(0, 0, w, h);
  c.fillStyle = '#b8ae98';
  c.fillRect(0, h * 0.94, w, h * 0.06);
  const rw = w / names.length;
  names.forEach((name, i) => {
    const x0 = i * rw;
    const doorX = x0 + rw * 0.2;
    const doorW = rw * 0.214;
    const doorTop = h * 0.38;
    c.fillStyle = '#5a3a22';
    c.fillRect(doorX, doorTop, doorW, h * 0.56);
    c.fillStyle = '#3e2816';
    c.fillRect(doorX + doorW * 0.08, doorTop + h * 0.04, doorW * 0.84, h * 0.2);
    c.fillStyle = '#d8c7a0';
    c.beginPath();
    c.arc(doorX + doorW * 0.85, doorTop + h * 0.3, 3, 0, Math.PI * 2);
    c.fill();
    const winX = x0 + rw * 0.55;
    const winW = rw * 0.286;
    const winH = h * 0.35;
    c.fillStyle = '#2c3a44';
    c.fillRect(winX, doorTop, winW, winH);
    c.strokeStyle = '#c9ccd0';
    c.lineWidth = 2;
    for (let k = 0; k <= 8; k += 1) {
      const y = doorTop + (winH * k) / 8;
      c.beginPath(); c.moveTo(winX, y); c.lineTo(winX + winW, y); c.stroke();
    }
    c.strokeRect(winX, doorTop, winW, winH);
    const signW = rw * 0.38;
    const signX = doorX + doorW / 2 - signW / 2;
    const signY = h * 0.24;
    c.fillStyle = i % 2 ? '#1d3557' : '#14213d';
    c.fillRect(signX, signY, signW, h * 0.09);
    c.fillStyle = '#ffffff';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    fitFont(c, name, signW * 0.92, { weight: 700, size: Math.round(h * 0.05) });
    c.fillText(name, signX + signW / 2, signY + h * 0.047);
    for (let k = 0; k < 2; k += 1) { // poster/stiker
      c.fillStyle = ['#e07a1f', '#2a9d8f', '#e9c46a', '#e76f51'][Math.floor(rnd() * 4)];
      c.fillRect(x0 + rw * (0.05 + rnd() * 0.08), h * (0.45 + rnd() * 0.15), rw * 0.07, h * 0.14);
    }
  });
  for (let k = 0; k < 120; k += 1) {
    c.fillStyle = `rgba(120,110,90,${rnd() * 0.06})`;
    c.fillRect(rnd() * w, rnd() * h, 10 + rnd() * 30, 4 + rnd() * 20);
  }
  c.textBaseline = 'alphabetic';
  c.font = `600 10px ${FONT}`;
}

// ---------- Geometri ----------

/** Kotak sejajar sumbu dari batas [x0,x1]×[y0,y1]×[z0,z1]. */
function slab(x0, x1, y0, y1, z0, z1) {
  return new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
}

/**
 * Gaya kartun/facet: tambah normal + roughness plester PBR ke dinding kanvas (albedo kanvas dengan bekas selotip dll.
 * dipertahankan). Lantai tidak diganti: keramik PBR yang tersedia (Tiles074) berupa marmer hitam-putih, bukan keramik krem
 * ruang sekre. Dilewati bila kualitas tekstur 'rendah' atau gaya 'asli'. Harus dipanggil di dalam withScope interior.
 */
function upgradeWallWithPbr(mat, uvMeters) {
  if (styleState.style === 'asli' || styleState.terrainQuality === 'rendah') return;
  const set = loadPbr('plaster', { tier: tierForQuality(styleState.terrainQuality), anisotropy: 8, kinds: ['normal', 'orm'] });
  const r = uvMeters / TILE_M.plaster;
  for (const t of [set.normalMap, set.roughnessMap]) t?.repeat.set(r, r);
  mat.normalMap = set.normalMap;
  mat.normalScale = new THREE.Vector2(0.6, 0.6);
  mat.roughnessMap = set.roughnessMap;
  mat.roughness = 1;
  mat.needsUpdate = true;
}

/** UV dari koordinat dunia (proyeksi menurut normal dominan) agar tekstur menyambung antar potongan. */
function worldUv(geo, size) {
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i += 1) {
    const ax = Math.abs(nor.getX(i));
    const ay = Math.abs(nor.getY(i));
    const az = Math.abs(nor.getZ(i));
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (ay >= ax && ay >= az) uv.setXY(i, x / size, z / size);
    else if (ax >= az) uv.setXY(i, z / size, y / size);
    else uv.setXY(i, x / size, y / size);
  }
  uv.needsUpdate = true;
  return geo;
}

function merged(parts) {
  const g = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return g;
}

/** Dinding ruang (dengan bukaan jendela & pintu) + dinding tetangga & balok di sisi selasar. */
function wallGeometry() {
  const { w, d, h, wall: t } = ROOM;
  const hw = w / 2;
  const hd = d / 2;
  const top = WINDOW.sill + WINDOW.h;
  const wx0 = WINDOW.x - WINDOW.w / 2;
  const wx1 = WINDOW.x + WINDOW.w / 2;
  const front = (x0, x1, y0, y1) => slab(x0, x1, y0, y1, -hd - t, -hd);
  return merged([
    slab(-hw - t, -hw, 0, h, -hd - t, hd + t),
    slab(hw, hw + t, 0, h, -hd - t, hd + t),
    slab(-hw, hw, 0, h, hd, hd + t),
    front(-hw, wx0, 0, h),
    front(wx0, wx1, 0, WINDOW.sill),
    front(wx0, wx1, top, h),
    front(wx1, DOOR.x0, 0, h),
    front(DOOR.x0, DOOR.x1, DOOR.h, h),
    front(DOOR.x1, hw, 0, h),
    slab(SELASAR.ujungKiri, -hw - t, 0, SELASAR.tinggiAtap, -hd - t, -hd),  // dinding ruang tetangga kiri
    slab(hw + t, SELASAR.ujungKanan, 0, SELASAR.tinggiAtap, -hd - t, -hd),  // tetangga kanan (BEM, dst.)
    slab(-hw - t, hw + t, h, SELASAR.tinggiAtap, -hd - t, -hd),             // balok di atas dinding depan
  ].map((g) => worldUv(g, PLESTER_M)));
}

/** Lantai keramik + plint 10 cm (kecuali ambang pintu). */
function floorGeometry() {
  const { w, d } = ROOM;
  const hw = w / 2;
  const hd = d / 2;
  const e = 0.012;
  const floor = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2);
  return merged([
    floor,
    slab(-hw, -hw + e, 0, PLINT_H, -hd, hd),
    slab(hw - e, hw, 0, PLINT_H, -hd, hd),
    slab(-hw, hw, 0, PLINT_H, hd - e, hd),
    slab(-hw, DOOR.x0, 0, PLINT_H, -hd, -hd + e),
    slab(DOOR.x1, hw, 0, PLINT_H, -hd, -hd + e),
  ].map((g) => worldUv(g, KERAMIK_M)));
}

function ceilingGeometry() {
  return worldUv(new THREE.PlaneGeometry(ROOM.w, ROOM.d).rotateX(Math.PI / 2).translate(0, ROOM.h, 0), PLAFON_M);
}

/** Atap selasar, rak sepatu & sandal di depan pintu (warna vertex). */
function selasarPropGeometry() {
  const { zDekat, zSeberang, ujungKiri, ujungKanan, tinggiAtap } = SELASAR;
  const parts = [];
  if (SELASAR.beratap) parts.push(tint(slab(ujungKiri, ujungKanan, tinggiAtap, tinggiAtap + 0.06, zSeberang, zDekat), '#8b939c'));
  const rx = 2.55;
  const rz = zDekat - 0.2;
  parts.push(tint(slab(rx - 0.6, rx + 0.6, 0, 0.03, rz - 0.17, rz + 0.17), '#6d4c41')); // rak sepatu P07
  parts.push(tint(slab(rx - 0.6, rx + 0.6, 0.42, 0.45, rz - 0.17, rz + 0.17), '#6d4c41'));
  parts.push(tint(slab(rx - 0.6, rx + 0.6, 0.85, 0.88, rz - 0.17, rz + 0.17), '#6d4c41'));
  for (const x of [rx - 0.58, rx + 0.58]) parts.push(tint(slab(x - 0.02, x + 0.02, 0, 0.9, rz - 0.17, rz + 0.17), '#5d4037'));
  const rnd = makeRng(61);
  for (let i = 0; i < 9; i += 1) { // sepatu di rak + sandal menumpuk di lantai (P08)
    const shelf = i < 5 ? 0.03 : 0.45;
    const x = rx - 0.5 + (i % 5) * 0.24;
    parts.push(tint(slab(x - 0.05, x + 0.05, shelf, shelf + 0.08, rz - 0.13, rz + 0.13), ['#212121', '#1565c0', '#e0e0e0', '#6d4c41', '#c62828'][i % 5]));
  }
  for (let i = 0; i < 7; i += 1) {
    const x = 1.1 + rnd() * 0.6;
    const z = zDekat - 0.35 - rnd() * 0.4;
    const g = slab(-0.05, 0.05, 0, 0.02, -0.12, 0.12).rotateY(rnd() * Math.PI).translate(x, i * 0.012, z);
    parts.push(tint(g, ['#1e88e5', '#43a047', '#212121', '#f9a825'][i % 4]));
  }
  return merged(parts);
}

function rainGeometry() {
  const rnd = makeRng(71);
  const pos = new Float32Array(RAIN_DROPS * 6);
  for (let i = 0; i < RAIN_DROPS; i += 1) {
    const left = i % 2 === 0;
    const x = left ? SELASAR.ujungKiri - 0.2 - rnd() * 1.2 : SELASAR.ujungKanan + 0.2 + rnd() * 1.2;
    const z = SELASAR.zSeberang + rnd() * (SELASAR.zDekat - SELASAR.zSeberang);
    const y = rnd() * 3.8;
    pos.set([x, y, z, x, y + 0.35, z], i * 6);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return g;
}

/**
 * @param {{renderer?: THREE.WebGLRenderer|null}} opts
 * @returns {{staticGroup: THREE.Group, dynamicGroup: THREE.Group, update(dt:number, s:{rain:number}): void}}
 */
export function buildRoom({ renderer = null } = {}) {
  const tex = (draw, w, h, seed) => {
    const canvas = makeCanvas(w, h);
    draw(canvas.getContext('2d'), w, h, seed);
    return canvasTexture(canvas, renderer, { repeat: true });
  };
  const plester = new THREE.MeshStandardMaterial({ map: tex(drawPlester, 512, 512, 11), roughness: 0.92 });
  const keramik = new THREE.MeshStandardMaterial({ map: tex(drawKeramik, 512, 512, 21), roughness: 0.32, envMapIntensity: 0.6 });
  const plafon = new THREE.MeshStandardMaterial({ map: tex(drawPlafon, 512, 512, 31), roughness: 0.95 });
  upgradeWallWithPbr(plester, PLESTER_M);
  const facadeCanvas = makeCanvas(1024, 256);
  drawFacade(facadeCanvas.getContext('2d'), 1024, 256, SELASAR_SEBERANG);
  const facade = new THREE.MeshStandardMaterial({ map: canvasTexture(facadeCanvas, renderer), roughness: 0.9 });
  const selasarFloor = new THREE.MeshStandardMaterial({ color: DRY.clone(), roughness: 0.85 });
  const selasarProp = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
  const rainMat = new THREE.LineBasicMaterial({ color: 0xbcc8d6, transparent: true, opacity: 0, depthWrite: false });

  const staticGroup = new THREE.Group();
  staticGroup.name = 'sekre-ruang';
  const mesh = (geo, mat, name, cast = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.name = name;
    m.castShadow = cast;
    m.receiveShadow = true;
    staticGroup.add(m);
    return m;
  };
  mesh(wallGeometry(), plester, 'dinding');
  mesh(floorGeometry(), keramik, 'lantai', false);
  mesh(ceilingGeometry(), plafon, 'plafon');
  const { zDekat, zSeberang, ujungKiri, ujungKanan, tinggiAtap } = SELASAR;
  mesh(slab(ujungKiri, ujungKanan, -0.1, -0.02, zSeberang, zDekat), selasarFloor, 'selasar-lantai', false);
  const facadeGeo = new THREE.PlaneGeometry(ujungKanan - ujungKiri, tinggiAtap)
    .translate((ujungKiri + ujungKanan) / 2, tinggiAtap / 2, zSeberang);
  mesh(facadeGeo, facade, 'selasar-seberang');
  mesh(selasarPropGeometry(), selasarProp, 'selasar-props');

  const dynamicGroup = new THREE.Group();
  dynamicGroup.name = 'sekre-ruang-dinamis';
  const rain = new THREE.LineSegments(rainGeometry(), rainMat);
  rain.name = 'hujan-ujung-selasar';
  rain.frustumCulled = false;
  rain.visible = false;
  dynamicGroup.add(rain);

  let wet = 0;
  return {
    staticGroup,
    dynamicGroup,
    update(dt, { rain: intensity = 0 } = {}) {
      const d = Number.isFinite(dt) ? Math.max(0, dt) : 0;
      const target = Math.max(0, Math.min(1, intensity));
      wet += (target - wet) * Math.min(1, d * (target > wet ? 0.5 : 0.05)); // basah cepat, kering lambat
      selasarFloor.color.copy(DRY).lerp(WET, wet);
      selasarFloor.roughness = 0.85 - 0.6 * wet;
      rain.visible = target > 0.02;
      rainMat.opacity = 0.55 * target;
      if (!rain.visible) return;
      const pos = rain.geometry.attributes.position;
      for (let i = 0; i < RAIN_DROPS; i += 1) {
        let y = pos.getY(i * 2) - RAIN_SPEED * d;
        if (y < 0) y += 3.8;
        pos.setY(i * 2, y);
        pos.setY(i * 2 + 1, y + 0.35);
      }
      pos.needsUpdate = true;
    },
  };
}
