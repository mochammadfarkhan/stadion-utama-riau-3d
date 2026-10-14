/**
 * bindAll(store, ctx): pasang semua binding store -> scene; mengembalikan dispose().
 * Setiap binding opsional terhadap bagian ctx yang tidak ada (mis. tanpa audioBus),
 * sehingga dapat dipakai sebelum panel UI tersedia (store saja sudah cukup).
 */
import { bindSky } from './bindSky.js';
import { bindWeather } from './bindWeather.js';
import { bindGraphics } from './bindGraphics.js';
import { bindCamera } from './bindCamera.js';
import { bindAudio } from './bindAudio.js';
import { bindPerformance } from './bindPerformance.js';

export { bindSky, bindWeather, bindGraphics, bindCamera, bindAudio, bindPerformance };

/**
 * @param {object} store hasil createSettingsStore
 * @param {{ app: object, scene?: object, time?: object, lighting?: object, weather?: object,
 *   rig?: object, camera?: object, hud?: object, crowd?: object, vendors?: object, audioBus?: object }} ctx
 * @returns {() => void} dispose
 */
export function bindAll(store, ctx) {
  const { app, scene = app?.scene, camera = app?.camera } = ctx;
  const disposers = [];
  if (ctx.time) disposers.push(bindSky(store, { time: ctx.time, lighting: ctx.lighting, app, scene }));
  if (ctx.weather) disposers.push(bindWeather(store, { weather: ctx.weather, app }));
  if (app) disposers.push(bindGraphics(store, { app, lighting: ctx.lighting, crowd: ctx.crowd }));
  if (ctx.rig && camera) disposers.push(bindCamera(store, { rig: ctx.rig, camera, hud: ctx.hud, app }));
  disposers.push(bindAudio(store, { audioBus: ctx.audioBus }));
  if (app) disposers.push(bindPerformance(store, { app, hud: ctx.hud, vendors: ctx.vendors }));
  return () => { for (const d of disposers) d(); };
}
