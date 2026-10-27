/**
 * Gerbang hangat shader untuk konten yang di-stream (rencana performa Fase 2): mendengarkan `childadded` pada grup
 * kontainer (mis. lapisan distrik); anak baru yang materialnya belum punya program siap (App.needsWarmup) disembunyikan,
 * dihangatkan (App.warmup = compileAsync paralel), lalu ditampilkan — frame pertamanya tidak membeku menunggu kompilasi.
 * Anak yang shader-nya sudah siap tetap tampil seketika (pergantian LOD tidak berkedip). Semua kontainer (objek non-mesh)
 * sampai `maxDepth` diawasi — termasuk yang sudah berisi (mis. lapisan kehidupan kampus) dan yang ditambahkan belakangan.
 */

const isRenderable = (o) => o.isMesh || o.isPoints || o.isLine || o.isSprite;
const hasRenderable = (root) => {
  let found = false;
  root.traverse((o) => { if (!found && isRenderable(o)) found = true; });
  return found;
};

/**
 * @param {import('three').Object3D} root kontainer akar (diawasi beserta kontainer di bawahnya sampai maxDepth)
 * @param {{needsWarmup(o:object):boolean, warmup(o:object):Promise<void>}} app
 * @param {{logger?:{error:Function}, maxDepth?:number}} [opts]
 * @returns {() => void} lepas semua pengawas
 */
export function watchWarmup(root, app, { logger = console, maxDepth = 3 } = {}) {
  const watched = new Map(); // grup → listener
  const watch = (group, depth) => {
    if (watched.has(group) || depth > maxDepth) return;
    const onAdd = ({ child }) => {
      if (!child) return;
      if (!isRenderable(child)) watch(child, depth + 1); // isi kontainer bisa datang belakangan
      if (!hasRenderable(child) || !app.needsWarmup(child)) return;
      child.visible = false;
      Promise.resolve(app.warmup(child))
        .catch((err) => logger.error('Pemanasan shader gagal (objek tetap ditampilkan):', err))
        .finally(() => { if (child.parent) child.visible = true; });
    };
    group.addEventListener('childadded', onAdd);
    watched.set(group, onAdd);
    for (const c of group.children) if (!isRenderable(c)) watch(c, depth + 1);
  };
  watch(root, 0);
  return () => {
    for (const [group, fn] of watched) group.removeEventListener('childadded', fn);
    watched.clear();
  };
}
