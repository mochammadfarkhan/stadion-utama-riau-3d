import { Minimap2D } from '../ui/Minimap2D.js';
import { STORY_NPCS } from '../story/chapters.js';
import { resolvePoint } from '../story/points.js';
import { pointToWorld } from './regionContext.js';

const PIN_VENDOR = '#ff9f1c';
const PIN_NPC = '#4cc9f0';

/** Minimap 2D (frame dunia): base layer per region dibake regionManager; marker region diubah ke dunia. */
export function setupMinimap(app, ents, story, frame, regions) {
  const minimap = new Minimap2D(document.body);
  const frameOf = (id) => regions.frameOf(id);
  const pins = () => [
    ...ents.vendors.vendors.map((v) => pointToWorld(frame, { x: v.position.x, z: v.position.z, color: PIN_VENDOR })),
    ...STORY_NPCS.flatMap((n) => {
      const w = resolvePoint(n, frameOf);
      return w ? [{ x: w.x, z: w.z, color: PIN_NPC }] : [];
    }),
  ];
  app.addSystem({
    id: 'minimap',
    phase: 'ui',
    update(dt, ctx) {
      minimap.setVisible(app.minimapVisible);
      const b = ents.bike.state;
      minimap.update(ctx.time, { focus: b, yaw: b.yaw, goal: story.goalPoint(), getPins: pins });
    },
  });
  return minimap;
}
