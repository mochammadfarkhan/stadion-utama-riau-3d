import { defineConfig } from 'vite';

// Base path untuk GitHub Pages: https://<user>.github.io/stadion-utama-riau-3d/
export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/stadion-utama-riau-3d/' : '/',
  build: { target: 'es2022', sourcemap: false },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
