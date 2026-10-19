/**
 * Pembangun lapangan (three): permukaan + marka dari `courtSpec` (tekstur kanvas), tiang & jaring net voli/tenis.
 * Tiang ring basket dari GLB dipasang terpisah (sekretariatUkm.js, instanced). Satu material tekstur per lapangan
 * (3 draw call), tiang net digabung (1), jaring (1). Koordinat region-lokal; y dari `baseY` (pad rata).
 */
import * as THREE from 'three';
import { hasDocument } from '../../world/props/canvasText.js';
import { createRandom } from '../../world/siteutil/rng.js';
import { mergeAll } from '../../world/siteutil/rounded.js';

const PX_PER_M = 36;
const COURT_LIFT = 0.05;

/** Gambar marka ke kanvas: (x, z) lapangan-lokal → piksel (pusat kanvas = pusat lapangan, utara di atas). */
export function drawCourt(ctx, spec, colors, ppm = PX_PER_M) {
  const W = Math.round(spec.outer.w * ppm);
  const H = Math.round(spec.outer.l * ppm);
  const px = (x) => W / 2 + x * ppm;
  const py = (z) => H / 2 + z * ppm;
  ctx.fillStyle = colors.runoff;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = colors.surface;
  ctx.fillRect(px(-spec.surface.w / 2), py(-spec.surface.l / 2), spec.surface.w * ppm, spec.surface.l * ppm);
  // bintik halus agar tidak datar (seed per jenis, deterministik)
  const rnd = createRandom(spec.kind.length * 977 + 13);
  for (let i = 0; i < W * H * 0.01; i += 1) {
    ctx.fillStyle = rnd.chance(0.5) ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.05)';
    ctx.fillRect(rnd.next() * W, rnd.next() * H, 2, 2);
  }
  ctx.strokeStyle = colors.lines;
  ctx.lineWidth = Math.max(1.5, spec.lineWidth * ppm);
  ctx.lineCap = 'butt';
  for (const l of spec.lines) {
    ctx.beginPath();
    if (l.t === 'seg') {
      ctx.moveTo(px(l.x0), py(l.z0));
      ctx.lineTo(px(l.x1), py(l.z1));
    } else if (l.t === 'circle') {
      ctx.arc(px(l.x), py(l.z), l.r * ppm, 0, Math.PI * 2);
    } else {
      const N = 40;
      for (let i = 0; i <= N; i += 1) {
        const a = l.a0 + ((l.a1 - l.a0) * i) / N;
        const X = px(l.x + l.r * Math.sin(a));
        const Y = py(l.z + l.r * Math.cos(a));
        if (i === 0) ctx.moveTo(X, Y);
        else ctx.lineTo(X, Y);
      }
    }
    ctx.stroke();
  }
  return { W, H };
}

function courtTexture(spec, colors) {
  if (!hasDocument()) return null;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(spec.outer.w * PX_PER_M);
  canvas.height = Math.round(spec.outer.l * PX_PER_M);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  drawCourt(ctx, spec, colors);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function netTexture() {
  if (!hasDocument()) return null;
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.clearRect(0, 0, 32, 32);
  ctx.strokeStyle = 'rgba(235,235,235,0.95)';
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const named = (mat, name) => {
  mat.name = name;
  return mat;
};

/** Plane horizontal w×l berpusat di (cx, y, cz), UV 0..1 (v naik ke utara = −Z). */
const flatPlane = (w, l, cx, y, cz) => new THREE.PlaneGeometry(w, l).rotateX(-Math.PI / 2).translate(cx, y, cz);

/** Jaring net: plane tegak lebar `width` di bidang X (z tetap), UV berulang tiap `cell` m. */
function netMesh(net, cx, y0, cz, cell = 0.1) {
  const h = net.centerH - 0.08;
  const g = new THREE.PlaneGeometry(net.width, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i += 1) uv.setXY(i, uv.getX(i) * (net.width / cell), uv.getY(i) * (h / cell));
  return g.translate(cx, y0 + 0.08 + h / 2, cz);
}

/** Bahan lapangan per scope aktif (dipanggil di dalam withScope region). */
export function createCourtMaterials(specs) {
  const mats = {};
  for (const s of specs) {
    const map = courtTexture(s, { ...s.colors });
    mats[s.id] = named(new THREE.MeshStandardMaterial({
      color: map ? 0xffffff : new THREE.Color(s.colors.surface), roughness: 0.82, ...(map ? { map } : {}),
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }), `lapangan:${s.id}`);
  }
  const net = netTexture();
  mats.tiang = named(new THREE.MeshStandardMaterial({ color: 0x6d7378, roughness: 0.5, metalness: 0.5 }), 'lapangan:tiang');
  mats.pita = named(new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.7 }), 'lapangan:pita');
  mats.jaring = named(new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide, transparent: true, alphaTest: 0.35, depthWrite: false, ...(net ? { map: net } : {}),
  }), 'lapangan:jaring');
  return mats;
}

/** Group lapangan: permukaan bertekstur, tiang net digabung, jaring. `y(x, z)` = tinggi tanah region-lokal. */
export function buildCourts(specs, mats, y) {
  const g = new THREE.Group();
  g.name = 'lapangan-olahraga';
  const posts = [];
  const nets = [];
  const bands = [];
  for (const s of specs) {
    const by = y(s.x, s.z) + COURT_LIFT;
    const plane = new THREE.Mesh(flatPlane(s.outer.w, s.outer.l, s.x, by, s.z), mats[s.id]);
    plane.name = `lapangan:${s.id}`;
    plane.receiveShadow = true;
    g.add(plane);
    const ground = y(s.x, s.z);
    if (s.net) {
      for (const p of s.net.posts) {
        posts.push(new THREE.CylinderGeometry(s.net.postR, s.net.postR, s.net.postH, 8).translate(s.x + p.x, ground + s.net.postH / 2, s.z + p.z));
      }
      nets.push(netMesh(s.net, s.x, ground, s.z));
      bands.push(new THREE.BoxGeometry(s.net.width, 0.07, 0.03).translate(s.x, ground + s.net.centerH - 0.035, s.z));
    }
  }
  const add = (geos, mat, name, cast) => {
    if (!geos.length) return;
    const m = new THREE.Mesh(mergeAll(geos), mat);
    m.name = name;
    m.castShadow = cast;
    m.receiveShadow = true;
    g.add(m);
  };
  add(posts, mats.tiang, 'lapangan:tiang-net', true);
  add(nets, mats.jaring, 'lapangan:jaring', false);
  add(bands, mats.pita, 'lapangan:pita-net', false);
  return g;
}
