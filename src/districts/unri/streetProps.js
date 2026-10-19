/**
 * P04 bangku beton taman (reuse Bench 'semen') dan P05 tong sampah kampus per chunk dari props ground.
 * Panggil di dalam withScope(scopeDistrik) (geometri/material props memakai currentScope).
 */
import { Group } from 'three';
import { createBenches } from '../../world/props/Bench.js';
import { createTongSampahKampusInstances } from '../../world/props/unri/tongSampahKampus.js';

export function buildStreetProps({ benches, bins }, heightAt) {
  const g = new Group();
  g.name = 'unri:props';
  if (benches.length) {
    g.add(createBenches(benches.map((b) => ({ x: b.x, z: b.z, y: heightAt(b.x, b.z), rotY: b.yaw, type: 'semen' }))));
  }
  if (bins.length) g.add(createTongSampahKampusInstances(bins.map((b) => ({ x: b.x, z: b.z, y: heightAt(b.x, b.z) }))));
  return g;
}
