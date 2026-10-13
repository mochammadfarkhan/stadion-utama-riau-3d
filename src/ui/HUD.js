const FPS_SAMPLE_INTERVAL = 0.5;
const TOAST_MS = 2200;

const rupiah = (n) => 'Rp ' + Math.round(n).toLocaleString('id-ID');

/** Helper DOM kecil: el(tag, {id, className}, children...) */
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  if (attrs.id) node.id = attrs.id;
  if (attrs.className) node.className = attrs.className;
  if (attrs.dataset) Object.assign(node.dataset, attrs.dataset);
  for (const c of children) node.append(c);
  return node;
}

/**
 * HUD DOM: kecepatan, dompet, inventori, prompt interaksi, dialog beli, skor, FPS.
 * Hanya menulis ke DOM saat nilai berubah agar tidak memicu layout berlebih.
 */
export class HUD {
  constructor(root) {
    this.root = root;
    this.el = buildLayout(root);
    this._last = {};
    this._fpsAcc = 0;
    this._fpsFrames = 0;
    this.shopOpen = false;
    this.onBuy = null;
    this.el.shopList.addEventListener('click', (e) => this.#onShopClick(e));
  }

  #set(key, text) {
    if (this._last[key] === text) return;
    this._last[key] = text;
    this.el[key].textContent = text;
  }

  setSpeed(kmh) { this.#set('speed', `${Math.round(kmh)} km/j`); }

  setWallet(wallet) {
    this.#set('wallet', rupiah(wallet.balance));
    const counts = countItems(wallet.items);
    this.#set('items', counts.length ? counts.join(' · ') : 'Belum beli apa-apa');
  }

  setScore(score) { this.#set('score', `PSPS ${score.a} – ${score.b} TAMU`); }

  setCameraMode(mode) {
    this.#set('cam', mode === 'first' ? 'Kamera: orang pertama (V)' : 'Kamera: orang ketiga (V)');
  }

  setPrompt(text) {
    this.#set('prompt', text ?? '');
    this.el.prompt.classList.toggle('hidden', !text);
  }

  tickFps(dt) {
    this._fpsAcc += dt;
    this._fpsFrames += 1;
    if (this._fpsAcc < FPS_SAMPLE_INTERVAL) return;
    this.#set('fps', `${Math.round(this._fpsFrames / this._fpsAcc)} fps`);
    this._fpsAcc = 0;
    this._fpsFrames = 0;
  }

  /** @param {{name:string, items:{id:string,name:string,price:number}[]}} vendor */
  openShop(vendor) {
    this.shopOpen = true;
    this.el.shopTitle.textContent = vendor.name;
    this.el.shopList.replaceChildren(
      ...vendor.items.map((it) =>
        el('button', { dataset: { id: it.id } }, el('span', {}, it.name), el('b', {}, rupiah(it.price))),
      ),
    );
    this.el.shop.classList.remove('hidden');
  }

  closeShop() {
    this.shopOpen = false;
    this.el.shop.classList.add('hidden');
  }

  toast(text, ok = true) {
    const t = this.el.toast;
    t.textContent = text;
    t.className = ok ? 'ok' : 'err';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => (t.className = 'hidden'), TOAST_MS);
  }

  #onShopClick(e) {
    const btn = e.target.closest('button[data-id]');
    if (!btn || !this.onBuy) return;
    this.onBuy(btn.dataset.id);
  }
}

function countItems(items = []) {
  const map = new Map();
  for (const it of items) map.set(it.name, (map.get(it.name) ?? 0) + 1);
  return [...map.entries()].map(([name, n]) => `${name} ×${n}`);
}

function buildLayout(root) {
  const speed = el('div', { id: 'hud-speed', className: 'big' }, '0 km/j');
  const cam = el('div', { id: 'hud-cam', className: 'muted' }, 'Kamera: orang ketiga (V)');
  const fps = el('div', { id: 'hud-fps', className: 'muted' }, '– fps');
  const wallet = el('div', { id: 'hud-wallet', className: 'big' }, 'Rp 0');
  const items = el('div', { id: 'hud-items', className: 'muted' }, 'Belum beli apa-apa');
  const score = el('div', { id: 'hud-score', className: 'pill' }, 'PSPS 0 – 0 TAMU');
  const prompt = el('div', { id: 'hud-prompt', className: 'pill hidden' });
  const toast = el('div', { id: 'hud-toast', className: 'hidden' });
  const shopTitle = el('h2', { id: 'hud-shop-title' });
  const shopList = el('div', { id: 'hud-shop-list' });
  const shopHint = el('p', { className: 'muted' }, 'Klik item untuk membeli · Esc / E untuk tutup');
  const shop = el('div', { id: 'hud-shop', className: 'hidden' }, shopTitle, shopList, shopHint);

  root.replaceChildren(
    el('div', { id: 'hud-top-left' }, speed, cam, fps),
    el('div', { id: 'hud-top-right' }, el('div', { className: 'label' }, 'Dompet'), wallet, items),
    score, prompt, toast, shop,
  );
  return { speed, cam, fps, wallet, items, score, prompt, toast, shop, shopTitle, shopList };
}
