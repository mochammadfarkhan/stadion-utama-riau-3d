# Riset Teknis — Three.js untuk Simulator Stadion

Versi terverifikasi (13 Okt 2026): three 0.186.1 (r186), vite 8.3.4, vitest 5.0.4.

## Keputusan penting
- Import addons: `three/addons/<path>.js`. `SunLight` harus diimport path penuh `three/addons/lights/SunLight.js`.
- `THREE.Clock` deprecated (r183) → gunakan `THREE.Timer` (`timer.update(); timer.getDelta()`).
- `PCFSoftShadowMap` dihapus (r186) → `PCFShadowMap`.
- `CapsuleGeometry(radius, height, capSegments, radialSegments)`.
- Tanpa physics engine: sepeda = model kinematik (yawRate = v/wheelBase·tan(steer)); bola = gravitasi + pantul + gesek sederhana.
- Lintasan 400 m: lurus 84,39 m, radius kerb 36,5 m, lane 1 diukur +0,30 m, lane 2–8 +0,20 m, lebar 1,22 m. L(1)=400,00; L(8)≈453,66.
- Tribun 40k kursi: `InstancedMesh` dipecah per sektor (8–16), `MeshLambertMaterial`, `computeBoundingSphere()`, kursi tidak castShadow.
- Louvre fasad: InstancedMesh bilah mengikuti `getPointAt/getTangentAt` path oval.
- Atap bergelombang: normal map prosedural `DataTexture` (sinus) dengan RepeatWrapping.
- Langit: `Sky` addon (uniform turbidity, rayleigh, mie*, cloudCoverage, time) + PMREM → `scene.environment`. Fog warna horizon.
- Minimap: viewport+scissor kedua dengan OrthographicCamera.
- Label: `CSS2DRenderer` dengan `pointer-events:none`.
- Deploy: `base` dari env `GITHUB_PAGES_BASE`, workflow actions/deploy-pages@v4.
- Test: modul murni (sim/) jalan di vitest env node tanpa mock; kelas matematika three (Vector2/3, CurvePath) aman di node.

## Referensi
- https://github.com/mrdoob/three.js/releases/tag/r186
- https://threejs.org/manual/en/cameras.html
- https://vite.dev/guide/static-deploy
- https://github.com/thebuggeddev/football-stadium (pola saja, lisensi non-komersial)
- http://datagenetics.com/blog/may12015/index.html (geometri lintasan)
