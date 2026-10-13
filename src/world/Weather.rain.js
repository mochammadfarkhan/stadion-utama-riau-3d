/**
 * Partikel hujan: goresan tetes (LineSegments + ShaderMaterial, animasi di GPU,
 * kotak mengikuti kamera dengan wrap) dan cipratan di tanah (InstancedMesh cincin).
 * Tidak ada alokasi per frame.
 */
import * as THREE from 'three';
import { WEATHER } from '../config/constants.js';

const DROP_COLOR = 0xcfe0ff;
const DROP_OPACITY = 0.55;
const SPLASH_COLOR = 0xdfeaff;
const SPLASH_OPACITY = 0.45;
const SPLASH_Y = 0.12;            // di atas marka/kerb (LAYER_Y.kerb = 0.08)
const SPLASH_MAX_RADIUS = 0.28;

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();

const RAIN_VERT = /* glsl */ `
  attribute float aSpeed;
  attribute float aTail;
  uniform float uTime;
  uniform vec3 uCenter;
  uniform vec3 uBox;
  uniform vec2 uWind;
  uniform float uLen;
  uniform float uIntensity;
  varying float vAlpha;
  void main() {
    vec3 origin = uCenter - uBox * 0.5;
    vec3 p = position;
    p.y -= uTime * aSpeed;
    p.xz += uTime * uWind;
    p = mod(p - origin, uBox) + origin;
    // ekor goresan searah kecepatan jatuh (+angin)
    p.y += aTail * uLen;
    p.xz -= aTail * uWind * (uLen / aSpeed);
    // tetes dengan indeks > intensitas disembunyikan (alpha 0) agar transisi halus
    vAlpha = step(fract(aSpeed * 17.31), uIntensity);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const RAIN_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;
  void main() {
    gl_FragColor = vec4(uColor, uOpacity * vAlpha);
  }
`;

/** Geometri 2 titik per tetes; posisi awal acak di kotak, aTail 0 (kepala) / 1 (ekor). */
function createDropGeometry(count, box) {
  const pos = new Float32Array(count * 6);
  const speed = new Float32Array(count * 2);
  const tail = new Float32Array(count * 2);
  for (let i = 0; i < count; i += 1) {
    const x = Math.random() * box.x;
    const y = Math.random() * box.y;
    const z = Math.random() * box.z;
    const v = THREE.MathUtils.lerp(WEATHER.fallSpeedMin, WEATHER.fallSpeedMax, Math.random());
    pos.set([x, y, z, x, y, z], i * 6);
    speed.set([v, v], i * 2);
    tail.set([0, 1], i * 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
  geo.setAttribute('aTail', new THREE.BufferAttribute(tail, 1));
  return geo;
}

function createDrops() {
  const box = WEATHER.rainBox;
  const mat = new THREE.ShaderMaterial({
    vertexShader: RAIN_VERT,
    fragmentShader: RAIN_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uCenter: { value: new THREE.Vector3() },
      uBox: { value: new THREE.Vector3(box.x, box.y, box.z) },
      uWind: { value: new THREE.Vector2(WEATHER.wind.x, WEATHER.wind.z) },
      uLen: { value: WEATHER.streakLength },
      uIntensity: { value: 0 },
      uColor: { value: new THREE.Color(DROP_COLOR) },
      uOpacity: { value: DROP_OPACITY },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const lines = new THREE.LineSegments(createDropGeometry(WEATHER.dropCount, box), mat);
  lines.name = 'hujan';
  lines.frustumCulled = false;
  lines.visible = false;
  return lines;
}

/** Cipratan: cincin kecil instanced, masing-masing punya umur & posisi acak di sekitar sepeda. */
function createSplashes() {
  const geo = new THREE.RingGeometry(0.6, 1, 10).rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color: SPLASH_COLOR, transparent: true, opacity: SPLASH_OPACITY, depthWrite: false, fog: true,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, WEATHER.splashCount);
  mesh.name = 'cipratan';
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const ages = new Float32Array(WEATHER.splashCount).map(() => Math.random() * WEATHER.splashLife);
  const xs = new Float32Array(WEATHER.splashCount);
  const zs = new Float32Array(WEATHER.splashCount);
  return { mesh, ages, xs, zs };
}

function respawnSplash(sp, i, center) {
  const r = Math.sqrt(Math.random()) * WEATHER.splashRadius;
  const th = Math.random() * Math.PI * 2;
  sp.xs[i] = center.x + Math.cos(th) * r;
  sp.zs[i] = center.z + Math.sin(th) * r;
  sp.ages[i] = 0;
}

/** Perbarui umur, skala (membesar), dan posisi cipratan; bagian di luar intensitas disembunyikan. */
function updateSplashes(sp, dt, intensity, center) {
  const active = Math.floor(WEATHER.splashCount * intensity);
  for (let i = 0; i < WEATHER.splashCount; i += 1) {
    sp.ages[i] += dt;
    if (sp.ages[i] >= WEATHER.splashLife) respawnSplash(sp, i, center);
    const t = sp.ages[i] / WEATHER.splashLife;
    const scale = i < active ? SPLASH_MAX_RADIUS * (0.2 + 0.8 * t) : 0;
    _p.set(sp.xs[i], SPLASH_Y, sp.zs[i]);
    _s.set(scale, 1, scale);
    sp.mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
  }
  sp.mesh.instanceMatrix.needsUpdate = true;
  sp.mesh.material.opacity = SPLASH_OPACITY * intensity;
}

/**
 * @returns {{ update(dt, intensity, camera, bikePos): void, setWind(scale): void, group: THREE.Group }}
 */
export function createRain(scene) {
  const group = new THREE.Group();
  group.name = 'cuacaHujan';
  const drops = createDrops();
  const splashes = createSplashes();
  group.add(drops, splashes.mesh);
  scene.add(group);
  let time = 0;

  return {
    group,
    /** Skala angin relatif WEATHER.wind (1 = default). */
    setWind(scale) {
      const k = Math.max(0, Number(scale) || 0);
      drops.material.uniforms.uWind.value.set(WEATHER.wind.x * k, WEATHER.wind.z * k);
    },
    update(dt, intensity, camera, bikePos) {
      const on = intensity > 0.001;
      drops.visible = on;
      splashes.mesh.visible = on;
      if (!on) return;
      time += dt;
      const u = drops.material.uniforms;
      u.uTime.value = time;
      u.uIntensity.value = intensity;
      u.uCenter.value.copy(camera.position);
      updateSplashes(splashes, dt, intensity, bikePos);
    },
  };
}
