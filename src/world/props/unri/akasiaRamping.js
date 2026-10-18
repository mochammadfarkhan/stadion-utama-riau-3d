// src/world/props/unri/akasiaRamping.js
/**
 * V04 akasia ramping (poros Rektorat): batang tinggi ramping + tajuk sempit memanjang (3 gumpalan).
 * Visual [T] foto 2016 (pohon tinggi ramping bertajuk sempit); spesies [INFERENSI] (mirip Acacia
 * mangium/eukaliptus). ±17 m, ±310 segitiga. Part untuk instanceParts (skala & rotasi per instance).
 */
import * as THREE from 'three';
import { currentScope } from '../../../engine/ResourceScope.js';
import { mergeAll } from '../../siteutil/rounded.js';

export const AKASIA = Object.freeze({
  trunkH: 9.5, trunkR: 0.22, crownY: 12.0, crownR: 1.9, crownH: 7.5,
  colors: Object.freeze({ batang: 0x8a7f70, tajuk: 0x4d6a33 }),
});

const trunkGeo = () => currentScope().get('V04:batang', () => new THREE.CylinderGeometry(AKASIA.trunkR * 0.6, AKASIA.trunkR, AKASIA.trunkH, 7).translate(0, AKASIA.trunkH / 2, 0));
const crownGeo = () => currentScope().get('V04:tajuk', () => mergeAll([
  new THREE.SphereGeometry(1, 8, 7).scale(AKASIA.crownR, AKASIA.crownH / 2, AKASIA.crownR).translate(0, AKASIA.crownY, 0),
  new THREE.SphereGeometry(1, 7, 6).scale(AKASIA.crownR * 0.75, AKASIA.crownH * 0.28, AKASIA.crownR * 0.75).translate(0.5, AKASIA.crownY + 3.4, -0.3),
  new THREE.SphereGeometry(1, 7, 6).scale(AKASIA.crownR * 0.7, AKASIA.crownH * 0.25, AKASIA.crownR * 0.7).translate(-0.4, AKASIA.crownY - 3.0, 0.4),
]));
const trunkMat = () => currentScope().get('V04:matBatang', () => Object.assign(new THREE.MeshLambertMaterial({ color: AKASIA.colors.batang }), { name: 'V04:batang' }));
const crownMat = () => currentScope().get('V04:matTajuk', () => Object.assign(new THREE.MeshLambertMaterial({ color: AKASIA.colors.tajuk }), { name: 'V04:tajuk' }));

/** Part V04 untuk instanceParts. */
export function akasiaParts() {
  return [
    { geometry: trunkGeo(), material: trunkMat(), castShadow: true, name: 'akasiaBatang' },
    { geometry: crownGeo(), material: crownMat(), castShadow: true, name: 'akasiaTajuk' },
  ];
}
