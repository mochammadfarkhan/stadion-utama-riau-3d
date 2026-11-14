/** Teks dan visibilitas menu utama dari keadaan simpanan dan jenis perangkat (murni, dites). */

/** Apakah simpanan cerita menunjukkan progres yang layak dilanjutkan. */
export function hasStoryProgress(state) {
  return Boolean(state) && (state.finished === true || state.chapter > 0 || state.step > 0 || (state.eggs?.length ?? 0) > 0);
}

/** Kunci simpanan di luar cerita yang juga berarti "sudah pernah main" (kebun, tas). */
export const OTHER_PROGRESS_KEYS = Object.freeze(['stadion.kebun.v1', 'stadion.inventory.v1']);

/** Progres apa pun: cerita maju, atau kebun/tas pernah tersimpan. */
export function hasAnyProgress({ storyState, storage }) {
  if (hasStoryProgress(storyState)) return true;
  try {
    return OTHER_PROGRESS_KEYS.some((k) => storage?.getItem(k) != null);
  } catch {
    return false;
  }
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
