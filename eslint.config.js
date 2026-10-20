import js from '@eslint/js';
import globals from 'globals';

/**
 * Arah dependensi antarlapisan (spec Pekanbaru §3), dicocokkan ke string impor dengan regex.
 * Hanya aturan yang lulus setelah Plan C; utang yang belum ditegakkan: sim masih boleh three
 * (sim/trackPath.js), regions boleh world (builder handmade), app = composition (bebas kecuali main.js).
 */
const layers = (dirs) => ({
  regex: `(^|/)(${dirs.join('|')})/`,
  message: `Lapisan ini tidak boleh mengimpor ${dirs.join('/, ')}/ (lihat spec §3).`,
});
const MAIN = { regex: '(^|/)main\\.js$', message: 'main.js adalah composition root; jangan diimpor.' };
const THREE_PKG = { regex: '^three($|/)', message: 'Modul murni tidak boleh bergantung pada three.' };
const STADIUM_GEOMETRY = { regex: '(^|/)world/stadium/', message: 'core tidak boleh mengimpor geometri stadion (lewat region).' };
const restrict = (...patterns) => ({ 'no-restricted-imports': ['error', { patterns }] });
const ALL = ['world', 'ui', 'regions', 'districts', 'interiors', 'city', 'core', 'entities', 'story', 'sim', 'engine', 'app'];
const except = (...keep) => ALL.filter((d) => !keep.includes(d));

export default [
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**', '.playwright-mcp/**', 'assets-src/**', 'data-src/**', 'public/basis/**'] },
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.browser } },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  { files: ['tests/**', 'vite.config.js', 'eslint.config.js'], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
  { files: ['src/config/**/*.js'], rules: restrict(THREE_PKG, layers(ALL), MAIN) },
  { files: ['src/engine/**/*.js'], rules: restrict(layers(except('engine')), MAIN) },
  { files: ['src/geo/**/*.js'], rules: restrict(THREE_PKG, layers(ALL), MAIN) },
  { files: ['src/shared/**/*.js'], rules: restrict(layers(ALL), MAIN) },
  { files: ['src/story/**/*.js'], rules: restrict(THREE_PKG, layers(except('sim')), MAIN) },
  { files: ['src/sim/**/*.js'], rules: restrict(layers(except('sim', 'engine')), MAIN) },
  { files: ['src/world/**/*.js'], rules: restrict(layers(['ui', 'core', 'entities', 'regions', 'districts', 'city', 'app']), MAIN) },
  { files: ['src/city/**/*.js'], rules: restrict(layers(['world', 'ui', 'regions', 'districts', 'core', 'entities', 'story', 'sim', 'app']), MAIN) },
  { files: ['src/regions/**/*.js'], rules: restrict(layers(['ui', 'core', 'entities', 'districts', 'city', 'app']), MAIN) },
  // Distrik (spec §3.1): boleh engine, geo, shared, config, world, sim; ChunkStreamer/fetch city diinjeksi app/districtMount.
  { files: ['src/districts/**/*.js'], rules: restrict(layers(['ui', 'core', 'app', 'entities', 'city', 'regions', 'story']), MAIN) },
  { files: ['src/core/**/*.js'], rules: restrict(layers(['ui', 'app', 'districts']), STADIUM_GEOMETRY, MAIN) },
  { files: ['src/ui/**/*.js'], rules: restrict(layers(['app']), MAIN) },
  // Interior (spec §3.1): boleh engine/geo/shared/config/world/sim/entities; tidak ui/core/app/city/regions/districts.
  { files: ['src/interiors/**/*.js'], rules: restrict(layers(['ui', 'core', 'app', 'city', 'regions', 'districts']), MAIN) },
  { files: ['src/app/**/*.js'], rules: restrict(MAIN) },
];
