/**
 * Matematika lambung kapal maket (murni, tanpa three). Lambung = rangkaian penampang sepanjang u ∈ [0, 1]
 * (0 = buritan, 1 = haluan); tiap penampang superelips dari bibir geladak kiri lewat lunas ke bibir kanan.
 * Satuan meter; y = 0 garis air.
 */
const clamp01 = (u) => Math.min(1, Math.max(0, u));

/**
 * Setengah lebar relatif (0..1) pada u. Buritan tumpul (transom > 0 = buritan rata), haluan meruncing.
 * @param {{transom?:number, bowSharp?:number, sternFull?:number}} h
 */
export function beamAt(u, h = {}) {
  const { transom = 0, bowSharp = 1.6, sternFull = 2.4 } = h;
  const x = clamp01(u);
  if (x >= 0.5) return 1 - ((x - 0.5) / 0.5) ** bowSharp;
  const s = 1 - (1 - x / 0.5) ** sternFull;
  return transom + (1 - transom) * s;
}

/** Tinggi bibir geladak (m) pada u: lambung timbul + lengkung sheer naik ke buritan & haluan. */
export function deckAt(u, h) {
  const x = clamp01(u);
  return h.freeboard + h.sheerAft * (1 - x) ** 3 + h.sheerFwd * x ** 3;
}

/** Kedalaman lunas (m, negatif) pada u: penuh di tengah, naik di kedua ujung. */
export function keelAt(u, h) {
  const x = clamp01(u);
  return -h.draft * (1 - Math.abs(2 * x - 1) ** 5 * 0.85);
}

/**
 * Titik penampang ke-k dari K (0 = bibir kiri/+z, K/2 = lunas, K = bibir kanan/−z) pada u.
 * @returns {[number, number, number]} [x, y, z] dengan x = (u − 0,5) × panjang.
 */
export function sectionPoint(u, k, K, h) {
  const a = (Math.PI * k) / K;
  const e = 2 / (h.round ?? 2.6);
  const c = Math.cos(a);
  const s = Math.sin(a);
  const w = (h.beam / 2) * beamAt(u, h);
  const top = deckAt(u, h);
  const keel = keelAt(u, h);
  return [(u - 0.5) * h.length, top - (top - keel) * Math.abs(s) ** e, w * Math.sign(c) * Math.abs(c) ** e];
}

/**
 * Grid verteks lambung (S+1 penampang × K+1 titik) + indeks segitiga. Menghadap keluar.
 * @returns {{positions:Float32Array, indices:Uint32Array, S:number, K:number}}
 */
export function hullGrid(h, S = 48, K = 14) {
  const positions = new Float32Array((S + 1) * (K + 1) * 3);
  let p = 0;
  for (let i = 0; i <= S; i += 1) {
    for (let k = 0; k <= K; k += 1) {
      for (const v of sectionPoint(i / S, k, K, h)) positions[p++] = v;
    }
  }
  const indices = new Uint32Array(S * K * 6);
  let q = 0;
  for (let i = 0; i < S; i += 1) {
    for (let k = 0; k < K; k += 1) {
      const a = i * (K + 1) + k;
      const b = a + K + 1;
      indices.set([a, a + 1, b, b, a + 1, b + 1], q);
      q += 6;
    }
  }
  return { positions, indices, S, K };
}

/** Titik di geladak (untuk menaruh orang/benda): u sepanjang kapal, v ∈ [−1, 1] lintang. */
export function deckPoint(u, v, h) {
  const w = (h.beam / 2) * beamAt(u, h) * 0.86;
  return [(u - 0.5) * h.length, deckAt(u, h) - (h.bulwark ?? 0.6), v * w];
}
