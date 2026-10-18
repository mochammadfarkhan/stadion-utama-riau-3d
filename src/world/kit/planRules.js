/**
 * Aturan grammar per arketipe (spec §7.1–7.2 langkah 4): bukaan per bay per lantai, papan nama, ornamen.
 * Murni (tanpa three); dipanggil planBuilding dengan rng berurutan (deterministik). Satuan meter.
 * Bukaan: { mass, face, floor, u0, u1, y0, y1, kind, cell, lit, ac, layar? } — y relatif lantai `floor`.
 */
import { PLAN, facePoint, faceYaw, primaryFace } from './planGeom.js';

export const OPENING = Object.freeze({
  sill: 0.9, head: 2.6, minWindow: 0.8, maxWindow: 2.4, jamb: 0.45,
  door: Object.freeze({ w: 1.0, h: 2.2 }), doubleDoor: Object.freeze({ w: 1.8, h: 2.5 }),
  rosterGap: 0.2, rosterMax: 0.55, rosterTopGap: 0.35,
});

/** Lebar & tinggi jendela utama dalam bay. null bila bay terlalu sempit. */
export function windowRect(bayW, floorH) {
  const w = Math.min(OPENING.maxWindow, bayW - 2 * OPENING.jamb);
  if (w < OPENING.minWindow) return null;
  return { w, y0: OPENING.sill, y1: Math.min(OPENING.head, floorH - 0.9) };
}

/** Roster (lubang angin) di atas jendela/pintu bila ruang cukup. */
export function rosterRect(w, headY, floorH) {
  const y0 = headY + OPENING.rosterGap;
  const y1 = Math.min(floorH - OPENING.rosterTopGap, y0 + OPENING.rosterMax);
  return y1 - y0 >= 0.25 ? { w, y0, y1 } : null;
}

const center = (bay, w) => {
  const c = (bay.u0 + bay.u1) / 2;
  return [c - w / 2, c + w / 2];
};

/** Sel atlas jendela menurut tipe + nyala/tirai. */
function windowCell(type, lit, tirai) {
  if (type === 'kaca-biru') return lit ? 'kaca-biru-nyala' : 'kaca-biru';
  if (type === 'jalusi-kayu' || type === 'jalusi-alu') return type;
  if (lit) return 'nako-nyala';
  return tirai ? 'nako-tirai' : 'nako';
}

/** Pintu untuk bay ini menurut pola arketipe; null bila bay berjendela. */
export function doorKind(pattern, face, floor, i, n) {
  const mid = Math.floor(n / 2);
  const front = face.role === 'selasar' || face.role === 'depan';
  switch (pattern) {
    case 'kelas': return front && i % 3 === 0 && (face.role === 'selasar' || floor === 0) ? 'pintu' : null;
    case 'ganda': return front && floor === 0 && i === mid ? 'pintu-ganda' : null;
    case 'tunggal': return face.role === 'depan' && floor === 0 && i === mid ? 'pintu' : null;
    case 'lobi': return front && floor === 0 && (i === mid || (n % 2 === 0 && i === mid - 1)) ? 'pintu-kaca' : null;
    case 'gulung':
      if (floor === 0 && face.role === 'sisi' && i === mid) return 'pintu-gulung';
      return face.role === 'depan' && floor === 0 && i === mid ? 'pintu' : null;
    default: return null;
  }
}

/**
 * Bukaan satu bay. ctx: { arch, variant, style, rng, face, floor, floorH, bay, i, n, mass }.
 * @returns {object[]}
 */
export function bayOpenings(ctx) {
  const { arch, face, floor, floorH, bay, i, n } = ctx;
  const bayW = bay.u1 - bay.u0;
  const base = { mass: ctx.mass, face: face.id, floor };
  const out = [];
  const push = (o) => out.push({ ...base, lit: false, ac: false, ...o });
  if (arch.id === 'K07' || bayW < 1.2) return out;
  if (arch.id === 'K12') { // fasad dilukis: hanya pintu nyata
    const door = doorKind('tunggal', face, floor, i, n);
    if (door) {
      const [u0, u1] = center(bay, OPENING.door.w);
      push({ u0, u1, y0: 0, y1: OPENING.door.h, kind: 'pintu', cell: 'pintu-kayu' });
    }
    return out;
  }
  const special = { K10: mangkrakBay, K09: rusunBay, K03: adbBay }[arch.id];
  if (special) {
    special(ctx, push);
    return out;
  }
  const door = doorKind(arch.doors, face, floor, i, n);
  if (door) {
    const d = door === 'pintu-ganda' ? OPENING.doubleDoor : door === 'pintu-gulung'
      ? { w: Math.min(bayW - 0.6, 3.2), h: Math.min(floorH - 0.8, 3.4) } : OPENING.door;
    const [u0, u1] = center(bay, Math.min(d.w, bayW - 0.3));
    push({ u0, u1, y0: 0, y1: d.h, kind: door, cell: door === 'pintu' ? 'pintu-kayu' : door });
    if (arch.roster && door !== 'pintu-gulung') {
      const r = rosterRect(u1 - u0, d.h, floorH);
      if (r) push({ u0, u1, y0: r.y0, y1: r.y1, kind: 'roster', cell: `roster-${ctx.style.roster}` });
    }
    return out;
  }
  windowBay(ctx, push);
  return out;
}

/** Jendela + roster + AC luar (dinding biasa). */
function windowBay(ctx, push) {
  const { arch, face, floorH, bay, rng, style } = ctx;
  const bayW = bay.u1 - bay.u0;
  if (ctx.variant === 'toilet') {
    const [u0, u1] = center(bay, Math.min(1.2, bayW - 0.6));
    push({ u0, u1, y0: 1.8, y1: 2.4, kind: 'roster', cell: `roster-${style.roster}` });
    return;
  }
  const tall = arch.id === 'K05';
  const win = windowRect(bayW, floorH);
  if (!win) return;
  const w = ctx.variant === 'pos' ? Math.min(bayW - 0.5, 2.6) : win.w;
  const y1 = tall ? Math.min(4.2, floorH - 2.0) : win.y1;
  const y0 = tall ? 1.2 : ctx.variant === 'pos' ? 1.0 : win.y0;
  const lit = rng.chance(PLAN.litChance[arch.id] ?? 0.2);
  const tirai = rng.chance(PLAN.tiraiChance);
  const ac = face.role !== 'selasar' && rng.chance(arch.acChance);
  const [u0, u1] = center(bay, w);
  push({ u0, u1, y0, y1, kind: 'jendela', cell: windowCell(style.window, lit, tirai), lit, ac });
  if (arch.roster) {
    const r = rosterRect(w, y1, floorH);
    if (r) push({ u0, u1, y0: r.y0, y1: r.y1, kind: 'roster', cell: `roster-${style.roster}` });
  }
  if (arch.id === 'K04') {
    const [cu0, cu1] = center(bay, bayW - 0.6);
    push({ u0: cu0, u1: cu1, y0: floorH - 1.25, y1: floorH - 0.45, kind: 'clerestory', cell: 'clerestory' });
  }
  if (arch.id === 'K05') {
    const [vu0, vu1] = center(bay, bayW - 0.6);
    push({ u0: vu0, u1: vu1, y0: floorH - 1.1, y1: floorH - 0.45, kind: 'ventilasi', cell: 'jalusi-alu' });
  }
}

/** K03: lobi kaca di lantai dasar depan; pita kaca biru; lantai atas sisi depan/sisi dibungkus layar. */
function adbBay(ctx, push) {
  const { face, floor, floorH, bay, i, n, rng } = ctx;
  const bayW = bay.u1 - bay.u0;
  const door = doorKind('lobi', face, floor, i, n);
  if (door) {
    const [u0, u1] = center(bay, Math.min(bayW - 0.4, 3.0));
    push({ u0, u1, y0: 0, y1: 2.7, kind: 'pintu-kaca', cell: 'pintu-kaca' });
    return;
  }
  const lit = rng.chance(PLAN.litChance.K03);
  const [u0, u1] = center(bay, bayW - 0.5);
  const layar = floor >= 1 && (face.role === 'selasar' || face.role === 'depan' || (face.role === 'sisi' && i % 2 === 0));
  const screenOut = face.role === 'selasar' ? ctx.corridorDepth + 0.3 : 0.45; // layar di bidang luar (depan kolom)
  push({ u0, u1, y0: 0.9, y1: floorH - 0.8, kind: 'kaca-pita', cell: lit ? 'kaca-biru-nyala' : 'kaca-biru', lit, layar, screenOut, bayU0: bay.u0, bayU1: bay.u1 });
}

/** K09: sisi selasar = pintu unit + jendela kecil; belakang = pintu balkon + balkon berjemuran. */
function rusunBay(ctx, push) {
  const { face, bay, rng, floorH, style } = ctx;
  const bayW = bay.u1 - bay.u0;
  if (bayW < 2.6) return;
  if (face.role === 'selasar') {
    push({ u0: bay.u0 + 0.35, u1: bay.u0 + 1.25, y0: 0, y1: 2.1, kind: 'pintu', cell: 'pintu-kayu' });
    const lit = rng.chance(PLAN.litChance.K09);
    push({ u0: bay.u1 - 1.55, u1: bay.u1 - 0.35, y0: 1.0, y1: 2.1, kind: 'jendela', cell: windowCell('nako', lit, rng.chance(0.5)), lit });
    const r = rosterRect(1.2, 2.1, floorH);
    if (r) push({ u0: bay.u1 - 1.55, u1: bay.u1 - 0.35, y0: r.y0, y1: r.y1, kind: 'roster', cell: `roster-${style.roster}` });
    return;
  }
  if (face.role === 'belakang') {
    const lit = rng.chance(PLAN.litChance.K09);
    push({ u0: bay.u0 + 0.4, u1: bay.u0 + 1.3, y0: 0, y1: 2.1, kind: 'pintu', cell: lit ? 'nako-nyala' : 'pintu-kayu', lit });
    push({ u0: bay.u0 + 0.2, u1: bay.u1 - 0.2, y0: 0, y1: 1.05, kind: 'balkon', cell: 'railing', jemuran: rng.chance(0.65) });
    return;
  }
  const win = windowRect(bayW, floorH);
  if (win) {
    const lit = rng.chance(PLAN.litChance.K09);
    const [u0, u1] = center(bay, Math.min(win.w, 1.2));
    push({ u0, u1, y0: win.y0, y1: win.y1, kind: 'jendela', cell: windowCell('nako', lit, false), lit });
  }
}

/** K10: bay terbuka (rangka) atau diisi bata sebagian; tanpa kaca. */
function mangkrakBay(ctx, push) {
  const { bay, floorH, rng, floor } = ctx;
  const bata = rng.chance(floor === 0 ? 0.45 : 0.2);
  const coret = floor === 0 && rng.chance(0.4);
  push({ u0: bay.u0 + 0.2, u1: bay.u1 - 0.2, y0: 0, y1: floorH - 0.5, kind: bata ? 'bata' : 'lubang', cell: bata ? (coret ? 'beton-coret' : 'bata-merah') : 'gelap' });
}

/** Papan nama (N05): di balok selasar, kanopi K02, atau dinding atas pintu. */
export function planSign(text, arch, mass, floorH0) {
  if (!text || arch.signStyle === 'tidak') return null;
  const face = primaryFace(mass);
  if (!face || face.len < 3) return null;
  const h = arch.signStyle === 'panel' ? 0.9 : 0.5;
  const w = Math.min(PLAN.signMaxW, face.len * 0.7, text.length * h * 0.62 + h);
  const onBeam = face.role === 'selasar';
  const out = arch.id === 'K02' ? mass.corridor.depth + 3.0 + 0.06 : onBeam ? mass.corridor.depth + 0.06 : 0.06;
  const y = onBeam || arch.id === 'K02' ? floorH0 - 0.3 : Math.min(floorH0 - 0.5, 2.9);
  return { text, style: arch.signStyle, mass: 0, face: face.id, u: face.len / 2, y, out, w, h };
}

const T = (x, y, z, yaw = 0, sx = 1, sy = 1, sz = 1) => ({ x, y, z, yaw, sx, sy, sz });

/**
 * Ornamen LOD0 per arketipe (spec §7.1 kolom "Ciri wajib"). transform dunia; y absolut.
 * @returns {Array<{assetId:string, transform:{x:number,y:number,z:number,yaw:number,sx:number,sy:number,sz:number}}>}
 */
export function planOrnaments(arch, variant, mass, baseY, height, rng, ground) {
  const out = [];
  const add = (assetId, t) => out.push({ assetId, transform: t });
  const front = primaryFace(mass);
  const yaw = faceYaw(front);
  const at = (u, outM) => facePoint(front, u, outM);
  const corr = mass.corridor.depth;
  if (arch.id === 'K02') {
    const [x, z] = at(front.len / 2, corr + 1.5);
    add('teras-kanopi', T(x, baseY, z, yaw, Math.min(8, front.len * 0.3), 1, 3));
    const [sx, sz] = at(front.len / 2, corr + 3.4);
    add('tangga-tengah', T(sx, ground, sz, yaw, Math.min(6, front.len * 0.22), baseY - ground + 0.3, 1.2));
    const [fx, fz] = at(front.len / 2 + Math.min(10, front.len * 0.35), corr + 7);
    add('tiang-bendera', T(fx, ground, fz, yaw));
    for (const s of [-1, 1]) {
      const [px, pz] = at(front.len / 2 + s * Math.min(4.6, front.len * 0.16), corr + 3.2);
      add('pot', T(px, ground, pz, yaw));
    }
  }
  if (arch.id === 'K04') {
    for (const f of mass.faces.filter((x) => x.role === 'sisi')) {
      const [x, z] = facePoint(f, f.len / 2 + 1.6, 0.02);
      add('exhaust', T(x, baseY + Math.min(height - 1.6, 3.6), z, faceYaw(f)));
    }
  }
  if (arch.id === 'K05') {
    const [x, z] = at(front.len / 2, 1.2);
    add('kanopi-masuk', T(x, baseY + 2.9, z, yaw, 3.6, 1, 2.4));
  }
  if (arch.id === 'K06') {
    const side = mass.faces[(mass.faces.indexOf(front) + 1) % mass.faces.length]; // sisi samping (tegak lurus depan)
    const [wx, wz] = facePoint(side, side.len / 2, corr + 0.4);
    add('tempat-wudu', T(wx, baseY, wz, faceYaw(side), Math.min(5, side.len * 0.6)));
    const [rx, rz] = at(front.len / 2 + 1.6, corr * 0.5);
    add('rak-sandal', T(rx, baseY, rz, yaw));
  }
  if (arch.id === 'K07' && variant !== 'parkir') {
    const back = mass.faces.find((f) => f.role === 'belakang') ?? mass.faces[(mass.faces.indexOf(front) + 2) % mass.faces.length];
    const [ex, ez] = facePoint(back, back.len / 2, -0.8);
    add('etalase', T(ex, baseY, ez, faceYaw(back) + Math.PI, Math.min(6, back.len * 0.5)));
    const rows = Math.max(1, Math.floor((mass.obb.d - 3) / 2.4));
    for (let r = 0; r < rows; r += 1) {
      const [mx, mz] = at(front.len / 2, -1.6 - r * 2.4);
      add('meja-bangku', T(mx, baseY, mz, yaw, Math.min(6, front.len - 2)));
    }
    const [bx, bz] = at(front.len / 2, 0.05);
    add('spanduk-menu', T(bx, baseY + height - 0.55, bz, yaw, Math.min(4, front.len * 0.5)));
  }
  if (arch.id === 'K09') {
    const { obb } = mass;
    for (const s of [-0.3, 0.3]) add('tandon', T(obb.cx + Math.cos(obb.yaw) * s * obb.w, baseY + height, obb.cz - Math.sin(obb.yaw) * s * obb.w, obb.yaw));
  }
  if (arch.id === 'K10') {
    const n = Math.max(4, Math.round(mass.faces.reduce((s, f) => s + f.len, 0) / 5));
    for (let k = 0; k < n; k += 1) {
      const f = mass.faces[k % mass.faces.length];
      const [x, z] = facePoint(f, rng.next() * f.len, 0.6 + rng.next() * 1.6);
      add('ilalang', T(x, ground, z, rng.next() * Math.PI * 2, 0.8 + rng.next() * 0.8));
    }
  }
  return out;
}
