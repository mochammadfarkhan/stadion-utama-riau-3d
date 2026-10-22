/**
 * Bidikan cepat studio karakter (karakter-studio.html, tanpa memuat dunia): beberapa sudut sekaligus, ±10-20 detik.
 *   node tools/shots/studio.mjs [--views depan,34,dekat] [--q "tipe=all&anim=walk"] [--out docs/screenshots]
 *     [--gpu d3d11|swiftshader] [--wait 800] [--size 1600x720] [--prefix studio-]
 * Keluaran: <out>/<prefix><view>.jpg + statistik (segitiga/mesh per orang) ke stdout.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 5182;
const GPU_ARGS = Object.freeze({
  swiftshader: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  d3d11: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'],
});
const { values: opts } = parseArgs({
  options: {
    views: { type: 'string', default: 'depan,34,dekat' }, q: { type: 'string', default: '' },
    out: { type: 'string', default: join('docs', 'screenshots') }, gpu: { type: 'string', default: 'd3d11' },
    wait: { type: 'string', default: '800' }, size: { type: 'string', default: '1600x720' },
    prefix: { type: 'string', default: 'studio-' },
  },
});

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  for (const c of [process.env.PLAYWRIGHT_PATH, 'playwright', join(process.env.APPDATA ?? '', 'npm', 'node_modules', 'playwright')].filter(Boolean)) {
    try { return require(c); } catch { /* berikutnya */ }
  }
  throw new Error('playwright tidak ditemukan');
}

async function main() {
  const outDir = resolve(ROOT, opts.out);
  mkdirSync(outDir, { recursive: true });
  const [width, height] = opts.size.split('x').map(Number);
  const vite = await import(pathToFileURL(join(ROOT, 'node_modules', 'vite', 'dist', 'node', 'index.js')).href);
  const server = await vite.createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), server: { port: PORT, strictPort: true }, logLevel: 'error' });
  await server.listen();
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true, args: GPU_ARGS[opts.gpu] ?? GPU_ARGS.d3d11 });
  const errors = [];
  const report = {};
  try {
    const page = await browser.newPage({ viewport: { width, height } });
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    for (const view of opts.views.split(',').filter(Boolean)) {
      const query = new URLSearchParams(opts.q);
      query.set('cam', view);
      query.set('bersih', '1');
      await page.goto(`http://localhost:${PORT}/karakter-studio.html?${query}`, { waitUntil: 'load', timeout: 120000 });
      await page.waitForFunction(() => window.__studio?.ready, null, { timeout: 60000 });
      await page.waitForTimeout(Number(opts.wait));
      const file = join(outDir, `${opts.prefix}${view}.jpg`);
      await page.screenshot({ path: file, type: 'jpeg', quality: 88 });
      report[view] = { file, ...(await page.evaluate(() => window.__studio.stats)) };
    }
  } finally {
    await browser.close();
    await server.close();
  }
  console.log(JSON.stringify({ report, errors }, null, 2));
  process.exitCode = errors.length ? 1 : 0;
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
