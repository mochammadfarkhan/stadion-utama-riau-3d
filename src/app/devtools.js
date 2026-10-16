/**
 * Alat debug mode dev (dipindah dari main.js tanpa perubahan perilaku).
 */
import { createCollider } from '../core/Collider.js';

/** Alat debug hanya di mode dev: teleport, statistik renderer, store settings. */
export function exposeDevTools({ app, ents, rig, time, weather, store, audioBus, story, colliders }) {
  window.__sim = {
    app, ents, rig, time, weather, store, audioBus, story,
    teleport(x, z, yaw = 0) {
      ents.bike.state = { ...ents.bike.state, x, z, yaw, v: 0 };
      ents.bike.setCollider(createCollider({ x, z }, colliders.isWalkable));
    },
    stats: () => ({ ...app.renderer.info.render, fps: document.getElementById('hud-fps').textContent }),
  };
}
