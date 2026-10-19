import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  UKM_DOORS, UKM_LABELS, UKM_WALLS, UKM_ROOF, SEKRE_PEMAIN, PLAYER_DOOR_ID, UKM_WORLD, validateUkmData, ukmSigns, ukmToWorld,
  COURTS, ARCHERY, YARD_BOX, COMPLEX_BOX,
} from '../../src/regions/unri-lembaga/sekreUkm.data.js';
import { PORTAL_DOORS, sekreExitTo } from '../../src/regions/unri-lembaga/portalDoors.js';
import { lembagaColliders } from '../../src/regions/unri-lembaga/collider.js';
import { LEMBAGA_MASK_WORLD } from '../../src/regions/unri-lembaga/mask.js';
import { LEMBAGA_PADS, lembagaPadsWorld } from '../../src/regions/unri-lembaga/pads.js';
import { toRegion } from '../../src/regions/unri-lembaga/placement.js';
import { stadionMaskWorld } from '../../src/regions/stadion/mask.js';
import { pointInPolygon } from '../../src/geo/polygon.js';
import { CAMPUS_DESTINATIONS } from '../../src/app/fastTravel.js';

const json = JSON.parse(readFileSync('public/models/unri/h09-sekre-ukm.json', 'utf8'));

describe('data sekre UKM blok biru (validator)', () => {
  it('default valid: pintu pemain D5 berlabel ERC, D1 KSR PMI, D2 KOPMA UNRI, D3/D4 SEKRETARIAT', () => {
    expect(validateUkmData()).toEqual([]);
    expect(SEKRE_PEMAIN.nama).toBe('ERC');
    expect(PLAYER_DOOR_ID).toBe('D5');
    expect(UKM_LABELS).toEqual({ D1: 'KSR PMI', D2: 'KOPMA UNRI', D3: 'SEKRETARIAT', D4: 'SEKRETARIAT', D5: 'ERC' });
    expect(ukmSigns().map((s) => s.label)).toEqual(['KSR PMI', 'KOPMA UNRI', 'SEKRETARIAT', 'SEKRETARIAT', 'ERC']);
  });
  it('id ganda, label kosong, pintu pemain hilang atau berlabel lain → galat', () => {
    expect(validateUkmData({ doors: [...UKM_DOORS, UKM_DOORS[0]] }).join(' ')).toMatch(/tidak unik/);
    expect(validateUkmData({ labels: { ...UKM_LABELS, D2: '  ' } }).join(' ')).toMatch(/D2.*kosong/);
    expect(validateUkmData({ doors: UKM_DOORS.filter((d) => d.id !== 'D5') }).join(' ')).toMatch(/D5 tidak ada/);
    expect(validateUkmData({ labels: { ...UKM_LABELS, D5: 'LAIN' } }).join(' ')).toMatch(/harus sama/);
    expect(validateUkmData({ labels: { ...UKM_LABELS, D1: 'kecil' } }).join(' ')).toMatch(/kapital/);
  });
  it('salinan angka footprint & pintu di kode = JSON aset Blender', () => {
    expect(UKM_WALLS).toEqual(json.wallsFootprintLocal);
    expect(UKM_ROOF).toEqual(json.roofOutlineLocal);
    expect(json.worldOrigin).toEqual(UKM_WORLD);
    for (const d of UKM_DOORS) {
      const j = json.doors.find((v) => v.id === d.id);
      expect([d.x, d.z, ...d.normal, d.sign.x, d.sign.y, d.sign.z]).toEqual([j.x, j.z, ...j.normal, j.sign.x, j.sign.y, j.sign.z]);
    }
  });
});

/** Jangkauan dari jalan: penelusuran kisi 0,5 m di atas collider sepeda (region-lokal). */
function reachable(from, targets, { x0, x1, z0, z1, step = 0.5 }) {
  const nx = Math.round((x1 - x0) / step);
  const nz = Math.round((z1 - z0) / step);
  const key = (i, j) => j * (nx + 1) + i;
  const cell = (p) => [Math.round((p[0] - x0) / step), Math.round((p[1] - z0) / step)];
  const walk = (i, j) => lembagaColliders.isWalkable(x0 + i * step, z0 + j * step);
  const [si, sj] = cell(from);
  const seen = new Set([key(si, sj)]);
  const stack = [[si, sj]];
  while (stack.length) {
    const [i, j] = stack.pop();
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di;
      const b = j + dj;
      if (a < 0 || b < 0 || a > nx || b > nz || seen.has(key(a, b)) || !walk(a, b)) continue;
      seen.add(key(a, b));
      stack.push([a, b]);
    }
  }
  return targets.map((t) => seen.has(key(...cell(t))));
}

describe('portal D5 terjangkau dan collider gedung UKM', () => {
  const [door] = PORTAL_DOORS;
  const exit = sekreExitTo();
  const road = toRegion(-138, 1000); // badan Jl. Prof. Aras Mulyadi
  const box = (() => {
    const [a, b] = [toRegion(-150, 985), toRegion(-78, 1040)];
    return { x0: a[0], z0: a[1], x1: b[0], z1: b[1] };
  })();

  it('titik pemicu & exitTo walkable, dinding gedung dan tiang net padat, lapangan & halaman walkable', () => {
    expect(lembagaColliders.isWalkable(door.pos.lx, door.pos.lz)).toBe(true);
    expect(lembagaColliders.isWalkable(exit.x, exit.z)).toBe(true);
    const wall = toRegion(UKM_WORLD.x + 12, UKM_WORLD.z); // di dalam sayap utara–selatan
    expect(lembagaColliders.isWalkable(...wall)).toBe(false);
    expect(lembagaColliders.isCameraClear(...wall)).toBe(false);
    const post = toRegion(COURTS[2].x - 6.4, COURTS[2].z); // tiang net tenis
    expect(lembagaColliders.isWalkable(...post)).toBe(false);
    expect(lembagaColliders.isWalkable(...toRegion(COURTS[2].x, COURTS[2].z + 6))).toBe(true);
    expect(lembagaColliders.isWalkable(...toRegion(-110, 1005))).toBe(true);
  });

  it('pintu D5, tujuan perjalanan cepat, dan halaman terjangkau dari jalan (numerik)', () => {
    const dest = CAMPUS_DESTINATIONS[0];
    expect(dest.id).toBe('unri-sekre-ukm');
    const targets = [[door.pos.lx, door.pos.lz], toRegion(dest.x, dest.z), toRegion(-110, 1005)];
    expect(lembagaColliders.isWalkable(road[0], road[1])).toBe(true);
    expect(reachable(road, targets, box)).toEqual([true, true, true]);
  });
});

describe('mask & pad area UKM', () => {
  it('mask Lembaga memuat atap gedung, halaman, kompleks lapangan, gubuk; tak beririsan mask stadion', () => {
    const roof = UKM_ROOF.map(([x, z]) => [ukmToWorld(x, z).x, ukmToWorld(x, z).z]);
    const courts = COURTS.flatMap((c) => [[c.x - c.outer.w / 2, c.z - c.outer.l / 2], [c.x + c.outer.w / 2, c.z + c.outer.l / 2]]);
    const pts = [
      ...roof, ...courts,
      [YARD_BOX.minX, YARD_BOX.minZ], [YARD_BOX.maxX, YARD_BOX.maxZ],
      [COMPLEX_BOX.minX, COMPLEX_BOX.minZ], [COMPLEX_BOX.maxX, COMPLEX_BOX.maxZ], [COMPLEX_BOX.minX, COMPLEX_BOX.maxZ], [COMPLEX_BOX.maxX, COMPLEX_BOX.minZ],
      [ARCHERY.hut.minX, ARCHERY.hut.minZ], [ARCHERY.hut.maxX, ARCHERY.hut.maxZ],
    ];
    for (const [x, z] of pts) expect(pointInPolygon(x, z, LEMBAGA_MASK_WORLD), `${x},${z}`).toBe(true);
    const stadion = stadionMaskWorld();
    for (const [x, z] of LEMBAGA_MASK_WORLD) expect(pointInPolygon(x, z, stadion)).toBe(false);
    for (const [x, z] of stadion) expect(pointInPolygon(x, z, LEMBAGA_MASK_WORLD)).toBe(false);
  });
  it('pad terrain: gedung+halaman, lapangan, gubuk (median) mencakup footprint-nya', () => {
    expect(LEMBAGA_PADS.map((p) => p.id)).toEqual(expect.arrayContaining(['ukm-gedung', 'ukm-lapangan', 'ukm-gubuk']));
    const ring = (id) => lembagaPadsWorld().find((p) => p.id === `unri-lembaga:${id}`).ring;
    for (const [x, z] of UKM_ROOF) {
      const w = ukmToWorld(x, z);
      expect(pointInPolygon(w.x, w.z, ring('ukm-gedung'))).toBe(true);
    }
    for (const c of COURTS) {
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          expect(pointInPolygon(c.x + (sx * c.outer.w) / 2, c.z + (sz * c.outer.l) / 2, ring('ukm-lapangan'))).toBe(true);
        }
      }
    }
    const hut = ARCHERY.hut;
    expect(pointInPolygon((hut.minX + hut.maxX) / 2, (hut.minZ + hut.maxZ) / 2, ring('ukm-gubuk'))).toBe(true);
  });
});
