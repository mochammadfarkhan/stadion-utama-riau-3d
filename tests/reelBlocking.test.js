import { describe, it, expect } from 'vitest';
import { compileBlocking, nearestAngle, yawTo, KECEPATAN } from '../src/dev/reels/blocking.js';
import { shots, segmentAt } from '../src/dev/reels/timeline.js';
import { srtTime, toSrt, toNaskahMd } from '../src/dev/reels/naskah.js';

describe('blocking reels', () => {
  it('yawTo mengikuti konvensi hadap (sin yaw, cos yaw)', () => {
    expect(yawTo([0, 0], [0, 1])).toBeCloseTo(0);
    expect(yawTo([0, 0], [1, 0])).toBeCloseTo(Math.PI / 2);
  });

  it('nearestAngle tidak memutar lebih dari 180°', () => {
    expect(nearestAngle(3, -3)).toBeCloseTo(-3 + Math.PI * 2);
    expect(nearestAngle(0.1, 0.4)).toBeCloseTo(0.4);
    expect(Math.abs(nearestAngle(10, -10) - 10)).toBeLessThanOrEqual(Math.PI + 1e-9);
  });

  it('jalan: waktu = jarak / kecepatan, posisi linear, lalu diam', () => {
    const b = compileBlocking({ di: [0, 0], langkah: [{ t: 1, jalan: [[2.2, 0]] }] });
    const tiba = 1 + 2.2 / KECEPATAN;
    expect(b.pos(0.5)).toEqual([0, 0]);
    expect(b.pos((1 + tiba) / 2)[0]).toBeCloseTo(1.1);
    expect(b.pos(tiba + 3)).toEqual([2.2, 0]);
    expect(b.berjalan(1.5)).toBe(true);
    expect(b.berjalan(tiba + 0.1)).toBe(false);
    expect(b.yaw(tiba)).toBeCloseTo(Math.PI / 2);
    expect(b.selesai).toBeCloseTo(tiba);
  });

  it('hadap ke titik dari posisi terakhir; pose bersegmen; aksi bertumpuk ditolak', () => {
    const b = compileBlocking({
      di: [0, 0], pose: 'sitChairTyping',
      langkah: [{ t: 2, pose: 'berdiri' }, { t: 2, hadap: [0, -5], durasi: 1 }],
    });
    expect(Math.cos(b.yaw(3))).toBeCloseTo(-1); // menghadap -Z (±π setara)
    expect(b.pose(1.9)).toBe('sitChairTyping');
    expect(b.pose(2)).toBe('berdiri');
    expect(() => compileBlocking({ di: [0, 0], langkah: [{ t: 0, jalan: [[5, 0]] }, { t: 1, hadap: 0 }] })).toThrow(RangeError);
  });
});

describe('shots & segmen', () => {
  it('shot kedua dipotong tepat di awalnya dan bergerak menuju nilai akhir', () => {
    const k = shots([
      { dari: 0, sampai: 2, pos: [0, 0, 0], target: [0, 0, -1], fov: 50 },
      { dari: 2, sampai: 4, pos: [[10, 0, 0], [12, 0, 0]], target: [0, 0, 0], fov: [40, 30] },
    ]);
    expect(k.pos).toHaveLength(4);
    expect(k.pos[2]).toEqual({ t: 2, v: [10, 0, 0], ease: 'step' });
    expect(k.fov[3].v).toBe(30);
    expect(() => shots([{ dari: 3, sampai: 3, pos: [0, 0, 0], target: [0, 0, 0] }])).toThrow(RangeError);
  });

  it('segmentAt memilih segmen terakhir yang sudah mulai', () => {
    const s = [{ t: 0, id: 'a' }, { t: 5, id: 'b' }];
    expect(segmentAt(s, 4.9).id).toBe('a');
    expect(segmentAt(s, 5).id).toBe('b');
  });
});

describe('naskah', () => {
  it('srtTime memformat jam:menit:detik,milidetik', () => {
    expect(srtTime(0)).toBe('00:00:00,000');
    expect(srtTime(83.4567)).toBe('00:01:23,457');
  });

  it('toSrt mengurutkan, memberi nama pembicara, dan membuang tag HTML', () => {
    const srt = toSrt([
      { dari: 3, sampai: 4, gaya: 'dialog', siapa: 'npc-3', isi: 'Kas <em>dulu</em>' },
      { dari: 0, sampai: 2, gaya: 'judul', isi: 'JUDUL', kecil: 'sub' },
    ], { 'npc-3': 'Mutia' });
    expect(srt).toBe('1\n00:00:00,000 --> 00:00:02,000\nJUDUL — sub\n\n2\n00:00:03,000 --> 00:00:04,000\nMutia: Kas dulu\n');
  });

  it('toNaskahMd membagi dialog per adegan', () => {
    const md = toNaskahMd({
      judul: 'Uji', durasi: 10, fps: 30,
      adegan: [{ dari: 0, judul: 'Satu' }, { dari: 5, judul: 'Dua', aksi: 'masuk' }],
      teks: [{ dari: 6, sampai: 7, gaya: 'dialog', siapa: 'x', isi: 'halo' }],
    }, { x: 'Budi' });
    expect(md).toContain('## 2. Dua (0:05–0:10)');
    expect(md).toContain('**BUDI**: halo');
    expect(md.indexOf('halo')).toBeGreaterThan(md.indexOf('## 2.'));
  });
});
