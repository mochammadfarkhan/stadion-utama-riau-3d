/**
 * mountSettingsPanel: memuat pustaka panel (Panel.js + buildPanel.js + css)
 * secara dinamis dan menghubungkannya ke store. Bila modul gagal dimuat atau
 * melempar saat dibangun, aplikasi tetap berjalan tanpa panel (binding
 * store -> scene tidak bergantung pada panel).
 */
import { captureScreenshot } from './Screenshot.js';

const SIM_HELP_ITEMS = Object.freeze([
  { group: 'Sepeda' },
  { keys: ['W', 'S'], text: 'Kayuh / rem' },
  { keys: ['A', 'D'], text: 'Belok kiri / kanan' },
  { keys: ['Shift'], text: 'Sprint' },
  { keys: ['Space'], text: 'Bel' },
  { group: 'Dunia' },
  { keys: ['E'], text: 'Beli dari pedagang' },
  { keys: ['V'], text: 'Ganti kamera' },
  { keys: ['M'], text: 'Minimap' },
  { keys: ['N'], text: 'Preset waktu berikutnya' },
  { keys: ['T'], text: 'Jalankan / hentikan jam' },
  { keys: ['[', ']'], text: 'Mundur / maju 1 jam' },
  { keys: ['R'], text: 'Hujan / cerah' },
  { keys: ['O'], text: 'Ambient occlusion' },
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
export async function mountSettingsPanel({ store, app, rig = null, hud = null }) {
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
        onPanelToggle: (open) => { if (open) document.exitPointerLock?.(); },
      },
    });
    buildSettingsPanel({
      store,
      panel,
      extras: {
        timeOfDayCtor: adaptTimeOfDay(mods.todMod?.TimeOfDayControl),
        afterBuild: (tabs) => addPerfFolder(tabs, perfInfos({ app, hud })),
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
