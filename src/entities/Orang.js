/**
 * Orang dari pack low poly kiriman user (2026-11-15; assets-src/blender/orang/orang_pack.py → public/models/orang/):
 * 9 karakter ber-skin satu rig biped (29 tulang "bip …"), 19 klip animasi bersama (anim.glb), palet 256 px bersama
 * (warna baju × kulit terang/sawo, tools/orang/palet.mjs). Satu orang = SATU SkinnedMesh (1 draw call; humanoid
 * prosedural ±15).
 *
 * createOrangKit membungkus kit NPC lama (createStudentKit) dengan antarmuka yang sama (createStudent/createGuard/
 * walk/idle/pose/clearPose/createLod/dispose): bila aset termuat dan setelan aktif, NPC baru memakai pack; bila tidak,
 * kit lama dipakai (mode lama tetap bisa dipilih lewat setelan graphics.orangPack).
 */
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { skipMatrixWhenHidden } from '../engine/hiddenSkip.js';
import { makeRng } from './util.js';

export const ORANG_DIR = 'models/orang/';
/** Karakter: id berkas → jenis kelamin (pilih klip p/w) + bobot kemunculan di kampus. */
export const ORANG_KARAKTER = Object.freeze({
  'kasual-pria-g': { g: 'p', bobot: 5 },
  'kasual-pria-k': { g: 'p', bobot: 5 },
  'kasual-wanita-g': { g: 'w', bobot: 5 },
  'kasual-wanita-k': { g: 'w', bobot: 5 },
  'dokter-pria': { g: 'p', bobot: 1 },
  'lansia-wanita': { g: 'w', bobot: 1 },
  'anak-laki': { g: 'p', bobot: 0.5 },
  'pekerja-pria': { g: 'p', bobot: 1 },
  'polisi-wanita': { g: 'w', bobot: 0 }, // hanya satpam (createGuard)
});
export const ORANG_BAJU = Object.freeze(['biru', 'abu', 'merah', 'gelap', 'krem', 'hitam', 'hijau', 'navy']);
export const ORANG_KULIT = Object.freeze(['sawo', 'terang']);
/** Porsi kulit sawo matang [INFERENSI] (penduduk Pekanbaru). */
const SAWO_CHANCE = 0.75;
/** Ambang LOD (m): animasi penuh ≤ near, di antaranya animasi tiap 3 frame, di luar far disembunyikan. */
export const ORANG_LOD = Object.freeze({ near: 35, far: 160 });
const CROSSFADE_S = 0.25;

export const paletPath = (baju, kulit) => `${ORANG_DIR}palet-${baju}-${kulit}.png`;
export const karakterPath = (id) => `${ORANG_DIR}${id}.glb`;
export const ANIM_PATH = `${ORANG_DIR}anim.glb`;

/** Pilih karakter berbobot dari rng (deterministik). Murni; diekspor untuk tes. */
export function pickKarakter(rng, table = ORANG_KARAKTER) {
  const entries = Object.entries(table).filter(([, v]) => v.bobot > 0);
  const total = entries.reduce((s, [, v]) => s + v.bobot, 0);
  let r = rng() * total;
  for (const [id, v] of entries) {
    r -= v.bobot;
    if (r < 0) return id;
  }
  return entries[entries.length - 1][0];
}

/** Waktu klip berulang dari fase t (detik) — aman untuk t negatif/NaN. Murni; diekspor untuk tes. */
export function loopTime(t, duration) {
  if (!(duration > 0) || !Number.isFinite(t)) return 0;
  return ((t % duration) + duration) % duration;
}

/**
 * Aset termuat: { karakter: {id: Object3D}, anim: Object3D (dengan .animations), palet: {"baju-kulit": Texture} }.
 * @returns {{create(id:string, baju:string, kulit:string):object}|null}
 */
export function createOrangFactory({ karakter, anim, palet }) {
  // Hanya trek rotasi: trek posisi/skala klip berskala sentimeter (rig FBX) sedangkan karakter dalam meter → tulang
  // terlempar. Rig semua karakter identik, jadi rotasi saja cukup (ayunan pinggul vertikal hilang, tak kentara).
  const clips = new Map((anim?.animations ?? []).map((c) => {
    const r = new THREE.AnimationClip(c.name, c.duration, c.tracks.filter((t) => t.name.endsWith('.quaternion')));
    return [c.name, r];
  }));
  if (!clips.size) return null;
  const mats = new Map();
  const material = (key) => {
    if (!mats.has(key)) {
      const map = palet[key] ?? Object.values(palet)[0] ?? null;
      const m = new THREE.MeshLambertMaterial({ map });
      m.name = `orang:${key}`;
      mats.set(key, m);
    }
    return mats.get(key);
  };
  return {
    clips,
    create(id, baju, kulit) {
      const src = karakter[id];
      if (!src) return null;
      const root = cloneSkinned(src);
      root.name = `orang:${id}`;
      root.rotation.y = Math.PI; // model menghadap −Z; konvensi NPC: maju = +Z pada yaw 0
      skipMatrixWhenHidden(root); // 29 tulang: jangan dihitung tiap frame selama orangnya tersembunyi (LOD/jarak/mode Kota)
      const mat = material(`${baju}-${kulit}`);
      let skinned = null;
      root.traverse((o) => {
        if (!o.isMesh) return;
        o.material = mat;
        o.castShadow = true;
        o.receiveShadow = false;
        o.frustumCulled = false; // bounding sphere SkinnedMesh tidak ikut pose
        if (o.isSkinnedMesh) skinned = o;
      });
      const group = new THREE.Group();
      group.add(root);
      const mixer = new THREE.AnimationMixer(root);
      return { group, root, skinned, mixer, actions: new Map(), current: null, g: ORANG_KARAKTER[id]?.g ?? 'p', id, baju, kulit, orang: true, skip: 0 };
    },
  };
}

function actionOf(h, clips, name) {
  let a = h.actions.get(name);
  if (!a) {
    const clip = clips.get(name);
    if (!clip) return null;
    a = h.mixer.clipAction(clip);
    a.play();
    a.weight = 0;
    h.actions.set(name, a);
  }
  return a;
}

/** Mainkan klip `name` pada fase t (detik klip), crossfade dari klip sebelumnya. */
export function playOrang(h, clips, name, t, dt = 1 / 60) {
  const a = actionOf(h, clips, name) ?? actionOf(h, clips, `diam-${h.g}`);
  if (!a) return;
  if (h.current !== a) {
    h.prev = h.current;
    h.current = a;
    h.fade = h.prev ? CROSSFADE_S : 0;
  }
  h.fade = Math.max(0, (h.fade ?? 0) - dt);
  const k = h.fade > 0 ? 1 - h.fade / CROSSFADE_S : 1;
  for (const x of h.actions.values()) x.weight = x === a ? k : x === h.prev ? 1 - k : 0;
  a.time = loopTime(t, a.getClip().duration);
  h.mixer.update(0);
}

/**
 * Kit NPC berbasis pack dengan cadangan kit lama.
 * @param {{factory: ReturnType<typeof createOrangFactory>|null, fallback: object, enabled?: () => boolean, seedSalt?: number}} opts
 */
/** Baju & kulit acak (kulit sawo SAWO_CHANCE). */
export function pickLook(rng) {
  return [ORANG_BAJU[Math.floor(rng() * ORANG_BAJU.length) % ORANG_BAJU.length], rng() < SAWO_CHANCE ? 'sawo' : 'terang'];
}

// Registri factory untuk entitas non-distrik (warga plaza): main.js mengisinya sebelum buildEntities.
let registered = null;
/** @param {ReturnType<typeof createOrangFactory>|null} f */
export function setOrangFactory(f) { registered = f ?? null; }
/** Orang acak dari pack (null bila pack tidak aktif/termuat → pemanggil memakai humanoid lama). */
export function createOrangRandom(rng, id = null) {
  if (!registered) return null;
  const pick = id ?? pickKarakter(rng);
  const [baju, kulit] = pickLook(rng);
  return registered.create(pick, baju, kulit);
}
/** Mainkan klip pada orang dari registri (fase t detik). */
export function orangPlay(h, name, t, dt) {
  if (registered) playOrang(h, registered.clips, name, t, dt);
}

export function createOrangKit({ factory, fallback, enabled = () => true }) {
  const use = () => Boolean(factory) && enabled();
  const clips = factory?.clips ?? new Map();
  const tick = (h) => {
    // di luar near: pose diperbarui tiap 3 panggilan (hemat CPU skinning); LOD menandai h.group.userData.orangJauh
    if (!h.group.userData.orangJauh) return true;
    h.skip = (h.skip + 1) % 3;
    return h.skip === 0;
  };
  return Object.freeze({
    get aktif() { return use(); },
    createStudent(seed) {
      if (!use()) return fallback.createStudent(seed);
      const rng = makeRng(seed);
      const id = pickKarakter(rng);
      const [baju, kulit] = pickLook(rng);
      const h = factory.create(id, baju, kulit) ?? null;
      if (!h) return fallback.createStudent(seed);
      h.variant = rng() < 0.25 ? 'telepon' : rng() < 0.5 ? 'santai' : '';
      return h;
    },
    createGuard(seed) {
      if (!use()) return fallback.createGuard(seed);
      const rng = makeRng(seed);
      return factory.create('polisi-wanita', rng() < 0.5 ? 'navy' : 'gelap', rng() < SAWO_CHANCE ? 'sawo' : 'terang') ?? fallback.createGuard(seed);
    },
    createLod() {
      const old = fallback.createLod();
      const list = [];
      return {
        addFrom(group) {
          if (group.children[0]?.name?.startsWith('orang:')) list.push(group);
          else old.addFrom(group);
        },
        update(camPos) {
          old.update(camPos);
          const n2 = ORANG_LOD.near * ORANG_LOD.near;
          const f2 = ORANG_LOD.far * ORANG_LOD.far;
          for (const g of list) {
            if (!g.parent) continue;
            const d2 = g.position.distanceToSquared(camPos);
            g.children[0].visible = d2 <= f2;
            g.userData.orangJauh = d2 > n2;
          }
        },
        forEachNear: old.forEachNear?.bind(old),
      };
    },
    walk(h, t) {
      if (!h.orang) return fallback.walk(h, t);
      if (!tick(h)) return;
      const name = h.variant === 'telepon' ? `jalan-telepon-${h.g}` : h.variant === 'santai' ? `jalan-santai-${h.g}` : `jalan-${h.g}`;
      playOrang(h, clips, name, t);
    },
    idle(h, t) {
      if (!h.orang) return fallback.idle(h, t);
      if (!tick(h)) return;
      playOrang(h, clips, h.variant === 'telepon' ? 'telepon' : `diam-${h.g}`, t);
    },
    pose(h, poseId, t) {
      if (!h.orang) return fallback.pose(h, poseId, t);
      if (!tick(h)) return;
      playOrang(h, clips, poseId === 'drinkCup' ? 'telepon' : `diam-${h.g}2`, t);
    },
    /** Pack tidak punya klip duduk: pemanggil menaruh NPC berdiri di dekat bangku. */
    canSit: (h) => !h.orang,
    clearPose(h) { if (!h.orang) fallback.clearPose?.(h); },
    dispose(h) { if (h.orang) h.mixer.stopAllAction(); else fallback.dispose(h); },
  });
}

/**
 * Muat semua aset pack (paralel). `loadModel(path)` = pemuat GLB proyek (world/assets/models.js, root.animations
 * terisi); `baseUrl` = import.meta.env.BASE_URL. Gagal → null (pemanggil memakai kit lama).
 */
export async function loadOrangAssets(loadModel, baseUrl = '/') {
  const texLoader = new THREE.TextureLoader();
  const tex = (path) => texLoader.loadAsync(`${baseUrl}${path}`).then((t) => {
    t.flipY = false; // UV glTF
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.NearestFilter; // blok warna palet tetap tegas
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.name = path;
    return t;
  });
  try {
    const ids = Object.keys(ORANG_KARAKTER);
    const looks = ORANG_BAJU.flatMap((b) => ORANG_KULIT.map((k) => `${b}-${k}`));
    const [roots, anim, textures] = await Promise.all([
      Promise.all(ids.map((id) => loadModel(karakterPath(id)))),
      loadModel(ANIM_PATH),
      Promise.all(looks.map((key) => tex(`${ORANG_DIR}palet-${key}.png`))),
    ]);
    return {
      karakter: Object.fromEntries(ids.map((id, i) => [id, roots[i]])),
      anim,
      palet: Object.fromEntries(looks.map((key, i) => [key, textures[i]])),
    };
  } catch (err) {
    console.warn('Pack orang gagal dimuat; NPC memakai humanoid lama.', err);
    return null;
  }
}
