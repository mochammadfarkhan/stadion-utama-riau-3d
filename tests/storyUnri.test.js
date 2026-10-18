import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { INTERAKSI } from '../src/interiors/sekre/data.js';
import { pointInPolygon, distanceToRing } from '../src/geo/polygon.js';
import { toWorld } from '../src/geo/regionTransform.js';
import { tileOf } from '../src/geo/tiles.js';
import { regionContains } from '../src/regions/Region.js';
import { UNRI_BOUNDARY } from '../src/districts/unri/boundary.js';
import { GUARD_SPOTS } from '../src/districts/unri/guards.js';
import { LAMBANG_SPOT, halteSpotsInDistrict } from '../src/districts/unri/campusProps.js';
import { GROUND_SCALE } from '../src/districts/unri/life.js';
import { parseGroundChunk } from '../src/districts/unri/groundData.js';
import { toPoints } from '../src/sim/campusLife.js';
import { PORTAL_DOORS } from '../src/regions/unri-lembaga/portalDoors.js';
import * as lembagaModule from '../src/regions/unri-lembaga/index.js';
import * as rektoratModule from '../src/regions/unri-rektorat/index.js';
import { UNRI_POINTS, UNRI_STORY_NPCS, UNRI_VENDORS, SEKRE_KIPAS_ID } from '../src/story/chapters.unri.js';

const buildings = JSON.parse(readFileSync('public/districts/unri/buildings.json', 'utf8')).buildings;
const ringOf = (id) => buildings.find((b) => b.id === id)?.ring;
const inBuilding = (x, z) => buildings.some((b) => pointInPolygon(x, z, b.ring));
const defOf = (mod, id) => Object.values(mod).find((v) => v && typeof v === 'object' && v.id === id);
const LEMBAGA = defOf(lembagaModule, 'unri-lembaga');
const REKTORAT = defOf(rektoratModule, 'unri-rektorat');
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** Danau Buatan Universitas Riau way/373856980 (OSM cache 2026-10-16 → dunia). */
const DANAU = [
  [-727.7, 792.6], [-720, 793.9], [-716.8, 794.5], [-709.4, 799.9], [-708.5, 806.9], [-710.4, 814.8], [-719, 823.1],
  [-736, 833.9], [-765.8, 847.6], [-784.3, 857.4], [-793, 863.1], [-799.7, 866.3], [-803.2, 867.6], [-804.5, 870.8],
  [-813.1, 875.5], [-826.6, 883.2], [-837.8, 888.6], [-835.5, 881.9], [-835.5, 875.2], [-836.5, 871.1], [-827.2, 860.9],
  [-820.2, 852.3], [-812.2, 847.6], [-805.4, 846.3], [-802.9, 843.1], [-797.5, 841.8], [-793.6, 838], [-787.8, 835.2],
  [-777.9, 831.7], [-771.2, 827.5], [-765.8, 824.4], [-758.7, 823.1], [-751.7, 816.7], [-743.4, 807.8], [-742.4, 803.7],
  [-737.6, 798.6], [-732.5, 793.5],
];

describe('chapter 6 & kehidupan kampus vs data M3–M6 (keputusan D2)', () => {
  it('definisi region hero M4/M6 tersedia', () => {
    expect(LEMBAGA?.placement).toBeDefined();
    expect(REKTORAT?.placement).toBeDefined();
  });
  it('ujung barat selasar ≤ 10 m dari pintu sekre pemain M4', () => {
    const door = PORTAL_DOORS.find((d) => d.id === 'sekre-pemain');
    const w = toWorld(LEMBAGA.placement, door.pos.lx, door.pos.lz);
    expect(dist(w, UNRI_POINTS.sekreUjungBarat)).toBeLessThanOrEqual(10);
  });
  it('pusat sekre di dalam footprint Sekretariat Lembaga Mahasiswa', () => {
    expect(pointInPolygon(UNRI_POINTS.sekreTengah.x, UNRI_POINTS.sekreTengah.z, ringOf('w327530276'))).toBe(true);
  });
  it('NPC kampus di luar gedung, ≤ 6 m dari ujung selasar, berjarak ≥ 6 m satu sama lain', () => {
    UNRI_STORY_NPCS.forEach((n) => {
      expect(inBuilding(n.x, n.z)).toBe(false);
      expect(dist(n, UNRI_POINTS.sekreUjungBarat)).toBeLessThanOrEqual(6);
    });
    expect(dist(UNRI_STORY_NPCS[0], UNRI_STORY_NPCS[1])).toBeGreaterThanOrEqual(6);
  });
  it('pedagang kantin di luar gedung, ≤ 6 m dari Kantin FKIP, di dalam distrik', () => {
    const v = UNRI_VENDORS[0].waypoints[0];
    expect(inBuilding(v.x, v.z)).toBe(false);
    expect(distanceToRing(v.x, v.z, ringOf('w282225371'))).toBeLessThanOrEqual(6);
    expect(pointInPolygon(v.x, v.z, UNRI_BOUNDARY)).toBe(true);
  });
  it('penanda Danau Buatan di luar air, 6–30 m dari tepi', () => {
    UNRI_POINTS.danau.forEach((p) => {
      expect(pointInPolygon(p.x, p.z, DANAU)).toBe(false);
      const d = distanceToRing(p.x, p.z, DANAU);
      expect(d).toBeGreaterThanOrEqual(6);
      expect(d).toBeLessThanOrEqual(30);
    });
  });
  it('interactable kipas ada di interior sekre M5', () => {
    expect(INTERAKSI.map((i) => i.id)).toContain(SEKRE_KIPAS_ID);
  });
  it('satpam ≤ 4 m dari Pos Keamanan way/327534471 dan di luar gedung', () => {
    GUARD_SPOTS.forEach((g) => {
      expect(inBuilding(g.x, g.z)).toBe(false);
      expect(distanceToRing(g.x, g.z, ringOf('w327534471'))).toBeLessThanOrEqual(4);
    });
  });
  it('plang lambang di distrik, di luar gedung & region hero, tidak di badan jalan', () => {
    const { x, z } = LAMBANG_SPOT;
    expect(pointInPolygon(x, z, UNRI_BOUNDARY)).toBe(true);
    expect(inBuilding(x, z)).toBe(false);
    expect(regionContains(LEMBAGA, x, z)).toBe(false);
    expect(regionContains(REKTORAT, x, z)).toBe(false);
    const t = tileOf(x, z);
    const key = `${t.ix}_${t.iz}`;
    const ground = parseGroundChunk(JSON.parse(readFileSync(`public/districts/unri/ground/${key}.json`, 'utf8')), key);
    for (const r of ground.roads) {
      expect(distanceToRing(x, z, toPoints(r.pts, GROUND_SCALE), false)).toBeGreaterThan(r.w / 2 + 0.5);
    }
  });
  it('halte TMP OSM berada di luar distrik (keputusan D6)', () => {
    expect(halteSpotsInDistrict()).toEqual([]);
  });
});
