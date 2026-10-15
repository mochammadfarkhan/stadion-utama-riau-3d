/** Teks dan visibilitas menu utama dari keadaan simpanan dan jenis perangkat (murni, dites). */

/** Apakah simpanan cerita menunjukkan progres yang layak dilanjutkan. */
export function hasStoryProgress(state) {
  return Boolean(state) && (state.finished === true || state.chapter > 0 || state.step > 0 || (state.eggs?.length ?? 0) > 0);
}

/** @returns {{startLabel:string, showNewGame:boolean, hint:string}} */
export function menuModel({ hasProgress, touch }) {
  return {
    startLabel: hasProgress ? 'Lanjutkan' : 'Mulai Petualangan',
    showNewGame: Boolean(hasProgress),
    hint: touch
      ? 'Ketuk tombol untuk mulai. Game dimainkan dalam mode landscape.'
      : 'Klik tombol untuk mulai; mouse akan terkunci (Esc untuk melepas).',
  };
}
