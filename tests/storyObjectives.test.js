import { describe, it, expect } from 'vitest';
import { applyObjective } from '../src/sim/story/objectives.js';

const P0 = Object.freeze({ count: 0, found: [] });

describe('applyObjective', () => {
  it('goto selesai hanya di dalam radius', () => {
    const o = { type: 'goto', target: { x: 10, z: 10 }, radius: 5 };
    expect(applyObjective(o, P0, { type: 'position', x: 30, z: 10 }).done).toBe(false);
    expect(applyObjective(o, P0, { type: 'position', x: 12, z: 11 }).done).toBe(true);
  });
  it('buy cocok itemId', () => {
    const o = { type: 'buy', itemId: 'es-teh' };
    expect(applyObjective(o, P0, { type: 'bought', itemId: 'kopi' }).done).toBe(false);
    expect(applyObjective(o, P0, { type: 'bought', itemId: 'es-teh' }).done).toBe(true);
  });
  it('deliver tanpa barang: toast gagal; dengan barang: selesai + consumeItem', () => {
    const o = { type: 'deliver', npcId: 'satpam', itemId: 'es-teh' };
    const no = applyObjective(o, P0, { type: 'interacted', id: 'satpam', carrying: [] });
    expect(no.done).toBe(false);
    expect(no.effects[0]).toMatchObject({ type: 'toast', ok: false });
    const yes = applyObjective(o, P0, { type: 'interacted', id: 'satpam', carrying: ['es-teh'] });
    expect(yes.done).toBe(true);
    expect(yes.effects).toEqual([{ type: 'consumeItem', itemId: 'es-teh' }]);
    expect(applyObjective(o, P0, { type: 'interacted', id: 'pelatih', carrying: ['es-teh'] }).done).toBe(false);
  });
  it('laps menghitung sampai count', () => {
    const o = { type: 'laps', count: 2 };
    const a = applyObjective(o, P0, { type: 'lapDone', seconds: 40 });
    expect(a.done).toBe(false);
    expect(a.progress.count).toBe(1);
    expect(applyObjective(o, a.progress, { type: 'lapDone', seconds: 39 }).done).toBe(true);
  });
  it('find mengumpulkan id unik', () => {
    const o = { type: 'find', ids: ['a', 'b'] };
    const a = applyObjective(o, P0, { type: 'found', id: 'a' });
    const dup = applyObjective(o, a.progress, { type: 'found', id: 'a' });
    expect(dup.progress.found).toEqual(['a']);
    expect(applyObjective(o, a.progress, { type: 'found', id: 'b' }).done).toBe(true);
    expect(applyObjective(o, P0, { type: 'found', id: 'zzz' }).progress.found).toEqual([]);
  });
  it('event tak relevan dan input tidak dimutasi', () => {
    const o = { type: 'laps', count: 1 };
    const frozen = Object.freeze({ count: 0, found: Object.freeze([]) });
    const r = applyObjective(o, frozen, { type: 'position', x: 0, z: 0 });
    expect(r).toEqual({ progress: frozen, done: false, effects: [] });
  });
});
