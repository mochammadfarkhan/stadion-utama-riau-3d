/**
 * NPC cerita (Pak Satpam, Coach Dedi): Humanoid statis dengan label nama CSS2D.
 * Posisi/nama dari story/chapters.js; berdiri menghadap yaw yang ditentukan.
 */
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { createHumanoid } from './Humanoid.js';
import { randomCasualOutfit, randomStudentOutfit } from './Humanoid.outfits.js';
import { makeRng } from './util.js';
import { STORY_NPCS } from '../story/chapters.js';

const OUTFIT_SEED = 77;
export const NPC_LABEL_DISTANCE = 45; // sama dengan label pedagang

/** Label NPC tampil hanya bila label diaktifkan (settings performance.labels) dan NPC dekat; label CSS2D tembus dinding. */
export function npcLabelVisible(distance, enabled) {
  return Boolean(enabled) && Number.isFinite(distance) && distance <= NPC_LABEL_DISTANCE;
}

function addLabel(group, name) {
  if (typeof document === 'undefined') return null;
  const el = document.createElement('div');
  el.className = 'vendor-label';
  el.textContent = name;
  const label = new CSS2DObject(el);
  label.position.set(0, 2.3, 0);
  group.add(label);
  return label;
}

/** NPC kampus berjas almamater (look 'almamater'); NPC lain berpakaian kasual. */
const outfitFor = (npc, rng) => (npc.look === 'almamater'
  ? randomStudentOutfit(rng, { almamaterChance: 1, backpackChance: 0 })
  : randomCasualOutfit(rng));

export class StoryNpcs {
  group = new THREE.Group();
  #labels = []; // { npc, label } (label dibuat sinkron di browser)
  #bodies = []; // { npc, group }

  constructor() {
    this.group.name = 'storyNpcs';
    STORY_NPCS.forEach((npc, i) => {
      const h = createHumanoid(outfitFor(npc, makeRng(OUTFIT_SEED + i)));
      h.group.name = `npc-${npc.id}`;
      h.group.position.set(npc.x, 0, npc.z);
      h.group.rotation.y = npc.yaw;
      this.group.add(h.group);
      this.#bodies.push({ npc, group: h.group });
      const label = addLabel(h.group, npc.name);
      if (label) this.#labels.push({ npc, label });
    });
  }

  /** @param {{x:number,z:number}} focus titik pandang @param {boolean} labelsEnabled */
  refreshLabels(focus, labelsEnabled) {
    for (const { npc, label } of this.#labels) {
      const d = focus ? Math.hypot(npc.x - focus.x, npc.z - focus.z) : Number.NaN;
      label.visible = npcLabelVisible(d, labelsEnabled);
    }
  }

  /** Berdiri di atas tanah: ground(lx, lz) region-lokal (ctx.heightAt); dipanggil tiap frame (2 NPC, murah). */
  placeOnGround(ground) {
    if (typeof ground !== 'function') return;
    for (const { npc, group } of this.#bodies) group.position.y = ground(npc.x, npc.z);
  }

  update() {}
}
