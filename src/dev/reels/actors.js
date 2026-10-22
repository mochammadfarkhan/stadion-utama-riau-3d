/**
 * Aktor reels: Humanoid dari roster sekre + blocking (jalan/hadap/pose), gerak bicara otomatis saat dialognya tampil,
 * dan properti di tangan (uang, buku kas, HP) yang muncul sesuai jadwal `pegang`.
 * Aktor scene: {npc, slot?, di?:[x,z], hadap?, pose?, langkah?, pegang?:[{dari, sampai, benda, tangan:'R'|'L'}],
 *   warna?, gerak?(t, parts)}. Pose 'berdiri' = diam bernapas; saat berjalan animasi jalan menimpa pose.
 */
import * as THREE from 'three';
import { createHumanoid } from '../../entities/Humanoid.js';
import { applyPose, clearPose, POSES } from '../../entities/Humanoid.poses.js';
import { animateIdle, animateWalk } from '../../entities/Humanoid.anim.js';
import { npcOutfit } from '../../interiors/sekre/npcs.js';
import { NPCS, SLOTS } from '../../interiors/sekre/data.js';
import { compileBlocking } from './blocking.js';

const BERDIRI = 'berdiri';
/** Ukuran (m) & warna properti; uang mengikuti warna dominan pecahan rupiah. */
const BENDA = Object.freeze({
  uang10: { size: [0.14, 0.004, 0.066], color: 0x8e5aa8 },
  uang50: { size: [0.145, 0.004, 0.068], color: 0x2f6fd0 },
  uang100: { size: [0.15, 0.004, 0.07], color: 0xd64545 },
  buku: { size: [0.17, 0.03, 0.23], color: 0x2e7d32 },
  hp: { size: [0.075, 0.01, 0.155], color: 0x1d1d1f },
});
const WARNA_NAMA = Object.freeze(['#f2b705', '#4fc3f7', '#ff8a65', '#aed581', '#ce93d8', '#90a4ae']);

function makeProp(benda) {
  const spec = BENDA[benda];
  if (!spec) throw new Error(`Reels: benda "${benda}" tidak dikenal (${Object.keys(BENDA).join(', ')})`);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...spec.size), new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.7 }));
  mesh.position.set(0, -0.05, 0.04);
  mesh.castShadow = true;
  mesh.visible = false;
  return mesh;
}

function checkPoses(a, ids) {
  for (const id of ids) {
    if (id !== BERDIRI && !POSES[id]) throw new Error(`Reels: pose "${id}" (aktor ${a.npc}) tidak dikenal`);
  }
}

/**
 * @param {THREE.Group} group induk aktor
 * @param {object[]} aktor definisi aktor scene
 * @param {{holdGuitar(spine:THREE.Object3D):void}} props properti perabot sekre (gitar)
 */
export function createActors(group, aktor, props) {
  const slotById = new Map(SLOTS.map((s) => [s.id, s]));
  return aktor.map((a, i) => {
    const npc = NPCS.find((n) => n.id === a.npc);
    if (!npc) throw new Error(`Reels: npc "${a.npc}" tidak ada di data sekre`);
    const slot = a.slot ? slotById.get(a.slot) : null;
    if (a.slot && !slot) throw new Error(`Reels: slot "${a.slot}" tidak ada`);
    const pose = a.pose ?? slot?.poseId ?? BERDIRI;
    const langkah = a.langkah ?? [];
    checkPoses(a, [pose, ...langkah.filter((s) => s.pose).map((s) => s.pose)]);
    const blocking = compileBlocking({ di: a.di ?? [slot.x, slot.z], hadap: a.hadap ?? slot?.yaw ?? 0, pose, langkah });
    const h = createHumanoid(npcOutfit(npc));
    h.group.name = `aktor-${npc.nama}`;
    h.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    group.add(h.group);
    if (pose === 'guitarStrum') props.holdGuitar(h.parts.spine);
    const held = (a.pegang ?? []).map((p) => {
      const mesh = makeProp(p.benda);
      h.parts[p.tangan === 'L' ? 'handL' : 'handR'].add(mesh);
      return { mesh, dari: p.dari, sampai: p.sampai };
    });
    return { id: a.npc, nama: npc.nama, warna: a.warna ?? WARNA_NAMA[i % WARNA_NAMA.length], def: a, h, blocking, held, phase: i * 1.37 };
  });
}

/**
 * Posisikan & animasikan satu aktor pada waktu t.
 * @param {number} bicara 0..1 (alpha dialog aktor ini) — kepala mengangguk kecil saat bicara
 */
export function updateActor(actor, t, bicara = 0) {
  const { h, blocking } = actor;
  const [x, z] = blocking.pos(t);
  h.group.position.set(x, 0, z);
  h.group.rotation.y = blocking.yaw(t);
  const pose = blocking.pose(t);
  if (blocking.berjalan(t)) {
    clearPose(h);
    animateWalk(h, t);
  } else if (pose === BERDIRI) {
    clearPose(h);
    animateIdle(h, t + actor.phase);
  } else {
    applyPose(h, pose, t + actor.phase);
  }
  if (bicara > 0) {
    h.parts.headPivot.rotation.x += 0.05 * Math.sin(t * 9.7) * bicara;
    h.parts.headPivot.rotation.y += 0.06 * Math.sin(t * 2.3) * bicara;
  }
  actor.def.gerak?.(t, h.parts);
  for (const p of actor.held) p.mesh.visible = t >= p.dari && t < p.sampai;
}
