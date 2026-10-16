/**
 * Alat debug mode dev: teleport, statistik renderer, store settings, pembongkaran aplikasi.
 */
import { createCollider } from '../core/Collider.js';

export function exposeDevTools({ app, ents, rig, time, weather, store, audioBus, story, colliders, teardown }) {
  window.__sim = {
    app, ents, rig, time, weather, store, audioBus, story,
    teleport(x, z, yaw = 0) {
      ents.bike.state = { ...ents.bike.state, x, z, yaw, v: 0 };
      ents.bike.setCollider(createCollider({ x, z }, colliders.isWalkable));
    },
    stats: () => ({ ...app.renderer.info.render, fps: document.getElementById('hud-fps').textContent }),
    /** Bongkar seluruh aplikasi (uji siklus hidup); muat ulang halaman untuk memulai lagi. */
    teardown,
  };
}
