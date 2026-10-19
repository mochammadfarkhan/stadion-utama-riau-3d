// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { createAttribution, ATTRIBUTION } from '../src/ui/Attribution.js';

describe('atribusi data peta', () => {
  it('teks © OpenStreetMap contributors · Overture · SRTM + tautan hak cipta; dispose melepas', () => {
    const a = createAttribution(document.body);
    const el = document.getElementById('map-attribution');
    expect(el.textContent).toBe('© OpenStreetMap contributors · Overture Maps Foundation · elevasi SRTM (NASA/USGS)');
    const link = el.querySelector('a');
    expect(link.href).toBe(ATTRIBUTION.href);
    expect(link.rel).toContain('noopener');
    a.dispose();
    expect(document.getElementById('map-attribution')).toBeNull();
  });
});
