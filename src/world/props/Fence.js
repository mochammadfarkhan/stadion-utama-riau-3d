/**
 * Pagar besi: tiang + rel atas/bawah + jeruji vertikal (semua InstancedMesh, geometri dibagi),
 * mengikuti polyline titik. createGateFence(): gerbang dua daun, satu terbuka, satu rusak.
 */
import { BoxGeometry, Group, Matrix4, Mesh, Quaternion, Vector3 } from 'three';
import { Materials } from '../materials.js';
import { instancedFromMatrices, segmentMatrix } from '../util/instancing.js';
import { currentScope } from '../../engine/ResourceScope.js';

const POST_SIZE = 0.08;
const RAIL_SIZE = 0.05;
const BAR_SIZE = 0.025;
const RAIL_BOTTOM_Y = 0.3;
const RAIL_TOP_INSET = 0.1;
const BAR_TOP_PAD = 0.1;
const GATE_POST_SIZE = 0.2;
const BROKEN_TILT = -0.1;  // rad, ujung daun turun
const BROKEN_YAW = 0.35;
const BROKEN_LIFT = 0.4;   // engsel terangkat agar ujung daun tepat di tanah
const BROKEN_BAR_SKIP = 3; // tiap jeruji ke-3 hilang

const UNIT_UP = () => currentScope().get('Fence:UNIT_UP', () => new BoxGeometry(1, 1, 1).translate(0, 0.5, 0)); // alas di y=0
const UNIT_Z = () => currentScope().get('Fence:UNIT_Z', () => new BoxGeometry(1, 1, 1));

/** Normalisasi titik {x,z} atau [x,z] → Vector3 di y=0. */
function toPath(points, closed) {
  const pts = points.map((p) => (Array.isArray(p) ? new Vector3(p[0], 0, p[1]) : new Vector3(p.x, 0, p.z)));
  return closed && pts.length > 1 ? [...pts, pts[0].clone()] : pts;
}

function uprightMatrix(pos, size, height) {
  return new Matrix4().compose(pos, new Quaternion(), new Vector3(size, height, size));
}

/** Kumpulkan matriks tiang, rel, dan jeruji untuk satu segmen a→b. */
function collectSegment(a, b, cfg, out) {
  const len = a.distanceTo(b);
  const dir = b.clone().sub(a).normalize();
  const postCount = Math.max(1, Math.round(len / cfg.postSpacing));
  for (let i = 1; i < postCount; i++) {
    out.posts.push(uprightMatrix(a.clone().addScaledVector(dir, (i / postCount) * len), POST_SIZE, cfg.height));
  }
  [RAIL_BOTTOM_Y, cfg.height - RAIL_TOP_INSET].forEach((y) => {
    out.rails.push(segmentMatrix(a.clone().setY(y), b.clone().setY(y), RAIL_SIZE));
  });
  const barCount = Math.floor(len / cfg.barSpacing);
  const barH = cfg.height - RAIL_TOP_INSET - BAR_TOP_PAD;
  for (let i = 1; i < barCount; i++) {
    if (!cfg.barFilter(i)) continue;
    out.bars.push(uprightMatrix(a.clone().addScaledVector(dir, i * cfg.barSpacing), BAR_SIZE, barH));
  }
}

/**
 * @param {{points:Array<{x:number,z:number}|number[]>, height?:number, postSpacing?:number, barSpacing?:number, closed?:boolean, barFilter?:(i:number)=>boolean}} opts
 * @returns {Group}
 */
export function createFence({ points = [], height = 2, postSpacing = 3, barSpacing = 0.14, closed = false, barFilter = () => true } = {}) {
  const group = new Group();
  group.name = 'fence';
  const path = toPath(points, closed);
  const cfg = { height, postSpacing, barSpacing, barFilter };
  const out = { posts: [], rails: [], bars: [] };
  path.forEach((p, i) => {
    if (!(closed && i === path.length - 1)) out.posts.push(uprightMatrix(p, POST_SIZE, height));
    if (i < path.length - 1) collectSegment(p, path[i + 1], cfg, out);
  });
  const iron = Materials.iron();
  group.add(instancedFromMatrices(UNIT_UP(), iron, out.posts, 'fence-posts'));
  group.add(instancedFromMatrices(UNIT_Z(), iron, out.rails, 'fence-rails'));
  group.add(instancedFromMatrices(UNIT_UP(), iron, out.bars, 'fence-bars'));
  group.userData = { height, length: path.reduce((s, p, i) => (i ? s + p.distanceTo(path[i - 1]) : 0), 0) };
  return group;
}

/** Satu daun gerbang sepanjang +X lokal, engsel di origin. */
function createLeaf(length, height, broken) {
  const leaf = createFence({
    points: [[0, 0], [length, 0]],
    height,
    postSpacing: length,
    barFilter: broken ? (i) => i % BROKEN_BAR_SKIP !== 0 : () => true,
  });
  leaf.name = broken ? 'leaf-broken' : 'leaf';
  return leaf;
}

/**
 * Gerbang pagar: tiang tebal kiri-kanan, daun kiri terbuka, daun kanan rusak (miring, jeruji hilang).
 * Bentang sepanjang sumbu X lokal dari 0..width.
 * @param {{width?:number, height?:number, openAngle?:number, broken?:boolean}} opts
 */
export function createGateFence({ width = 8, height = 2.2, openAngle = 1.1, broken = true } = {}) {
  const group = new Group();
  group.name = 'gate-fence';
  const iron = Materials.iron();
  [0, width].forEach((x, i) => {
    const post = new Mesh(UNIT_UP(), iron);
    post.scale.set(GATE_POST_SIZE, height + 0.3, GATE_POST_SIZE);
    post.position.x = x;
    post.name = `gate-post-${i}`;
    group.add(post);
  });
  const leafA = createLeaf(width / 2, height, false);
  leafA.rotation.y = openAngle;
  const leafB = createLeaf(width / 2, height, broken);
  leafB.position.set(width, broken ? BROKEN_LIFT : 0, 0); // engsel lepas: daun terangkat, ujung menyentuh tanah
  leafB.rotation.set(0, Math.PI + (broken ? BROKEN_YAW : 0), broken ? BROKEN_TILT : 0);
  group.add(leafA, leafB);
  group.userData = { width, height, open: openAngle > 0, broken };
  return group;
}
