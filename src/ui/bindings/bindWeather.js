/**
 * Binding grup "weather" (store -> Weather). weather.raining dua arah:
 * store -> weather.setRaining, dan sinkronisasi balik bila modul lain
 * memanggil weather.toggleRain() langsung (diperiksa tiap frame, tanpa alokasi).
 */

/**
 * @param {object} store
 * @param {{ weather: object, app?: object }} ctx
 * @returns {() => void} unsubscribe
 */
export function bindWeather(store, { weather, app = null }) {
  const unsubs = [];
  const on = (key, fn) => unsubs.push(store.bind(key, fn));

  on('weather.raining', (on_) => {
    if (weather.isRaining !== on_) weather.setRaining(on_);
  });
  on('weather.intensity', (v) => weather.setIntensity(v));
  on('weather.wetness', (v) => weather.setWetness(v));
  on('weather.wind', (v) => weather.setWind(v));
  on('weather.sound', (v) => weather.setSoundEnabled(v));

  // Tulis-balik: bila state hujan diubah di luar store (mis. toggleRain lama), samakan store.
  const sync = {
    update() {
      if (weather.isRaining !== store.get('weather.raining')) store.set('weather.raining', weather.isRaining);
    },
  };
  app?.addUpdatable?.(sync);

  return () => {
    for (const u of unsubs) u();
    app?.removeUpdatable?.(sync);
  };
}
