import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createDisposerStack } from '../src/app/lifecycle.js';
import { Input } from '../src/core/Input.js';
import { createWeather } from '../src/world/Weather.js';
import { createTimeOfDay } from '../src/world/TimeOfDay.js';
import { stadionRegion } from '../src/regions/stadion/index.js';
import { createResourceScope } from '../src/engine/ResourceScope.js';

/** EventTarget palsu yang menghormati opsi { signal } (AbortController). */
function abortableTarget() {
  const handlers = {};
  return {
    addEventListener(type, fn, opts) {
      (handlers[type] ??= []).push(fn);
      opts?.signal?.addEventListener('abort', () => { handlers[type] = handlers[type].filter((h) => h !== fn); });
    },
    fire: (type, ev = {}) => (handlers[type] ?? []).forEach((fn) => fn(ev)),
    count: (type) => (handlers[type] ?? []).length,
  };
}

class FakeAudioContext {
  static instances = [];
  constructor() {
    this.sampleRate = 100;
    this.state = 'running';
    this.destination = {};
    this.closed = false;
    FakeAudioContext.instances.push(this);
  }
  createBuffer(_ch, frames) { return { getChannelData: () => new Float32Array(frames) }; }
  createBufferSource() { return { connect: (n) => n, start() {}, stop() {} }; }
  createBiquadFilter() { return { type: '', frequency: { value: 0 }, connect: (n) => n }; }
  createGain() { return { gain: { value: 0 }, connect: (n) => n, disconnect() {} }; }
  resume() { return Promise.resolve(); }
  close() { this.closed = true; return Promise.resolve(); }
}

const fakeApp = () => ({ camera: new THREE.PerspectiveCamera(), renderer: {} });

describe('createDisposerStack', () => {
  it('LIFO, galat diisolasi, idempoten', () => {
    const calls = [];
    const logger = { error: (...a) => calls.push(['error', a[0]]) };
    const stack = createDisposerStack({ logger });
    stack.add(() => calls.push('a'));
    stack.add(() => { throw new Error('x'); });
    expect(stack.add(() => calls.push('c'))).toBeTypeOf('function');
    expect(stack.size).toBe(3);
    stack.disposeAll();
    stack.disposeAll();
    expect(calls).toEqual(['c', ['error', 'Pembongkaran gagal (dilanjutkan):'], 'a']);
    expect(stack.size).toBe(0);
    expect(() => stack.add(null)).toThrow(TypeError);
  });
});

describe('Input.dispose', () => {
  it('melepas listener keyboard/blur dan mengosongkan state', () => {
    const t = abortableTarget();
    const input = new Input(t);
    t.fire('keydown', { code: 'KeyW', target: { tagName: 'BODY' } });
    expect(input.isDown('KeyW')).toBe(true);
    input.dispose();
    expect(input.isDown('KeyW')).toBe(false);
    expect(t.count('keydown') + t.count('keyup') + t.count('blur')).toBe(0);
    t.fire('keydown', { code: 'KeyA', target: { tagName: 'BODY' } });
    expect(input.isDown('KeyA')).toBe(false);
  });
});

describe('Weather.dispose', () => {
  it('melepas listener gesture, menutup AudioContext milik sendiri, melepas grup', () => {
    const saved = globalThis.AudioContext;
    globalThis.AudioContext = FakeAudioContext;
    try {
      const t = abortableTarget();
      const scene = new THREE.Scene();
      const weather = createWeather(scene, fakeApp(), { userData: {} }, { eventTarget: t });
      scene.add(weather.group);
      expect(t.count('pointerdown')).toBe(1);
      t.fire('pointerdown');
      const ctx = FakeAudioContext.instances.at(-1);
      weather.dispose();
      expect(t.count('pointerdown') + t.count('keydown')).toBe(0);
      expect(ctx.closed).toBe(true);
      expect(weather.group.parent).toBeNull();
      expect(weather.group.children).toHaveLength(0);
    } finally {
      globalThis.AudioContext = saved;
    }
  });

  it('AudioContext dari audioBus tidak ditutup Weather', () => {
    const shared = new FakeAudioContext();
    const t = abortableTarget();
    const audioBus = { ensure: () => shared, channel: () => shared.destination };
    const weather = createWeather(new THREE.Scene(), fakeApp(), { userData: {} }, { audioBus, eventTarget: t });
    t.fire('keydown');
    weather.dispose();
    expect(shared.closed).toBe(false);
  });
});

describe('TimeOfDay.dispose', () => {
  it('melepas grup dan registrasi emissive', () => {
    const scene = new THREE.Scene();
    const lighting = { userData: { defaults: { cloudCoverage: 0.3 } } };
    const time = createTimeOfDay(lighting, scene, {}, fakeApp());
    scene.add(time.group);
    const mat = new THREE.MeshStandardMaterial({ emissive: 0xffffff, emissiveIntensity: 0.4 });
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.BoxGeometry(), mat));
    time.registerEmissive(root);
    time.dispose();
    expect(time.group.parent).toBeNull();
    expect(time.group.children).toHaveLength(0);
    expect(mat.emissiveIntensity).toBe(0.4);
  });
});

describe('region stadion: siklus build → dispose 3×', () => {
  it('tiap siklus: grup tanpa anak, scope kosong, semua geometri & material di grup dilepas', async () => {
    for (let i = 0; i < 3; i += 1) {
      const scope = createResourceScope(`uji-${i}`);
      const built = await stadionRegion.build({ scope });
      const resources = new Set();
      built.group.traverse((o) => {
        if (o.geometry) resources.add(o.geometry);
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m) resources.add(m);
      });
      const released = new Set();
      for (const r of resources) r.addEventListener('dispose', () => released.add(r));
      built.dispose();
      expect(built.group.children).toHaveLength(0);
      expect(scope.size).toBe(0);
      expect(released.size).toBe(resources.size);
    }
  }, 60000);
});
