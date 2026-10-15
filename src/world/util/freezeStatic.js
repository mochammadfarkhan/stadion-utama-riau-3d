/**
 * Bekukan matriks anak-anak langsung `root` yang tidak pernah bergerak: matriks dunia dihitung
 * sekali lalu seluruh sub-pohonnya dilewati oleh `updateMatrixWorld` tiap frame (traversal dan
 * compose matriks ribuan objek statis tidak perlu diulang). Anak yang ditambahkan SETELAH
 * pemanggilan tetap diperbarui normal.
 * @param {import('three').Object3D} root
 * @returns {number} jumlah anak yang dibekukan
 */
export function freezeStatic(root) {
  root.updateMatrixWorld(true);
  for (const child of root.children) child.matrixWorldAutoUpdate = false;
  return root.children.length;
}
