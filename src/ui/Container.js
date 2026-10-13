import { h, uid, safeStorageGet, safeStorageSet } from './dom.js';
import { icon } from './icons.js';
import { Slider } from './controls/Slider.js';
import { Toggle } from './controls/Toggle.js';
import { Select } from './controls/Select.js';
import { Button } from './controls/Button.js';
import { Info } from './controls/Info.js';
import { Presets } from './controls/Presets.js';

export const FOLDERS_STORAGE_KEY = 'sur3d.ui.folders';

/**
 * Wadah kontrol: menyimpan daftar kontrol & folder, menyediakan helper add*.
 * `slot` adalah elemen tempat kontrol ditempel (default = el).
 */
export class Container {
  constructor({ store, panel = null, el = null, slot = null } = {}) {
    this.store = store;
    this.panel = panel;
    this.el = el ?? h('div', 'ui-container');
    this.slot = slot ?? this.el;
    this.controls = [];
    this.folders = [];
  }

  /** Daftarkan kontrol yang sudah dibuat dan tempelkan ke slot. */
  add(ctrl) {
    this.controls = [...this.controls, ctrl];
    this.slot.append(ctrl.el);
    return ctrl;
  }

  addSlider(key, opts = {}) { return this.add(new Slider(this, { key, ...opts })); }
  addToggle(key, opts = {}) { return this.add(new Toggle(this, { key, ...opts })); }
  addSelect(key, opts = {}) { return this.add(new Select(this, { key, ...opts })); }
  addButton(opts = {}) { return this.add(new Button(this, opts)); }
  addInfo(opts = {}) { return this.add(new Info(this, opts)); }
  addPresets(opts = {}) { return this.add(new Presets(this, opts)); }
  addCustom(Ctor, opts = {}) { return this.add(new Ctor(this, opts)); }

  addFolder(title, opts = {}) {
    const folder = new Folder(this, { title, ...opts });
    this.folders = [...this.folders, folder];
    this.slot.append(folder.el);
    return folder;
  }

  /** Semua kontrol termasuk di dalam folder (rekursif). */
  allControls() {
    return [...this.controls, ...this.folders.flatMap((f) => f.allControls())];
  }

  /** Repaint kontrol yang terlihat; folder tertutup dilewati. */
  refresh() {
    for (const c of this.controls) if (c.isVisible) c.update();
    for (const f of this.folders) if (f.isOpen) f.refresh();
  }

  reset() {
    for (const c of this.controls) c.reset();
    for (const f of this.folders) f.reset();
  }

  dispose() {
    for (const c of this.controls) c.dispose();
    for (const f of this.folders) f.dispose();
    this.controls = [];
    this.folders = [];
    this.el.remove();
  }
}

/**
 * Section collapsible: head (ikon + judul + chevron) dan body beranimasi grid-template-rows.
 * Status buka/tutup di-persist ke storage key `sur3d.ui.folders` berdasarkan opts.id.
 */
export class Folder extends Container {
  constructor(parent, { title, icon: iconName = 'layers', id = null, open = true } = {}) {
    const inner = h('div', 'ui-folder__inner');
    super({ store: parent.store, panel: parent.panel, el: h('section', 'ui-folder'), slot: inner });
    this.parent = parent;
    this.title = title;
    this.storageId = id ?? uid('folder');
    this.storage = parent.panel?.storage ?? null;
    this.inner = inner;
    this._build(iconName);
    const saved = readFolderState(this.storage)[this.storageId];
    this.setOpen(typeof saved === 'boolean' ? saved : open, false);
  }

  _build(iconName) {
    const bodyId = uid('folder-body');
    this.head = h('button', 'ui-folder__head ui-interactive', {
      type: 'button', 'aria-controls': bodyId, 'aria-expanded': 'true',
    });
    this.head.append(
      h('span', 'ui-folder__ico', { html: icon(iconName) }),
      h('span', 'ui-folder__title', { text: this.title }),
      h('span', 'ui-folder__chev', { html: icon('chevron-down') }),
    );
    this.head.addEventListener('click', () => this.toggle());
    this.body = h('div', 'ui-folder__body', { id: bodyId });
    this.body.append(this.inner);
    this.el.append(this.head, this.body);
  }

  get isOpen() { return this.el.classList.contains('is-open'); }

  setOpen(open, persist = true) {
    this.el.classList.toggle('is-open', open);
    this.head.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) this.body.removeAttribute('inert');
    else this.body.setAttribute('inert', '');
    if (persist) {
      const next = { ...readFolderState(this.storage), [this.storageId]: open };
      safeStorageSet(this.storage, FOLDERS_STORAGE_KEY, JSON.stringify(next));
    }
    if (open) this.refresh();
    return this;
  }

  toggle() { return this.setOpen(!this.isOpen); }
}

/** Baca peta {folderId: open} dari storage; rusak/kosong → {}. */
export function readFolderState(storage) {
  try {
    const parsed = JSON.parse(safeStorageGet(storage, FOLDERS_STORAGE_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Tab panel: halaman (role=tabpanel), tombol tab (role=tab, ikon + label),
 * dan tombol rail (ikon saja, tampil saat panel tertutup).
 */
export class Tab extends Container {
  constructor(panel, { id, label, icon: iconName = 'layers' } = {}) {
    const pageId = `ui-page-${id}`;
    const tabId = `ui-tab-${id}`;
    super({
      store: panel.store, panel,
      el: h('section', 'ui-page', { role: 'tabpanel', id: pageId, 'aria-labelledby': tabId, tabindex: '0' }),
    });
    this.id = id;
    this.label = label;
    this.iconName = iconName;
    this.tabBtn = h('button', 'ui-tab ui-interactive', {
      type: 'button', role: 'tab', id: tabId, 'aria-controls': pageId, 'aria-selected': 'false', tabindex: '-1',
    });
    this.tabBtn.append(h('span', 'ui-tab__ico', { html: icon(iconName) }), h('span', 'ui-tab__label', { text: label }));
    this.railBtn = h('button', 'ui-rail__btn ui-interactive', {
      type: 'button', 'aria-label': label, 'data-tip': label, 'data-tab': id,
    });
    this.railBtn.append(h('span', '', { html: icon(iconName) }));
  }

  get isActive() { return this.el.classList.contains('is-active'); }

  setActive(on) {
    this.el.classList.toggle('is-active', on);
    this.tabBtn.classList.toggle('is-active', on);
    this.railBtn.classList.toggle('is-active', on);
    this.tabBtn.setAttribute('aria-selected', on ? 'true' : 'false');
    this.tabBtn.setAttribute('tabindex', on ? '0' : '-1');
    if (on) this.refresh();
    return this;
  }

  dispose() {
    this.tabBtn.remove();
    this.railBtn.remove();
    super.dispose();
  }
}
