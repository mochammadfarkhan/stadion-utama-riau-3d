import { createDynamicCompositeCollider } from '../core/Collider.js';
import { createScheduler } from '../engine/scheduler.js';
import { createRegionManager } from './regionManager.js';
import { createTerrainService } from './terrainService.js';

/**
 * Lapisan multi-region (M0): terrain (stub datar), scheduler time-sliced, collider komposit dinamis, dan
 * region manager. Sistem `regions` (sim) memasang/melepas region streaming menurut fokus; `scheduler` (ui,
 * akhir frame sebelum render) menjalankan pekerjaan berat region ≤ 4 ms/frame.
 */
export function createRegionLayer({ app, store, time, weather, lifecycle }) {
  const terrain = createTerrainService();
  const scheduler = createScheduler();
  const colliders = createDynamicCompositeCollider();
  const regions = createRegionManager({ app, store, time, weather, terrain, collider: colliders, scheduler });
  lifecycle.add(() => regions.dispose()); // LIFO: region dicabut sebelum time/weather di-dispose
  app.addSystem({ id: 'regions', phase: 'sim', update: (dt, ctx) => regions.update(ctx.focus) });
  app.addSystem({ id: 'scheduler', phase: 'ui', update: () => scheduler.update() });
  return { regions, scheduler, terrain, colliders };
}
