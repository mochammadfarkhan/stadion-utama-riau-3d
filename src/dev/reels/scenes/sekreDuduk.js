/**
 * Reels contoh 20 detik: sore di sekre ERC (D5). Tiga shot (lebar → samping → depan) dengan potongan `step`,
 * Farkhan mengetik di laptop lalu menoleh ke kamera. Teks = CONTOH [INFERENSI], ganti sesuai naskah.
 *
 * Bentuk scene (dipakai src/dev/reelsStudio.js):
 *   durasi (s), fps, jam (cahaya sekre), aktor[{npc, slot, pose?, x?, z?, yaw?, gerak?(t, parts)}],
 *   kamera {pos, target, fov} = daftar keyframe (lihat reels/timeline.js), goyang (m, efek kamera tangan),
 *   teks[{dari, sampai, gaya:'judul'|'sub', isi, kecil?}]
 * Koordinat ruang sekre (m): +X timur, +Z selatan; slot laptop ±(1,96; 1,2) menghadap timur.
 */
const smooth = (t, a, b) => {
  const u = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

export default Object.freeze({
  id: 'sekre-duduk',
  judul: 'Sore di sekre ERC',
  durasi: 20,
  fps: 30,
  jam: 16.5,
  goyang: 0.006,
  aktor: [
    {
      npc: 'npc-1', slot: 'laptop',
      // 13,5–15 s menoleh ke kamera, tahan, lalu kembali ke layar di 18 s.
      gerak: (t, p) => {
        const toleh = smooth(t, 13.5, 14.6) * (1 - smooth(t, 17.6, 18.6));
        p.headPivot.rotation.y += -0.75 * toleh;
        p.headPivot.rotation.x -= 0.18 * toleh;
      },
    },
    { npc: 'npc-9', slot: 'rapat-4', pose: 'guitarStrum' },
    { npc: 'npc-3', slot: 'rapat-1' },
  ],
  kamera: {
    pos: [
      { t: 0, v: [-2.6, 2.9, 2.6] },
      { t: 5.99, v: [-2.35, 2.6, 2.35], ease: 'linear' },
      { t: 6, v: [0.9, 1.3, 2.7], ease: 'step' },
      { t: 11.99, v: [1.35, 1.2, 2.25], ease: 'linear' },
      { t: 12, v: [2.72, 1.45, 2.55], ease: 'step' },
      { t: 20, v: [2.68, 1.38, 2.3], ease: 'out' },
    ],
    target: [
      { t: 0, v: [0.3, 0.4, 0.2] },
      { t: 5.99, v: [0.55, 0.5, 0.35], ease: 'linear' },
      { t: 6, v: [2.0, 0.95, 1.2], ease: 'step' },
      { t: 12, v: [1.96, 1.0, 1.2], ease: 'step' },
    ],
    fov: [
      { t: 0, v: 62 },
      { t: 6, v: 55, ease: 'step' },
      { t: 12, v: 52, ease: 'step' },
      { t: 20, v: 48, ease: 'out' },
    ],
  },
  teks: [
    { dari: 0.3, sampai: 5.7, gaya: 'judul', isi: 'SEKRE ERC', kecil: 'Ruang D5 · Gedung UKM UNRI' },
    { dari: 6.2, sampai: 11.7, gaya: 'sub', isi: 'Tiap sore, anggota ngoding & ngerakit robot di sini' },
    { dari: 12.4, sampai: 19.7, gaya: 'sub', isi: 'Mau tahu cara kami bikin robot pertama? 👇' },
  ],
});
