/**
 * Placement region stadion di frame dunia ENU (sumber tunggal klien dan citybake; murni), dihitung
 * dari footprint OSM (centroid luas + sumbu panjang, geo/placement.js). Origin dunia = centroid
 * poligon yang sama, jadi hasilnya ≈ identitas (geser < 2 cm, yaw < 0,01°).
 */
import { WORLD_ORIGIN } from '../../config/constants.js';
import { createProjection } from '../../geo/projection.js';
import { placementFromFootprint } from '../../geo/placement.js';
import { STADION_FOOTPRINT_LATLON } from './footprint.js';

const projection = createProjection({ lat0: WORLD_ORIGIN.lat, lon0: WORLD_ORIGIN.lon });

/** Footprint OSM stadion dalam koordinat DUNIA [[x, z], ...]. */
export const STADION_FOOTPRINT = Object.freeze(STADION_FOOTPRINT_LATLON.map(([lat, lon]) => {
  const w = projection.toWorld(lat, lon);
  return Object.freeze([w.x, w.z]);
}));

export const STADION_PLACEMENT = Object.freeze(placementFromFootprint(STADION_FOOTPRINT));
