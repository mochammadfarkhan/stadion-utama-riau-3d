"""
Karakter jadi DIBANGUN DARI KODE mengikuti gambar rujukan user (sumber/preset/ref-*.jpg), metode procedural-3d-object
(E:/laragon/www/golden-temple/.claude/skills/procedural-3d-object): satuan meter dari satu SPEC, bagian = loft irisan
penampang, render berdampingan dengan rujukan → perbaiki → ulangi.

Langsung dalam pose game (lengan menggantung, miring REST_TILT), satu mesh low-poly faset per karakter, warna per
face (atribut warna linear) × atlas 512² (wajah dilukis, motif batik, sisanya putih). Bobot 13 tulang (nama = pivot
Humanoid) dihitung saat membangun: tiap bagian tahu tulangnya.

Keluaran: public/models/karakter/preset-<id>.glb (+ sumber/preset/<id>-rig.blend, atlas <id>-atlas.png).
Jalankan: blender -b --python-expr "import runpy;print(runpy.run_path(r'<skrip>')['build']())"
Koordinat Blender: +X kiri karakter, -Y depan, +Z atas.
"""
import math
import os
import sys

import bpy
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
SRC = os.path.join(ROOT, 'assets-src', 'blender', 'karakter', 'sumber', 'preset')
OUT = os.path.join(ROOT, 'public', 'models', 'karakter')
PRESETS = ('tactical_blonde', 'tactical_hijab', 'cardigan_hijab')
# Lembar rujukan per preset (+ apakah kepala ikut dicocokkan: hijab taktis memakai badan rujukan pirang).
AUTO_FIT = False
REFS = {'tactical_blonde': ('ref-tactical_blonde.jpg', True), 'tactical_hijab': ('ref-tactical_blonde.jpg', False),
        'cardigan_hijab': ('ref-cardigan_hijab.jpg', True)}
TAU = math.tau

# ---------------------------------------------------------------- SPEC (meter) — satu sumber kebenaran
CHIN_Z = 1.415         # dagu; kepala 0,245 m (≈ 1/6,9 tinggi, gaya stylized rujukan)
HEAD_H = 0.245
HEAD_K = HEAD_H / 0.225  # skala profil kepala
NECK_Z = 1.40          # pivot kepala
HIP_Z = 0.86           # body/spine + sendi pinggul
HIP_X = 0.085
KNEE_Z = 0.46
SHOULDER = (0.145, 1.32)
REST_TILT = math.radians(7)
UPPER_ARM = 0.26
FOREARM = 0.235
GRIP = 0.07            # titik pegang = pergelangan + GRIP
BONES = ('body', 'spine', 'headPivot', 'shoulderL', 'elbowL', 'handL', 'shoulderR', 'elbowR', 'handR',
         'hipL', 'kneeL', 'hipR', 'kneeR')
PARENT = {'spine': 'body', 'headPivot': 'spine', 'shoulderL': 'spine', 'elbowL': 'shoulderL', 'handL': 'elbowL',
          'shoulderR': 'spine', 'elbowR': 'shoulderR', 'handR': 'elbowR', 'hipL': 'body', 'kneeL': 'hipL',
          'hipR': 'body', 'kneeR': 'hipR'}

# Profil kepala: (tinggi dari dagu, rx, ry depan, ry belakang, geser y)
HEAD_PROFILE = (
    (0.000, 0.010, 0.010, 0.010, -0.034),
    (0.014, 0.028, 0.026, 0.026, -0.026),
    (0.036, 0.052, 0.054, 0.046, -0.012),
    (0.064, 0.066, 0.074, 0.066, -0.004),
    (0.095, 0.072, 0.082, 0.084, 0.000),
    (0.125, 0.074, 0.083, 0.092, 0.002),
    (0.158, 0.071, 0.078, 0.094, 0.006),
    (0.188, 0.060, 0.064, 0.082, 0.010),
    (0.210, 0.040, 0.042, 0.058, 0.012),
    (0.224, 0.012, 0.012, 0.018, 0.012),
)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from karakter_atlas import FACE_W, SKIN  # noqa: E402  (konstanta wajah bersama dengan pelukis atlas)
from karakter_fit import add_reference_planes, fit  # noqa: E402


def hexlin(h):
    """Warna sRGB hex → linear (atribut warna & glTF COLOR_0 linear)."""
    def c(v):
        v /= 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return (c((h >> 16) & 255), c((h >> 8) & 255), c(h & 255))


def ramp(v, a, b):
    if b == a:
        return 1.0 if v >= b else 0.0
    return max(0.0, min(1.0, (v - a) / (b - a)))


def lerp(a, b, t):
    return a + (b - a) * t


# ---------------------------------------------------------------- bobot (tiap bagian memilih fungsinya)
def arm_axis(sx):
    s = Vector((sx * SHOULDER[0], 0.0, SHOULDER[1]))
    d = Vector((sx * math.sin(REST_TILT), 0.0, -math.cos(REST_TILT)))
    u = Vector((math.cos(REST_TILT), 0.0, sx * math.sin(REST_TILT)))
    return s, d, u


def w_head(_p):
    return {'headPivot': 1.0}


def w_torso(p):
    head = ramp(p.z, NECK_Z - 0.01, NECK_Z + 0.04)
    spine = ramp(p.z, HIP_Z + 0.02, HIP_Z + 0.14)
    return {'body': 1 - spine, 'spine': spine * (1 - head), 'headPivot': spine * head}


def w_spine(_p):
    return {'spine': 1.0}


def w_hood(p):
    h = ramp(p.z, NECK_Z + 0.005, NECK_Z + 0.06)
    return {'spine': 1 - h, 'headPivot': h}


def w_coat(p):
    return w_torso(p) if p.z > HIP_Z + 0.02 else {'body': 1.0}


def w_legs(p):
    if p.z >= HIP_Z + 0.02:
        return w_torso(p)
    leg = ramp(HIP_Z + 0.02 - p.z, 0.0, 0.12)
    knee = ramp(KNEE_Z + 0.05 - p.z, 0.0, 0.10)
    left = ramp(p.x, -0.025, 0.025)
    w = {'body': 1 - leg}
    for side, share in (('L', left), ('R', 1 - left)):
        w[f'hip{side}'] = leg * share * (1 - knee)
        w[f'knee{side}'] = leg * share * knee
    return w


def w_arm(sx):
    side = 'L' if sx > 0 else 'R'
    s, d, _u = arm_axis(sx)

    def f(p):
        t = (p - s).dot(d)
        on = ramp(t, -0.03, 0.05)
        el = ramp(t, UPPER_ARM - 0.04, UPPER_ARM + 0.04)
        ha = ramp(t, UPPER_ARM + FOREARM - 0.03, UPPER_ARM + FOREARM + 0.02)
        return {'spine': 1 - on, f'shoulder{side}': on * (1 - el), f'elbow{side}': on * el * (1 - ha),
                f'hand{side}': on * el * ha}
    return f


# ---------------------------------------------------------------- pembangun mesh
class Mesh:
    """Kumpulan vertex (dengan bobot) + face (warna, mode tekstur)."""

    def __init__(self):
        self.v = []
        self.w = []
        self.f = []  # (indeks, warna, region|None)

    def vert(self, p, weigh):
        self.v.append(Vector(p))
        self.w.append(weigh(Vector(p)))
        return len(self.v) - 1

    def face(self, idx, color, region=None):
        pts = [self.v[i] for i in idx]
        c = sum(pts, Vector()) / len(pts)
        n = (pts[1] - pts[0]).cross(pts[2] - pts[0])
        n = n.normalized() if n.length > 1e-12 else Vector((0, 0, 1))
        col = color(c, n) if callable(color) else color
        reg = region(c, n) if callable(region) else region
        self.f.append((tuple(idx), col, reg))

    def loft(self, rings, color, weigh, closed=True, cap0=False, cap1=False, region=None):
        """Sambung cincin-cincin (jumlah titik sama) jadi tabung; cap = kipas ke titik tengah."""
        ids = [[self.vert(p, weigh) for p in r] for r in rings]
        n = len(rings[0])
        segs = n if closed else n - 1
        for a, b in zip(ids, ids[1:]):
            for i in range(segs):
                j = (i + 1) % n
                self.face((a[i], a[j], b[j], b[i]), color, region)
        for cap, ring, rev in ((cap0, ids[0], True), (cap1, ids[-1], False)):
            if not cap:
                continue
            c = sum((self.v[i] for i in ring), Vector()) / n
            ci = self.vert(c, weigh)
            for i in range(segs):
                j = (i + 1) % n
                self.face((ring[j], ring[i], ci) if rev else (ring[i], ring[j], ci), color, region)

    def box(self, c, ax, ay, az, color, weigh):
        """Kotak dari pusat + tiga vektor setengah-sisi."""
        c, ax, ay, az = Vector(c), Vector(ax), Vector(ay), Vector(az)
        p = [self.vert(c + sx * ax + sy * ay + sz * az, weigh)
             for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)]
        for q in ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)):
            self.face(tuple(p[i] for i in q), color)

    def blob(self, c, rx, ry, rz, color, weigh, n=8, m=5):
        c = Vector(c)
        rings = []
        for k in range(1, m):
            a = math.pi * k / m
            rings.append([c + Vector((rx * math.sin(a) * math.cos(TAU * i / n), ry * math.sin(a) * math.sin(TAU * i / n),
                                      -rz * math.cos(a))) for i in range(n)])
        self.loft(rings, color, weigh, cap0=True, cap1=True)

    def torus(self, c, u, v, big, small, color, weigh, n=12, m=4):
        c, u, v = Vector(c), Vector(u).normalized(), Vector(v).normalized()
        w = u.cross(v)
        rings = []
        for i in range(n):
            a = TAU * i / n
            radial = u * math.cos(a) + v * math.sin(a)
            rings.append([c + radial * (big + small * math.cos(TAU * k / m)) + w * small * math.sin(TAU * k / m)
                          for k in range(m)])
        rings.append(rings[0])
        self.loft(rings, color, weigh)


def ring_z(z, rx, ryf, ryb=None, n=14, cx=0.0, cy=0.0, a0=None, a1=None, sq=2.0):
    """Cincin horizontal; sudut 0 = depan (-Y). a0..a1 = busur terbuka (radian dari depan), selain itu penuh."""
    ryb = ryf if ryb is None else ryb
    pts = []
    full = a0 is None
    for i in range(n):
        a = (TAU * i / n) if full else lerp(a0, a1, i / (n - 1))
        s, c = math.sin(a), -math.cos(a)  # c<0 → depan
        e = 2.0 / sq
        sx = math.copysign(abs(s) ** e, s)
        cy_ = math.copysign(abs(c) ** e, c)
        pts.append(Vector((cx + rx * sx, cy + (ryf if cy_ < 0 else ryb) * cy_, z)))
    return pts


def ring_axis(c, u, v, ru, rv, n=10):
    return [Vector(c) + Vector(u) * ru * math.cos(TAU * i / n) + Vector(v) * rv * math.sin(TAU * i / n) for i in range(n)]


def tube(path, radii, up=(1, 0, 0), n=10, flat=1.0):
    """Cincin sepanjang jalur (frame: tangen, up diproyeksikan)."""
    path = [Vector(p) for p in path]
    rings = []
    for i, p in enumerate(path):
        t = (path[min(i + 1, len(path) - 1)] - path[max(i - 1, 0)]).normalized()
        u = Vector(up) - t * Vector(up).dot(t)
        u = u.normalized()
        v = t.cross(u)
        rings.append(ring_axis(p, u, v, radii[i], radii[i] * flat, n))
    return rings


# ---------------------------------------------------------------- bagian tubuh
def head_rings(scale=1.0, grow=0.0, h_from=0.0, window=None, n=16, bottom=()):
    """Cincin kepala (atau cangkang di atasnya). window(h) → setengah sudut bukaan wajah (rad) atau 0."""
    rings = []
    for (h, rx, ryf, ryb, yo) in tuple(bottom) + tuple(e for e in HEAD_PROFILE if e[0] >= h_from):
        w = window(h) if window else 0.0
        kw = dict(a0=w, a1=TAU - w) if w > 0 else {}
        if window and w <= 0:
            kw = dict(a0=0.0, a1=TAU)
        k = scale * HEAD_K
        rings.append(ring_z(CHIN_Z + h * k, rx * k + grow, ryf * k + grow, ryb * k + grow, n=n, cy=yo * HEAD_K, **kw))
    return rings


def build_head(m, skin, ears=True):
    face_region = lambda c, n: 'face' if n.y < -0.25 and abs(c.x) < FACE_W / 2 and c.z > CHIN_Z - 0.005 else None  # noqa: E731
    m.loft(head_rings(), skin, w_head, cap0=True, cap1=True, region=face_region)
    # Hidung: piramida kecil (ikut terproyeksi tekstur wajah).
    K = HEAD_K
    top = m.vert((0, -0.083 * K, CHIN_Z + 0.098 * K), w_head)
    lft = m.vert((-0.011 * K, -0.079 * K, CHIN_Z + 0.060 * K), w_head)
    rgt = m.vert((0.011 * K, -0.079 * K, CHIN_Z + 0.060 * K), w_head)
    tip = m.vert((0, -0.095 * K, CHIN_Z + 0.064 * K), w_head)
    for q in ((top, lft, tip), (top, tip, rgt), (lft, rgt, tip)):
        m.face(q, skin, face_region)
    # Leher.
    m.loft([ring_z(z, 0.046, 0.046, 0.048, n=10, cy=0.006) for z in (1.34, 1.39, 1.45)], skin, w_torso)
    if ears:
        for sx in (1, -1):
            m.blob((sx * 0.072 * HEAD_K, 0.008, CHIN_Z + 0.085 * HEAD_K), 0.012, 0.018, 0.026, skin, w_head, n=6, m=4)


def build_hand(m, sx, skin, wrist_t=UPPER_ARM + FOREARM):
    s, d, u = arm_axis(sx)
    v = Vector((0, 1, 0))
    w = w_arm(sx)
    secs = ((0.0, 0.021, 0.026), (0.03, 0.022, 0.040), (0.075, 0.019, 0.042), (0.12, 0.015, 0.034), (0.15, 0.010, 0.020), (0.165, 0.005, 0.008))
    m.loft([ring_axis(s + d * (wrist_t + t), u, v, ru, rv, 8) for t, ru, rv in secs], skin, w, cap0=True, cap1=True)
    # Ibu jari: ke depan-bawah dari sisi dalam telapak.
    base = s + d * (wrist_t + 0.03) + v * -0.03
    path = [base, base + d * 0.035 + v * -0.012 - u * sx * 0.004, base + d * 0.065 + v * -0.016]
    m.loft(tube(path, (0.011, 0.009, 0.005), up=u, n=6), skin, w, cap1=True)


def build_sleeve(m, sx, color, secs, w=None):
    """secs = [(t, ru, rv)] sepanjang sumbu lengan."""
    s, d, u = arm_axis(sx)
    v = Vector((0, 1, 0))
    m.loft([ring_axis(s + d * t, u, v, ru, rv, 10) for t, ru, rv in secs], color, w or w_arm(sx), cap0=True, cap1=True)


def build_legs(m, color, secs, cap1=True):
    for sx in (1, -1):
        m.loft([ring_z(z, rx, ry, ry, n=12, cx=sx * HIP_X + sx * ox) for z, rx, ry, ox in secs], color, w_legs,
               cap0=True, cap1=cap1)


def build_foot(m, sx, color, sole, h=0.10, length=0.25, w=0.048, shaft=None):
    """Sepatu: loft sepanjang -Y (tumit → ujung); sole = warna untuk face terbawah."""
    x = sx * (HIP_X + 0.005)
    col = lambda c, n: sole if c.z < 0.024 or n.z < -0.7 else color  # noqa: E731
    secs = ((0.055, 0.75, 0.85), (0.02, 1.0, 1.0), (-0.07, 0.86, 1.04), (-0.14, 0.74, 1.0), (-0.185, 0.6, 0.88), (-0.205, 0.32, 0.6))
    rings = []
    for y, hk, wk in secs:
        hh = h * hk
        rings.append([Vector((x + w * wk * math.cos(TAU * i / 10), y, hh / 2 + hh / 2 * math.sin(TAU * i / 10)))
                      for i in range(10)])
    rings = [[Vector((p.x, p.y * length / 0.25, p.z)) for p in r] for r in rings]
    # loft sepanjang Y: cincin di bidang XZ
    m.loft(rings, col, w_legs, cap0=True, cap1=True)
    if shaft:
        z0, z1, r = shaft
        m.loft([ring_z(z, r * k, r * k, r * k, n=12, cx=x, cy=0.015) for z, k in ((z0, 1.0), (z1 - 0.025, 1.0), (z1 - 0.02, 1.08), (z1, 1.08))],
               color, w_legs, cap1=True)


def build_sunglasses(m, z_top, y_front, color):
    """Kacamata hitam bertengger di atas kepala/hijab, lensa miring ke belakang."""
    tilt = Vector((0, 0.55, 0.83)).normalized()  # arah 'atas' lensa (rebah ke belakang)
    for sx in (1, -1):
        c = Vector((sx * 0.036, y_front, z_top))
        m.box(c, (0.024, 0, 0), tilt * 0.016, Vector((1, 0, 0)).cross(tilt) * 0.003, color, w_head)
        # gagang: dari sisi luar lensa ke belakang kepala
        a = Vector((sx * 0.06, y_front + 0.01, z_top - 0.006))
        b = Vector((sx * 0.072, y_front + 0.10, z_top - 0.035))
        mid = (a + b) / 2
        m.box(mid, (0.002, 0, 0), (b - a) / 2, (0, 0, 0.003), color, w_head)
    m.box((0, y_front - 0.002, z_top + 0.004), (0.012, 0, 0), (0, 0.003, 0), (0, 0, 0.003), color, w_head)


# ---------------------------------------------------------------- pakaian
GOLD = 0xD9A93A


def torso_secs_shirt():
    return ((0.93, 0.124, 0.088, 0.086), (1.00, 0.112, 0.080, 0.078), (1.10, 0.118, 0.088, 0.080),
            (1.19, 0.128, 0.114, 0.084), (1.25, 0.134, 0.104, 0.084), (1.30, 0.142, 0.088, 0.080),
            (1.335, 0.134, 0.074, 0.072), (1.365, 0.105, 0.060, 0.062), (1.39, 0.062, 0.050, 0.052), (1.405, 0.048, 0.046, 0.048))


def build_tactical(m, hijab):
    skin = hexlin(SKIN)
    shirt = hexlin(0xF3F3F6)
    olive = hexlin(0x5F6B35)
    olive_dk = hexlin(0x515C2C)
    gold = hexlin(GOLD)
    build_head(m, skin, ears=not hijab)
    # Kemeja: kerah V (kulit), dimasukkan ke celana.
    def shirt_col(c, n):
        if not hijab and c.z > 1.255 and n.y < -0.2 and abs(c.x) < (c.z - 1.255) * 0.32 + 0.004:
            return skin
        return shirt
    m.loft([ring_z(z, rx, ryf, ryb, n=16) for z, rx, ryf, ryb in torso_secs_shirt()], shirt_col, w_torso, cap1=True)
    if not hijab:
        for sx in (1, -1):  # kerah terbuka melebar
            q = [m.vert(p, w_torso) for p in ((sx * 0.040, -0.040, 1.405), (sx * 0.006, -0.086, 1.29),
                                               (sx * 0.056, -0.090, 1.335), (sx * 0.074, -0.058, 1.385))]
            m.face(q if sx > 0 else q[::-1], shirt)
        m.torus((0, -0.03, 1.355), (1, 0, 0), (0, -0.55, -0.35), 0.05, 0.003, gold, w_torso, n=10, m=3)  # kalung
    for sx in (1, -1):  # lengan kemeja digulung sampai bawah siku
        build_sleeve(m, sx, shirt, ((-0.02, 0.018, 0.022), (0.015, 0.040, 0.044), (0.06, 0.047, 0.049), (0.16, 0.044, 0.046),
                                    (0.27, 0.046, 0.046), (0.285, 0.054, 0.054), (0.33, 0.052, 0.052)))
        build_sleeve(m, sx, skin, ((0.31, 0.036, 0.038), (0.40, 0.030, 0.032), (0.49, 0.022, 0.026)))
        build_hand(m, sx, skin)
        s, d, u = arm_axis(sx)
        for k in (0.0, 0.012):  # gelang emas
            m.torus(s + d * (0.475 + k), u, Vector((0, 1, 0)), 0.029, 0.0035, gold, w_arm(sx), n=10, m=3)
    # Celana kargo + saku.
    m.loft([ring_z(z, rx, ryf, ryb, n=16) for z, rx, ryf, ryb in
            ((0.995, 0.124, 0.088, 0.088), (0.93, 0.150, 0.100, 0.110), (0.85, 0.162, 0.100, 0.116), (0.78, 0.150, 0.094, 0.100))],
           olive, w_legs, cap0=True, cap1=True)
    build_legs(m, olive, ((0.86, 0.086, 0.088, 0.0), (0.70, 0.080, 0.084, 0.004), (0.50, 0.066, 0.068, 0.006),
                          (0.44, 0.064, 0.066, 0.006), (0.30, 0.062, 0.064, 0.006), (0.19, 0.060, 0.062, 0.006)))
    for sx in (1, -1):
        x = sx * (HIP_X + 0.082)
        m.box((x, 0.0, 0.565), (0.012, 0, 0), (0, 0.048, 0), (0, 0, 0.068), olive_dk, w_legs)
        m.box((x + sx * 0.004, 0.0, 0.632), (0.013, 0, 0), (0, 0.051, 0), (0, 0, 0.016), olive, w_legs)
    # Sabuk hitam + ekor menjuntai.
    belt = hexlin(0x1E1E20)
    m.loft([ring_z(z, 0.131, 0.093, 0.093, n=16) for z in (0.94, 0.975)], belt, w_torso)
    m.box((0.0, -0.095, 0.957), (0.016, 0, 0), (0, 0.004, 0), (0, 0, 0.02), hexlin(0x2A2A2C), w_torso)
    m.box((0.042, -0.098, 0.86), (0.014, 0, 0), (0, 0.003, 0), (0, 0, 0.09), belt, w_legs)
    # Sepatu bot.
    boot, sole = hexlin(0x5B3A28), hexlin(0x2A1E17)
    for sx in (1, -1):
        build_foot(m, sx, boot, sole, h=0.09, length=0.26, w=0.05, shaft=(0.05, 0.215, 0.06))
    if hijab:
        build_hijab(m, hexlin(0xE2CBA2), hexlin(0x9A8268), tail=False)
        build_sunglasses(m, CHIN_Z + HEAD_H + 0.030, -0.040, hexlin(0x1C1C1E))
    else:
        build_blonde_hair(m, hexlin(0xEDCD78), hexlin(0x2A2A2C))
        build_sunglasses(m, CHIN_Z + HEAD_H + 0.012, -0.050, hexlin(0x1C1C1E))
        for sx in (1, -1):  # anting bulat
            m.torus((sx * 0.077, -0.002, CHIN_Z + 0.050), (0, 1, 0), (0, 0, 1), 0.013, 0.0025, gold, w_head, n=10, m=3)


def build_blonde_hair(m, hair, tie):
    # Cangkang rambut: terbuka di wajah di bawah garis rambut; kuncir ditarik ke belakang.
    def window(h):
        return math.radians(78) if h < 0.168 else 0.0
    rings = head_rings(scale=1.03, grow=0.012, h_from=0.03, window=window)
    m.loft(rings, hair, w_head, closed=False, cap1=True)
    # Poni menyamping + helai pembingkai wajah.
    for path, rad in (([(0.02, -0.088, CHIN_Z + 0.205), (-0.025, -0.094, CHIN_Z + 0.178), (-0.06, -0.088, CHIN_Z + 0.150),
                        (-0.075, -0.070, CHIN_Z + 0.120)], (0.016, 0.020, 0.016, 0.008)),
                      ([(-0.074, -0.060, CHIN_Z + 0.150), (-0.080, -0.064, CHIN_Z + 0.090), (-0.074, -0.056, CHIN_Z + 0.030),
                        (-0.066, -0.050, CHIN_Z - 0.010)], (0.012, 0.014, 0.011, 0.004)),
                      ([(0.074, -0.060, CHIN_Z + 0.150), (0.080, -0.062, CHIN_Z + 0.095), (0.076, -0.052, CHIN_Z + 0.045)],
                       (0.016, 0.018, 0.006))):
        m.loft(tube(path, rad, up=(0, 1, 0), n=6, flat=0.35), hair, w_head, cap0=True, cap1=True)
    # Kuncir kuda tinggi.
    path = [(0, 0.070, CHIN_Z + 0.205), (0, 0.108, CHIN_Z + 0.228), (0, 0.150, CHIN_Z + 0.200), (0.004, 0.172, CHIN_Z + 0.120),
            (0.010, 0.168, CHIN_Z + 0.020), (0.016, 0.150, CHIN_Z - 0.080), (0.018, 0.130, CHIN_Z - 0.150)]
    m.loft(tube(path, (0.030, 0.040, 0.050, 0.050, 0.043, 0.030, 0.006), up=(1, 0, 0), n=10, flat=0.8), hair, w_head,
           cap0=True, cap1=True)
    m.torus((0, 0.090, CHIN_Z + 0.222), (1, 0, 0), (0, 0.5, -0.86), 0.028, 0.006, tie, w_head, n=10, m=3)


def build_hijab(m, cloth, under, tail=True):
    """Kerudung: tudung (bukaan wajah, ciput gelap di tepi dahi), kain menutup leher & bahu, ekor di punggung."""
    def window(h):
        return math.radians(60) if 0.004 < h < 0.165 else 0.0

    def col(c, n):
        return under if (c.z > CHIN_Z + 0.135 and c.y < -0.05 and c.z < CHIN_Z + 0.185) else cloth
    wrap = ((-0.035, 0.058, 0.060, 0.062, 0.010), (-0.012, 0.062, 0.066, 0.066, 0.000), (0.004, 0.064, 0.070, 0.068, -0.004),
            (0.036, 0.064, 0.072, 0.064, -0.006))
    rings = head_rings(scale=1.08, grow=0.013, h_from=0.05, window=window, bottom=wrap)
    m.loft(rings, col, w_hood, closed=False, cap1=True)
    # Kain jatuh menutup bahu & dada (ujung depan lebih panjang).
    def drape(z, rx, ryf, ryb, drop=0.0):
        r = ring_z(z, rx, ryf, ryb, n=18)
        return [Vector((p.x, p.y, p.z - drop * max(0.0, -p.y / max(ryf, 1e-6)) ** 1.5)) for p in r]
    m.loft([drape(CHIN_Z - 0.030, 0.068, 0.070, 0.074), drape(1.39, 0.120, 0.100, 0.098, 0.01),
            drape(1.355, 0.168, 0.118, 0.108, 0.04), drape(1.32, 0.188, 0.126, 0.116, 0.10),
            drape(1.295, 0.192, 0.130, 0.118, 0.15)],
           cloth, w_torso)
    if tail:
        path = [(0.02, 0.095, 1.40), (0.035, 0.130, 1.28), (0.045, 0.140, 1.14), (0.05, 0.138, 1.02)]
        m.loft(tube(path, (0.035, 0.042, 0.040, 0.030), up=(1, 0, 0), n=8, flat=0.25), cloth, w_spine, cap1=True)


def build_cardigan(m):
    skin = hexlin(SKIN)
    maroon = hexlin(0x7C3430)
    batik = hexlin(0x4B2A1C)
    taupe = hexlin(0x8C7762)
    build_head(m, skin, ears=False)
    # Blus batik (muka depan dipetakan ke motif atlas).
    blouse_region = lambda c, n: 'batik' if n.y < -0.3 and abs(c.x) < 0.11 else None  # noqa: E731
    m.loft([ring_z(z, rx, ryf, ryb, n=16) for z, rx, ryf, ryb in torso_secs_shirt()[:-1]], batik, w_torso, cap1=True,
           region=blouse_region)
    # Kardigan panjang terbuka di depan.
    def gap(z):
        return math.radians(lerp(30, 20, ramp(z, 1.0, 1.36)))
    secs = ((1.375, 0.150, 0.080, 0.078), (1.33, 0.170, 0.100, 0.092), (1.22, 0.152, 0.130, 0.098), (1.10, 0.142, 0.115, 0.097),
            (1.00, 0.152, 0.116, 0.104), (0.88, 0.180, 0.128, 0.122), (0.72, 0.196, 0.134, 0.132), (0.58, 0.204, 0.138, 0.138))
    m.loft([ring_z(z, rx, ryf, ryb, n=20, a0=gap(z), a1=TAU - gap(z)) for z, rx, ryf, ryb in secs], maroon, w_coat, closed=False)
    for sx in (1, -1):  # lengan balon bermanset
        build_sleeve(m, sx, maroon, ((-0.02, 0.022, 0.026), (0.015, 0.046, 0.050), (0.06, 0.056, 0.058), (0.18, 0.060, 0.060), (0.29, 0.064, 0.064),
                                     (0.38, 0.068, 0.068), (0.445, 0.048, 0.048), (0.452, 0.040, 0.040), (0.475, 0.038, 0.038)))
        build_sleeve(m, sx, skin, ((0.46, 0.024, 0.027), (0.50, 0.021, 0.025)))
        build_hand(m, sx, skin)
    s, d, u = arm_axis(1)  # jam tangan di kiri
    m.torus(s + d * 0.485, u, Vector((0, 1, 0)), 0.026, 0.004, hexlin(0x6B4426), w_arm(1), n=10, m=3)
    m.box(s + d * 0.485 + Vector((0, -0.03, 0)), (0.008, 0, 0), (0, 0.003, 0), (0, 0, 0.008), hexlin(0xD8D8DC), w_arm(1))
    s, d, u = arm_axis(-1)  # gelang manik emas di kanan
    for k in (0.0, 0.013):
        for i in range(9):
            a = TAU * i / 9
            p = s + d * (0.482 + k) + u * math.cos(a) * 0.029 + Vector((0, 1, 0)) * math.sin(a) * 0.031
            m.blob(p, 0.0055, 0.0055, 0.0055, hexlin(GOLD), w_arm(-1), n=5, m=3)
    # Kulot lebar + pergelangan kaki + loafer.
    m.loft([ring_z(z, rx, ryf, ryb, n=16) for z, rx, ryf, ryb in
            ((1.02, 0.120, 0.086, 0.086), (0.95, 0.150, 0.100, 0.108), (0.85, 0.166, 0.106, 0.116), (0.77, 0.158, 0.100, 0.104))],
           taupe, w_legs, cap0=True, cap1=True)
    build_legs(m, taupe, ((0.86, 0.090, 0.092, 0.0), (0.60, 0.100, 0.100, 0.010), (0.32, 0.112, 0.112, 0.016),
                          (0.115, 0.122, 0.122, 0.020)), cap1=True)
    for sx in (1, -1):
        m.loft([ring_z(z, 0.028, 0.030, 0.030, n=8, cx=sx * (HIP_X + 0.005), cy=0.01) for z in (0.03, 0.14)], skin, w_legs)
        build_foot(m, sx, hexlin(0x3E2A20), hexlin(0x241812), h=0.075, length=0.23, w=0.045)
        m.box((sx * (HIP_X + 0.005), 0.045, 0.018), (0.03, 0, 0), (0, 0.022, 0), (0, 0, 0.018), hexlin(0x241812), w_legs)
    # Tas selempang di pinggul kiri + tali dari bahu kiri.
    bag = hexlin(0x7B4B2B)
    m.box((0.215, 0.0, 0.84), (0.026, 0, 0), (0, 0.072, 0), (0, 0, 0.058), bag, w_spine)
    m.box((0.226, -0.002, 0.875), (0.018, 0, 0), (0, 0.074, 0), (0, 0, 0.026), hexlin(0x6A3F24), w_spine)
    m.loft(tube([(0.16, 0.02, 1.375), (0.205, 0.02, 1.25), (0.222, 0.02, 1.05), (0.222, 0.0, 0.90)],
                (0.007, 0.007, 0.007, 0.007), up=(0, 1, 0), n=4, flat=0.4), hexlin(0x5E3A20), w_spine)
    build_hijab(m, hexlin(0xB56A48), hexlin(0x6E3D2A), tail=True)
    build_sunglasses(m, CHIN_Z + HEAD_H + 0.030, -0.040, hexlin(0x1C1C1E))


# ---------------------------------------------------------------- atlas (wajah + batik): karakter_atlas.py (PIL, Python sistem)
def paint_atlas(path, brow_hex):
    import subprocess
    import sys as _sys
    script = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'karakter_atlas.py')
    py = os.environ.get('PYTHON_SISTEM', 'python')
    r = subprocess.run([py, script, path, hex(brow_hex)], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f'atlas gagal: {r.stderr}')
    return _sys


def region_uv(reg, p):
    if reg == 'face':
        u = (p.x + FACE_W / 2) / FACE_W
        v = (p.z - CHIN_Z) / HEAD_H
        return (min(max(u, 0), 1) * 0.5, 0.5 + min(max(v, 0), 1) * 0.5)
    if reg == 'batik':
        return (0.5 + ((p.x + 0.15) / 0.30 % 1) * 0.5, 0.5 + ((p.z - 0.95) / 0.42 % 1) * 0.5)
    return (0.75, 0.25)  # kuadran putih


# ---------------------------------------------------------------- rakit, rig, ekspor
def joint_heads():
    h = {'body': (0, 0, HIP_Z), 'spine': (0, 0, HIP_Z), 'headPivot': (0, 0.004, NECK_Z)}
    for side, sx in (('L', 1), ('R', -1)):
        s, d, _u = arm_axis(sx)
        h[f'shoulder{side}'] = tuple(s)
        h[f'elbow{side}'] = tuple(s + d * UPPER_ARM)
        h[f'hand{side}'] = tuple(s + d * (UPPER_ARM + FOREARM + GRIP))
        h[f'hip{side}'] = (sx * HIP_X, 0, HIP_Z)
        h[f'knee{side}'] = (sx * HIP_X, 0, KNEE_Z)
    return h


def to_object(m, pid, atlas_path):
    me = bpy.data.meshes.new(f'preset_{pid}')
    me.from_pydata([tuple(v) for v in m.v], [], [f[0] for f in m.f])
    col = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
    uv = me.uv_layers.new(name='UVMap')
    for poly, (_idx, c, reg) in zip(me.polygons, m.f):
        for li in poly.loop_indices:
            vi = me.loops[li].vertex_index
            col.data[li].color = (1.0, 1.0, 1.0, 1.0) if reg else (*c, 1.0)
            uv.data[li].uv = region_uv(reg, m.v[vi])
        poly.use_smooth = False
    me.color_attributes.active_color = col
    obj = bpy.data.objects.new(me.name, me)
    bpy.context.scene.collection.objects.link(obj)
    for b in BONES:
        obj.vertex_groups.new(name=b)
    for i, w in enumerate(m.w):
        tot = sum(w.values()) or 1.0
        for b, val in w.items():
            if val > 1e-4:
                obj.vertex_groups[b].add([i], val / tot, 'REPLACE')
    mat = bpy.data.materials.new(f'preset_{pid}')
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Roughness'].default_value = 0.85
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(atlas_path)
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    me.materials.append(mat)
    return obj


def preview_material(obj):
    """Untuk render pembanding saja: tekstur × warna vertex."""
    nt = obj.data.materials[0].node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    tex = next(n for n in nt.nodes if n.type == 'TEX_IMAGE')
    vc = nt.nodes.new('ShaderNodeVertexColor')
    vc.layer_name = 'Col'
    mix = nt.nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.blend_type = 'MULTIPLY'
    mix.inputs['Factor'].default_value = 1.0
    nt.links.new(tex.outputs['Color'], mix.inputs[6])
    nt.links.new(vc.outputs['Color'], mix.inputs[7])
    nt.links.new(mix.outputs[2], bsdf.inputs['Base Color'])


def build_one(pid, export=True):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    m = Mesh()
    if pid == 'cardigan_hijab':
        build_cardigan(m)
        brow = 0x3A2418
    else:
        build_tactical(m, hijab=pid == 'tactical_hijab')
        brow = 0x3A2418 if pid == 'tactical_hijab' else 0xA9824A
    ref, fit_head = REFS[pid]
    ref = os.path.join(SRC, ref)
    if AUTO_FIT:  # pencocokan siluet otomatis (rapuh untuk lembar A-pose berkuncir; default mati)
        print(f'{pid} cocok rujukan: {fit(m, ref, CHIN_Z, head=fit_head)}')
    atlas = os.path.join(SRC, f'{pid}-atlas.png')
    paint_atlas(atlas, brow)
    obj = to_object(m, pid, atlas)
    arm_data = bpy.data.armatures.new(f'rig_{pid}')
    arm = bpy.data.objects.new(f'rig_{pid}', arm_data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    heads = joint_heads()
    eb = {}
    for name in BONES:
        b = arm_data.edit_bones.new(name)
        b.head = heads[name]
        b.tail = Vector(heads[name]) + Vector((0, 0, 0.08 if name in ('body', 'spine', 'headPivot') else -0.08))
        eb[name] = b
    for name, par in PARENT.items():
        eb[name].parent = eb[par]
    bpy.ops.object.mode_set(mode='OBJECT')
    obj.parent = arm
    mod = obj.modifiers.new('Armature', 'ARMATURE')
    mod.object = arm
    tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    add_reference_planes(ref, max(v.z for v in m.v), CHIN_Z)
    if export:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SRC, f'{pid}-rig.blend'))
        for o in bpy.context.scene.objects:
            o.select_set(not o.get('rujukan'))
        out = os.path.join(OUT, f'preset-{pid}.glb')
        bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_skins=True,
                                  export_animations=False, export_morph=False, export_yup=True, export_texcoords=True,
                                  export_normals=True, export_vertex_color='ACTIVE')
    return obj, arm, tris


def build():
    return '\n'.join(f'{pid}: {build_one(pid)[2]} tris' for pid in PRESETS)
