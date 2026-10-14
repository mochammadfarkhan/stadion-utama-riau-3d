/**
 * Pedagang keliling (minuman / buah): FSM WALK ↔ DWELL antar waypoint,
 * plus dompet & transaksi. Semua fungsi murni, tidak memutasi input.
 */
import { VENDOR } from '../config/constants.js';

export const VENDOR_CATALOG = Object.freeze({
  minuman: Object.freeze([
    Object.freeze({ id: 'es-teh', name: 'Es Teh', price: 5000 }),
    Object.freeze({ id: 'es-jeruk', name: 'Es Jeruk', price: 7000 }),
    Object.freeze({ id: 'air-mineral', name: 'Air Mineral', price: 4000 }),
    Object.freeze({ id: 'kopi', name: 'Kopi', price: 8000 }),
  ]),
  buah: Object.freeze([
    Object.freeze({ id: 'buah-potong', name: 'Buah Potong (pepaya/semangka/nanas/melon)', price: 10000 }),
    Object.freeze({ id: 'jeruk', name: 'Jeruk', price: 15000 }),
    Object.freeze({ id: 'rujak', name: 'Rujak', price: 12000 }),
  ]),
});

const num = (v, fallback = 0) => (Number.isFinite(v) ? v : fallback);
const copyPoint = (p) => ({ x: num(p && p.x), z: num(p && p.z) });

/** Pedagang baru di waypoint pertama; target = waypoint berikutnya. */
export function createVendor({ id, kind = 'minuman', waypoints = [], speed, dwell } = {}) {
  const wps = Array.isArray(waypoints) ? waypoints.map(copyPoint) : [];
  const hasRoute = wps.length > 1;
  const pos = wps.length ? copyPoint(wps[0]) : { x: 0, z: 0 };
  const targetIndex = hasRoute ? 1 : 0;
  return {
    id,
    kind,
    waypoints: wps,
    speed: num(speed, VENDOR.walkSpeed),
    dwell: num(dwell, VENDOR.dwellSeconds),
    pos,
    yaw: 0,
    targetIndex,
    target: wps.length ? copyPoint(wps[targetIndex]) : { ...pos },
    state: hasRoute ? 'WALK' : 'DWELL',
    timer: 0,
  };
}

/** Langkah WALK: maju ke target; bila sampai → DWELL. */
function walk(v, dt) {
  const dx = v.target.x - v.pos.x;
  const dz = v.target.z - v.pos.z;
  const dist = Math.hypot(dx, dz);
  const travel = v.speed * dt;
  const yaw = dist > 1e-9 ? Math.atan2(dx, dz) : v.yaw;
  if (dist <= travel + VENDOR.arriveEpsilon) {
    return { ...v, pos: copyPoint(v.target), yaw, state: 'DWELL', timer: v.dwell };
  }
  const k = travel / dist;
  return { ...v, pos: { x: v.pos.x + dx * k, z: v.pos.z + dz * k }, yaw };
}

/** Langkah DWELL: hitung mundur; selesai → WALK ke waypoint berikutnya. */
function dwell(v, dt) {
  const timer = v.timer - dt;
  if (timer > 0 || v.waypoints.length < 2) return { ...v, timer: Math.max(0, timer) };
  const targetIndex = (v.targetIndex + 1) % v.waypoints.length;
  return { ...v, timer: 0, targetIndex, target: copyPoint(v.waypoints[targetIndex]), state: 'WALK' };
}

/** Satu langkah simulasi pedagang. dt NaN/≤0 → salinan. */
export function stepVendor(vendor, dt) {
  const h = num(dt);
  if (h <= 0) return { ...vendor, pos: { ...vendor.pos } };
  return vendor.state === 'WALK' ? walk(vendor, h) : dwell(vendor, h);
}

/** Dompet pemain. */
export function createWallet(balance = VENDOR.startBalance) {
  return { balance: Math.max(0, num(balance)), items: [] };
}

function safeWallet(wallet) {
  const balance = wallet && Number.isFinite(wallet.balance) ? Math.max(0, wallet.balance) : 0;
  const items = wallet && Array.isArray(wallet.items) ? wallet.items : [];
  return { balance, items };
}

/**
 * Beli item dari katalog. Saldo tidak pernah negatif.
 * @returns {{ok:true,wallet,item}|{ok:false,wallet,error}}
 */
export function buy(wallet, kind, itemId) {
  const w = safeWallet(wallet);
  const list = VENDOR_CATALOG[kind];
  const entry = list ? list.find((i) => i.id === itemId) : undefined;
  if (!entry) return { ok: false, wallet: w, error: 'Item tidak ditemukan' };
  if (w.balance < entry.price) return { ok: false, wallet: w, error: 'Saldo tidak cukup' };
  const item = { ...entry, kind };
  return { ok: true, wallet: { balance: w.balance - entry.price, items: [...w.items, item] }, item };
}
