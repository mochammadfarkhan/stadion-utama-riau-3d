/**
 * Layar muat: bilah progres + keterangan tahap di panel intro (#overlay). Tombol
 * mulai dinonaktifkan sampai semua aset siap. `step` menunggu browser sempat
 * menggambar, karena pembuatan dunia memblokir thread utama cukup lama.
 */
const PAINT_FRAMES = 2;
const HIDDEN_TAB_FALLBACK_MS = 60; // rAF tidak jalan di tab latar; jangan menahan pemuatan

function nextPaint() {
  return new Promise((resolve) => {
    let n = PAINT_FRAMES;
    const timer = setTimeout(resolve, HIDDEN_TAB_FALLBACK_MS * PAINT_FRAMES);
    const tick = () => {
      if (--n > 0) return requestAnimationFrame(tick);
      clearTimeout(timer);
      return resolve();
    };
    requestAnimationFrame(tick);
  });
}

/** @returns {{ step(progress:number, label:string): Promise<void>, done(): void }} */
export function createLoadingScreen(root = document) {
  const box = root.getElementById('loading');
  const fill = root.getElementById('loading-fill');
  const label = root.getElementById('loading-label');
  const percent = root.getElementById('loading-percent');
  const start = root.getElementById('start');

  return {
    async step(progress, text) {
      const p = Math.round(Math.min(1, Math.max(0, progress)) * 100);
      fill.style.width = `${p}%`;
      percent.textContent = `${p}%`;
      label.textContent = text;
      await nextPaint();
    },
    done() {
      box.classList.add('hidden');
      start.disabled = false;
      start.textContent = 'Klik untuk mulai';
    },
  };
}
