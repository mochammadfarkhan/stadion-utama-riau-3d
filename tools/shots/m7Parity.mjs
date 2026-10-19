/**
 * Paritas draw call kawasan stadion (titik ukur kota (0, -275), jam 12): rerata 60 frame dengan kota, tanpa kota, tanpa
 * kehidupan kampus, tanpa distrik — pada pemuatan bersih (tanpa riwayat perjalanan/remount). Baseline M6: callsMean 555 (±2%).
 *   node tools/shots/m7Parity.mjs
 */
import { openSim } from '../../tests/e2e/harness.unri.mjs';
const sim = await openSim({ gpu: 'd3d11', port: 5182 });
try {
  const { page } = sim;
  const r = await page.evaluate(async () => {
    const s = window.__sim;
    s.rig.exitPov(); s.store.set('sky.advanceTime', false); s.store.set('sky.hour', 12); s.store.set('weather.raining', false); s.store.set('camera.mode', 'third');
    s.teleport(0, -275, 0);
    await s.city.whenSettled(0, -275, 1000, 90000);
    await new Promise((r) => setTimeout(r, 2000));
    const sample = async () => {
      const calls = [];
      for (let i = 0; i < 60; i += 1) { await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))); calls.push(s.app.renderer.info.render.calls); }
      return Math.round(calls.reduce((a, b) => a + b, 0) / calls.length);
    };
    const withCity = await sample();
    s.city.group.visible = false;
    const regionOnly = await sample();
    s.city.group.visible = true;
    const life = s.district.district.life.group; life.visible = false;
    const noLife = await sample(); life.visible = true;
    const dist = s.district.district.group; dist.visible = false;
    const noDistrict = await sample(); dist.visible = true;
    return { callsMean: withCity, callsMeanRegionOnly: regionOnly, tanpaKehidupan: noLife, tanpaDistrik: noDistrict };
  });
  console.log(JSON.stringify(r));
} finally { await sim.close(); }
