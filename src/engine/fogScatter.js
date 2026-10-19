/**
 * Hamburan kabut ala golden hour (gaya kartun/facet): kabut condong ke warna matahari menurut dot(arah pandang, arah
 * matahari) ^ 4 dan sedikit menebal ke arah matahari. Tanpa uniform tambahan: chunk `fog_fragment` global ditambal
 * sekali, membaca cahaya arah pertama (matahari/bulan, sudah ada di ruang tampilan) pada material berlampu
 * (Standard/Lambert/Phong/Toon). Penanda aktif = fogFar NEGATIF; bagian pecahan |fogFar| membawa kekuatan haze 0..1
 * (lihat encodeFogFar). Fog biasa (fogFar positif, mode 'asli') memberi hasil identik dengan bawaan three. Material
 * shader sendiri yang memakai chunk (Grass) otomatis aman: abs/floor memberi jarak yang sama, tanpa cabang hamburan.
 */
import * as THREE from 'three';

const MARK = '// fogScatter';

/** Kode far untuk dikirim lewat fog.far: negatif + haze di pecahan. Murni. */
export function encodeFogFar(far, haze) {
  const h = Math.min(0.999, Math.max(0, Number.isFinite(haze) ? haze : 0));
  return -(Math.floor(Math.max(1, Number.isFinite(far) ? far : 1)) + h);
}

/** Kebalikan encodeFogFar (untuk tes/diagnosa). */
export function decodeFogFar(code) {
  const a = Math.abs(code);
  return { far: Math.floor(a), haze: a - Math.floor(a), scatter: code < 0 };
}

const chunk = (power) => /* glsl */`
#ifdef USE_FOG
	${MARK}
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
		vec3 fogCol = fogColor;
	#else
		float fogFarAbs = abs( fogFar );
		float fogFarM = floor( fogFarAbs );
		float fogFactor = smoothstep( fogNear, fogFarM, vFogDepth );
		vec3 fogCol = fogColor;
		#if NUM_DIR_LIGHTS > 0 && ( defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG ) || defined( TOON ) )
		if ( fogFar < 0.0 ) {
			float fogHaze = fogFarAbs - fogFarM;
			float fogCos = clamp( dot( normalize( - vViewPosition ), directionalLights[ 0 ].direction ), 0.0, 1.0 );
			float fogSun = pow( fogCos, ${power.toFixed(1)} ) * fogHaze;
			vec3 fogLight = directionalLights[ 0 ].color;
			fogLight /= max( max( fogLight.r, max( fogLight.g, fogLight.b ) ), 0.001 );
			float fogLum = max( fogColor.r, max( fogColor.g, fogColor.b ) );
			fogCol = mix( fogColor, fogLight * ( fogLum * 1.18 + 0.04 ), clamp( fogSun * 0.85, 0.0, 1.0 ) );
			fogFactor = clamp( fogFactor * ( 1.0 + 0.35 * fogSun ), 0.0, 1.0 );
		}
		#endif
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogCol, fogFactor );
#endif
`;

/** Tambal chunk fog_fragment (idempoten). Harus dipanggil sebelum material pertama dikompilasi. */
export function installFogScatter(power = 4) {
  if (THREE.ShaderChunk.fog_fragment.includes(MARK)) return;
  if (!THREE.ShaderChunk.fog_fragment.includes('smoothstep( fogNear, fogFar, vFogDepth )')) return; // versi three lain: fog bawaan
  THREE.ShaderChunk.fog_fragment = chunk(power);
}
