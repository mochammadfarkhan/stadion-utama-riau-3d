// src/world/kit/hero/reliefText.js
/**
 * Huruf timbul berlapis: tekstur canvas huruf berlatar transparan (alphaTest) pada 3 bidang berjarak
 * 3 cm — lapis depan berwarna, dua lapis belakang gelap → kesan tebal dari sudut miring tanpa font 3D.
 * Bidang menghadap −Z (konvensi aset katalog); lapis belakang di +Z (ke arah dinding). Node (tanpa
 * document) → bidang warna polos (hanya terjadi di tes). Cache di scope aktif (heroFrame).
 */
import * as THREE from 'three';
import { makeTextTexture } from '../../siteutil/textCanvas.js';
import { heroMaterial, heroGeometry, named } from './heroFrame.js';

const LAYER_GAP = 0.03;

/**
 * Material huruf (cache `teks:<key>`). nightGlow > 0 → emisif hangat menyala malam (TimeOfDay).
 * @param {string} key @param {string} text
 * @param {{color?:string, font?:string, width?:number, height?:number, nightGlow?:number}} [opts]
 */
export function reliefTextMaterial(key, text, { color = '#d9b75a', font = 'bold 150px sans-serif', width = 2048, height = 192, nightGlow = 0 } = {}) {
  return heroMaterial(`teks:${key}`, () => {
    const map = makeTextTexture(text, { bg: 'rgba(0,0,0,0)', fg: color, width, height, font, padding: 16 });
    const mat = new THREE.MeshStandardMaterial({
      color: map ? 0xffffff : color, map, alphaTest: map ? 0.5 : 0, roughness: 0.45, metalness: 0.35,
    });
    if (nightGlow > 0) {
      mat.emissive = new THREE.Color(0xffe2b0);
      mat.emissiveMap = map;
      mat.emissiveIntensity = 0;
      mat.userData.nightEmissive = { on: nightGlow, off: 0 };
    }
    mat.userData.text = text;
    return named(mat, `teks:${key}`);
  });
}

/**
 * PartList huruf timbul di ruang-teks (pusat di origin, menghadap −Z). Pemanggil mengalikan matriksnya.
 * @returns {Array<{geometry:THREE.BufferGeometry, material:THREE.Material, matrix:THREE.Matrix4, castShadow:boolean, name:string}>}
 */
export function reliefTextParts({ key, text, width, height, color = '#d9b75a', shade = '#5c4a22', nightGlow = 0, layers = 3 }) {
  const geometry = heroGeometry(`teksBidang:${width.toFixed(2)}x${height.toFixed(2)}`, () => new THREE.PlaneGeometry(width, height).rotateY(Math.PI));
  const front = reliefTextMaterial(key, text, { color, nightGlow });
  const back = reliefTextMaterial(`${key}:bayang`, text, { color: shade });
  return Array.from({ length: layers }, (_, i) => ({
    geometry,
    material: i === 0 ? front : back,
    matrix: new THREE.Matrix4().makeTranslation(0, 0, i * LAYER_GAP),
    castShadow: false,
    name: `teks:${key}`,
  }));
}
