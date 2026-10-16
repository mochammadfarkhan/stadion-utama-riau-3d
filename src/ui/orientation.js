/**
 * Orientasi layar untuk ponsel/tablet: game dirancang landscape. `requestLandscape` mencoba layar penuh +
 * kunci orientasi (Android Chrome; butuh gestur pengguna, jadi dipanggil dari tombol Mulai). iOS Safari
 * tidak mendukung kunci orientasi, jadi `createRotatePrompt` menampilkan ajakan memutar perangkat selama potret.
 */

/** Perangkat sentuh dalam potret perlu diputar. Jendela desktop yang sempit tidak dipaksa. */
export function needsRotate({ isTouch, width, height }) {
  return Boolean(isTouch) && Number.isFinite(width) && Number.isFinite(height) && height > width;
}

/**
 * Layar penuh lalu kunci landscape. Semua kegagalan ditelan (API tidak ada / ditolak).
 * @param {{document?: Document, screen?: Screen}} [env]
 * @returns {Promise<boolean>} true bila kunci orientasi berhasil
 */
export async function requestLandscape(env = { document: typeof document !== 'undefined' ? document : undefined, screen: typeof screen !== 'undefined' ? screen : undefined }) {
  const doc = env.document;
  try {
    if (doc?.documentElement?.requestFullscreen && !doc.fullscreenElement) await doc.documentElement.requestFullscreen();
  } catch {
    // ditolak: lanjut mencoba kunci (sebagian browser mengizinkan tanpa layar penuh)
  }
  const lock = env.screen?.orientation?.lock;
  if (typeof lock !== 'function') return false;
  try {
    await lock.call(env.screen.orientation, 'landscape');
    return true;
  } catch {
    return false;
  }
}

/**
 * Overlay "putar ke landscape" yang tampil selama perangkat sentuh dalam potret.
 * @param {HTMLElement} root
 * @param {{isTouch: boolean, win?: Window}} opts
 * @returns {{el: HTMLElement, update(): void, dispose(): void}}
 */
export function createRotatePrompt(root, { isTouch, win = window }) {
  const el = document.createElement('div');
  el.id = 'rotate-prompt';
  el.className = 'hidden';
  el.setAttribute('role', 'alert');
  const icon = document.createElement('div');
  icon.className = 'rotate-icon';
  const text = document.createElement('p');
  text.textContent = 'Putar perangkat ke mode landscape untuk bermain';
  el.append(icon, text);
  root.append(el);

  const update = () => el.classList.toggle('hidden', !needsRotate({ isTouch, width: win.innerWidth, height: win.innerHeight }));
  const ac = new AbortController();
  win.addEventListener('resize', update, { signal: ac.signal });
  win.addEventListener('orientationchange', update, { signal: ac.signal });
  update();
  return { el, update, dispose() { ac.abort(); el.remove(); } };
}
