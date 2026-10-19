/**
 * Hero yang dirender penuh oleh REGION (bukan distrik): builder mengembalikan PartList kosong sehingga klaster
 * distrik tidak menggambar gedung itu (tidak ada gambar ganda / z-fighting). Saat region tidak terpasang,
 * proxy region yang menampilkan siluetnya.
 */
export function regionOwnedHero(regionId) {
  const builder = () => [];
  builder.regionOwned = regionId;
  return builder;
}

export const isRegionOwned = (builder) => typeof builder?.regionOwned === 'string';
