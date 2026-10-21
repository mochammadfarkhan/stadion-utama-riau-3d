"""
Badan gaya "aesthetic avatar" (referensi tim: torso ramping berpinggang, lengan & kaki langsing, tangan mitten,
lengan sweater longgar, celana kargo lebar, sneaker tebal). Dipanggil chibi_kit.build(); koordinat = ruang pivot
Humanoid (Humanoid.dim.js; pivot tidak diubah agar animasi/pose tetap):

  torso        : pivot spine (= pinggul, z = 0); bahu di z ≈ 0.37, pinggang 0.2, pinggul 0.08
  lengan atas  : pivot bahu, menggantung ke -z (DIM.upperArm 0.20)
  lengan bawah : pivot siku (DIM.lowerArm 0.18); tangan sampai ±0.27 di bawah siku
  paha         : pivot pinggul (DIM.thigh 0.36); betis & sepatu: pivot lutut (DIM.shin 0.34, tanah di -0.36)
  bawahan      : pivot body (pinggul)

Depan = -Y Blender (+Z three). Penampang superelips (kotak membulat) khas avatar blok halus.
"""
import math


def ring_point(rx, ry, a, n):
    """Titik superelips |x/rx|^n + |y/ry|^n = 1 pada sudut a (n = 2 elips, > 2 makin kotak)."""
    c, s = math.cos(a), math.sin(a)
    e = 2.0 / n
    return rx * math.copysign(abs(c) ** e, c), ry * math.copysign(abs(s) ** e, s)


def lathe(b, profile, seg=16, n=2.0, cx=0.0, cy=0.0, cap_top=True, cap_bottom=True):
    """Permukaan dari profil [(z, rx, ry)] (z menurun); penampang superelips eksponen n, pusat (cx, cy)."""
    verts, faces = [], []
    for z, rx, ry in profile:
        for s in range(seg):
            x, y = ring_point(rx, ry, 2 * math.pi * s / seg, n)
            verts.append((cx + x, cy + y, z))
    rings = len(profile)
    for i in range(rings - 1):
        a0, a1 = i * seg, (i + 1) * seg
        faces += [(a0 + s, a0 + (s + 1) % seg, a1 + (s + 1) % seg, a1 + s) for s in range(seg)]
    if cap_top:
        verts.append((cx, cy, profile[0][0]))
        t = len(verts) - 1
        faces += [(t, (s + 1) % seg, s) for s in range(seg)]
    if cap_bottom:
        verts.append((cx, cy, profile[-1][0]))
        bt = len(verts) - 1
        last = (rings - 1) * seg
        faces += [(bt, last + s, last + (s + 1) % seg) for s in range(seg)]
    b.add(verts, faces)


def tube(z_top, z_bot, r_top, r_bot, ry_k=1.0, dome=0.6):
    """Profil tabung lurus/meruncing dengan ujung membulat (dome = tinggi kubah relatif jari-jari)."""
    prof = []
    for t in (0.0, 0.45, 0.8):
        k = math.sin((t * 0.85 + 0.15) * math.pi / 2)
        prof.append((z_top + r_top * dome * (1 - k), r_top * k, r_top * k * ry_k))
    prof += [(z_top - 0.01, r_top, r_top * ry_k), (z_bot + 0.01, r_bot, r_bot * ry_k)]
    for t in (0.2, 0.55, 0.85):
        k = math.cos(t * math.pi / 2)
        prof.append((z_bot - r_bot * dome * math.sin(t * math.pi / 2), r_bot * k, r_bot * k * ry_k))
    return prof


def mitten(b, ellipsoid, zc):
    """Tangan mitten avatar: telapak membulat (pipih ke arah badan) + jempol di depan."""
    ellipsoid(b, 0, 0.004, zc, 0.034, 0.048, 0.058, seg=12, rings=8)
    ellipsoid(b, 0, -0.036, zc + 0.02, 0.019, 0.02, 0.032, seg=8, rings=6)


def build_body(Builder, ellipsoid, finish):
    """Kembalikan objek bagian badan; finish(builder, name) membuat objek di koleksi kit."""
    obs = []
    # torso: bahu membulat, dada, pinggang ramping, pinggul sedikit melebar (atasan pas badan)
    b = Builder()
    lathe(b, [(0.378, 0.06, 0.05), (0.372, 0.12, 0.08), (0.358, 0.152, 0.095), (0.33, 0.158, 0.1),
              (0.27, 0.146, 0.098), (0.2, 0.118, 0.088), (0.14, 0.124, 0.09), (0.085, 0.14, 0.096)],
          seg=20, n=2.6)
    obs.append(finish(b, 'torso'))
    # lengan atas: lengan pendek pas (kaos) / lengan sweater longgar
    b = Builder()
    lathe(b, tube(0.02, -0.11, 0.052, 0.05), seg=12, n=2.3)
    obs.append(finish(b, 'arm_upper_short'))
    b = Builder()
    lathe(b, tube(0.02, -0.215, 0.058, 0.062), seg=12, n=2.2)
    obs.append(finish(b, 'arm_upper_long'))
    # lengan bawah kulit + tangan (lengan pendek); mulai di atas siku, tersembunyi di lengan baju
    b = Builder()
    lathe(b, tube(0.1, -0.15, 0.04, 0.036), seg=10, n=2.2)
    mitten(b, ellipsoid, -0.198)
    obs.append(finish(b, 'arm_lower_skin'))
    # lengan sweater bawah: menggembung lalu mengerut di pergelangan (gaya slouchy)
    b = Builder()
    lathe(b, [(0.04, 0.062, 0.062), (-0.04, 0.07, 0.07), (-0.11, 0.072, 0.072), (-0.15, 0.06, 0.06),
              (-0.165, 0.05, 0.05)], seg=12, n=2.2)
    obs.append(finish(b, 'arm_lower_sleeve'))
    b = Builder()
    lathe(b, tube(-0.13, -0.16, 0.034, 0.034, dome=0.3), seg=8)
    mitten(b, ellipsoid, -0.198)
    obs.append(finish(b, 'hand'))
    # kaki langsing (kulit / legging) dan kaki celana kargo lebar lurus
    b = Builder()
    lathe(b, tube(0.04, -0.37, 0.07, 0.06), seg=12, n=2.3)
    obs.append(finish(b, 'leg_thigh'))
    b = Builder()
    lathe(b, tube(0.03, -0.3, 0.058, 0.048), seg=12, n=2.3)
    obs.append(finish(b, 'leg_shin'))
    b = Builder()
    lathe(b, tube(0.05, -0.37, 0.085, 0.082), seg=12, n=2.4)
    obs.append(finish(b, 'leg_thigh_wide'))
    b = Builder()
    lathe(b, [(0.03, 0.082, 0.082), (-0.15, 0.086, 0.086), (-0.27, 0.092, 0.09), (-0.305, 0.094, 0.092)],
          seg=12, n=2.4, cap_bottom=True)
    obs.append(finish(b, 'leg_shin_wide'))
    # sneaker tebal bersol datar (alas di -0.352 dari lutut ≈ tanah)
    b = Builder()
    lathe(b, [(-0.27, 0.05, 0.06), (-0.3, 0.07, 0.1), (-0.33, 0.075, 0.115), (-0.352, 0.074, 0.112)],
          seg=14, n=3.0, cy=-0.028)
    obs.append(finish(b, 'shoe'))
    # bawahan: celana pendek pas, pinggang+sabuk celana panjang, rok mini A, rok panjang
    b = Builder()
    lathe(b, [(0.11, 0.142, 0.1), (0.04, 0.152, 0.104), (-0.04, 0.15, 0.1)], seg=16, n=2.6, cap_bottom=False)
    for s in (-1, 1):
        lathe(b, [(0.0, 0.078, 0.078), (-0.1, 0.08, 0.08), (-0.15, 0.082, 0.082)], seg=12, cx=s * 0.07, cap_top=False)
    obs.append(finish(b, 'shorts'))
    b = Builder()
    lathe(b, [(0.115, 0.142, 0.1), (0.06, 0.15, 0.104), (0.0, 0.152, 0.104), (-0.05, 0.14, 0.096)], seg=16, n=2.6)
    obs.append(finish(b, 'hips'))
    b = Builder()
    lathe(b, [(0.11, 0.142, 0.1), (0.02, 0.17, 0.12), (-0.08, 0.2, 0.15), (-0.17, 0.23, 0.18)],
          seg=18, n=2.2, cap_bottom=False)
    obs.append(finish(b, 'skirt'))
    b = Builder()
    lathe(b, [(0.11, 0.142, 0.1), (-0.05, 0.18, 0.14), (-0.3, 0.24, 0.2), (-0.55, 0.29, 0.25), (-0.67, 0.31, 0.27)],
          seg=18, n=2.2, cap_bottom=False)
    obs.append(finish(b, 'skirt_long'))
    return obs
