/**
 * Bekukan matriks seluruh subpohon dari anak-anak langsung `root` yang tidak pernah bergerak.
 * Matriks dunia dihitung sekali; sesudahnya `matrixAutoUpdate=false` membuat `updateMatrixWorld`
 * tidak memanggil `updateMatrix()` (compose matriks) sehingga `matrixWorldNeedsUpdate` tidak pernah
 * menyala dan perkalian matriks turun-temurun ikut dilewati tiap frame. Anak yang ditambahkan
 * SETELAH pemanggilan tetap diperbarui normal. Memindahkan objek yang sudah dibekukan butuh
 * `obj.updateMatrix(); obj.matrixWorldNeedsUpdate = true` manual. Lapisan engine: tanpa impor three
 * (dipindah dari world/util agar city/ dapat memakainya, Plan C).
 * @param {import('three').Object3D} root
 * @returns {number} jumlah objek (termasuk keturunan) yang dibekukan
 */
export function freezeStatic(root) {
  root.updateMatrixWorld(true);
  let frozen = 0;
  for (const child of root.children) {
    child.traverse((o) => {
      o.matrixAutoUpdate = false;
      frozen += 1;
    });
  }
  return frozen;
}
