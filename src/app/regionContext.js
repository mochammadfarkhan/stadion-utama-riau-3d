/**
 * Konteks frame untuk sistem region-lokal (entitas, cerita): ctx dunia → ctx dengan bikePos/focus
 * dalam koordinat region dan `heightAt(lx, lz)` (M1) yang menerima koordinat region. Hasil di-cache per
 * objek ctx (satu konversi per frame untuk semua entitas). Frame identitas mengembalikan ctx apa adanya
 * (paritas bit-exact; heightAt dunia = lokal).
 */
const localPoint = (frame, p) => {
  if (!p) return p;
  const l = frame.toLocal(p.x, p.z);
  return { x: l.x, y: p.y ?? 0, z: l.z };
};

/**
 * Fungsi tinggi tanah berkoordinat region-lokal dari fungsi dunia; frame identitas → fungsi yang sama.
 * @param {{identity:boolean, toWorld(x:number, z:number):{x:number,z:number}}} frame
 * @param {((x:number, z:number) => number)|undefined} heightAt dunia
 */
export function localHeightAt(frame, heightAt) {
  if (typeof heightAt !== 'function' || frame.identity) return heightAt;
  return (lx, lz) => {
    const w = frame.toWorld(lx, lz);
    return heightAt(w.x, w.z);
  };
}

/** @param {{identity:boolean, toLocal(x:number, z:number):{x:number,z:number}, toWorld(x:number, z:number):{x:number,z:number}}} frame */
export function createLocalContext(frame) {
  if (frame.identity) return (ctx) => ctx;
  let lastIn = null;
  let lastOut = null;
  let worldHeight;
  let localHeight;
  return (ctx) => {
    if (ctx === lastIn) return lastOut;
    lastIn = ctx;
    if (ctx.heightAt !== worldHeight) { // fungsi dunia jarang berganti: bungkus sekali
      worldHeight = ctx.heightAt;
      localHeight = localHeightAt(frame, worldHeight);
    }
    lastOut = { ...ctx, bikePos: localPoint(frame, ctx.bikePos), focus: localPoint(frame, ctx.focus), heightAt: localHeight };
    return lastOut;
  };
}

/** Titik region-lokal → dunia ({x, z}); null tetap null. */
export function pointToWorld(frame, p) {
  if (!p) return p ?? null;
  if (frame.identity) return p;
  const w = frame.toWorld(p.x, p.z);
  return { ...p, x: w.x, z: w.z };
}

/** Titik dunia → region-lokal ({x, z}); null tetap null. */
export function pointToLocal(frame, p) {
  if (!p) return p ?? null;
  if (frame.identity) return p;
  const l = frame.toLocal(p.x, p.z);
  return { ...p, x: l.x, z: l.z };
}
