/**
 * Jaringan MRT & LRT Pekanbaru di mode Kota (elevated viaduct, stasiun layang, dan kereta berjalan).
 * Dibuat malas saat pratinjau K pertama; semua geometri digabung/instanced (±5 draw call total).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FACADE_UNIFORMS } from './facade.js';
import { TRANSIT_LINES, buildTrack, sampleTrackAt, buildSchedule, trainStateAt } from './transitData.js';

const COLOR_DECK = new THREE.Color('#c8ccd4');
const COLOR_PARAPET = new THREE.Color('#dfe3ea');
const COLOR_RAIL = new THREE.Color('#343842');
const COLOR_PILLAR = new THREE.Color('#aeb4be');
const COLOR_ROOF = new THREE.Color('#eef2f7');
const COLOR_BODY = new THREE.Color('#f7f9fc');
const COLOR_TRAIN_ROOF = new THREE.Color('#5a6270');
const COLOR_WINDOW = new THREE.Color('#131922');

/** Beri atribut vertex `color` seragam ke BufferGeometry. */
function paintGeo(geo, color) {
  const count = geo.attributes.position.count;
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    arr[i * 3] = color.r;
    arr[i * 3 + 1] = color.g;
    arr[i * 3 + 2] = color.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

/** Buat BoxGeometry berpusat di (x, y, z) dan diputar terhadap sumbu Y sebesar `yaw`, sudah ber-vertexColors. */
function makeBox(w, h, d, x, y, z, yaw, color) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (yaw) g.rotateY(yaw);
  g.translate(x, y, z);
  return paintGeo(g, color);
}

/** Material aksen jalur & jendela kereta: siang ikut matahari, malam menyala lembut via FACADE_UNIFORMS.uNight. */
function createNightAccentMaterial(name, glowStrength = 0.7) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  mat.name = name;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = FACADE_UNIFORMS.uNight;
    shader.fragmentShader = `uniform float uNight;\n${shader.fragmentShader}`.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      #ifdef USE_COLOR
        float lum = dot(vColor.rgb, vec3(0.299, 0.587, 0.114));
        float winMask = 1.0 - smoothstep(0.03, 0.08, lum);
        totalEmissiveRadiance += uNight * (winMask * vec3(1.0, 0.82, 0.45) * 0.95 + (1.0 - winMask) * vColor.rgb * ${glowStrength.toFixed(2)});
      #endif`,
    );
  };
  mat.customProgramCacheKey = () => `transitNight-${glowStrength.toFixed(2)}`;
  return mat;
}

/** Bangun geometri gabungan satu segmen viaduct + rel + strip aksen. */
function appendTrackMeshes(track, structParts, accentParts) {
  const { pts, line } = track;
  const { elevation: y, deckWidth: dw, trackOffset: toff } = line;
  const lineColor = new THREE.Color(line.color);

  for (let i = 0; i < pts.length - 1; i += 1) {
    const [x0, z0] = pts[i];
    const [x1, z1] = pts[i + 1];
    const dx = x1 - x0;
    const dz = z1 - z0;
    const segLen = Math.hypot(dx, dz);
    if (segLen < 0.2) continue;
    const mx = (x0 + x1) * 0.5;
    const mz = (z0 + z1) * 0.5;
    const yaw = Math.atan2(dx, dz);
    const nx = dz / segLen;
    const nz = -dx / segLen;
    const lenPad = segLen + 0.35;

    // Dek beton + parapet kiri/kanan + dua jalur rel
    structParts.push(makeBox(dw, 1.0, lenPad, mx, y - 0.5, mz, yaw, COLOR_DECK));
    const pOff = dw * 0.5 - 0.25;
    structParts.push(makeBox(0.45, 0.75, lenPad, mx + nx * pOff, y + 0.35, mz + nz * pOff, yaw, COLOR_PARAPET));
    structParts.push(makeBox(0.45, 0.75, lenPad, mx - nx * pOff, y + 0.35, mz - nz * pOff, yaw, COLOR_PARAPET));
    structParts.push(makeBox(1.1, 0.18, lenPad, mx + nx * toff, y + 0.09, mz + nz * toff, yaw, COLOR_RAIL));
    structParts.push(makeBox(1.1, 0.18, lenPad, mx - nx * toff, y + 0.09, mz - nz * toff, yaw, COLOR_RAIL));

    // Strip warna jalur di tepi luar dek (menyala malam)
    const sOff = dw * 0.5 + 0.04;
    accentParts.push(makeBox(0.16, 0.38, lenPad, mx + nx * sOff, y - 0.15, mz + nz * sOff, yaw, lineColor));
    accentParts.push(makeBox(0.16, 0.38, lenPad, mx - nx * sOff, y - 0.15, mz - nz * sOff, yaw, lineColor));
  }
}

/** Bangun geometri stasiun layang (peron, kanopi, papan jalur) di setiap titik stasiun. */
function appendStations(track, structParts, accentParts) {
  const { line, stationS } = track;
  const { elevation: y, deckWidth: dw, stations } = line;
  const lineColor = new THREE.Color(line.color);
  const accentColor = new THREE.Color(line.accent);
  const sample = { x: 0, z: 0, ux: 1, uz: 0 };

  for (let i = 0; i < stations.length; i += 1) {
    const st = stations[i];
    sampleTrackAt(track, stationS[i], sample);
    const yaw = Math.atan2(sample.ux, sample.uz);
    const nx = sample.uz;
    const nz = -sample.ux;
    const stLen = st.interchange ? 74 : 58;
    const stWidth = dw + (st.interchange ? 8.5 : 6.2);

    // Peron kanan & kiri di samping rel + dinding kaca peron
    const sideOff = dw * 0.5 + (stWidth - dw) * 0.25;
    const pW = (stWidth - dw) * 0.5;
    structParts.push(makeBox(pW, 1.1, stLen, st.x + nx * sideOff, y + 0.35, st.z + nz * sideOff, yaw, COLOR_PARAPET));
    structParts.push(makeBox(pW, 1.1, stLen, st.x - nx * sideOff, y + 0.35, st.z - nz * sideOff, yaw, COLOR_PARAPET));
    // Kanopi lengkung 3-segmen modern (atap tengah tinggi + sayap miring kiri-kanan)
    structParts.push(makeBox(stWidth * 0.56, 0.42, stLen + 2.4, st.x, y + 5.75, st.z, yaw, COLOR_ROOF));
    for (const sg of [-1, 1]) {
      const wx = st.x + nx * (stWidth * 0.36 * sg);
      const wz = st.z + nz * (stWidth * 0.36 * sg);
      const wing = new THREE.BoxGeometry(stWidth * 0.38, 0.32, stLen + 2.2);
      wing.rotateZ(-0.28 * sg);
      if (yaw) wing.rotateY(yaw);
      wing.translate(wx, y + 5.25, wz);
      structParts.push(paintGeo(wing, COLOR_ROOF));
      // Tiang penyangga tepi peron
      for (const dz of [-stLen * 0.38, 0, stLen * 0.38]) {
        const px = st.x + nx * (stWidth * 0.45 * sg) + sample.ux * dz;
        const pz = st.z + nz * (stWidth * 0.45 * sg) + sample.uz * dz;
        structParts.push(makeBox(0.45, 4.4, 0.45, px, y + 2.9, pz, yaw, COLOR_PILLAR));
      }
    }

    // Pita warna jalur & skylight kaca di puncak kanopi stasiun
    accentParts.push(makeBox(stWidth * 0.44, 0.22, stLen + 1.2, st.x, y + 6.02, st.z, yaw, lineColor));
    for (const sg of [-1, 1]) {
      accentParts.push(makeBox(0.28, 0.36, stLen + 2.4, st.x + nx * (stWidth * 0.53 * sg), y + 4.82, st.z + nz * (stWidth * 0.53 * sg), yaw, lineColor));
    }
    if (st.interchange) {
      // Mahkota emas Melayu untuk stasiun hub Living World / SKA
      accentParts.push(makeBox(stWidth * 0.65, 0.38, 10, st.x, y + 6.22, st.z, yaw, accentColor));
    }
  }
}

/** Bangun skybridge penghubung antara Stasiun MRT & LRT di Living World / SKA. */
function appendInterchangeBridge(tracks, structParts, accentParts) {
  const mrt = tracks.find((t) => t.line.id === 'mrt');
  const lrt = tracks.find((t) => t.line.id === 'lrt');
  if (!mrt || !lrt) return;
  const sMrt = mrt.line.stations.find((s) => s.interchange);
  const sLrt = lrt.line.stations.find((s) => s.interchange);
  if (!sMrt || !sLrt) return;

  const dx = sLrt.x - sMrt.x;
  const dz = sLrt.z - sMrt.z;
  const dist = Math.hypot(dx, dz);
  const mx = (sMrt.x + sLrt.x) * 0.5;
  const mz = (sMrt.z + sLrt.z) * 0.5;
  const midY = (mrt.line.elevation + lrt.line.elevation) * 0.5;
  const yaw = Math.atan2(dx, dz);
  structParts.push(makeBox(7.2, 1.2, dist + 6, mx, midY, mz, yaw, COLOR_PARAPET));
  accentParts.push(makeBox(7.5, 0.45, dist + 6, mx, midY + 1.8, mz, yaw, new THREE.Color('#f5b82e')));
}

/** Bangun geometri gerbong kereta (bodi putih, atap abu, jendela gelap, strip warna jalur). */
function buildCarGeometry(line) {
  const { carWidth: w, carHeight: h, carLength: l } = line;
  const lineColor = new THREE.Color(line.color);
  const accentColor = new THREE.Color(line.accent);
  const parts = [
    makeBox(w, h * 0.72, l, 0, h * 0.36, 0, 0, COLOR_BODY),
    makeBox(w * 0.92, h * 0.24, l * 0.96, 0, h * 0.84, 0, 0, COLOR_TRAIN_ROOF),
    // Jendela memanjang (luminans < 0.05 → menyala kuning hangat di malam hari)
    makeBox(w + 0.08, h * 0.28, l * 0.82, 0, h * 0.52, 0, 0, COLOR_WINDOW),
    // Strip warna jalur + aksen emas
    makeBox(w + 0.1, h * 0.14, l * 0.94, 0, h * 0.24, 0, 0, lineColor),
    makeBox(w + 0.09, h * 0.07, l * 0.94, 0, h * 0.12, 0, 0, accentColor),
  ];
  return mergeGeometries(parts, false);
}

/** Bangun geometri pilar T-pier untuk InstancedMesh. */
function buildPillarGeometry() {
  const col = paintGeo(new THREE.CylinderGeometry(0.75, 0.95, 1, 8), COLOR_PILLAR);
  col.translate(0, 0.5, 0);
  const cap = makeBox(4.8, 0.9, 1.8, 0, 1.0, 0, 0, COLOR_PILLAR);
  return mergeGeometries([col, cap], false);
}

/**
 * Buat jaringan MRT & LRT Pekanbaru di bawah `parent`.
 * @param {{parent: THREE.Object3D}} opts
 */
export function createTransitLines({ parent }) {
  const group = new THREE.Group();
  group.name = 'transitKota';
  group.visible = false;
  parent.add(group);

  const tracks = TRANSIT_LINES.map((line) => buildTrack(line));
  const schedules = tracks.map((t) => buildSchedule(t));

  const structParts = [];
  const accentParts = [];
  const pillarSpots = [];
  const pSample = { x: 0, z: 0, ux: 1, uz: 0 };

  for (const track of tracks) {
    appendTrackMeshes(track, structParts, accentParts);
    appendStations(track, structParts, accentParts);
    const step = track.line.pillarSpacing;
    for (let s = step * 0.5; s < track.len - step * 0.3; s += step) {
      sampleTrackAt(track, s, pSample);
      pillarSpots.push({
        x: pSample.x,
        z: pSample.z,
        h: track.line.elevation - 1.1,
        yaw: Math.atan2(pSample.ux, pSample.uz),
      });
    }
  }
  appendInterchangeBridge(tracks, structParts, accentParts);

  const structMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  structMat.name = 'transit:struktur';
  const accentMat = createNightAccentMaterial('transit:aksen', 0.65);
  const trainMat = createNightAccentMaterial('transit:kereta', 0.35);

  const structGeo = mergeGeometries(structParts, false);
  const structMesh = new THREE.Mesh(structGeo, structMat);
  structMesh.name = 'transitViaduct';
  structMesh.castShadow = true;
  structMesh.receiveShadow = true;
  group.add(structMesh);

  const accentGeo = mergeGeometries(accentParts, false);
  const accentMesh = new THREE.Mesh(accentGeo, accentMat);
  accentMesh.name = 'transitAksen';
  group.add(accentMesh);

  // Pilar instanced
  const pillarGeo = buildPillarGeometry();
  const pillarMesh = new THREE.InstancedMesh(pillarGeo, structMat, pillarSpots.length);
  pillarMesh.name = 'transitPilar';
  const dummy = new THREE.Object3D();
  for (let i = 0; i < pillarSpots.length; i += 1) {
    const p = pillarSpots[i];
    dummy.position.set(p.x, -0.05, p.z);
    dummy.rotation.set(0, p.yaw, 0);
    dummy.scale.set(1, p.h, 1);
    dummy.updateMatrix();
    pillarMesh.setMatrixAt(i, dummy.matrix);
  }
  pillarMesh.instanceMatrix.needsUpdate = true;
  group.add(pillarMesh);

  // Kereta instanced per jalur (MRT 4 gerbong, LRT 3 gerbong)
  const trainMeshes = tracks.map((track, ti) => {
    const { line } = track;
    const geo = buildCarGeometry(line);
    const totalCars = line.trains * line.cars;
    const mesh = new THREE.InstancedMesh(geo, trainMat, totalCars);
    mesh.name = `transitKereta:${line.id}`;
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    group.add(mesh);
    return { track, schedule: schedules[ti], mesh };
  });

  // Scratch objects di closure (nol alokasi per frame)
  const _mat = new THREE.Matrix4();
  const _pos = new THREE.Vector3();
  const _quat = new THREE.Quaternion();
  const _scale = new THREE.Vector3(1, 1, 1);
  const _axisY = new THREE.Vector3(0, 1, 0);
  const _state = { s: 0, dir: 1 };
  const _sample = { x: 0, z: 0, ux: 1, uz: 0 };

  const update = (timeSec) => {
    if (!group.visible) return;
    for (const { track, schedule, mesh } of trainMeshes) {
      const { line } = track;
      const stride = line.carLength + line.carGap;
      const halfSpan = ((line.cars - 1) * stride) * 0.5;
      let idx = 0;
      for (let t = 0; t < line.trains; t += 1) {
        trainStateAt(schedule, t, line.trains, timeSec, _state);
        const side = _state.dir > 0 ? line.trackOffset : -line.trackOffset;
        for (let c = 0; c < line.cars; c += 1) {
          const carOffset = (c * stride - halfSpan) * _state.dir;
          const s = Math.max(0, Math.min(track.len, _state.s + carOffset));
          sampleTrackAt(track, s, _sample);
          const nx = _sample.uz;
          const nz = -_sample.ux;
          _pos.set(_sample.x + nx * side, line.elevation + 0.15, _sample.z + nz * side);
          const yaw = Math.atan2(_sample.ux * _state.dir, _sample.uz * _state.dir);
          _quat.setFromAxisAngle(_axisY, yaw);
          _mat.compose(_pos, _quat, _scale);
          mesh.setMatrixAt(idx, _mat);
          idx += 1;
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  };

  return {
    group,
    setActive(on) { group.visible = Boolean(on); },
    update,
    stats: () => ({
      lines: tracks.length,
      stations: tracks.reduce((n, t) => n + t.line.stations.length, 0),
      pillars: pillarSpots.length,
    }),
    dispose() {
      group.removeFromParent();
      structGeo.dispose();
      accentGeo.dispose();
      pillarGeo.dispose();
      structMat.dispose();
      accentMat.dispose();
      trainMat.dispose();
      for (const { mesh } of trainMeshes) mesh.geometry.dispose();
    },
  };
}
