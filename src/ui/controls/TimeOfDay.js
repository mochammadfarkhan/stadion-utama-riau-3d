/**
 * TimeOfDayControl — kontrol kustom "Waktu" (busur matahari + track gradien).
 * Mandiri (tidak meng-extend Control) tetapi mengikuti kontrak kontrol panel:
 *   new TimeOfDayControl(container, { store, key, field?, label? })
 *   .el .update() .isModified() .reset() .setVisible(v) .dispose()
 * Nilai dibaca dari store.get(key), ditulis store.set(key, v); repaint lewat store.subscribe.
 */
import {
  todPoint, todHours, skyColorsAt, phaseAt, fmtClock, parseClock, trackGradientCss,
} from './TimeOfDay.math.js';
import { buildDialSvg } from './TimeOfDay.svg.js';

const HOURS = 24;
const STEP_MINUTE = 1 / 60;
const STEP_QUARTER = 0.25;
const STEP_HOUR = 1;
const STEP_PAGE = 3;
const SUN_BELOW_OPACITY = 0.35;
const MOON_BELOW_OPACITY = 0.2;
const DEFAULT_LABEL = 'Waktu';
const SCALE_LABELS = Object.freeze(['00', '06', '12', '18', '24']);
const KEY_STEPS = Object.freeze({
  ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -STEP_PAGE, PageUp: STEP_PAGE,
});

let instanceCounter = 0;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const uid = () => `ui-tod-${(instanceCounter += 1)}-${Math.random().toString(36).slice(2, 7)}`;

/** Bulatkan jam ke kelipatan step, dijepit 0..24. */
function snapHour(h, step) {
  return clamp(Math.round(h / step) * step, 0, HOURS);
}

/** Set atribut hanya jika berubah (hindari layout/paint yang tak perlu). */
function setAttr(el, name, value) {
  const v = String(value);
  if (el.getAttribute(name) !== v) el.setAttribute(name, v);
}

function setText(el, value) {
  if (el.textContent !== value) el.textContent = value;
}

/** Buat elemen dengan kelas, teks, dan atribut opsional. */
function h(tag, className, { text, attrs, children } = {}) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null) el.textContent = text;
  for (const [k, v] of Object.entries(attrs ?? {})) el.setAttribute(k, v);
  for (const c of children ?? []) el.appendChild(c);
  return el;
}

/** Parse template SVG statis (bukan data pengguna) menjadi elemen di dokumen ini. */
function parseSvg(markup) {
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
  return document.importNode(doc.documentElement, true);
}

function buildRoot(label, dialSvg) {
  const clock = h('button', 'ui-tod-clock', { attrs: { type: 'button', title: 'Klik untuk mengetik jam' } });
  const reset = h('button', 'ui-ctl-reset', {
    text: '↺', attrs: { type: 'button', title: 'Kembalikan ke default', 'aria-label': 'Reset', hidden: '' },
  });
  const row = h('div', 'ui-ctl-row', {
    children: [h('span', 'ui-ctl-label', { text: label }), h('span', 'ui-ctl-value', { children: [clock, reset] })],
  });
  const track = h('div', 'ui-tod-track', {
    attrs: { role: 'presentation' }, children: [h('div', 'ui-tod-bar'), h('div', 'ui-tod-knob')],
  });
  const scale = h('div', 'ui-tod-scale', { children: SCALE_LABELS.map((t) => h('span', '', { text: t })) });
  return h('div', 'ui-ctl ui-ctl-time', { children: [row, h('div', 'ui-tod-dial-wrap', { children: [dialSvg] }), track, scale] });
}

export class TimeOfDayControl {
  constructor(container, { store, key, field, label } = {}) {
    if (!store || !key) throw new Error('TimeOfDayControl membutuhkan { store, key }');
    this.store = store;
    this.key = key;
    this.field = field ?? store.field(key);
    this.label = label ?? this.field?.label ?? DEFAULT_LABEL;
    this.id = uid();
    this.el = buildRoot(this.label, parseSvg(buildDialSvg(this.id)));
    this.refs = this.collectRefs();
    this.refs.bar.style.background = trackGradientCss();
    this.ac = new AbortController();
    this.dragging = null; // 'dial' | 'track' | null
    this.editing = null; // elemen input saat mengetik jam
    this.bindEvents();
    this.unsubscribe = store.subscribe(key, () => this.update());
    this.update();
    (container?.body ?? container)?.appendChild?.(this.el);
  }

  collectRefs() {
    const q = (sel) => this.el.querySelector(sel);
    return {
      clock: q('.ui-tod-clock'), reset: q('.ui-ctl-reset'), dial: q('.ui-tod-dial'),
      skyTop: q('.ui-tod-sky-top'), skyBot: q('.ui-tod-sky-bot'), seaTop: q('.ui-tod-sea-top'),
      seaBot: q('.ui-tod-sea-bot'), stars: q('.ui-tod-stars'), sun: q('.ui-tod-sun'),
      sunGlow: q('.ui-tod-sun-glow'), moon: q('.ui-tod-moon'), phase: q('.ui-tod-phase'),
      track: q('.ui-tod-track'), bar: q('.ui-tod-bar'), knob: q('.ui-tod-knob'), value: q('.ui-ctl-value'),
    };
  }

  // ---------- Kontrak kontrol ----------

  get value() {
    return Number(this.store.get(this.key)) || 0;
  }

  isModified() {
    return this.field ? !Object.is(this.value, this.field.default) : false;
  }

  reset() {
    if (this.field) this.store.set(this.key, this.field.default);
  }

  setVisible(visible) {
    this.el.hidden = !visible;
  }

  dispose() {
    this.ac.abort();
    this.unsubscribe?.();
    this.el.remove();
  }

  /** Repaint dari nilai store; hanya atribut yang berubah yang dimutasi. */
  update() {
    const hour = this.value;
    const r = this.refs;
    const sun = todPoint(hour);
    const moon = todPoint(hour + 12);
    const colors = skyColorsAt(hour);
    const clock = fmtClock(hour);
    const phase = phaseAt(hour);
    setAttr(r.sun, 'transform', `translate(${sun.x.toFixed(2)} ${sun.y.toFixed(2)})`);
    setAttr(r.sun, 'opacity', sun.elev >= 0 ? 1 : SUN_BELOW_OPACITY);
    setAttr(r.sunGlow, 'opacity', clamp(sun.elev * 1.3, 0, 1).toFixed(3));
    setAttr(r.moon, 'transform', `translate(${moon.x.toFixed(2)} ${moon.y.toFixed(2)})`);
    setAttr(r.moon, 'opacity', (moon.elev > 0 ? clamp(0.3 + moon.elev, 0, 1) : MOON_BELOW_OPACITY).toFixed(3));
    setAttr(r.stars, 'opacity', clamp((-sun.elev - 0.05) * 1.6, 0, 1).toFixed(3));
    setAttr(r.skyTop, 'stop-color', colors.zenith);
    setAttr(r.skyBot, 'stop-color', colors.horizon);
    setAttr(r.seaTop, 'stop-color', colors.horizon);
    setAttr(r.seaBot, 'stop-color', colors.sea);
    setAttr(r.dial, 'aria-valuenow', hour.toFixed(2));
    setAttr(r.dial, 'aria-valuetext', `${clock} · ${phase}`);
    setText(r.phase, phase);
    if (!this.editing) setText(r.clock, clock);
    r.knob.style.left = `${((hour / HOURS) * 100).toFixed(2)}%`;
    r.reset.hidden = !this.isModified();
  }

  // ---------- Interaksi ----------

  commit(hours) {
    this.store.set(this.key, clamp(hours, 0, HOURS));
  }

  bindEvents() {
    const { signal } = this.ac;
    const r = this.refs;
    const opts = { signal };
    r.dial.addEventListener('pointerdown', (e) => this.onPointerDown(e, 'dial'), opts);
    r.track.addEventListener('pointerdown', (e) => this.onPointerDown(e, 'track'), opts);
    for (const target of [r.dial, r.track]) {
      target.addEventListener('pointermove', (e) => this.onPointerMove(e), opts);
      target.addEventListener('pointerup', (e) => this.onPointerUp(e), opts);
      target.addEventListener('pointercancel', (e) => this.onPointerUp(e), opts);
      target.addEventListener('lostpointercapture', () => this.endDrag(), opts);
    }
    r.dial.addEventListener('keydown', (e) => this.onKeyDown(e), opts);
    r.clock.addEventListener('click', () => this.beginEdit(), opts);
    r.reset.addEventListener('click', () => this.reset(), opts);
  }

  onPointerDown(e, source) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const target = source === 'dial' ? this.refs.dial : this.refs.track;
    try { target.setPointerCapture(e.pointerId); } catch { /* pointer sudah hilang: abaikan */ }
    this.dragging = source;
    this.el.classList.add('is-dragging');
    this.refs.dial.focus({ preventScroll: true });
    this.applyPointer(e);
  }

  onPointerMove(e) {
    if (!this.dragging) return;
    e.preventDefault();
    this.applyPointer(e);
  }

  onPointerUp(e) {
    if (!this.dragging) return;
    this.applyPointer(e);
    this.endDrag();
  }

  endDrag() {
    if (!this.dragging) return;
    this.dragging = null;
    this.el.classList.remove('is-dragging');
  }

  /** Terjemahkan posisi pointer ke jam sesuai sumber drag, lalu snap & commit. */
  applyPointer(e) {
    const step = e.shiftKey ? STEP_QUARTER : STEP_MINUTE;
    const raw = this.dragging === 'track' ? this.hoursFromTrack(e) : this.hoursFromDial(e);
    if (raw == null) return;
    this.commit(snapHour(raw, step));
  }

  hoursFromDial(e) {
    const svg = this.refs.dial;
    const ctm = svg.getScreenCTM?.();
    if (!ctm) return null;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return todHours(pt.x, pt.y);
  }

  hoursFromTrack(e) {
    const rect = this.refs.bar.getBoundingClientRect();
    if (!rect.width) return null;
    return clamp((e.clientX - rect.left) / rect.width, 0, 1) * HOURS;
  }

  onKeyDown(e) {
    if (this.editing) return;
    let next = null;
    if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = HOURS;
    else if (e.key in KEY_STEPS) {
      const dir = KEY_STEPS[e.key];
      const unit = Math.abs(dir) === STEP_PAGE ? 1 : e.shiftKey ? STEP_HOUR : STEP_QUARTER;
      next = this.value + dir * unit;
    }
    if (next == null) return;
    e.preventDefault();
    e.stopPropagation();
    this.commit(snapHour(next, STEP_MINUTE));
  }

  // ---------- Edit teks jam ----------

  beginEdit() {
    if (this.editing) return;
    const input = h('input', 'ui-tod-clock-input', {
      attrs: { type: 'text', inputmode: 'numeric', maxlength: '5', 'aria-label': 'Jam (HH:MM)' },
    });
    input.value = fmtClock(this.value);
    this.editing = input;
    this.refs.clock.replaceWith(input);
    input.focus();
    input.select();
    const { signal } = this.ac;
    input.addEventListener('keydown', (e) => this.onEditKey(e), { signal });
    input.addEventListener('blur', () => this.finishEdit(true), { signal });
    input.addEventListener('pointerdown', (e) => e.stopPropagation(), { signal });
  }

  onEditKey(e) {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); this.finishEdit(true); }
    else if (e.key === 'Escape') { e.preventDefault(); this.finishEdit(false); }
  }

  /** Tutup input; bila apply=true dan teks valid → commit; tak valid → tandai dan batalkan. */
  finishEdit(apply) {
    const input = this.editing;
    if (!input) return;
    const parsed = apply ? parseClock(input.value) : null;
    const invalid = apply && parsed == null && input.value.trim() !== '';
    this.refs.value.classList.toggle('is-invalid', invalid);
    this.editing = null;
    input.replaceWith(this.refs.clock);
    if (parsed != null) this.commit(snapHour(parsed, STEP_MINUTE));
    this.update();
    this.refs.clock.focus({ preventScroll: true });
  }
}
