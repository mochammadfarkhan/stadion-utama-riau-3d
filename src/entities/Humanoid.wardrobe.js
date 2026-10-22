/**
 * Lemari baju manekin (murni, tanpa three): opsi outfit Humanoid → potongan baju/aksesori per pivot + bagian badan
 * yang disembunyikan karena tertutup. Geometri potongan = `{g}_{nama}[_{l|r}]` di kit manekin
 * (assets-src/blender/karakter/manekin_baju.py); Humanoid.manekin.js yang memasangnya.
 *
 * Slot:  atasan  kaos | kemeja | almamater     (opts.top; default: lengan panjang → kemeja, selain itu kaos)
 *        bawahan pants (lebar; pantsFit 'slim' = ketat) | shorts | skirt (rok selutut) | longskirt (gamis + legging)
 *                rok/gamis berupa paruh kiri/kanan di pivot paha (& lutut) sehingga ikut pose duduk
 *        sepatu  opts.shoes (warna); sama dengan warna kulit = tanpa alas kaki
 *        aksesori kacamata (glasses) | ransel (backpack) | lencana (badge) | rompi (vest) | celemek (apron) |
 *                 + opts.aksesori: [{item:'jam'|'kartu_id'|'kacamata'|'ransel'|'lencana', color?}]
 */
export const TOPS = Object.freeze(['kaos', 'kemeja', 'almamater']);
export const BOTTOMS = Object.freeze(['pants', 'shorts', 'skirt', 'longskirt']);
export const ACCESSORIES = Object.freeze(['kacamata', 'ransel', 'lencana', 'kartu_id', 'jam', 'rompi', 'celemek']);
/** Bagian badan manekin per pivot (nama kit tanpa awalan gender / akhiran sisi). */
export const BODY_PARTS = Object.freeze({
  pelvis: 'body', torso: 'spine', neck: 'spine', head: 'headPivot',
  arm_upper: 'shoulder', arm_lower: 'elbow', hand: 'elbow', leg_thigh: 'hip', leg_shin: 'knee', foot: 'knee',
});
export const LEGGING_COLOR = 0x2b2b2b;
const ACC_COLOR = Object.freeze({ kacamata: 0x222222, jam: 0x333333, kartu_id: 0xf5f5f5, ransel: 0x37474f, lencana: 0xf2c200 });

/** Potongan: pivot (nama parts Humanoid tanpa sisi), nama kit, bersisi?, warna, dua sisi (tabung terbuka)? */
const piece = (pivot, name, color, { sided = false, doubleSided = false } = {}) => ({ pivot, name, sided, color, doubleSided });

function topPieces(top, color) {
  if (top === 'kaos') {
    return {
      pieces: [piece('spine', 'kaos_torso', color, { doubleSided: true }),
        piece('shoulder', 'kaos_sleeve', color, { sided: true, doubleSided: true })],
      hide: ['torso'],
    };
  }
  return {
    pieces: [piece('spine', `${top}_torso`, color, { doubleSided: true }), piece('spine', `${top}_collar`, color),
      piece('shoulder', `${top}_sleeve_upper`, color, { sided: true, doubleSided: true }),
      piece('elbow', `${top}_sleeve_lower`, color, { sided: true, doubleSided: true })],
    hide: ['torso', 'arm_upper', 'arm_lower'],
  };
}

function bottomPieces(bottom, color, slim) {
  if (bottom === 'shorts') {
    return {
      pieces: [piece('body', 'celana_pelvis', color, { doubleSided: true }), piece('hip', 'pendek_thigh', color, { sided: true, doubleSided: true })],
      hide: ['pelvis'],
    };
  }
  // Rok/gamis = paruh kiri/kanan di pivot paha (+ lutut untuk gamis): ikut duduk/jalan. Pinggul tetap ada, diwarnai
  // sewarna rok agar tidak bolong saat paruh berputar ke depan.
  if (bottom === 'skirt') return { pieces: [piece('hip', 'rok', color, { sided: true, doubleSided: true })], hide: [], pelvis: color };
  if (bottom === 'longskirt') {
    return {
      pieces: [piece('hip', 'gamis_atas', color, { sided: true, doubleSided: true }),
        piece('knee', 'gamis_bawah', color, { sided: true, doubleSided: true })],
      hide: [], pelvis: color, legs: LEGGING_COLOR,
    };
  }
  const cut = slim ? 'celana' : 'celana_lebar';
  return {
    pieces: [piece('body', 'celana_pelvis', color, { doubleSided: true }), piece('hip', `${cut}_thigh`, color, { sided: true, doubleSided: true }),
      piece('knee', `${cut}_shin`, color, { sided: true, doubleSided: true })],
    hide: ['pelvis', 'leg_thigh', 'leg_shin'],
  };
}

/** Daftar aksesori [{item, color}] dari field lama + opts.aksesori (item unik, yang eksplisit menang). */
export function accessoriesOf(o) {
  const list = new Map();
  if (o.glasses) list.set('kacamata', ACC_COLOR.kacamata);
  if (o.backpack != null) list.set('ransel', o.backpack);
  if (o.badge != null) list.set('lencana', o.badge);
  if (o.vest != null) list.set('rompi', o.vest);
  if (o.apron != null) list.set('celemek', o.apron);
  for (const a of o.aksesori ?? []) {
    const item = typeof a === 'string' ? a : a?.item;
    if (!ACCESSORIES.includes(item)) continue;
    list.set(item, (typeof a === 'object' && a.color != null) ? a.color : ACC_COLOR[item] ?? 0xffffff);
  }
  return [...list].map(([item, color]) => ({ item, color }));
}

const ACC_PIECE = Object.freeze({
  kacamata: ['headPivot', 'acc_kacamata'], ransel: ['spine', 'acc_ransel'], lencana: ['spine', 'acc_lencana'],
  kartu_id: ['spine', 'acc_kartu_id'], jam: ['elbowL', 'acc_jam_l'], rompi: ['spine', 'rompi'], celemek: ['spine', 'celemek'],
});

/**
 * @param {{top?:string, longSleeve?:boolean, shirt:number, pants:number, bottom?:string, pantsFit?:string,
 *   shoes?:number, skin:number, glasses?:boolean, backpack?:number|null, badge?:number|null, vest?:number|null,
 *   apron?:number|null, aksesori?:Array}} o
 * @returns {{top:string, bottom:string, pieces:object[], hide:Set<string>, bodyColor:Record<string,number>}}
 */
export function wardrobe(o) {
  const top = TOPS.includes(o.top) ? o.top : o.longSleeve ? 'kemeja' : 'kaos';
  const bottom = BOTTOMS.includes(o.bottom) ? o.bottom : 'pants';
  const t = topPieces(top, o.shirt);
  const b = bottomPieces(bottom, o.pants, o.pantsFit === 'slim');
  const pieces = [...t.pieces, ...b.pieces];
  const hide = new Set([...t.hide, ...b.hide]);
  if (o.shoes != null && o.shoes !== o.skin) {
    pieces.push(piece('knee', 'sepatu', o.shoes, { sided: true }));
    hide.add('foot');
  }
  for (const { item, color } of accessoriesOf(o)) {
    const [pivot, name] = ACC_PIECE[item];
    pieces.push(piece(pivot, name, color, { doubleSided: item === 'rompi' || item === 'celemek' }));
  }
  const bodyColor = Object.fromEntries(Object.keys(BODY_PARTS).map((k) => [k, o.skin]));
  if (b.legs != null) Object.assign(bodyColor, { leg_thigh: b.legs, leg_shin: b.legs });
  if (b.pelvis != null) bodyColor.pelvis = b.pelvis;
  return { top, bottom, pieces, hide, bodyColor };
}
