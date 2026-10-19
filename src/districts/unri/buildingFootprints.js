/**
 * Footprint gedung distrik: data collider per klaster (dikirim ke `createUnriCollider().addBuildings`, M2) dan
 * gambar minimap (warna sama dengan gedung tile kota). Murni kecuali drawFootprints (ctx canvas 2D).
 */

/** Footprint collider [{ring, holes}] dari entri buildings.json (salinan dangkal ring, urutan tetap). */
export function footprintsOf(buildings) {
  return buildings.map((b) => ({ ring: b.ring, holes: b.holes ?? [] }));
}

/**
 * Gambar footprint ke canvas minimap distrik.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{ring:Array<[number,number]>}>} buildings
 * @param {(x:number) => number} tx dunia x → piksel
 * @param {(z:number) => number} tz dunia z → piksel
 */
export function drawFootprints(ctx, buildings, tx, tz, { fill = '#a89f92', stroke = '#8c8377' } = {}) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 0.8;
  for (const b of buildings) {
    ctx.beginPath();
    b.ring.forEach(([x, z], i) => (i === 0 ? ctx.moveTo(tx(x), tz(z)) : ctx.lineTo(tx(x), tz(z))));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}
