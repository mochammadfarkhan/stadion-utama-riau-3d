/**
 * Fungsi murni pipeline KTX2 (dites): ukuran yang dikonversi, path keluaran, dan argumen `toktx` per jenis peta.
 * albedo = ETC1S sRGB (kecil), orm = ETC1S linear, normal = UASTC linear (ETC1S merusak normal). `--lower_left_maps_to_s0t0`
 * agar orientasi sama dengan Texture three.js biasa (flipY = true). Tanpa --normal_mode: material memakai normal RGB biasa.
 */
export const KTX_SIZES = Object.freeze([1024, 512]); // 256 tetap WebP (tingkat 'rendah': albedo saja, kecil)

export const ktxPath = (name, kind, size) => `${name}/${kind}.${size}.ktx2`;

/** Ukuran set yang dikonversi ke KTX2 (irisan ukuran set dan KTX_SIZES), urut menurun. */
export const ktxSizesFor = (sizes) => KTX_SIZES.filter((s) => sizes.includes(s));

/**
 * @param {'albedo'|'normal'|'orm'} kind
 * @param {{input: string, output: string}} io
 * @returns {string[]} argumen untuk toktx (tanpa nama program)
 */
export function toktxArgs(kind, { input, output }) {
  const common = ['--t2', '--genmipmap', '--lower_left_maps_to_s0t0'];
  const byKind = {
    albedo: ['--encode', 'etc1s', '--clevel', '2', '--qlevel', '160', '--assign_oetf', 'srgb'],
    orm: ['--encode', 'etc1s', '--clevel', '2', '--qlevel', '128', '--assign_oetf', 'linear'],
    normal: ['--encode', 'uastc', '--uastc_quality', '2', '--uastc_rdo_l', '2', '--zcmp', '19', '--assign_oetf', 'linear'],
  };
  if (!byKind[kind]) throw new Error(`jenis peta tak dikenal: ${kind}`);
  return [...common, ...byKind[kind], output, input];
}
