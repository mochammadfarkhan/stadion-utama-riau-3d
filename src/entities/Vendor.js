/**
 * Pedagang keliling: Humanoid (celemek + topi/hijab) mendorong gerobak,
 * digerakkan sim/vendorSim (WALK/DWELL), label nama CSS2D, interaksi beli.
 *
 * Gerobak diambil dari world/props/Cart.js (agen lain) lewat dynamic import;
 * bila gagal (belum ada / Node), dipakai gerobak fallback lokal.
 */
import * as THREE from 'three';
import { VENDOR_CATALOG, createVendor, stepVendor, createWallet, buy, consumeItem, credit } from '../sim/vendorSim.js';
import { createHumanoid, animateWalk, animateSellIdle } from './Humanoid.js';
import { randomVendorOutfit } from './Humanoid.outfits.js';
import { createFallbackCart } from './Vendor.cart.js';
import { makeRng, isFiniteXZ, lerpAngle, clamp, HAS_DOM } from './util.js';

const LABEL_DISTANCE = 45;
export const PROMPT_DISTANCE = 3.5;   // meter; jarak munculnya prompt beli
const CART_OFFSET_Z = 1.35;           // gerobak fallback di depan pedagang
const REAL_CART_EXTRA_Z = 0.55;       // Cart.js lebih panjang (gagang 1 m): geser lagi ke depan
const LABEL_HEIGHT = 2.6;
const YAW_SMOOTH = 6;                 // 1/s
const MAX_DT = 0.05;

const DEFAULT_NAMES = Object.freeze({
  minuman: ['Es Teh Bang Udin', 'Es Jeruk Kak Ani', 'Air Mineral Pak Dedi', 'Kopi Keliling Bang Rudi'],
  buah: ['Buah Potong Kak Ros', 'Rujak Buah Mak Yati', 'Jeruk Segar Bang Jon'],
});

/** Label CSS2D; hanya dibuat bila DOM tersedia (dryrun Node melewati). */
async function createLabel(text) {
  if (!HAS_DOM) return null;
  const { CSS2DObject } = await import('three/addons/renderers/CSS2DRenderer.js');
  const el = document.createElement('div');
  el.className = 'vendor-label';
  el.textContent = text;
  const obj = new CSS2DObject(el);
  obj.position.y = LABEL_HEIGHT;
  return obj;
}

/**
 * Coba ambil gerobak dari world/props/Cart.js; fallback bila gagal.
 * Cart.js: gagang di sisi -X, roda di ±Z (didorong ke arah +X) → dibungkus
 * Group yang diputar -90° agar arah dorong menjadi +Z (searah pedagang),
 * dan digeser agar ujung gagang berada di tangan pedagang.
 */
async function loadCart(kind) {
  try {
    const mod = await import('../world/props/Cart.js');
    const cart = mod.createCart?.({ kind });
    if (cart?.isObject3D) {
      const wrap = new THREE.Group();
      wrap.rotation.y = -Math.PI / 2;
      wrap.position.z = REAL_CART_EXTRA_Z;
      wrap.add(cart);
      return wrap;
    }
  } catch {
    // modul belum tersedia (agen lain) atau gagal di-load → fallback
  }
  return createFallbackCart({ kind });
}

export class VendorGroup {
  /** @type {THREE.Group} */
  group = new THREE.Group();
  /** Pedagang terdekat dalam jarak prompt (null bila tidak ada). */
  promptVendor = null;
  #vendors = [];   // { sim, h, root, cartSlot, name, yaw }
  #labels = new Map(); // id → CSS2DObject
  #labelsEnabled = true;
  #wallet;

  /**
   * @param {{vendors:Array<{id:string, kind:'minuman'|'buah', waypoints:Array<{x:number,z:number}>,
   *   name?:string, speed?:number}>, wallet?:object, seed?:number}} opts
   */
  constructor(opts = {}) {
    const { vendors = [], wallet, seed = 31 } = opts;
    this.#wallet = wallet ?? createWallet();
    this.group.name = 'vendors';
    const rng = makeRng(seed);
    const counters = { minuman: 0, buah: 0 };
    vendors.forEach((v) => this.#spawn(v, rng, counters));
  }

  #spawn(spec, rng, counters) {
    const kind = spec.kind === 'buah' ? 'buah' : 'minuman';
    const names = DEFAULT_NAMES[kind];
    const name = spec.name ?? names[counters[kind]++ % names.length];
    const sim = createVendor({ id: spec.id, kind, waypoints: spec.waypoints, speed: spec.speed });
    const root = new THREE.Group();
    root.name = `vendor-${spec.id}`;
    const h = createHumanoid(randomVendorOutfit(rng, kind));
    const cartSlot = new THREE.Group();
    cartSlot.position.z = CART_OFFSET_Z;
    cartSlot.add(createFallbackCart({ kind }));
    root.add(h.group, cartSlot);
    this.group.add(root);
    const entry = { sim, h, root, cartSlot, name, kind, yaw: sim.yaw ?? 0 };
    this.#vendors.push(entry);
    this.#place(entry, 0);
    this.#attachAsync(entry, kind, name);
  }

  /** Tukar gerobak fallback dengan Cart.js & pasang label bila tersedia. */
  #attachAsync(entry, kind, name) {
    loadCart(kind).then((cart) => {
      entry.cartSlot.clear();
      entry.cartSlot.add(cart);
    }).catch(() => {});
    createLabel(name).then((label) => {
      if (!label) return;
      this.#labels.set(entry.sim.id, label); // entry dibuat ulang tiap frame, simpan di Map
      entry.root.add(label);
    }).catch(() => {});
  }

  /** Label hanya tampak bila sepeda cukup dekat (CSS2D tidak kena depth test). */
  #updateLabels(bikePos) {
    for (const e of this.#vendors) {
      const label = this.#labels.get(e.sim.id);
      if (!label) continue;
      const near = Boolean(bikePos) && Math.hypot(e.sim.pos.x - bikePos.x, e.sim.pos.z - bikePos.z) < LABEL_DISTANCE;
      const visible = this.#labelsEnabled && near;
      label.visible = visible;
      label.element.style.display = visible ? '' : 'none';
    }
  }

  #place(entry, time) {
    const { sim, h, root } = entry;
    if (!isFiniteXZ(sim.pos)) return;
    root.position.set(sim.pos.x, 0, sim.pos.z);
    root.rotation.y = entry.yaw;
    if (sim.state === 'WALK') animateWalk(h, time);
    else animateSellIdle(h, time + root.position.x);
  }

  /** @param {number} dt @param {{bikePos?:THREE.Vector3, time:number}} ctx */
  update(dt, ctx = {}) {
    const step = clamp(dt, 0, MAX_DT);
    const time = ctx.time ?? 0;
    const k = Math.min(1, YAW_SMOOTH * step);
    this.#vendors = this.#vendors.map((e) => {
      const sim = stepVendor(e.sim, step);
      const yaw = Number.isFinite(sim.yaw) ? lerpAngle(e.yaw, sim.yaw, k) : e.yaw;
      return { ...e, sim, yaw };
    });
    for (const e of this.#vendors) this.#place(e, time);
    this.#updatePrompt(ctx.bikePos);
    this.#updateLabels(ctx.focus ?? ctx.bikePos); // label mengikuti fokus tampilan (POV)
  }

  #updatePrompt(bikePos) {
    if (!bikePos) { this.promptVendor = null; return; }
    const near = this.nearest(bikePos);
    this.promptVendor = near && near.dist < PROMPT_DISTANCE ? near.vendor : null;
  }

  /** Info publik satu pedagang (tanpa objek THREE internal). */
  #info(e) {
    return {
      id: e.sim.id, kind: e.kind, name: e.name, state: e.sim.state,
      position: { x: e.sim.pos.x, z: e.sim.pos.z },
      yaw: Number.isFinite(e.yaw) ? e.yaw : (e.sim.yaw ?? 0),
      catalog: VENDOR_CATALOG[e.kind] ?? [],
    };
  }

  /**
   * Pedagang terdekat dari posisi (THREE.Vector3 atau {x,z}).
   * @returns {{vendor:object, dist:number}|null}
   */
  nearest(pos) {
    let best = null;
    for (const e of this.#vendors) {
      const d = Math.hypot(e.sim.pos.x - pos.x, e.sim.pos.z - pos.z);
      if (!best || d < best.dist) best = { vendor: this.#info(e), dist: d };
    }
    return best;
  }

  /**
   * Beli item dari pedagang yang sedang di-prompt (atau vendorId eksplisit).
   * @returns {{ok:boolean, wallet:object, item?:object, error?:string}}
   */
  tryBuy(itemId, vendorId) {
    const target = vendorId
      ? this.#vendors.find((e) => e.sim.id === vendorId)
      : this.#vendors.find((e) => e.sim.id === this.promptVendor?.id);
    if (!target) return { ok: false, wallet: this.#wallet, error: 'Tidak ada pedagang di dekat Anda' };
    const result = buy(this.#wallet, target.kind, itemId);
    if (result.ok) this.#wallet = result.wallet;
    return result;
  }

  /** Tampilkan/sembunyikan label nama pedagang (settings performance.labels). */
  setLabelsEnabled(enabled) { this.#labelsEnabled = Boolean(enabled); }

  get labelsEnabled() { return this.#labelsEnabled; }

  get wallet() { return this.#wallet; }

  /** Keluarkan satu item dari dompet (antar pesanan). @returns {boolean} */
  consume(itemId) {
    const r = consumeItem(this.#wallet, itemId);
    if (r.ok) this.#wallet = r.wallet;
    return r.ok;
  }

  /** Tambah saldo dompet (hadiah misi). */
  credit(amount) { this.#wallet = credit(this.#wallet, amount); }
  get vendors() { return this.#vendors.map((e) => this.#info(e)); }
}
