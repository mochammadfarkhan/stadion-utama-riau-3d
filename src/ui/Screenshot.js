/**
 * captureScreenshot(app, { scale, filename }): sembunyikan UI (body.is-photo),
 * render satu frame tanpa memajukan simulasi, lalu toBlob pada task yang sama
 * (buffer WebGL tanpa preserveDrawingBuffer hanya valid sampai frame berikutnya).
 * scale > 1 menaikkan pixel ratio sementara untuk resolusi lebih tinggi.
 */

const PHOTO_CLASS = 'is-photo';
const FILE_PREFIX = 'stadion-utama-riau';

/** Nama berkas "stadion-utama-riau-YYYYMMDD-HHMM.png" dari Date. */
export function screenshotFilename(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  const stamp = `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}`;
  return `${FILE_PREFIX}-${stamp}.png`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Ambil blob PNG dari kanvas; Promise ditolak bila toBlob gagal. */
function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob gagal'))), 'image/png');
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * @param {import('../core/App.js').App} app
 * @param {{ scale?: number, filename?: string, download?: boolean }} opts
 * @returns {Promise<Blob|null>} blob (atau null bila gagal)
 */
export async function captureScreenshot(app, { scale = 1, filename = screenshotFilename(), download = true } = {}) {
  const body = document.body;
  const basePr = app.pixelRatio;
  const k = Number.isFinite(scale) && scale > 0 ? scale : 1;
  body.classList.add(PHOTO_CLASS);
  let pending = null;
  try {
    if (k !== 1) app.setPixelRatio(basePr * k);
    app.renderFrame();
    pending = canvasToBlob(app.renderer.domElement); // dipanggil sinkron setelah render
  } finally {
    if (k !== 1) app.setPixelRatio(basePr);
    body.classList.remove(PHOTO_CLASS);
  }
  try {
    const blob = await pending;
    if (download) downloadBlob(blob, filename);
    return blob;
  } catch {
    return null; // kanvas tainted / memori habis: tidak fatal
  }
}
