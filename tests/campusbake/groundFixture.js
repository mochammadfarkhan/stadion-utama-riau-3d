/**
 * Fixture bake ground (koordinat dunia). Batas distrik uji = persegi 0…400 (di chunk 0_0); jalan tersier
 * z = 200 menembus batas di x = 0 dan x = 400. Heightfield datar 0, kecuali dasar kolam (42…78)² = −1,5 m.
 */
const sq = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
const f = (id, kind, cls, geom, tags = {}) => ({ id: `osm:way/${id}`, source: 'osm', kind, cls, tags, ...geom });

export const BOUNDARY = sq(0, 0, 400, 400);

export const FEATURES = [
  f(1, 'road', 'tertiary', { line: [[-50, 200], [450, 200]] }, { highway: 'tertiary' }),
  f(2, 'road', 'footway', { line: [[100, 50], [100, 350]] }, { highway: 'footway' }),
  f(3, 'road', 'service', { line: [[100, 0], [100, 30]] }, { highway: 'service', service: 'parking_aisle' }),
  f(4, 'road', 'footway', { line: [[50, 60], [70, 60]] }, { highway: 'footway', bridge: 'yes' }),
  f(5, 'road', 'path', { line: [[300, 300], [380, 300]] }, { highway: 'path' }),
  f(6, 'landuse', 'parking', { rings: [sq(250, 250, 300, 300)] }, { amenity: 'parking' }),
  f(7, 'water', 'water', { rings: [sq(40, 40, 80, 80)] }, { natural: 'water' }),
  f(8, 'landuse', 'pitch', { rings: [sq(150, 250, 200, 290)] }, { leisure: 'pitch' }),
  f(9, 'landuse', 'pitch', { rings: [sq(210, 320, 240, 360)] }, { leisure: 'stadium' }),
  f(10, 'landuse', 'forest', { rings: [sq(300, 20, 390, 120)] }, { natural: 'wood' }),
  f(11, 'landuse', 'farmland', { rings: [sq(20, 300, 120, 390)] }, { landuse: 'orchard', trees: 'oil_palms' }),
  f(12, 'building', 'yes', { rings: [sq(150, 100, 170, 120)] }, { building: 'yes' }),
  f(13, 'waterway', 'ditch', { line: [[200, 20], [200, 120]] }, { waterway: 'ditch' }),
  f(14, 'landuse', 'park', { rings: [sq(-50, 450, 50, 480)] }, { leisure: 'park' }),
];

export const PLAZAS = [{ id: 'osm:way/15', rings: [sq(320, 220, 360, 240)] }];

export const FIELD = Object.freeze({
  heightAt: (x, z) => (x > 42 && x < 78 && z > 42 && z < 78 ? -1.5 : 0),
  normalAt: (x, z, out = { x: 0, y: 1, z: 0 }) => Object.assign(out, { x: 0, y: 1, z: 0 }),
});
