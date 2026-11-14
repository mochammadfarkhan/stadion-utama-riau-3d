/**
 * Model realistis sekre untuk preset Tinggi (keputusan user 2026-11-15): unduh model CC0 Poly Haven (glTF 1k) ke
 * data-src/polyhaven/, kecilkan tekstur ke 512 px (anggaran tekstur GPU), normalkan ukuran ke dimensi barang di
 * data.js (alas di y = 0, tengah di x/z = 0, depan −Z), tulis GLB ke public/models/sekre-hq/.
 *   node tools/sekrehq/build.mjs [--only meja,kursi]
 * Sumber & lisensi: CC0, https://polyhaven.com/a/<id>.
 */
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, textureCompress, getBounds, weld, simplify } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = join(ROOT, 'data-src', 'polyhaven');
const OUT = join(ROOT, 'public', 'models', 'sekre-hq');

/** fit 'dims' = skala per sumbu ke [w, d, h]; 'w' / 'h' = seragam menurut lebar / tinggi. rotY: putar agar depan −Z. */
export const MODEL = [
  { out: 'meja', id: 'metal_office_desk', fit: 'dims', size: [1.8, 0.6, 0.75], rotY: Math.PI },
  { out: 'kursi', id: 'SchoolChair_01', fit: 'h', size: 0.82, rotY: Math.PI },
  { out: 'kursi-ukir', id: 'chinese_armchair', fit: 'w', size: 0.6, rotY: Math.PI },
  { out: 'kardus', id: 'cardboard_box_01', fit: 'dims', size: [0.5, 0.4, 0.35], rotY: 0 },
  { out: 'tanaman', id: 'potted_plant_01', fit: 'h', size: 0.38, rotY: 0, ratio: 0.15 },
  { out: 'buku', id: 'book_encyclopedia_set_01', fit: 'w', size: 0.34, rotY: Math.PI, ratio: 0.2 },
  { out: 'map', id: 'binder_notebook', fit: 'w', size: 0.42, rotY: 0 },
  { out: 'lampu-meja', id: 'desk_lamp_arm_01', fit: 'h', size: 0.5, rotY: Math.PI },
  { out: 'rak-siku', id: 'worn_metal_rack', fit: 'dims', size: [0.8, 0.4, 1.6], rotY: 0 },
  { out: 'toolbox', id: 'metal_toolbox', fit: 'w', size: 0.4, rotY: Math.PI },
];

async function download(id) {
  const dir = join(SRC, id);
  const info = await (await fetch(`https://api.polyhaven.com/files/${id}`)).json();
  const g = info.gltf['1k'].gltf;
  const files = [[g.url, `${id}.gltf`], ...Object.entries(g.include).map(([rel, v]) => [v.url, rel])];
  for (const [url, rel] of files) {
    const p = join(dir, rel);
    if (existsSync(p)) continue;
    mkdirSync(dirname(p), { recursive: true });
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    writeFileSync(p, Buffer.from(await res.arrayBuffer()));
  }
  return join(dir, `${id}.gltf`);
}

async function build(spec, io) {
  const doc = await io.read(await download(spec.id));
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const wrap = doc.createNode('root');
  for (const n of scene.listChildren()) { scene.removeChild(n); wrap.addChild(n); }
  scene.addChild(wrap);
  wrap.setRotation([0, Math.sin(spec.rotY / 2), 0, Math.cos(spec.rotY / 2)]);
  let b = getBounds(scene);
  const ext = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]]; // x, y(tinggi), z
  let s;
  if (spec.fit === 'dims') s = [spec.size[0] / ext[0], spec.size[2] / ext[1], spec.size[1] / ext[2]];
  else { const k = spec.size / (spec.fit === 'w' ? ext[0] : ext[1]); s = [k, k, k]; }
  wrap.setScale(s);
  b = getBounds(scene);
  wrap.setTranslation([-(b.min[0] + b.max[0]) / 2, -b.min[1], -(b.min[2] + b.max[2]) / 2]);
  await MeshoptSimplifier.ready;
  const ratio = spec.ratio ?? 1;
  await doc.transform(weld(), ...(ratio < 1 ? [simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.002 })] : []), dedup(), prune(), textureCompress({ encoder: sharp, resize: [512, 512], quality: 82 }));
  for (const mat of doc.getRoot().listMaterials()) mat.setName(`hq:${spec.out}`);
  mkdirSync(OUT, { recursive: true });
  const outPath = join(OUT, `${spec.out}.glb`);
  await io.write(outPath, doc);
  b = getBounds(scene);
  console.log(spec.out, spec.id, 'ukuran', b.max.map((v, i) => (v - b.min[i]).toFixed(2)).join('×'));
}

const { values } = parseArgs({ options: { only: { type: 'string' } } });
const only = values.only ? new Set(values.only.split(',')) : null;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const spec of MODEL) if (!only || only.has(spec.out)) await build(spec, io);
