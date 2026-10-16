import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { createResourceScope, currentScope, withScope, collectResources } from '../src/engine/ResourceScope.js';

const quiet = () => {
  const calls = [];
  return { calls, error: (...a) => calls.push(a) };
};
const onDispose = (res) => {
  const hit = { n: 0 };
  res.addEventListener('dispose', () => { hit.n += 1; });
  return hit;
};

describe('ResourceScope: get & refcount', () => {
  it('make dipanggil sekali per kunci; refs bertambah tiap get', () => {
    const scope = createResourceScope('uji');
    const make = vi.fn(() => new THREE.MeshBasicMaterial());
    const a = scope.get('m', make);
    const b = scope.get('m', make);
    expect(a).toBe(b);
    expect(make).toHaveBeenCalledTimes(1);
    expect(scope.refs('m')).toBe(2);
    expect(scope.refs('tidak-ada')).toBe(0);
    expect(scope.has('m')).toBe(true);
    expect(scope.size).toBe(1);
    expect(createResourceScope().name).toBe('scope');
  });

  it('release menurunkan refs; di nol sumber daya di-dispose dan kunci hilang', () => {
    const scope = createResourceScope('uji');
    const geo = scope.get('g', () => new THREE.BoxGeometry());
    scope.get('g', () => new THREE.BoxGeometry());
    const hit = onDispose(geo);
    expect(scope.release('g')).toBe(true);
    expect(hit.n).toBe(0);
    expect(scope.release('g')).toBe(true);
    expect(hit.n).toBe(1);
    expect(scope.has('g')).toBe(false);
    expect(scope.owns(geo)).toBe(false);
    expect(scope.release('g')).toBe(false);
  });

  it('objek polos/array: anggota material/geometri/tekstur dimiliki & dilepas sekali walau ada alias', () => {
    const scope = createResourceScope('uji');
    const shared = new THREE.MeshStandardMaterial();
    const tex = new THREE.Texture();
    const set = scope.get('set', () => ({ a: shared, alias: shared, t: tex, n: 3 }));
    const list = scope.get('list', () => [new THREE.PlaneGeometry(), 'bukan sumber daya']);
    expect(scope.owns(set.a)).toBe(true);
    expect(scope.owns(tex)).toBe(true);
    expect(scope.owns(list[0])).toBe(true);
    const hm = onDispose(shared);
    const ht = onDispose(tex);
    scope.dispose();
    expect(hm.n).toBe(1);
    expect(ht.n).toBe(1);
    expect(scope.size).toBe(0);
    expect(scope.disposed).toBe(true);
  });

  it('disposer kustom dipakai; galatnya dicatat tanpa menghentikan pelepasan lain', () => {
    const logger = quiet();
    const scope = createResourceScope('uji', { logger });
    const seen = [];
    scope.get('rusak', () => ({}), { dispose: () => { throw new Error('gagal'); } });
    scope.get('ok', () => 42, { dispose: (v) => seen.push(v) });
    scope.dispose();
    expect(seen).toEqual([42]);
    expect(logger.calls).toHaveLength(1);
    expect(logger.calls[0][0]).toContain('"rusak"');
  });

  it('forget melepas kunci tanpa dispose', () => {
    const scope = createResourceScope('uji');
    const mat = scope.get('m', () => new THREE.MeshBasicMaterial());
    const hit = onDispose(mat);
    expect(scope.forget('m')).toBe(true);
    expect(scope.forget('m')).toBe(false);
    expect(scope.owns(mat)).toBe(false);
    scope.dispose();
    expect(hit.n).toBe(0);
  });

  it('get setelah dispose atau dengan make bukan fungsi melempar', () => {
    const scope = createResourceScope('uji');
    expect(() => scope.get('x', 5)).toThrow(TypeError);
    scope.dispose();
    expect(() => scope.get('x', () => 1)).toThrow(/sudah di-dispose/);
  });

  it('collectResources: hanya sumber daya three langsung (satu tingkat)', () => {
    const m = new THREE.MeshBasicMaterial();
    expect(collectResources(m)).toEqual([m]);
    expect(collectResources(null)).toEqual([]);
    expect(collectResources(Promise.resolve())).toEqual([]);
    expect(collectResources({ nested: { m } })).toEqual([]);
  });
});

describe('ResourceScope: scope aktif', () => {
  it('default global; withScope menukar sementara dan memulihkan walau melempar', () => {
    const global = currentScope();
    expect(global.name).toBe('global');
    const s = createResourceScope('region');
    expect(withScope(s, () => currentScope())).toBe(s);
    expect(currentScope()).toBe(global);
    expect(() => withScope(s, () => { throw new Error('x'); })).toThrow('x');
    expect(currentScope()).toBe(global);
    expect(() => withScope(null, () => 1)).toThrow(TypeError);
  });
});
