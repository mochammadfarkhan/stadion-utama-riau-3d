import { FastTravelMenu, createTravelScreen } from '../ui/FastTravelMenu.js';
import { travelDestinations, createFastTravel, waitForRegion } from './fastTravel.js';
import { HERO_REGIONS } from './heroRegions.js';

/**
 * Perjalanan cepat (G / tombol HUD): Stadion, Masjid Raya An-Nur, Kampus UNRI (Sekretariat Lembaga, Rektorat); teleport menunggu tile tujuan
 * dimuat streamer sebelum layar perjalanan ditutup. Tanpa kota: hanya Stadion.
 */
export function setupFastTravel({ app, lifecycle, hud, rig, ents, colliders, city, frame, spawn, touch, unri, regions }) {
  const screen = createTravelScreen(document.body);
  lifecycle.add(() => screen.dispose());
  const travel = createFastTravel({
    destinations: travelDestinations({ manifest: city?.manifest ?? null, frame, spawn, campus: Boolean(unri) }), bike: ents.bike, colliders, city, screen,
    settle: async (x, z) => { // distrik (terrain/ground/gedung) + region hero yang menaungi tujuan harus siap
      const [districtOk, regionOk] = await Promise.all([unri ? unri.whenSettled(x, z) : true, waitForRegion(regions, HERO_REGIONS, x, z)]);
      // Layar perjalanan masih menutupi: kompilasi shader semua konten yang baru dimuat (chunk distrik, tile, region)
      await app.precompile().catch((err) => console.error('Prekompilasi shader tujuan gagal:', err));
      return districtOk !== false && regionOk;
    },
    isCameraClear: colliders.isCameraClear, rig, // POV ditutup dulu (menu & devtools); muncul dengan ruang kamera
  });
  const menu = new FastTravelMenu(document.body, {
    destinations: travel.destinations,
    touch,
    onTravel: (id) => travel.go(id)
      .then((status) => { if (status === 'timeout') hud.toast('Sebagian peta tujuan belum termuat', false); })
      .catch((err) => console.error('Perjalanan cepat gagal:', err)),
  });
  lifecycle.add(() => menu.dispose());
  return {
    menu,
    get busy() { return travel.busy; },
    /** Selama perjalanan atau panel terbuka sepeda tidak dikayuh (pola toko): WASD memilih tujuan. */
    get blocksInput() { return travel.busy || menu.open; },
    go: (id) => travel.go(id),
    goTo: (p) => travel.goTo(p),
    destinations: travel.destinations,
  };
}
