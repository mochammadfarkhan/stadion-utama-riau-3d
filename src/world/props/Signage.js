/**
 * Papan tanda: plane dengan CanvasTexture (fallback plane polos tanpa document),
 * rambu jalan bertiang, spanduk suporter melengkung, dan papan iklan (billboard).
 * Kanvas teks selalu 1024 px lebar (tinggi proporsional) agar tulisan tajam.
 */
import {
  BoxGeometry, CylinderGeometry, DoubleSide, Group, Mesh, MeshLambertMaterial, PlaneGeometry,
} from 'three';
import { Materials } from '../materials.js';
import { createTextTexture } from './canvasText.js';
import { applyWind } from '../shaders/wind.js';

const TEX_WIDTH_PX = 1024;
const BILLBOARD = Object.freeze({
  width: 4, height: 2, poleHeight: 3, postRadius: 0.07, frame: 0.08, frameDepth: 0.1,
  bg: 0xfaf6ee, fg: 0x1b3f8f, border: 0x1b3f8f,
});
const SIGN_KINDS = Object.freeze({
  info: { bg: 0x1b3f8f, fg: 0xffffff, border: 0xffffff },
  warning: { bg: 0xf2c200, fg: 0x111111, border: 0x111111 },
  direction: { bg: 0x1f7a3a, fg: 0xffffff, border: 0xffffff },
  prohibition: { bg: 0xffffff, fg: 0xc8102e, border: 0xc8102e },
});
const POLE_RADIUS = 0.04;
const BANNER_SEGMENTS = 16;
/** Angin spanduk: kedua ujung terpancang di tiang (uvArc → tengah bergelombang), kibaran kecil. */
const BANNER_WIND = Object.freeze({ weightMode: 'uvArc', amplitude: 0.08, flutter: 0.04 });

/** Material plane teks: bertekstur bila ada document, kalau tidak warna bg polos. */
function createSignMaterial({ text, width, height, bg, fg, border, doubleSided }) {
  const tex = createTextTexture({
    text,
    width: TEX_WIDTH_PX,
    height: Math.max(64, Math.round((TEX_WIDTH_PX * height) / width)),
    bg,
    fg,
    border,
  });
  const params = { color: tex ? 0xffffff : bg, map: tex ?? null };
  return new MeshLambertMaterial(doubleSided ? { ...params, side: DoubleSide } : params);
}

/**
 * Papan tanda datar menghadap +Z, dipusatkan di origin.
 * @param {{text?:string,width?:number,height?:number,bg?:number|string,fg?:number|string,border?:number|string|null,doubleSided?:boolean}} opts
 * @returns {Group} userData.text
 */
export function createSign({ text = '', width = 2, height = 0.6, bg = 0x1b3f8f, fg = 0xffffff, border = null, doubleSided = false } = {}) {
  const group = new Group();
  group.name = `sign:${text}`;
  const mesh = new Mesh(new PlaneGeometry(width, height), createSignMaterial({ text, width, height, bg, fg, border, doubleSided }));
  mesh.name = 'sign-panel';
  group.add(mesh);
  group.userData = { text, width, height };
  return group;
}

/**
 * Rambu bertiang; panel di puncak tiang menghadap +Z.
 * @param {{text?:string,kind?:'info'|'warning'|'direction'|'prohibition',poleHeight?:number,width?:number,height?:number}} opts
 */
export function createRoadSign({ text = '', kind = 'info', poleHeight = 2.4, width = 1.2, height = 0.6 } = {}) {
  const group = new Group();
  group.name = `road-sign:${text}`;
  const pole = new Mesh(new CylinderGeometry(POLE_RADIUS, POLE_RADIUS, poleHeight, 8), Materials.steel());
  pole.position.y = poleHeight / 2;
  pole.name = 'pole';
  const colors = SIGN_KINDS[kind] ?? SIGN_KINDS.info;
  const panel = createSign({ text, width, height, ...colors, doubleSided: true });
  panel.position.set(0, poleHeight - height / 2, POLE_RADIUS + 0.01);
  group.add(pole, panel);
  group.userData = { text, kind };
  return group;
}

/** Plane spanduk dengan lendutan (sag) di tengah. */
function createSaggedPlane(width, height, sag) {
  const geom = new PlaneGeometry(width, height, BANNER_SEGMENTS, 1);
  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const nx = (pos.getX(i) / width) * 2; // −1..1
    pos.setY(i, pos.getY(i) - sag * (1 - nx * nx));
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  return geom;
}

/**
 * Spanduk suporter: dua tiang + kain melendut, menghadap +Z.
 * @param {{text?:string,width?:number,height?:number,bg?:number|string,fg?:number|string,poleHeight?:number,sag?:number}} opts
 */
export function createBanner({ text = '', width = 8, height = 1.2, bg = 0xc8102e, fg = 0xffffff, poleHeight = 2.6, sag = 0.25 } = {}) {
  const group = new Group();
  group.name = `banner:${text}`;
  const clothMat = applyWind(createSignMaterial({ text, width, height, bg, fg, border: null, doubleSided: true }), BANNER_WIND);
  const cloth = new Mesh(createSaggedPlane(width, height, sag), clothMat);
  cloth.position.y = poleHeight - height / 2;
  cloth.name = 'cloth';
  const poleGeom = new CylinderGeometry(POLE_RADIUS, POLE_RADIUS, poleHeight, 8);
  [-1, 1].forEach((side) => {
    const pole = new Mesh(poleGeom, Materials.wood());
    pole.position.set((side * width) / 2, poleHeight / 2, 0);
    pole.name = 'pole';
    group.add(pole);
  });
  group.add(cloth);
  group.userData = { text, width, height };
  return group;
}

/** Bingkai gelap tipis keliling panel (satu mesh) pada ketinggian pusat cy. */
function createBillboardFrame(width, height, cy) {
  const { frame, frameDepth } = BILLBOARD;
  const group = new Group();
  group.name = 'frame';
  const bars = [
    { w: width + frame * 2, h: frame, x: 0, y: height / 2 + frame / 2 },
    { w: width + frame * 2, h: frame, x: 0, y: -height / 2 - frame / 2 },
    { w: frame, h: height, x: -width / 2 - frame / 2, y: 0 },
    { w: frame, h: height, x: width / 2 + frame / 2, y: 0 },
  ];
  bars.forEach((b) => {
    const bar = new Mesh(new BoxGeometry(b.w, b.h, frameDepth), Materials.dark());
    bar.position.set(b.x, cy + b.y, 0);
    group.add(bar);
  });
  return group;
}

/**
 * Papan iklan kecil: dua tiang baja + bingkai gelap + panel teks dua sisi, menghadap +Z.
 * @param {{text?:string,width?:number,height?:number,bg?:number|string,fg?:number|string,border?:number|string|null,poleHeight?:number}} opts
 * @returns {Group} userData.text
 */
export function createBillboard({
  text = '', width = BILLBOARD.width, height = BILLBOARD.height, bg = BILLBOARD.bg, fg = BILLBOARD.fg,
  border = BILLBOARD.border, poleHeight = BILLBOARD.poleHeight,
} = {}) {
  const group = new Group();
  group.name = `billboard:${text}`;
  const cy = poleHeight + height / 2;
  const postGeom = new CylinderGeometry(BILLBOARD.postRadius, BILLBOARD.postRadius, cy, 10);
  [-1, 1].forEach((side) => {
    const post = new Mesh(postGeom, Materials.steel());
    post.position.set((side * width) / 2 - side * 0.3, cy / 2, -BILLBOARD.frameDepth);
    post.castShadow = true;
    post.name = 'post';
    group.add(post);
  });
  group.add(createBillboardFrame(width, height, cy));
  const panel = createSign({ text, width, height, bg, fg, border, doubleSided: true });
  panel.position.set(0, cy, BILLBOARD.frameDepth / 2 + 0.01);
  panel.children[0].castShadow = true;
  group.add(panel);
  group.userData = { text, width, height };
  return group;
}
