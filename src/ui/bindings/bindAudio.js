/**
 * Binding grup "audio" (store -> AudioBus): master, bel sepeda, suasana (hujan).
 */

export const AUDIO_CHANNELS = Object.freeze({ bell: 'bell', ambience: 'ambience' });

/**
 * @param {object} store
 * @param {{ audioBus: import('../../core/AudioBus.js').AudioBus|null }} ctx
 * @returns {() => void} unsubscribe
 */
export function bindAudio(store, { audioBus = null }) {
  if (!audioBus) return () => {};
  const unsubs = [
    store.bind('audio.master', (v) => audioBus.setMaster(v)),
    store.bind('audio.bell', (v) => audioBus.setChannel(AUDIO_CHANNELS.bell, v)),
    store.bind('audio.ambience', (v) => audioBus.setChannel(AUDIO_CHANNELS.ambience, v)),
  ];
  return () => { for (const u of unsubs) u(); };
}
