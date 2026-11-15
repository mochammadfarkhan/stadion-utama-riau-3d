import { regionContains } from '../regions/Region.js';
import { unriLembagaRegion } from '../regions/unri-lembaga/index.js';
import { unriRektoratRegion } from '../regions/unri-rektorat/index.js';

/** Region hero di dalam distrik UNRI: distrik tidak menaruh vegetasi/props/rintangan di dalam mask-nya (M2 isReserved). M6 menambah region Rektorat. */
export const HERO_REGIONS = Object.freeze([unriLembagaRegion, unriRektoratRegion]);

/** Id region hero yang menaungi titik dunia (x, z), atau null. Dipakai distrik (excludeAt), devtools/E2E, dan ?perf. */
export const regionIdAt = (x, z) => HERO_REGIONS.find((def) => regionContains(def, x, z))?.id ?? null;
