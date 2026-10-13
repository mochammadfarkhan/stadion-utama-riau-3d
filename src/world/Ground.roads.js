import * as THREE from 'three';
import { SITE } from '../config/constants.js';
import { ellipseRingGeometry, distributeOnEllipse } from './siteutil/ellipseGeo.js';
import { instancePart, localMatrix } from './siteutil/instanceParts.js';
import { groundMaterials, LAYER_Y } from './Ground.materials.js';

/**
 * Jalan lingkar, Jl. Naga Sakti, jalan penghubung, parkir, jogging track.
 * Semua datar di bidang XZ; marka = InstancedMesh kotak tipis.
 */
const DASH = Object.freeze({ length: 3, width: 0.15, thickness: 0.02, gap: 6 });
const KERB_WIDTH = 0.35;
const SIDEWALK_WIDTH = 2.5;
const CONNECTOR_WIDTH = 8;
const PARKING = Object.freeze({
  carBayW: 2.5, carBayD: 5, motoBayW: 1.0, motoBayD: 2.2, lineW: 0.12,
});

const dashGeometry = new THREE.BoxGeometry(DASH.length, DASH.thickness, DASH.width);

function flatMesh(geometry, material, y, name) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = y;
  mesh.receiveShadow = true;
  mesh.name = name;
  return mesh;
}

/** Jalan lingkar aspal oval + marka putus-putus + kerb + trotoar dua sisi. */
export function createRingRoad() {
  const m = groundMaterials();
  const { ringRoadSemiX: ax, ringRoadSemiZ: az, ringRoadWidth: w } = SITE;
  const g = new THREE.Group();
  g.name = 'ringRoad';
  const half = w / 2;
  g.add(flatMesh(ellipseRingGeometry(ax + half, az + half, ax - half, az - half), m.asphalt, LAYER_Y.road, 'aspal'));
  // kerb luar & dalam
  g.add(flatMesh(ellipseRingGeometry(ax + half + KERB_WIDTH, az + half + KERB_WIDTH, ax + half, az + half), m.kerb, LAYER_Y.kerb, 'kerbLuar'));
  g.add(flatMesh(ellipseRingGeometry(ax - half, az - half, ax - half - KERB_WIDTH, az - half - KERB_WIDTH), m.kerb, LAYER_Y.kerb, 'kerbDalam'));
  // trotoar
  const so = half + KERB_WIDTH;
  g.add(flatMesh(ellipseRingGeometry(ax + so + SIDEWALK_WIDTH, az + so + SIDEWALK_WIDTH, ax + so, az + so), m.sidewalk, LAYER_Y.sidewalk, 'trotoarLuar'));
  g.add(flatMesh(ellipseRingGeometry(ax - so, az - so, ax - so - SIDEWALK_WIDTH, az - so - SIDEWALK_WIDTH), m.sidewalk, LAYER_Y.sidewalk, 'trotoarDalam'));
  // garis tengah putus-putus
  const perimeter = Math.PI * (3 * (ax + az) - Math.sqrt((3 * ax + az) * (ax + 3 * az)));
  const count = Math.floor(perimeter / (DASH.length + DASH.gap));
  const pts = distributeOnEllipse(ax, az, count).map((p) => ({ ...p, y: LAYER_Y.marking }));
  g.add(instancePart({ geometry: dashGeometry, material: m.lineWhite, name: 'markaLingkar' }, pts));
  return g;
}

/** Marka putus-putus lurus sepanjang sumbu X pada z tertentu. */
function dashesAlongX(z, xFrom, xTo, material) {
  const pts = [];
  for (let x = xFrom; x < xTo; x += DASH.length + DASH.gap) {
    pts.push({ x: x + DASH.length / 2, z, y: LAYER_Y.marking, rotY: 0 });
  }
  return instancePart({ geometry: dashGeometry, material }, pts);
}

/** Marka putus-putus lurus sepanjang sumbu Z pada x tertentu. */
function dashesAlongZ(x, zFrom, zTo, material) {
  const pts = [];
  for (let z = zFrom; z < zTo; z += DASH.length + DASH.gap) {
    pts.push({ x, z: z + DASH.length / 2, y: LAYER_Y.marking, rotY: Math.PI / 2 });
  }
  return instancePart({ geometry: dashGeometry, material }, pts);
}

/** Jl. Naga Sakti: 3 lajur sejajar X, marka lajur, garis tepi, trotoar. */
export function createNagaSakti() {
  const m = groundMaterials();
  const g = new THREE.Group();
  g.name = 'jlNagaSakti';
  const len = SITE.groundSize * 0.98;
  const width = SITE.nagaSaktiLanes * SITE.laneWidth;
  const z = SITE.nagaSaktiZ;
  const road = flatMesh(new THREE.PlaneGeometry(len, width), m.asphalt, LAYER_Y.road, 'aspal');
  road.rotation.x = -Math.PI / 2;
  road.position.z = z;
  g.add(road);
  for (let i = 1; i < SITE.nagaSaktiLanes; i += 1) {
    g.add(dashesAlongX(z - width / 2 + i * SITE.laneWidth, -len / 2, len / 2, m.lineWhite));
  }
  [-1, 1].forEach((s) => {
    const edge = flatMesh(new THREE.BoxGeometry(len, DASH.thickness, DASH.width), m.lineWhite, LAYER_Y.marking, 'garisTepi');
    edge.position.z = z + s * (width / 2 - 0.3);
    g.add(edge);
    const walk = flatMesh(new THREE.BoxGeometry(len, 0.12, SIDEWALK_WIDTH), m.sidewalk, LAYER_Y.sidewalk, 'trotoar');
    walk.position.z = z + s * (width / 2 + SIDEWALK_WIDTH / 2);
    g.add(walk);
  });
  return g;
}

/** Z tepi jalan lingkar (sisi utara, negatif) pada x tertentu. */
function ringRoadZAt(x) {
  const { ringRoadSemiX: ax, ringRoadSemiZ: az } = SITE;
  const k = Math.max(0, 1 - (x * x) / (ax * ax));
  return -az * Math.sqrt(k);
}

/** Jalan penghubung lurus dari Jl. Naga Sakti ke jalan lingkar (sejajar Z). */
export function createConnectorRoads() {
  const m = groundMaterials();
  const g = new THREE.Group();
  g.name = 'jalanPenghubung';
  SITE.connectorXs.forEach((x) => {
    const zFrom = SITE.nagaSaktiZ;
    const zTo = ringRoadZAt(x) + SITE.ringRoadWidth / 2;
    const len = zTo - zFrom;
    const road = flatMesh(new THREE.PlaneGeometry(CONNECTOR_WIDTH, len), m.asphalt, LAYER_Y.road + 0.005, 'aspal');
    road.rotation.x = -Math.PI / 2;
    road.position.set(x, road.position.y, (zFrom + zTo) / 2);
    g.add(road);
    g.add(dashesAlongZ(x, zFrom + 8, zTo - 8, m.lineWhite));
  });
  return g;
}

/** Blok parkir aspal dengan garis bay putih. kind: 'car' | 'moto'. */
export function createParkingLot(kind = 'car') {
  const m = groundMaterials();
  const cfg = kind === 'car' ? SITE.parkingCar : SITE.parkingMoto;
  const bayW = kind === 'car' ? PARKING.carBayW : PARKING.motoBayW;
  const bayD = kind === 'car' ? PARKING.carBayD : PARKING.motoBayD;
  const g = new THREE.Group();
  g.name = kind === 'car' ? 'parkirMobil' : 'parkirMotor';
  const lot = flatMesh(new THREE.PlaneGeometry(cfg.w, cfg.d), m.asphalt, LAYER_Y.road, 'aspal');
  lot.rotation.x = -Math.PI / 2;
  lot.position.set(cfg.x, LAYER_Y.road, cfg.z);
  g.add(lot);
  // dua baris bay di tepi utara & selatan blok, lorong di tengah
  const lineGeo = new THREE.BoxGeometry(PARKING.lineW, DASH.thickness, bayD);
  const pts = [];
  const cols = Math.floor(cfg.w / bayW);
  for (let i = 0; i <= cols; i += 1) {
    const x = cfg.x - cfg.w / 2 + i * bayW;
    pts.push({ x, z: cfg.z - cfg.d / 2 + bayD / 2, y: LAYER_Y.parkingLine });
    pts.push({ x, z: cfg.z + cfg.d / 2 - bayD / 2, y: LAYER_Y.parkingLine });
  }
  g.add(instancePart({ geometry: lineGeo, material: m.lineWhite, name: 'garisParkir' }, pts));
  g.userData.bays = pts;
  return g;
}

/** Jalur jogging eco (merah bata) di luar jalan lingkar. */
export function createJoggingTrack() {
  const m = groundMaterials();
  const { ringRoadSemiX: ax, ringRoadSemiZ: az, joggingTrackOffset: off, joggingTrackWidth: w } = SITE;
  const geo = ellipseRingGeometry(ax + off + w / 2, az + off + w / 2, ax + off - w / 2, az + off - w / 2);
  return flatMesh(geo, m.joggingTrack, LAYER_Y.plaza, 'joggingTrack');
}

/** Lintasan sepatu roda: oval kecil aspal + kerb. */
export function createSkateTrack() {
  const m = groundMaterials();
  const { x, z } = SITE.skateCenter;
  const g = new THREE.Group();
  g.name = 'lintasanSepatuRoda';
  g.add(flatMesh(ellipseRingGeometry(28, 16, 18, 8, 64), m.asphaltPlain, LAYER_Y.road, 'aspal'));
  g.add(flatMesh(ellipseRingGeometry(28.4, 16.4, 28, 16, 64), m.kerb, LAYER_Y.kerb, 'kerb'));
  g.add(flatMesh(ellipseRingGeometry(18, 8, 17.6, 7.6, 64), m.kerb, LAYER_Y.kerb, 'kerbDalam'));
  const dashes = distributeOnEllipse(23, 12, 14, 360).map((p) => ({ ...p, y: LAYER_Y.marking }));
  g.add(instancePart({ geometry: dashGeometry, material: m.lineYellow, matrix: localMatrix(0, 0, 0, 0, 0, 0, 0.6, 1, 1) }, dashes));
  g.position.set(x, 0, z);
  return g;
}
