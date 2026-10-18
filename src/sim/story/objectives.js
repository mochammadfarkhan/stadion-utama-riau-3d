/**
 * Evaluator objective cerita (murni, immutable). Setiap jenis objective memutuskan
 * apakah sebuah event menyelesaikan/memajukannya.
 * @returns {{progress:{count:number,found:string[]}, done:boolean, effects:object[]}}
 */
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const pass = (progress) => ({ progress, done: false, effects: [] });
const finish = (progress, effects = []) => ({ progress, done: true, effects });

export function applyObjective(objective, progress, event) {
  switch (objective.type) {
    case 'goto': // target null = region tujuan tak dikenal (titik ber-region gagal di-resolve): tidak pernah selesai
      return event.type === 'position' && objective.target != null && dist(event, objective.target) <= objective.radius
        ? finish(progress) : pass(progress);
    case 'buy':
      return event.type === 'bought' && (!objective.itemId || event.itemId === objective.itemId)
        ? finish(progress) : pass(progress);
    case 'deliver': return deliver(objective, progress, event);
    case 'laps': return laps(objective, progress, event);
    case 'find': return find(objective, progress, event);
    default: return pass(progress);
  }
}

function deliver(o, progress, event) {
  if (event.type !== 'interacted' || event.id !== o.npcId) return pass(progress);
  if ((event.carrying ?? []).includes(o.itemId)) return finish(progress, [{ type: 'consumeItem', itemId: o.itemId }]);
  return { progress, done: false, effects: [{ type: 'toast', text: o.missingText ?? 'Kamu belum membawa pesanannya', ok: false }] };
}

function laps(o, progress, event) {
  if (event.type !== 'lapDone') return pass(progress);
  const next = { ...progress, count: progress.count + 1 };
  return next.count >= o.count ? finish(next) : { progress: next, done: false, effects: [] };
}

function find(o, progress, event) {
  if (event.type !== 'found' || !o.ids.includes(event.id) || progress.found.includes(event.id)) return pass(progress);
  const next = { ...progress, found: [...progress.found, event.id] };
  return next.found.length >= o.ids.length ? finish(next) : { progress: next, done: false, effects: [] };
}
