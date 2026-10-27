/**
 * Probe kinerja `?perf` (rencana performa Fase 0). Dimulai paling awal di main() agar long task saat muat ikut tercatat;
 * sesudah layar muat selesai `attach` memasang sistem sampel frame (jendela 30 detik) + overlay dengan tombol
 * "Salin laporan" → JSON yang bisa dikirim teman yang laptopnya berat. Tanpa `?perf` modul ini tidak dimuat sama sekali.
 */
import {
  createFrameWindow, summarizeFrames, guessBottleneck, summarizeLongTasks, loadPhases,
} from '../engine/perfStats.js';
import { createPerfOverlay } from '../ui/PerfOverlay.js';
import { readGpuName } from './quality.js';
import { session } from './session.js';

const MAX_LONG_TASKS = 2000;
const REFRESH_SEC = 1;
const MAX_FRAME_MS = 5000; // frame pertama sesudah tab disembunyikan: bukan beban render, jangan dijadikan sampel
const BOTTLENECK_LABEL = Object.freeze({
  lancar: 'lancar (dibatasi vsync/batas FPS)', tersendat: 'rata-rata cukup, sering tersendat (lihat long task)', cpu: 'CPU (JS/draw call)', gpu: 'GPU (piksel/bayangan/efek)', campuran: 'campuran',
});

const round = (x, d = 1) => (Number.isFinite(x) ? Math.round(x * 10 ** d) / 10 ** d : null);
const n = (x) => (x == null ? '-' : String(x));
/**
 * Nama GPU ringkas untuk overlay: "ANGLE (NVIDIA, NVIDIA GeForce RTX 3050 Laptop GPU (0x000025A2) Direct3D11 …, D3D11)"
 * → "NVIDIA GeForce RTX 3050 Laptop GPU"; "ANGLE (Apple, ANGLE Metal Renderer: Apple M1, …)" → "Apple M1".
 */
const shortGpu = (s) => {
  const angle = /^ANGLE \((.*)\)$/.exec(s ?? '');
  const device = angle ? (angle[1].split(', ')[1] ?? angle[1]) : String(s ?? '?');
  return device.replace(/^ANGLE \w+ Renderer: /, '').replace(/\s*\(0x[0-9a-f]+\).*$/i, '')
    .replace(/\s+(Direct3D|OpenGL|Vulkan).*$/i, '').slice(0, 44);
};

/** Long task dari PerformanceObserver; null bila browser tidak mendukung (Firefox/Safari). */
function observeLongTasks() {
  const entries = [];
  try {
    const observer = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (entries.length < MAX_LONG_TASKS) entries.push({ startTime: e.startTime, duration: e.duration });
    });
    observer.observe({ type: 'longtask', buffered: true });
    return { entries, dispose: () => observer.disconnect() };
  } catch {
    return null;
  }
}

/** @returns {{attach(opts:object):void, dispose():void}} */
export function startPerfProbe() {
  const longTasks = observeLongTasks();
  let detach = () => {};

  /**
   * @param {{app:object, store:{get(k:string):unknown}, quality?:{tier:string}|null,
   *   where?:() => object|null}} opts where = posisi pemain untuk laporan
   */
  const attach = ({ app, store, quality = null, where = () => null }) => {
    const frames = createFrameWindow();
    const gpu = readGpuName(app.renderer);
    let startedAt = null;
    let acc = REFRESH_SEC;

    const targetMs = () => {
      const cap = Number(store.get('performance.fpsCap'));
      return Number.isFinite(cap) && cap > 0 ? 1000 / cap : 1000 / 60;
    };
    const report = () => {
      const frame = summarizeFrames(frames.frames(), frames.cpu(), targetMs());
      const muat = loadPhases(performance.getEntriesByType('mark'));
      const nav = performance.getEntriesByType('navigation')[0];
      const { render, memory, programs } = app.renderer.info;
      return {
        versi: 1,
        dibuat: new Date().toISOString(),
        halaman: `${location.origin}${location.pathname}`,
        perangkat: {
          gpu,
          cpuInti: navigator.hardwareConcurrency ?? null,
          memoriGB: navigator.deviceMemory ?? null,
          layar: `${window.innerWidth}x${window.innerHeight}`,
          dpr: window.devicePixelRatio,
          rasioRender: round(app.renderer.getPixelRatio(), 2),
          sentuh: window.matchMedia?.('(pointer: coarse)').matches ?? false,
          ua: navigator.userAgent,
        },
        kualitas: {
          preset: store.get('graphics.preset'), tier: quality?.tier ?? null, batasFps: store.get('performance.fpsCap'),
          resolusiAdaptif: store.get('graphics.adaptiveResolution'),
        },
        posisi: where(),
        frame,
        dugaan: guessBottleneck(frame, targetMs()),
        render: {
          drawCall: render.calls, segitiga: render.triangles, geometri: memory.geometries, tekstur: memory.textures,
          program: programs?.length ?? null,
        },
        memoriJsMB: performance.memory ? round(performance.memory.usedJSHeapSize / 2 ** 20, 0) : null,
        longTask: longTasks ? summarizeLongTasks(longTasks.entries, (muat.siapS ?? Infinity) * 1000) : null,
        muat: { htmlSiapS: nav ? round(nav.domContentLoadedEventEnd / 1000, 2) : null, ...muat, mulaiMainS: startedAt },
      };
    };
    const lines = (r) => {
      const f = r.frame ?? {};
      const lt = r.longTask;
      return [
        `GPU ${shortGpu(gpu)}`,
        `${n(f.fps)} fps · p95 ${n(f.p95Ms)} · p99 ${n(f.p99Ms)} ms (${n(f.detik)} s)`,
        `frame p50 ${n(f.p50Ms)} · CPU p50 ${n(f.cpuP50Ms)} ms · tersendat ${n(f.persenTersendat)}%`,
        `dugaan: ${BOTTLENECK_LABEL[r.dugaan] ?? '-'}`,
        `draw ${r.render.drawCall} · segitiga ${(r.render.segitiga / 1000).toFixed(0)}k · tekstur ${r.render.tekstur}`,
        lt ? `long task main ${lt.saatMain.jumlah} (maks ${lt.saatMain.maksMs} ms) · muat ${lt.saatMuat.jumlah}` : 'long task: tidak didukung browser',
        `siap main ${n(r.muat.siapS)} s · preset ${n(r.kualitas.preset)} · rasio ${r.perangkat.rasioRender}`,
      ];
    };

    const copy = async () => {
      const text = JSON.stringify(report(), null, 1);
      try {
        await navigator.clipboard.writeText(text);
        overlay.flash('tersalin ✓ tempel ke chat');
      } catch {
        overlay.showText(text); // clipboard ditolak (bukan https / izin): salin manual
        overlay.flash('salin manual: Ctrl+C');
      }
    };
    const overlay = createPerfOverlay({ onCopy: () => { copy(); } });

    app.addSystem({
      id: 'perf.probe',
      phase: 'ui',
      update: (dt, ctx) => {
        const raw = ctx?.rawDt ?? dt;
        if (startedAt == null && session.started) startedAt = round(performance.now() / 1000, 2);
        if (!app.holdRender && !document.hidden && raw * 1000 < MAX_FRAME_MS) frames.push(raw * 1000, app.cpuMs);
        acc += raw;
        if (acc < REFRESH_SEC) return;
        acc = 0;
        overlay.setLines(lines(report()));
      },
    });
    detach = () => {
      app.removeSystem('perf.probe');
      overlay.dispose();
    };
  };

  return {
    attach,
    dispose() {
      detach();
      longTasks?.dispose();
    },
  };
}
