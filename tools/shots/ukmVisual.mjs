#!/usr/bin/env node
/**
 * Gerbang visual sekre UKM blok biru (ERC): kamera bebas → screenshot + hitung draw call/segitiga region.
 *   node tools/shots/ukmVisual.mjs [--only id1,id2] [--gpu d3d11|swiftshader] [--out docs/screenshots/unri] [--wait 3500] [--list]
 * Koordinat dunia (ENU, +X timur, +Z selatan); `eye`/`look` = [x, tinggi di atas tanah, z]; `heading` = derajat kompas
 * (0 = utara, 90 = timur) bila `look` tidak diberikan. Keluaran: <out>/sekre-ukm-<id>.jpg + JSON laporan ke stdout.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { openSim, settleAt, ROOT } from '../../tests/e2e/harness.unri.mjs';

const { values: opts } = parseArgs({
  options: {
    only: { type: 'string' }, gpu: { type: 'string', default: 'd3d11' }, out: { type: 'string', default: join('docs', 'screenshots', 'unri') },
    wait: { type: 'string', default: '3500' }, list: { type: 'boolean', default: false }, report: { type: 'string' },
  },
});

const D5 = [-93.65, 1005.52];
const COURT = { voli: [-112.1, 945.4], basket: [-86.4, 939], tenis: [-59.5, 935.5] };
const VIEWS = [
  { id: 'streetview-user', eye: [-137.1, 2.5, 999.5], heading: 98, fov: 75, pitch: -0.6, area: [-110, 1010] },
  { id: 'd3-d5-mata', eye: [-101, 1.7, 1004], look: [D5[0], 1.4, D5[1]], fov: 62, area: [-100, 1008] },
  { id: 'd5-dekat', eye: [-96.2, 1.6, 1006.6], look: [D5[0], 1.5, D5[1]], fov: 55, area: [-98, 1006] },
  { id: 'halaman-pintu-utara', eye: [-111, 1.7, 1006], look: [-107, 1.8, 1019], fov: 62, area: [-105, 1010] },
  { id: 'atas-gedung', eye: [-98, 52, 985], look: [-100, 0, 1013], fov: 52, area: [-100, 1010] },
  { id: 'atas-gedung-timur', eye: [-60, 30, 1010], look: [-100, 0, 1012], fov: 55, area: [-100, 1010] },
  { id: 'lapangan-voli-mata', eye: [COURT.voli[0], 1.7, COURT.voli[1] + 17], look: [COURT.voli[0], 1.4, COURT.voli[1]], fov: 62, area: COURT.voli },
  { id: 'lapangan-basket-mata', eye: [COURT.basket[0] + 2, 1.7, COURT.basket[1] + 22], look: [COURT.basket[0], 1.6, COURT.basket[1] - 8], fov: 62, area: COURT.basket },
  { id: 'lapangan-tenis-mata', eye: [COURT.tenis[0] + 2, 1.7, COURT.tenis[1] + 20], look: [COURT.tenis[0], 0.8, COURT.tenis[1] - 4], fov: 62, area: COURT.tenis },
  { id: 'lapangan-atas', eye: [-86, 58, 975], look: [-86, 0, 939], fov: 55, area: COURT.basket },
  { id: 'lapangan-sejajar-kawasan', eye: [-135, 3, 975], look: [-86, 1, 940], fov: 60, area: COURT.basket },
  { id: 'gubuk-mata', eye: [-100, 1.7, 982], look: [-113, 1.8, 982], fov: 62, area: [-113, 982] },
  { id: 'gubuk-atas', eye: [-96, 24, 1005], look: [-113, 0, 982], fov: 55, area: [-113, 982] },
  { id: 'malam-d5', hour: 20.5, eye: [-98, 1.7, 1006.2], look: [D5[0], 1.8, D5[1]], fov: 62, area: [-98, 1006] },
  { id: 'malam-streetview', hour: 20.5, eye: [-137.1, 2.5, 999.5], heading: 98, fov: 75, pitch: -0.6, area: [-110, 1010] },
  { id: 'hujan-halaman', hour: 15, rain: true, eye: [-111, 1.7, 1006], look: [-100, 1.8, 1017], fov: 62, area: [-105, 1010] },
];
if (opts.list) {
  console.log(VIEWS.map((v) => v.id).join('\n'));
  process.exit(0);
}

const PAGE = {
  async prep() {
    const s = window.__sim;
    s.app.systems.remove('cameraRig');
    const st = document.createElement('style');
    st.textContent = 'body > *:not(#app):not(script):not(style) { display: none !important }';
    document.head.appendChild(st);
  },
  async shot({ view, waitMs }) {
    const s = window.__sim;
    const cam = s.app.camera;
    const h = (x, z) => s.terrain.heightAt(x, z);
    const [ax, az] = view.area;
    s.teleport(ax, az, 0);
    s.rig.focus.set(ax, h(ax, az), az);
    cam.position.set(ax, h(ax, az) + 3, az);
    await new Promise((r) => requestAnimationFrame(r));
    if (s.city) await s.city.whenSettled(ax, az, 1000, 90000);
    if (s.district?.whenSettled) await s.district.whenSettled(ax, az, 400);
    for (let t = 0; t < 300 && !s.regions.active().some((a) => a.def.id === 'unri-lembaga'); t += 1) await new Promise((r) => setTimeout(r, 100));
    const active = s.regions.active().find((a) => a.def.id === 'unri-lembaga');
    await Promise.resolve(active?.region?.ready);
    if (s.scheduler?.whenIdle) await s.scheduler.whenIdle();
    s.store.set('sky.hour', view.hour ?? 12);
    s.store.set('weather.raining', Boolean(view.rain));
    await new Promise((r) => setTimeout(r, waitMs));
    const [ex, ey0, ez] = view.eye;
    const ey = h(ex, ez) + ey0;
    let look;
    if (view.look) look = [view.look[0], h(view.look[0], view.look[2]) + view.look[1], view.look[2]];
    else {
      const a = (view.heading * Math.PI) / 180;
      const p = (view.pitch ?? 0) * (Math.PI / 180);
      look = [ex + Math.sin(a) * 60, ey + Math.tan(p) * 60, ez - Math.cos(a) * 60];
    }
    s.teleport(ex - 9, ez, 0);
    s.rig.focus.set(ex, h(ex, ez), ez);
    cam.fov = view.fov;
    cam.updateProjectionMatrix();
    for (let k = 0; k < 2; k += 1) {
      cam.position.set(ex, ey, ez);
      cam.lookAt(look[0], look[1], look[2]);
      cam.updateMatrixWorld(true);
      await new Promise((r) => setTimeout(r, 350));
    }
    const ri = s.app.renderer.info.render;
    s.app.renderFrame();
    s.app.renderFrame();
    const out = { calls: ri.calls, triangles: ri.triangles, eyeY: +ey.toFixed(2), groundY: +h(ex, ez).toFixed(2) };
    const grp = s.app.scene.getObjectByName('region:unri-lembaga');
    if (grp) {
      grp.visible = false;
      s.app.renderFrame();
      s.app.renderFrame();
      out.regionCalls = out.calls - ri.calls;
      out.regionTriangles = out.triangles - ri.triangles;
      grp.visible = true;
      const mine = ['ukm-gedung', 'ukm-kompleks', 'ukm-vegetasi', 'ukm-ring-basket'].map((n) => grp.getObjectByName(n)).filter(Boolean);
      const sub = {};
      for (const n of mine) {
        n.visible = false;
        s.app.renderFrame();
        s.app.renderFrame();
        sub[n.name] = { calls: out.calls - ri.calls, triangles: out.triangles - ri.triangles };
        n.visible = true;
      }
      mine.forEach((n) => { n.visible = false; });
      s.app.renderFrame();
      s.app.renderFrame();
      out.baruRegionCalls = out.calls - ri.calls;
      out.baruRegionTriangles = out.triangles - ri.triangles;
      mine.forEach((n) => { n.visible = true; });
      out.perBagian = sub;
      s.app.renderFrame();
    }
    return out;
  },
};

mkdirSync(resolve(ROOT, opts.out), { recursive: true });
const sim = await openSim({ gpu: opts.gpu, width: 1600, height: 818 });
const report = {};
try {
  await sim.page.evaluate(PAGE.prep);
  const only = opts.only?.split(',');
  for (const view of VIEWS.filter((v) => !only || only.includes(v.id))) {
    const t0 = Date.now();
    await settleAt(sim.page, { x: view.area[0], z: view.area[1], yaw: 0, hour: view.hour ?? 12, waitMs: 500 });
    report[view.id] = await sim.page.evaluate(PAGE.shot, { view, waitMs: Number(opts.wait) });
    const file = resolve(ROOT, opts.out, `sekre-ukm-${view.id}.jpg`);
    await sim.page.screenshot({ path: file, type: 'jpeg', quality: 86 });
    report[view.id].ms = Date.now() - t0;
  }
} finally {
  report.errors = sim.errors.slice(0, 20);
  await sim.close();
}
if (opts.report) writeFileSync(resolve(ROOT, opts.report), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
