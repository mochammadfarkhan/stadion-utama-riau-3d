/**
 * Geometri cincin oval dari profil (k, y): grid (u keliling × profil) → BufferGeometry.
 * Dipakai untuk atap, listplank, dinding concourse, dan pelat lantai.
 */
import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';
import { framePoint, outerEllipse } from './ovalFrame.js';

const SEGMENT_LENGTH = 3; // m per segmen keliling (default)

function segmentCount(span, explicit) {
  if (explicit) return explicit;
  return Math.max(4, Math.ceil((span * outerEllipse().perimeter) / SEGMENT_LENGTH));
}

/**
 * @param {{profile:{k:number,y:number}[], uStart?:number, uEnd?:number, uvRepeat?:number, segments?:number, flip?:boolean}} opts
 * uvRepeat = jumlah pengulangan tekstur per satu keliling penuh.
 */
export function buildRingGeometry({ profile, uStart = 0, uEnd = 1, uvRepeat = 1, segments, flip = false }) {
  const span = uEnd - uStart;
  const n = segmentCount(span, segments);
  const m = profile.length;
  const pos = [];
  const uv = [];
  const idx = [];
  const v = new Vector3();
  for (let i = 0; i <= n; i++) {
    const u = uStart + span * (i / n);
    for (let j = 0; j < m; j++) {
      framePoint(u, profile[j].k, profile[j].y, v);
      pos.push(v.x, v.y, v.z);
      uv.push(u * uvRepeat, j / (m - 1));
    }
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m - 1; j++) {
      const a = i * m + j;
      const b = a + m;
      if (flip) idx.push(a, b, a + 1, b, b + 1, a + 1);
      else idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}
