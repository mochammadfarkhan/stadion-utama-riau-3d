import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { createInteriorPortal, createStubInterior, appStage, PORTAL_STATES, LOCKED_TOAST } from '../../src/app/interiorPortal.js';
import { createResourceScope } from '../../src/engine/ResourceScope.js';
import { createSystemRunner } from '../../src/engine/SystemRunner.js';
import { nearestPortal } from '../../src/app/portalTrigger.js';
import { PORTAL_DOORS } from '../../src/regions/unri-lembaga/portalDoors.js';
import { LEMBAGA_PLACEMENT } from '../../src/regions/unri-lembaga/placement.js';

const EXIT_TO = Object.freeze({ region: 'unri-lembaga', x: -2.79, z: -1.86, yaw: -0.33 });

function setup({ build } = {}) {
  const scopes = [];
  const restore = vi.fn();
  const view = { setView: vi.fn() };
  const stage = { swap: vi.fn(() => restore) };
  const fader = { fade: vi.fn(() => Promise.resolve()) };
  const pressed = new Set();
  const input = { consumePress: (c) => pressed.delete(c), endFrame: vi.fn() };
  const toast = vi.fn();
  const exited = vi.fn();
  const prompt = vi.fn();
  const stub = createStubInterior({ id: 'sekre', label: 'Sekretariat UKM SENI', exitTo: EXIT_TO });
  const def = build ? { ...stub, build } : stub;
  const portal = createInteriorPortal({
    interiors: { sekre: def }, view, stage, fader, input, prompt, onToast: toast, onExited: exited,
    createScope: (n) => {
      const s = createResourceScope(n);
      scopes.push(s);
      return s;
    },
    logger: { error: () => {}, warn: () => {} },
  });
  return { portal, view, stage, restore, fader, pressed, input, toast, exited, prompt, scopes };
}

describe('interiorPortal (spec §4.8)', () => {
  it('outside → fadingIn → inside: view & runner ditukar, prompt keluar', async () => {
    const t = setup();
    expect(t.portal.state).toBe(PORTAL_STATES.OUTSIDE);
    const p = t.portal.enter('sekre');
    expect(t.portal.state).toBe(PORTAL_STATES.FADING_IN);
    await expect(p).resolves.toBe(true);
    expect(t.portal.state).toBe(PORTAL_STATES.INSIDE);
    expect(t.portal.activeId).toBe('sekre');
    expect(t.stage.swap).toHaveBeenCalledTimes(1);
    const v = t.view.setView.mock.calls[0][0];
    expect(v.scene).toBeInstanceOf(THREE.Scene);
    expect(v.camera).toBeInstanceOf(THREE.PerspectiveCamera);
    expect(t.fader.fade.mock.calls.map((c) => c[0])).toEqual([1, 0]);
    expect(t.prompt).toHaveBeenLastCalledWith('Tekan E — Keluar');
  });

  it('enter saat bukan outside / id tak dikenal → false tanpa build kedua', async () => {
    const t = setup();
    const first = t.portal.enter('sekre');
    await expect(t.portal.enter('sekre')).resolves.toBe(false);
    await first;
    await expect(t.portal.enter('sekre')).resolves.toBe(false);
    expect(t.stage.swap).toHaveBeenCalledTimes(1);
    const u = setup();
    await expect(u.portal.enter('kantin')).resolves.toBe(false);
    expect(u.portal.state).toBe(PORTAL_STATES.OUTSIDE);
  });

  it('inside → fadingOut → outside: interior dilepas penuh, view & runner pulih, exitTo dilaporkan', async () => {
    const t = setup();
    await t.portal.enter('sekre');
    const p = t.portal.exit();
    expect(t.portal.state).toBe(PORTAL_STATES.FADING_OUT);
    await expect(p).resolves.toBe(true);
    expect(t.portal.state).toBe(PORTAL_STATES.OUTSIDE);
    expect(t.restore).toHaveBeenCalledTimes(1);
    expect(t.view.setView).toHaveBeenLastCalledWith(null);
    expect(t.scopes[0].disposed).toBe(true);
    expect(t.exited).toHaveBeenCalledWith(EXIT_TO);
    expect(t.prompt).toHaveBeenLastCalledWith(null);
    await expect(t.portal.exit()).resolves.toBe(false);
  });

  it('build melempar: fade dibatalkan, tetap di luar, toast "Pintu terkunci", scope dilepas', async () => {
    const t = setup({ build: () => { throw new Error('rusak'); } });
    await expect(t.portal.enter('sekre')).resolves.toBe(false);
    expect(t.portal.state).toBe(PORTAL_STATES.OUTSIDE);
    expect(t.toast).toHaveBeenCalledWith(LOCKED_TOAST, false);
    expect(t.scopes[0].disposed).toBe(true);
    expect(t.view.setView).not.toHaveBeenCalled();
    expect(t.stage.swap).not.toHaveBeenCalled();
    expect(t.fader.fade.mock.calls.map((c) => c[0])).toEqual([1, 0]);
  });

  it('tombol E di dalam memicu keluar lewat sistem runner interior; endFrame dipanggil', async () => {
    const t = setup();
    let runner = null;
    t.stage.swap.mockImplementation((r) => {
      runner = r;
      return t.restore;
    });
    await t.portal.enter('sekre');
    t.pressed.add('KeyE');
    runner.update(0.016, {});
    expect(t.portal.state).toBe(PORTAL_STATES.FADING_OUT);
    expect(t.input.endFrame).toHaveBeenCalled();
    await vi.waitFor(() => expect(t.portal.state).toBe(PORTAL_STATES.OUTSIDE));
  });

  it('dispose di dalam: pemulihan segera, enter berikutnya ditolak', async () => {
    const t = setup();
    await t.portal.enter('sekre');
    t.portal.dispose();
    expect(t.restore).toHaveBeenCalledTimes(1);
    expect(t.view.setView).toHaveBeenLastCalledWith(null);
    expect(t.scopes[0].disposed).toBe(true);
    await expect(t.portal.enter('sekre')).resolves.toBe(false);
  });
});

describe('appStage', () => {
  it('menukar runner App dan mengalihkan addSystem ke runner eksterior selama di dalam', () => {
    const exterior = createSystemRunner();
    const app = {
      systems: exterior,
      addSystem(s) { return this.systems.add(s); },
      removeSystem(id) { return this.systems.remove(id); },
    };
    const interior = createSystemRunner();
    const restore = appStage(app).swap(interior);
    expect(app.systems).toBe(interior);
    app.addSystem({ id: 'region.baru', phase: 'world', update: () => {} });
    expect(exterior.remove('region.baru', { dispose: false })).toBe(true);
    restore();
    expect(app.systems).toBe(exterior);
    expect(Object.hasOwn(app, 'addSystem')).toBe(false);
  });
});

describe('nearestPortal', () => {
  const active = [{ def: { id: 'unri-lembaga', placement: LEMBAGA_PLACEMENT }, region: { portals: PORTAL_DOORS } }];
  const door = PORTAL_DOORS[0];
  const wx = LEMBAGA_PLACEMENT.x + door.pos.lx;
  const wz = LEMBAGA_PLACEMENT.z + door.pos.lz;

  it('dalam radius → pintu & region; di luar radius → null', () => {
    expect(nearestPortal(active, wx + 1.0, wz)).toMatchObject({ regionId: 'unri-lembaga', door });
    expect(nearestPortal(active, wx + 2.0, wz)).toBeNull();
  });

  it('region tanpa portals diabaikan', () => {
    expect(nearestPortal([{ def: { id: 'stadion', placement: { x: 0, z: 0, yaw: 0 } }, region: {} }], 0, 0)).toBeNull();
  });
});
