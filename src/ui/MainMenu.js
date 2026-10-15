/**
 * Menu utama: pengendali tipis atas markup #overlay di index.html (tombol Mulai/Lanjutkan,
 * Mulai dari awal, Pengaturan, petunjuk kontrol). Teks ditentukan menuModel (murni, dites).
 */
import { menuModel } from './menuModel.js';

export class MainMenu {
  /** @param {Document} [doc] */
  constructor(doc = document) {
    this.overlay = doc.getElementById('overlay');
    this.startBtn = doc.getElementById('start');
    this.newBtn = doc.getElementById('menu-new');
    this.settingsBtn = doc.getElementById('menu-settings');
    this.hint = doc.getElementById('menu-hint');
    this.handlers = { start: () => {}, newGame: () => {}, settings: () => {} };
    this.startBtn.addEventListener('click', () => this.handlers.start());
    this.newBtn.addEventListener('click', () => this.handlers.newGame());
    this.settingsBtn.addEventListener('click', () => this.handlers.settings());
  }

  /** @param {{start?:Function, newGame?:Function, settings?:Function}} handlers */
  on(handlers) { this.handlers = { ...this.handlers, ...handlers }; }

  /** Aset siap: aktifkan tombol dengan label sesuai simpanan. */
  ready({ hasProgress, touch }) {
    const m = menuModel({ hasProgress, touch });
    this.startBtn.textContent = m.startLabel;
    this.startBtn.disabled = false;
    this.settingsBtn.disabled = false;
    this.newBtn.disabled = false;
    this.newBtn.classList.toggle('hidden', !m.showNewGame);
    this.hint.textContent = m.hint;
  }

  /** Sembunyikan menu sepenuhnya (game dimulai). */
  hide() { this.overlay.classList.add('hidden'); }

  /** Menu menyingkir sementara (mis. panel pengaturan terbuka) tanpa menutup overlay. */
  away(on) { this.overlay.classList.toggle('menu-away', Boolean(on)); }
}
