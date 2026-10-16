/**
 * Tulis/baca GLB tile dengan glTF-Transform + EXT_meshopt_compression (meshoptimizer).
 * Kontrak node/mesh/material: lihat "Format tile v1" di rencana Plan B. Keluaran deterministik
 * (byte identik untuk input identik pada versi dependensi yang sama).
 */
import { Document, Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

/** Urutan node = urutan gambar bawah → atas. Node kosong tidak ditulis. */
export const MESH_NAMES = Object.freeze(['landuse', 'water', 'roads', 'buildings_walls', 'buildings_roofs']);

/** Bit kuantisasi posisi (14 bit atas rentang ±300 m ≈ 4 cm). */
const QUANTIZE_POSITION_BITS = 14;
/** Bit kuantisasi normal: 8 → int8 ternormalisasi (kontrak); default meshopt 'medium' = 10 (int16). */
const QUANTIZE_NORMAL_BITS = 8;

let ioPromise = null;

/** NodeIO dengan encoder/decoder meshopt siap (dibuat sekali). */
async function getIO() {
  ioPromise ??= Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]).then(() =>
    new NodeIO()
      .registerExtensions(ALL_EXTENSIONS)
      .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder }));
  return ioPromise;
}

function addMesh(doc, buffer, scene, name, arrays) {
  const accessor = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  const material = doc.createMaterial(name).setBaseColorFactor([1, 1, 1, 1]).setRoughnessFactor(1).setMetallicFactor(0);
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', accessor('VEC3', arrays.positions))
    .setAttribute('NORMAL', accessor('VEC3', arrays.normals))
    .setAttribute('COLOR_0', accessor('VEC3', arrays.colors))
    .setIndices(accessor('SCALAR', arrays.indices))
    .setMaterial(material);
  scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)));
}

/**
 * @param {Record<string, {positions: Float32Array, normals: Float32Array, colors: Float32Array,
 *   indices: Uint32Array}|null>} meshes per nama di MESH_NAMES
 * @param {string} sceneName mis. "tile_0_-1_lod0"
 * @returns {Promise<Uint8Array>}
 */
export async function writeTileGlb(meshes, sceneName) {
  const io = await getIO();
  const doc = new Document();
  doc.setLogger(new Logger(Logger.Verbosity.ERROR));
  const buffer = doc.createBuffer();
  const scene = doc.createScene(sceneName);
  doc.getRoot().setDefaultScene(scene);
  for (const name of MESH_NAMES) {
    if (meshes[name]) addMesh(doc, buffer, scene, name, meshes[name]);
  }
  await doc.transform(meshopt({
    encoder: MeshoptEncoder,
    level: 'medium',
    quantizePosition: QUANTIZE_POSITION_BITS,
    quantizeNormal: QUANTIZE_NORMAL_BITS,
  }));
  return io.writeBinary(doc);
}

/**
 * Ringkasan GLB (dipakai tes & verifikasi): nama scene, node berurutan, segitiga, atribut, ekstensi.
 * @returns {Promise<{scene: string, nodes: Array<{name: string, mesh: string, material: string,
 *   triangles: number, attributes: string[]}>, extensionsUsed: string[], extensionsRequired: string[]}>}
 */
export async function readGlbSummary(bytes) {
  const io = await getIO();
  const doc = await io.readBinary(bytes);
  const root = doc.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  const nodes = scene.listChildren().map((node) => {
    const prim = node.getMesh().listPrimitives()[0];
    return {
      name: node.getName(),
      mesh: node.getMesh().getName(),
      material: prim.getMaterial()?.getName() ?? '',
      triangles: prim.getIndices().getCount() / 3,
      attributes: prim.listSemantics().slice().sort(),
    };
  });
  return {
    scene: scene.getName(),
    nodes,
    extensionsUsed: root.listExtensionsUsed().map((e) => e.extensionName).sort(),
    extensionsRequired: root.listExtensionsRequired().map((e) => e.extensionName).sort(),
  };
}
