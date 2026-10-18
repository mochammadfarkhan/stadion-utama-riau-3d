/**
 * Antrean kerja time-sliced (spec UNRI §4.3, M0): pekerjaan berat region/distrik dipotong per frame
 * agar tidak menimbulkan hitch. `task` = fungsi biasa (satu potongan) atau fungsi generator (setiap
 * `yield` = titik potong). update() menjalankan potongan berurutan FIFO sampai anggaran `budgetMs`
 * habis — minimal satu potongan per update agar antrean selalu maju. `owner` (mis. 'region:dummy')
 * mengelompokkan task untuk dibatalkan/ditunggu bersama. Task yang melempar dicatat lalu dibuang;
 * antrean tetap lanjut. Lapisan engine: tanpa impor three/world/ui.
 */
export const DEFAULT_BUDGET_MS = 4;

/** @typedef {() => (void | Iterator<unknown>)} Task */
/** @typedef {{cancel(): void}} TaskHandle */

const isIterator = (v) => v != null && typeof v.next === 'function' && typeof v[Symbol.iterator] === 'function';

/**
 * Jalankan task sampai habis secara sinkron (tanpa scheduler: mount di tes/alat).
 * @param {Task} task
 */
export function runTaskNow(task) {
  if (typeof task !== 'function') throw new TypeError('runTaskNow: task harus fungsi');
  const out = task();
  if (!isIterator(out)) return;
  while (!out.next().done) {
    // setiap yield = titik potong; tanpa scheduler dijalankan beruntun
  }
}

/**
 * @param {{budgetMs?: number, now?: () => number, logger?: {error: (...args: unknown[]) => void}}} [opts]
 * @returns {{schedule(task: Task, opts?: {owner?: unknown}): TaskHandle, cancelOwner(owner: unknown): number,
 *   update(): number, pending(owner?: unknown): number, whenIdle(owner?: unknown): Promise<void>}}
 */
export function createScheduler({ budgetMs = DEFAULT_BUDGET_MS, now = () => performance.now(), logger = console } = {}) {
  if (!Number.isFinite(budgetMs) || budgetMs < 0) throw new TypeError('createScheduler: budgetMs harus angka ≥ 0');
  if (typeof now !== 'function') throw new TypeError('createScheduler: now() harus fungsi');
  let queue = [];   // job: { task, owner, iter, done } — urut FIFO
  let waiters = []; // { owner, all, resolve }

  const count = (owner, all) => (all ? queue.length : queue.reduce((n, j) => n + (j.owner === owner ? 1 : 0), 0));

  const settle = () => {
    if (!waiters.length) return;
    const done = waiters.filter((w) => count(w.owner, w.all) === 0);
    if (!done.length) return;
    waiters = waiters.filter((w) => !done.includes(w));
    for (const w of done) w.resolve();
  };

  /** Keluarkan job dari antrean; false bila sudah keluar sebelumnya. */
  const drop = (job) => {
    if (job.done) return false;
    job.done = true;
    queue = queue.filter((j) => j !== job);
    return true;
  };

  /** Generator yang dibatalkan di tengah jalan: jalankan blok finally-nya. */
  const close = (job) => {
    if (!job.iter) return;
    try {
      job.iter.return();
    } catch (err) {
      logger.error(`Scheduler: task milik "${String(job.owner)}" gagal ditutup:`, err);
    }
  };

  /** Satu potongan job; true bila job selesai. */
  const step = (job) => {
    if (!job.iter) {
      const out = job.task();
      if (!isIterator(out)) return true;
      job.iter = out;
    }
    return job.iter.next().done === true;
  };

  return {
    schedule(task, { owner = null } = {}) {
      if (typeof task !== 'function') throw new TypeError('Scheduler.schedule: task harus fungsi');
      const job = { task, owner, iter: null, done: false };
      queue = [...queue, job];
      return Object.freeze({
        cancel() {
          if (!drop(job)) return;
          close(job);
          settle();
        },
      });
    },
    cancelOwner(owner) {
      const jobs = queue.filter((j) => j.owner === owner);
      for (const j of jobs) {
        drop(j);
        close(j);
      }
      if (jobs.length) settle();
      return jobs.length;
    },
    /** Jalankan potongan sampai anggaran habis (minimal satu). @returns {number} jumlah potongan */
    update() {
      if (!queue.length) return 0;
      const start = now();
      let slices = 0;
      do {
        const job = queue[0];
        let finished = true;
        try {
          finished = step(job);
        } catch (err) {
          logger.error(`Scheduler: task milik "${String(job.owner)}" gagal, dibuang:`, err);
        }
        slices += 1;
        if (finished && drop(job)) settle();
      } while (queue.length > 0 && now() - start < budgetMs);
      return slices;
    },
    /** Jumlah task tertunda; tanpa argumen = semua pemilik. */
    pending(owner) { return count(owner, owner === undefined); },
    /** Selesai saat task milik `owner` (tanpa argumen: semua) habis. */
    whenIdle(owner) {
      const all = owner === undefined;
      if (count(owner, all) === 0) return Promise.resolve();
      return new Promise((resolve) => { waiters = [...waiters, { owner, all, resolve }]; });
    },
  };
}
