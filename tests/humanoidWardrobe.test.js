import { describe, expect, it } from 'vitest';
import { accessoriesOf, LEGGING_COLOR, wardrobe } from '../src/entities/Humanoid.wardrobe.js';

const BASE = { skin: 0xc68642, shirt: 0x3366cc, pants: 0x222222, shoes: 0xffffff };
const names = (w) => w.pieces.map((p) => p.name);

describe('wardrobe manekin', () => {
  it('default: kaos + celana lebar + sepatu; badan tertutup disembunyikan', () => {
    const w = wardrobe(BASE);
    expect(w.top).toBe('kaos');
    expect(w.bottom).toBe('pants');
    expect(names(w)).toEqual(['kaos_torso', 'kaos_sleeve', 'celana_pelvis', 'celana_lebar_thigh', 'celana_lebar_shin', 'sepatu']);
    expect([...w.hide].sort()).toEqual(['foot', 'leg_shin', 'leg_thigh', 'pelvis', 'torso']);
    expect(w.pieces.find((p) => p.name === 'kaos_sleeve')).toMatchObject({ pivot: 'shoulder', sided: true, color: BASE.shirt });
  });

  it('lengan panjang → kemeja (lengan atas & bawah tertutup); top eksplisit menang', () => {
    const w = wardrobe({ ...BASE, longSleeve: true });
    expect(w.top).toBe('kemeja');
    expect(w.hide.has('arm_upper') && w.hide.has('arm_lower')).toBe(true);
    expect(w.hide.has('hand')).toBe(false);
    expect(wardrobe({ ...BASE, longSleeve: true, top: 'almamater' }).top).toBe('almamater');
    expect(wardrobe({ ...BASE, top: 'jas-hujan' }).top).toBe('kaos');
  });

  it('celana slim, celana pendek: betis & paha kulit tetap tampil sesuai potongan', () => {
    expect(names(wardrobe({ ...BASE, pantsFit: 'slim' }))).toContain('celana_shin');
    const shorts = wardrobe({ ...BASE, bottom: 'shorts' });
    expect(names(shorts)).toContain('pendek_thigh');
    expect(shorts.hide.has('leg_thigh') || shorts.hide.has('leg_shin')).toBe(false);
  });

  it('rok & gamis: paruh di pivot paha/lutut, pinggul sewarna rok, gamis berlegging', () => {
    const rok = wardrobe({ ...BASE, bottom: 'skirt', pants: 0xff8fb1 });
    expect(rok.pieces.filter((p) => p.name === 'rok')).toEqual([expect.objectContaining({ pivot: 'hip', sided: true })]);
    expect(rok.hide.has('pelvis')).toBe(false);
    expect(rok.bodyColor.pelvis).toBe(0xff8fb1);
    expect(rok.bodyColor.leg_shin).toBe(BASE.skin);
    const gamis = wardrobe({ ...BASE, bottom: 'longskirt' });
    expect(gamis.pieces.map((p) => `${p.pivot}:${p.name}`)).toEqual(expect.arrayContaining(['hip:gamis_atas', 'knee:gamis_bawah']));
    expect(gamis.bodyColor.leg_thigh).toBe(LEGGING_COLOR);
  });

  it('tanpa alas kaki bila warna sepatu = warna kulit', () => {
    const w = wardrobe({ ...BASE, shoes: BASE.skin });
    expect(names(w)).not.toContain('sepatu');
    expect(w.hide.has('foot')).toBe(false);
  });
});

describe('aksesori', () => {
  it('field lama + daftar baru, item unik, warna eksplisit menang, item tak dikenal diabaikan', () => {
    const list = accessoriesOf({ glasses: true, backpack: 0x111111, badge: 0xf2c200, aksesori: ['jam', { item: 'ransel', color: 0xff0000 }, 'payung'] });
    expect(list.map((a) => a.item)).toEqual(['kacamata', 'ransel', 'lencana', 'jam']);
    expect(list.find((a) => a.item === 'ransel').color).toBe(0xff0000);
  });

  it('aksesori masuk ke pivot yang benar (jam di siku kiri, kacamata di kepala)', () => {
    const w = wardrobe({ ...BASE, glasses: true, aksesori: ['jam'] });
    expect(w.pieces.find((p) => p.name === 'acc_jam_l')).toMatchObject({ pivot: 'elbowL', sided: false });
    expect(w.pieces.find((p) => p.name === 'acc_kacamata')).toMatchObject({ pivot: 'headPivot' });
  });
});
