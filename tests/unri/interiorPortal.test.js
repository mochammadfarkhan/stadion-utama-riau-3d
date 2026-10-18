import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { createResourceScope } from '../../src/engine/ResourceScope.js';
import { defineInterior } from '../../src/interiors/Interior.js';
import {
  createInteriorPortal, isSystemActiveInside, walkIntent, KEEP_INSIDE, PORTAL_STATES, LOCKED_TOAST,
} from '../../src/app/interiorPortal.js';
import { nearestPortal } from '../../src/app/portalTrigger.js';
import { PORTAL_DOORS } from '../../src/regions/unri-lembaga/portalDoors.js';
import { LEMBAGA_PLACEMENT } from '../../src/regions/unri-lembaga/placement.js';

const flush = () => new Promise((r) => setTimeout(r, 0));
const identity = { toWorld: (x, z) => ({ x, z }), yawToWorld: (y) => y };

function fakeApp() {
  const systems = new Map();
  return {
    systems,
    aoEnabled: false,
    renderer: { domElement: null },
    addSystem: vi.fn((s) => { systems.set(s.id, s); return s; }),
    removeSystem: vi.fn((id) => { systems.get(id)?.dispose?.(); return systems.delete(id); }),
    setView: vi.fn(),
    setSystemGate: vi.fn(),
    setAO: vi.fn(function setAO(on) { this.aoEnabled = Boolean(on); }),
    setBaseExposure: vi.fn(),
  };
}

function fakeInput() {
  const pressed = new Set();
  const down = new Set();
  return {
    pressed, down,
    press: (c) => pressed.add(c),
    isDown: (c) => down.has(c),
    consumePress: (c) => pressed.delete(c),
    endFrame: () => pressed.clear(),
  };
}

const fakeHud = () => ({ toast: vi.fn(), setPrompt: vi.fn(), setTime: vi.fn(), tickFps: vi.fn(), setCameraMode: vi.fn() });

const fakeFactories = () => ({
  rig: vi.fn(() => ({
    mode: 'first', yaw: 0, photo: false, busy: false, firstPersonView: true,
    lookBy: vi.fn(), toggleMode: vi.fn(() => 'third'), setPhoto: vi.fn(function setPhoto(on) { this.photo = on; }),
    applyPreset: vi.fn(), cancelPeek: vi.fn(), viewDirection: () => ({ x: 0, y: 0, z: 1 }), update: vi.fn(), dispose: vi.fn(),
  })),
  walker: vi.fn(() => ({ group: new THREE.Group(), state: { x: 0, z: 0, yaw: 0 }, update: vi.fn(), setVisible: vi.fn(), dispose: vi.fn() })),
  card: vi.fn(() => ({
    open: false, show: vi.fn(function show() { this.open = true; }), hide: vi.fn(function hide() { this.open = false; }), dispose: vi.fn(),
  })),
});

function makeInterior(build) {
  const disposed = vi.fn();
  const sysDispose = vi.fn();
  const items = [{
    id: 'kipas', label: 'Kipas', pos: { x: 0, y: 1, z: 1 }, radius: 2, prompt: 'Nyalakan kipas',
    onInteract: vi.fn(() => ({ title: 'Kipas', text: 'Menyala' })),
  }];
  const def = defineInterior({
    id: 'sekre', label: 'Sekre', size: { w: 4.2, d: 6, h: 3.2 }, spawn: { x: 1.5, z: -2.4, yaw: 0 },
    exitTo: { region: 'unri-lembaga', x: 10, z: 5, yaw: 0 },
    build: build ?? (async () => ({
      scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), colliders: { isWalkable: () => true },
      interactables: items,
      photoPresets: [{ id: 'atas', label: 'Atas', pose: { position: [0, 3, 0], target: [0, 0, 0.5] } }],
      systems: [{ id: 'interior.sekre.uji', phase: 'sim', update() {}, dispose: sysDispose }],
      dispose: disposed,
    })),
  });
  return { def, disposed, sysDispose, items };
}

function setup({ build } = {}) {
  const app = fakeApp();
  const input = fakeInput();
  const hud = fakeHud();
  const { def, disposed, sysDispose, items } = makeInterior(build);
  const scopes = [];
  const states = [];
  const bike = { state: { x: 10.5, z: 5.2, yaw: 1 }, teleport: vi.fn() };
  const store = { get: vi.fn((k) => ({ 'weather.sound': true, 'graphics.ao': false, 'camera.fov': 70 })[k]) };
  const weather = { setSoundEnabled: vi.fn(), isRaining: false, intensity: 0, weatherName: 'Cerah' };
  const flags = { photo: false, blocking: false };
  const regionManager = {
    active: () => [{
      def: { id: 'unri-lembaga' }, frame: identity,
      region: { portals: [{ id: 'sekre-pemain', interiorId: 'sekre', pos: { lx: 10, lz: 5 }, yaw: 0, radius: 1.6, prompt: 'Masuk sekre' }] },
    }],
    frameOf: () => identity,
  };
  const portal = createInteriorPortal({
    app, input, hud, interiors: new Map([[def.id, def]]), regionManager, store, weather, bike,
    time: { hour: 10, presetName: 'pagi' },
    fader: { fade: vi.fn(async () => {}) },
    createScope: (name) => { const s = createResourceScope(name); scopes.push(s); return s; },
    factories: fakeFactories(),
    onState: (s) => states.push(s),
    isPhotoUi: () => flags.photo,
    isUiBlocking: () => flags.blocking,
    logger: { error: vi.fn() },
  });
  return { app, input, hud, portal, scopes, states, bike, weather, flags, def, disposed, sysDispose, items };
}

describe('aturan sistem di dalam interior', () => {
  it('jam, cuaca, input, scheduler, dan sistem interior.* tetap jalan; sisanya dijeda', () => {
    for (const id of KEEP_INSIDE) expect(isSystemActiveInside(id)).toBe(true);
    expect(isSystemActiveInside('interior.walk')).toBe(true);
    for (const id of ['cameraRig', 'lighting', 'entities.0', 'hud', 'minimap', 'story', 'updatable-3']) {
      expect(isSystemActiveInside(id)).toBe(false);
    }
    expect(isSystemActiveInside(undefined)).toBe(false);
  });

  it('penanda kompatibilitas M4', () => {
    expect(PORTAL_STATES).toEqual({ OUTSIDE: 'outside', FADING_IN: 'fadingIn', INSIDE: 'inside', FADING_OUT: 'fadingOut' });
    expect(LOCKED_TOAST).toBe('Pintu terkunci');
  });

  it('walkIntent: W/S maju-mundur, A/D geser, Shift lari', () => {
    const input = fakeInput();
    for (const c of ['KeyW', 'KeyD', 'ShiftLeft']) input.down.add(c);
    expect(walkIntent(input, 0.5)).toEqual({ forward: 1, strafe: 1, run: true, yaw: 0.5 });
  });
});

describe('createInteriorPortal: mesin state', () => {
  it('mulai di luar; enter → fadingIn → inside; view, gerbang, sistem, AO, suara hujan eksterior', async () => {
    const t = setup();
    expect(t.portal.state).toBe('outside');
    expect(await t.portal.enter('sekre')).toBe(true);
    expect(t.states).toEqual(['fadingIn', 'inside']);
    expect(t.portal.inside).toBe(true);
    expect(t.app.setView.mock.calls.at(-1)[0].scene.isScene).toBe(true);
    expect(t.app.setSystemGate).toHaveBeenLastCalledWith(isSystemActiveInside);
    expect([...t.app.systems.keys()]).toEqual(expect.arrayContaining([
      'interior.sekre.uji', 'interior.keys', 'interior.walk', 'interior.interact', 'interior.camera', 'interior.hud',
    ]));
    expect(t.app.setAO).toHaveBeenCalledWith(true);
    expect(t.weather.setSoundEnabled).toHaveBeenLastCalledWith(false);
  });

  it('exit → fadingOut → outside; semua dilepas & dipulihkan; sepeda dekat pintu tidak dipindah', async () => {
    const t = setup();
    await t.portal.enter('sekre');
    expect(await t.portal.exit()).toBe(true);
    expect(t.states).toEqual(['fadingIn', 'inside', 'fadingOut', 'outside']);
    expect(t.app.systems.size).toBe(0);
    expect(t.sysDispose).toHaveBeenCalledTimes(1);
    expect(t.disposed).toHaveBeenCalledTimes(1);
    expect(t.app.setView).toHaveBeenLastCalledWith(null);
    expect(t.app.setSystemGate).toHaveBeenLastCalledWith(null);
    expect(t.app.setAO).toHaveBeenLastCalledWith(false);
    expect(t.weather.setSoundEnabled).toHaveBeenLastCalledWith(true);
    expect(t.scopes[0].disposed).toBe(true);
    expect(t.bike.teleport).not.toHaveBeenCalled();
  });

  it('sepeda jauh dari pintu (masuk lewat dev/E2E) dipindah ke exitTo', async () => {
    const t = setup();
    t.bike.state = { x: 500, z: -300, yaw: 0 };
    await t.portal.enter('sekre');
    await t.portal.exit();
    expect(t.bike.teleport).toHaveBeenCalledWith(10, 5, 0);
  });

  it('build melempar: tetap di luar, toast "Pintu terkunci", scope dilepas, view & gerbang tidak disentuh', async () => {
    const t = setup({ build: async () => { throw new Error('rusak'); } });
    expect(await t.portal.enter('sekre')).toBe(false);
    expect(t.states).toEqual(['fadingIn', 'outside']);
    expect(t.hud.toast).toHaveBeenCalledWith('Pintu terkunci', false);
    expect(t.scopes[0].disposed).toBe(true);
    expect(t.app.setView).not.toHaveBeenCalled();
    expect(t.app.setSystemGate).not.toHaveBeenCalled();
  });

  it('hasil build tidak valid: hasil & scope dilepas, toast, tidak ada sistem terpasang', async () => {
    const dispose = vi.fn();
    const t = setup({ build: async () => ({ scene: new THREE.Scene(), dispose }) });
    expect(await t.portal.enter('sekre')).toBe(false);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(t.scopes[0].disposed).toBe(true);
    expect(t.hud.toast).toHaveBeenCalledWith('Pintu terkunci', false);
    expect(t.app.systems.size).toBe(0);
  });

  it('enter ganda saat fade & exit di luar ditolak; interior tak dikenal → toast', async () => {
    const t = setup();
    const first = t.portal.enter('sekre');
    expect(await t.portal.enter('sekre')).toBe(false);
    await first;
    await t.portal.exit();
    expect(await t.portal.exit()).toBe(false);
    expect(await t.portal.enter('gudang')).toBe(false);
    expect(t.hud.toast).toHaveBeenCalledWith('Pintu terkunci', false);
  });

  it('siklus masuk/keluar 3×: tiap scope dilepas, tidak ada sistem tersisa, add = remove', async () => {
    const t = setup();
    for (let i = 0; i < 3; i += 1) {
      await t.portal.enter('sekre');
      await t.portal.exit();
    }
    expect(t.scopes).toHaveLength(3);
    expect(t.scopes.every((s) => s.disposed)).toBe(true);
    expect(t.app.systems.size).toBe(0);
    expect(t.app.addSystem.mock.calls.length).toBe(t.app.removeSystem.mock.calls.length);
  });

  it('dispose saat di dalam melepas interior tanpa fade', async () => {
    const t = setup();
    await t.portal.enter('sekre');
    t.portal.dispose();
    expect(t.disposed).toHaveBeenCalledTimes(1);
    expect(t.scopes[0].disposed).toBe(true);
    expect(t.portal.state).toBe('outside');
  });
});

describe('createInteriorPortal: pintu, interaksi, tombol', () => {
  it('doors() membaca portals region aktif dalam koordinat dunia (dev/E2E)', () => {
    const t = setup();
    const [d] = t.portal.doors();
    expect(d).toMatchObject({ id: 'sekre-pemain', interiorId: 'sekre', regionId: 'unri-lembaga', world: { x: 10, z: 5 }, worldYaw: 0 });
  });

  it('enter dengan pintu (portalTrigger M4) meneruskan door ke ctx build', async () => {
    let got = null;
    const t = setup({
      build: async (ctx) => {
        got = ctx;
        return {
          scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), colliders: { isWalkable: () => true },
          interactables: [], photoPresets: [], systems: [], dispose() {},
        };
      },
    });
    expect(await t.portal.enter('sekre', { door: { id: 'sekre-pemain', worldYaw: 0.3 } })).toBe(true);
    expect(got.door.worldYaw).toBe(0.3);
    expect(typeof got.exit).toBe('function');
    expect(got.scope).toBe(t.scopes[0]);
  });

  it('E pada barang yang dilihat: onInteract + kartu; E lagi menutup kartu', async () => {
    const t = setup();
    await t.portal.enter('sekre');
    t.app.systems.get('interior.interact').update(0.016, {});
    expect(t.hud.setPrompt).toHaveBeenLastCalledWith('Tekan E — Nyalakan kipas');
    t.input.press('KeyE');
    t.app.systems.get('interior.keys').update(0.016, {});
    expect(t.items[0].onInteract).toHaveBeenCalledTimes(1);
    const card = t.portal.current.card;
    expect(card.show).toHaveBeenCalledWith({ title: 'Kipas', text: 'Menyala' });
    t.input.press('KeyE');
    t.app.systems.get('interior.keys').update(0.016, {});
    expect(card.open).toBe(false);
  });

  it('Esc keluar, kecuali Esc yang baru menutup mode foto atau panel', async () => {
    const t = setup();
    await t.portal.enter('sekre');
    const keys = t.app.systems.get('interior.keys');
    t.flags.photo = true;
    keys.update(0.016, {});
    t.flags.photo = false;
    t.input.press('Escape');
    keys.update(0.016, {});
    await flush();
    expect(t.portal.inside).toBe(true);
    t.flags.blocking = true;
    keys.update(0.016, {});
    t.flags.blocking = false;
    t.input.press('Escape');
    keys.update(0.016, {});
    await flush();
    expect(t.portal.inside).toBe(true);
    keys.update(0.016, {});
    t.input.press('Escape');
    keys.update(0.016, {});
    await flush();
    await flush();
    expect(t.portal.state).toBe('outside');
  });

  it('V mengganti mode kamera; mode foto: tombol 1–4 memilih preset', async () => {
    const t = setup();
    await t.portal.enter('sekre');
    const keys = t.app.systems.get('interior.keys');
    const rig = t.portal.current.rig;
    t.input.press('KeyV');
    keys.update(0.016, {});
    expect(rig.toggleMode).toHaveBeenCalledTimes(1);
    t.flags.photo = true;
    t.input.press('Digit1');
    keys.update(0.016, {});
    expect(rig.setPhoto).toHaveBeenCalledWith(true);
    expect(rig.applyPreset).toHaveBeenCalledWith({ position: [0, 3, 0], target: [0, 0, 0.5] });
  });

  it('lookBy diteruskan ke rig hanya saat di dalam', async () => {
    const t = setup();
    expect(() => t.portal.lookBy(1, 2)).not.toThrow();
    await t.portal.enter('sekre');
    t.portal.lookBy(3, 4, 1.8);
    expect(t.portal.current.rig.lookBy).toHaveBeenCalledWith(3, 4, 1.8);
  });
});

// Dipertahankan dari tes M4 (pemicu pintu tetap milik portalTrigger) + worldYaw baru (Task 20).
describe('nearestPortal', () => {
  const active = [{ def: { id: 'unri-lembaga', placement: LEMBAGA_PLACEMENT }, region: { portals: PORTAL_DOORS } }];
  const door = PORTAL_DOORS[0];
  const wx = LEMBAGA_PLACEMENT.x + door.pos.lx;
  const wz = LEMBAGA_PLACEMENT.z + door.pos.lz;

  it('dalam radius → pintu, region, dan yaw dunia; di luar radius → null', () => {
    expect(nearestPortal(active, wx + 1.0, wz)).toMatchObject({ regionId: 'unri-lembaga', door, worldYaw: LEMBAGA_PLACEMENT.yaw + door.yaw });
    expect(nearestPortal(active, wx + 2.0, wz)).toBeNull();
  });

  it('region tanpa portals diabaikan', () => {
    expect(nearestPortal([{ def: { id: 'stadion', placement: { x: 0, z: 0, yaw: 0 } }, region: {} }], 0, 0)).toBeNull();
  });
});
