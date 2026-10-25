/**
 * Visual mini game kebun (dari GLB assets-src/blender/unri/f01_kebun.py): model traktor pemain (roda berputar pada
 * porosnya), rumah panggung, petak tanah (satu InstancedMesh berwarna per status), dan tanaman 3 tahap (InstancedMesh
 * per mesh GLB tahap). Total ±12 draw call; semua sumber dibagikan dari cache loadModel (jangan dispose di sini).
 */
import * as THREE from 'three';
import { KEBUN, tileCenter } from '../../../config/kebun.js';

export const KEBUN_MODELS = Object.freeze({
  traktor: 'models/unri/f01-traktor.glb',
  rumah: 'models/unri/f02-rumah-kebun.glb',
  tanaman: Object.freeze(['models/unri/f03-tanaman-1.glb', 'models/unri/f03-tanaman-2.glb', 'models/unri/f03-tanaman-3.glb']),
});

/** Poros & kursi (three.js; Blender (x, y, z) → (x, z, −y)), selaras AXLE_REAR, AXLE_FRONT, SEAT di f01_kebun.py. */
const AXLE_REAR = new THREE.Vector3(0, 0.62, -0.75);
const AXLE_FRONT = new THREE.Vector3(0, 0.36, 0.95);
const SEAT = new THREE.Vector3(0, 1.18, -0.42);
const FRONT_RATIO = 0.62 / 0.36; // roda depan lebih kecil → berputar lebih cepat

/** Bungkus mesh roda (nama mengandung `kata`) ke pivot di poros agar bisa diputar di sumbu X. */
function wheelPivot(root, kata, axle) {
  const pivot = new THREE.Group();
  pivot.name = `traktor:roda-${kata}`;
  pivot.position.copy(axle);
  const meshes = [];
  root.traverse((o) => { if (o.isMesh && o.name.includes(kata)) meshes.push(o); });
  for (const m of meshes) {
    pivot.add(m); // origin ekspor = 0 → geser balik sebesar poros
    m.position.sub(axle);
  }
  root.add(pivot);
  return pivot;
}

/** @param {THREE.Object3D} source scene GLB traktor (dari cache) → {group, seat, spin(angle)} untuk Bicycle.setTractorModel */
export function buildTractorModel(source) {
  const group = source.clone(true);
  group.name = 'traktor';
  const rear = wheelPivot(group, 'belakang', AXLE_REAR);
  const front = wheelPivot(group, 'depan', AXLE_FRONT);
  return {
    group,
    seat: SEAT.clone(),
    spin(angle) {
      rear.rotation.x = angle;
      front.rotation.x = angle * FRONT_RATIO;
    },
  };
}

const SOIL_COLOR = Object.freeze({ rumput: 0x6f8c45, cangkul: 0x8a5a35, basah: 0x5b3a24 });
const SOIL_H = Object.freeze({ rumput: 0.02, cangkul: 0.1, basah: 0.1 });

/** InstancedMesh per mesh sumber tahap tanaman (kapasitas = semua petak; count diatur saat update). */
function plantLayer(source, capacity, stage) {
  const layer = new THREE.Group();
  layer.name = `kebun:tanaman-${stage}`;
  source.updateMatrixWorld(true);
  source.traverse((o) => {
    if (!o.isMesh) return;
    const im = new THREE.InstancedMesh(o.geometry, o.material, capacity);
    im.name = `kebun:tanaman-${stage}:${o.name}`;
    im.castShadow = true;
    im.count = 0;
    im.userData.base = o.matrixWorld.clone();
    layer.add(im);
  });
  return layer;
}

/**
 * @param {{houseSource:THREE.Object3D, plantSources:THREE.Object3D[], heightAt:(x:number,z:number)=>number}} opts
 * @returns {{group:THREE.Group, center:{x:number,z:number}, update(farm:{tiles:ReadonlyArray<object>}):void,
 *   relayout(farm:object):boolean, dispose():void}} relayout: tinggi tanah dihitung ulang (terrain belum ter-stream saat
 *   dibuat → heightAt 0); kembalikan true bila berubah.
 */
export function createFarmView({ houseSource, plantSources, heightAt }) {
  const k = KEBUN;
  const n = k.cols * k.rows;
  const group = new THREE.Group();
  group.name = 'kebun';
  const house = houseSource.clone(true);
  house.name = 'kebun:rumah';
  house.position.set(k.house.x, 0, k.house.z);
  house.rotation.y = k.house.yaw;
  group.add(house);

  const soilGeo = new THREE.BoxGeometry(k.tile * 0.9, 1, k.tile * 0.9).translate(0, 0.5, 0);
  const soilMat = new THREE.MeshStandardMaterial({ roughness: 1, color: 0xffffff });
  soilMat.name = 'kebun:tanah';
  const soil = new THREE.InstancedMesh(soilGeo, soilMat, n);
  soil.name = 'kebun:petak';
  soil.receiveShadow = true;
  group.add(soil);
  const layers = plantSources.map((src, i) => plantLayer(src, n, i + 1));
  group.add(...layers);

  let ground = [];
  let probe = NaN; // tinggi tanah pusat lahan saat terakhir ditata
  const center = { x: k.origin.x + (k.cols * k.tile) / 2, z: k.origin.z + (k.rows * k.tile) / 2 };
  const m = new THREE.Matrix4();
  const color = new THREE.Color();
  const yawOf = (i) => (i * 2.399) % (Math.PI * 2); // variasi putaran tanaman

  function update(farm) {
    const counts = [0, 0, 0];
    farm.tiles.forEach((t, i) => {
      const g = ground[i];
      const kind = !t.tilled ? 'rumput' : t.watered ? 'basah' : 'cangkul';
      m.makeScale(1, SOIL_H[kind], 1).setPosition(g.x, g.y, g.z);
      soil.setMatrixAt(i, m);
      soil.setColorAt(i, color.setHex(SOIL_COLOR[kind]));
      if (!t.crop) return;
      const s = t.crop.stage - 1;
      const at = new THREE.Matrix4().makeRotationY(yawOf(i)).setPosition(g.x, g.y + SOIL_H[kind], g.z);
      for (const im of layers[s].children) im.setMatrixAt(counts[s], m.multiplyMatrices(at, im.userData.base));
      counts[s] += 1;
    });
    soil.instanceMatrix.needsUpdate = true;
    if (soil.instanceColor) soil.instanceColor.needsUpdate = true;
    layers.forEach((layer, s) => layer.children.forEach((im) => {
      im.count = counts[s];
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
    }));
    soil.computeBoundingSphere();
  }

  function relayout(farm) {
    const h = heightAt(center.x, center.z);
    if (Math.abs(h - probe) < 0.01) return false;
    probe = h;
    ground = Array.from({ length: n }, (_, i) => {
      const c = tileCenter(i % k.cols, Math.floor(i / k.cols));
      return { ...c, y: heightAt(c.x, c.z) };
    });
    house.position.y = heightAt(k.house.x, k.house.z);
    house.updateMatrixWorld(true);
    update(farm);
    return true;
  }

  return {
    group,
    center,
    update,
    relayout,
    dispose() {
      group.removeFromParent();
      soilGeo.dispose();
      soilMat.dispose();
      soil.dispose();
      for (const layer of layers) for (const im of layer.children) im.dispose();
    },
  };
}
