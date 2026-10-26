/**
 * Gerbang batas FPS (MURNI) untuk loop `setAnimationLoop` yang berjalan tiap vsync. Jadwal bebas drift: frame berikutnya
 * dijadwalkan tepat `interval` setelah jadwal sebelumnya (bukan setelah waktu render), sehingga di layar 144 Hz batas 60
 * tetap ±60 FPS (bukan setiap vsync ketiga = 48 FPS). Toleransi kecil menyerap jitter vsync; tertinggal jauh (tab
 * di-background, lonjakan) → jadwal direset ke sekarang agar tidak "mengejar" dengan rentetan frame.
 */

const TOLERANCE_MS = 1.5;

/** @param {number} fps 0 / tidak valid = tanpa batas */
export function frameInterval(fps) {
  const f = Number(fps);
  return Number.isFinite(f) && f > 0 ? 1000 / f : 0;
}

/**
 * @param {{next:number}} gate jadwal frame berikutnya (ms, performance.now); diubah di tempat (satu pemilik: App)
 * @param {number} now
 * @param {number} interval ms (0 = render setiap panggilan)
 * @returns {boolean} true = render frame ini
 */
export function shouldRenderFrame(gate, now, interval) {
  if (!(interval > 0)) return true;
  if (now < gate.next - TOLERANCE_MS) return false;
  gate.next = now - gate.next > interval ? now + interval : gate.next + interval;
  return true;
}
