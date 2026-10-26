/**
 * Preset kualitas + deteksi otomatis (rencana performa Fase 1).
 * - graphics.preset rendah/sedang/tinggi → tulis QUALITY_PRESETS ke setelan yang sudah ada (binding lama menerapkannya);
 *   'otomatis' → preset tier hasil deteksi; mengubah kunci preset secara manual → preset 'kustom'.
 * - Deteksi: tebakan dari nama GPU (WEBGL_debug_renderer_info), lalu uji kinerja setelah render dimulai: 3 detik pemanasan +
 *   5 detik sampel waktu frame; p95 melebihi anggaran → turun satu tier (maks 2 putaran). Hasil disimpan per nama GPU
 *   (localStorage) sehingga uji tidak diulang tiap muat; ganti GPU / pilih Otomatis lagi = uji ulang.
 */
import { QUALITY_PRESETS, PRESET_KEYS } from '../config/quality.js';
import { guessTierFromGpu, percentile, tierAfterBenchmark } from '../engine/qualityTier.js';

const STORAGE_KEY = 'sur3d.quality.v1';
const WARMUP_SEC = 3;
const SAMPLE_SEC = 5;
const MAX_ROUNDS = 2;
const LABEL = Object.freeze({ rendah: 'Rendah', sedang: 'Sedang', tinggi: 'Tinggi' });

/** Nama GPU dari konteks WebGL (null bila disembunyikan browser). */
export function readGpuName(renderer) {
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '') || null;
  } catch {
    return null;
  }
}

function loadSaved() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    return data && typeof data.tier === 'string' && QUALITY_PRESETS[data.tier] ? data : null;
  } catch {
    return null;
  }
}

function save(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* tanpa simpan: uji diulang kunjungan berikutnya */ }
}

/**
 * @param {{app:{renderer:object, holdRender:boolean, addSystem:Function, removeSystem:Function},
 *   store:{get(k:string):unknown, set(k:string, v:unknown):boolean, bind:Function, subscribe:Function},
 *   hud:{toast(t:string, ok?:boolean):void}, touch?:boolean}} opts
 * @returns {{readonly tier:string, readonly gpu:string|null, dispose():void}}
 */
export function setupQuality({ app, store, hud, touch = false }) {
  const gpu = readGpuName(app.renderer);
  const saved = loadSaved();
  const known = saved?.gpu === gpu;
  let tier = known ? saved.tier : guessTierFromGpu(gpu, { mobile: touch });
  let bench = null; // {t, samples, round} selama uji berjalan
  let applying = false;

  const applyValues = (values) => {
    applying = true; // perubahan dari preset sendiri tidak menjadikan preset 'kustom'
    try {
      for (const [key, value] of Object.entries(values)) store.set(key, value);
    } finally {
      applying = false;
    }
  };
  const applyTier = () => applyValues(QUALITY_PRESETS[tier]);
  const startBench = (round = 0) => { bench = { t: 0, samples: [], round }; };

  const unsubs = [
    store.bind('graphics.preset', (preset, prev) => {
      if (preset === 'kustom') return;
      if (preset !== 'otomatis') {
        bench = null;
        applyValues(QUALITY_PRESETS[preset]);
        return;
      }
      applyTier();
      if (!known || prev !== undefined) startBench(); // pertama kali di GPU ini, atau pemain memilih Otomatis lagi
    }),
    store.subscribe('*', (value, prev, key) => {
      if (applying || !PRESET_KEYS.includes(key) || store.get('graphics.preset') === 'kustom') return;
      bench = null;
      store.set('graphics.preset', 'kustom');
    }),
  ];
  if (!known) save({ gpu, tier, benched: false });

  app.addSystem({
    id: 'quality.bench',
    phase: 'ui',
    update: (dt, ctx) => {
      if (!bench || app.holdRender || (typeof document !== 'undefined' && document.hidden)) return;
      const raw = ctx?.rawDt ?? dt;
      bench.t += raw;
      if (bench.t < WARMUP_SEC) return;
      bench.samples.push(raw * 1000);
      if (bench.t < WARMUP_SEC + SAMPLE_SEC) return;
      const p95 = percentile(bench.samples, 0.95);
      const next = tierAfterBenchmark(tier, p95);
      const round = bench.round;
      bench = null;
      if (next !== tier) {
        tier = next;
        applyTier();
        hud.toast(`Kualitas otomatis: ${LABEL[tier]} (perangkat berat) — ubah di Pengaturan › Grafik`, true);
        if (round + 1 < MAX_ROUNDS && tier !== 'rendah') startBench(round + 1);
      }
      if (!bench) save({ gpu, tier, benched: true, p95: Math.round(p95) });
    },
  });

  return {
    get tier() { return tier; },
    get gpu() { return gpu; },
    dispose() {
      for (const u of unsubs) u();
      app.removeSystem('quality.bench');
    },
  };
}
