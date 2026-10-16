/**
 * Argumen CLI citybake:
 *   node tools/citybake --area stadion|pusat|all [--offline] [--no-overture]
 *                       [--overture-release <id>] [--out <dir>] [--cache <dir>]
 */
import { parseArgs } from 'node:util';
import { AREAS, OVERTURE, PATHS } from './config.js';
import { runBake } from './pipeline.js';

export const USAGE = 'Pakai: node tools/citybake --area <stadion|pusat|all> [--offline] [--no-overture] '
  + '[--overture-release <id>] [--out <dir>] [--cache <dir>]';

/** @returns {{areaIds: string[], offline: boolean, useOverture: boolean, release: string, outDir: string, cacheDir: string}} */
export function parseCli(argv, areas = AREAS) {
  const { values } = parseArgs({
    args: argv,
    options: {
      area: { type: 'string' },
      offline: { type: 'boolean', default: false },
      'no-overture': { type: 'boolean', default: false },
      'overture-release': { type: 'string', default: OVERTURE.release },
      out: { type: 'string', default: PATHS.outDir },
      cache: { type: 'string', default: PATHS.cacheDir },
    },
    strict: true,
  });
  if (!values.area) throw new Error(`--area wajib. ${USAGE}`);
  const areaIds = values.area === 'all' ? Object.keys(areas) : [values.area];
  for (const id of areaIds) if (!areas[id]) throw new Error(`area tidak dikenal: "${id}". ${USAGE}`);
  return {
    areaIds,
    offline: values.offline,
    useOverture: !values['no-overture'],
    release: values['overture-release'],
    outDir: values.out,
    cacheDir: values.cache,
  };
}

/** Titik masuk CLI; mengembalikan exit code. */
export async function main(argv, log = console) {
  let opts;
  try {
    opts = parseCli(argv);
  } catch (err) {
    log.error(err.message);
    return 2;
  }
  try {
    const t0 = Date.now();
    const { report } = await runBake({ ...opts, log });
    for (const line of report.lines) log.info(line);
    for (const w of report.warnings) log.warn(`PERINGATAN: ${w}`);
    log.info(`Selesai dalam ${((Date.now() - t0) / 1000).toFixed(1)} s → ${opts.outDir}`);
    return 0;
  } catch (err) {
    log.error(`[citybake] gagal: ${err.message}`);
    return 1;
  }
}
