/**
 * Sumber data bake ground: cache OSM kampus (citybake area "unri") dan heightfield hasil bake terrain M1.
 * I/O di sini saja; sisanya murni.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { normalizeOsm } from '../../citybake/fetchOsm.js';
import { projectFeatures } from '../../citybake/features.js';
import { cleanRing } from '../../../src/geo/polygon.js';
import { parseTileKey } from '../../../src/geo/tiles.js';
import { createHeightField, decodeChunk } from '../../../src/geo/terrain/heightfield.js';
import { BIAS, CHUNK_SIZE, N, STEP, UNIT } from '../../../src/geo/terrain/format.js';

/** Muat JSON Overpass mentah dari cache; tanpa cache → galat berisi langkah unduh (spec §10). */
export async function loadOsmSource(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`cache OSM kampus tidak ada: ${path}. Jalankan dulu (online, sekali): npm run bake -- --area unri`, { cause: err });
    }
    throw new Error(`cache OSM kampus rusak (${path}): ${err.message}`, { cause: err });
  }
}

const isPlazaWay = (el) => el.type === 'way' && el.tags && Array.isArray(el.geometry) && el.geometry.length >= 4
  && ((el.tags.highway === 'pedestrian' && el.tags.area === 'yes') || el.tags.place === 'square');

/**
 * Fitur citybake ter-normalisasi & terproyeksi (dunia) + plaza (way pejalan kaki berbentuk area, yang
 * dibuang normalizeOsm) + stempel waktu OSM.
 */
export function projectOsm(raw, projection) {
  const { features, timestamp } = normalizeOsm(raw);
  const plazas = raw.elements.filter(isPlazaWay).map((el) => ({
    id: `osm:way/${el.id}`,
    rings: [cleanRing(el.geometry.map((p) => {
      const w = projection.toWorld(p.lat, p.lon);
      return [w.x, w.z];
    }), 1e-3)],
  })).filter((p) => p.rings[0].length >= 3);
  return { features: projectFeatures(features, projection), plazas, timestamp };
}

/** Header chunk terrain (spec §4.1) dari kunci "ix_iz". */
export function chunkHeader(key) {
  const t = parseTileKey(key);
  if (!t) throw new Error(`kunci chunk terrain tidak valid: "${key}"`);
  return {
    key, ix: t.ix, iz: t.iz, origin: { x: t.ix * CHUNK_SIZE, z: t.iz * CHUNK_SIZE },
    size: CHUNK_SIZE, step: STEP, n: N, unit: UNIT, bias: BIAS,
  };
}

/** HeightField dari `<districtDir>/manifest.json` + `terrain/<key>.bin` (hasil `bake:campus -- terrain`). */
export async function loadTerrainField(districtDir) {
  const manifest = JSON.parse(await readFile(join(districtDir, 'manifest.json'), 'utf8'));
  const keys = manifest?.terrain?.chunks;
  if (!Array.isArray(keys) || keys.length === 0) {
    throw new Error(`manifest distrik tanpa terrain.chunks (${districtDir}) — jalankan npm run bake:campus -- terrain dulu`);
  }
  const field = createHeightField();
  for (const key of keys) {
    const buf = await readFile(join(districtDir, 'terrain', `${key}.bin`));
    field.add(decodeChunk(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), chunkHeader(key)));
  }
  return { manifest, keys: [...keys], field };
}
