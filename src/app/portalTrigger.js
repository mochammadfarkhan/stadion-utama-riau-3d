/**
 * Pemicu pintu-portal di eksterior. Sistem 'portal.trigger' (fase input, didaftarkan SEBELUM keymap agar E
 * dikonsumsi lebih dulu saat di depan pintu) mencari pintu terdekat dari field `portals` region aktif;
 * 'portal.prompt' (fase ui, didaftarkan SESUDAH hud) menampilkan "Tekan E — <prompt>" tanpa tertimpa.
 */
import { toLocal } from '../geo/regionTransform.js';

/**
 * Pintu terdekat dalam radiusnya. MURNI.
 * @param {Array<{def:{id:string, placement:object}, region:{portals?:Array<object>}}>} active
 * @returns {{door:object, regionId:string, distance:number}|null}
 */
export function nearestPortal(active, x, z) {
  let best = null;
  for (const { def, region } of active) {
    const doors = region?.portals ?? [];
    if (!doors.length) continue;
    const l = toLocal(def.placement, x, z);
    for (const door of doors) {
      const d = Math.hypot(l.x - door.pos.lx, l.z - door.pos.lz);
      if (d <= door.radius && (!best || d < best.distance)) best = { door, regionId: def.id, distance: d };
    }
  }
  return best;
}

/**
 * @param {{app:{addSystem:Function, removeSystem:Function}, portal:{state:string, enter(id:string):Promise<boolean>},
 *   input:{consumePress(code:string):boolean}, hud:{setPrompt(t:string|null):void}, getActive:() => Array<object>,
 *   getBike:() => {x:number, z:number}, isBlocked?:() => boolean, logger?:{error:Function}}} opts
 */
export function createPortalTrigger({ app, portal, input, hud, getActive, getBike, isBlocked = () => false, logger = console }) {
  let near = null;
  app.addSystem({
    id: 'portal.trigger',
    phase: 'input',
    update: () => {
      near = null;
      if (portal.state !== 'outside' || isBlocked()) return;
      const b = getBike();
      near = nearestPortal(getActive(), b.x, b.z);
      if (near && input.consumePress('KeyE')) portal.enter(near.door.interiorId).catch((err) => logger.error('Portal gagal dibuka:', err));
    },
  });
  return {
    /** Panggil SETELAH sistem 'hud' terdaftar. */
    installPrompt() {
      app.addSystem({ id: 'portal.prompt', phase: 'ui', update: () => { if (near && portal.state === 'outside') hud.setPrompt(`Tekan E — ${near.door.prompt}`); } });
    },
    dispose() {
      app.removeSystem('portal.trigger');
      app.removeSystem('portal.prompt');
    },
  };
}
