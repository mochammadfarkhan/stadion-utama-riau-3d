/**
 * Tempat terakhir pemain (save v3 `place`): simpan berkala + saat tab ditutup, dan pulihkan saat Lanjutkan.
 * Tempat hanya disimpan sesudah sesi dimulai dan tidak selama perjalanan cepat (sepeda belum di tempat pemain).
 */
import { resolvePoint } from '../story/points.js';
import { session } from './session.js';

export const AUTOSAVE = Object.freeze({ everyS: 10, minMoveM: 5 });

/** Murni: simpan berkala bila sudah ≥ everyS sejak simpan terakhir dan berpindah > minMoveM (atau belum pernah). */
export function autosaveDue(elapsed, last, pos, cfg = AUTOSAVE) {
  if (elapsed < cfg.everyS) return false;
  return !last || Math.hypot(pos.x - last.x, pos.z - last.z) > cfg.minMoveM;
}

/** @param {{app: object, story: object, ents: object, travel: {busy: boolean}, signal: AbortSignal}} opts */
export function setupAutosave({ app, story, ents, travel, signal }) {
  let elapsed = 0;
  let last = null;
  const save = () => {
    if (!session.started || travel.busy) return;
    story.saveNow();
    const b = ents.bike.state;
    last = { x: b.x, z: b.z };
    elapsed = 0;
  };
  app.addSystem({
    id: 'autosave',
    phase: 'ui',
    update: (dt) => {
      if (!session.started || travel.busy) return;
      elapsed += dt;
      if (autosaveDue(elapsed, last, ents.bike.state)) save();
      else if (elapsed >= AUTOSAVE.everyS) elapsed = 0;
    },
  });
  window.addEventListener('pagehide', save, { signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); }, { signal });
}

/**
 * Pulihkan tempat + kendaraan tersimpan lewat perjalanan cepat (menunggu tile/region tujuan). Tanpa simpanan atau
 * region tak dikenal: tidak berbuat apa-apa (pemain tetap di titik awal).
 * @returns {Promise<boolean>} true bila dipindahkan
 */
export async function restorePlace({ story, regions, travel, ents }) {
  const p = story.savedPlace;
  if (!p) return false;
  const frame = regions.frameOf(p.region);
  const w = resolvePoint(p, (id) => regions.frameOf(id));
  if (!w) return false;
  const yaw = frame && !frame.identity && frame.yawToWorld ? frame.yawToWorld(p.yaw) : p.yaw;
  await travel.goTo({ x: w.x, z: w.z, yaw, label: 'tempat terakhir' });
  ents.bike.setMode(p.mode ?? 'sepeda'); // traktor yang modelnya belum termuat ditolak setMode: tetap sepeda
  return true;
}
