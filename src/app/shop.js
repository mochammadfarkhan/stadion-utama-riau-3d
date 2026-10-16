/**
 * Dialog beli & prompt interaksi E (dipindah dari main.js tanpa perubahan perilaku).
 */

/** Dialog beli: pedagang bisa berjalan menjauh saat dialog terbuka; kunci id pedagang saat dibuka. */
export function setupShop(hud, ents, story) {
  const shop = { vendorId: null };
  hud.onBuy = (itemId) => {
    if (!shop.vendorId) return;
    const res = ents.vendors.tryBuy(itemId, shop.vendorId);
    hud.setWallet(ents.vendors.wallet);
    hud.toast(res.ok ? `Beli ${res.item.name} ✔` : res.error, res.ok);
    if (res.ok) story.onBought(res.item.id);
  };
  return shop;
}

export function handleShopKey(rig, hud, ents, shop) {
  if (rig.freezesBike) return; // sepeda dibekukan di POV: tidak ada transaksi
  if (hud.shopOpen) {
    hud.closeShop();
    shop.vendorId = null;
    rig.requestLock();
  } else if (ents.vendors.promptVendor) {
    shop.vendorId = ents.vendors.promptVendor.id;
    hud.openShop(shopInfo(ents.vendors.promptVendor));
    document.exitPointerLock?.();
  }
}

export function updatePrompt(hud, ents, story, bikePos) {
  if (hud.shopOpen) return hud.setPrompt(null);
  const pv = ents.vendors.promptVendor; // satu sumber kebenaran jarak interaksi (VendorGroup)
  hud.setPrompt(story.promptFor(bikePos) ?? (pv ? `Tekan E — ${pv.name}` : null));
}

/** Bentuk data untuk dialog HUD dari info pedagang. */
function shopInfo(vendor) {
  return { name: vendor.name, items: vendor.catalog };
}
