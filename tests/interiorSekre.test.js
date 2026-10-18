import { describe, it, expect } from 'vitest';
import * as D from '../src/interiors/sekre/data.js';
import { PERIODS } from '../src/sim/activitySchedule.js';
import { POSE_IDS } from '../src/entities/Humanoid.poses.js';
import { createRoomCollider } from '../src/interiors/roomCollider.js';
import { sekreRooms, PLAYER_ROOM_INDEX } from '../src/regions/unri-lembaga/sekre.data.js';

const IDS = Array.from({ length: 30 }, (_, i) => `S${String(i + 1).padStart(2, '0')}`);
const insideRoom = (p, m = 0.01) => Math.abs(p.x) <= D.ROOM.w / 2 + m && Math.abs(p.z) <= D.ROOM.d / 2 + m && p.y >= 0 && p.y <= D.ROOM.h;
const collider = (withNpc) => createRoomCollider({
  halfW: D.ROOM.w / 2, halfD: D.ROOM.d / 2, solids: D.SOLIDS, tallSolids: D.TALL_SOLIDS,
  blockers: () => (withNpc ? D.SLOTS.map((s) => ({ x: s.x, z: s.z, r: s.block })) : []),
});

describe('data sekre: konsisten dengan sekre.data.js (region Lembaga)', () => {
  it('nama organisasi pemain & deret seberang selasar sama dengan papan nama di luar', () => {
    const rooms = sekreRooms();
    expect(D.ORGANISASI.singkatan).toBe(rooms[PLAYER_ROOM_INDEX].nama);
    expect(D.SELASAR_SEBERANG).toEqual([4, 5, 6, 7].map((i) => rooms[i].nama));
  });
});

describe('data sekre: aset katalog', () => {
  it('S01–S30 lengkap, dimensi positif, penempatan hingga & di dalam ruang', () => {
    expect(Object.keys(D.ASET).sort()).toEqual(IDS);
    for (const id of IDS) {
      const a = D.ASET[id];
      expect([a.dim.w, a.dim.d, a.dim.h].every((v) => v > 0)).toBe(true);
      for (const it of a.items) {
        expect([it.x, it.y, it.z, it.hadap].every(Number.isFinite)).toBe(true);
        expect(insideRoom(it)).toBe(true);
      }
    }
    expect(D.ordnerSlots()).toHaveLength(12);
  });

  it('dimensi placeholder = katalog (L × P × T = x × z × y)', () => {
    expect(D.ASET.S01.dim).toEqual({ w: 1.8, d: 0.03, h: 1.2 });
    expect(D.ASET.S09.dim).toEqual({ w: 0.9, d: 0.45, h: 1.8 });
    expect(D.ASET.S13.dim).toEqual({ w: 0.32, d: 0.32, h: 1.25 });
    expect(D.ASET.S14.dim).toEqual({ w: 0.45, d: 0.45, h: 1.3 });
    expect(D.ASET.S16.dim).toEqual({ w: 1.8, d: 0.6, h: 0.75 });
    expect(D.ASET.S22.dim).toEqual({ w: 3, d: 4, h: 0.01 });
    expect(D.ASET.S30.dim).toEqual({ w: 0.9, d: 0.05, h: 2.1 });
  });

  it('jumlah instans sesuai katalog (×2, ×3, ×4)', () => {
    expect(D.ASET.S06.items).toHaveLength(4);
    expect(D.ASET.S07.items).toHaveLength(3);
    expect(D.ASET.S17.items).toHaveLength(2);
    expect(D.ASET.S20.items).toHaveLength(3);
    expect(D.ASET.S21.items).toHaveLength(4);
    expect(D.ASET.S24.items).toHaveLength(2);
    expect(D.ASET.S26.items).toHaveLength(4);
  });
});

describe('data sekre: NPC & slot', () => {
  it('semua slot yang dipakai jadwal ada; pose dikenal; slot tidak di dalam perabot (laptop duduk di kursi)', () => {
    const ids = new Set(D.SLOTS.map((s) => s.id));
    for (const p of PERIODS) for (const s of p.slots) expect(ids.has(s)).toBe(true);
    for (const s of D.SLOTS) {
      expect(POSE_IDS).toContain(s.poseId);
      const hit = D.SOLIDS.filter((r) => s.x > r.x0 && s.x < r.x1 && s.z > r.z0 && s.z < r.z1).map((r) => r.id);
      expect(hit).toEqual(s.id === 'laptop' ? ['kursi'] : []);
    }
  });

  it('6 NPC unik, ≥ 2 berjas almamater, sisanya kaus', () => {
    expect(D.NPCS).toHaveLength(6);
    expect(new Set(D.NPCS.map((n) => n.id)).size).toBe(6);
    expect(D.NPCS.filter((n) => n.outfit === 'almamater').length).toBeGreaterThanOrEqual(2);
    expect(D.NPCS.every((n) => ['almamater', 'kaus'].includes(n.outfit))).toBe(true);
  });

  it('spawn & jalur pintu → karpet bisa dijalani walau semua slot terisi', () => {
    const c = collider(true);
    expect(c.isWalkable(D.SPAWN.x, D.SPAWN.z)).toBe(true);
    expect(c.isWalkable(1.0, -0.8)).toBe(true);
    expect(collider(false).isWalkable(-0.4, 0.7)).toBe(true);
  });
});

describe('data sekre: interaksi & isi contoh', () => {
  it('≥ 10 barang interaktif, id unik, prompt terisi, ada pintu keluar', () => {
    expect(D.INTERAKSI.length).toBeGreaterThanOrEqual(10);
    expect(new Set(D.INTERAKSI.map((i) => i.id)).size).toBe(D.INTERAKSI.length);
    expect(D.INTERAKSI.every((i) => i.prompt && i.radius > 0)).toBe(true);
    expect(D.INTERAKSI.map((i) => i.id)).toEqual(expect.arrayContaining([
      'papan-struktur', 'papan-proker', 'piagam', 'lemari-arsip', 'gitar', 'dispenser', 'kipas', 'saklar', 'jendela', 'whiteboard', 'pintu',
    ]));
  });

  it('isi organisasi bertanda contoh; papan punya isi', () => {
    expect(typeof D.DATA_CONTOH).toBe('boolean');
    expect(D.STRUKTUR.inti.length).toBeGreaterThanOrEqual(2);
    expect(D.STRUKTUR.divisi.length).toBeGreaterThanOrEqual(4);
    expect(D.PROKER.length).toBeGreaterThanOrEqual(5);
    expect(D.CATATAN_RAPAT.poin.length).toBeGreaterThanOrEqual(4);
    expect(D.PIAGAM).toHaveLength(4);
    expect(D.POSTER).toHaveLength(4);
    expect(D.ORDNER).toHaveLength(12);
  });

  it('kalender Oktober 2026 dimulai Kamis (Senin = 0 → 3)', () => {
    expect(new Date(2026, 9, 1).getDay()).toBe(4);
    expect(D.KALENDER.hariMulai).toBe(3);
  });
});
