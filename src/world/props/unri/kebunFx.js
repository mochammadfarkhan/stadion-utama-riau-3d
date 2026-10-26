/**
 * Efek partikel kebun: pancuran air gembor (tetes biru muda, hilang saat menyentuh tanah) dan semburan tanah saat
 * cangkul kena / menanam / memanen (gumpal cokelat, jatuh lalu diam di tanah sebelum mengecil). Fisika di
 * sim/particles.js; di sini hanya pemancar + dua InstancedMesh (2 draw call, disembunyikan saat kosong).
 */
import * as THREE from 'three';
import { createParticles, emitParticle, stepParticles } from '../../../sim/particles.js';

const WATER = Object.freeze({ capacity: 200, rate: 110, speed: 1.7, spread: 0.22, life: 1.1, size: 0.024, color: 0x9fdcff });
const SOIL = Object.freeze({ capacity: 96, speed: [1.2, 2.6], life: [0.8, 1.2], size: [0.035, 0.075], color: 0x4a2c16 }); // lebih gelap dari tanah garapan agar terbaca

const lerp = (a, b, t) => a + (b - a) * t;

function particleMesh(name, material, capacity) {
  const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), material, capacity);
  mesh.name = name;
  mesh.count = 0;
  mesh.visible = false;
  mesh.frustumCulled = false; // instans bergerak tiap frame: bounding sphere bawaan tidak berlaku
  return mesh;
}

/**
 * @param {{heightAt:(x:number, z:number) => number, rnd?:() => number}} opts
 * @returns {{group:THREE.Group, pour(origin:THREE.Vector3, dir:THREE.Vector3, dt:number):void,
 *   burst(point:{x:number,y:number,z:number}, count?:number):void, update(dt:number):void, dispose():void}}
 */
export function createFarmFx({ heightAt, rnd = Math.random }) {
  const group = new THREE.Group();
  group.name = 'kebun:efek';
  const waterMat = new THREE.MeshBasicMaterial({ color: WATER.color, transparent: true, opacity: 0.8, depthWrite: false });
  waterMat.name = 'kebun:air';
  const soilMat = new THREE.MeshLambertMaterial({ color: SOIL.color });
  soilMat.name = 'kebun:gumpal-tanah';
  const water = { pool: createParticles(WATER.capacity), mesh: particleMesh('kebun:tetes-air', waterMat, WATER.capacity) };
  const soil = { pool: createParticles(SOIL.capacity), mesh: particleMesh('kebun:gumpal-tanah', soilMat, SOIL.capacity) };
  group.add(water.mesh, soil.mesh);
  let carry = 0; // pecahan tetes yang belum dipancarkan (laju kontinu)
  const m = new THREE.Matrix4();
  const jitter = () => (rnd() - 0.5) * 2;

  function pour(origin, dir, dt) {
    carry += WATER.rate * dt;
    for (; carry >= 1; carry -= 1) {
      const s = WATER.speed * (0.85 + 0.3 * rnd());
      emitParticle(water.pool,
        origin.x + jitter() * 0.015, origin.y, origin.z + jitter() * 0.015,
        (dir.x + jitter() * WATER.spread) * s, (dir.y + jitter() * WATER.spread) * s, (dir.z + jitter() * WATER.spread) * s,
        WATER.life, WATER.size * (0.8 + 0.4 * rnd()));
    }
  }

  function burst(point, count = 14) {
    for (let i = 0; i < count; i += 1) {
      const a = rnd() * Math.PI * 2;
      const s = lerp(SOIL.speed[0], SOIL.speed[1], rnd());
      emitParticle(soil.pool, point.x, point.y + 0.03, point.z,
        Math.cos(a) * s * 0.45, s, Math.sin(a) * s * 0.45,
        lerp(SOIL.life[0], SOIL.life[1], rnd()), lerp(SOIL.size[0], SOIL.size[1], rnd()));
    }
  }

  /** Tulis matriks instans partikel hidup; stretch > 1 memanjangkan tetes searah vertikal. */
  function write({ pool, mesh }, stretch, shrinkFrom) {
    let n = 0;
    for (let i = 0; i < pool.capacity; i += 1) {
      if (!pool.alive[i]) continue;
      const t = pool.age[i] / pool.life[i];
      const s = pool.size[i] * (t > shrinkFrom ? 1 - (t - shrinkFrom) / (1 - shrinkFrom) : 1);
      m.makeScale(s, s * stretch, s).setPosition(pool.px[i], pool.py[i], pool.pz[i]);
      mesh.setMatrixAt(n, m);
      n += 1;
    }
    mesh.count = n;
    mesh.visible = n > 0;
    if (n) mesh.instanceMatrix.needsUpdate = true;
  }

  return {
    group,
    pour,
    burst,
    update(dt) {
      stepParticles(water.pool, dt, { gravity: 9.8, drag: 0.3, groundAt: heightAt, onGround: 'kill' });
      stepParticles(soil.pool, dt, { gravity: 9.8, drag: 1.2, groundAt: heightAt, onGround: 'stop' });
      write(water, 1.8, 0.85);
      write(soil, 1, 0.6);
    },
    dispose() {
      group.removeFromParent();
      for (const { mesh } of [water, soil]) {
        mesh.geometry.dispose();
        mesh.dispose();
      }
      waterMat.dispose();
      soilMat.dispose();
    },
  };
}
