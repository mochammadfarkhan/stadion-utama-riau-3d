import { afterEach, describe, expect, it, vi } from 'vitest';
import { leafCardsAtLevel, effectsAtLevel } from '../src/engine/autoQuality.js';
import { setStyleState } from '../src/engine/styleState.js';
import { adaptiveTreeLayer, pickTreeLayerMode, selectLods } from '../src/regions/unri-lembaga/ukmTrees.js';
import { leafGradient, CARD_BUDGET } from '../src/regions/unri-lembaga/ukmTreeCards.js';

afterEach(() => setStyleState({ leafCards: false }));

describe('urutan pemangkasan kartu daun', () => {
  it('kartu daun dipangkas terakhir: efek tetap sama pada level 0-2, kartu mati di level 3', () => {
    expect([0, 1, 2].map((l) => leafCardsAtLevel(l))).toEqual([true, true, true]);
    expect(leafCardsAtLevel(3)).toBe(false);
    expect(leafCardsAtLevel(0, false)).toBe(false); // dimatikan pengguna
    expect(effectsAtLevel(2, { tiltShift: true, bloom: true })).toEqual({ tiltShift: false, bloom: false });
  });

  it('pickTreeLayerMode: kartu hanya bila diminta, siap, dan tak gagal', () => {
    expect(pickTreeLayerMode({ leafCards: true, ready: true, failed: false })).toBe('cards');
    expect(pickTreeLayerMode({ leafCards: true, ready: false, failed: false })).toBe('blob');
    expect(pickTreeLayerMode({ leafCards: true, ready: true, failed: true })).toBe('blob');
    expect(pickTreeLayerMode({ leafCards: false, ready: true, failed: false })).toBe('blob');
  });
});

describe('selectLods dengan anggaran overdraw', () => {
  const near2 = Array(100).fill(40 ** 2);
  const far2 = Array(100).fill(160 ** 2);

  it('tanpa anggaran: dekat=1, menengah=2, jauh=0', () => {
    const d2 = [10 ** 2, 80 ** 2, 200 ** 2];
    expect([...selectLods(d2, near2, far2, 1)]).toEqual([1, 2, 0]);
  });

  it('anggaran: pohon terdekat tetap LOD0, kelebihan turun ke LOD1 (bukan hilang)', () => {
    const d2 = Array.from({ length: 80 }, (_, i) => (1 + i * 0.4) ** 2); // 80 pohon dalam 33 m
    const want = selectLods(d2, near2, far2, 1, CARD_BUDGET);
    expect([...want].filter((w) => w === 1)).toHaveLength(CARD_BUDGET);
    expect([...want].filter((w) => w === 2)).toHaveLength(80 - CARD_BUDGET);
    expect(want.slice(0, CARD_BUDGET).every((w) => w === 1)).toBe(true); // yang terdekat menang
  });

  it('skala LOD gaya hemat mengecilkan jarak', () => {
    expect([...selectLods([30 ** 2], near2, far2, 0.5 ** 2)]).toEqual([2]);
  });
});

describe('gradasi daun vertikal', () => {
  it('lebih terang dan lebih hangat di atas, dibatasi 0..1', () => {
    const lo = leafGradient(0);
    const hi = leafGradient(1);
    expect(hi[1]).toBeGreaterThan(lo[1]);
    expect(hi[0] / hi[2]).toBeGreaterThan(lo[0] / lo[2]);
    expect(leafGradient(-5)).toEqual(lo);
    expect(leafGradient(9)).toEqual(hi);
  });
});

describe('adaptiveTreeLayer (fallback otomatis)', () => {
  const makeBase = () => ({ group: { visible: true }, update: vi.fn(), blobs: vi.fn(), invalidate: vi.fn(), dispose: vi.fn() });
  const makeCards = () => ({ group: { visible: true }, update: vi.fn(), blobs: vi.fn(), invalidate: vi.fn(), dispose: vi.fn() });
  const tick = () => new Promise((r) => setTimeout(r, 0));

  it('muat malas, beralih ke kartu saat leafCards menyala, kembali ke gumpalan saat mati', async () => {
    const base = makeBase();
    const cards = makeCards();
    const loader = vi.fn(async () => cards);
    const root = { add: vi.fn() };
    const layer = adaptiveTreeLayer({ base, root, scope: null, instances: [], isCancelled: () => false, loader });
    layer.update(0, 0); // leafCards masih false: tidak memuat
    expect(loader).not.toHaveBeenCalled();
    expect(layer.mode).toBe('blob');
    setStyleState({ leafCards: true });
    layer.update(0, 0);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(layer.mode).toBe('blob'); // belum siap
    await tick();
    layer.update(1, 1);
    expect(layer.mode).toBe('cards');
    expect(base.group.visible).toBe(false);
    expect(cards.group.visible).toBe(true);
    expect(cards.update).toHaveBeenCalledWith(1, 1);
    setStyleState({ leafCards: false }); // auto-turun kualitas
    layer.update(2, 2);
    expect(layer.mode).toBe('blob');
    expect(base.group.visible).toBe(true);
    expect(cards.group.visible).toBe(false);
    expect(loader).toHaveBeenCalledTimes(1);
    layer.dispose();
    expect(base.dispose).toHaveBeenCalled();
    expect(cards.dispose).toHaveBeenCalled();
  });

  it('gagal memuat: tetap gumpalan, tidak mencoba berulang, peringatan sekali', async () => {
    const base = makeBase();
    const loader = vi.fn(async () => { throw new Error('404'); });
    const logger = { warn: vi.fn() };
    const layer = adaptiveTreeLayer({ base, root: { add: vi.fn() }, scope: null, instances: [], isCancelled: () => false, loader, logger });
    setStyleState({ leafCards: true });
    layer.update(0, 0);
    await tick();
    layer.update(0, 0);
    layer.update(0, 0);
    expect(layer.mode).toBe('blob');
    expect(loader).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('region dibatalkan saat memuat: lapisan kartu dilepas dan tak dipasang', async () => {
    const base = makeBase();
    const cards = makeCards();
    const root = { add: vi.fn() };
    const layer = adaptiveTreeLayer({ base, root, scope: null, instances: [], isCancelled: () => true, loader: async () => cards });
    setStyleState({ leafCards: true });
    layer.update(0, 0);
    await tick();
    expect(cards.dispose).toHaveBeenCalled();
    expect(root.add).not.toHaveBeenCalled();
  });
});
