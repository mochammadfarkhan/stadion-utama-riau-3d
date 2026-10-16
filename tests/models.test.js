import { describe, it, expect } from 'vitest';
import { Group } from 'three';
import { modelUrl, placeModels } from '../src/world/assets/models.js';
import { LAYOUT } from '../src/regions/stadion/layout.js';

describe('pemuat model Blender', () => {
  it('modelUrl memakai base Vite dan tidak menggandakan garis miring', () => {
    expect(modelUrl('models/a.glb')).toMatch(/^\/.*models\/a\.glb$/);
    expect(modelUrl('/models/a.glb')).not.toContain('//models');
  });
  it('model yang gagal dimuat dilewati tanpa melempar error', async () => {
    const g = new Group();
    const res = await placeModels(g, [{ path: 'models/tidak-ada.glb' }]);
    expect(res.placed).toBe(0);
    expect(res.failed).toHaveLength(1);
    expect(g.children).toHaveLength(0);
  });
  it('layout memuat daftar model dengan path .glb', () => {
    expect(LAYOUT.blenderModels.length).toBeGreaterThan(0);
    for (const m of LAYOUT.blenderModels) expect(m.path).toMatch(/\.glb$/);
  });
});
