/** Matematika kontrol sentuh yang murni (tanpa DOM) agar mudah dites. */

const DEADZONE = 0.28;        // fraksi radius: di bawah ini joystick dianggap netral
const AXIS_ON = 0.38;         // sumbu menyalakan tombol di atas fraksi ini
const MINOR_AXIS_FACTOR = 0.35; // sumbu minor harus ≥ 35% sumbu dominan (hindari membelok saat lurus)

/** Jepit vektor (x, y) ke lingkaran radius r (posisi kenop joystick). */
export function clampToRadius(x, y, r) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { x: 0, y: 0 };
  const len = Math.hypot(x, y);
  if (len <= r || len === 0) return { x, y };
  return { x: (x / len) * r, y: (y / len) * r };
}

/**
 * Joystick virtual → tombol WASD. Layar y ke bawah: y negatif = maju.
 * @returns {{KeyW:boolean, KeyS:boolean, KeyA:boolean, KeyD:boolean}}
 */
export function joystickKeys(dx, dy, radius) {
  const off = { KeyW: false, KeyS: false, KeyA: false, KeyD: false };
  if (!(radius > 0) || !Number.isFinite(dx) || !Number.isFinite(dy)) return off;
  const nx = dx / radius;
  const ny = dy / radius;
  if (Math.hypot(nx, ny) < DEADZONE) return off;
  const ax = Math.abs(nx);
  const ay = Math.abs(ny);
  const major = Math.max(ax, ay);
  const on = (a) => a >= AXIS_ON && a >= major * MINOR_AXIS_FACTOR;
  return {
    KeyW: ny < 0 && on(ay),
    KeyS: ny > 0 && on(ay),
    KeyA: nx < 0 && on(ax),
    KeyD: nx > 0 && on(ax),
  };
}

/** Perangkat yang pointer utamanya jari (ponsel/tablet), bukan laptop layar sentuh dengan mouse. */
export function isTouchPrimary(env = browserEnv()) {
  if (!env) return false;
  return (env.maxTouchPoints ?? 0) > 0 && Boolean(env.matchMedia?.('(pointer: coarse)')?.matches);
}

/** Lingkungan browser untuk isTouchPrimary (properti Navigator ada di prototipe, jadi tidak bisa di-spread). */
function browserEnv() {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return null;
  return { maxTouchPoints: navigator.maxTouchPoints, matchMedia: (q) => window.matchMedia?.(q) };
}
