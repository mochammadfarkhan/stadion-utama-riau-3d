/**
 * Pohon jauh bergoyang: vertex shader menggeser tajuk instans mengikuti ketinggian lokal (pucuk paling jauh),
 * fase acak dari posisi instans. Waktu dari SWAY_UNIFORMS.uSwayT (diisi sistem kota). Patch murni agar bisa dites tanpa WebGL.
 */
export const SWAY_UNIFORMS = { uSwayT: { value: 0 } };

export const SWAY_AMPLITUDE = 0.06; // pergeseran pucuk (kali ukuran pohon)

export function patchTreeSwaySource(shader) {
  return {
    vertexShader: shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uSwayT;')
      .replace('#include <begin_vertex>', [
        '#include <begin_vertex>',
        '#ifdef USE_INSTANCING',
        'float swayPh = instanceMatrix[3].x * 0.05 + instanceMatrix[3].z * 0.07;',
        'float swayH = max(transformed.y - 0.1, 0.0);',
        `transformed.x += sin(uSwayT * 1.6 + swayPh) * ${SWAY_AMPLITUDE.toFixed(3)} * swayH;`,
        `transformed.z += cos(uSwayT * 1.3 + swayPh * 1.3) * ${(SWAY_AMPLITUDE * 0.8).toFixed(3)} * swayH;`,
        '#endif',
      ].join('\n')),
  };
}

/** Pasang goyang pada material tajuk berinstans. */
export function applyTreeSway(material) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prev?.call(material, shader, renderer);
    shader.uniforms.uSwayT = SWAY_UNIFORMS.uSwayT;
    shader.vertexShader = patchTreeSwaySource(shader).vertexShader;
  };
  material.customProgramCacheKey = () => 'sway';
  material.needsUpdate = true;
  return material;
}
