import { h, isTypingTarget, callHook, safeStorageGet, safeStorageSet } from './dom.js';
import { icon } from './icons.js';
import { Tab } from './Container.js';

export const TAB_STORAGE_KEY = 'sur3d.ui.tab';
const TOAST_MS = 2200;
const REFRESH_MS = 250;
const NAV_KEYS = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', ' ', 'Enter',
]);
const ISOLATED_EVENTS = Object.freeze([
  'pointerdown', 'pointerup', 'pointermove', 'mousedown', 'mouseup', 'click', 'dblclick',
  'wheel', 'contextmenu', 'touchstart', 'touchend',
]);
export const DEFAULT_HELP_ITEMS = Object.freeze([
  { group: 'Panel' },
  { keys: ['H'], text: 'Buka / tutup panel pengaturan' },
  { keys: ['F1'], text: 'Tampilkan bantuan ini' },
  { keys: ['P'], text: 'Mode foto (sembunyikan antarmuka)' },
  { keys: ['Esc'], text: 'Tutup bantuan / mode foto / panel' },
]);

/**
 * Panel pengaturan gaya Tidewater: aside kaca di kanan, tab ikon, rail saat tertutup,
 * overlay bantuan, toast, hotkey (H, F1, P, Esc), dan isolasi input dari scene.
 * hooks: { onPanelToggle(open), onPhotoMode(on), onScreenshot(), onHelp(open) }
 */
export class SettingsPanel {
  constructor({
    store, parent = document.body, hooks = {}, helpItems = DEFAULT_HELP_ITEMS,
    storage = globalThis.localStorage ?? null, refreshInterval = REFRESH_MS, title = 'Pengaturan',
  } = {}) {
    if (!store) throw new Error('SettingsPanel: `store` wajib diberikan');
    this.store = store;
    this.hooks = hooks;
    this.helpItems = helpItems;
    this.storage = storage;
    this.tabs = new Map();
    this.activeId = null;
    this._scroll = new Map();
    this._ac = new AbortController();
    this._open = false;
    this._photo = false;
    this._helpOpen = false;
    this._over = false;
    this._toastTimer = null;
    this.root = h('div', 'ui-root');
    this._buildPanel(title);
    this._buildRail();
    this._buildToast();
    this._buildHelp();
    parent.append(this.root);
    this._applyOpen(false);
    this._bindIsolation();
    this._bindHotkeys();
    this._timer = refreshInterval > 0 ? setInterval(() => this.refresh(), refreshInterval) : null;
  }

  // ---------- Pembangunan DOM ----------

  _iconBtn(name, label, onClick, extraCls = '') {
    const btn = h('button', `ui-iconbtn ui-interactive ${extraCls}`.trim(), {
      type: 'button', 'aria-label': label, 'data-tip': label, html: icon(name),
    });
    btn.addEventListener('click', onClick, { signal: this._ac.signal });
    return btn;
  }

  _buildPanel(title) {
    this.panel = h('aside', 'ui-panel ui-glass', { 'aria-label': title });
    this.titleEl = h('h2', 'ui-panel__title', { text: title });
    const actions = h('div', 'ui-panel__actions', {
      children: [
        this._iconBtn('viewfinder', 'Mode foto (P)', () => this.setPhotoMode(true), 'tip-below'),
        this._iconBtn('camera', 'Simpan screenshot', () => callHook(this.hooks.onScreenshot, this), 'tip-below'),
        this._iconBtn('help', 'Bantuan (F1)', () => this.toggleHelp(), 'tip-below'),
        this._iconBtn('chevrons-right', 'Tutup panel (H)', () => this.togglePanel(false), 'tip-below'),
      ],
    });
    const head = h('header', 'ui-panel__head', { children: [this.titleEl, actions] });
    this.tablist = h('div', 'ui-tabs', { role: 'tablist', 'aria-label': 'Kategori pengaturan' });
    this.tablist.addEventListener('keydown', (e) => this._onTablistKey(e), { signal: this._ac.signal });
    this.pages = h('div', 'ui-pages');
    this.panel.append(head, this.tablist, this.pages, this._buildFoot());
    this.root.append(this.panel);
  }

  _buildFoot() {
    const hint = (key, text) => h('span', 'ui-panel__hint', { children: [h('kbd', '', { text: key }), h('span', '', { text })] });
    const hints = h('div', 'ui-panel__hints', { children: [hint('H', 'Panel'), hint('F1', 'Bantuan'), hint('P', 'Foto')] });
    const reset = h('button', 'ui-linkbtn ui-interactive', { type: 'button', title: 'Kembalikan semua ke default' });
    reset.append(h('span', '', { html: icon('reset') }), h('span', '', { text: 'Reset semua' }));
    reset.addEventListener('click', () => this.resetAll(), { signal: this._ac.signal });
    return h('footer', 'ui-panel__foot', { children: [hints, reset] });
  }

  _buildRail() {
    this.rail = h('div', 'ui-rail ui-glass', { role: 'toolbar', 'aria-label': 'Pengaturan cepat' });
    const open = h('button', 'ui-rail__btn ui-interactive', {
      type: 'button', 'aria-label': 'Buka pengaturan (H)', 'data-tip': 'Pengaturan (H)', html: icon('layers'),
    });
    open.addEventListener('click', () => this.togglePanel(true), { signal: this._ac.signal });
    this.railTabs = h('div', 'ui-rail__tabs');
    this.rail.append(open, h('div', 'ui-rail__sep'), this.railTabs);
    this.root.append(this.rail);
  }

  _buildToast() {
    this.toastEl = h('div', 'ui-toast ui-glass', { role: 'status', 'aria-live': 'polite' });
    this.root.append(this.toastEl);
  }

  _buildHelp() {
    this.help = h('div', 'ui-help', { inert: true });
    const card = h('div', 'ui-help__card ui-glass', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Bantuan' });
    this.helpClose = this._iconBtn('x', 'Tutup bantuan (Esc)', () => this.toggleHelp(false));
    const head = h('div', 'ui-help__head', {
      children: [h('span', '', { html: icon('help') }), h('h2', '', { text: 'Bantuan & kontrol' }), this.helpClose],
    });
    card.append(head, buildHelpList(this.helpItems));
    this.help.addEventListener('click', (e) => { if (e.target === this.help) this.toggleHelp(false); }, { signal: this._ac.signal });
    this.help.append(card);
    this.root.append(this.help);
  }

  // ---------- Isolasi input & hotkey ----------

  _bindIsolation() {
    const { signal } = this._ac;
    for (const el of [this.panel, this.rail, this.help]) {
      for (const type of ISOLATED_EVENTS) {
        el.addEventListener(type, (e) => {
          if (type === 'contextmenu' && isTypingTarget(e.target)) return;
          e.stopPropagation();
        }, { signal, passive: type === 'wheel' || type.startsWith('touch') });
      }
      el.addEventListener('keydown', (e) => { if (NAV_KEYS.has(e.key)) e.stopPropagation(); }, { signal });
      el.addEventListener('pointerenter', () => { this._over = true; }, { signal });
      el.addEventListener('pointerleave', () => { this._over = false; }, { signal });
    }
  }

  _bindHotkeys() {
    document.addEventListener('keydown', (e) => this._onHotkey(e), { signal: this._ac.signal });
  }

  _onHotkey(e) {
    if (e.defaultPrevented || e.repeat || isTypingTarget(e.target)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === 'f1') { e.preventDefault(); this.toggleHelp(); }
    else if (key === 'h') this.togglePanel();
    else if (key === 'p') this.setPhotoMode(!this._photo);
    else if (key === 'escape') this._onEscape();
  }

  _onEscape() {
    if (this._helpOpen) this.toggleHelp(false);
    else if (this._photo) this.setPhotoMode(false);
    else if (this._open) this.togglePanel(false);
  }

  /** Roving tabindex di tablist: panah/Home/End memindah tab aktif dan fokus. */
  _onTablistKey(e) {
    const ids = [...this.tabs.keys()];
    if (ids.length === 0) return;
    const cur = Math.max(0, ids.indexOf(this.activeId));
    let next;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (cur + 1) % ids.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (cur - 1 + ids.length) % ids.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = ids.length - 1;
    else return;
    e.preventDefault();
    this.selectTab(ids[next]);
    this.tabs.get(ids[next]).tabBtn.focus();
  }

  // ---------- Tab ----------

  addTab(id, label, iconName = 'layers') {
    if (this.tabs.has(id)) return this.tabs.get(id);
    const tab = new Tab(this, { id, label, icon: iconName });
    this.tabs.set(id, tab);
    this.tablist.append(tab.tabBtn);
    this.pages.append(tab.el);
    this.railTabs.append(tab.railBtn);
    const { signal } = this._ac;
    tab.tabBtn.addEventListener('click', () => this.selectTab(id), { signal });
    tab.railBtn.addEventListener('click', () => { this.selectTab(id); this.togglePanel(true); }, { signal });
    const saved = safeStorageGet(this.storage, TAB_STORAGE_KEY);
    if (!this.activeId || saved === id) this.selectTab(id, false);
    return tab;
  }

  selectTab(id, persist = true) {
    const next = this.tabs.get(id);
    if (!next) return false;
    const prev = this.tabs.get(this.activeId);
    if (prev && prev !== next) {
      this._scroll.set(prev.id, prev.el.scrollTop);
      prev.setActive(false);
    }
    this.activeId = id;
    next.setActive(true);
    next.el.scrollTop = this._scroll.get(id) ?? 0;
    if (persist) safeStorageSet(this.storage, TAB_STORAGE_KEY, id);
    return true;
  }

  get activeTab() { return this.tabs.get(this.activeId) ?? null; }

  // ---------- Status panel ----------

  get isOpen() { return this._open; }
  get isPhotoMode() { return this._photo; }
  get isHelpOpen() { return this._helpOpen; }
  get isPointerOverUI() { return this._over; }

  _applyOpen(open) {
    this._open = open;
    this.root.classList.toggle('is-open', open);
    if (open) this.panel.removeAttribute('inert');
    else this.panel.setAttribute('inert', '');
    if (open) this.rail.setAttribute('inert', '');
    else this.rail.removeAttribute('inert');
    if (!open) this._over = false;
  }

  togglePanel(open = !this._open) {
    if (open === this._open) return this._open;
    this._applyOpen(open);
    if (open) {
      document.exitPointerLock?.();
      this.activeTab?.refresh();
    }
    callHook(this.hooks.onPanelToggle, open, this);
    return open;
  }

  setPhotoMode(on) {
    const next = Boolean(on);
    if (next === this._photo) return;
    this._photo = next;
    document.body.classList.toggle('is-photo', next);
    if (next) this.toast('Mode foto — tekan P atau Esc untuk keluar', 'warm');
    callHook(this.hooks.onPhotoMode, next, this);
  }

  toggleHelp(open = !this._helpOpen) {
    if (open === this._helpOpen) return;
    this._helpOpen = open;
    this.help.classList.toggle('is-open', open);
    if (open) this.help.removeAttribute('inert');
    else this.help.setAttribute('inert', '');
    if (open) this.helpClose.focus({ preventScroll: true });
    else this._over = false;
    callHook(this.hooks.onHelp, open, this);
  }

  /** Tampilkan toast singkat; kind: 'info' | 'ok' | 'err' | 'warm'. */
  toast(text, kind = 'info') {
    clearTimeout(this._toastTimer);
    this.toastEl.textContent = String(text);
    this.toastEl.className = `ui-toast ui-glass is-show is-${kind}`;
    this._toastTimer = setTimeout(() => this.toastEl.classList.remove('is-show'), TOAST_MS);
  }

  /** Perbarui kontrol pada tab aktif (dipanggil tiap 250 ms saat panel terbuka). */
  refresh() {
    if (!this._open) return;
    this.activeTab?.refresh();
  }

  resetAll() {
    this.store.reset();
    for (const tab of this.tabs.values()) for (const c of tab.allControls()) c.update();
    for (const c of this.activeTab?.allControls() ?? []) c.flash();
    this.toast('Semua pengaturan dikembalikan ke default', 'ok');
  }

  dispose() {
    this._ac.abort();
    clearInterval(this._timer);
    clearTimeout(this._toastTimer);
    for (const tab of this.tabs.values()) tab.dispose();
    this.tabs.clear();
    document.body.classList.remove('is-photo');
    this.root.remove();
  }
}

/** Bangun daftar bantuan dari array {group} | {keys:[], text} tanpa innerHTML. */
function buildHelpList(items) {
  const list = h('div', 'ui-help__list');
  for (const item of items ?? []) {
    if (item.group) {
      list.append(h('div', 'ui-help__group', { text: item.group }));
      continue;
    }
    const keys = h('div', 'ui-help__keys', { children: (item.keys ?? []).map((k) => h('kbd', '', { text: k })) });
    list.append(keys, h('div', 'ui-help__desc', { text: item.text ?? '' }));
  }
  return list;
}
