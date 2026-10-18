/**
 * Penanda tujuan misi: tiang cahaya aditif + cincin di tanah (satu set yang dipindah),
 * dengan cakram besar di layer minimap supaya terlihat di peta. Tanpa lampu nyata baru.
 */
import * as THREE from 'three';
import { RENDER_LAYERS } from '../config/constants.js';

const COLOR = 0xffd84a;
const BEAM_HEIGHT = 70;
const BEAM_RADIUS = 1.4;
const RING_RADIUS = 3.2;
const MINIMAP_RADIUS = 16;
const PULSE_SPEED = 3;

/** @param {{ground?: (x:number, z:number) => number}} [opts] tinggi tanah di koordinat induk penanda (M1) */
export function createStoryMarkers({ ground = () => 0 } = {}) {
  const group = new THREE.Group();
  group.name = 'penandaMisi';
  group.visible = false;
  const additive = (opacity) => new THREE.MeshBasicMaterial({
    color: COLOR, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(BEAM_RADIUS, BEAM_RADIUS, BEAM_HEIGHT, 16, 1, true), additive(0.35));
  beam.position.y = BEAM_HEIGHT / 2;
  const ring = new THREE.Mesh(new THREE.RingGeometry(RING_RADIUS - 0.5, RING_RADIUS, 32).rotateX(-Math.PI / 2), additive(0.7));
  ring.position.y = 0.2;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(MINIMAP_RADIUS, 24).rotateX(-Math.PI / 2), additive(1));
  disc.position.y = 3;
  disc.layers.set(RENDER_LAYERS.minimap);
  group.add(beam, ring, disc);
  let target = null;

  return {
    group,
    /** Pindahkan ke titik {x,z} atau sembunyikan (null). */
    setTarget(point) {
      group.visible = Boolean(point);
      target = point ? { x: point.x, z: point.z } : null;
      if (point) group.position.set(point.x, ground(point.x, point.z), point.z);
    },
    update(time) {
      ring.scale.setScalar(1 + 0.15 * Math.sin(time * PULSE_SPEED));
      if (target) group.position.y = ground(target.x, target.z); // chunk terrain bisa termuat belakangan
    },
  };
}
