import { describe, it, expect } from 'vitest';
import { patchNightGlowSource } from '../../src/city/nightGlow.js';
import { buildStadionProxy } from '../../src/regions/stadion/proxy.js';

const frag = { fragmentShader: '#include <common>\n#include <emissivemap_fragment>\n' };

describe('cahaya malam', () => {
  it('rata: emisi hangat × uNight tanpa sampler', () => {
    const out = patchNightGlowSource(frag, { strength: 0.25, glowMap: false }).fragmentShader;
    expect(out).toContain('uniform float uNight;');
    expect(out).toContain('totalEmissiveRadiance += vec3(1.0, 0.64, 0.3) * uNight * 0.250;');
    expect(out).not.toContain('uGlowMap');
  });
  it('peta pendar: sampler uGlowMap dibaca pada vMapUv', () => {
    const out = patchNightGlowSource(frag, { strength: 0.7, glowMap: true }).fragmentShader;
    expect(out).toContain('uniform sampler2D uGlowMap;');
    expect(out).toContain('texture2D(uGlowMap, vMapUv).r * 0.700');
  });
});

describe('proxy stadion malam', () => {
  it('lampu sorot = mesh terpisah; setNight menerangkan warna dan dijepit ke [0, 1]', () => {
    const p = buildStadionProxy();
    const lamp = p.group.children.find((c) => c.name.endsWith(':lampu'));
    expect(lamp).toBeTruthy();
    const day = lamp.material.color.getHex();
    p.setNight(1);
    const night = lamp.material.color;
    expect(night.r).toBeGreaterThan(1); // lebih terang dari putih (HDR, ×1,6)
    p.setNight(5); // dijepit
    expect(lamp.material.color.r).toBeCloseTo(night.r, 6);
    p.setNight(0);
    expect(lamp.material.color.getHex()).toBe(day);
    p.dispose();
  });
});
