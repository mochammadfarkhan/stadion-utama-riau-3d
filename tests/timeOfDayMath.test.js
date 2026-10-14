import { describe, it, expect } from 'vitest';
import {
  TOD, PHASES, todPoint, todHours, skyColorsAt, phaseAt, fmtClock, parseClock, trackGradientCss,
} from '../src/ui/controls/TimeOfDay.math.js';

const HEX = /^#[0-9a-f]{6}$/;

describe('todPoint', () => {
  it('jam 12 di puncak busur siang', () => {
    const p = todPoint(12);
    expect(p.x).toBeCloseTo(TOD.cx, 6);
    expect(p.y).toBeCloseTo(TOD.cy - TOD.up, 6);
    expect(p.elev).toBeCloseTo(1, 6);
  });
  it('jam 06 di horizon kiri, 18 di horizon kanan', () => {
    expect(todPoint(6).x).toBeCloseTo(TOD.cx - TOD.rx, 6);
    expect(todPoint(6).y).toBeCloseTo(TOD.cy, 6);
    expect(todPoint(18).x).toBeCloseTo(TOD.cx + TOD.rx, 6);
    expect(todPoint(18).y).toBeCloseTo(TOD.cy, 6);
  });
  it('jam 00 di bawah horizon (nadir busur malam)', () => {
    const p = todPoint(0);
    expect(p.y).toBeGreaterThan(TOD.cy);
    expect(p.y).toBeCloseTo(TOD.cy + TOD.down, 6);
    expect(p.elev).toBeCloseTo(-1, 6);
  });
  it('jam 24 sama dengan jam 0; input tak valid tidak melempar', () => {
    expect(todPoint(24)).toEqual(todPoint(0));
    expect(Number.isFinite(todPoint(NaN).x)).toBe(true);
  });
});

describe('todHours (invers)', () => {
  it('todHours(todPoint(h)) ≈ h', () => {
    for (const h of [0.5, 3, 6, 7.25, 9, 12, 14.75, 16.5, 18, 20, 21, 23.5]) {
      const p = todPoint(h);
      expect(Math.abs(todHours(p.x, p.y) - h)).toBeLessThan(0.05);
    }
  });
  it('titik jauh di luar busur tetap memetakan ke jam yang masuk akal', () => {
    expect(todHours(TOD.cx, -500)).toBeCloseTo(12, 2);
    expect(todHours(TOD.cx, 1000)).toBeCloseTo(0, 2);
  });
});

describe('phaseAt', () => {
  it('memetakan jam ke fase sesuai nama yang disepakati', () => {
    const cases = [
      [1, 'Malam'], [5, 'Subuh'], [6.2, 'Matahari terbit'], [8, 'Pagi'], [12, 'Siang'],
      [16, 'Sore'], [17.3, 'Jam emas'], [18.2, 'Magrib'], [19, 'Senja'], [23, 'Malam'],
    ];
    for (const [h, name] of cases) expect(phaseAt(h)).toBe(name);
  });
  it('hanya mengembalikan nama dari daftar PHASES', () => {
    for (let h = 0; h < 24; h += 0.25) expect(PHASES).toContain(phaseAt(h));
  });
});

describe('skyColorsAt', () => {
  it('mengembalikan hex valid untuk zenith/horizon/sea', () => {
    for (const h of [0, 5.5, 6, 12, 17.5, 18.5, 23.9]) {
      const c = skyColorsAt(h);
      expect(c.zenith).toMatch(HEX);
      expect(c.horizon).toMatch(HEX);
      expect(c.sea).toMatch(HEX);
    }
  });
  it('siang lebih terang dari malam', () => {
    const lum = (hex) => parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5), 16);
    expect(lum(skyColorsAt(12).zenith)).toBeGreaterThan(lum(skyColorsAt(0).zenith));
  });
});

describe('fmtClock / parseClock', () => {
  it('format jam HH:MM', () => {
    expect(fmtClock(16.5)).toBe('16:30');
    expect(fmtClock(0)).toBe('00:00');
    expect(fmtClock(24)).toBe('00:00');
    expect(fmtClock(9.999)).toBe('10:00');
  });
  it('parse valid', () => {
    expect(parseClock('14:30')).toBeCloseTo(14.5, 6);
    expect(parseClock('14.5')).toBeCloseTo(14.5, 6);
    expect(parseClock('14,25')).toBeCloseTo(14.25, 6);
    expect(parseClock(' 9 ')).toBe(9);
    expect(parseClock('24:00')).toBe(24);
  });
  it('parse tak valid → null', () => {
    for (const s of ['', 'abc', '25:00', '12:60', '-1', '24:30', null, undefined, '1:2:3']) {
      expect(parseClock(s)).toBeNull();
    }
  });
});

describe('trackGradientCss', () => {
  it('linear-gradient dengan 25 stop', () => {
    const css = trackGradientCss();
    expect(css.startsWith('linear-gradient(90deg,')).toBe(true);
    const stops = css.match(/#[0-9a-f]{6} \d+(\.\d+)?%/g);
    expect(stops).toHaveLength(25);
    expect(css).toContain(' 0.00%');
    expect(css).toContain(' 100.00%');
  });
});
