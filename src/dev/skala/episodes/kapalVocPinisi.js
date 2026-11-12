/**
 * Skala Nusantara Ep. 1: "Kapal VOC vs Pinisi" (58 detik, 9:16).
 *
 * Fakta & sumber (dicek 2026-11-03):
 * - Batavia: kapal VOC, dibangun 1628, panjang lambung ±45 m (replika Lelystad 56,5 m termasuk cucur), ±341 orang di
 *   kapal (awak + penumpang; museum WA menyebut 316), karam 1629 di Houtman Abrolhos pada pelayaran pertamanya.
 *   https://en.wikipedia.org/wiki/Batavia_(1628_ship) · https://www.batavialand.nl/en/?p=4482
 * - Pinisi: 2 tiang, 7 layar; panjang umumnya 20–35 m, muat hingga ±350 ton; dibuat di Tana Beru (Bulukumba) tanpa
 *   gambar kerja oleh panrita lopi; seni pembuatannya Warisan Budaya Takbenda UNESCO 7 Des 2017.
 *   https://ich.unesco.org/en/RL/pinisi-art-of-boatbuilding-in-south-sulawesi-01197
 * Bentuk kapal, tinggi tiang, dan susunan layar Batavia = gaya maket [INFERENSI].
 */
import { createBatavia, createPinisi } from '../kapal.js';
import { clipBelowSea, createCrowd, createPerson, floatShip } from '../diorama.js';
import { deckPoint } from '../hullMath.js';

const BATAVIA = { x: 0, z: -9 };
const PINISI = { x: -5, z: 9 }; // buritan sejajar dengan Batavia (x = −22,5) agar panjang mudah dibandingkan
const KARAM = 49.6;

export default Object.freeze({
  id: 'kapal-voc-pinisi',
  judul: 'Kapal VOC vs Pinisi',
  logline: 'Batavia, kapal dagang VOC 1628, berdampingan dengan Pinisi dari Sulawesi Selatan: panjang, muatan orang, tiang & layar, dan nasib keduanya.',
  durasi: 58,
  fps: 30,
  adegan: [
    { dari: 0, judul: 'Pembuka', aksi: 'Maket laut bundar; Batavia lalu Pinisi muncul memantul dari air. Kamera mengorbit pelan.' },
    { dari: 4.5, judul: 'Batavia', aksi: 'Kamera mendekat ke Batavia; penggaris kuning tumbuh di sisinya sampai 45 m.' },
    { dari: 11.5, judul: 'Pinisi', aksi: 'Kamera pindah ke Pinisi; penggaris hijau tumbuh sampai 35 m, buritan sejajar Batavia.' },
    { dari: 18.5, judul: 'Adu panjang', aksi: 'Pandangan atas: dua penggaris berdampingan, kartu perbandingan.' },
    { dari: 24.5, judul: 'Skala manusia', aksi: 'Zoom ke figur oranye 1,7 m di haluan Pinisi.' },
    { dari: 29.5, judul: '341 orang', aksi: 'Geladak Batavia dipenuhi figur biru satu per satu sampai 341.' },
    { dari: 37, judul: 'Tiang & layar', aksi: 'Pandangan rendah dari samping: 3 tiang Batavia vs 2 tiang & 7 layar Pinisi.' },
    { dari: 43.5, judul: 'Tanpa gambar kerja', aksi: 'Kamera mengitari Pinisi.' },
    { dari: 49.5, judul: 'Nasib', aksi: 'Batavia miring dan tenggelam ke dalam laut maket; Pinisi tetap berlayar.' },
    { dari: 55, judul: 'Penutup', aksi: 'Pandangan lebar, judul seri.' },
  ],
  kamera: {
    // azimut 0 = kamera di selatan (+Z) menghadap utara; elevasi derajat; tinggi = tinggi bidang pandang (m).
    target: [
      { t: 0, v: [-2, 17, 2] }, { t: 4.5, v: [-2, 14, 0] }, { t: 7, v: [0, 9, -9] }, { t: 11.5, v: [1, 9, -9] },
      { t: 14, v: [-4, 8, 9] }, { t: 18.5, v: [-4, 8, 9] }, { t: 20.5, v: [-1, 0, 2] }, { t: 24.5, v: [-1, 0, 2] },
      { t: 26.5, v: [7.4, 3.6, 9] }, { t: 29.5, v: [7.4, 3.6, 9] }, { t: 31.5, v: [0, 5, -9] }, { t: 37, v: [0, 5, -9] },
      { t: 39, v: [0, 9, 0] }, { t: 43.5, v: [0, 9, 0] }, { t: 45.5, v: [-5, 11, 9] }, { t: 49.5, v: [-5, 11, 9] },
      { t: 51, v: [-2, 8, -2] }, { t: 55, v: [-2, 8, -2] }, { t: 58, v: [-2, 8, 0] },
    ],
    azimut: [
      { t: 0, v: 20 }, { t: 4.5, v: 38 }, { t: 7, v: 30 }, { t: 11.5, v: 40 }, { t: 14, v: 50 }, { t: 18.5, v: 60 },
      { t: 20.5, v: 0 }, { t: 24.5, v: 6 }, { t: 26.5, v: 40 }, { t: 29.5, v: 50 }, { t: 31.5, v: 25 }, { t: 37, v: 35 },
      { t: 39, v: 38 }, { t: 43.5, v: 30 }, { t: 45.5, v: 110 }, { t: 49.5, v: 150 }, { t: 51, v: 150 },
      { t: 55, v: 175 }, { t: 58, v: 195 },
    ],
    elevasi: [
      { t: 0, v: 34 }, { t: 7, v: 26 }, { t: 14, v: 24 }, { t: 18.5, v: 26 }, { t: 20.5, v: 62 }, { t: 24.5, v: 60 },
      { t: 26.5, v: 30 }, { t: 29.5, v: 28 }, { t: 31.5, v: 42 }, { t: 37, v: 40 }, { t: 39, v: 8 }, { t: 43.5, v: 9 },
      { t: 45.5, v: 16 }, { t: 49.5, v: 20 }, { t: 51, v: 30 }, { t: 55, v: 30 }, { t: 58, v: 38 },
    ],
    tinggi: [
      { t: 0, v: 100 }, { t: 4.5, v: 96 }, { t: 7, v: 72 }, { t: 11.5, v: 70 }, { t: 14, v: 58 }, { t: 18.5, v: 56 },
      { t: 20.5, v: 98 }, { t: 24.5, v: 96 }, { t: 26.5, v: 11 }, { t: 29.5, v: 10 }, { t: 31.5, v: 36 }, { t: 37, v: 34 },
      { t: 39, v: 104 }, { t: 43.5, v: 100 }, { t: 45.5, v: 56 }, { t: 49.5, v: 52 }, { t: 51, v: 92 }, { t: 55, v: 94 },
      { t: 58, v: 108 },
    ],
  },
  ukur: [
    { id: 'u-batavia', a: [-22.5, 1.4, -2.6], b: [22.5, 1.4, -2.6], dari: 6, tumbuh: 2.5, sampai: 29.5, nilai: 45, warna: '#f2b705' },
    { id: 'u-pinisi', a: [-22.5, 1.4, 14], b: [12.5, 1.4, 14], dari: 13, tumbuh: 2.2, sampai: 29.5, nilai: 35, warna: '#7bd389' },
  ],
  label: [
    { dari: 5, sampai: 11.5, di: 'batavia', offset: [0, 30, 0], isi: 'BATAVIA · VOC 1628', warna: '#c9962e' },
    { dari: 12.5, sampai: 18.5, di: 'pinisi', offset: [0, 24, 0], isi: 'PINISI · Sulawesi Selatan', warna: '#7bd389' },
    { dari: 26, sampai: 29.5, di: 'orang', offset: [0, 2.3, 0], isi: '1,7 m', warna: '#ff6d1f' },
    { dari: 31.5, sampai: 37, di: 'batavia', offset: [0, 14, 0], isi: (t) => `${Math.round(Math.min(1, Math.max(0, (t - 31.5) / 3.5)) * 341)} orang`, warna: '#20324f' },
  ],
  teks: [
    { dari: 0.4, sampai: 4.4, gaya: 'judul', isi: 'KAPAL VOC<br>vs PINISI', kecil: 'Skala Nusantara · Ep. 1' },
    { dari: 4.8, sampai: 8.4, gaya: 'sub', isi: 'Batavia: kapal dagang VOC, dibangun tahun 1628.' },
    { dari: 8.5, sampai: 11.4, gaya: 'narasi', isi: 'Namanya diambil dari kota Batavia, Jakarta hari ini.' },
    { dari: 11.8, sampai: 15.2, gaya: 'sub', isi: 'Pinisi: kapal layar kayu dari Sulawesi Selatan.' },
    { dari: 15.3, sampai: 18.4, gaya: 'narasi', isi: 'Pinisi besar sampai ±35 m. Banyak juga yang 20-an meter.' },
    { dari: 20, sampai: 24.4, gaya: 'banding', isi: 'Panjang lambung', kiri: '±45 m', kanan: '20–35 m' },
    { dari: 25, sampai: 29.4, gaya: 'sub', isi: 'Titik oranye itu? Manusia setinggi 1,7 m.' },
    { dari: 30, sampai: 33.8, gaya: 'sub', isi: 'Batavia membawa sekitar 341 orang: awak kapal, tentara, penumpang.' },
    { dari: 33.9, sampai: 36.9, gaya: 'narasi', isi: 'Berbulan-bulan di laut, sesak di geladak seluas ini.' },
    { dari: 38, sampai: 43.4, gaya: 'banding', isi: 'Tiang layar', kiri: '3 tiang', kanan: '2 tiang · 7 layar' },
    { dari: 43.8, sampai: 49.4, gaya: 'sub', isi: 'Pinisi dibuat <em>tanpa gambar kerja</em>, oleh panrita lopi di Tana Beru, Bulukumba.' },
    { dari: 50, sampai: 53, gaya: 'narasi', isi: 'Batavia karam di pelayaran pertamanya, 1629.' },
    { dari: 53.1, sampai: 57.8, gaya: 'sub', isi: 'Seni membuat Pinisi? Warisan Budaya Takbenda UNESCO 2017, dan masih dibuat sampai hari ini.' },
  ],

  /** Isi panggung. ctx = { scene, seaY }. Mengembalikan objek bernama (anchor label) + update(t). */
  build({ scene, seaY }) {
    const batavia = createBatavia();
    const pinisi = createPinisi();
    scene.add(batavia, pinisi);
    const orang = createPerson();
    orang.position.set(...deckPoint(0.82, 0, pinisi.userData.hull));
    pinisi.add(orang);
    const crowd = createCrowd(batavia, 341);
    clipBelowSea(batavia);
    clipBelowSea(pinisi);
    return {
      objects: { batavia, pinisi, orang },
      update(t) {
        floatShip(batavia, { ...BATAVIA, muncul: 0.6, seaY, t, tenggelam: KARAM });
        floatShip(pinisi, { ...PINISI, muncul: 1.4, seaY, t });
        crowd.show(t < KARAM ? (t - 31.5) / 3.5 : 0);
      },
    };
  },
});
