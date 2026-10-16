/**
 * Sesi permainan & menu utama (dipindah dari main.js tanpa perubahan perilaku).
 */
import { requestLandscape } from '../ui/orientation.js';
import { mountSettingsPanel } from '../ui/mountSettingsPanel.js';

/** Sesi: false selama menu utama terbuka (kamera orbit latar, tombol game diabaikan). */
export const session = { started: false };

/** Menu utama: Mulai/Lanjutkan, Mulai dari awal, Pengaturan; klik kanvas mengunci pointer sesudah mulai. */
export function setupMenu({ app, rig, hud, store, touchUi, touch, menu, story }) {
  let panel = null;
  let started = false;
  const begin = () => {
    started = true;
    session.started = true;
    rig.exitPov(); // akhiri orbit latar menu
    menu.hide();
    if (touch) {
      touchUi.setVisible(true); // pointer lock tidak ada di ponsel; kontrol layar menggantikannya
      requestLandscape(); // layar penuh + kunci landscape (gestur pengguna = tombol Mulai)
    } else {
      rig.requestLock();
    }
  };
  menu.on({
    start: begin,
    newGame: () => { story.reset(); begin(); },
    settings: () => { menu.away(true); panel?.togglePanel?.(true); },
  });
  mountSettingsPanel({
    store, app, rig, hud,
    onPanelToggle: (open) => { if (!open && !started) menu.away(false); }, // panel ditutup sebelum mulai: menu muncul lagi
  }).then(({ panel: p }) => {
    panel = p;
    if (p) return; // panel memasang handler klik kanvas sendiri (cek isPointerOverUI)
    app.renderer.domElement.addEventListener('click', () => {
      if (started && !hud.shopOpen && !touch) rig.requestLock();
    });
  });
}
