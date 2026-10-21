"""
Bagian badan chibi (gaya referensi: kemeja kotak, lengan baju gembung, tangan mitten berjempol, kaki gempal lurus,
celana pendek lebar selutut). Dipanggil chibi_kit.build(); koordinat = ruang pivot Humanoid (Humanoid.dim.js):

  lengan atas  : pivot bahu, menggantung ke -z (panjang DIM.upperArm 0.20)
  lengan bawah : pivot siku (panjang DIM.lowerArm 0.18); tangan sampai ±0.27 di bawah siku
  paha         : pivot pinggul (DIM.thigh 0.36); betis & sepatu: pivot lutut (DIM.shin 0.34, tanah di -0.36)
  bawahan      : pivot body (pinggul, z = 0); torso mulai z = 0.09

Depan = -Y Blender (+Z three). Semua dibangun dari profil putar (lathe) + elipsoid.
"""
import math


def lathe(b, profile, seg=14, sx=1.0, sy=1.0, cx=0.0, cy=0.0, cap_top=True, cap_bottom=True):
    """Permukaan putar dari profil [(z, r)] (urut z menurun), penampang elips sx/sy, pusat (cx, cy)."""
    verts, faces = [], []
    for z, r in profile:
        for s in range(seg):
            a = 2 * math.pi * s / seg
            verts.append((cx + r * sx * math.cos(a), cy + r * sy * math.sin(a), z))
    n = len(profile)
    for i in range(n - 1):
        a0, a1 = i * seg, (i + 1) * seg
        faces += [(a0 + s, a1 + s, a1 + (s + 1) % seg, a0 + (s + 1) % seg) for s in range(seg)]
    if cap_top:
        verts.append((cx, cy, profile[0][0] + profile[0][1] * 0.35))
        t = len(verts) - 1
        faces += [(t, s, (s + 1) % seg)[::-1] for s in range(seg)]
    if cap_bottom:
        verts.append((cx, cy, profile[-1][0]))
        bt = len(verts) - 1
        last = (n - 1) * seg
        faces += [(bt, last + (s + 1) % seg, last + s)[::-1] for s in range(seg)]
    b.add(verts, faces)


def rounded(z_top, z_bot, r_top, r_bot, rings=3):
    """Profil tabung dengan ujung atas & bawah membulat."""
    prof = []
    for i in range(rings):
        t = (i + 1) / (rings + 1)
        prof.append((z_top + r_top * (1 - math.sin(t * math.pi / 2)) * 0.6, r_top * math.sin(t * math.pi / 2 + 0.25)))
    prof.append((z_top - r_top * 0.2, r_top))
    prof.append((z_bot + r_bot * 0.2, r_bot))
    for i in range(rings):
        t = (i + 1) / (rings + 1)
        prof.append((z_bot - r_bot * math.sin(t * math.pi / 2) * 0.6, r_bot * math.cos(t * math.pi / 2)))
    return sorted(prof, key=lambda p: -p[0])


def mitten(b, ellipsoid, zc):
    """Tangan mitten: telapak pipih (sumbu x = arah telapak ke badan) + jempol di depan."""
    ellipsoid(b, 0, 0, zc, 0.036, 0.052, 0.062, seg=12, rings=8)
    ellipsoid(b, 0, -0.04, zc + 0.022, 0.021, 0.022, 0.034, seg=8, rings=6)


def build_body(Builder, ellipsoid, finish):
    """Kembalikan objek bagian badan; finish(builder, name) membuat objek di koleksi kit."""
    obs = []
    # lengan baju pendek gembung (warna kemeja) — hem tertutup cakram, lengan kulit keluar dari bawahnya
    b = Builder()
    lathe(b, [(0.025, 0.05), (0.0, 0.07), (-0.04, 0.082), (-0.1, 0.082), (-0.125, 0.076)], seg=14)
    obs.append(finish(b, 'arm_upper_short'))
    # lengan baju panjang atas (sampai siku)
    b = Builder()
    lathe(b, [(0.025, 0.05), (0.0, 0.068), (-0.05, 0.072), (-0.15, 0.064), (-0.215, 0.058)], seg=12)
    obs.append(finish(b, 'arm_upper_long'))
    # lengan bawah kulit + tangan (dipakai saat lengan pendek; mulai di atas siku, tersembunyi di lengan baju)
    b = Builder()
    lathe(b, rounded(0.1, -0.15, 0.047, 0.043), seg=10)
    mitten(b, ellipsoid, -0.2)
    obs.append(finish(b, 'arm_lower_skin'))
    # lengan bawah berlengan baju (manset) — tangan terpisah (kulit)
    b = Builder()
    lathe(b, [(0.03, 0.058), (-0.06, 0.057), (-0.13, 0.054), (-0.15, 0.058), (-0.165, 0.058)], seg=12)
    obs.append(finish(b, 'arm_lower_sleeve'))
    b = Builder()
    lathe(b, rounded(-0.12, -0.16, 0.04, 0.04, rings=2), seg=8)
    mitten(b, ellipsoid, -0.2)
    obs.append(finish(b, 'hand'))
    # paha & betis gempal lurus
    b = Builder()
    lathe(b, rounded(0.04, -0.37, 0.088, 0.08), seg=12)
    obs.append(finish(b, 'leg_thigh'))
    b = Builder()
    lathe(b, rounded(0.03, -0.31, 0.078, 0.07), seg=12)
    obs.append(finish(b, 'leg_shin'))
    # sepatu bulat bersol datar (alas di -0.355 dari lutut ≈ tanah)
    b = Builder()
    ellipsoid(b, 0, -0.035, -0.315, 0.078, 0.118, 0.055, seg=14, rings=8)
    for i, v in enumerate(b.verts):
        if v[2] < -0.352:
            b.verts[i] = (v[0], v[1], -0.352)
    obs.append(finish(b, 'shoe'))
    # celana pendek lebar selutut: pinggang elips + dua pipa kaki
    b = Builder()
    lathe(b, [(0.11, 0.165), (0.04, 0.175), (-0.05, 0.172)], seg=16, sx=1.0, sy=0.78, cap_bottom=False)
    for s in (-1, 1):
        lathe(b, [(0.0, 0.1), (-0.12, 0.108), (-0.215, 0.11)], seg=12, cx=s * 0.088, cap_top=False)
    obs.append(finish(b, 'shorts'))
    # pinggul rapat untuk celana panjang
    b = Builder()
    lathe(b, [(0.11, 0.158), (0.03, 0.166), (-0.03, 0.16), (-0.05, 0.145)], seg=16, sy=0.8)
    obs.append(finish(b, 'hips'))
    # rok A selutut & rok panjang (gamis) sampai mata kaki
    b = Builder()
    lathe(b, [(0.11, 0.16), (0.0, 0.2), (-0.14, 0.25), (-0.27, 0.29)], seg=18, sy=0.85, cap_bottom=False)
    obs.append(finish(b, 'skirt'))
    b = Builder()
    lathe(b, [(0.11, 0.16), (-0.05, 0.2), (-0.3, 0.26), (-0.55, 0.31), (-0.67, 0.33)], seg=18, sy=0.85, cap_bottom=False)
    obs.append(finish(b, 'skirt_long'))
    return obs
