/**
 * Drama 80 detik "Tanggal 1: Patroli Uang Kas" di sekre ERC. FIKSI KOMEDI [INFERENSI]: peran memakai nama roster
 * sekre (data contoh di interiors/sekre/data.js: Mutia = Bendahara, Farkhan = Ketua); kebiasaan & dialog karangan.
 * Naskah lengkap (.md) dan subtitle (.srt) diekspor dari berkas ini oleh tools/reels/render.mjs.
 *
 * Denah (m, +X timur, +Z selatan): pintu utara x 1,6–2,5 (z −3); meja laptop x ≥ 2,35, z 0,3–2,1; karpet lesehan
 * di tengah-barat. Yaw = arah hadap (sin yaw, cos yaw); `langkah` dikompilasi reels/blocking.js.
 */
import { shots } from '../timeline.js';

const smooth = (t, a, b) => {
  const u = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return u * u * (3 - 2 * u);
};
/** 0→1→0: naik di [a, a+f], tahan, turun di [b−f, b]. */
const env = (t, a, b, f = 0.4) => smooth(t, a, a + f) * (1 - smooth(t, b - f, b));
/** Geser rotasi sendi menuju nilai mutlak sebesar k (0..1), menimpa pose. */
const mix = (joint, axis, target, k) => { joint.rotation[axis] += (target - joint.rotation[axis]) * k; };

/** Lengan kanan diulurkan ke depan (menyerahkan/menerima uang). */
const ulurKanan = (p, k) => {
  mix(p.shoulderR, 'x', -1.35, k);
  mix(p.shoulderR, 'z', -0.05, k);
  mix(p.elbowR, 'x', -0.2, k);
};

export default Object.freeze({
  id: 'drama-uang-kas',
  judul: 'Tanggal 1: Patroli Uang Kas',
  logline: 'Tanggal 1, bendahara ERC keliling sekre menagih kas. Ada yang jujur, ada yang beralasan, dan ada ketua yang mencoba kabur.',
  durasi: 80,
  fps: 30,
  jam: 16.5,
  goyang: 0.005,
  pemeran: {
    'npc-3': 'Bendahara. Tegas, sabar, selalu bawa buku kas.',
    'npc-1': 'Ketua. Jago ngeles, pura-pura sibuk ngoding.',
    'npc-9': 'Anak gitar. Alasannya selalu senar putus.',
    'npc-5': 'Anggota teladan. Bayar kas tepat waktu.',
  },
  adegan: [
    { dari: 0, judul: 'Sore yang damai', aksi: 'Hafizh genjreng gitar di karpet, Juan lesehan, Farkhan "ngoding" di laptop.' },
    { dari: 6, judul: 'Bendahara datang', aksi: 'Mutia masuk dari pintu sambil memeluk buku kas hijau.' },
    { dari: 14.6, judul: 'Yang jujur', aksi: 'Juan angkat tangan dengan santai; Hafizh pura-pura sibuk, buang muka.' },
    { dari: 21, judul: 'Alasan senar putus', aksi: 'Mutia berdiri di depan Hafizh. Gitar tetap digenjreng selama ia beralasan.' },
    { dari: 35.2, judul: 'Sang Ketua', aksi: 'Mutia berdiri di belakang Farkhan yang mengetik makin cepat.' },
    { dari: 54.6, judul: 'Mode kabur', aksi: 'Farkhan berdiri pelan, jalan mengendap ke pintu.' },
    { dari: 61, judul: 'Lunas', aksi: 'Mutia menghadang. Farkhan menyerahkan uang 50 ribu, Mutia mencatat.' },
    { dari: 70.5, judul: 'Pesan bendahara', aksi: 'Mutia menghadap kamera, mengangkat buku kas. Farkhan lesu di belakang.' },
  ],
  aktor: [
    {
      npc: 'npc-3', warna: '#81c784', di: [2.05, -4.3], hadap: 0, pose: 'berdiri',
      pegang: [
        { dari: 0, sampai: 80, benda: 'buku', tangan: 'L' },
        { dari: 33.4, sampai: 35.4, benda: 'uang10', tangan: 'R' },
        { dari: 65.0, sampai: 66.3, benda: 'uang50', tangan: 'R' },
      ],
      langkah: [
        { t: 6, jalan: [[2.05, -2.4], [1.1, -1.35]] },
        { t: 9.05, hadap: [-0.3, 0.7], durasi: 0.5 },
        { t: 21, jalan: [[-0.6, 0.0]] },
        { t: 23, hadap: [-1.49, 0.7], durasi: 0.5 },
        { t: 35.2, jalan: [[0.5, -0.3], [1.3, 0.25], [1.25, 1.8]] },
        { t: 38.6, hadap: [1.96, 1.2], durasi: 0.5 },
        { t: 59.2, jalan: [[1.5, -0.2]], kecepatan: 1.25 },
        { t: 60.9, hadap: [1.8, -1.0], durasi: 0.4 },
        { t: 70.5, hadap: [0.95, 1.45], durasi: 0.7 },
      ],
      gerak: (t, p) => {
        ulurKanan(p, env(t, 32.8, 34.6));
        ulurKanan(p, env(t, 64.4, 65.8));
        const tulis = env(t, 66.0, 68.6);
        mix(p.shoulderL, 'x', -0.95, tulis);
        mix(p.elbowL, 'x', -1.1, tulis);
        mix(p.shoulderR, 'x', -0.85, tulis);
        mix(p.elbowR, 'x', -1.45 + 0.12 * Math.sin(t * 9), tulis);
        const pamer = smooth(t, 71.2, 72.0);
        mix(p.shoulderL, 'x', -1.95, pamer);
        mix(p.elbowL, 'x', -0.55, pamer);
      },
    },
    {
      npc: 'npc-1', slot: 'laptop',
      langkah: [
        { t: 54.8, pose: 'berdiri' },
        { t: 55, jalan: [[1.35, 0.45], [1.8, -1.0]], kecepatan: 1.15 },
        { t: 57.9, hadap: [1.25, 1.8], durasi: 1.1 },
        { t: 61.0, hadap: [1.5, -0.2], durasi: 0.4 },
      ],
      pegang: [{ dari: 63.4, sampai: 65.0, benda: 'uang50', tangan: 'R' }],
      gerak: (t, p) => {
        p.headPivot.rotation.y += -1.1 * env(t, 47.8, 54.6, 1.0); // menoleh pelan ke Mutia di belakangnya
        ulurKanan(p, env(t, 63.6, 65.4));
        p.headPivot.rotation.x += 0.35 * smooth(t, 68.4, 69.4); // lesu sampai akhir
      },
    },
    {
      npc: 'npc-9', slot: 'rapat-4', pose: 'guitarStrum',
      pegang: [{ dari: 31.6, sampai: 33.4, benda: 'uang10', tangan: 'R' }],
      gerak: (t, p) => {
        p.headPivot.rotation.y += -0.8 * env(t, 14.6, 22.5, 0.6); // buang muka
        ulurKanan(p, env(t, 31.8, 34.2));
      },
    },
    {
      npc: 'npc-5', slot: 'rapat-2', pose: 'sitCrossLegged',
      gerak: (t, p) => {
        const angkat = env(t, 14.6, 18.4, 0.5);
        mix(p.shoulderR, 'x', -2.75, angkat);
        mix(p.elbowR, 'x', -0.25, angkat);
      },
    },
  ],
  kamera: shots([
    { dari: 0, sampai: 6, pos: [[-2.6, 2.9, 2.6], [-2.35, 2.6, 2.35]], target: [[0.3, 0.4, 0.2], [0.55, 0.5, 0.35]], fov: 62, ease: 'linear' },
    { dari: 6, sampai: 9.2, pos: [[0.3, 1.5, 0.3], [0.4, 1.45, 0.0]], target: [[2.0, 1.2, -2.8], [1.3, 1.1, -1.5]], fov: 55 },
    { dari: 9.2, sampai: 14.6, pos: [[0.0, 1.4, 0.35], [0.15, 1.38, 0.1]], target: [1.1, 1.15, -1.35], fov: 55 },
    { dari: 14.6, sampai: 18.2, pos: [[-0.45, 1.15, 0.85], [-0.35, 1.15, 0.85]], target: [0.875, 0.95, 0.6], fov: 58 },
    { dari: 18.2, sampai: 21, pos: [0.05, 1.4, 0.2], target: [1.1, 1.15, -1.35], fov: 52 },
    { dari: 21, sampai: 23.2, pos: [1.6, 1.8, 2.6], target: [[0.6, 0.7, -0.6], [-0.6, 0.8, 0.1]], fov: 58 },
    { dari: 23.2, sampai: 27.6, pos: [[-0.15, 1.05, 1.05], [-0.3, 1.05, 0.95]], target: [-1.49, 0.8, 0.7], fov: 55 },
    { dari: 27.6, sampai: 31.2, pos: [-2.05, 1.2, 1.0], target: [-0.6, 1.15, 0.0], fov: 50 },
    { dari: 31.2, sampai: 35.2, pos: [-1.05, 1.3, 2.45], target: [-1.05, 0.7, 0.35], fov: 62 },
    { dari: 35.2, sampai: 39, pos: [-1.8, 1.9, 2.5], target: [[0.2, 0.8, 0.0], [1.4, 0.9, 1.4]], fov: 60 },
    { dari: 39, sampai: 47.8, pos: [[1.6, 1.5, -0.75], [1.62, 1.45, -0.5]], target: [1.64, 0.95, 1.5], fov: 54 },
    { dari: 47.8, sampai: 54.6, pos: [[2.7, 1.4, 2.4], [2.68, 1.38, 2.3]], target: [1.96, 1.05, 1.25], fov: [48, 44] },
    { dari: 54.6, sampai: 57.9, pos: [2.7, 2.3, 2.7], target: [[1.6, 0.9, 0.6], [1.8, 0.9, -0.9]], fov: 62, ease: 'linear' },
    { dari: 57.9, sampai: 61, pos: [[2.25, 1.35, 0.35], [2.22, 1.3, 0.2]], target: [1.8, 1.2, -1.0], fov: 45 },
    { dari: 61, sampai: 70.5, pos: [[-0.6, 1.35, -0.6], [-0.4, 1.33, -0.62]], target: [1.65, 1.05, -0.6], fov: 56 },
    { dari: 70.5, sampai: 80, pos: [[0.95, 1.4, 1.45], [1.05, 1.35, 1.0]], target: [1.5, 1.15, -0.2], fov: 50, ease: 'out' },
  ]),
  teks: [
    { dari: 0.3, sampai: 5.7, gaya: 'judul', isi: 'TANGGAL 1', kecil: 'Hari paling horor buat yang nunggak kas 💸' },
    { dari: 9.3, sampai: 11.2, gaya: 'dialog', siapa: 'npc-3', isi: 'Assalamualaikum, guys!', arahan: 'ceria' },
    { dari: 11.4, sampai: 14.4, gaya: 'dialog', siapa: 'npc-3', isi: 'Yang belum bayar kas bulan ini… angkat tangan.', arahan: 'senyum, nada mengancam' },
    { dari: 15.0, sampai: 17.8, gaya: 'dialog', siapa: 'npc-5', isi: 'Aku udah transfer kemarin, Mut.', arahan: 'santai' },
    { dari: 18.3, sampai: 20.9, gaya: 'dialog', siapa: 'npc-3', isi: 'Sip, udah kucatat. Makasih, Juan!' },
    { dari: 23.6, sampai: 27.4, gaya: 'dialog', siapa: 'npc-9', isi: 'Mut… senar gitarku putus. Uangnya buat beli senar dulu.', arahan: 'tetap genjreng' },
    { dari: 27.7, sampai: 31.0, gaya: 'dialog', siapa: 'npc-3', isi: 'Senar 25 ribu bisa. Kas 10 ribu nggak bisa?', arahan: 'datar' },
    { dari: 31.3, sampai: 33.2, gaya: 'dialog', siapa: 'npc-9', isi: '…Iya, iya. Nih.', arahan: 'pasrah' },
    { dari: 36.0, sampai: 38.4, gaya: 'narasi', isi: 'Target terakhir: sang Ketua.' },
    { dari: 39.3, sampai: 40.8, gaya: 'dialog', siapa: 'npc-3', isi: 'Ketua…', arahan: 'pelan' },
    { dari: 41.0, sampai: 44.4, gaya: 'dialog', siapa: 'npc-1', isi: 'Bentar, Mut. Lagi fokus ngoding robot buat lomba.', arahan: 'tidak menoleh, ngetik makin cepat' },
    { dari: 44.7, sampai: 47.7, gaya: 'dialog', siapa: 'npc-3', isi: 'Dari tadi layarmu YouTube, Han.' },
    { dari: 49.2, sampai: 51.4, gaya: 'dialog', siapa: 'npc-1', isi: '…Nanti kutransfer ya.', arahan: 'menoleh pelan, senyum kecut' },
    { dari: 51.7, sampai: 54.4, gaya: 'dialog', siapa: 'npc-3', isi: 'Itu juga katamu bulan Juli.' },
    { dari: 55.0, sampai: 57.1, gaya: 'narasi', isi: 'mode kabur: ON 🏃' },
    { dari: 57.2, sampai: 58.9, gaya: 'dialog', siapa: 'npc-3', isi: 'FARKHAN!', teriak: true, arahan: 'teriak' },
    { dari: 61.6, sampai: 63.6, gaya: 'dialog', siapa: 'npc-1', isi: 'Iya… iya, Bu Bendahara.', arahan: 'lesu' },
    { dari: 65.6, sampai: 68.2, gaya: 'dialog', siapa: 'npc-3', isi: 'Lunas. Gitu dong, Ketua.', arahan: 'puas, sambil mencatat' },
    { dari: 68.5, sampai: 70.4, gaya: 'dialog', siapa: 'npc-1', isi: 'Dompetku nangis, Mut…', arahan: 'menunduk' },
    { dari: 71.4, sampai: 75.2, gaya: 'dialog', siapa: 'npc-3', isi: 'Kas lancar, proker jalan, robot pun gerak 🤖', arahan: 'ke kamera' },
    { dari: 75.5, sampai: 79.8, gaya: 'judul', isi: 'UDAH BAYAR KAS? 👀', kecil: 'Tag bendahara kalian 👇' },
  ],
});
