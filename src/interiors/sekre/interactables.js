/**
 * Barang interaktif sekre (spec §8.2: ≥ 10): handler untuk tabel INTERAKSI di data.js → item berkontrak
 * Interactable (Interior.js). Teks dari data (bisa diganti user). onInteract(ctx) menerima ctx portal:
 * { rig, walker, toast(text, ok), exit(), hour, raining }. Kembalian {title, text} → kartu info; void → aksi.
 * Easter egg: lemari arsip ("LPJ yang belum selesai").
 */
import { INTERAKSI, ORGANISASI, STRUKTUR, PROKER, CATATAN_RAPAT, PIAGAM, KALENDER, TEKS, DATA_CONTOH } from './data.js';
import { WINDOW_PEEK } from './photo.js';

const CHORD_ORDER = Object.freeze(['C', 'G', 'Am', 'F']);
const STATUS_TEKS = Object.freeze({ selesai: '✓ selesai', berjalan: '● berjalan', rencana: '○ rencana' });
const contoh = () => (DATA_CONTOH ? `\n${TEKS.contoh}` : '');

export function strukturText() {
  const lines = [`${ORGANISASI.nama} — periode ${ORGANISASI.periode}`];
  for (const p of [...STRUKTUR.inti, ...STRUKTUR.sekben]) lines.push(`• ${p.jabatan}: ${p.nama}`);
  for (const d of STRUKTUR.divisi) lines.push(`• Divisi ${d.nama}: ${d.koor} (koor.), ${d.anggota.join(', ')}`);
  return lines.join('\n') + contoh();
}

export function prokerText() {
  const lines = PROKER.map((p) => `• ${p.bulan} — ${p.nama} (${STATUS_TEKS[p.status] ?? p.status})${p.catatan ? ` ${p.catatan}` : ''}`);
  return [`${ORGANISASI.kabinet} · ${ORGANISASI.periode}`, ...lines].join('\n') + contoh();
}

export function piagamText() {
  const lines = PIAGAM.map((p) => `• ${p.judul} ${p.tahun}: ${p.isi}`);
  return [...lines, TEKS.piala].join('\n') + contoh();
}

export function rapatText() {
  const R = CATATAN_RAPAT;
  return [
    `${R.judul} (${R.tanggal})`,
    ...R.poin.map((p) => `• ${p}`),
    `Pembagian: ${R.tabel.kolom.map((k, i) => `${k} → ${R.tabel.isi[i]}`).join(', ')}`,
    R.tenggat,
    `Di pojok papan: "${R.sudut}"`,
  ].join('\n') + contoh();
}

export function kalenderText() {
  const tanda = Object.entries(KALENDER.tanda).map(([d, t]) => `• ${d} Oktober: ${t}`);
  return [`Kalender ${KALENDER.bulan.toLowerCase()} — beberapa tanggal dilingkari spidol merah:`, ...tanda, `Coretan di bawah: "${KALENDER.coretan}"`].join('\n');
}

/**
 * @param {{furniture:{pourWater():boolean, toggleFan():boolean, guitarWorldPosition(out:object):object},
 *   lighting:{toggleSwitch():boolean}, audio:{strum(name:string, opts?:object):void, click():void}}} deps
 * @returns {{items: Array<object>, update(): void}}
 */
export function createSekreInteractables({ furniture, lighting, audio }) {
  const gitarPos = { ...INTERAKSI.find((i) => i.id === 'gitar').pos };
  let chord = 0;
  const handlers = {
    'papan-struktur': () => ({ title: `Struktur ${ORGANISASI.kabinet}`, text: strukturText() }),
    'papan-proker': () => ({ title: 'Program kerja', text: prokerText() }),
    piagam: () => ({ title: 'Piagam & piala', text: piagamText() }),
    'lemari-arsip': () => ({ title: 'Lemari arsip', text: TEKS.lemari }),
    gitar: (ctx) => {
      const name = CHORD_ORDER[chord];
      chord = (chord + 1) % CHORD_ORDER.length;
      audio.strum(name, { gain: 0.45 });
      ctx.toast(`Genjreng! (${name})`, true);
    },
    dispenser: (ctx) => {
      if (furniture.pourWater()) ctx.toast('Air galon mengucur ke gelas… galonnya tinggal seperempat.', true);
    },
    kipas: (ctx) => {
      const on = furniture.toggleFan();
      audio.click();
      ctx.toast(on ? 'Kipas menyala — kertas di meja ikut berkibar' : 'Kipas dimatikan', true);
    },
    saklar: (ctx) => {
      const on = lighting.toggleSwitch();
      audio.click();
      ctx.toast(on ? 'Lampu TL dinyalakan' : 'Lampu TL dimatikan', true);
    },
    jendela: (ctx) => {
      ctx.rig.peek(WINDOW_PEEK, 5);
      ctx.toast('Mengintip selasar… (E / Esc / W untuk kembali)', true);
    },
    whiteboard: () => ({ title: 'Catatan rapat di papan tulis', text: rapatText() }),
    pintu: (ctx) => { ctx.exit(); },
    kalender: () => ({ title: 'Kalender', text: kalenderText() }),
  };
  const items = INTERAKSI.map((it) => ({
    id: it.id,
    label: it.label,
    pos: it.id === 'gitar' ? gitarPos : { ...it.pos },
    radius: it.radius,
    prompt: it.prompt,
    onInteract: handlers[it.id],
  }));
  return {
    items,
    /** Posisi gitar mengikuti tangan NPC saat dimainkan (dipanggil tiap frame). */
    update() { furniture.guitarWorldPosition(gitarPos); },
  };
}
