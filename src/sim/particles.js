/**
 * Kolam partikel semburan (MURNI, tanpa three): ring buffer typed array — partikel baru menimpa yang tertua bila penuh.
 * Sengaja MUTABLE (typed array diisi di tempat) karena dijalankan tiap frame untuk ratusan partikel; status hanya
 * dimiliki satu pemanggil (efek kebun) dan tidak dibagikan. Integrasi Euler semi-implisit: v += g·dt, v *= (1 − drag·dt),
 * p += v·dt; menyentuh tanah → 'stop' (diam di tanah sampai umur habis) atau 'kill' (hilang, mis. tetes air).
 */

/** @param {number} capacity jumlah maksimum partikel hidup */
export function createParticles(capacity) {
  const f = () => new Float32Array(capacity);
  return {
    capacity, next: 0,
    px: f(), py: f(), pz: f(), vx: f(), vy: f(), vz: f(), age: f(), life: f(), size: f(),
    alive: new Uint8Array(capacity), grounded: new Uint8Array(capacity),
  };
}

/** Pancarkan satu partikel; kembalikan indeksnya. life ≤ 0 diabaikan (−1). */
export function emitParticle(p, x, y, z, vx, vy, vz, life, size) {
  if (!(life > 0)) return -1;
  const i = p.next;
  p.next = (i + 1) % p.capacity;
  p.px[i] = x; p.py[i] = y; p.pz[i] = z;
  p.vx[i] = vx; p.vy[i] = vy; p.vz[i] = vz;
  p.age[i] = 0; p.life[i] = life; p.size[i] = size;
  p.alive[i] = 1; p.grounded[i] = 0;
  return i;
}

/**
 * Majukan semua partikel hidup `dt` detik. Kembalikan jumlah partikel yang masih hidup.
 * @param {{gravity?:number, drag?:number, groundAt?:((x:number, z:number) => number)|null, onGround?:'stop'|'kill'}} [opts]
 */
export function stepParticles(p, dt, { gravity = 9.8, drag = 0, groundAt = null, onGround = 'stop' } = {}) {
  if (!(dt > 0)) return countAlive(p);
  const damp = Math.max(0, 1 - drag * dt);
  let live = 0;
  for (let i = 0; i < p.capacity; i += 1) {
    if (!p.alive[i]) continue;
    p.age[i] += dt;
    if (p.age[i] >= p.life[i]) {
      p.alive[i] = 0;
      continue;
    }
    live += 1;
    if (p.grounded[i]) continue;
    p.vy[i] -= gravity * dt;
    p.vx[i] *= damp; p.vy[i] *= damp; p.vz[i] *= damp;
    p.px[i] += p.vx[i] * dt; p.py[i] += p.vy[i] * dt; p.pz[i] += p.vz[i] * dt;
    const g = groundAt ? groundAt(p.px[i], p.pz[i]) : -Infinity;
    if (p.py[i] > g) continue;
    if (onGround === 'kill') {
      p.alive[i] = 0;
      live -= 1;
    } else {
      p.py[i] = g;
      p.vx[i] = 0; p.vy[i] = 0; p.vz[i] = 0;
      p.grounded[i] = 1;
    }
  }
  return live;
}

export function countAlive(p) {
  let n = 0;
  for (let i = 0; i < p.capacity; i += 1) n += p.alive[i];
  return n;
}
