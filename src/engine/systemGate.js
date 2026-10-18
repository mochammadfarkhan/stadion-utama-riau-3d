/**
 * Gerbang sistem (App.setSystemGate): bungkus sistem agar update-nya hanya jalan bila gerbang terbuka untuk
 * id-nya. Dipakai portal interior untuk MENJEDA sistem eksterior tanpa mencabutnya (urutan dalam fase tetap,
 * tidak ada dispose/re-add). Lapisan engine: murni.
 * @param {{id:string, phase:string, update:(dt:number, ctx:object)=>void, dispose?:()=>void}} system
 * @param {(id:string) => boolean} isOpen
 */
export function gateSystem(system, isOpen) {
  if (typeof isOpen !== 'function') throw new TypeError('gateSystem: isOpen harus fungsi');
  if (!system || typeof system.update !== 'function') return system; // biar SystemRunner yang menolak
  const gated = {
    id: system.id,
    phase: system.phase,
    update(dt, ctx) {
      if (isOpen(system.id)) system.update(dt, ctx);
    },
  };
  if (typeof system.dispose === 'function') gated.dispose = () => system.dispose();
  return gated;
}
