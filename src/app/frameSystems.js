import { formatHour } from '../sim/dayCycle.js';
import { pointInPolygon } from '../geo/polygon.js';
import { UNRI_BOUNDARY } from '../districts/unri/boundary.js';
import { session } from './session.js';
import { handleKeys } from './keymap.js';
import { updatePrompt } from './shop.js';

/**
 * Sistem per frame milik composition root (dulu satu updatable raksasa). Hotkey kini di fase input
 * (efeknya terlihat satu frame lebih awal; tidak ada perbedaan visual), cerita di sim, kamera di camera,
 * HUD dan input.endFrame di ui (endFrame terdaftar terakhir di antara konsumen tombol).
 */
export function addFrameSystems({ app, input, rig, hud, ents, shop, time, weather, store, story, travel, portal, isInventoryOpen }) {
  app.addSystem({
    id: 'keymap',
    phase: 'input',
    update: (dt) => { if (session.started && !isInventoryOpen()) handleKeys(input, { rig, hud, ents, shop, time, store, story, travelMenu: travel.menu, portal, dt }); }, // menu terbuka: tombol game diabaikan
  });
  app.addSystem({
    id: 'story',
    phase: 'sim',
    update: (dt, ctx) => story.update(dt, {
      time: ctx.time, bikePos: ents.bike.state, hour: time.hour, // cerita di koordinat dunia (titik ber-region di-resolve StoryDirector)
      inCampus: pointInPolygon(ents.bike.state.x, ents.bike.state.z, UNRI_BOUNDARY), // easter egg Kampus Biru Langit (M7)
      raining: Boolean(store.get('weather.raining')), paused: hud.shopOpen || rig.freezesBike || travel.busy, // timer misi beku selama perjalanan
    }),
  });
  app.addSystem({
    id: 'cameraRig',
    phase: 'camera',
    update: (dt, ctx) => {
      rig.distanceScale = ents.bike.mode === 'traktor' ? 1.4 : 1; // traktor lebih besar: kamera mundur
      rig.update(ents.bike.state, dt, ctx.time);
      ents.bike.setRiderVisible(!rig.firstPersonView);
      // POV beku: sepeda berhenti seketika (bukan meluncur karena momentum)
      if (rig.freezesBike && ents.bike.state.v !== 0) ents.bike.state = { ...ents.bike.state, v: 0 };
    },
  });
  app.addSystem({
    id: 'hud',
    phase: 'ui',
    update: (dt, ctx) => {
      hud.setCameraView(rig.mode, rig.povLabel, rig.freezesBike);
      hud.setSpeed(ents.bike.speedKmh);
      hud.setTime(formatHour(time.hour), time.presetName, weather.weatherName);
      hud.setScore(ents.match.score);
      hud.tickFps(ctx.rawDt ?? dt); // FPS jujur: delta mentah, bukan yang di-clamp
      updatePrompt(hud, ents, story, ents.bike.state); // prompt NPC cerita di koordinat dunia
    },
  });
  app.addSystem({ id: 'input.endFrame', phase: 'ui', update: () => input.endFrame() });
}
