/**
 * NPC cerita (Pak Satpam, Coach Dedi): Humanoid statis dengan label nama CSS2D.
 * Posisi/nama dari story/chapters.js; berdiri menghadap yaw yang ditentukan.
 */
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { createHumanoid } from './Humanoid.js';
import { randomCasualOutfit } from './Humanoid.outfits.js';
import { makeRng } from './util.js';
import { STORY_NPCS } from '../story/chapters.js';

const OUTFIT_SEED = 77;

async function addLabel(group, name) {
  if (typeof document === 'undefined') return;
  const el = document.createElement('div');
  el.className = 'vendor-label';
  el.textContent = name;
  const label = new CSS2DObject(el);
  label.position.set(0, 2.3, 0);
  group.add(label);
}

export class StoryNpcs {
  group = new THREE.Group();

  constructor() {
    this.group.name = 'storyNpcs';
    STORY_NPCS.forEach((npc, i) => {
      const h = createHumanoid(randomCasualOutfit(makeRng(OUTFIT_SEED + i)));
      h.group.name = `npc-${npc.id}`;
      h.group.position.set(npc.x, 0, npc.z);
      h.group.rotation.y = npc.yaw;
      this.group.add(h.group);
      addLabel(h.group, npc.name);
    });
  }

  update() {}
}
