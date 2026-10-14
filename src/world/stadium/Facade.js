/**
 * Fasad stadion: louvre coklat-emas antar rib, 12 gate (2 utama dengan kanopi selembayung),
 * papan nama "STADION UTAMA RIAU" (utara), logo PON XVIII (barat).
 */
import { Group } from 'three';
import { createGates } from './FacadeGates.js';
import { createLouvres } from './FacadeLouvre.js';
import { createNameBoard, createPonLogo } from './FacadeSigns.js';
import { GATES } from './gateLayout.js';

const MAIN_GATE_MASK_PAD = 4;   // meter di luar lebar gate utama
const MAIN_GATE_MASK_Y = 13;    // louvre dilewati di bawah ketinggian ini (ruang kanopi)

/** Mask louvre di atas gate utama agar kanopi tidak tertembus bilah. */
function mainGateMasks() {
  return GATES.filter((g) => g.main).map((g) => ({
    u: g.u,
    halfWidth: g.width / 2 + MAIN_GATE_MASK_PAD,
    yMax: MAIN_GATE_MASK_Y,
  }));
}

/**
 * @param {{louvres?:boolean, gates?:boolean, signs?:boolean, louvreLevels?:number, louvreTilt?:number}} opts
 * @returns {Group}
 */
export function createFacade({ louvres = true, gates = true, signs = true, louvreLevels, louvreTilt } = {}) {
  const group = new Group();
  group.name = 'stadium-facade';
  if (louvres) {
    group.add(createLouvres({
      masks: mainGateMasks(),
      ...(louvreLevels ? { levels: louvreLevels } : {}),
      ...(louvreTilt !== undefined ? { tilt: louvreTilt } : {}),
    }));
  }
  if (gates) group.add(createGates());
  if (signs) group.add(createNameBoard(), createPonLogo());
  return group;
}
