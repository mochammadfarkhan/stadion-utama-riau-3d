/**
 * Generator spesifikasi lapangan olahraga (MURNI, tanpa three): satu fungsi `courtSpec(kind, params)` menghasilkan
 * semua yang dibutuhkan builder dan collider — ukuran permukaan/run-off, marka putih (ruas, lingkaran, busur),
 * tiang net, dan posisi tiang ring. Koordinat lapangan-lokal (m): x melintang, z sepanjang sumbu panjang (utara = −Z),
 * pusat lapangan di (0, 0). Standar: voli 9×18 (FIBA/FIVB), basket 15×28 (FIBA), tenis ganda/tunggal 10,97×23,77.
 */

const LINE_W = 0.06;
/** Jarak tiang ring dari garis belakang (brief: 1,2 m di luar garis belakang). */
export const HOOP_OUTSET = 1.2;

const seg = (x0, z0, x1, z1) => ({ t: 'seg', x0, z0, x1, z1 });
const circle = (x, z, r) => ({ t: 'circle', x, z, r });
/** Busur: titik = (x + r·sin φ, z + r·cos φ), φ dari a0 ke a1 (φ = 0 menghadap +Z). */
const arc = (x, z, r, a0, a1) => ({ t: 'arc', x, z, r, a0, a1 });
const rect = (hw, hl) => [seg(-hw, -hl, hw, -hl), seg(hw, -hl, hw, hl), seg(hw, hl, -hw, hl), seg(-hw, hl, -hw, -hl)];

/** Marka voli: persegi 9×18, garis tengah (di bawah net), garis serang 3 m dari net. */
function voliLines({ playW = 9, playL = 18, attack = 3 } = {}) {
  const hw = playW / 2;
  const hl = playL / 2;
  return [...rect(hw, hl), seg(-hw, 0, hw, 0), seg(-hw, -attack, hw, -attack), seg(-hw, attack, hw, attack)];
}

/** Marka basket FIBA: tepi, garis tengah, lingkaran tengah, kunci 4,9 × 5,8, lingkaran lemparan bebas, garis tiga angka. */
function basketLines({ playW = 15, playL = 28 } = {}) {
  const hw = playW / 2;
  const hl = playL / 2;
  const lines = [...rect(hw, hl), seg(-hw, 0, hw, 0), circle(0, 0, 1.8)];
  const keyHalf = 2.45;
  const keyLen = 5.8;
  const hoopZ = hl - 1.575;
  const cornerX = hw - 0.9;
  const r3 = 6.75;
  const phi = Math.asin(cornerX / r3);
  for (const s of [-1, 1]) {
    const base = s * hl;
    const inner = s * (hl - keyLen);
    lines.push(seg(-keyHalf, base, -keyHalf, inner), seg(keyHalf, base, keyHalf, inner), seg(-keyHalf, inner, keyHalf, inner));
    lines.push(arc(0, inner, 1.8, s < 0 ? -Math.PI / 2 : Math.PI / 2, s < 0 ? Math.PI / 2 : (3 * Math.PI) / 2)); // setengah lingkaran ke arah tengah
    const hz = s * hoopZ;
    const edgeZ = hz - s * r3 * Math.cos(phi);
    lines.push(seg(-cornerX, base, -cornerX, edgeZ), seg(cornerX, base, cornerX, edgeZ));
    const c = s < 0 ? 0 : Math.PI;
    lines.push(arc(0, hz, r3, c - phi, c + phi)); // melengkung ke arah tengah lapangan
  }
  return lines;
}

/** Marka tenis: ganda 10,97 × 23,77, garis tunggal 8,23, garis servis 6,4 m dari net, garis servis tengah, tanda tengah. */
function tenisLines({ doublesW = 10.97, singlesW = 8.23, playL = 23.77, service = 6.4 } = {}) {
  const dw = doublesW / 2;
  const sw = singlesW / 2;
  const hl = playL / 2;
  return [
    ...rect(dw, hl),
    seg(-sw, -hl, -sw, hl), seg(sw, -hl, sw, hl),
    seg(-sw, -service, sw, -service), seg(-sw, service, sw, service),
    seg(0, -service, 0, service),
    seg(0, -hl, 0, -hl + 0.1), seg(0, hl, 0, hl - 0.1),
  ];
}

const KINDS = Object.freeze({
  voli: Object.freeze({
    surface: { w: 10.1, l: 18.5 }, outer: { w: 13.8, l: 27 }, lines: voliLines, lineKey: 'voli',
    net: { width: 9.6, centerH: 2.43, postH: 2.43, postR: 0.05, postX: 5.3 },
  }),
  basket: Object.freeze({
    surface: { w: 17.2, l: 28.7 }, outer: { w: 20.4, l: 32.5 }, lines: basketLines, lineKey: 'basket',
    net: null, hoops: true,
  }),
  tenis: Object.freeze({
    surface: { w: 11.8, l: 24.3 }, outer: { w: 20, l: 37 }, lines: tenisLines, lineKey: 'tenis',
    net: { width: 12.8, centerH: 0.914, postH: 1.07, postR: 0.05, postX: 6.4 },
  }),
});

export const COURT_KINDS = Object.freeze(Object.keys(KINDS));

/**
 * @param {'voli'|'basket'|'tenis'} kind
 * @param {{surface?:{w:number,l:number}, outer?:{w:number,l:number}, lineWidth?:number, lines?:object}} [params]
 *   `surface`/`outer` menimpa ukuran bawaan (mis. hasil ukur satelit); `lines` diteruskan ke pembuat marka.
 * @returns {{kind:string, surface:{w:number,l:number}, outer:{w:number,l:number}, lineWidth:number,
 *   lines:Array<object>, net:null|{width:number,centerH:number,postH:number,postR:number,posts:Array<{x:number,z:number}>},
 *   hoops:Array<{x:number,z:number,facing:-1|1}>}}
 */
export function courtSpec(kind, params = {}) {
  const k = KINDS[kind];
  if (!k) throw new RangeError(`courtSpec: jenis tidak dikenal "${kind}" (voli|basket|tenis)`);
  const surface = { ...k.surface, ...(params.surface ?? {}) };
  const outer = { ...k.outer, ...(params.outer ?? {}) };
  if (!(surface.w > 0 && surface.l > 0 && outer.w >= surface.w && outer.l >= surface.l)) {
    throw new RangeError('courtSpec: ukuran permukaan/run-off tidak valid');
  }
  const net = k.net
    ? { width: k.net.width, centerH: k.net.centerH, postH: k.net.postH, postR: k.net.postR, posts: [{ x: -k.net.postX, z: 0 }, { x: k.net.postX, z: 0 }] }
    : null;
  const hl = (kind === 'basket' ? 14 : surface.l / 2);
  const hoops = k.hoops ? [{ x: 0, z: -(hl + HOOP_OUTSET), facing: 1 }, { x: 0, z: hl + HOOP_OUTSET, facing: -1 }] : [];
  return Object.freeze({
    kind, surface: Object.freeze(surface), outer: Object.freeze(outer), lineWidth: params.lineWidth ?? LINE_W,
    lines: Object.freeze(k.lines(params.lines ?? {})), net: net && Object.freeze(net), hoops: Object.freeze(hoops),
  });
}

/** Lapangan-lokal → koordinat bidang (pusat lapangan di `c` = {x, z}); sumbu tidak diputar. */
export const courtPoint = (c, p) => ({ x: c.x + p.x, z: c.z + p.z });

/** Titik tiang net + ring dalam koordinat pusat `c` (untuk collider): [{x, z, r}]. */
export function courtObstacles(spec, c) {
  const out = [];
  for (const p of spec.net?.posts ?? []) out.push({ ...courtPoint(c, p), r: 0.3 });
  for (const h of spec.hoops) out.push({ ...courtPoint(c, h), r: 0.45 });
  return out;
}
