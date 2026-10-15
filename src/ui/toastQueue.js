/**
 * Antrean toast FIFO: pesan baru tidak menimpa yang sedang tampil, durasi tampil
 * sebanding panjang teks. Murni (tanpa DOM) agar mudah dites; HUD menyuplai show/hide.
 */
const DEFAULTS = Object.freeze({ baseMs: 2200, perCharMs: 55, maxQueue: 4 });

export function toastDuration(text, { baseMs, perCharMs }) {
  return Math.max(baseMs, perCharMs * text.length);
}

/**
 * @param {{show:(text:string, ok:boolean)=>void, hide:()=>void,
 *   schedule?:(fn:()=>void, ms:number)=>any, cancel?:(id:any)=>void,
 *   baseMs?:number, perCharMs?:number, maxQueue?:number}} deps
 */
export function createToastQueue({ show, hide, schedule = setTimeout, cancel = clearTimeout, ...opts }) {
  const cfg = { ...DEFAULTS, ...opts };
  const queue = [];
  let timer = null;

  const present = ({ text, ok }) => {
    show(text, ok);
    timer = schedule(next, toastDuration(text, cfg));
  };

  function next() {
    timer = null;
    const item = queue.shift();
    if (item) present(item);
    else hide();
  }

  return {
    push(text, ok = true) {
      if (timer === null) return present({ text, ok });
      if (!ok) { // galat (mis. uang tidak cukup) harus terbaca sekarang, bukan setelah antrean habis
        cancel(timer);
        return present({ text, ok });
      }
      if (queue.length >= cfg.maxQueue) queue.shift();
      queue.push({ text, ok });
    },
    clear() {
      if (timer !== null) cancel(timer);
      timer = null;
      queue.length = 0;
      hide();
    },
  };
}
