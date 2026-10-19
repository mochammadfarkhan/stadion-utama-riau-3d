/**
 * Overlay hitam layar penuh untuk transisi pintu-portal (CSS opacity). fade(1) = gelap, fade(0) = terang.
 * Promise resolve setelah durasi transisi (timer, tidak bergantung `transitionend`); panggilan baru
 * menyelesaikan janji sebelumnya lebih dulu.
 */
export function createFadeOverlay(root = document.body, { ms = 350 } = {}) {
  const el = document.createElement('div');
  el.className = 'fade-overlay';
  el.style.cssText = `position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;transition:opacity ${ms}ms ease;z-index:1000;`;
  root.appendChild(el);
  let timer = null;
  let pending = null;
  const settle = () => {
    clearTimeout(timer);
    pending?.();
    pending = null;
  };
  return {
    fade(to) {
      settle();
      el.style.opacity = String(to);
      el.style.pointerEvents = to > 0 ? 'auto' : 'none';
      return new Promise((resolve) => {
        pending = resolve;
        timer = setTimeout(settle, ms);
      });
    },
    dispose() {
      settle();
      el.remove();
    },
  };
}
