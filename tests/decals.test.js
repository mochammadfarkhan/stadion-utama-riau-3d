import { describe, it, expect } from 'vitest';
import { createDecalLayout, countDecals } from '../src/world/Decals.layout.js';
import { createDecals } from '../src/world/Decals.js';
import { DECAL_NAMES } from '../src/world/textures/decalAtlas.js';
import { STADIUM, SITE } from '../src/config/constants.js';
import { distanceToGateCorridor } from '../src/core/Collider.js';

const inEllipse = (x, z, a, b) => (x * x) / (a * a) + (z * z) / (b * b) < 1;

describe('Decals.layout', () => {
  const items = createDecalLayout();

  it('deterministik & hanya memakai nama atlas', () => {
    expect(createDecalLayout()).toEqual(items);
    items.forEach((d) => {
      expect(DECAL_NAMES).toContain(d.name);
      [d.x, d.y, d.z, d.rotY, d.scale].forEach((v) => expect(Number.isFinite(v)).toBe(true));
    });
  });

  it('jumlah per jenis sesuai rencana', () => {
    const c = countDecals(items);
    expect(c.crack1 + c.crack2).toBe(120);
    expect(c.oil + c.water).toBe(40);
    expect(c.tire).toBe(15);
    expect(c.moss).toBeGreaterThanOrEqual(18);
    expect(c.graffiti1 + c.graffiti2).toBe(6);
    expect(c.manhole).toBe(12);
    expect(c.zebra).toBe(2);
    expect(c.arrow).toBe(8);
    expect(c.parkingP).toBe(2);
  });

  it('retak berada di sabuk plaza, di luar koridor gate & kolam tugu', () => {
    items.filter((d) => d.name.startsWith('crack')).forEach((d) => {
      expect(inEllipse(d.x, d.z, SITE.plazaSemiX, SITE.plazaSemiZ)).toBe(true);
      expect(inEllipse(d.x, d.z, STADIUM.outerSemiX + 1, STADIUM.outerSemiZ + 1)).toBe(false);
      expect(distanceToGateCorridor(d.x, d.z)).toBeGreaterThanOrEqual(7);
      expect(Math.hypot(d.x, d.z + STADIUM.outerSemiZ + 45)).toBeGreaterThanOrEqual(14);
    });
  });

  it('hanya grafiti & lumut tugu yang vertikal', () => {
    items.forEach((d) => expect(Boolean(d.vertical)).toBe(d.name.startsWith('graffiti') || (d.name === 'moss' && d.y > 0.1)));
  });
});

describe('createDecals', () => {
  it('satu InstancedMesh dengan aUvRect per instance', () => {
    const group = createDecals();
    expect(group.children).toHaveLength(1);
    const mesh = group.children[0];
    expect(mesh.isInstancedMesh).toBe(true);
    expect(mesh.count).toBe(createDecalLayout().length);
    expect(mesh.geometry.getAttribute('aUvRect').count).toBe(mesh.count);
    expect(mesh.material.depthWrite).toBe(false);
    expect(mesh.receiveShadow).toBe(false);
  });

  it('daftar kosong → grup kosong', () => {
    expect(createDecals({ items: [] }).children).toHaveLength(0);
  });
});
