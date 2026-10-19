/**
 * Minimap 2D, lapisan dari bawah ke atas: (1) tile kota (canvas per tile dari city/tileMinimap.js) dan
 * (2) base layer per region (M0 multi-region): peta dasar tampak atas yang di-bake SEKALI dari scene
 * lewat kamera ortografis (App.bakeMinimap), digambar sesuai urutan pertama kali dipasang. Per frame hanya
 * `drawImage` jendela di sekitar pemain + marker pada canvas 2D kecil. Tanpa render 3D tambahan, tidak
 * terpengaruh siang/malam, dan murah. Utara = atas.
 */
import {
  clampToEdge, layerInView, layerTransform, projectToView, snapRect, sourceRect, worldRectToView,
} from '../shared/minimapMath.js';

const BG = '#2f5b32';
const REDRAW_SEC = 1 / 15;     // 15 Hz cukup untuk peta
const EDGE_MARGIN = 12;
const GOAL_COLOR = '#f2b705';
const BIKE_COLOR = '#e53935';
/** Id base layer yang dipakai alias lama setBase() (peta dasar region stadion). */
export const LEGACY_BASE_ID = 'stadion';

export class Minimap2D {
  /**
   * @param {HTMLElement} root
   * @param {{size?:number, halfExtent?:number}} [opts] size: sisi (px CSS); halfExtent: ±meter yang tampak
   */
  constructor(root, { size = 200, halfExtent = 160 } = {}) {
    this.size = size;
    this.halfExtent = halfExtent;
    /** @type {Map<string, {canvas: CanvasImageSource & {width:number}, center:{x:number,z:number}, half:number, yaw:number}>} */
    this.layers = new Map();
    this.tileLayer = null;
    this._last = -Infinity;
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'minimap2d';
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', 'Minimap: utara di atas, sepeda di tengah');
    const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
    this.canvas.width = Math.round(size * dpr);
    this.canvas.height = Math.round(size * dpr);
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;
    this.ctx = this.canvas.getContext?.('2d') ?? null;
    this.dpr = dpr;
    root.append(this.canvas);
  }

  /**
   * Pasang/ganti base layer region. Urutan gambar = urutan pertama kali id dipasang.
   * @param {string} id id region
   * @param {CanvasImageSource & {width:number}} canvas peta dasar (yaw 0: utara di atas)
   * @param {{center?:{x:number,z:number}, half:number, yaw?:number}} opts center = pusat area bake (dunia),
   *   half = setengah sisi area (m), yaw = rotasi layer (rad, konvensi placement; bake App selalu 0)
   */
  setBaseLayer(id, canvas, { center = { x: 0, z: 0 }, half, yaw = 0 } = {}) {
    if (typeof id !== 'string' || id === '') throw new TypeError('Minimap2D.setBaseLayer: id wajib string');
    if (!canvas || !(half > 0) || !Number.isFinite(center?.x) || !Number.isFinite(center?.z) || !Number.isFinite(yaw)) {
      throw new TypeError(`Minimap2D.setBaseLayer("${id}"): canvas, half > 0, center {x,z}, dan yaw angka wajib`);
    }
    const next = new Map(this.layers);
    next.set(id, Object.freeze({ canvas, center: Object.freeze({ x: center.x, z: center.z }), half, yaw }));
    this.layers = next;
    this._last = -Infinity;
  }

  /** @returns {boolean} true bila layer ada lalu dilepas */
  removeBaseLayer(id) {
    if (!this.layers.has(id)) return false;
    const next = new Map(this.layers);
    next.delete(id);
    this.layers = next;
    this._last = -Infinity;
    return true;
  }

  /**
   * Alias lama (sebelum M0): peta dasar region stadion.
   * @param {CanvasImageSource & {width:number}} baseCanvas peta dasar
   * @param {number} worldHalf setengah sisi area bake (m)
   * @param {{x:number, z:number}} [center] pusat area bake di frame dunia (placement region)
   */
  setBase(baseCanvas, worldHalf, center = { x: 0, z: 0 }) {
    this.setBaseLayer(LEGACY_BASE_ID, baseCanvas, { center, half: worldHalf, yaw: 0 });
  }

  /** @param {{tilesInView(focus:{x:number,z:number}, halfExtent:number): Array<{canvas: CanvasImageSource, bounds: object}>}|null} layer */
  setTileLayer(layer) {
    this.tileLayer = layer;
    this._last = -Infinity;
  }

  setVisible(visible) { this.canvas.classList.toggle('hidden', !visible); }

  get visible() { return !this.canvas.classList.contains('hidden'); }

  /**
   * @param {number} time detik (untuk throttle dan denyut penanda)
   * @param {{focus:{x:number,z:number}, yaw:number, goal?:{x:number,z:number}|null,
   *   getPins?:()=>{x:number,z:number,color:string}[]}} s
   */
  update(time, { focus, yaw = 0, goal = null, getPins = null }) {
    const ctx = this.ctx;
    if (!ctx || !this.visible || time - this._last < REDRAW_SEC) return;
    this._last = time;
    const S = this.canvas.width;
    const k = this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, S, S);
    for (const t of this.tileLayer?.tilesInView(focus, this.halfExtent) ?? []) {
      const r = snapRect(worldRectToView(t.bounds, focus, this.halfExtent, S));
      ctx.drawImage(t.canvas, r.x, r.y, r.w, r.h);
    }
    for (const layer of this.layers.values()) this.#layer(layer, focus, S);
    ctx.setTransform(k, 0, 0, k, 0, 0); // koordinat tampilan dalam px CSS
    for (const p of getPins?.() ?? []) this.#pin(p, focus);
    if (goal) this.#goal(goal, focus, time);
    this.#bike(yaw);
    this.#north();
  }

  /** Satu base layer: yaw 0 = jendela sumber (jalur lama, paritas); yaw ≠ 0 = gambar penuh bertransformasi. */
  #layer(l, focus, S) {
    if (!layerInView(l, focus, this.halfExtent)) return;
    const ctx = this.ctx;
    if (l.yaw === 0) {
      const r = sourceRect(focus, this.halfExtent, l.half, l.canvas.width, l.center);
      ctx.drawImage(l.canvas, r.sx, r.sy, r.sw, r.sh, 0, 0, S, S);
      return;
    }
    const m = layerTransform(l, focus, this.halfExtent, S);
    ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
    ctx.drawImage(l.canvas, -l.half, -l.half, 2 * l.half, 2 * l.half);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  #pin(p, focus) {
    const v = projectToView(p, focus, this.halfExtent, this.size);
    if (!v.inside) return;
    const ctx = this.ctx;
    ctx.fillStyle = p.color;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(v.x, v.y, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  #goal(goal, focus, time) {
    const v = projectToView(goal, focus, this.halfExtent, this.size);
    const c = clampToEdge(v.x, v.y, this.size, EDGE_MARGIN);
    const ctx = this.ctx;
    const pulse = 1 + 0.18 * Math.sin(time * 5);
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.fillStyle = GOAL_COLOR;
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1.5;
    if (v.inside) {
      ctx.rotate(Math.PI / 4);
      ctx.scale(pulse, pulse);
      ctx.fillRect(-5, -5, 10, 10);
      ctx.strokeRect(-5, -5, 10, 10);
    } else {
      ctx.rotate(c.angle); // panah ke arah tujuan di luar peta
      ctx.beginPath();
      ctx.moveTo(7, 0);
      ctx.lineTo(-5, -6);
      ctx.lineTo(-5, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  #bike(yaw) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.size / 2, this.size / 2);
    ctx.rotate(Math.atan2(Math.cos(yaw), Math.sin(yaw))); // arah hadap: (sin yaw, cos yaw) di (x, z) layar
    ctx.fillStyle = BIKE_COLOR;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  #north() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('U', this.size / 2, 11);
  }
}
