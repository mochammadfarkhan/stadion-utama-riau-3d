import { createCollider } from '../core/Collider.js';
import { createFadeOverlay } from '../ui/FadeOverlay.js';
import { createSekreInterior, SEKRE_ID } from '../interiors/sekre/index.js';
import { sekreExitTo } from '../regions/unri-lembaga/portalDoors.js';
import { SEKRE_PEMAIN } from '../regions/unri-lembaga/sekreUkm.data.js';
import { createInteriorPortal } from './interiorPortal.js';
import { createPortalTrigger } from './portalTrigger.js';

/**
 * Pintu-portal interior: pemicu pintu (portalTrigger M4) → interiorPortal M5 (gerbang sistem: jam/cuaca tetap jalan,
 * jalan kaki, interaksi, mode foto). Keluar: sepeda tetap di tempat (dipindah ke exitTo hanya bila > 30 m, mis. masuk
 * lewat dev/E2E). Router lihat, minimap, dan HUD mengikuti keadaan di dalam/luar.
 */
export function setupPortal({
  app, input, hud, rig, ents, regions, colliders, time, weather, store, audioBus, travel, story, minimap, look, panelRef, lifecycle, isInventoryOpen,
}) {
  const fader = createFadeOverlay(document.body);
  lifecycle.add(() => fader.dispose());
  const interiors = new Map([[SEKRE_ID, createSekreInterior({ exitTo: sekreExitTo() })]]);
  const teleport = (x, z, yaw) => {
    ents.bike.state = { ...ents.bike.state, x, z, yaw, v: 0 };
    ents.bike.setCollider(createCollider({ x, z }, colliders.isWalkable, colliders.penetration));
  };
  const portal = createInteriorPortal({
    app, input, hud, interiors, regionManager: regions, time, weather, store, audioBus, fader,
    ctx: { ormawa: SEKRE_PEMAIN }, // interiors tidak boleh mengimpor regions: data ormawa pemain (ERC) diteruskan lewat ctx build
    bike: { get state() { return ents.bike.state; }, teleport },
    onInteracted: (interiorId, itemId) => story.onInteract(`${interiorId}:${itemId}`), // M5 → objective interact (M7)
    isUiBlocking: () => Boolean(hud.shopOpen || isInventoryOpen() || story.journal.open || travel.menu.open
      || panelRef.current?.isOpen || panelRef.current?.isHelpOpen),
    beforeEnter: () => {
      rig.exitPov({ instant: true });
      ents.bike.state = { ...ents.bike.state, v: 0 }; // sepeda diam di depan pintu
    },
    onInsideChange: (inside) => {
      look.target = inside ? portal : rig;
      document.body.classList.toggle('is-interior', inside);
      minimap.setVisible(!inside && app.minimapVisible);
      if (!inside) rig.yawOffset = 0; // mouse selama di dalam ikut menggeser rig sepeda (listener-nya sendiri)
    },
  });
  lifecycle.add(() => portal.dispose());
  const trigger = createPortalTrigger({
    app, portal, input, hud,
    getActive: () => regions.active(),
    getBike: () => ents.bike.state,
    isBlocked: () => hud.shopOpen || rig.freezesBike,
  });
  lifecycle.add(() => trigger.dispose());
  return { portal, trigger };
}
