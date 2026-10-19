/**
 * Kompleks lapangan + halaman + gubuk panahan di sekitar gedung UKM blok biru (dokumen sekre-ukm §3.2–3.3):
 * tiga lapangan (voli, basket, tenis) dari generator `courtSpec`, baris palem (instanced), halaman beton di sisi
 * dalam L, dan gubuk panahan beratap merah. Semua posisi dari UKM_LAYOUT (region-lokal); pad terrain rata.
 */
import * as THREE from 'three';
import { currentScope } from '../../engine/ResourceScope.js';
import { instanceParts } from '../../world/siteutil/instanceParts.js';
import { palemParts } from '../../world/props/unri/palem.js';
import { quad } from '../../world/props/unri/geom.js';
import { mergeAll } from '../../world/siteutil/rounded.js';
import { surfaceMaterial } from '../../world/Ground.materials.js';
import { buildCourts, createCourtMaterials } from './courts.js';
import { UKM_LAYOUT } from './ukmLayout.js';
import { staged } from './staged.js';

const PALM_SCALE = 0.6;
const YARD_LIFT = 0.05;
const HUT = Object.freeze({ eave: 2.9, ridge: 4.2, overhang: 0.35, post: 0.16, slab: 0.1 });

const named = (m, name) => {
  m.name = name;
  return m;
};

function ukmMaterials() {
  return currentScope().get('ukm:kompleks-material', () => ({
    halaman: Object.assign(surfaceMaterial('concrete', { color: 0xa9a8a2 }), {
      name: 'halamanBeton', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }),
    slab: named(new THREE.MeshStandardMaterial({ color: 0xb9b6ad, roughness: 0.95 }), 'gubukLantai'),
    atap: named(new THREE.MeshStandardMaterial({ color: 0xa8302c, roughness: 0.5, metalness: 0.3, side: THREE.DoubleSide }), 'gubukAtapMerah'),
    tiang: named(new THREE.MeshStandardMaterial({ color: 0xd9d5c7, roughness: 0.8 }), 'gubukTiang'),
  }));
}

/** Halaman beton: satu persegi datar (UV = meter) di atas pad. */
function yardMesh(box, mats, y) {
  const by = y((box.minX + box.maxX) / 2, (box.minZ + box.maxZ) / 2) + YARD_LIFT;
  const geo = quad(
    [[box.minX, by, box.maxZ], [box.maxX, by, box.maxZ], [box.maxX, by, box.minZ], [box.minX, by, box.minZ]],
    [[box.minX, box.maxZ], [box.maxX, box.maxZ], [box.maxX, box.minZ], [box.minX, box.minZ]],
  );
  const m = new THREE.Mesh(geo, mats.halaman);
  m.name = 'halaman-beton';
  m.receiveShadow = true;
  return m;
}

/** Atap pelana memanjang Z: dua sisi miring (tritisan `overhang`), bubungan di tengah. */
function hutRoof(box, y0) {
  const { eave, ridge, overhang } = HUT;
  const cx = (box.minX + box.maxX) / 2;
  const x0 = box.minX - overhang;
  const x1 = box.maxX + overhang;
  const z0 = box.minZ - overhang;
  const z1 = box.maxZ + overhang;
  const ye = y0 + eave;
  const yr = y0 + ridge;
  return mergeAll([
    quad([[x0, ye, z1], [cx, yr, z1], [cx, yr, z0], [x0, ye, z0]]),
    quad([[cx, yr, z1], [x1, ye, z1], [x1, ye, z0], [cx, yr, z0]]),
  ]);
}

function hutGeometries(hut, y) {
  const { box, posts } = hut;
  const cx = (box.minX + box.maxX) / 2;
  const cz = (box.minZ + box.maxZ) / 2;
  const y0 = y(cx, cz);
  const slab = new THREE.BoxGeometry(box.maxX - box.minX - 0.2, HUT.slab, box.maxZ - box.minZ - 0.2).translate(cx, y0 + HUT.slab / 2, cz);
  const tiang = mergeAll(posts.map(([x, z]) => new THREE.BoxGeometry(HUT.post, HUT.eave, HUT.post).translate(x, y0 + HUT.eave / 2, z)));
  return { slab, tiang, atap: hutRoof(box, y0) };
}

/** @param {{heightAt:(lx:number, lz:number)=>number, mats?:object, layout?:object}} opts */
export function createKompleksBuilder({ heightAt, layout = UKM_LAYOUT }) {
  const m = ukmMaterials();
  const courtMats = createCourtMaterials(layout.courts);
  return staged('ukm-kompleks', [
    () => buildCourts(layout.courts, courtMats, heightAt),
    () => {
      const parts = palemParts().map((p) => ({ ...p, matrix: new THREE.Matrix4().makeScale(PALM_SCALE, PALM_SCALE, PALM_SCALE) }));
      const positions = layout.palms.map(([x, z], i) => ({ x, y: heightAt(x, z), z, rotY: (i * 2.399) % (Math.PI * 2) }));
      return instanceParts(parts, positions, 'ukm-palem', { cellSize: 0 });
    },
    () => yardMesh(layout.yard, m, heightAt),
    () => {
      const g = hutGeometries(layout.hut, heightAt);
      const out = new THREE.Group();
      out.name = 'gubuk-panahan';
      for (const [geo, mat, name, cast] of [[g.slab, m.slab, 'lantai', false], [g.tiang, m.tiang, 'tiang', true], [g.atap, m.atap, 'atap', true]]) {
        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = `gubuk:${name}`;
        mesh.castShadow = cast;
        mesh.receiveShadow = true;
        out.add(mesh);
      }
      return out;
    },
  ], null, { merge: false });
}
