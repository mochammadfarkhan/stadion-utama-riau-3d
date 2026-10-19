// src/regions/unri-rektorat/perpustakaan.js
/**
 * Perpustakaan UNRI lama (OSM way 282225374) — H08: "empat gedung, masing-masing dua lantai" [S, ringkasan
 * lib.unri.ac.id]. Empat kuadran dirakit kit K01 (planBuilding/buildBuilding, M3; atap limas seng
 * [INFERENSI]) + penghubung/tonjolan masuk 2 lt beratap datar + papan nama hitam huruf putih (N05 gaya)
 * di tonjolan timur. Kit gagal → kotak + limas cadangan (spec §10) dengan peringatan.
 */
import * as THREE from 'three';
import { planBuilding } from '../../world/kit/planBuilding.js';
import { buildBuilding } from '../../world/kit/buildBuilding.js';
import { createKitMaterials } from '../../world/kit/kitMaterials.js';
import { makeTextMaterial } from '../../world/siteutil/textCanvas.js';
import { PERPUS_MASSA } from './site.data.js';
import { MATS } from './materials.js';
import { REKTORAT_PLACEMENT as P } from './placement.js';
import { addBox } from './rektorat.js';

export const PERPUS = Object.freeze({ levels: 2, tinggi: 7.6, link: 5.4, osmId: 282225374, teks: 'PERPUSTAKAAN UNIVERSITAS RIAU' });
/** Matriks dunia → lokal region (yaw 0). */
const TO_LOCAL = new THREE.Matrix4().makeTranslation(-P.x, 0, -P.z);

const boundsOf = (ring) => {
  const xs = ring.map((p) => p[0]);
  const zs = ring.map((p) => p[1]);
  return [[Math.min(...xs), Math.max(...xs)], [Math.min(...zs), Math.max(...zs)]];
};

function kitMass(group, ringLocal, i, env, kitMats) {
  const ring = ringLocal.map(([x, z]) => [x + P.x, z + P.z]);
  const plan = planBuilding({
    id: `w${PERPUS.osmId}-${i}`, ring, levels: PERPUS.levels, archetype: 'K01',
    overrides: { roof: 'limas' }, seed: PERPUS.osmId + i, groundY: (x, z) => env.field.heightAt(x, z),
  });
  for (const part of buildBuilding(plan, kitMats)) {
    const m = new THREE.Mesh(part.geometry, part.material);
    m.applyMatrix4(TO_LOCAL.clone().multiply(part.matrix ?? new THREE.Matrix4()));
    m.castShadow = part.castShadow ?? true;
    m.receiveShadow = true;
    m.name = 'perpusKit';
    group.add(m);
  }
}

function fallbackMass(group, ringLocal, y0) {
  const [[x0, x1], [z0, z1]] = boundsOf(ringLocal);
  addBox(group, MATS.perpusDinding(), [x0, x1], [y0, y0 + PERPUS.tinggi], [z0, z1], { name: 'perpusCadangan' });
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0), MATS.atapSeng());
  roof.scale.set(x1 - x0 + 1.6, 3.0, z1 - z0 + 1.6);
  roof.position.set((x0 + x1) / 2, y0 + PERPUS.tinggi, (z0 + z1) / 2);
  roof.castShadow = true;
  roof.name = 'perpusAtapCadangan';
  group.add(roof);
}

/** @returns {THREE.Group} raw statis (digabung oleh index.js) */
export function buildPerpustakaan(env, scope, { logger = console } = {}) {
  const raw = new THREE.Group();
  raw.name = 'perpustakaanLama';
  const y0 = env.hAt(-113, -62);
  let kitMats = null;
  try {
    kitMats = createKitMaterials(scope);
  } catch (err) {
    logger.warn('Perpustakaan: material kit gagal dibuat, massa cadangan dipakai:', err);
  }
  PERPUS_MASSA.kuadran.forEach((ringLocal, i) => {
    try {
      if (!kitMats) throw new Error('kit tidak tersedia');
      kitMass(raw, ringLocal, i, env, kitMats);
    } catch (err) {
      logger.warn(`Perpustakaan massa ${i}: kit gagal → kotak cadangan:`, err);
      fallbackMass(raw, ringLocal, y0);
    }
  });
  for (const r of PERPUS_MASSA.penghubung) {
    const h = PERPUS.link;
    addBox(raw, MATS.perpusDinding(), [r.x0, r.x1], [y0, y0 + h], [r.z0, r.z1], { name: 'perpusPenghubung' });
    addBox(raw, MATS.dinding(), [r.x0 - 0.15, r.x1 + 0.15], [y0 + h, y0 + h + 0.3], [r.z0 - 0.15, r.z1 + 0.15], { name: 'perpusAtapPenghubung' });
    // tonjolan masuk barat/timur (sisi luar mengarah ±X): pita kaca gelap lobi + kanopi beton tipis
    if (r.x0 < -130 || r.x1 > -90) {
      const out = r.x1 > -90 ? [r.x1, r.x1 + 0.04] : [r.x0 - 0.04, r.x0];
      addBox(raw, MATS.kacaPita(), out, [y0 + 0.4, y0 + 3.4], [r.z0 + 0.9, r.z1 - 0.9], { cast: false, name: 'perpusKacaLobi' });
      const ext = r.x1 > -90 ? [r.x1, r.x1 + 1.6] : [r.x0 - 1.6, r.x0];
      addBox(raw, MATS.dinding(), ext, [y0 + 3.6, y0 + 3.9], [r.z0 + 0.4, r.z1 - 0.4], { name: 'perpusKanopiLobi' });
    }
  }
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 0.9),
    makeTextMaterial(PERPUS.teks, { bg: '#121417', fg: '#ffffff', width: 1536, height: 224, font: 'bold 120px sans-serif', padding: 36 }),
  );
  sign.rotation.y = Math.PI / 2;
  sign.position.set(-84.5 + 0.03, y0 + 4.65, -61.45);
  sign.name = 'perpusPapanNama';
  raw.add(sign);
  return raw;
}
