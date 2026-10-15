/**
 * Matahari dan bulan yang terlihat di langit: dua sprite per benda (cakram + halo lembut),
 * aditif, mengikuti kamera pada jarak tetap. Kubah awan menutup Sky addon sehingga cakram
 * bawaan Sky tidak terlihat; sprite ini mengisi kekosongan itu. Depth-test tetap aktif,
 * jadi bangunan dan atap menutupi benda langit seperti seharusnya.
 */
import * as THREE from 'three';
import { sunMoonWeight } from '../sim/dayCycle.js';

const DISTANCE = 1700;        // m dari kamera (di dalam far plane 2500)
const SUN_DISC = 120;         // diameter cakram (≈ 4°)
const SUN_GLOW = 700;
const MOON_DISC = 95;
const MOON_GLOW = 420;
const SUN_FADE_DEG = 3;       // matahari memudar tepat di sekitar horizon
const CLOUD_DIM_SUN = 0.85;
const CLOUD_DIM_MOON = 0.9;
const HORIZON_GLOW_BOOST = 0.9;

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const finite = (v, fallback) => (Number.isFinite(v) ? v : fallback);

/**
 * Seberapa terlihat matahari/bulan dan seberapa besar halo (murni, dites).
 * @param {{elevationDeg:number, cloudCover?:number}} p
 * @returns {{sunOpacity:number, moonOpacity:number, glowScale:number}}
 */
export function celestialLook({ elevationDeg, cloudCover = 0 }) {
  const elev = finite(elevationDeg, 90);
  const cloud = clamp01(finite(cloudCover, 0));
  const sunOpacity = clamp01((elev + SUN_FADE_DEG) / (2 * SUN_FADE_DEG)) * (1 - CLOUD_DIM_SUN * cloud);
  const moonOpacity = (1 - sunMoonWeight(elev)) * (1 - CLOUD_DIM_MOON * cloud);
  const glowScale = 1 + HORIZON_GLOW_BOOST * (1 - clamp01(elev / 35));
  return { sunOpacity, moonOpacity, glowScale };
}

/** Tekstur radial: inti padat hingga `core`, lalu memudar halus ke tepi. */
function radialTexture(core) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(core, 'rgba(255,255,255,1)');
  grad.addColorStop(Math.min(0.99, core + 0.12), 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSprite(texture, color, size) {
  const mat = new THREE.SpriteMaterial({
    map: texture, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
    depthWrite: false, fog: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.setScalar(size);
  sprite.frustumCulled = false;
  sprite.renderOrder = -1; // sesudah kubah langit, sebelum geometri berdepth-test
  return sprite;
}

const _p = new THREE.Vector3();

/**
 * @returns {{group: THREE.Group, update(camera:THREE.Camera, sunDir:THREE.Vector3, moonDir:THREE.Vector3,
 *   look:{sunOpacity:number, moonOpacity:number, glowScale:number}, sunColor:number): void}}
 */
export function createCelestialBodies() {
  const group = new THREE.Group();
  group.name = 'bendaLangit';
  if (typeof document === 'undefined') return { group, update() {} }; // Node/tes: tanpa kanvas

  const disc = radialTexture(0.55);
  const glow = radialTexture(0);
  const sunGlow = makeSprite(glow, 0xffc98a, SUN_GLOW);
  const sunDisc = makeSprite(disc, 0xfff4d6, SUN_DISC);
  const moonGlow = makeSprite(glow, 0x9db8ff, MOON_GLOW);
  const moonDisc = makeSprite(disc, 0xeaf0ff, MOON_DISC);
  group.add(sunGlow, sunDisc, moonGlow, moonDisc);

  const place = (sprites, camera, dir) => {
    _p.copy(camera.position).addScaledVector(dir, DISTANCE);
    for (const s of sprites) s.position.copy(_p);
  };

  return {
    group,
    update(camera, sunDir, moonDir, look, sunColor) {
      place([sunGlow, sunDisc], camera, sunDir);
      place([moonGlow, moonDisc], camera, moonDir);
      sunDisc.material.opacity = look.sunOpacity;
      sunGlow.material.opacity = look.sunOpacity * 0.6;
      sunGlow.material.color.setHex(sunColor);
      sunGlow.scale.setScalar(SUN_GLOW * look.glowScale);
      moonDisc.material.opacity = look.moonOpacity;
      moonGlow.material.opacity = look.moonOpacity * 0.45;
      const visibleSun = look.sunOpacity > 0.01;
      const visibleMoon = look.moonOpacity > 0.01;
      sunGlow.visible = sunDisc.visible = visibleSun;
      moonGlow.visible = moonDisc.visible = visibleMoon;
    },
  };
}
