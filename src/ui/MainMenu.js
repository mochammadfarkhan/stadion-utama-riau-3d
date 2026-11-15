/**
 * Menu utama: pengendali tipis atas markup #overlay di index.html (tombol Mulai/Lanjutkan,
 * Mulai dari awal, Pengaturan, petunjuk kontrol). Teks ditentukan menuModel (murni, dites).
 */
import { menuModel } from './menuModel.js';
import { CONTROL_HELP, CONTROL_HELP_EXTRA } from '../config/controlsHelp.js';

/** Batas waktu klik kedua "Mulai dari awal" (ms). */
export const CONFIRM_MS = 4000;

export class MainMenu {
  /** @param {Document} [doc] */
  constructor(doc = document) {
    this.overlay = doc.getElementById('overlay');
    this.startBtn = doc.getElementById('start');
    this.newBtn = doc.getElementById('menu-new');
    this.settingsBtn = doc.getElementById('menu-settings');
    this.hint = doc.getElementById('menu-hint');
    this.body = doc.body;
    this.body.classList.add('is-menu'); // HUD disembunyikan sampai hide() (bukan away())
    this.#fillControls(doc);
    this.handlers = { start: () => {}, newGame: () => {}, settings: () => {} };
    this.startBtn.addEventListener('click', () => this.handlers.start());
    this.newBtn.addEventListener('click', () => this.#confirmNew());
    this.settingsBtn.addEventListener('click', () => this.handlers.settings());
  }

  /** Dua klik dalam CONFIRM_MS: klik pertama hanya mengubah teks tombol (semua kemajuan akan dihapus). */
  #confirmNew() {
    if (!this.armed) {
      this.armed = true;
      this.newLabel = this.newBtn.textContent;
      this.newBtn.textContent = 'Yakin? Semua kemajuan dihapus';
      this.armTimer = setTimeout(() => this.#disarm(), CONFIRM_MS);
      return;
    }
    this.#disarm();
    this.handlers.newGame();
  }

  #disarm() {
    clearTimeout(this.armTimer);
    this.armed = false;
    this.newBtn.textContent = this.newLabel ?? this.newBtn.textContent;
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

  /** Ringkasan kontrol menu dibangun dari CONTROL_HELP (bukan ditulis tangan di index.html). */
  #fillControls(doc) {
    const list = doc.querySelector('#menu-controls ul');
    if (!list) return;
    list.replaceChildren();
    for (const item of CONTROL_HELP.filter((c) => c.menu)) {
      const li = doc.createElement('li');
      const b = doc.createElement('b');
      b.textContent = item.keys.join(' / ');
      li.append(b, ` ${item.text}`);
      list.append(li);
    }
    for (const text of CONTROL_HELP_EXTRA) {
      const li = doc.createElement('li');
      li.textContent = text;
      list.append(li);
    }
  }

  /** Sembunyikan menu sepenuhnya (game dimulai). */
  hide() {
    this.overlay.classList.add('hidden');
    this.body.classList.remove('is-menu');
  }

  /** Menu menyingkir sementara (mis. panel pengaturan terbuka) tanpa menutup overlay. */
  away(on) { this.overlay.classList.toggle('menu-away', Boolean(on)); }
}
