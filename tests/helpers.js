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
