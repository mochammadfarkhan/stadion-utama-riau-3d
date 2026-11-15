/**
 * Info tujuan untuk kartu misi (murni): teks jarak dan sudut tujuan relatif arah hadap.
 */

/** Teks jarak: < 1000 m dibulatkan ke 10 m ("240 m"); ≥ 1000 m satu desimal dengan koma ("1,3 km"). null → ''. */
export function formatDistance(meters) {
  if (meters == null || !Number.isFinite(meters)) return '';
  const m = Math.round(Math.max(0, meters) / 10) * 10;
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

/** Sudut tujuan relatif arah hadap (rad, −π..π; 0 = lurus di depan). Konvensi maju = (sin yaw, cos yaw). */
export function relativeBearing(from, to, yaw) {
  const want = Math.atan2(to.x - from.x, to.z - from.z);
  const d = want - yaw;
  return Math.atan2(Math.sin(d), Math.cos(d));
}
