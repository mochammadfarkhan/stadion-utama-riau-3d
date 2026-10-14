/**
 * Binding grup "sky" (store -> TimeOfDay/App/scene) dan tulis-balik jam.
 * - sky.hour <-> time.setHour: dua arah. Saat sky.advanceTime aktif, tiap
 *   <= HOUR_WRITEBACK_S detik jam simulasi ditulis ke store; arah store -> time
 *   diabaikan bila |delta| < HOUR_EPSILON agar tidak terjadi loop.
 * - sky.advanceTime + sky.timeSpeed -> time.speed
 * - sky.azimuthOffset / cloudCover / haze / fogDistance -> override TimeOfDay
 *   (diterapkan setelah preset tiap frame; lihat TimeOfDay.js)
 * - sky.exposure -> app.setExposure (pengali terhadap exposure preset)
 */

const HOUR_WRITEBACK_S = 0.25;
const HOUR_EPSILON = 1 / 120;   // setengah menit
const HOURS = 24;

/** Selisih jam terpendek dengan wrap 24 (mis. 23.99 vs 0.01 -> 0.02). */
export function hourDelta(a, b) {
  const d = Math.abs(((a - b) % HOURS + HOURS) % HOURS);
  return Math.min(d, HOURS - d);
}

/**
 * @param {import('../../settings/store.js').createSettingsStore extends (...a:any)=>infer R ? R : never} store
 * @param {{ time: object, lighting?: object, app?: object, scene?: object }} ctx
 * @returns {() => void} unsubscribe
 */
export function bindSky(store, { time, app = null }) {
  const unsubs = [];
  const on = (key, fn) => unsubs.push(store.bind(key, fn));

  on('sky.hour', (h) => {
    if (hourDelta(h, time.hour) < HOUR_EPSILON) return; // nilai tulis-balik kita sendiri
    time.setHour(h);
  });

  const applySpeed = () => {
    const running = store.get('sky.advanceTime');
    time.setSpeed(running ? store.get('sky.timeSpeed') : 0);
  };
  on('sky.advanceTime', applySpeed);
  on('sky.timeSpeed', applySpeed);

  on('sky.azimuthOffset', (deg) => time.setAzimuthOffset(deg));
  on('sky.cloudCover', (v) => time.setCloudCover(v));
  on('sky.haze', (v) => time.setHaze(v));
  on('sky.fogDistance', (m) => time.setFogDistance(m));
  on('sky.exposure', (v) => app?.setExposure?.(v));

  const ticker = createWriteback(store, time);
  app?.addUpdatable?.(ticker);

  return () => {
    for (const u of unsubs) u();
    app?.removeUpdatable?.(ticker);
  };
}

/** Updatable kecil: tulis jam simulasi ke store secara berkala saat jam berjalan. */
function createWriteback(store, time) {
  let acc = 0;
  return {
    update(dt) {
      if (!store.get('sky.advanceTime')) { acc = 0; return; }
      acc += dt;
      if (acc < HOUR_WRITEBACK_S) return;
      acc = 0;
      store.set('sky.hour', time.hour);
    },
  };
}
