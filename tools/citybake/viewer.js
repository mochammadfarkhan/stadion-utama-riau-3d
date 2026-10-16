/**
 * Penampil tile citybake untuk verifikasi visual lokal (bukan bagian aplikasi; tidak ikut build).
 * Jalankan `npm run dev`, buka /tools/citybake/viewer.html?area=stadion&lod=0
 * (atau ?keys=0_0,-1_0). Sumbu di tengah area: merah = +X (timur), biru = +Z (selatan);
 * kerucut merah di tepi utara area menunjuk −Z (utara).
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const params = new URLSearchParams(window.location.search);
const lod = params.get('lod') === '1' ? 1 : 0;
const hud = document.getElementById('hud');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fb8cc);
scene.add(new THREE.HemisphereLight(0xffffff, 0x4a5a4a, 1.3));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(400, 700, 250);
scene.add(sun);
const tilesGroup = new THREE.Group();
scene.add(tilesGroup);
const axes = new THREE.AxesHelper(150);
scene.add(axes);
const north = new THREE.Mesh(new THREE.ConeGeometry(12, 40, 12), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
north.rotation.x = -Math.PI / 2; // ujung kerucut menunjuk −Z (utara)
scene.add(north);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 30000);
const controls = new OrbitControls(camera, renderer.domElement);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

async function loadTiles() {
  const res = await fetch('/tiles/manifest.json');
  if (!res.ok) throw new Error(`manifest.json: HTTP ${res.status}`);
  const manifest = await res.json();
  const area = manifest.areas.find((a) => a.id === params.get('area'));
  const keys = params.get('keys')?.split(',') ?? area?.tiles ?? manifest.tiles.slice(0, 1).map((t) => t.key);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  // Kontrak Format tile v1: lapisan datar digambar tanpa menulis depth, berurutan landuse → water → roads.
  const FLAT_ORDER = { landuse: -3, water: -2, roads: -1 };
  const solid = new THREE.MeshLambertMaterial({ vertexColors: true });
  const flat = new THREE.MeshLambertMaterial({ vertexColors: true, depthWrite: false });
  let triangles = 0;
  for (const key of keys) {
    const t = manifest.tiles.find((v) => v.key === key);
    if (!t) continue;
    const gltf = await loader.loadAsync(`/tiles/${t.lod[lod].file}`);
    gltf.scene.position.set((t.ix + 0.5) * manifest.tileSize, 0, (t.iz + 0.5) * manifest.tileSize);
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      const order = FLAT_ORDER[o.name];
      o.material = order === undefined ? solid : flat;
      o.renderOrder = order ?? 0;
      triangles += o.geometry.index.count / 3;
    });
    tilesGroup.add(gltf.scene);
  }
  const box = new THREE.Box3().setFromObject(tilesGroup);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3()).length();
  axes.position.set(center.x, 1, center.z);
  north.position.set(center.x, 2, box.min.z - 40);
  controls.target.copy(center);
  camera.position.set(center.x + size * 0.3, size * 0.45, center.z + size * 0.5);
  hud.textContent = `${keys.length} tile · LOD${lod} · ${triangles.toLocaleString('id-ID')} segitiga. `
    + 'Sumbu merah = timur (+X), biru = selatan (+Z); kerucut merah di tepi utara menunjuk utara.';
}

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});

loadTiles().catch((err) => {
  hud.textContent = `Gagal: ${err.message}`;
  console.error(err);
});
