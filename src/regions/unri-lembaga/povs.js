/**
 * POV milik region Lembaga (spec §4.3 `povs`): pose dunia {px,py,pz,tx,ty,tz,fov}. M0 memanggil pose(frame, ctx:{time,
 * bike}); y = tinggi di atas tanah 0 kecuali ctx.terrain diberikan (penyesuaian y ke tanah oleh PovDirector, M1).
 * `frame` = frame region (toWorld region-lokal → dunia).
 */
import { fromSekre, PITCH_FRAME, TRIBUN } from './placement.js';
import { SEKRE_DIM } from './layout.js';
import { toWorld } from '../../geo/regionTransform.js';

function pose(frame, ctx, eye, eyeH, target, targetH, fov) {
  const e = frame.toWorld(eye.x, eye.z);
  const t = frame.toWorld(target.x, target.z);
  const ground = (x, z) => (typeof ctx?.terrain?.heightAt === 'function' ? ctx.terrain.heightAt(x, z) : 0);
  return { px: e.x, py: ground(e.x, e.z) + eyeH, pz: e.z, tx: t.x, ty: ground(t.x, t.z) + targetH, tz: t.z, fov };
}

export const LEMBAGA_POVS = Object.freeze([
  Object.freeze({
    id: 'lembaga-selasar', label: 'Selasar Sekretariat',
    pose: (frame, ctx) => pose(frame, ctx, fromSekre(0.3, -(SEKRE_DIM.hz + 3.5)), 1.6, fromSekre(0, SEKRE_DIM.hz), 1.4, 62),
  }),
  Object.freeze({
    id: 'lembaga-udara', label: 'Udara Zona Lembaga',
    pose: (frame, ctx) => pose(frame, ctx, fromSekre(70, -40), 55, { x: -30, z: -90 }, 0, 50),
  }),
  Object.freeze({
    id: 'lembaga-tribun', label: 'Tribun Stadion Mini',
    pose: (frame, ctx) => pose(frame, ctx, toWorld(TRIBUN.frame, -2, 0), 8.7, { x: PITCH_FRAME.x, z: PITCH_FRAME.z }, 0.5, 60),
  }),
]);
