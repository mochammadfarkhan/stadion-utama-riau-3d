import { defineConfig } from 'vite';

// Base path untuk GitHub Pages: https://<user>.github.io/stadion-utama-riau-3d/
export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/stadion-utama-riau-3d/' : '/',
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 800, // chunk vendor `three` memang besar (±716 kB), dipisah agar ter-cache
    rolldownOptions: {
      output: {
        // `three` (±450 kB) jadi chunk vendor sendiri: tidak ikut ter-invalidasi tiap rilis kode aplikasi.
        codeSplitting: {
          groups: [{ name: 'three', test: /node_modules[\\/]three[\\/]/, priority: 20 }],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      // Logika murni yang dites unit; kode WebGL/DOM diverifikasi di browser.
      include: [
        'src/sim/**', 'src/story/**', 'src/settings/**',
        'src/core/{adaptiveResolution,cameraMath,escapeRoute,gamepad,Input}.js', 'src/ui/{touchMath,toastQueue}.js',
        'src/engine/**', 'src/geo/**', 'src/shared/**', 'src/regions/Region.js', 'src/regions/stadion/mask.js',
        'src/districts/District.js', 'src/districts/terrainChunks.js',
      ],
      reporter: ['text-summary', 'text'],
      thresholds: { lines: 90, statements: 90, functions: 90, branches: 85 },
    },
  },
});
