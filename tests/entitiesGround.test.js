// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { buildEntities } from '../src/entities/index.js';
import { stadionRegion } from '../src/regions/stadion/index.js';
import { createResourceScope } from '../src/engine/ResourceScope.js';
import { StoryNpcs } from '../src/entities/StoryNpcs.js';
import { createStoryMarkers } from '../src/world/StoryMarkers.js';
import { flatGround, groundOf } from '../src/entities/util.js';

describe('entitas region berdiri di atas ctx.heightAt (M1)', () => {
  it('groundOf: fungsi ctx atau datar', () => {
    const f = () => 1;
    expect(groundOf({ heightAt: f })).toBe(f);
    expect(groundOf({})).toBe(flatGround);
    expect(groundOf(undefined)(5, 5)).toBe(0);
  });

  it('pelari, pemain bola, pedagang: y = heightAt; tanpa heightAt tetap 0 (paritas)', { timeout: 60000 }, async () => {
    const region = await stadionRegion.build({ scope: createResourceScope('uji-tanah'), loadModels: false });
    const ents = buildEntities({ start: { x: 0, z: -300, yaw: 0 }, world: region, wallet: undefined });
    const ys = (ctx) => {
      for (const e of ents.updatables) if (e !== ents.bike) e.update(1 / 60, ctx);
      const out = [];
      ents.regionGroup.traverse((o) => {
        if (/^(runner|vendor|player)-/.test(o.name ?? '')) out.push(o.position.y);
      });
      return out;
    };
    const flat = ys({ time: 1, bikePos: { x: 0, y: 0, z: 0 } });
    expect(flat.length).toBeGreaterThan(5);
    expect(flat.every((y) => y === 0)).toBe(true);
    const raised = ys({ time: 2, heightAt: () => 2, bikePos: { x: 0, y: 2, z: 0 } });
    expect(raised.every((y) => y === 2)).toBe(true);
    ents.bike.dispose();
    region.dispose();
  });

  it('NPC cerita & penanda misi mengikuti tanah', () => {
    const npcs = new StoryNpcs();
    npcs.placeOnGround(() => 3);
    expect(npcs.group.children.every((c) => c.position.y === 3)).toBe(true);
    const markers = createStoryMarkers({ ground: (x, z) => x + z });
    markers.setTarget({ x: 1, z: 2 });
    expect(markers.group.position.y).toBe(3);
    markers.update(0);
    expect(markers.group.position.y).toBe(3);
    markers.setTarget(null);
    expect(markers.group.visible).toBe(false);
  });
});
