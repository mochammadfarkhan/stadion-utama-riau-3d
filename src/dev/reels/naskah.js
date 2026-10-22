/**
 * Ekspor naskah reels (murni): subtitle SRT untuk editor video & naskah Markdown untuk pengisi suara, dari data scene
 * yang sama dengan render (satu sumber kebenaran). `nama` = peta id npc → nama tampil.
 */
const pad = (n, w = 2) => String(n).padStart(w, '0');

/** Detik → "HH:MM:SS,mmm" (format SRT). */
export function srtTime(sec) {
  const ms = Math.max(0, Math.round(sec * 1000));
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
}

const stripTags = (s) => String(s).replace(/<[^>]+>/g, '');
const lineOf = (it, nama) => {
  const isi = stripTags(it.isi);
  if (it.gaya === 'dialog') return `${nama[it.siapa] ?? it.siapa}: ${isi}`;
  return it.kecil ? `${isi} — ${stripTags(it.kecil)}` : isi;
};

/** @param {{dari:number, sampai:number, gaya:string, isi:string, siapa?:string, kecil?:string}[]} teks */
export function toSrt(teks, nama = {}) {
  return [...teks]
    .sort((a, b) => a.dari - b.dari)
    .map((it, i) => `${i + 1}\n${srtTime(it.dari)} --> ${srtTime(it.sampai)}\n${lineOf(it, nama)}\n`)
    .join('\n');
}

const stamp = (sec) => `${Math.floor(sec / 60)}:${pad(Math.floor(sec % 60))}`;

/** Naskah Markdown: per adegan, aksi + dialog berjam (untuk rekam VO / dubbing). */
export function toNaskahMd(scene, nama = {}) {
  const out = [`# ${scene.judul}`, '', `Durasi ${scene.durasi} detik · ${scene.fps} fps · 1080×1920`, ''];
  if (scene.logline) out.push(`> ${scene.logline}`, '');
  if (scene.pemeran) {
    out.push('## Pemeran', '');
    for (const [id, peran] of Object.entries(scene.pemeran)) out.push(`- **${nama[id] ?? id}**: ${peran}`);
    out.push('');
  }
  const adegan = [...(scene.adegan ?? [{ dari: 0, judul: 'Adegan' }])].sort((a, b) => a.dari - b.dari);
  adegan.forEach((a, i) => {
    const sampai = adegan[i + 1]?.dari ?? scene.durasi;
    out.push(`## ${i + 1}. ${a.judul} (${stamp(a.dari)}–${stamp(sampai)})`, '');
    if (a.aksi) out.push(`*${a.aksi}*`, '');
    for (const it of scene.teks.filter((x) => x.dari >= a.dari && x.dari < sampai).sort((x, y) => x.dari - y.dari)) {
      const isi = stripTags(it.isi);
      if (it.gaya === 'dialog') out.push(`- \`${stamp(it.dari)}\` **${(nama[it.siapa] ?? it.siapa).toUpperCase()}**${it.arahan ? ` (${it.arahan})` : ''}: ${isi}`);
      else out.push(`- \`${stamp(it.dari)}\` _[teks layar]_ ${lineOf(it, nama)}`);
    }
    out.push('');
  });
  return out.join('\n');
}
