/**
 * Registry material per root: sistem global (TimeOfDay, Weather) mendaftarkan objek yang datang kapan
 * pun (region, entitas, GLB, tile) alih-alih scene.traverse sekali saat konstruksi, dan melepasnya saat
 * root di-dispose. `select(material, object)` → entri atau null bila material tidak relevan. Material
 * dicatat sekali (per uuid) walau dimiliki beberapa root; `onRemove(entry)` dipanggil saat root
 * terakhir pemiliknya dilepas (memulihkan nilai asli). Lapisan engine: tanpa impor three.
 */
export function createMaterialRegistry(select, { onRemove = () => {} } = {}) {
  if (typeof select !== 'function') throw new TypeError('createMaterialRegistry: select harus fungsi');
  const records = new Map(); // uuid -> { entry, owners: Set<root> }
  const roots = new Map();   // root -> Set<uuid>
  let list = [];
  const refresh = () => { list = [...records.values()].map((r) => r.entry); };

  const unregister = (root) => {
    const uuids = roots.get(root);
    if (!uuids) return false;
    roots.delete(root);
    for (const uuid of uuids) {
      const rec = records.get(uuid);
      rec.owners.delete(root);
      if (rec.owners.size === 0) {
        records.delete(uuid);
        onRemove(rec.entry);
      }
    }
    refresh();
    return true;
  };

  return {
    /** @returns {() => boolean} fungsi unregister untuk root ini */
    register(root) {
      if (!root || typeof root.traverse !== 'function') throw new TypeError('register: root harus Object3D');
      if (roots.has(root)) return () => unregister(root);
      const uuids = new Set();
      root.traverse((o) => {
        const mat = o.material;
        if (!mat || Array.isArray(mat)) return;
        const rec = records.get(mat.uuid);
        if (rec) {
          rec.owners.add(root);
          uuids.add(mat.uuid);
          return;
        }
        const entry = select(mat, o);
        if (!entry) return;
        records.set(mat.uuid, { entry, owners: new Set([root]) });
        uuids.add(mat.uuid);
      });
      roots.set(root, uuids);
      refresh();
      return () => unregister(root);
    },
    unregister,
    /** Snapshot entri (array baru tiap kali registry berubah). */
    get entries() { return list; },
    get size() { return records.size; },
    clear() { for (const root of [...roots.keys()]) unregister(root); },
  };
}
