import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { createStylizedClouds } from './StylizedClouds.js';
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
// VSM r186: radius >= 3 pada frustum +-200 m menghapus bayangan (kontras turun >50%); 1.5 = lembut tapi terbaca.
const SHADOW_RADIUS = 1.5;
const SHADOW_BLUR_SAMPLES = 8;
const SHADOW_BIAS = -0.0005;        // VSM: bias negatif kecil, cukup untuk mencegah acne
const SHADOW_NORMAL_BIAS = 0.05;
const SKY_TURBIDITY = 2.5;          // langit biru bersih
const SKY_RAYLEIGH = 1.6;
const CLOUD_COVERAGE = 0.35;
const CLOUD_DENSITY = 0.45;
const FOG_NEAR = 220;
const FOG_FAR = 1100;
const SKY_SCALE = 450000;
const ENV_SIGMA = 0.04;

const _center = new THREE.Vector3();
const _lightSpace = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _origin = new THREE.Vector3();
const _lookAt = new THREE.Matrix4();

/** Arah satuan dari elevasi & azimut (derajat). */
export function directionFromAngles(elevationDeg, azimuthDeg, out = new THREE.Vector3()) {
  const phi = THREE.MathUtils.degToRad(90 - elevationDeg);
  const theta = THREE.MathUtils.degToRad(azimuthDeg);
  return out.setFromSphericalCoords(1, phi, theta);
}

/**
 * Langit prosedural, matahari sore tropis, cahaya hemisphere, kabut, dan env map.
 * @returns {THREE.Group} group berisi semua cahaya; userData berisi:
 *   update(dt, t, focus?)  — animasi awan + geser frustum bayangan mengikuti titik fokus (sepeda)
 *   sun, hemi, sky, clouds, skyUniforms, envSky — objek cahaya untuk diubah modul TimeOfDay/Weather
 *   setSunDirection(dir)   — ubah arah matahari (bayangan + Sky)
 *   setSkyDirection(dir)   — ubah posisi matahari di Sky saja (saat lampu arah = bulan)
 *   rebuildEnvironment()   — regenerasi PMREM env map dari Sky saat ini
 *   defaults               — nilai awal (env intensity, kabut, awan)
 */
export function createLighting(scene, renderer) {
  const group = new THREE.Group();
  group.name = 'lighting';

  const sunDir = directionFromAngles(SUN_ELEVATION_DEG, SUN_AZIMUTH_DEG);
  const sky = createSky(sunDir);
  const sun = createSun(sunDir);
  const hemi = new THREE.HemisphereLight(HEMI_SKY, HEMI_GROUND, HEMI_INTENSITY);
  const follower = createShadowFollower(sun, sunDir);
  const env = createEnvironment(scene, renderer, sunDir);

  const clouds = createStylizedClouds();
  group.add(sky, clouds, sun, sun.target, hemi);
  renderer.shadowMap.type = THREE.VSMShadowMap; // bayangan lembut (blur variance)
  scene.fog = new THREE.Fog(COLORS.fog, FOG_NEAR, FOG_FAR);
  scene.background = new THREE.Color(COLORS.sky);
  env.rebuild();

  Object.assign(group.userData, {
    sun, hemi, sky, clouds, skyUniforms: sky.material.uniforms, envSky: env.envSky,
    defaults: Object.freeze({ envIntensity: ENV_INTENSITY, fogNear: FOG_NEAR, fogFar: FOG_FAR, cloudCoverage: CLOUD_COVERAGE, cloudDensity: CLOUD_DENSITY }),
    /** shadowFrame=false: frustum bayangan tidak diikutkan, agar peta bayangan basi tidak bergeser (shimmer). */
    update: (dt, t, focus, shadowFrame = true) => {
      sky.material.uniforms.time.value = t * 0.02;
      const su = sky.material.uniforms;
      clouds.userData.update(t, su.cloudCoverage ? su.cloudCoverage.value : CLOUD_COVERAGE, su.sunPosition.value);
      if (focus && shadowFrame) follower.follow(focus);
    },
    /** Setengah lebar frustum bayangan (m): 200 default; mode kamera 3/4 memakai area kecil agar bayangan tajam & murah. */
    setShadowExtent: (extent) => {
      const c = sun.shadow.camera;
      if (c.right === extent) return;
      c.left = -extent; c.right = extent; c.top = extent; c.bottom = -extent;
      c.updateProjectionMatrix();
      sun.shadow.needsUpdate = true;
    },
    shadowExtentDefault: SHADOW_EXTENT,
    setSunDirection: (dir) => {
      follower.setDirection(dir);
      sky.material.uniforms.sunPosition.value.copy(dir);
    },
    setSkyDirection: (dir) => sky.material.uniforms.sunPosition.value.copy(dir),
    rebuildEnvironment: env.rebuild,
  });
  return group;
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
  if (u.cloudCoverage) u.cloudCoverage.value = CLOUD_COVERAGE;
  if (u.cloudDensity) u.cloudDensity.value = 0; // awan digambar StylizedClouds; cloudCoverage tetap jadi penggerak
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
 * Pengikut bayangan: menggeser matahari + target agar frustum bayangan berpusat
 * di titik fokus. Pergeseran dibulatkan ke kelipatan texel di ruang cahaya
 * supaya tepi bayangan tidak bergetar saat sepeda bergerak. setDirection(dir)
 * memperbarui arah cahaya (dipanggil TimeOfDay hanya saat jam berubah).
 */
function createShadowFollower(sun, initialDir) {
  const dir = initialDir.clone();
  const toLight = new THREE.Quaternion();
  const fromLight = new THREE.Quaternion();
  const setDirection = (d) => {
    dir.copy(d).normalize();
    toLight.setFromRotationMatrix(_lookAt.lookAt(dir, _origin, _up));
    fromLight.copy(toLight).invert();
    sun.position.copy(dir).multiplyScalar(SUN_DISTANCE).add(sun.target.position);
  };
  const follow = (focus) => {
    const sc = sun.shadow.camera;
    const texel = (sc.right - sc.left) / Math.max(1, sun.shadow.mapSize.x); // ukuran texel mengikuti frustum & peta saat ini
    _lightSpace.set(focus.x, Number.isFinite(focus.y) ? focus.y : 0, focus.z).applyQuaternion(fromLight); // frustum ikut tanah
    _lightSpace.x = Math.round(_lightSpace.x / texel) * texel;
    _lightSpace.y = Math.round(_lightSpace.y / texel) * texel;
    _center.copy(_lightSpace).applyQuaternion(toLight);
    sun.target.position.copy(_center);
    sun.position.copy(dir).multiplyScalar(SUN_DISTANCE).add(_center);
  };
  setDirection(initialDir);
  return { setDirection, follow };
}

/**
 * Env map PMREM dari salinan Sky (tanpa cakram matahari). envSky dibagikan agar
 * TimeOfDay dapat menyamakan uniform-nya sebelum rebuild(). Tekstur lama dibuang.
 */
function createEnvironment(scene, renderer, sunDir) {
  const envScene = new THREE.Scene();
  const envSky = createSky(sunDir);
  if (envSky.material.uniforms.showSunDisc) envSky.material.uniforms.showSunDisc.value = 0;
  envScene.add(envSky);
  // Satu generator seumur hidup: membuat ulang tiap rebuild ±13x lebih lambat (27 ms vs 2 ms).
  let pmrem = null;
  let envTarget = null;
  const rebuild = () => {
    try {
      pmrem ??= new THREE.PMREMGenerator(renderer);
      const next = pmrem.fromScene(envScene, ENV_SIGMA);
      envTarget?.dispose(); // render target lama (bukan hanya texture) dilepas
      envTarget = next;
      scene.environment = next.texture;
      scene.environmentIntensity = ENV_INTENSITY;
    } catch {
      // Env map opsional: tanpa env map, pencahayaan hemisphere sudah cukup.
    }
  };
  return { envSky, rebuild };
}
