import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CONTROL_HELP } from '../src/config/controlsHelp.js';

const SOURCES = ['src/app/keymap.js', 'src/entities/Bicycle.js', 'src/app/inventory.js', 'src/app/farm.js',
  'src/core/cameraPresets.js', 'src/ui/Panel.js', 'src/core/Input.js', 'src/app/shop.js'];
const code = SOURCES.map((p) => { try { return readFileSync(p, 'utf8'); } catch { return ''; } }).join('\n');

/** Label tombol di bantuan → pola yang harus muncul di kode. */
const pattern = (k) => {
  if (/^[A-Z]$/.test(k)) return new RegExp(`Key${k}|'${k.toLowerCase()}'`);
  if (/^[0-9]$/.test(k)) return new RegExp(`Digit${k}`);
  if (k === '1–8') return /Digit8/;
  if (k === '1–9') return /Digit9|Digit\$\{|digit/i;
  if (k === 'Esc') return /Escape/;
  if (k === '[') return /BracketLeft/;
  if (k === ']') return /BracketRight/;
  if (k === 'Shift') return /Shift/;
  if (k === 'Space') return /Space/;
  if (k === 'F1') return /F1/;
  return null;
};

describe('CONTROL_HELP', () => {
  it('tiap tombol ada di berkas sumber kontrol (daftar tidak basi)', () => {
    const missing = CONTROL_HELP.flatMap((c) => c.keys ?? []).filter((k) => !pattern(k)?.test(code));
    expect(missing).toEqual([]);
  });
});
