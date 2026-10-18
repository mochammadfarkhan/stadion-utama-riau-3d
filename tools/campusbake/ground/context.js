/**
 * Kueri gabungan untuk aturan bobot, parit, vegetasi, dan props (murni). Semua jarak "Edge" = jarak ke tepi
 * pita/poligon (bukan sumbu), Infinity bila jauh.
 */
import { pointInPolygon } from '../../../src/geo/polygon.js';
import { createAreaIndex, createLineIndex } from './spatial.js';
import { SURFACE_RULES } from './constants.js';

/**
 * @param {{roads:object[], walks:object[], soilPaths:object[], areas:object[], landcover:object[], buildings:object[]}} E
 * @param {{boundary: Array<[number, number]>, field: {normalAt(x:number, z:number, out?:object): {x:number,y:number,z:number}}}} opts
 */
export function createGroundContext(E, { boundary, field }) {
  const roads = createLineIndex(E.roads, { reach: 12 });
  const walks = createLineIndex(E.walks, { reach: 6 });
  const soil = createLineIndex(E.soilPaths, { reach: 6 });
  const areas = createAreaIndex(E.areas, { reach: 8 });
  const buildings = createAreaIndex(E.buildings.map((b) => ({ id: b.id, rings: [b.ring] })), { reach: 6 });
  const rank = (k) => SURFACE_RULES.priority.indexOf(k);
  const cover = createAreaIndex([...E.landcover].sort((a, b) => rank(a.kind) - rank(b.kind)), { reach: 0 });
  const isWater = (a) => a.kind === 'water';
  return Object.freeze({
    inside: (x, z) => pointInPolygon(x, z, boundary),
    roadEdge: (x, z) => roads.nearest(x, z),
    walkEdge: (x, z) => walks.nearest(x, z),
    soilPathEdge: (x, z) => soil.nearest(x, z),
    area: (x, z) => areas.contains(x, z),
    waterEdge: (x, z) => areas.edgeDistance(x, z, isWater),
    building: (x, z) => buildings.contains(x, z),
    buildingEdge: (x, z) => buildings.edgeDistance(x, z),
    cover: (x, z) => cover.contains(x, z),
    grade: (x, z) => {
      const n = field.normalAt(x, z);
      return n.y > 0 ? Math.hypot(n.x, n.z) / n.y : Infinity;
    },
  });
}
