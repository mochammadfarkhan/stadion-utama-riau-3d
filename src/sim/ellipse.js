/**
 * Geometri elips: keliling (Ramanujan), tabel panjang busur kumulatif,
 * dan titik pada jarak busur tertentu. Elips di bidang XZ:
 *   x = a·cosθ, z = b·sinθ.
 * Dipakai untuk menempatkan kursi/louvre/pohon merata sepanjang keliling.
 */

const DEFAULT_SEGMENTS = 512;
const TWO_PI = Math.PI * 2;

/** Keliling elips (aproksimasi Ramanujan II, akurat < 1e-5 untuk rasio wajar). */
export function ellipsePerimeter(a, b) {
  const h = ((a - b) / (a + b)) ** 2;
  return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
}

/**
 * Tabel panjang busur kumulatif untuk n segmen sudut merata.
 * @returns {{a:number,b:number,n:number,cum:number[],total:number}}
 */
export function ellipseTable(a, b, n = DEFAULT_SEGMENTS) {
  const count = Math.max(4, Math.floor(n));
  const cum = [0];
  let prevX = a;
  let prevZ = 0;
  for (let i = 1; i <= count; i += 1) {
    const theta = (TWO_PI * i) / count;
    const x = a * Math.cos(theta);
    const z = b * Math.sin(theta);
    cum.push(cum[i - 1] + Math.hypot(x - prevX, z - prevZ));
    prevX = x;
    prevZ = z;
  }
  return Object.freeze({ a, b, n: count, cum: Object.freeze(cum), total: cum[count] });
}

/** Cari indeks segmen terakhir dengan cum[i] <= s (binary search). */
function findSegment(cum, s) {
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= s) lo = mid;
    else hi = mid;
  }
  return lo;
}

/**
 * Titik pada jarak busur s (meter) dari (a,0) berlawanan arah jarum jam
 * terhadap sudut parametrik. s di-wrap ke [0, ellipsePerimeter) lalu
 * diskalakan ke panjang tabel agar konsisten dengan ellipsePerimeter.
 * @returns {{x:number,z:number,theta:number}}
 */
export function ellipsePointAtArc(a, b, s, table) {
  const t = table && table.a === a && table.b === b ? table : ellipseTable(a, b);
  const perimeter = ellipsePerimeter(a, b);
  const sv = Number.isFinite(s) ? s : 0;
  const wrapped = (((sv % perimeter) + perimeter) % perimeter) * (t.total / perimeter);
  const i = findSegment(t.cum, wrapped);
  const segLen = t.cum[i + 1] - t.cum[i];
  const frac = segLen > 0 ? (wrapped - t.cum[i]) / segLen : 0;
  const theta = (TWO_PI * (i + frac)) / t.n;
  return { x: a * Math.cos(theta), z: b * Math.sin(theta), theta };
}
