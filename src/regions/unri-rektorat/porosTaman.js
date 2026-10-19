// src/regions/unri-rektorat/porosTaman.js
/**
 * Poros taman menuju Rektorat: V04 akasia ramping (4 baris) + V05 palem, P04 bangku beton, PJU, P06 tiang
 * bendera Merah Putih di pulau taman parkir (sumbu Rektorat), jalan setapak beton di tengah median.
 * Foto 2016 [T]: barisan pohon ramping + palem mengapit poros, rumput luas, jalan setapak beton;
 * spesies, jumlah, posisi bangku/PJU [INFERENSI].
 */
import * as THREE from 'three';
import { instanceParts } from '../../world/siteutil/instanceParts.js';
import { createBenches } from '../../world/props/Bench.js';
import { createLampPosts } from '../../world/props/LampPost.js';
import { buildStripedFlagGeometry, FLAG_INDONESIA } from '../../world/props/Flagpole.js';
import { applyWind } from '../../world/shaders/wind.js';
import { akasiaParts } from '../../world/props/unri/akasiaRamping.js';
import { palemParts } from '../../world/props/unri/palem.js';
import { LAYOUT } from './layout.js';
import { MATS } from './materials.js';
import { drapePolylineLocal } from './env.js';

/** Angin bendera: sama dengan Flagpole.js (x = 0 menempel tiang → diam). */
const FLAG_WIND = Object.freeze({ weightMode: 'localX', xMin: 0, xMax: 2.4, amplitude: 0.25, flutter: 0.08 });
const withY = (env, list) => list.map((p) => ({ ...p, y: env.hAt(p.x, p.z) }));

function tiangBendera(env) {
  const t = LAYOUT.tiangBendera;
  const g = new THREE.Group();
  g.name = 'tiangBenderaRektorat';
  g.position.set(t.x, env.hAt(t.x, t.z), t.z);
  const alas = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.45, 1.4), MATS.granit());
  alas.position.y = 0.225;
  alas.castShadow = true;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, t.tinggi, 10), MATS.dinding());
  pole.position.y = 0.45 + t.tinggi / 2;
  pole.castShadow = true;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), MATS.emas());
  knob.position.y = 0.45 + t.tinggi + 0.12;
  const flagMat = MATS.bendera(() => {
    const m = applyWind(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), FLAG_WIND);
    m.name = 'rektorat:bendera';
    return m;
  });
  const flag = new THREE.Mesh(buildStripedFlagGeometry(FLAG_INDONESIA), flagMat);
  flag.position.y = 0.45 + t.tinggi - 0.3;
  flag.rotation.y = 0.6;
  flag.castShadow = true;
  flag.name = 'benderaMerahPutih';
  g.add(alas, pole, knob, flag);
  return g;
}

/** @returns {{raw: THREE.Group, instanced: THREE.Group}} raw digabung per material; instanced dipasang apa adanya */
export function buildPorosTaman(env) {
  const raw = new THREE.Group();
  raw.name = 'porosTamanStatis';
  const walk = new THREE.Mesh(drapePolylineLocal(env, LAYOUT.jalurPoros, 2.4, { lift: 0.06, segment: 2 }), MATS.paving());
  walk.name = 'plazaPaving';
  walk.receiveShadow = true;
  raw.add(walk);
  const inst = new THREE.Group();
  inst.name = 'porosTaman';
  inst.add(instanceParts(akasiaParts(), withY(env, LAYOUT.akasia), 'akasiaRamping'));
  inst.add(instanceParts(palemParts(), withY(env, LAYOUT.palem), 'palem'));
  inst.add(createBenches(withY(env, LAYOUT.bangku)));
  inst.add(createLampPosts(withY(env, LAYOUT.pju)));
  inst.add(tiangBendera(env));
  return { raw, instanced: inst };
}
