/** Tur landmark pratinjau kota: rute tetangga-terdekat dari titik awal, lalu pewaktu murni (tanpa DOM/WebGL). */

export const TOUR = Object.freeze({ dwell: 5.5, maxStops: 9, zoom: 0.4, hoursPerSecond: 1.2 });

/** Urutan kunjungan: mulai dari `startId` (atau landmark pertama), lalu selalu yang terdekat belum dikunjungi. */
export function tourRoute(landmarks, startId = 'stadion', maxStops = TOUR.maxStops) {
  const pool = landmarks.filter((l) => Number.isFinite(l.x) && Number.isFinite(l.z));
  if (pool.length === 0) return [];
  const first = pool.find((l) => l.id === startId) ?? pool[0];
  const route = [first];
  const left = pool.filter((l) => l !== first);
  while (route.length < maxStops && left.length > 0) {
    const cur = route[route.length - 1];
    let best = 0;
    let bestD = Infinity;
    left.forEach((l, i) => {
      const d = Math.hypot(l.x - cur.x, l.z - cur.z);
      if (d < bestD) { bestD = d; best = i; }
    });
    route.push(left.splice(best, 1)[0]);
  }
  return route;
}

/** Pewaktu tur: `step(dt)` mengembalikan landmark yang harus dituju sekarang (sekali per pergantian), atau null. */
export function createTour(route, dwell = TOUR.dwell) {
  let index = -1;
  let clock = dwell; // langsung ke perhentian pertama
  return {
    get index() { return index; },
    step(dt) {
      if (route.length === 0) return null;
      clock += dt;
      if (clock < dwell) return null;
      clock = 0;
      index = (index + 1) % route.length;
      return route[index];
    },
  };
}

/** Jam melingkar 0..24 setelah `dt` detik time-lapse. */
export const advanceHour = (hour, dt, rate = TOUR.hoursPerSecond) => (((hour + dt * rate) % 24) + 24) % 24;
