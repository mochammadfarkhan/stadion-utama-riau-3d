/**
 * Kontrak interior (spec §4.8): scene interior terpisah yang dimasuki lewat pintu-portal
 * (src/app/interiorPortal.js). Murni (tanpa three): validasi bentuk data + pemilih barang interaktif.
 * Koordinat interior = ruang-lokal (m): lantai y = 0, pusat ruang (0, 0). Sistem interior wajib ber-id
 * "interior.*" agar gerbang sistem App (portal) tetap menjalankannya saat eksterior dijeda.
 *
 * Kontrak build(ctx) → { scene, camera, colliders:{isWalkable(x,z), isCameraClear?(x,z)},
 *   interactables:[{id,label,pos:{x,y,z},radius,prompt,onInteract(ctx)→void|{title,text}}],
 *   photoPresets:[{id,label,pose:{position:[x,y,z],target:[x,y,z],fov?}}], systems:[...], dispose() }
 * dispose() interior HANYA melepas sumber daya di luar pohon scene (skeleton, env map, peta bayangan,
 * audio, timer); pohon scene dilepas portal (disposeTree + scope.dispose).
 */
const finite = Number.isFinite;
const PHASES = new Set(['input', 'sim', 'world', 'camera', 'ui']);
export const INTERIOR_SYSTEM_PREFIX = 'interior.';

const hasNumbers = (p, keys) => Boolean(p) && keys.every((k) => finite(p[k]));
const isTriple = (a) => Array.isArray(a) && a.length === 3 && a.every(finite);

/**
 * @param {{id:string, label:string, size:{w:number,d:number,h:number}, spawn:{x:number,z:number,yaw:number},
 *   exitTo:{region:string,x:number,z:number,yaw:number}, build:(ctx:object)=>Promise<object>}} spec
 */
export function defineInterior(spec) {
  if (!spec || typeof spec.id !== 'string' || spec.id === '') throw new TypeError('Interior: id wajib string');
  const fail = (msg) => { throw new TypeError(`Interior "${spec.id}": ${msg}`); };
  if (typeof spec.label !== 'string' || spec.label === '') fail('label wajib string');
  const s = spec.size;
  if (!s || ![s.w, s.d, s.h].every((v) => finite(v) && v > 0)) fail('size {w,d,h} harus angka positif');
  const sp = spec.spawn;
  if (!hasNumbers(sp, ['x', 'z', 'yaw'])) fail('spawn {x,z,yaw} harus angka hingga');
  if (Math.abs(sp.x) > s.w / 2 || Math.abs(sp.z) > s.d / 2) fail('spawn di luar ruang');
  const ex = spec.exitTo;
  if (!ex || typeof ex.region !== 'string' || ex.region === '' || !hasNumbers(ex, ['x', 'z', 'yaw'])) {
    fail('exitTo {region,x,z,yaw} wajib');
  }
  if (typeof spec.build !== 'function') fail('build(ctx) wajib');
  return Object.freeze({
    ...spec,
    size: Object.freeze({ w: s.w, d: s.d, h: s.h }),
    spawn: Object.freeze({ x: sp.x, z: sp.z, yaw: sp.yaw }),
    exitTo: Object.freeze({ region: ex.region, x: ex.x, z: ex.z, yaw: ex.yaw }),
  });
}

function checkInteractables(list, errors) {
  if (!Array.isArray(list)) { errors.push('interactables'); return; }
  const seen = new Set();
  list.forEach((it, i) => {
    const tag = `interactables[${i}]`;
    if (typeof it?.id !== 'string' || it.id === '' || seen.has(it.id)) errors.push(`${tag}.id`);
    else seen.add(it.id);
    if (typeof it?.label !== 'string' || it.label === '') errors.push(`${tag}.label`);
    if (!hasNumbers(it?.pos, ['x', 'y', 'z'])) errors.push(`${tag}.pos`);
    if (!(finite(it?.radius) && it.radius > 0)) errors.push(`${tag}.radius`);
    if (typeof it?.prompt !== 'string' || it.prompt === '') errors.push(`${tag}.prompt`);
    if (typeof it?.onInteract !== 'function') errors.push(`${tag}.onInteract`);
  });
}

function checkPresets(list, errors) {
  if (!Array.isArray(list)) { errors.push('photoPresets'); return; }
  list.forEach((p, i) => {
    const tag = `photoPresets[${i}]`;
    if (typeof p?.id !== 'string' || p.id === '' || typeof p?.label !== 'string') errors.push(`${tag}.id`);
    const pose = p?.pose;
    const fovOk = pose?.fov === undefined || (finite(pose.fov) && pose.fov > 1 && pose.fov < 170);
    if (!isTriple(pose?.position) || !isTriple(pose?.target) || !fovOk) errors.push(`${tag}.pose`);
  });
}

function checkSystems(list, errors) {
  if (!Array.isArray(list)) { errors.push('systems'); return; }
  list.forEach((s, i) => {
    const tag = `systems[${i}]`;
    if (typeof s?.id !== 'string' || !s.id.startsWith(INTERIOR_SYSTEM_PREFIX)) errors.push(`${tag}.id`);
    if (!PHASES.has(s?.phase)) errors.push(`${tag}.phase`);
    if (typeof s?.update !== 'function') errors.push(`${tag}.update`);
  });
}

/** Pastikan hasil build memenuhi kontrak; lempar TypeError berisi daftar galat. Mengembalikan hasil apa adanya. */
export function validateInteriorBuild(result, id) {
  const errors = [];
  if (!result?.scene?.isScene) errors.push('scene');
  if (!result?.camera?.isCamera) errors.push('camera');
  if (typeof result?.colliders?.isWalkable !== 'function') errors.push('colliders.isWalkable');
  checkInteractables(result?.interactables, errors);
  checkPresets(result?.photoPresets, errors);
  checkSystems(result?.systems, errors);
  if (typeof result?.dispose !== 'function') errors.push('dispose');
  if (errors.length) throw new TypeError(`Interior "${id}": hasil build tidak valid (${errors.join(', ')})`);
  return result;
}

/**
 * Barang yang sedang "dilihat": jarak mendatar ≤ radius barang, lalu sudut terkecil antara arah pandang dan
 * arah mata→barang (cos ≥ minDot). Barang sangat dekat (≤ closeRange m) cukup tidak berada di belakang.
 * @param {Array<{pos:{x:number,y:number,z:number}, radius:number}>} list
 * @param {{x:number,y:number,z:number}} eye
 * @param {{x:number,y:number,z:number}} dir arah pandang (tidak harus satuan)
 * @returns {object|null}
 */
export function nearestInteractable(list, eye, dir, { minDot = 0.55, closeRange = 0.6 } = {}) {
  if (!Array.isArray(list) || !hasNumbers(eye, ['x', 'y', 'z']) || !hasNumbers(dir, ['x', 'y', 'z'])) return null;
  const dl = Math.hypot(dir.x, dir.y, dir.z);
  if (!(dl > 0)) return null;
  let best = null;
  let bestScore = -Infinity;
  for (const it of list) {
    const p = it?.pos;
    if (!hasNumbers(p, ['x', 'y', 'z'])) continue;
    const dx = p.x - eye.x;
    const dy = p.y - eye.y;
    const dz = p.z - eye.z;
    const flat = Math.hypot(dx, dz);
    if (!(flat <= it.radius)) continue;
    const len = Math.hypot(dx, dy, dz) || 1e-6;
    const dot = (dx * dir.x + dy * dir.y + dz * dir.z) / (len * dl);
    if (dot < (flat <= closeRange ? 0 : minDot)) continue;
    const score = dot - flat * 0.05;
    if (score > bestScore) {
      bestScore = score;
      best = it;
    }
  }
  return best;
}
