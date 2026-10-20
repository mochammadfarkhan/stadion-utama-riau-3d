// src/regions/unri-rektorat/dermaga.js
/**
 * Generator dermaga kecil (M8 P2): geladak papan kayu menjorok dari tepi ke air sepanjang arah `dir`, tiang di
 * bawah geladak, tali pagar di kedua sisi. Murni (tanpa three): keluaran = daftar kotak {kind, x, y, z, sx, sy, sz, yaw}
 * dalam koordinat lokal region (y absolut), dirakit danau.js. Kind: 'papan' | 'tiang' | 'tali' (papan+tiang = material
 * kayu, tali = material tali -> 2 draw call setelah digabung per material).
 */

export const DERMAGA_DEFAULTS = Object.freeze({
  papan: 8,       // jumlah papan melintang (6-10)
  panjang: 9,     // m, sepanjang arah menjorok
  lebar: 1.8,     // m, lebar geladak
  tebalPapan: 0.07,
  celah: 0.025,   // m antar papan
  tiangEvery: 2,  // tiang tiap n papan
  tiangR: 0.09,
  tinggiPagar: 0.75,
});

/**
 * @param {{start:[number,number], dir:[number,number], deckY:number, bedY:number, papan?:number, panjang?:number,
 *   lebar?:number}} p start = titik awal geladak di darat (lokal), dir = arah ke air (tak harus satuan)
 * @returns {{boxes: Array<object>, yaw:number, end:[number,number], corridor:{length:number, width:number}}}
 */
export function dermaga(p) {
  const cfg = { ...DERMAGA_DEFAULTS, ...p };
  const n = Math.max(6, Math.min(10, Math.round(cfg.papan)));
  const len = Math.hypot(cfg.dir[0], cfg.dir[1]) || 1;
  const d = [cfg.dir[0] / len, cfg.dir[1] / len];
  const side = [-d[1], d[0]]; // tegak lurus kanan
  const yaw = Math.atan2(d[0], d[1]); // sumbu panjang kotak = +Z lokal
  const pitch = cfg.panjang / n; // pusat-ke-pusat papan
  const plankLen = pitch - cfg.celah;
  const at = (s, t, y) => ({ x: cfg.start[0] + d[0] * s + side[0] * t, z: cfg.start[1] + d[1] * s + side[1] * t, y });
  const boxes = [];
  const topY = cfg.deckY;
  for (let i = 0; i < n; i += 1) {
    const c = at(pitch * (i + 0.5), 0, topY - cfg.tebalPapan / 2);
    boxes.push({ kind: 'papan', ...c, sx: cfg.lebar, sy: cfg.tebalPapan, sz: plankLen, yaw });
  }
  // dua balok memanjang di bawah papan
  const beamY = topY - cfg.tebalPapan - 0.05;
  for (const t of [-cfg.lebar / 2 + 0.2, cfg.lebar / 2 - 0.2]) {
    boxes.push({ kind: 'papan', ...at(cfg.panjang / 2, t, beamY), sx: 0.1, sy: 0.1, sz: cfg.panjang, yaw });
  }
  // tiang: tiap `tiangEvery` papan, dua sisi, dari dasar sampai pagar
  const postTop = topY + cfg.tinggiPagar;
  const posts = [];
  for (let i = 0; i <= n; i += cfg.tiangEvery) {
    const s = Math.min(cfg.panjang, pitch * i + 0.05);
    for (const t of [-cfg.lebar / 2 - 0.02, cfg.lebar / 2 + 0.02]) {
      const bottom = Math.min(cfg.bedY, topY - 0.8);
      const c = at(s, t, (bottom + postTop) / 2);
      boxes.push({ kind: 'tiang', ...c, sx: cfg.tiangR * 2, sy: postTop - bottom, sz: cfg.tiangR * 2, yaw });
      posts.push({ s, t });
    }
  }
  // tali pagar: dua ruas melorot per sisi antara tiang berurutan
  const bySide = [-1, 1].map((sgn) => posts.filter((q) => Math.sign(q.t) === sgn).sort((a, b) => a.s - b.s));
  for (const list of bySide) {
    for (let i = 0; i + 1 < list.length; i += 1) {
      const a = list[i];
      const b = list[i + 1];
      const mid = at((a.s + b.s) / 2, a.t, postTop - 0.12);
      boxes.push({ kind: 'tali', ...mid, sx: 0.025, sy: 0.025, sz: Math.abs(b.s - a.s), yaw });
    }
  }
  const e = at(cfg.panjang, 0, topY);
  return { boxes, yaw, end: [e.x, e.z], corridor: { length: cfg.panjang, width: cfg.lebar + 0.3 } };
}

/** Titik terjauh kotak dari garis lintasan: jarak titik (px,pz) ke koridor dermaga (m; 0 = di dalam). Murni. */
export function distanceToDermaga(px, pz, start, dir, { length, width }) {
  const len = Math.hypot(dir[0], dir[1]) || 1;
  const d = [dir[0] / len, dir[1] / len];
  const rx = px - start[0];
  const rz = pz - start[1];
  const s = rx * d[0] + rz * d[1];
  const t = rx * -d[1] + rz * d[0];
  const ds = Math.max(0 - s, s - length, 0);
  const dt = Math.max(Math.abs(t) - width / 2, 0);
  return Math.hypot(ds, dt);
}
