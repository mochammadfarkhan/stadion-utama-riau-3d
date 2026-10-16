import { createResourceScope, withScope } from '../src/engine/ResourceScope.js';

// Util test: freeze rekursif supaya mutasi input langsung melempar error (strict mode ESM).
export function deepFreeze(obj) {
  if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    Object.values(obj).forEach(deepFreeze);
  }
  return obj;
}

export function hasNaN(value) {
  if (typeof value === 'number') return Number.isNaN(value);
  if (value && typeof value === 'object') return Object.values(value).some(hasNaN);
  return false;
}

/** Panggil `make` dua kali di scope `a` dan sekali di scope `b` (scope baru). */
export function inTwoScopes(make) {
  const a = createResourceScope('a');
  const b = createResourceScope('b');
  return { a, b, first: withScope(a, make), again: withScope(a, make), other: withScope(b, make) };
}

/** Himpunan material (bukan array) dan geometri di bawah root. */
export function materialsOf(root) {
  const out = new Set();
  root.traverse((o) => { if (o.material && !Array.isArray(o.material)) out.add(o.material); });
  return out;
}

export function geometriesOf(root) {
  const out = new Set();
  root.traverse((o) => { if (o.geometry) out.add(o.geometry); });
  return out;
}
