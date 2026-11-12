/**
 * Panggung diorama Skala Nusantara: alas maket bundar + laut bergelombang, cahaya sore dengan bayangan lembut,
 * serta penanda skala (penggaris 3D, manusia 1,7 m, kerumunan instanced). Semua gerak dihitung dari t (deterministik).
 */
import * as THREE from 'three';
import { deckPoint } from './hullMath.js';

/** PRNG kecil berbiji (posisi kerumunan sama di tiap render). */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bayangan kontak lembut di bawah alas (tekstur kanvas gradien radial). */
function contactShadow(radius) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const grd = ctx.createRadialGradient(128, 128, 60, 128, 128, 128);
  grd.addColorStop(0, 'rgba(60,40,20,0.45)');
  grd.addColorStop(1, 'rgba(60,40,20,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 256, 256);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2.6, radius * 2.6),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  return m;
}

/**
 * @param {{radius?:number, seaColor?:string}} opts
 * @returns {{scene:THREE.Scene, update:(t:number)=>void, seaY:(x:number,z:number,t:number)=>number}}
 */
export function createDiorama({ radius = 46, seaColor = '#3f8fa3' } = {}) {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff1dc, 0x6b5a48, 1.35));
  const sun = new THREE.DirectionalLight(0xffe0b5, 3.1);
  sun.position.set(-38, 62, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 220 });
  sun.shadow.radius = 7;
  sun.shadow.blurSamples = 16;
  sun.shadow.bias = -0.0004;
  scene.add(sun, sun.target);

  // Alas maket: bibir kayu + sisi gelap, laut di atasnya (y = 0).
  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(radius + 1.2, radius + 2.2, 5, 128),
    new THREE.MeshStandardMaterial({ color: 0x8b5e3c, roughness: 0.7 }),
  );
  plinth.position.y = -3.2; // puncak alas di −0,7: di bawah lembah ombak terdalam, tidak menembus laut
  plinth.receiveShadow = true;
  scene.add(plinth);
  const shadow = contactShadow(radius);
  shadow.position.y = -5.2;
  scene.add(shadow);

  // RingGeometry bercincin (bukan CircleGeometry yang hanya punya tepi luar) agar permukaan bisa bergelombang.
  const ring = new THREE.RingGeometry(0.01, radius + 1.2, 160, 40);
  ring.rotateX(-Math.PI / 2);
  const sea = new THREE.Mesh(ring, new THREE.MeshStandardMaterial({ color: seaColor, roughness: 0.32, metalness: 0.05 }));
  sea.receiveShadow = true;
  sea.position.y = -0.05;
  scene.add(sea);
  const base = Float32Array.from(ring.attributes.position.array);
  const seaY = (x, z, t) => 0.18 * Math.sin(x * 0.21 + t * 1.3) + 0.12 * Math.sin(z * 0.27 - t * 1.1) + 0.06 * Math.sin((x + z) * 0.6 + t * 2.1);

  return {
    scene,
    seaY,
    update(t) {
      const pos = ring.attributes.position;
      for (let i = 0; i < pos.count; i += 1) {
        const x = base[i * 3];
        const z = base[i * 3 + 2];
        const edge = Math.min(1, (radius + 1.2 - Math.hypot(x, z)) / 3); // bibir laut tetap rata dengan alas
        pos.array[i * 3 + 1] = seaY(x, z, t) * edge;
      }
      pos.needsUpdate = true;
      ring.computeVertexNormals();
    },
  };
}

/** Kapal mengapung: muncul (skala 0→1 dengan sedikit pantulan) lalu terayun ombak. */
export function floatShip(ship, { x, z, muncul, seaY, t, tenggelam = null }) {
  const u = Math.min(1, Math.max(0, (t - muncul) / 1.2));
  const back = u === 0 ? 0 : 1 + 2.2 * (u - 1) ** 3 + 1.2 * (u - 1) ** 2; // easeOutBack
  ship.visible = u > 0;
  ship.scale.setScalar(Math.max(0.001, back));
  const L = ship.userData.hull.length;
  const yF = seaY(x + L / 2, z, t);
  const yA = seaY(x - L / 2, z, t);
  ship.position.set(x, (yF + yA) / 2, z);
  ship.rotation.set(0.012 * Math.sin(t * 0.9 + x), 0, Math.atan2(yF - yA, L));
  if (tenggelam) {
    // Karam: miring dulu, lalu turun sampai seluruh tiang hilang ke dalam alas maket (laut & alas menutupinya).
    const k = Math.min(1, Math.max(0, (t - tenggelam) / 1.5));
    const e = k * k * (3 - 2 * k);
    const d = Math.min(1, Math.max(0, (t - tenggelam - 1) / 4));
    ship.rotation.x += 0.35 * e;
    ship.rotation.z -= 0.12 * e;
    ship.position.y -= 3 * e + 60 * d * d;
  }
}

const SEA_CLIP = [new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.7)];

/**
 * Potong bagian objek di bawah puncak alas (y < −0,7): kapal karam / lunas tidak tampak menembus bawah maket.
 * Perlu renderer.localClippingEnabled = true.
 */
export function clipBelowSea(root) {
  root.traverse((o) => { if (o.material) o.material.clippingPlanes = SEA_CLIP; });
}

/** Figur manusia maket 1,7 m (badan kapsul + kepala), warna mencolok. */
export function createPerson(color = '#ff6d1f') {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.95, 4, 10), m);
  body.position.y = 0.7;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), m);
  head.position.y = 1.55;
  for (const p of [body, head]) { p.castShadow = true; g.add(p); }
  return g;
}

/**
 * Kerumunan `n` orang (1 draw call) tersebar di geladak kapal; tampil bertahap via `count`.
 * @returns {{mesh:THREE.InstancedMesh, show:(k:number)=>void}}
 */
export function createCrowd(ship, n, color = '#20324f', seed = 7) {
  const h = ship.userData.hull;
  const geo = new THREE.CapsuleGeometry(0.2, 1.2, 3, 8);
  geo.translate(0, 0.8, 0);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.65 }), n);
  mesh.castShadow = true;
  const rnd = mulberry32(seed);
  const m = new THREE.Matrix4();
  for (let i = 0; i < n; i += 1) {
    const [x, y, z] = deckPoint(0.08 + rnd() * 0.84, rnd() * 2 - 1, h);
    m.makeTranslation(x, y, z);
    mesh.setMatrixAt(i, m);
  }
  mesh.count = 0;
  ship.add(mesh);
  return { mesh, show: (k) => { mesh.count = Math.round(Math.min(1, Math.max(0, k)) * n); } };
}

/**
 * Penggaris 3D dari a ke b (balok tipis + takik ujung), tumbuh menurut progres 0..1.
 * @returns {{group:THREE.Group, set:(k:number)=>THREE.Vector3}} set mengembalikan titik ujung saat ini (untuk label).
 */
export function createRuler(a, b, color = '#f2b705') {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const dir = B.clone().sub(A);
  const len = dir.length();
  dir.normalize();
  const group = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.5, emissive: color, emissiveIntensity: 0.25 });
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1, 0.35, 0.35), m);
  bar.castShadow = true;
  const capA = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.2, 0.35), m);
  const capB = capA.clone();
  capA.position.copy(A);
  group.add(bar, capA, capB);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
  bar.quaternion.copy(q);
  const tip = new THREE.Vector3();
  return {
    group,
    set(k) {
      const e = Math.min(1, Math.max(0, k));
      group.visible = e > 0;
      tip.copy(A).addScaledVector(dir, len * e);
      bar.scale.x = Math.max(0.001, len * e);
      bar.position.copy(A).addScaledVector(dir, (len * e) / 2);
      capB.position.copy(tip);
      capB.visible = e >= 1;
      return tip;
    },
  };
}
