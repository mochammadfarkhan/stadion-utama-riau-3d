import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { COLORS } from '../config/constants.js';

const SUN_ELEVATION_DEG = 28; // sore ±16.30 WIB
const SUN_AZIMUTH_DEG = 250;  // matahari di barat-barat daya
const SUN_INTENSITY = 4.5;
const SUN_COLOR = 0xffe6c4;
const SHADOW_EXTENT = 230;
const SHADOW_MAP_SIZE = 4096;
const FOG_NEAR = 220;
const FOG_FAR = 1100;
const SKY_SCALE = 450000;

/**
 * Langit prosedural, matahari sore tropis, cahaya hemisphere, kabut, dan env map.
 * @returns {THREE.Group} group berisi semua cahaya; userData.update menganimasikan awan.
 */
export function createLighting(scene, renderer) {
  const group = new THREE.Group();
  group.name = 'lighting';

  const sunDir = sunDirection();
  const sky = createSky(sunDir);
  const sun = createSun(sunDir);
  const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x6f8f4a, 0.9);

  group.add(sky, sun, sun.target, hemi);
  scene.fog = new THREE.Fog(0xd6e6f5, FOG_NEAR, FOG_FAR);
  scene.background = new THREE.Color(COLORS.sky);
  applyEnvironment(scene, renderer, sunDir);

  group.userData.update = (dt, t) => {
    sky.material.uniforms.time.value = t * 0.02;
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
  u.turbidity.value = 5;
  u.rayleigh.value = 1.8;
  u.mieCoefficient.value = 0.006;
  u.mieDirectionalG.value = 0.82;
  if (u.cloudCoverage) u.cloudCoverage.value = 0.35;
  if (u.cloudDensity) u.cloudDensity.value = 0.45;
  return sky;
}

function createSun(sunDir) {
  const sun = new THREE.DirectionalLight(SUN_COLOR, SUN_INTENSITY);
  sun.position.copy(sunDir).multiplyScalar(600);
  sun.castShadow = true;
  const s = sun.shadow;
  s.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
  s.camera.left = -SHADOW_EXTENT;
  s.camera.right = SHADOW_EXTENT;
  s.camera.top = SHADOW_EXTENT;
  s.camera.bottom = -SHADOW_EXTENT;
  s.camera.near = 50;
  s.camera.far = 1400;
  s.bias = -0.0004;
  s.normalBias = 0.2;
  return sun;
}

function applyEnvironment(scene, renderer, sunDir) {
  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    const envSky = createSky(sunDir);
    envSky.material.uniforms.showSunDisc && (envSky.material.uniforms.showSunDisc.value = 0);
    envScene.add(envSky);
    scene.environment = pmrem.fromScene(envScene, 0.04).texture;
    scene.environmentIntensity = 0.6;
    pmrem.dispose();
  } catch (err) {
    console.warn('Env map gagal dibuat, memakai cahaya hemisphere saja', err);
  }
}
