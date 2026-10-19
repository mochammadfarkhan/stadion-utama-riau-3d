/**
 * campusbake langkah `buildings`: gedung OSM di dalam batas distrik UNRI → public/districts/unri/buildings.json
 * (format src/districts/unri/buildingsFormat.js). Sumber gedung: way `building=*`, relation multipolygon
 * `building=*` (ring luar terbesar + lubang), dan "gedung tersirat": way tertutup amenity=university|college
 * BERNAMA tanpa tag building/leisure/landuse, luas 150–10.000 m², tidak memuat gedung lain (IC, HSC, Gedung
 * Mangkrak FISIP dipetakan begini di OSM). `front` = vektor satuan centroid → jalan terdekat ≤ 80 m dari
 * ground/<key>.json (M2; cadangan highway OSM). Deterministik: urut id, kuantisasi 0,1 m, satu gedung per baris.
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { cleanRing, orientRing, pointInPolygon, polygonArea, polygonCentroid } from '../../src/geo/polygon.js';
import { BUILDINGS_FORMAT, clusterKey, validateBuildingsData } from '../../src/districts/unri/buildingsFormat.js';
import { SYNTHETIC_BUILDINGS } from '../../src/districts/unri/buildings.data.js';
import { parseGroundChunk } from '../../src/districts/unri/groundData.js';

const TAG_KEEP = Object.freeze(['name', 'building', 'amenity', 'building:levels', 'building:roof', 'building:walls', 'office']);
const IMPLIED = Object.freeze({ minArea: 150, maxArea: 10000 });
const ROAD_CLASSES = new Set(['primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'service', 'living_street', 'pedestrian', 'footway', 'path']);
export const BUILDINGS_PATHS = Object.freeze({
  osm: Object.freeze(['data-src/osm/unri.json', 'data-src/osm/stadion.json']), // unri.json (area bake M2, lebih baru) menang; stadion.json cadangan
  ground: 'public/districts/unri/ground', out: 'public/districts/unri/buildings.json',
});

const q1 = (v) => Number((Math.round(v / BUILDINGS_FORMAT.quant) * BUILDINGS_FORMAT.quant).toFixed(1));

/** "4-7" → 4 (rentang → minimum, sama dengan parseLevels M2); tidak valid → null. */
export function levelsOf(raw) {
  const m = raw === undefined ? null : String(raw).match(/\d+/);
  const v = m ? Number(m[0]) : null;
  return v && v >= 1 && v <= 60 ? v : null;
}

function keepTags(tags) {
  const out = {};
  for (const k of TAG_KEEP) if (tags[k] !== undefined) out[k] = String(tags[k]);
  return out;
}

/** Geometri Overpass [{lat,lon}] → ring dunia bersih berorientasi, kuantisasi 0,1 m; null bila < 3 titik. */
function worldRing(geometry, project, positive = true) {
  const ring = cleanRing(geometry.map((p) => {
    const w = project(p.lat, p.lon);
    return [q1(w.x), q1(w.z)];
  }));
  return ring.length >= 3 ? orientRing(ring, positive) : null;
}

/** Kandidat gedung eksplisit (way & relation building=*). */
export function extractCandidates(elements, project) {
  const out = [];
  for (const e of elements) {
    const tags = e.tags ?? {};
    if (!tags.building || tags.building === 'roof') continue;
    if (e.type === 'way' && e.geometry) {
      const ring = worldRing(e.geometry, project);
      if (ring) out.push({ id: `w${e.id}`, ring, holes: [], tags });
    } else if (e.type === 'relation' && Array.isArray(e.members)) {
      const rings = (role) => e.members.filter((m) => m.role === role && m.geometry)
        .map((m) => worldRing(m.geometry, project, role === 'outer')).filter(Boolean);
      const outers = rings('outer').sort((a, b) => polygonArea(b) - polygonArea(a));
      if (outers.length) {
        const holes = rings('inner').filter((h) => pointInPolygon(h[0][0], h[0][1], outers[0]));
        out.push({ id: `r${e.id}`, ring: outers[0], holes, tags });
      }
    }
  }
  return out;
}

/** Gedung tersirat (lihat kepala berkas). */
export function extractImplied(elements, project, buildings) {
  const out = [];
  for (const e of elements) {
    const t = e.tags ?? {};
    if (e.type !== 'way' || !e.geometry || t.building || !t.name) continue;
    if ((t.amenity !== 'university' && t.amenity !== 'college') || t.leisure || t.landuse || t.sport) continue;
    if (/lapangan|parkir|taman/i.test(t.name)) continue;
    if (!e.nodes || e.nodes[0] !== e.nodes[e.nodes.length - 1]) continue;
    const ring = worldRing(e.geometry, project);
    if (!ring) continue;
    const area = polygonArea(ring);
    if (area < IMPLIED.minArea || area > IMPLIED.maxArea) continue;
    const containsOther = buildings.some((b) => {
      const c = polygonCentroid(b.ring);
      return pointInPolygon(c.x, c.z, ring);
    });
    if (!containsOther) out.push({ id: `w${e.id}`, ring, holes: [], tags: { ...t, building: 'implied' } });
  }
  return out;
}

function nearestOnSegment(px, pz, a, b) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / len2)) : 0;
  const x = a[0] + dx * t;
  const z = a[1] + dz * t;
  return { x, z, d: Math.hypot(px - x, pz - z) };
}

/** Vektor satuan centroid → titik jalan terdekat (≤ maxDist), 3 desimal; null bila tidak ada. */
export function nearestRoadFront(cx, cz, roads, maxDist = BUILDINGS_FORMAT.frontMax) {
  let best = null;
  for (const road of roads) {
    for (let i = 0; i + 1 < road.pts.length; i += 1) {
      const n = nearestOnSegment(cx, cz, road.pts[i], road.pts[i + 1]);
      if (n.d <= maxDist && (!best || n.d < best.d)) best = n;
    }
  }
  if (!best || best.d < 1e-6) return null;
  return [Number(((best.x - cx) / best.d).toFixed(3)), Number(((best.z - cz) / best.d).toFixed(3))];
}

/** Jalan + jalur pejalan dari highway OSM (cadangan bila ground/*.json M2 belum ada). */
export function roadsFromOsm(elements, project) {
  return elements
    .filter((e) => e.type === 'way' && e.geometry && ROAD_CLASSES.has(e.tags?.highway))
    .map((e) => ({ pts: e.geometry.map((p) => { const w = project(p.lat, p.lon); return [w.x, w.z]; }) }));
}

/**
 * Jalan + jalur pejalan dari ground/<key>.json M2 lewat parseGroundChunk (koordinat bulat 0,1 m relatif chunk →
 * dunia). Chunk rusak dilewati (log.warn). null bila direktori kosong/tidak ada.
 */
export async function roadsFromGround(dir, log = console) {
  if (!existsSync(dir)) return null;
  const files = (await readdir(dir)).filter((f) => /^-?\d+_-?\d+\.json$/.test(f)).sort();
  if (!files.length) return null;
  const out = [];
  for (const f of files) {
    const key = f.replace(/\.json$/, '');
    try {
      const g = parseGroundChunk(JSON.parse(await readFile(join(dir, f), 'utf8')), key);
      for (const r of [...g.roads, ...g.walks]) if (r.pts.length >= 2) out.push({ pts: r.pts });
    } catch (err) {
      log.warn(`ground ${key} dilewati: ${err.message}`);
    }
  }
  return out;
}

/**
 * Buang gedung ganda (gedung yang sama dipetakan sebagai way DAN relation, mis. Lab Teknik Elektro
 * w282230766 & r3747439): centroid < 3 m dan rasio luas 0,85–1,15 → simpan yang berlubang (halaman dalam),
 * lalu yang id-nya lebih kecil secara leksikal. Mengembalikan daftar baru + id yang dibuang.
 */
export function dropDuplicates(list) {
  const cs = list.map((b) => ({ b, c: polygonCentroid(b.ring), a: polygonArea(b.ring) }));
  const dropped = new Set();
  for (let i = 0; i < cs.length; i += 1) {
    for (let j = i + 1; j < cs.length; j += 1) {
      const p = cs[i];
      const q = cs[j];
      if (dropped.has(p.b.id) || dropped.has(q.b.id)) continue;
      const near = Math.hypot(p.c.x - q.c.x, p.c.z - q.c.z) < 3;
      const ratio = p.a / q.a;
      if (!near || ratio < 0.85 || ratio > 1.15) continue;
      const keepP = p.b.holes.length !== q.b.holes.length ? p.b.holes.length > q.b.holes.length : p.b.id < q.b.id;
      dropped.add(keepP ? q.b.id : p.b.id);
    }
  }
  return { list: list.filter((b) => !dropped.has(b.id)), dropped: [...dropped].sort() };
}

/**
 * @param {{synthetic?: object[], elements: object[], project: (lat:number, lon:number) => {x:number,z:number},
 *   boundary: Array<[number,number]>, roads: Array<{pts: Array<[number,number]>}>}} input
 * @returns {{v:1, buildings: object[]}}
 */
export function bakeBuildingsData({ elements, project, boundary, roads, synthetic = [] }) {
  const inside = (b) => {
    const c = polygonCentroid(b.ring);
    return pointInPolygon(c.x, c.z, boundary);
  };
  const explicit = dropDuplicates(extractCandidates(elements, project).filter(inside)).list;
  const implied = extractImplied(elements, project, explicit).filter(inside);
  const seen = new Set();
  const toEntry = (b, levels) => {
    const c = polygonCentroid(b.ring);
    const entry = {
      id: b.id, ring: b.ring, levels, tags: keepTags(b.tags),
      cluster: clusterKey(c.x, c.z), area: Number(polygonArea(b.ring).toFixed(1)), front: nearestRoadFront(c.x, c.z, roads),
    };
    if (b.holes?.length) entry.holes = b.holes;
    return entry;
  };
  const fromOsm = [...explicit, ...implied]
    .filter((b) => (seen.has(b.id) ? false : seen.add(b.id)))
    .map((b) => toEntry(b, levelsOf(b.tags['building:levels'])));
  // Bangunan sintetis (M6: pos satpam Gerbang SM Amin) tidak ada di OSM → disisipkan tanpa saringan batas distrik.
  const synthEntries = synthetic.filter((s) => !seen.has(s.id))
    .map((s) => toEntry({ id: s.id, ring: orientRing(s.ring.map(([x, z]) => [q1(x), q1(z)]), true), holes: [], tags: { ...s.tags } }, s.levels));
  const buildings = [...fromOsm, ...synthEntries].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { v: BUILDINGS_FORMAT.v, buildings };
}

/** Serialisasi stabil: satu gedung per baris (diff git terbaca), diakhiri newline. */
export function serializeBuildings(data) {
  return `{"v":${data.v},"buildings":[\n${data.buildings.map((b) => JSON.stringify(b)).join(',\n')}\n]}\n`;
}

/** Ringkasan untuk laporan bake: jumlah per klaster, tersirat, relation, tanpa front. */
export function summarize(data) {
  const clusters = new Set(data.buildings.map((b) => b.cluster));
  return {
    buildings: data.buildings.length, clusters: clusters.size,
    implied: data.buildings.filter((b) => b.tags.building === 'implied').length,
    relations: data.buildings.filter((b) => b.id.startsWith('r')).length,
    withoutFront: data.buildings.filter((b) => !b.front).length,
  };
}

/** Elemen OSM dari semua cache yang ada (dedupe type/id; urutan berkas tetap). */
export async function loadOsmElements(root, files = BUILDINGS_PATHS.osm) {
  const present = files.map((f) => join(root, f)).filter((f) => existsSync(f));
  if (!present.length) {
    throw new Error(`Cache OSM tidak ada (${files.join(', ')}). Jalankan "npm run bake -- --area stadion" (citybake) dulu untuk mengisi data-src/osm/.`);
  }
  const seen = new Set();
  const out = [];
  for (const f of present) {
    for (const e of JSON.parse(await readFile(f, 'utf8')).elements ?? []) {
      const k = `${e.type}/${e.id}`;
      if (!seen.has(k)) {
        seen.add(k);
        out.push(e);
      }
    }
  }
  return out;
}

/**
 * Langkah CLI: baca cache OSM + ground, tulis buildings.json. Dipanggil tools/campusbake/index.js.
 * @param {{root: string, boundary: Array<[number,number]>, project: Function, log?: {info: Function, warn: Function}}} opts
 */
export async function runBuildingsBake({ root, boundary, project, synthetic = SYNTHETIC_BUILDINGS, log = console }) {
  const elements = await loadOsmElements(root);
  let roads = await roadsFromGround(join(root, BUILDINGS_PATHS.ground), log);
  if (!roads) {
    log.warn('ground/*.json belum ada (jalankan "npm run bake:campus -- ground"); front dari highway OSM.');
    roads = roadsFromOsm(elements, project);
  }
  const data = bakeBuildingsData({ elements, project, boundary, roads, synthetic });
  const errs = validateBuildingsData(data);
  if (errs.length) throw new Error(`buildings.json hasil bake tidak valid: ${errs.slice(0, 5).join('; ')}`);
  const out = join(root, BUILDINGS_PATHS.out);
  await mkdir(dirname(out), { recursive: true });
  const text = serializeBuildings(data);
  await writeFile(out, text);
  const s = summarize(data);
  log.info(`buildings: ${s.buildings} gedung (${s.implied} tersirat, ${s.relations} relation), ${s.clusters} klaster, ${s.withoutFront} tanpa front, ${text.length} byte`);
  return { data, bytes: text.length, summary: s };
}
