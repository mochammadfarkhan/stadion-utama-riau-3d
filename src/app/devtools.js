/**
 * Alat debug mode dev: teleport, statistik renderer, store settings, pembongkaran aplikasi.
 */
import { createCollider } from '../core/Collider.js';

/**
 * Placement uji dari query string `?placement=x,z,yaw` (meter, meter, radian); null bila tidak ada
 * atau tidak valid. Hanya dipakai mode dev (uji placement non-identitas ujung-ke-ujung).
 */
export function parsePlacementParam(search) {
  const raw = new URLSearchParams(search ?? '').get('placement');
  if (!raw) return null;
  const parts = raw.split(',').map(Number);
  if (parts.length !== 3 || !parts.every(Number.isFinite)) return null;
  const [x, z, yaw] = parts;
  return { x, z, yaw };
}

export function exposeDevTools({ app, ents, rig, time, weather, store, audioBus, story, colliders, teardown }) {
  window.__sim = {
    app, ents, rig, time, weather, store, audioBus, story,
    teleport(x, z, yaw = 0) {
      ents.bike.state = { ...ents.bike.state, x, z, yaw, v: 0 };
      ents.bike.setCollider(createCollider({ x, z }, colliders.isWalkable, colliders.penetration));
    },
    stats: () => ({ ...app.renderer.info.render, fps: document.getElementById('hud-fps').textContent }),
    /** Bongkar seluruh aplikasi (uji siklus hidup); muat ulang halaman untuk memulai lagi. */
    teardown,
  };
}
