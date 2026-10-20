/**
 * NPC sekre (spec §8.2, katalog C01–C09): 6 mahasiswa dari data.js (almamater biru langit / kaus), 3–6 hadir
 * menurut activitySchedule pada jam game yang sama dengan eksterior. Tiap NPC = Humanoid → SkinnedMesh (1 draw
 * call); di dalam ruangan tanpa topi & tanpa sepatu (alas kaki ditinggal di rak depan, sebagian berkaus kaki),
 * rambut gelap; NPC berhijab memakai lengan panjang & bawahan panjang. Penugasan dihitung ulang hanya saat
 * periode jadwal berganti; pose + idle halus tiap frame (fase berbeda per NPC). Properti: gelas (drinkCup),
 * spidol (writeBoard), gitar (guitarStrum: dipindah dari dinding ke pangkuan).
 */
import * as THREE from 'three';
import { createHumanoid } from '../../entities/Humanoid.js';
import { applyPose } from '../../entities/Humanoid.poses.js';
import { bakeSkinnedHumanoid } from '../../entities/Humanoid.skinned.js';
import { randomAlmamaterOutfit, randomCasualOutfit } from '../../entities/Humanoid.outfits.js';
import { makeRng } from '../../entities/util.js';
import { periodAt, scheduleFor } from '../../sim/activitySchedule.js';
import { NPCS, SLOTS, TALK_SLOTS, SCHEDULE_SEED, NPC_PROFIL } from './data.js';

const HAIR_DARK = Object.freeze([0x1c1410, 0x2b1d14, 0x3b2a1e]);
const SOCKS = Object.freeze([null, 0x2b2b2b, 0xf2f2f2]);
const TALK = new Set(TALK_SLOTS);

/** Pakaian NPC (deterministik per seed data). */
export function npcOutfit(def) {
  const rng = makeRng(def.seed);
  const base = def.outfit === 'almamater' ? randomAlmamaterOutfit(rng) : randomCasualOutfit(rng);
  const sock = SOCKS[Math.floor(rng() * SOCKS.length)];
  const hairColor = HAIR_DARK[Math.floor(rng() * HAIR_DARK.length)];
  const berhijab = def.hijab != null;
  return {
    ...base,
    hat: null,
    vest: null,
    hijab: berhijab ? def.hijab : null,
    hair: berhijab ? null : (def.rambut ?? 'buzz'),
    hairColor,
    shoes: sock ?? base.skin,
    ...(berhijab ? { longSleeve: true, bottom: base.bottom === 'shorts' ? 'pants' : base.bottom } : {}),
  };
}

/**
 * @param {{props:{makeCup():THREE.Object3D, makeMarker():THREE.Object3D, holdGuitar(spine:THREE.Object3D):void, restGuitar():void},
 *   seed?:number, slots?:typeof SLOTS, roster?:typeof NPCS}} opts
 */
export function createSekreNpcs({ props, seed = SCHEDULE_SEED, slots = SLOTS, roster = NPCS, profiles = NPC_PROFIL }) {
  const group = new THREE.Group();
  group.name = 'npc-sekre';
  const slotById = new Map(slots.map((s) => [s.id, s]));
  const npcs = roster.map((def, i) => {
    const humanoid = createHumanoid(npcOutfit(def));
    const skin = bakeSkinnedHumanoid(humanoid);
    humanoid.group.name = def.id;
    humanoid.group.visible = false;
    const cup = props.makeCup();
    cup.position.set(0, -0.02, 0.05);
    cup.visible = false;
    const marker = props.makeMarker();
    marker.position.set(0, -0.02, 0.04);
    marker.visible = false;
    humanoid.parts.handR.add(cup, marker);
    group.add(humanoid.group);
    return { def, humanoid, skin, cup, marker, slot: null, phase: i * 1.37 };
  });
  let periodId = null;
  let t = 0;

  function assign(hour) {
    for (const n of npcs) {
      n.slot = null;
      n.humanoid.group.visible = false;
      n.cup.visible = false;
      n.marker.visible = false;
    }
    let guitarist = null;
    for (const a of scheduleFor(hour, seed, slots, npcs.map((n) => n.def.id), profiles)) {
      const n = npcs.find((m) => m.def.id === a.npcId);
      const slot = slotById.get(a.slotId);
      if (!n || !slot) continue;
      n.slot = { ...slot, poseId: a.poseId };
      n.humanoid.group.position.set(slot.x, 0, slot.z);
      n.humanoid.group.rotation.y = slot.yaw;
      n.humanoid.group.visible = true;
      n.cup.visible = a.poseId === 'drinkCup';
      n.marker.visible = a.poseId === 'writeBoard';
      if (a.poseId === 'guitarStrum') guitarist = n;
    }
    if (guitarist) props.holdGuitar(guitarist.humanoid.parts.spine);
    else props.restGuitar();
  }

  return {
    group,
    /** @param {number} dt @param {number} hour jam game */
    update(dt, hour) {
      t += Number.isFinite(dt) ? dt : 0;
      const id = periodAt(hour).id;
      if (id !== periodId) {
        periodId = id;
        assign(hour);
      }
      for (const n of npcs) {
        if (!n.slot) continue;
        applyPose(n.humanoid, n.slot.poseId, t + n.phase);
        n.skin.sync();
      }
    },
    /** Lingkaran penghalang pemain (collider ruang). */
    blockers() {
      return npcs.filter((n) => n.slot).map((n) => ({ x: n.slot.x, z: n.slot.z, r: n.slot.block }));
    },
    /** Jumlah NPC yang sedang rapat/ngobrol (volume gumaman). */
    get talkers() { return npcs.filter((n) => n.slot && TALK.has(n.slot.id)).length; },
    isActive(slotId) { return npcs.some((n) => n.slot?.id === slotId); },
    /** Ringkasan (dev/E2E): siapa di mana. */
    get active() {
      return npcs.filter((n) => n.slot).map((n) => ({ id: n.def.id, nama: n.def.nama, slotId: n.slot.id, poseId: n.slot.poseId }));
    },
    dispose() {
      props.restGuitar();
      for (const n of npcs) n.skin.dispose();
    },
  };
}
