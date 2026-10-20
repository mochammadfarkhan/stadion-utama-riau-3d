/**
 * Jadwal aktivitas NPC sekre (spec §4.10, §8.2), murni & deterministik.
 * Periode [from, to) jam game (wrap 24): 05–08 kosong/1 tidur, 08–12 rapat (4–5), 12–14 sepi/makan (1–2),
 * 14–18 santai + gitar (3–4), 18–23 begadang proker (laptop + whiteboard + rapat, 4–6), 23–05 sebagian
 * tidur (2–3). Jumlah & penugasan NPC dari hash(seed, periode) → sama sepanjang periode (tidak berkedip),
 * berbeda antar seed. Slot diisi menurut urutan prioritas periode; slot yang tidak tersedia dilewati.
 */
export const DEFAULT_NPC_IDS = Object.freeze(['npc-1', 'npc-2', 'npc-3', 'npc-4', 'npc-5', 'npc-6']);

const period = (id, from, to, min, max, slots) => Object.freeze({ id, from, to, min, max, slots: Object.freeze(slots) });

export const PERIODS = Object.freeze([
  period('pagi-kosong', 5, 8, 0, 1, ['rebahan']),
  period('rapat', 8, 12, 4, 5, ['rapat-1', 'rapat-2', 'rapat-3', 'rapat-4', 'whiteboard']),
  period('sepi', 12, 14, 1, 2, ['minum', 'rapat-1']),
  period('santai', 14, 18, 3, 4, ['gitar', 'ngobrol-1', 'ngobrol-2', 'rapat-3']),
  period('begadang', 18, 23, 4, 6, ['laptop', 'whiteboard', 'rapat-1', 'rapat-2', 'rapat-3', 'rapat-4']),
  period('tidur', 23, 5, 2, 3, ['rebahan', 'laptop', 'rapat-2']),
]);

const wrapHour = (h) => (Number.isFinite(h) ? ((h % 24) + 24) % 24 : 0);

/** Periode yang memuat jam (wrap 24; NaN → 0). */
export function periodAt(hour) {
  const h = wrapHour(hour);
  return PERIODS.find((p) => (p.from < p.to ? h >= p.from && h < p.to : h >= p.from || h < p.to));
}

function hashString(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

function mix(a, b) {
  let x = (a ^ Math.imul(b, 0x9e3779b1)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

function rngFrom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(list, rnd) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Apakah jam `h` berada di [datang, pulang) (wrap 24; datang === pulang = selalu hadir). */
export function presentAt(profile, hour) {
  if (!profile) return true;
  const h = wrapHour(hour);
  const { datang, pulang } = profile;
  if (datang === pulang) return true;
  return datang < pulang ? h >= datang && h < pulang : h >= datang || h < pulang;
}

/**
 * @param {number} hourFloat jam game desimal
 * @param {number} seed
 * @param {Array<{id:string, poseId:string}>} slots slot aktivitas yang ada di ruangan
 * @param {readonly string[]} [npcIds]
 * @param {Record<string,{datang:number, pulang:number, suka?:readonly string[]}>} [profiles] jam hadir + slot favorit
 *   per NPC; tanpa profil = selalu hadir tanpa preferensi (perilaku lama). NPC di luar jam hadir tidak dipilih;
 *   tiap slot diberikan ke NPC hadir yang menyukainya lebih dulu, sisanya diisi acak.
 * @returns {ReadonlyArray<Readonly<{npcId:string, slotId:string, poseId:string}>>}
 */
export function scheduleFor(hourFloat, seed, slots, npcIds = DEFAULT_NPC_IDS, profiles = null) {
  const p = periodAt(hourFloat);
  const byId = new Map((Array.isArray(slots) ? slots : []).map((s) => [s.id, s]));
  const available = p.slots.filter((id) => byId.has(id));
  const rnd = rngFrom(mix(Number.isFinite(seed) ? seed >>> 0 : 0, hashString(p.id)));
  const want = p.min + Math.floor(rnd() * (p.max - p.min + 1));
  const all = Array.isArray(npcIds) ? npcIds : [];
  const ids = profiles ? all.filter((id) => presentAt(profiles[id], hourFloat)) : all;
  const count = Math.min(want, available.length, ids.length);
  const pool = shuffled(ids, rnd);
  const picked = [];
  for (const slotId of available.slice(0, count)) {
    const likes = pool.findIndex((id) => profiles?.[id]?.suka?.includes(slotId));
    picked.push({ npcId: pool.splice(likes >= 0 ? likes : 0, 1)[0], slotId });
  }
  return Object.freeze(picked.map(({ npcId, slotId }) => Object.freeze({ npcId, slotId, poseId: byId.get(slotId).poseId })));
}
