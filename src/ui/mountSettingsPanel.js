/**
 * mountSettingsPanel: memuat pustaka panel (Panel.js + buildPanel.js + css)
 * secara dinamis dan menghubungkannya ke store. Bila modul gagal dimuat atau
 * melempar saat dibangun, aplikasi tetap berjalan tanpa panel (binding
 * store -> scene tidak bergantung pada panel).
 */
import { captureScreenshot } from './Screenshot.js';
import { EXIT_KEY, POVS } from '../core/cameraPresets.js';

const SIM_HELP_ITEMS = Object.freeze([
  { group: 'Sepeda' },
  { keys: ['W', 'S'], text: 'Kayuh / rem' },
  { keys: ['A', 'D'], text: 'Belok kiri / kanan' },
  { keys: ['Shift'], text: 'Sprint' },
  { keys: ['Space'], text: 'Bel' },
  { keys: ['F'], text: 'Ganti mode: jalan kaki / sepeda / traktor' },
  { group: 'Dunia' },
  { keys: ['E'], text: 'Beli dari pedagang' },
  { keys: ['V'], text: 'Ganti kamera / keluar dari POV' },
  { keys: ['C'], text: 'Kamera 3/4 dari atas (nyala/mati)' },
  { keys: ['Q', 'Z'], text: 'Putar kamera 3/4 (atau drag mouse; roda = zoom)' },
  { keys: ['L'], text: 'Gaya grafis: asli / kartun / facet' },
  { keys: ['J'], text: 'Jurnal cerita & misi' },
  { group: 'Sudut pandang (POV)' },
  { keys: ['1'], text: 'Udara' },
  { keys: ['2'], text: 'Tribun' },
  { keys: ['3'], text: 'Bola' },
  { keys: ['4'], text: 'Pelari (tekan lagi: pelari berikutnya)' },
  { keys: ['5'], text: 'Pedagang (tekan lagi: pedagang berikutnya)' },
  { keys: ['6'], text: 'Orbit sinematik' },
  { keys: ['7'], text: 'Top-down (sepeda tetap bisa dikendalikan)' },
  { keys: ['0'], text: 'Kembali ke sepeda' },
  { keys: ['Mouse', 'Roda'], text: 'Orbit & zoom saat POV' },
  { keys: ['M'], text: 'Minimap' },
  { keys: ['N'], text: 'Preset waktu berikutnya' },
  { keys: ['T'], text: 'Jalankan / hentikan jam' },
  { keys: ['[', ']'], text: 'Mundur / maju 1 jam' },
  { keys: ['R'], text: 'Hujan / cerah' },
  { keys: ['O'], text: 'Ambient occlusion' },
  { group: 'Kebun (barat Jl. Prof. Aras Mulyadi, dekat sekre)' },
  { keys: ['I'], text: 'Buka / tutup tas (klik item lalu klik slot tujuan untuk memindah)' },
  { keys: ['1–9', 'Roda'], text: 'Pilih slot hotbar (saat jalan kaki)' },
  { keys: ['E'], text: 'Di depan petak: pakai item di tangan (cangkul / benih / gembor), panen dengan apa saja' },
  { keys: ['E', 'B'], text: 'Kotak benih (peti hijau): beli 1 benih · B ganti jenis' },
  { keys: ['E'], text: 'Kotak kiriman (peti merah): kirim hasil panen yang dipegang · pintu rumah: tidur, kiriman dibayar' },
  { keys: ['F'], text: 'Traktor: lewati petak rumput untuk membajak' },
  { group: 'Sekre (interior)' },
  { keys: ['E'], text: 'Di depan pintu sekre: masuk · di dalam: pakai barang yang dilihat' },
  { keys: ['W', 'A', 'S', 'D'], text: 'Jalan kaki (A/D geser)' },
  { keys: ['Shift'], text: 'Lari' },
  { keys: ['Mouse'], text: 'Melihat sekeliling' },
  { keys: ['V'], text: 'Orang pertama / orang ketiga' },
  { keys: ['P'], text: 'Mode foto: 1–4 preset (lesehan, pintu, pojok, atas), W/A/S/D + Q/E kamera bebas' },
  { keys: ['Esc'], text: 'Keluar sekre (atau tutup kartu info)' },
]);

/** Muat modul panel + css; null bila salah satu gagal. */
async function loadPanelModules() {
  try {
    const [panelMod, buildMod, todMod] = await Promise.all([
      import('./Panel.js'), import('./buildPanel.js'), import('./controls/TimeOfDay.js'),
      import('./theme.css'), import('./panel.css'), import('./controls.css'), import('./time-of-day.css'),
    ]);
    return { panelMod, buildMod, todMod };
  } catch {
    return null;
  }
}

/** Statistik renderer live untuk tab Performa (Info di-refresh panel tiap 250 ms). */
function perfInfos({ app, hud }) {
  const info = () => app.renderer.info.render;
  return [
    { label: 'FPS', get: () => hud?.fpsText ?? '-' },
    { label: 'Waktu frame', get: () => `${(hud?.frameMs ?? 0).toFixed(1)} ms` },
    { label: 'Draw call', get: () => String(info().calls) },
    { label: 'Segitiga', get: () => info().triangles.toLocaleString('id-ID') },
  ];
}

/** Adapter: TimeOfDayControl butuh { store, key }; Container.addCustom hanya memberi { key, field }. */
function adaptTimeOfDay(Ctor) {
  if (typeof Ctor !== 'function') return undefined;
  return class TimeOfDayAdapter extends Ctor {
    constructor(container, opts = {}) {
      super(container, { store: container.store, ...opts });
    }
  };
}

/** Tombol POV di tab Kamera (selain hotkey 1-7). */
function addPovFolder(tabs, rig, hud) {
  const tab = tabs?.camera;
  if (!tab?.addFolder || !rig?.handlePovKey) return;
  const folder = tab.addFolder('Sudut pandang', { id: 'camera.pov', icon: 'camera' });
  const go = (code) => {
    const msg = rig.handlePovKey(code);
    if (msg) hud?.toast?.(msg, true);
    else if (code !== EXIT_KEY) hud?.toast?.('POV belum tersedia', false);
  };
  for (const def of POVS) {
    folder.addButton({ label: `${def.key.replace('Digit', '')} · ${def.label}`, icon: 'viewfinder', onClick: () => go(def.key) });
  }
  folder.addButton({ label: '0 · Kembali ke sepeda', icon: 'reset', onClick: () => go(EXIT_KEY) });
}

function addPerfFolder(tabs, infos) {
  const tab = tabs?.performance;
  if (!tab?.addFolder) return;
  const folder = tab.addFolder('Info live', { id: 'performance.live', icon: 'gauge' });
  for (const info of infos) folder.addInfo(info);
}

/**
 * @param {{ store: object, app: object, rig?: object, hud?: object }} ctx
 * @returns {Promise<{ panel: object|null, dispose(): void }>}
 */
export async function mountSettingsPanel({ store, app, rig = null, hud = null, onPanelToggle = null }) {
  const noop = { panel: null, dispose() {} };
  const mods = await loadPanelModules();
  if (!mods) return noop;
  const { SettingsPanel, DEFAULT_HELP_ITEMS = [] } = mods.panelMod;
  const { buildSettingsPanel } = mods.buildMod;
  if (typeof SettingsPanel !== 'function' || typeof buildSettingsPanel !== 'function') return noop;

  let panel = null;
  try {
    panel = new SettingsPanel({
      store,
      helpItems: [...DEFAULT_HELP_ITEMS, ...SIM_HELP_ITEMS],
      hooks: {
        onScreenshot: () => captureScreenshot(app),
        onPanelToggle: (open) => { if (open) document.exitPointerLock?.(); onPanelToggle?.(open); },
      },
    });
    buildSettingsPanel({
      store,
      panel,
      extras: {
        timeOfDayCtor: adaptTimeOfDay(mods.todMod?.TimeOfDayControl),
        afterBuild: (tabs) => {
          addPerfFolder(tabs, perfInfos({ app, hud }));
          addPovFolder(tabs, rig, hud);
        },
      },
    });
  } catch {
    panel?.dispose?.();
    return noop; // panel rusak: lanjut tanpa UI pengaturan
  }

  const onCanvasClick = () => {
    if (!panel.isPointerOverUI && !hud?.shopOpen) rig?.requestLock?.();
  };
  app.renderer.domElement.addEventListener('click', onCanvasClick);
  return {
    panel,
    dispose() {
      app.renderer.domElement.removeEventListener('click', onCanvasClick);
      panel.dispose?.();
    },
  };
}
