import * as THREE from 'three';

const LABEL_HEIGHT = 40;       // m di atas tanah (agar label melayang di atas bangunan)
const NEAR_ONLY_DISTANCE = 2600; // label sekunder hanya tampil bila kamera lebih dekat dari ini (m)
const MAJOR = new Set(['stadion', 'annur', 'unri-rektorat']);

/** Nama singkat untuk label (hapus awalan kampus). */
export const shortLabel = (label) => label.replace(/^Kampus UNRI — /, 'UNRI · ');

/**
 * Label landmark melayang untuk pratinjau kota: tombol HTML di atas kanvas, diproyeksikan dari koordinat dunia.
 * Klik = `onSelect(landmark)`. Label utama selalu tampil; yang lain hanya saat kamera dekat (hindari tumpang tindih).
 * @param {HTMLElement} parent
 * @param {{landmarks: Array<{id:string,label:string,x:number,z:number}>, onSelect: (l: object) => void}} opts
 */
export function createCityLabels(parent, { landmarks, onSelect }) {
  const root = document.createElement('div');
  root.id = 'city-labels';
  root.hidden = true;
  const items = landmarks.map((l) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = MAJOR.has(l.id) ? 'city-label major' : 'city-label';
    btn.textContent = shortLabel(l.label);
    btn.addEventListener('click', () => onSelect(l));
    root.appendChild(btn);
    return { l, btn, major: MAJOR.has(l.id) };
  });
  parent.appendChild(root);
  const v = new THREE.Vector3();

  return {
    setVisible(on) { root.hidden = !on; },
    /** Proyeksikan ulang semua label (panggil tiap frame saat aktif). */
    update(camera, distance) {
      if (root.hidden) return;
      const w = root.clientWidth || window.innerWidth;
      const h = root.clientHeight || window.innerHeight;
      for (const it of items) {
        v.set(it.l.x, LABEL_HEIGHT, it.l.z).project(camera);
        const show = v.z > -1 && v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1 && (it.major || distance < NEAR_ONLY_DISTANCE);
        it.btn.style.display = show ? '' : 'none';
        if (show) it.btn.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -100%)`;
      }
    },
    dispose() { root.remove(); },
  };
}
