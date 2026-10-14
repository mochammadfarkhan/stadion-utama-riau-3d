/**
 * Mesin cerita murni: state immutable, `reduce(state, event) → {state, effects}`.
 * Sepenuhnya data-driven oleh `chapters` dan `eggs`; tidak tahu soal THREE/DOM.
 */
import { applyObjective } from './objectives.js';

const EMPTY_PROGRESS = Object.freeze({ count: 0, found: Object.freeze([]) });
const VERSION = 1;
const START_RANK = 'Pendatang';
const PERSISTED = ['chapter', 'step', 'eggs', 'badges', 'bestLap', 'rupiah', 'finished'];

/** Tambahkan efek `save` bila ada field yang perlu disimpan berubah. */
function finalize(before, [after, effects]) {
  if (after === before) return { state: before, effects };
  const changed = PERSISTED.some((k) => after[k] !== before[k]);
  return { state: after, effects: changed ? [...effects, { type: 'save' }] : effects };
}

export function createStory({ chapters, eggs }) {
  const eggById = new Map(eggs.map((e) => [e.id, e]));
  const stepOf = (s) => chapters[s.chapter].steps[s.step];

  /** Masuk ke langkah s.step: reset progres/timer, buka dialog bila ada (didahului `lead`). */
  const enter = (s, lead = [], silent = false) => {
    const step = stepOf(s);
    const lines = silent ? [] : [...lead, ...(step.say ?? [])];
    return { ...s, progress: EMPTY_PROGRESS, timeLeft: step.timeLimit ?? null, dialog: lines.length ? { lines, index: 0 } : null };
  };

  const grant = (s, effects, reward, badge) => {
    const rupiah = reward?.rupiah ?? 0;
    const badges = badge && !s.badges.includes(badge) ? [...s.badges, badge] : s.badges;
    const next = { ...s, rupiah: s.rupiah + rupiah, badges };
    return [next, rupiah || badge ? [...effects, { type: 'reward', rupiah, badge }] : effects];
  };

  const completeStep = (s0, effects0) => {
    const [s1, e1] = grant(s0, effects0, stepOf(s0).reward);
    const ch = chapters[s1.chapter];
    if (s1.step + 1 < ch.steps.length) return [enter({ ...s1, step: s1.step + 1 }), e1];
    const [s2, e2] = grant(s1, e1, ch.reward, ch.reward?.badge);
    if (s2.chapter + 1 < chapters.length) return [enter({ ...s2, chapter: s2.chapter + 1, step: 0 }, ch.outro), e2];
    const dialog = ch.outro.length ? { lines: ch.outro, index: 0 } : null;
    return [{ ...s2, finished: true, progress: EMPTY_PROGRESS, timeLeft: null, dialog }, e2];
  };

  const runObjective = (s, event) => {
    const r = applyObjective(stepOf(s).objective, s.progress, event);
    const next = { ...s, progress: r.progress };
    return r.done ? completeStep(next, r.effects) : [next, r.effects];
  };

  const onEgg = (s, id) => {
    const egg = eggById.get(id);
    if (!egg || s.eggs.includes(id)) return [s, []];
    const [granted, effects] = grant({ ...s, eggs: [...s.eggs, id] }, [{ type: 'toast', text: egg.text, ok: true }], egg.reward);
    if (s.finished) return [granted, effects];
    const [next, more] = runObjective(granted, { type: 'found', id });
    return [next, [...effects, ...more]];
  };

  const onTick = (s, dt) => {
    if (s.timeLeft == null) return [s, []];
    const left = s.timeLeft - dt;
    if (left > 0) return [{ ...s, timeLeft: left }, []];
    return [enter(s, [], true), [{ type: 'toast', text: 'Waktu habis, coba lagi!', ok: false }]];
  };

  const onAdvance = (s) => {
    const d = s.dialog;
    return [{ ...s, dialog: d.index + 1 >= d.lines.length ? null : { ...d, index: d.index + 1 } }, []];
  };

  const dispatch = (s, event) => {
    if (event.type === 'egg') return onEgg(s, event.id);
    if (s.finished) return [s, []];
    if (event.type === 'tick') return onTick(s, event.dt);
    const base = event.type === 'lapDone' && Number.isFinite(event.seconds)
      ? { ...s, bestLap: s.bestLap == null ? event.seconds : Math.min(s.bestLap, event.seconds) } : s;
    return runObjective(base, event);
  };

  const initial = () => enter({
    version: VERSION, chapter: 0, step: 0, progress: EMPTY_PROGRESS, timeLeft: null, dialog: null,
    badges: [], eggs: [], bestLap: null, rupiah: 0, finished: false,
  });

  return {
    initial,
    /** Pulihkan dari simpanan yang sudah disanitasi (tanpa membuka dialog). */
    hydrate(save) {
      const s = { ...initial(), ...save, progress: EMPTY_PROGRESS, dialog: null };
      return { ...s, timeLeft: save.finished ? null : stepOf(s).timeLimit ?? null };
    },
    rankOf(s) {
      if (s.finished) return chapters[chapters.length - 1].rank;
      return s.chapter === 0 ? START_RANK : chapters[s.chapter - 1].rank;
    },
    reduce(state, event) {
      if (event.type === 'reset') return { state: initial(), effects: [{ type: 'save' }] };
      if (state.dialog) return event.type === 'advance' ? finalize(state, onAdvance(state)) : { state, effects: [] };
      if (event.type === 'advance') return { state, effects: [] };
      return finalize(state, dispatch(state, event));
    },
  };
}
