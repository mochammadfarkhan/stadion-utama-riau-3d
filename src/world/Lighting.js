import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { COLORS } from '../config/constants.js';

const SUN_ELEVATION_DEG = 28; // sore ±16.30 WIB
const SUN_AZIMUTH_DEG = 250;  // matahari di barat-barat daya
// Satuan fisik (r155+): matahari dominan agar bayangan terbaca, ambient kebiruan dari hemisphere.
const SUN_INTENSITY = 4.5;
const SUN_COLOR = 0xfff1dc;            // matahari sore hangat (pastel)
const HEMI_SKY = COLORS.shadowTint;    // cahaya langit kebiruan -> bayangan lembut biru
const HEMI_GROUND = 0xd8d2ad;          // pantulan tanah krem-hijau
const HEMI_INTENSITY = 1.0;
// Env map dari Sky bersifat HDR sangat terang (~13x kontribusi matahari per unit intensitas);
// nilai kecil ini setara "±0.9" pada env map LDR dan menjaga bayangan tetap terlihat.
const ENV_INTENSITY = 0.12;
const SUN_DISTANCE = 600;
const SHADOW_EXTENT = 200;          // setengah lebar frustum bayangan (m), mengikuti sepeda
const SHADOW_MAP_SIZE = 2048;
const SHADOW_DEPTH_PAD = 300;       // ±jarak sepanjang arah cahaya yang dicakup near/far
const SHADOW_TEXEL = (SHADOW_EXTENT * 2) / SHADOW_MAP_SIZE;
// VSM r186: radius >= 3 pada frustum +-200 m menghapus bayangan (kontras turun >50%); 1.5 = lembut tapi terbaca.
const SHADOW_RADIUS = 1.5;
const SHADOW_BLUR_SAMPLES = 8;
const SHADOW_BIAS = -0.0005;        // VSM: bias negatif kecil, cukup untuk mencegah acne
const SHADOW_NORMAL_BIAS = 0.05;
const SKY_TURBIDITY = 2.5;          // langit biru bersih
const SKY_RAYLEIGH = 1.6;
const FOG_NEAR = 220;
const FOG_FAR = 1100;
const SKY_SCALE = 450000;

const _center = new THREE.Vector3();
const _lightSpace = new THREE.Vector3();

/**
 * Langit prosedural, matahari sore tropis, cahaya hemisphere, kabut, dan env map.
 * @returns {THREE.Group} group berisi semua cahaya; userData.update(dt, t, focus?)
 *   menganimasikan awan dan menggeser frustum bayangan mengikuti titik fokus (sepeda).
 */
export function createLighting(scene, renderer) {
  const group = new THREE.Group();
  group.name = 'lighting';

  const sunDir = sunDirection();
  const sky = createSky(sunDir);
  const sun = createSun(sunDir);
  const hemi = new THREE.HemisphereLight(HEMI_SKY, HEMI_GROUND, HEMI_INTENSITY);
  const follow = createShadowFollower(sun, sunDir);

  group.add(sky, sun, sun.target, hemi);
  renderer.shadowMap.type = THREE.VSMShadowMap; // bayangan lembut (blur variance)
  scene.fog = new THREE.Fog(COLORS.fog, FOG_NEAR, FOG_FAR);
  scene.background = new THREE.Color(COLORS.sky);
  applyEnvironment(scene, renderer, sunDir);

  group.userData.update = (dt, t, focus) => {
    sky.material.uniforms.time.value = t * 0.02;
    if (focus) follow(focus);
  };
  return group;
}

function sunDirection() {
  const phi = THREE.MathUtils.degToRad(90 - SUN_ELEVATION_DEG);
  const theta = THREE.MathUtils.degToRad(SUN_AZIMUTH_DEG);
  return new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
}

function createSky(sunDir) {
  const sky = new Sky();
  sky.scale.setScalar(SKY_SCALE);
  const u = sky.material.uniforms;
  u.sunPosition.value.copy(sunDir);
  u.turbidity.value = SKY_TURBIDITY;
  u.rayleigh.value = SKY_RAYLEIGH;
  u.mieCoefficient.value = 0.006;
  u.mieDirectionalG.value = 0.82;
  if (u.cloudCoverage) u.cloudCoverage.value = 0.35;
  if (u.cloudDensity) u.cloudDensity.value = 0.45;
  return sky;
}

/** Matahari dengan frustum bayangan ketat (±SHADOW_EXTENT, near/far pas) dan blur VSM. */
function createSun(sunDir) {
  const sun = new THREE.DirectionalLight(SUN_COLOR, SUN_INTENSITY);
  sun.position.copy(sunDir).multiplyScalar(SUN_DISTANCE);
  sun.castShadow = true;
  const s = sun.shadow;
  s.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
  s.camera.left = -SHADOW_EXTENT;
  s.camera.right = SHADOW_EXTENT;
  s.camera.top = SHADOW_EXTENT;
  s.camera.bottom = -SHADOW_EXTENT;
  s.camera.near = SUN_DISTANCE - SHADOW_DEPTH_PAD;
  s.camera.far = SUN_DISTANCE + SHADOW_DEPTH_PAD;
  s.camera.updateProjectionMatrix();
  s.radius = SHADOW_RADIUS;
  s.blurSamples = SHADOW_BLUR_SAMPLES;
  s.bias = SHADOW_BIAS;
  s.normalBias = SHADOW_NORMAL_BIAS;
  return sun;
}

/**
 * Pembuat fungsi yang menggeser matahari + target agar frustum bayangan berpusat
 * di titik fokus. Pergeseran dibulatkan ke kelipatan texel di ruang cahaya
 * supaya tepi bayangan tidak bergetar saat sepeda bergerak.
 */
function createShadowFollower(sun, sunDir) {
  const toLight = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().lookAt(sunDir, new THREE.Vector3(), new THREE.Vector3(0, 1, 0)),
  );
  const fromLight = toLight.clone().invert();
  return (focus) => {
    _lightSpace.set(focus.x, 0, focus.z).applyQuaternion(fromLight);
    _lightSpace.x = Math.round(_lightSpace.x / SHADOW_TEXEL) * SHADOW_TEXEL;
    _lightSpace.y = Math.round(_lightSpace.y / SHADOW_TEXEL) * SHADOW_TEXEL;
    _center.copy(_lightSpace).applyQuaternion(toLight);
    sun.target.position.copy(_center);
    sun.position.copy(sunDir).multiplyScalar(SUN_DISTANCE).add(_center);
  };
}

function applyEnvironment(scene, renderer, sunDir) {
  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    const envSky = createSky(sunDir);
    envSky.material.uniforms.showSunDisc && (envSky.material.uniforms.showSunDisc.value = 0);
    envScene.add(envSky);
    scene.environment = pmrem.fromScene(envScene, 0.04).texture;
    scene.environmentIntensity = ENV_INTENSITY;
    pmrem.dispose();
  } catch {
    // Env map opsional: tanpa env map, pencahayaan hemisphere sudah cukup.
  }
}
