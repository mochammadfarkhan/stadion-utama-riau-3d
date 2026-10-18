/**
 * Pintu-portal interior (spec §4.8) — STUB M4 dengan kontrak penuh; M5 mengganti interior stub dengan
 * src/interiors/sekre (defineInterior) tanpa mengubah mesin state ini.
 * enter(interiorId) / exit(); state outside → fadingIn → inside → fadingOut → outside.
 * Di dalam: runner sistem App ditukar dengan runner interior (sistem eksterior TIDAK di-update; objek &
 * scene eksterior tetap ada), port view (appView.js) menampilkan scene interior (scene eksterior tidak dirender).
 * Keluar: interior dilepas penuh (runner, build.dispose, scope), view & runner dipulihkan, onExited(exitTo).
 * Build interior melempar → fade dibatalkan, tetap di luar, toast "Pintu terkunci", scope dilepas (spec §10).
 * Port: view {setView}, stage {swap(runner) → restore}, fader {fade(0|1) → Promise}, input {consumePress, endFrame},
 * prompt(text|null).
 */
import * as THREE from 'three';
import { createResourceScope, withScope } from '../engine/ResourceScope.js';
import { createSystemRunner } from '../engine/SystemRunner.js';
import { disposeTree } from '../engine/disposeTree.js';
import { createTextTexture } from '../world/props/canvasText.js';

export const PORTAL_STATES = Object.freeze({ OUTSIDE: 'outside', FADING_IN: 'fadingIn', INSIDE: 'inside', FADING_OUT: 'fadingOut' });
export const EXIT_KEYS = Object.freeze(['KeyE', 'Escape']);
export const LOCKED_TOAST = 'Pintu terkunci';
export const EXIT_PROMPT = 'Tekan E — Keluar';

/**
 * @param {{interiors: Record<string, {id:string, exitTo:object, build(ctx:object): object|Promise<object>}>,
 *   view: {setView(v: {scene:object, camera:object}|null): void}, stage: {swap(runner:object): () => void},
 *   fader: {fade(to:number): Promise<void>}, input?: {consumePress(code:string): boolean, endFrame(): void}|null,
 *   prompt?: (text:string|null) => void, onToast?: (text:string, ok:boolean) => void, onEntered?: (def:object) => void,
 *   onExited?: (exitTo:object) => void, createScope?: (name:string) => object, createRunner?: (opts:object) => object,
 *   logger?: {error: Function, warn: Function}, ctx?: object}} opts
 */
export function createInteriorPortal({
  interiors, view, stage, fader, input = null, prompt = () => {}, onToast = () => {}, onEntered = () => {}, onExited = () => {},
  createScope = createResourceScope, createRunner = createSystemRunner, logger = console, ctx = {},
}) {
  let state = PORTAL_STATES.OUTSIDE;
  let active = null;
  let disposed = false;

  const attempt = (label, fn) => {
    try {
      fn();
    } catch (err) {
      logger.error(`Portal: ${label} gagal:`, err);
    }
  };

  const release = () => {
    if (!active) return;
    const a = active;
    active = null;
    attempt('pemulihan runner', () => a.restore());
    attempt('pemulihan view', () => view.setView(null));
    attempt('dispose runner interior', () => a.runner.dispose());
    attempt('dispose interior', () => a.build.dispose?.());
    a.scope.dispose();
    prompt(null);
  };

  async function exit() {
    if (state !== PORTAL_STATES.INSIDE || !active) return false;
    state = PORTAL_STATES.FADING_OUT;
    const { exitTo } = active.def;
    await fader.fade(1);
    release();
    onExited(exitTo);
    await fader.fade(0);
    state = PORTAL_STATES.OUTSIDE;
    return true;
  }

  const handleKeys = () => {
    if (state !== PORTAL_STATES.INSIDE || !input) return;
    if (EXIT_KEYS.some((code) => input.consumePress(code))) {
      exit().catch((err) => logger.error('Portal: keluar gagal:', err));
    }
  };

  async function enter(interiorId) {
    if (disposed || state !== PORTAL_STATES.OUTSIDE) return false;
    const def = interiors?.[interiorId];
    if (!def || typeof def.build !== 'function') {
      logger.warn(`Portal: interior "${interiorId}" tidak dikenal`);
      return false;
    }
    state = PORTAL_STATES.FADING_IN;
    await fader.fade(1);
    const scope = createScope(`interior:${interiorId}`);
    let build;
    try {
      build = await withScope(scope, () => def.build({ ...ctx, scope, exit }));
      if (!build?.scene || !build?.camera) throw new TypeError(`interior "${interiorId}": build tanpa scene/camera`);
    } catch (err) {
      logger.error(`Portal: interior "${interiorId}" gagal dibangun:`, err);
      scope.dispose();
      onToast(LOCKED_TOAST, false);
      await fader.fade(0);
      state = PORTAL_STATES.OUTSIDE;
      return false;
    }
    if (disposed) {
      attempt('dispose interior', () => build.dispose?.());
      scope.dispose();
      return false;
    }
    const runner = createRunner({ logger });
    for (const s of build.systems ?? []) runner.add(s);
    runner.add({ id: 'portal.keys', phase: 'input', update: handleKeys });
    runner.add({ id: 'portal.endFrame', phase: 'ui', update: () => input?.endFrame() });
    const restore = stage.swap(runner);
    view.setView({ scene: build.scene, camera: build.camera });
    active = { id: interiorId, def, build, scope, runner, restore };
    prompt(EXIT_PROMPT);
    onEntered(def);
    await fader.fade(0);
    if (active?.id === interiorId) state = PORTAL_STATES.INSIDE;
    return state === PORTAL_STATES.INSIDE;
  }

  return {
    get state() { return state; },
    get activeId() { return active?.id ?? null; },
    enter,
    exit,
    dispose() {
      if (disposed) return;
      disposed = true;
      release();
      state = PORTAL_STATES.OUTSIDE;
    },
  };
}

/**
 * Port `stage` untuk App: tukar `app.systems` dengan runner interior; selama di dalam addSystem/removeSystem
 * (mis. region dipasang/dilepas manager) tetap masuk ke runner eksterior. restore() memulihkan semuanya.
 */
export function appStage(app) {
  return {
    swap(runner) {
      const exterior = app.systems;
      app.systems = runner;
      app.addSystem = (s) => exterior.add(s);
      app.removeSystem = (id, opts) => exterior.remove(id, opts);
      return () => {
        app.systems = exterior;
        delete app.addSystem;
        delete app.removeSystem;
      };
    },
  };
}

/**
 * Interior STUB (M4): ruang 4,2 × 6 × 3,2 m abu-abu, pintu cokelat, papan teks "menyusul (M5)", lampu TL.
 * Bentuk = kontrak defineInterior spec §4.8 (id, label, size, spawn, exitTo, build → {scene, camera, colliders,
 * interactables, photoPresets, systems, dispose}).
 */
export function createStubInterior({ id, label, exitTo, size = { w: 4.2, d: 6, h: 3.2 } }) {
  return Object.freeze({
    id, label, exitTo, size: Object.freeze({ ...size }),
    spawn: Object.freeze({ x: 0, z: size.d / 2 - 0.8, yaw: Math.PI }),
    build() {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x202020);
      const room = new THREE.Mesh(
        new THREE.BoxGeometry(size.w, size.h, size.d).translate(0, size.h / 2, 0),
        new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.95, side: THREE.BackSide }),
      );
      const door = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2.1).translate(-1.2, 1.05, -size.d / 2 + 0.01), new THREE.MeshStandardMaterial({ color: 0x6b4a2f }));
      const tex = createTextTexture({ text: `${label}\nInterior menyusul (M5)\nTekan E untuk keluar`, width: 1024, height: 384, bg: 0xf1ede4, fg: 0x1b1b1b });
      const board = new THREE.Mesh(
        new THREE.PlaneGeometry(1.8, 0.68).translate(0.8, 1.6, -size.d / 2 + 0.02),
        new THREE.MeshStandardMaterial(tex ? { map: tex } : { color: 0xf1ede4 }),
      );
      const tl = new THREE.PointLight(0xfff1dc, 30, 12, 2);
      tl.position.set(0, size.h - 0.2, 0);
      scene.add(room, door, board, tl, new THREE.AmbientLight(0xffffff, 0.6));
      const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 50);
      camera.position.set(0, 1.55, size.d / 2 - 0.8);
      camera.lookAt(0, 1.5, -size.d / 2);
      return {
        scene,
        camera,
        colliders: { isWalkable: (x, z) => Math.abs(x) < size.w / 2 - 0.3 && Math.abs(z) < size.d / 2 - 0.3 },
        interactables: [{ id: 'pintu', label: 'Pintu', pos: { x: -1.2, y: 1.0, z: -size.d / 2 + 0.3 }, radius: 1.2, prompt: 'Keluar', onInteract: () => ({ text: 'Keluar' }) }],
        photoPresets: [],
        systems: [],
        dispose() {
          disposeTree(scene);
        },
      };
    },
  });
}
