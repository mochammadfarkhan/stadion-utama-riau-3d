/**
 * Minimap 2D: dua layer — (1) tile kota (canvas per tile dari city/tileMinimap.js, di bawah) dan
 * (2) peta dasar region (tampak atas) yang di-bake SEKALI dari scene lewat kamera ortografis
 * (App.bakeMinimap). Per frame hanya `drawImage` jendela di sekitar pemain + marker pada canvas 2D
 * kecil. Tanpa render 3D tambahan, tidak terpengaruh siang/malam, dan murah. Utara = atas.
 */
import { clampToEdge, projectToView, sourceRect, worldRectToView } from '../shared/minimapMath.js';

const BG = '#2f5b32';
const REDRAW_SEC = 1 / 15;     // 15 Hz cukup untuk peta
const EDGE_MARGIN = 12;
const GOAL_COLOR = '#f2b705';
const BIKE_COLOR = '#e53935';

export class Minimap2D {
  /**
   * @param {HTMLElement} root
   * @param {{size?:number, halfExtent?:number}} [opts] size: sisi (px CSS); halfExtent: ±meter yang tampak
   */
  constructor(root, { size = 200, halfExtent = 160 } = {}) {
    this.size = size;
    this.halfExtent = halfExtent;
    this.base = null;
    this.worldHalf = 700;
    this.baseCenter = { x: 0, z: 0 };
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
   * @param {CanvasImageSource & {width:number}} baseCanvas peta dasar
   * @param {number} worldHalf setengah sisi area bake (m)
   * @param {{x:number, z:number}} [center] pusat area bake di frame dunia (placement region)
   */
  setBase(baseCanvas, worldHalf, center = { x: 0, z: 0 }) {
    this.base = baseCanvas;
    this.worldHalf = worldHalf;
    this.baseCenter = { x: center.x, z: center.z };
    this._last = -Infinity;
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
      const r = worldRectToView(t.bounds, focus, this.halfExtent, S);
      ctx.drawImage(t.canvas, r.x, r.y, r.w, r.h);
    }
    if (this.base) {
      const r = sourceRect(focus, this.halfExtent, this.worldHalf, this.base.width, this.baseCenter);
      ctx.drawImage(this.base, r.sx, r.sy, r.sw, r.sh, 0, 0, S, S);
    }
    ctx.setTransform(k, 0, 0, k, 0, 0); // koordinat tampilan dalam px CSS
    for (const p of getPins?.() ?? []) this.#pin(p, focus);
    if (goal) this.#goal(goal, focus, time);
    this.#bike(yaw);
    this.#north();
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
