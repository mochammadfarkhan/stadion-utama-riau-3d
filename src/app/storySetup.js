import { StoryDirector } from '../core/StoryDirector.js';
import { StoryNpcs } from '../entities/StoryNpcs.js';
import { createStoryMarkers } from '../world/StoryMarkers.js';
import { StoryHUD } from '../ui/StoryHUD.js';
import { StoryJournal } from '../ui/StoryJournal.js';
import { localizePoint } from '../story/points.js';
import { safeLocalStorage } from '../settings/safeStorage.js';
import { session } from './session.js';

/**
 * Cerita: NPC (region-lokal stadion, di bawah jangkar) dan penanda tujuan (DUNIA: tujuan bisa di region mana
 * pun), HUD, jurnal; progres dimuat dari localStorage (save v3 menyimpan tempat pemain sebagai titik ber-region).
 */
export function setupStory({ app, ents, hud, rig, anchor, toLocalCtx, regions, lifecycle, terrain, isTravelling = () => false }) {
  const root = document.getElementById('hud');
  const npcs = new StoryNpcs();
  const markers = createStoryMarkers({ ground: terrain.heightAt }); // penanda di koordinat dunia (M0), di atas tanah (M1)
  anchor.add(npcs.group);
  app.scene.add(markers.group); // goalPoint() StoryDirector kini titik dunia
  lifecycle.add(() => markers.group.removeFromParent());
  ents.lod.addFrom(npcs.group);
  app.addSystem({
    id: 'storyNpcLabels',
    phase: 'ui',
    update: (dt, ctx) => {
      const local = toLocalCtx(ctx);
      npcs.placeOnGround(local.heightAt); // NPC region-lokal stadion (heightAt lokal dari ctx frame)
      npcs.refreshLabels(local.focus ?? local.bikePos, ents.vendors.labelsEnabled);
    },
  });
  const frameOf = (id) => regions.frameOf(id);
  let story = null;
  const storyHud = new StoryHUD(root, { onAdvance: () => story.advanceDialog() });
  const journal = new StoryJournal(root, { onReset: () => story.reset(), onClose: () => story.toggleJournal() });
  const pointerLock = { release: () => document.exitPointerLock?.(), request: () => rig.requestLock() };
  story = new StoryDirector({
    storage: safeLocalStorage(), vendors: ents.vendors, storyHud, journal, markers, pointerLock,
    onToast: (text, ok) => hud.toast(text, ok),
    onWalletChange: (wallet) => hud.setWallet(wallet),
    frameOf,
    modeOf: () => ents.bike.mode,
    placeOf: () => {
      if (!session.started || isTravelling()) return null; // menu/perjalanan: sepeda belum di tempat pemain → pertahankan simpanan
      const b = ents.bike.state;
      return localizePoint(b, regions.regionAt(b.x, b.z), frameOf);
    },
  });
  ents.bike.onRing = () => story.onBell();
  story.start();
  return story;
}
