/**
 * OSM via Overpass API: query per bbox, cache ke data-src/osm/<area>.json, normalisasi ke Feature.
 * Etika: User-Agent mengidentifikasi aplikasi, satu permintaan pada satu waktu, backoff saat 429/5xx,
 * hasil di-cache sehingga bake ulang tidak membebani server.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { cleanRing, pointInPolygon, polygonArea } from '../../src/geo/polygon.js';
import { OVERPASS_ENDPOINTS, USER_AGENT, ROAD_CLASSES, WATERWAY_WIDTHS, LANDUSE_COLORS } from './config.js';

const BASE_BACKOFF_MS = 15000;
const DEFAULT_RETRIES = 4;
/** Batas waktu satu permintaan; sedikit di atas [timeout:180] pada query. */
const REQUEST_TIMEOUT_MS = 200000;
/** Batas atas kontribusi Retry-After agar server tidak bisa menahan bake terlalu lama. */
const RETRY_AFTER_CAP_MS = 300000;

/** Query Overpass QL untuk bbox {south, west, north, east}; `out geom` menyertakan koordinat. */
export function buildOverpassQuery({ south, west, north, east }) {
  const b = [south, west, north, east].map((v) => v.toFixed(7)).join(',');
  return [
    '[out:json][timeout:180];',
    '(',
    `  way["building"](${b});`,
    `  relation["building"]["type"="multipolygon"](${b});`,
    `  way["highway"](${b});`,
    `  way["waterway"](${b});`,
    `  way["natural"="water"](${b});`,
    `  relation["natural"="water"](${b});`,
    `  way["landuse"](${b});`,
    `  relation["landuse"]["type"="multipolygon"](${b});`,
    `  way["leisure"~"^(park|pitch|stadium|sports_centre|playground|garden)$"](${b});`,
    `  way["natural"~"^(wood|scrub|grassland|wetland)$"](${b});`,
    `  way["amenity"~"^(parking|school|university|grave_yard)$"](${b});`,
    ');',
    'out geom;',
  ].join('\n');
}

/** Kelas landuse dari tag (kunci LANDUSE_COLORS) atau null. */
export function landuseClassOf(tags) {
  const lu = tags.landuse;
  const map = {
    residential: 'residential', commercial: 'commercial', retail: 'retail', industrial: 'industrial',
    education: 'education', religious: 'religious', cemetery: 'cemetery', grass: 'grass',
    meadow: 'grass', village_green: 'grass', recreation_ground: 'park', forest: 'forest',
    farmland: 'farmland', orchard: 'farmland', plantation: 'farmland', construction: 'construction',
    brownfield: 'construction', greenfield: 'grass',
  };
  if (lu && map[lu]) return map[lu];
  const leisure = { park: 'park', garden: 'park', playground: 'park', pitch: 'pitch', stadium: 'pitch', sports_centre: 'pitch' };
  if (tags.leisure && leisure[tags.leisure]) return leisure[tags.leisure];
  const natural = { wood: 'forest', scrub: 'scrub', grassland: 'grass', wetland: 'wetland' };
  if (tags.natural && natural[tags.natural]) return natural[tags.natural];
  const amenity = { parking: 'parking', school: 'education', university: 'education', grave_yard: 'cemetery' };
  if (tags.amenity && amenity[tags.amenity]) return amenity[tags.amenity];
  return null;
}

const isWater = (tags) =>
  tags.natural === 'water' || tags.waterway === 'riverbank' || tags.landuse === 'reservoir' || tags.landuse === 'basin';

/**
 * Tentukan {kind, cls} untuk tag; `closed` = way tertutup / multipolygon. null = abaikan.
 * Urutan prioritas: building → highway → air → waterway → landuse.
 */
export function classify(tags, closed) {
  if (tags.building && tags.building !== 'no' && closed) return { kind: 'building', cls: tags.building };
  if (tags.highway) {
    if (tags.area === 'yes' || !ROAD_CLASSES[tags.highway]) return null;
    return { kind: 'road', cls: tags.highway };
  }
  if (closed && isWater(tags)) return { kind: 'water', cls: 'water' };
  if (tags.waterway && WATERWAY_WIDTHS[tags.waterway] && !closed) return { kind: 'waterway', cls: tags.waterway };
  if (closed) {
    const lu = landuseClassOf(tags);
    if (lu && LANDUSE_COLORS[lu]) return { kind: 'landuse', cls: lu };
  }
  return null;
}

const toLonLat = (geometry) => geometry.map((p) => [p.lon, p.lat]);
const sameLL = (a, b) => a[0] === b[0] && a[1] === b[1];

/**
 * Sambung potongan way (anggota multipolygon) menjadi ring tertutup. Potongan yang tidak menutup
 * dibuang. @param {Array<Array<[number, number]>>} segments
 */
export function joinSegments(segments) {
  const pool = segments.filter((s) => s.length >= 2).map((s) => s.slice());
  const rings = [];
  while (pool.length > 0) {
    let cur = pool.shift();
    let extended = true;
    while (!sameLL(cur[0], cur[cur.length - 1]) && extended) {
      extended = false;
      const end = cur[cur.length - 1];
      for (let i = 0; i < pool.length; i += 1) {
        const s = pool[i];
        if (sameLL(s[0], end)) cur = cur.concat(s.slice(1));
        else if (sameLL(s[s.length - 1], end)) cur = cur.concat(s.slice(0, -1).reverse());
        else continue;
        pool.splice(i, 1);
        extended = true;
        break;
      }
    }
    if (sameLL(cur[0], cur[cur.length - 1])) {
      const ring = cleanRing(cur, 0);
      if (ring.length >= 3) rings.push(ring);
    }
  }
  return rings;
}

function normalizeWay(el) {
  if (!el.tags || !Array.isArray(el.geometry) || el.geometry.length < 2) return null;
  const pts = toLonLat(el.geometry);
  const closed = pts.length >= 4 && sameLL(pts[0], pts[pts.length - 1]);
  const c = classify(el.tags, closed);
  if (!c) return null;
  const base = { id: `osm:way/${el.id}`, source: 'osm', kind: c.kind, cls: c.cls, tags: el.tags };
  if (c.kind === 'road' || c.kind === 'waterway') return { ...base, line: pts };
  const ring = cleanRing(pts, 0);
  return ring.length >= 3 ? { ...base, rings: [ring] } : null;
}

function normalizeRelation(el) {
  if (!el.tags || el.tags.type !== 'multipolygon' || !Array.isArray(el.members)) return [];
  const c = classify(el.tags, true);
  if (!c || c.kind === 'road' || c.kind === 'waterway') return [];
  const geomOf = (role) =>
    el.members.filter((m) => m.type === 'way' && m.role === role && Array.isArray(m.geometry)).map((m) => toLonLat(m.geometry));
  const outers = joinSegments(geomOf('outer'));
  const inners = joinSegments(geomOf('inner'));
  // Tiap lubang ditempelkan ke ring luar TERKECIL yang memuat titik pertamanya (kasus bersarang:
  // luar A ⊃ lubang H ⊃ pulau B ⊃ lubang H2 → H2 milik B, bukan A).
  const areas = outers.map((o) => polygonArea(o));
  const ownerOf = (h) => {
    let best = -1;
    outers.forEach((o, k) => {
      if (pointInPolygon(h[0][0], h[0][1], o) && (best < 0 || areas[k] < areas[best])) best = k;
    });
    return best;
  };
  const owners = inners.map(ownerOf);
  return outers.map((outer, k) => {
    const holes = inners.filter((_, i) => owners[i] === k);
    return { id: `osm:relation/${el.id}#${k}`, source: 'osm', kind: c.kind, cls: c.cls, tags: el.tags, rings: [outer, ...holes] };
  });
}

/**
 * Normalisasi respons Overpass JSON. Fitur diurutkan menurut id agar keluaran deterministik.
 * @returns {{ timestamp: string|null, features: import('./features.js').Feature[] }}
 */
export function normalizeOsm(raw) {
  if (!raw || !Array.isArray(raw.elements)) throw new TypeError('respons Overpass tidak valid: tidak ada "elements"');
  const features = [];
  for (const el of raw.elements) {
    if (el.type === 'way') {
      const f = normalizeWay(el);
      if (f) features.push(f);
    } else if (el.type === 'relation') {
      features.push(...normalizeRelation(el));
    }
  }
  features.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { timestamp: raw.osm3s?.timestamp_osm_base ?? null, features };
}

/** 429 dan semua 5xx dicoba ulang (Overpass publik sering 500/502/504 saat sibuk). */
const isRetryableStatus = (status) => status === 429 || status >= 500;

/** Galat HTTP non-retryable (4xx selain 429). */
class FatalHttpError extends Error {}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Overpass kadang membalas 200 dengan HTML/remark "runtime error" saat sibuk → perlu retry. */
async function parseOverpassResponse(res) {
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return { retry: true, reason: `bukan JSON (${text.slice(0, 80).replace(/\s+/g, ' ')})` };
  }
  if (typeof json.remark === 'string' && /runtime error|timeout|out of memory/i.test(json.remark)) {
    return { retry: true, reason: `remark: ${json.remark.slice(0, 120)}` };
  }
  return { json };
}

/**
 * POST query ke Overpass dengan retry + backoff eksponensial (menghormati Retry-After), bergiliran
 * antar endpoint. @returns {Promise<object>} JSON mentah Overpass
 */
export async function fetchOverpass(query, {
  endpoints = OVERPASS_ENDPOINTS, fetchImpl = globalThis.fetch, sleep = defaultSleep,
  retries = DEFAULT_RETRIES, log = console,
} = {}) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const url = endpoints[attempt % endpoints.length];
    let waitMs = BASE_BACKOFF_MS * 2 ** attempt;
    try {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams({ data: query }).toString(),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (res.ok) {
        const parsed = await parseOverpassResponse(res);
        if (parsed.json) return parsed.json;
        lastError = new Error(`Overpass ${url}: ${parsed.reason}`);
      } else if (isRetryableStatus(res.status)) {
        const ra = Number(res.headers?.get?.('retry-after'));
        if (Number.isFinite(ra) && ra > 0) waitMs = Math.max(waitMs, Math.min(ra * 1000, RETRY_AFTER_CAP_MS));
        lastError = new Error(`Overpass ${url}: HTTP ${res.status}`);
      } else {
        throw new FatalHttpError(`Overpass ${url}: HTTP ${res.status} (tidak dicoba ulang)`);
      }
    } catch (err) {
      // Galat jaringan, termasuk AbortError/TimeoutError dari batas waktu, dicoba ulang.
      if (err instanceof FatalHttpError) throw err;
      lastError = err;
    }
    if (attempt < retries) {
      log.warn(`[citybake] ${lastError.message} — coba lagi dalam ${Math.round(waitMs / 1000)} s`);
      await sleep(waitMs);
    }
  }
  throw new Error(`Overpass gagal setelah ${retries + 1} percobaan: ${lastError?.message}`);
}

/** Path cache OSM untuk kawasan. */
export const osmCachePath = (cacheDir, areaId) => join(cacheDir, 'osm', `${areaId}.json`);

/**
 * Muat OSM mentah untuk kawasan: dari cache bila ada, selain itu fetch (kecuali offline) lalu simpan.
 * @returns {Promise<object>} JSON mentah Overpass
 */
export async function loadOsm(areaId, bbox, { cacheDir, offline = false, fetchOptions = {}, log = console } = {}) {
  const path = osmCachePath(cacheDir, areaId);
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw new Error(`cache OSM rusak (${path}): ${err.message}`, { cause: err });
  }
  if (offline) throw new Error(`mode --offline tetapi cache OSM tidak ada: ${path}`);
  log.info(`[citybake] mengambil OSM "${areaId}" dari Overpass…`);
  const raw = await fetchOverpass(buildOverpassQuery(bbox), { log, ...fetchOptions });
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(raw));
  return raw;
}
