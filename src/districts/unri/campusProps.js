/**
 * Props kampus milik distrik (katalog N10, P02): plang lambang UNRI (GLB Blender bila ada, placeholder tekstur
 * canvas) di jalur hijau Jl. Binawidya UNRI ±45 m di dalam Gerbang Soebrantas [INFERENSI penempatan, D7], dan halte
 * Trans Metro Pekanbaru bila node OSM-nya di dalam distrik (D6: kedua node di luar → tidak dipasang).
 * Tinggi tanah diperbarui tiap detik; grup bisa dibekukan freezeStatic → matriks diperbarui manual.
 */
import * as THREE from 'three';
import { withScope } from '../../engine/ResourceScope.js';
import { placeModels } from '../../world/assets/models.js';
import { groupFromParts } from '../../world/siteutil/instanceParts.js';
import { pointInPolygon } from '../../geo/polygon.js';
import { createProjection } from '../../geo/projection.js';
import { WORLD_ORIGIN } from '../../config/constants.js';
import { lambangPlangParts, LAMBANG_MODEL_PATH, LAMBANG_BOARD_Y } from '../../world/props/unri/lambangUnri.js';
import { halteParts, HALTE_MODEL_PATH } from '../../world/props/unri/halteTmp.js';
import { UNRI_BOUNDARY } from './boundary.js';

/** Plang lambang (dunia); muka emblem menghadap selatan (+Z) ke arah pengendara yang masuk dari gerbang. */
export const LAMBANG_SPOT = Object.freeze({ x: -1071.0, z: 2078.0, rotY: Math.PI });

/** Halte TMP OSM (riset §4 [T]; diverifikasi Overpass Task 8 Step 1). */
export const HALTE_TMP_NODES = Object.freeze([
  Object.freeze({ id: 4559431711, lat: 0.4641, lon: 101.373 }),
  Object.freeze({ id: 4559433677, lat: 0.4644, lon: 101.3742 }),
]);

/** Node halte yang berada di dalam batas distrik (dunia). */
export function halteSpotsInDistrict(
  boundary = UNRI_BOUNDARY, projection = createProjection({ lat0: WORLD_ORIGIN.lat, lon0: WORLD_ORIGIN.lon }),
) {
  return HALTE_TMP_NODES
    .map((n) => ({ id: n.id, ...projection.toWorld(n.lat, n.lon) }))
    .filter((p) => pointInPolygon(p.x, p.z, boundary));
}

export function createCampusProps({ scope, terrain, logger = console }) {
  const group = new THREE.Group();
  group.name = 'propsKampus';
  const items = [];
  let cancelled = false;
  const isCancelled = () => cancelled;
  const report = (label) => (r) => { if (r.failed.length) logger.warn(`${label}: GLB gagal, placeholder dipakai:`, r.failed); };

  const plang = withScope(scope, () => groupFromParts(lambangPlangParts(), 'plangLambangUnri'));
  plang.position.set(LAMBANG_SPOT.x, terrain.heightAt(LAMBANG_SPOT.x, LAMBANG_SPOT.z), LAMBANG_SPOT.z);
  plang.rotation.y = LAMBANG_SPOT.rotY;
  group.add(plang);
  items.push({ root: plang, x: LAMBANG_SPOT.x, z: LAMBANG_SPOT.z });
  if (LAMBANG_MODEL_PATH) {
    const slot = new THREE.Group();
    slot.position.set(0, LAMBANG_BOARD_Y, -0.07);
    plang.add(slot);
    withScope(scope, () => placeModels(slot, [{ path: LAMBANG_MODEL_PATH, replaces: 'N10' }], { world: plang, isCancelled }))
      .then(report('Lambang UNRI'))
      .catch((err) => logger.error('Lambang UNRI gagal dipasang:', err));
  }

  const halteSpots = halteSpotsInDistrict();
  for (const h of halteSpots) {
    const holder = new THREE.Group();
    holder.name = `halteTmp:${h.id}`;
    holder.position.set(h.x, terrain.heightAt(h.x, h.z), h.z);
    holder.add(withScope(scope, () => groupFromParts(halteParts(), 'P02')));
    group.add(holder);
    items.push({ root: holder, x: h.x, z: h.z });
    if (HALTE_MODEL_PATH) {
      withScope(scope, () => placeModels(holder, [{ path: HALTE_MODEL_PATH, replaces: 'P02' }], { world: holder, isCancelled }))
        .then(report('Halte TMP'))
        .catch((err) => logger.error('Halte TMP gagal dipasang:', err));
    }
  }

  let reground = 0;
  return {
    group,
    halteCount: halteSpots.length,
    update(dt) {
      reground -= dt;
      if (reground > 0) return;
      reground = 1;
      for (const it of items) {
        it.root.position.y = terrain.heightAt(it.x, it.z);
        it.root.updateMatrix();
        it.root.updateMatrixWorld(true);
      }
    },
    dispose() {
      cancelled = true;
      group.removeFromParent();
    },
  };
}
