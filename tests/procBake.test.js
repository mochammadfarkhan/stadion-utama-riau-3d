import { afterEach, describe, expect, it, vi } from 'vitest';
import { procKey } from '../src/world/textures/noise.js';
import { captureProc, getBaked, preloadProcTextures, registerBaked, releaseBaked } from '../src/world/textures/procBake.js';

const gray = (k) => (u, v, n) => {
  const g = n(u, v, { freq: 8, octaves: 3, seed: 2 }) * k;
  return [g, g, g];
};

describe('procKey (sidik jari isi generator)', () => {
  it('deterministik untuk generator dan ukuran yang sama', () => {
    expect(procKey(512, 512, true, gray(255))).toBe(procKey(512, 512, true, gray(255)));
  });

  it('berubah bila warna/parameter, ukuran, atau colorSpace berubah', () => {
    const base = procKey(512, 512, true, gray(255));
    expect(procKey(512, 512, true, gray(254))).not.toBe(base);
    expect(procKey(256, 512, true, gray(255))).not.toBe(base);
    expect(procKey(512, 512, false, gray(255))).not.toBe(base);
  });

  it('aman dipakai sebagai nama berkas', () => {
    expect(procKey(64, 32, false, gray(1))).toMatch(/^[a-z0-9-]+$/);
  });
});

describe('registri bitmap hasil bake', () => {
  it('getBaked boleh berulang; releaseBaked menutup semua bitmap lalu registri kosong', () => {
    let closed = 0;
    const bmp = { width: 4, height: 4, close: () => { closed += 1; } };
    registerBaked('k1', bmp);
    expect(getBaked('k1')).toBe(bmp);
    expect(getBaked('k1')).toBe(bmp);
    releaseBaked();
    expect(closed).toBe(1);
    expect(getBaked('k1')).toBeNull();
  });

  it('captureProc hanya merekam saat kait bake aktif', () => {
    captureProc('a', 2, 2, true, new Uint8Array(16));
    globalThis.__procBake = [];
    captureProc('b', 2, 2, false, new Uint8Array(16));
    expect(globalThis.__procBake.map((e) => e.key)).toEqual(['b']);
    delete globalThis.__procBake;
  });
});

describe('preloadProcTextures', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('memuat entri manifest ke registri; berkas gagal dilewati tanpa melempar', async () => {
    const files = { 'proc/manifest.json': { entries: [{ key: 'ok', file: 'ok.webp' }, { key: 'rusak', file: 'rusak.webp' }] } };
    const fetchImpl = async (url) => {
      const path = url.replace('/base/textures/', '');
      if (path === 'proc/manifest.json') return { ok: true, json: async () => files[path] };
      if (path === 'proc/ok.webp') return { ok: true, blob: async () => 'blob-ok' };
      return { ok: false, status: 404 };
    };
    const decode = async (blob) => ({ decoded: blob });
    const n = await preloadProcTextures('/base/', { fetchImpl, decode, warn: () => {} });
    expect(n).toBe(1);
    expect(getBaked('ok')).toEqual({ decoded: 'blob-ok' });
    expect(getBaked('rusak')).toBeNull();
    releaseBaked();
  });

  it('manifest tidak ada: 0 tekstur, tidak melempar', async () => {
    const n = await preloadProcTextures('/', { fetchImpl: async () => ({ ok: false, status: 404 }), decode: async () => null, warn: () => {} });
    expect(n).toBe(0);
  });
});
