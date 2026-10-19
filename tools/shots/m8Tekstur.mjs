#!/usr/bin/env node
/**
 * Gerbang visual + performa M8-A (tekstur PBR + tanah splat): titik x konfigurasi -> screenshot + (titik 3/4) draw call,
 * segitiga, frame rata-rata/p95, memori tekstur PBR (byte terhitung) + jumlah tekstur GL.
 *   node tools/shots/m8Tekstur.mjs [--points sekre-34,sekre-mata,jalan-34,jalan-mata,stadion-34] [--configs asli,kartun-tinggi,kartun-sedang,kartun-rendah]
 *      [--perf sekre-34] [--gpu d3d11] [--port 5173] [--frames 240] [--out docs/screenshots/m8]
 * Konfigurasi: asli = gaya asli; kartun-<kualitas> = gaya kartun + graphics.tanahPbr. Titik "-34" memakai kamera 3/4 (rig),
 * titik "-mata" kamera bebas setinggi mata (sekre: titik panorama (-137.1, 999.5) heading 98).
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { openSim, settleAt, ROOT } from '../../tests/e2e/harness.unri.mjs';

const { values: v } = parseArgs({
  options: {
    points: { type: 'string', default: 'sekre-34,jalan-34,stadion-34,sekre-mata,jalan-mata' },
    configs: { type: 'string', default: 'asli,kartun-tinggi' },
    perf: { type: 'string', default: 'sekre-34' },
    perfConfigs: { type: 'string', default: 'asli,kartun-tinggi,kartun-sedang,kartun-rendah' },
    gpu: { type: 'string', default: 'd3d11' }, port: { type: 'string', default: '5173' }, frames: { type: 'string', default: '240' },
    out: { type: 'string', default: join('docs', 'screenshots', 'm8') },
    evalJs: { type: 'string', default: '' }, // JS dijalankan di halaman sebelum pengukuran (debug)
    stable: { type: 'boolean', default: false }, // resolusi adaptif mati + pixelRatio 1 (ukur biaya render yang dapat dibandingkan)
    hide: { type: 'string', default: '' }, // awalan nama mesh yang disembunyikan (debug)
  },
});
const OUT = join(ROOT, v.out);
mkdirSync(OUT, { recursive: true });

const POINTS = {
  'sekre-34': { kind: 'angled', x: -96.65, z: 1011.5, yaw: Math.PI, hour: 11 },
  'jalan-34': { kind: 'angled', x: -206, z: 1118, yaw: -2.52, hour: 10 },
  'stadion-34': { kind: 'angled', x: null, z: null, yaw: null, hour: 16.5 },
  'sekre-mata': { kind: 'eye', eye: [-137.1, 2.5, 999.5], heading: 98, fov: 75, pitch: -0.6, area: [-110, 1010], hour: 11 },
  'jalan-mata': { kind: 'eye', eye: [-138.9, 2.2, 1006], heading: 20, fov: 70, pitch: -1, area: [-110, 1010], hour: 10 },
};
const cfgOf = (id) => (id === 'asli' ? { style: 'asli', q: 'auto' } : { style: 'kartun', q: id.split('-')[1] });

const sim = await openSim({ gpu: v.gpu, port: Number(v.port) });
const rows = [];
try {
  const spawn = await sim.page.evaluate(() => { const b = window.__sim.ents.bike.state; return { x: b.x, z: b.z, yaw: b.yaw }; });
  Object.assign(POINTS['stadion-34'], spawn);
  let eyePrepared = false;
  for (const pid of v.points.split(',')) {
    const pt = POINTS[pid];
    if (pt.kind === 'angled') {
      if (eyePrepared) throw new Error('urutkan titik -34 sebelum -mata (kamera bebas tidak dipulihkan)');
      await settleAt(sim.page, { ...pt, waitMs: 3000 });
    } else if (!eyePrepared) {
      eyePrepared = true;
      await sim.page.evaluate(() => {
        const s = window.__sim;
        s.store.set('camera.mode', 'third');
        s.app.systems.remove('cameraRig');
        const st = document.createElement('style');
        st.textContent = 'body > *:not(#app):not(script):not(style) { display: none !important }';
        document.head.appendChild(st);
      });
    }
    const configs = [...new Set([...v.configs.split(','), ...(v.perf.split(',').includes(pid) ? v.perfConfigs.split(',') : [])])];
    for (const cid of configs) {
      const cfg = cfgOf(cid);
      await sim.page.evaluate(async ({ cfg: c, pt: p, stable }) => {
        const s = window.__sim;
        s.store.set('sky.hour', p.hour);
        if (stable) { s.store.set('graphics.adaptiveResolution', false); s.store.set('graphics.pixelRatio', 1); }
        s.store.set('graphics.tanahPbr', c.q);
        s.store.set('graphics.gayaGrafis', c.style);
        if (p.kind === 'angled') {
          s.store.set('camera.mode', 'angled');
          s.teleport(p.x, p.z, p.yaw);
        } else {
          const cam = s.app.camera;
          const h = (x, z) => s.terrain.heightAt(x, z);
          const [ax, az] = p.area;
          s.teleport(ax, az, 0);
          s.rig.focus.set(ax, h(ax, az), az);
          if (s.city) await s.city.whenSettled(ax, az, 1000, 90000);
          if (s.district?.whenSettled) await s.district.whenSettled(ax, az, 400);
          if (s.scheduler?.whenIdle) await s.scheduler.whenIdle();
          const [ex, ey0, ez] = p.eye;
          const ey = h(ex, ez) + ey0;
          const a = (p.heading * Math.PI) / 180;
          const pr = (p.pitch ?? 0) * (Math.PI / 180);
          s.teleport(ex - 9, ez, 0);
          s.rig.focus.set(ex, h(ex, ez), ez);
          cam.fov = p.fov;
          cam.updateProjectionMatrix();
          for (let k = 0; k < 2; k += 1) {
            cam.position.set(ex, ey, ez);
            cam.lookAt(ex + Math.sin(a) * 60, ey + Math.tan(pr) * 60, ez - Math.cos(a) * 60);
            cam.updateMatrixWorld(true);
            await new Promise((r) => setTimeout(r, 300));
          }
        }
      }, { cfg, pt, stable: v.stable });
      await sim.page.waitForTimeout(4500); // snap kamera, scan material, tekstur PBR termuat, streaming ulang
      if (v.evalJs) { await sim.page.evaluate(v.evalJs); await sim.page.waitForTimeout(800); }
      const m = await sim.page.evaluate(async ({ n, kind, hide }) => {
        const s = window.__sim;
        if (hide) s.app.scene.traverse((o) => { if (o.name?.startsWith(hide)) o.visible = false; });
        const { pbrMemory } = await import('/src/world/textures/pbr.js');
        const info = s.app.renderer.info;
        const times = [];
        let last = performance.now();
        for (let i = 0; i < n; i += 1) {
          await new Promise((r) => requestAnimationFrame(r));
          const t = performance.now();
          times.push(t - last);
          last = t;
        }
        // Biaya render tanpa batas vsync: renderFrame + gl.finish berturut-turut (ms per frame, rata-rata dan p95)
        const gl = s.app.renderer.getContext();
        const rts = [];
        for (let i = 0; i < 90; i += 1) {
          const t0 = performance.now();
          s.app.renderFrame();
          gl.finish();
          rts.push(performance.now() - t0);
        }
        rts.sort((a, b) => a - b);
        const rf = rts.reduce((a, b) => a + b, 0) / rts.length;
        const calls = info.render.calls;
        const tris = info.render.triangles;
        times.sort((a, b) => a - b);
        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        return {
          calls, tris, rf: Number(rf.toFixed(2)), rf95: Number(rts[Math.floor(rts.length * 0.95)].toFixed(2)), avg: Number(avg.toFixed(2)), p95: Number(times[Math.floor(times.length * 0.95)].toFixed(2)),
          pbrMB: Number((pbrMemory().bytes / 1048576).toFixed(1)), glTex: info.memory.textures, pr: Number(s.app.pixelRatio.toFixed(2)), kind,
        };
      }, { n: Number(v.frames), kind: pt.kind, hide: v.hide });
      await sim.page.screenshot({ path: join(OUT, `${pid}-${cid}.jpg`), type: 'jpeg', quality: 84 });
      rows.push({ point: pid, config: cid, ...m });
      console.log(JSON.stringify(rows.at(-1)));
    }
  }
  console.log('errors', JSON.stringify(sim.errors.slice(0, 12)));
} finally {
  await sim.close();
}
process.exit(0);
