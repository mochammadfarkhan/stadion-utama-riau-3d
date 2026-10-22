/**
 * Render reels → MP4 vertikal 1080×1920 (reels.html, frame-demi-frame, deterministik). Frame JPEG dialirkan langsung
 * ke stdin ffmpeg (tanpa ribuan berkas sementara). Tanpa audio: suara/voice-over ditambah di editor (CapCut dsb).
 *   node tools/reels/render.mjs [--scene sekre-duduk] [--out renders] [--gpu d3d11|swiftshader] [--crf 18]
 *     [--dari 0] [--sampai <durasi>]   rentang detik (cepat untuk coba potongan)
 *     [--stills 1,8,15]                hanya ambil gambar diam pada detik itu (cek komposisi, tanpa ffmpeg)
 *     [--ffmpeg <path>]                bila ffmpeg tidak ada di PATH
 *     [--naskah]                       hanya tulis <scene>.srt + <scene>.md (tanpa browser)
 * Selalu menulis <out>/<scene>.srt (subtitle untuk CapCut) dan <scene>.md (naskah per adegan untuk rekam suara).
 */
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 5183;
const SIZE = Object.freeze({ width: 540, height: 960, scale: 2 }); // CSS 540×960 × DPR 2 = 1080×1920
const GPU_ARGS = Object.freeze({
  swiftshader: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  d3d11: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'],
});
const { values: opts } = parseArgs({
  options: {
    scene: { type: 'string', default: 'sekre-duduk' }, out: { type: 'string', default: 'renders' },
    gpu: { type: 'string', default: 'd3d11' }, crf: { type: 'string', default: '18' },
    dari: { type: 'string' }, sampai: { type: 'string' }, stills: { type: 'string' }, ffmpeg: { type: 'string' },
    naskah: { type: 'boolean', default: false },
  },
});

/** Subtitle + naskah dari data scene (modul scene murni, diimpor langsung di Node). */
async function writeScript(outDir) {
  const load = (p) => import(pathToFileURL(join(ROOT, p)).href);
  const [{ REEL_SCENES }, { toSrt, toNaskahMd }, { NPCS }] = await Promise.all([
    load('src/dev/reels/scenes/index.js'), load('src/dev/reels/naskah.js'), load('src/interiors/sekre/data.js'),
  ]);
  const scene = REEL_SCENES[opts.scene];
  if (!scene) throw new Error(`Scene "${opts.scene}" tidak ada (${Object.keys(REEL_SCENES).join(', ')})`);
  const nama = Object.fromEntries(NPCS.map((n) => [n.id, n.nama]));
  for (const [ext, text] of [['srt', toSrt(scene.teks, nama)], ['md', toNaskahMd(scene, nama)]]) {
    const file = join(outDir, `${opts.scene}.${ext}`);
    writeFileSync(file, text, 'utf8');
    console.log(file);
  }
}

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  for (const c of [process.env.PLAYWRIGHT_PATH, 'playwright', join(process.env.APPDATA ?? '', 'npm', 'node_modules', 'playwright')].filter(Boolean)) {
    try { return require(c); } catch { /* berikutnya */ }
  }
  throw new Error('playwright tidak ditemukan');
}

/** ffmpeg: --ffmpeg, PATH, lalu paket WinGet Gyan.FFmpeg. */
function findFfmpeg() {
  if (opts.ffmpeg) return opts.ffmpeg;
  if (spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0) return 'ffmpeg';
  const pkgs = join(process.env.LOCALAPPDATA ?? '', 'Microsoft', 'WinGet', 'Packages');
  const pkg = existsSync(pkgs) ? readdirSync(pkgs).find((d) => d.startsWith('Gyan.FFmpeg')) : null;
  const build = pkg ? readdirSync(join(pkgs, pkg)).find((d) => d.startsWith('ffmpeg-')) : null;
  const exe = build ? join(pkgs, pkg, build, 'bin', 'ffmpeg.exe') : null;
  if (exe && existsSync(exe)) return exe;
  throw new Error('ffmpeg tidak ditemukan; pasang (winget install Gyan.FFmpeg) atau beri --ffmpeg <path>');
}

function startEncoder(ffmpeg, fps, file) {
  const args = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    // JPEG = rentang penuh (yuvj); Reels/TikTok mengharapkan yuv420p rentang TV, kalau tidak warna tampak pudar.
    '-vf', 'scale=in_range=pc:out_range=tv,format=yuv420p', '-color_range', 'tv',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', opts.crf, '-movflags', '+faststart', file];
  const proc = spawn(ffmpeg, args, { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((ok, fail) => {
    proc.on('error', fail);
    proc.on('close', (code) => (code === 0 ? ok() : fail(new Error(`ffmpeg keluar dengan kode ${code}`))));
  });
  const write = (buf) => new Promise((ok) => { if (proc.stdin.write(buf)) ok(); else proc.stdin.once('drain', ok); });
  return { write, end: () => { proc.stdin.end(); return done; } };
}

async function main() {
  const outDir = resolve(ROOT, opts.out);
  mkdirSync(outDir, { recursive: true });
  await writeScript(outDir);
  if (opts.naskah) return;
  const vite = await import(pathToFileURL(join(ROOT, 'node_modules', 'vite', 'dist', 'node', 'index.js')).href);
  const server = await vite.createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), server: { port: PORT, strictPort: true }, logLevel: 'error' });
  await server.listen();
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true, args: GPU_ARGS[opts.gpu] ?? GPU_ARGS.d3d11 });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: SIZE.width, height: SIZE.height }, deviceScaleFactor: SIZE.scale });
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`http://localhost:${PORT}/reels.html?render=1&scene=${encodeURIComponent(opts.scene)}`, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => window.__reel?.ready || window.__reel?.error, null, { timeout: 120000 });
    const info = await page.evaluate(() => ({ ...window.__reel, frame: undefined }));
    if (info.error) throw new Error(`Scene gagal: ${info.error}`);
    const shot = async (i) => {
      await page.evaluate((n) => window.__reel.frame(n), i);
      return page.screenshot({ type: 'jpeg', quality: 92 });
    };

    if (opts.stills) {
      for (const s of opts.stills.split(',').map(Number).filter(Number.isFinite)) {
        const file = join(outDir, `${opts.scene}-${s}s.jpg`);
        await page.evaluate((n) => window.__reel.frame(n), Math.round(s * info.fps));
        await page.screenshot({ path: file, type: 'jpeg', quality: 90 });
        console.log(file);
      }
      return;
    }

    const first = Math.max(0, Math.round(Number(opts.dari ?? 0) * info.fps));
    const last = Math.min(info.frames, Math.round(Number(opts.sampai ?? info.durasi) * info.fps));
    const file = join(outDir, `${opts.scene}.mp4`);
    const encoder = startEncoder(findFfmpeg(), info.fps, file);
    const started = Date.now();
    for (let i = first; i < last; i += 1) {
      await encoder.write(await shot(i));
      if ((i - first) % info.fps === 0) process.stdout.write(`\r${opts.scene}: ${(i / info.fps).toFixed(0)}/${info.durasi} s`);
    }
    await encoder.end();
    console.log(`\n${file} (${last - first} frame, ${((Date.now() - started) / 1000).toFixed(0)} s)`);
  } finally {
    await browser.close();
    await server.close();
  }
  if (errors.length) console.error(JSON.stringify({ errors }, null, 2));
  process.exitCode = errors.length ? 1 : 0;
}

main().catch((err) => { console.error(err); process.exitCode = 1; });
