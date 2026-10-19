/**
 * Pembaca SRTM .hgt: int16 big-endian, size × size sampel baris-mayor dari UTARA ke selatan, barat ke
 * timur; sampel (0, 0) = sudut barat-laut (lat0 + 1, lon0). Nilai −32768 = void. Murni.
 */
export const HGT_VOID = -32768;

/** "N00E101" → {lat0: 0, lon0: 101}; "S01W060" → {lat0: −1, lon0: −60}. */
export function parseHgtName(name) {
  const m = String(name).match(/^([NS])(\d{2})([EW])(\d{3})$/);
  if (!m) throw new Error(`nama ubin SRTM tidak valid: ${JSON.stringify(name)}`);
  const lat0 = Number(m[2]) * (m[1] === 'S' ? -1 : 1);
  const lon0 = Number(m[4]) * (m[3] === 'W' ? -1 : 1);
  return { lat0, lon0 };
}

/**
 * @param {Uint8Array} bytes isi .hgt (sudah didekompresi)
 * @param {string} name nama ubin, mis. "N00E101"
 * @returns {{name:string, lat0:number, lon0:number, size:number, data:Int16Array}}
 */
export function readHgt(bytes, name) {
  if (!(bytes instanceof Uint8Array)) throw new TypeError('readHgt: bytes harus Uint8Array/Buffer');
  const samples = bytes.byteLength / 2;
  const size = Math.round(Math.sqrt(samples));
  if (!Number.isInteger(samples) || size * size !== samples || (size !== 3601 && size !== 1201)) {
    throw new Error(`ukuran .hgt ${bytes.byteLength} byte bukan 3601² atau 1201² sampel int16`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const data = new Int16Array(samples);
  for (let i = 0; i < samples; i += 1) data[i] = view.getInt16(i * 2, false);
  return { name, ...parseHgtName(name), size, data };
}

/**
 * Posisi pecahan (baris, kolom) lat/lon pada ubin; baris 0 = utara.
 * @returns {{row:number, col:number}}
 */
export function hgtPosition(dem, lat, lon) {
  const k = dem.size - 1;
  return { row: (dem.lat0 + 1 - lat) * k, col: (lon - dem.lon0) * k };
}
