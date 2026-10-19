/**
 * Builder hero (spec §7.1): `(plan, kitMaterials, ctx) => PartList`. M4: sekretariat-lembaga, stadion-mini,
 * student-center = milik region unri-lembaga. M6: rektorat & perpustakaan-lama = milik region unri-rektorat;
 * masjid-arfaunnas, gerbang-sm-amin, ggm = hero distrik handmade (PartList bermaterial sendiri, matriks dunia;
 * masuk `sink.extra` klaster, lihat buildBuilding.appendParts). ctx = { lod, scope?, groundY? }.
 */
import { HERO_IDS } from '../archetypes.js';
import { regionOwnedHero } from './regionOwned.js';
import { buildMasjidArfaunnas, MASJID_ORNAMENTS } from './masjidArfaunnas.js';
import { buildGerbangSmAmin } from './gerbangSmAmin.js';
import { buildGgm } from './ggm.js';

export const HERO_BUILDERS = Object.freeze({
  // M6: Rektorat & perpustakaan dirender region unri-rektorat (proxy region saat jauh); distrik tidak menggambar ulang.
  'hero:rektorat': regionOwnedHero('unri-rektorat'),
  'hero:perpustakaan-lama': regionOwnedHero('unri-rektorat'),
  'hero:masjid-arfaunnas': buildMasjidArfaunnas,
  'hero:gerbang-sm-amin': buildGerbangSmAmin,
  'hero:ggm': buildGgm,
  // M4: dirender penuh oleh region unri-lembaga (proxy saat jauh); distrik tidak menggambar ulang gedung ini.
  'hero:sekretariat-lembaga': regionOwnedHero('unri-lembaga'),
  'hero:student-center': regionOwnedHero('unri-lembaga'),
  'hero:stadion-mini': regionOwnedHero('unri-lembaga'),
});

if (HERO_IDS.some((id) => !HERO_BUILDERS[id])) throw new Error('HERO_BUILDERS tidak lengkap');

/** Ornamen GLB hero distrik (dimuat src/app/heroOrnaments.js; placeholder via ornaments.js). */
export const HERO_ORNAMENTS = Object.freeze([...MASJID_ORNAMENTS]);
