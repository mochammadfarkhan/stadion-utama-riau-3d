/**
 * Pemain berjalan kaki di interior: Humanoid (pakaian sama dengan pengendara sepeda; topi & sepatu dilepas di
 * dalam ruangan — alas kaki ditinggal di rak depan sekre) dipanggang menjadi SkinnedMesh, digerakkan
 * sim/walkPhysics. Arah hadap = yaw kamera interior (intent.yaw). Animasi: diam / jalan / lari menurut laju;
 * fase langkah mengikuti jarak tempuh.
 */
import { createHumanoid, animateIdle, animateWalk, animateRun } from './Humanoid.js';
import { bakeSkinnedHumanoid } from './Humanoid.skinned.js';
import { createWalkState, stepWalk, walkSpeedOf } from '../sim/walkPhysics.js';

export const PLAYER_OUTFIT = Object.freeze({
  skin: 0xc68642, shirt: 0x1abc9c, pants: 0x2b2b44, hair: 'buzz', hairColor: 0x1a1210, hat: null, height: 1.7, shoes: 0xc68642,
});
const IDLE_BELOW = 0.15; // m/s
const RUN_ABOVE = 2.0;   // m/s

export class Walker {
  /**
   * @param {{spawn:{x:number,z:number,yaw:number}, collider:{isWalkable(x:number,z:number):boolean}, outfit?:object}} opts
   */
  constructor({ spawn, collider, outfit = PLAYER_OUTFIT }) {
    this.collider = collider;
    this.state = createWalkState(spawn);
    this.humanoid = createHumanoid(outfit);
    this.skin = bakeSkinnedHumanoid(this.humanoid);
    this.group = this.humanoid.group;
    this.group.name = 'pemain-jalan';
    this._phase = 0;
    this.#place();
  }

  get speed() { return walkSpeedOf(this.state); }

  /** @param {number} dt @param {{forward:number, strafe:number, run:boolean, yaw:number}} intent */
  update(dt, intent) {
    this.state = stepWalk(this.state, intent, dt, this.collider);
    const v = this.speed;
    this._phase += (Number.isFinite(dt) ? dt : 0) * Math.max(0.6, v / 1.35);
    if (v < IDLE_BELOW) animateIdle(this.humanoid, this._phase);
    else if (v < RUN_ABOVE) animateWalk(this.humanoid, this._phase);
    else animateRun(this.humanoid, this._phase, v);
    this.skin.sync();
    this.#place();
  }

  #place() {
    this.group.position.set(this.state.x, 0, this.state.z);
    this.group.rotation.y = this.state.yaw;
  }

  /** Disembunyikan di orang pertama (kamera tidak di dalam kepala). */
  setVisible(visible) { this.group.visible = Boolean(visible); }

  dispose() {
    this.skin.dispose();
    this.group.removeFromParent();
  }
}
