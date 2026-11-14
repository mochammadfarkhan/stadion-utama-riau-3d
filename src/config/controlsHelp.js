/**
 * Satu sumber daftar kontrol (panel bantuan F1 + menu utama). Data murni.
 * Tiap tombol harus ada di kode (tests/controlsHelp.test.js memeriksa berkas sumbernya).
 * menu: true = ikut ringkasan menu utama.
 */
export const CONTROL_HELP = Object.freeze([
  { group: 'Bergerak' },
  { keys: ['W', 'S'], text: 'Kayuh / rem (jalan kaki: maju / mundur)', menu: true },
  { keys: ['A', 'D'], text: 'Belok kiri / kanan', menu: true },
  { keys: ['Shift'], text: 'Sprint / lari', menu: true },
  { keys: ['Space'], text: 'Bel sepeda' },
  { keys: ['F'], text: 'Ganti mode: jalan kaki / sepeda / traktor', menu: true },
  { keys: ['E'], text: 'Bicara, beli, masuk pintu, pakai barang', menu: true },
  { keys: ['G'], text: 'Perjalanan cepat', menu: true },
  { keys: ['J'], text: 'Jurnal cerita & misi', menu: true },
  { keys: ['M'], text: 'Minimap' },
  { keys: ['Esc'], text: 'Tutup jurnal / toko / menu, keluar sekre' },
  { group: 'Kamera' },
  { keys: ['V'], text: 'Orang pertama / ketiga, atau keluar dari POV', menu: true },
  { keys: ['C'], text: 'Kamera 3/4 dari atas (nyala/mati)' },
  { keys: ['Q', 'Z'], text: 'Putar kamera 3/4 (atau seret mouse; roda = zoom)' },
  { keys: ['1–8'], text: 'Sudut pandang (saat bersepeda): udara, tribun, bola, pelari, pedagang, orbit, atas, region', menu: true },
  { keys: ['K'], text: 'Pratinjau kota isometrik' },
  { keys: ['0'], text: 'Kembali ke pemain' },
  { group: 'Waktu & grafis' },
  { keys: ['N'], text: 'Preset waktu berikutnya', menu: true },
  { keys: ['T'], text: 'Jalankan / hentikan jam' },
  { keys: ['[', ']'], text: 'Mundur / maju 1 jam' },
  { keys: ['R'], text: 'Hujan / cerah', menu: true },
  { keys: ['L'], text: 'Gaya grafis: asli / kartun / facet' },
  { keys: ['O'], text: 'Ambient occlusion' },
  { keys: ['H'], text: 'Panel pengaturan', menu: true },
  { keys: ['P'], text: 'Mode foto' },
  { keys: ['F1'], text: 'Bantuan' },
  { group: 'Kebun & tas (saat jalan kaki)' },
  { keys: ['I'], text: 'Buka / tutup tas', menu: true },
  { keys: ['1–9'], text: 'Pilih slot hotbar (roda juga bisa)' },
  { keys: ['B'], text: 'Kotak benih: ganti jenis benih' },
]);

/** Ringkasan menu utama: ponsel dan gamepad tidak punya tombol keyboard. */
export const CONTROL_HELP_EXTRA = Object.freeze([
  'Ponsel: joystick kiri bergerak, geser layar melihat, tombol di kanan',
  'Gamepad: stik kiri bergerak, stik kanan melihat, A bel, X interaksi, RT lari, Start jurnal',
]);
