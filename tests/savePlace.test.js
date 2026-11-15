import { describe, it, expect } from 'vitest';
import { autosaveDue, restorePlace, AUTOSAVE } from '../src/app/savePlace.js';

describe('simpan tempat berkala', () => {
  it('menunggu everyS dan perpindahan > minMoveM; simpan pertama tanpa titik pembanding', () => {
    expect(autosaveDue(AUTOSAVE.everyS - 0.1, null, { x: 0, z: 0 })).toBe(false);
    expect(autosaveDue(AUTOSAVE.everyS, null, { x: 0, z: 0 })).toBe(true);
    expect(autosaveDue(AUTOSAVE.everyS, { x: 0, z: 0 }, { x: 3, z: 3 })).toBe(false);
    expect(autosaveDue(AUTOSAVE.everyS, { x: 0, z: 0 }, { x: 4, z: 4 })).toBe(true);
  });
});

describe('pulihkan tempat terakhir', () => {
  const frame = { identity: false, toWorld: (x, z) => ({ x: x + 100, z: z + 200 }), yawToWorld: (y) => y + 1 };
  const setup = (savedPlace) => {
    const calls = [];
    const deps = {
      story: { savedPlace },
      regions: { frameOf: (id) => (id === 'unri-lembaga' ? frame : null) },
      travel: { goTo: async (p) => { calls.push(p); return 'ok'; } },
      ents: { bike: { setMode: (m) => calls.push(`mode:${m}`) } },
    };
    return { calls, deps };
  };

  it('titik region diubah ke dunia (posisi + arah), lalu kendaraan dipulihkan', async () => {
    const { calls, deps } = setup({ region: 'unri-lembaga', x: 1, z: 2, yaw: 0.5, mode: 'jalan' });
    expect(await restorePlace(deps)).toBe(true);
    expect(calls).toEqual([{ x: 101, z: 202, yaw: 1.5, label: 'tempat terakhir' }, 'mode:jalan']);
  });

  it('tanpa simpanan atau region tak dikenal: tidak berpindah', async () => {
    const a = setup(null);
    expect(await restorePlace(a.deps)).toBe(false);
    const b = setup({ region: 'hilang', x: 1, z: 2, yaw: 0, mode: 'sepeda' });
    expect(await restorePlace(b.deps)).toBe(false);
    expect([...a.calls, ...b.calls]).toEqual([]);
  });
});
