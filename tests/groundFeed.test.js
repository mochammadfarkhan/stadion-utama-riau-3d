import { describe, it, expect } from 'vitest';
import { createGroundFeed } from '../src/districts/unri/groundFeed.js';

const flush = () => new Promise((r) => setTimeout(r, 0));

function setup({ fail = [] } = {}) {
  const log = { fetched: [], added: [], removed: [], warns: 0 };
  const feed = createGroundFeed({
    baseUrl: '/districts/unri/',
    chunkKeys: ['0_0', '1_0', '-1_0', '0_1', '9_9'],
    fetchJson: (url) => {
      log.fetched.push(url);
      const key = url.match(/ground\/(.+)\.json$/)[1];
      return fail.includes(key) ? Promise.reject(new Error('HTTP 500')) : Promise.resolve({ key });
    },
    parse: (d) => d, // data uji sudah terurai (produksi: parseGroundChunk M2)
    onAdd: (key, data) => log.added.push([key, data.key]),
    onRemove: (key) => log.removed.push(key),
    logger: { warn: () => { log.warns += 1; } },
  });
  return { feed, log };
}

describe('createGroundFeed', () => {
  it('memuat hanya kunci manifest dalam radius, sekali per kunci', async () => {
    const { feed, log } = setup();
    feed.update({ x: 250, z: 250 });
    feed.update({ x: 250, z: 250 });
    await flush();
    expect([...log.fetched].sort()).toEqual([
      '/districts/unri/ground/-1_0.json', '/districts/unri/ground/0_0.json',
      '/districts/unri/ground/0_1.json', '/districts/unri/ground/1_0.json',
    ]);
    expect(log.added.map(([k]) => k).sort()).toEqual(['-1_0', '0_0', '0_1', '1_0']);
    expect(log.added.every(([k, d]) => k === d)).toBe(true);
    expect(feed.keys.sort()).toEqual(['-1_0', '0_0', '0_1', '1_0']);
  });
  it('melepas chunk di luar radius lepas; dispose melepas semua dan mengabaikan update', async () => {
    const { feed, log } = setup();
    feed.update({ x: 250, z: 250 });
    await flush();
    feed.update({ x: 4750, z: 4750 });
    expect([...log.removed].sort()).toEqual(['-1_0', '0_0', '0_1', '1_0']);
    await flush();
    expect(log.added.map(([k]) => k)).toContain('9_9');
    feed.dispose();
    expect(log.removed).toContain('9_9');
    feed.update({ x: 250, z: 250 });
    await flush();
    expect(log.added.filter(([k]) => k === '0_0')).toHaveLength(1);
  });
  it('fetch gagal diperingatkan sekali dan tidak diulang; muatan setelah dispose dibuang', async () => {
    const { feed, log } = setup({ fail: ['0_0'] });
    feed.update({ x: 250, z: 250 });
    await flush();
    feed.update({ x: 250, z: 250 });
    await flush();
    expect(log.fetched.filter((u) => u.endsWith('/0_0.json'))).toHaveLength(1);
    expect(log.warns).toBe(1);
    const late = setup();
    late.feed.update({ x: 250, z: 250 });
    late.feed.dispose();
    await flush();
    expect(late.log.added).toEqual([]);
  });
});
