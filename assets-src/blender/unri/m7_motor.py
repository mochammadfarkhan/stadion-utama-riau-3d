"""
Motor parkir kampus A01 bebek, A02 matic, A03 sport, A04 tua (katalog aset §4) untuk Blender — bentuk lekuk (bukan kotak):
bodi dibangun dari loft penampang superelips + Subdivision Surface, ban berprofil (lathe), pelek bersuara, garpu/stang/
knalpot/peredam kejut dari tabung. Dijalankan headless:

    "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" -b --python assets-src/blender/unri/m7_motor.py -- a01 a02 a03 a04
    (env M7_PREVIEW_DIR=<dir> → render pratinjau 4 sudut per varian, tanpa mengubah GLB bila M7_NO_EXPORT=1)

Konvensi katalog: meter, Z ke atas, moncong ke +Y Blender (= −Z three.js setelah ekspor Y-up), origin di tengah alas. Motor
dimiringkan ±6° ke kiri (bertumpu standar samping). Tiap varian diekspor 3 LOD: `<slug>.glb` (detail, ≤ ~4k segitiga,
dilihat dari dekat), `<slug>-lod.glb` (±1k segitiga, parkir padat) dan `<slug>-far.glb` (±150, siluet 2 material, jauh). Material (nama = konvensi M4):
unri:bodi (PUTIH; warna cat per instans dari runtime), unri:hitam (ban, jok, plastik), unri:krom, unri:lampu,
unri:kaca-merah (lampu belakang/rem). Bentuk "gaya" bebek/matic/sport/tua = [INFERENSI], bukan merek tertentu.
"""
import math
import os
import runpy
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

REPO = r"C:\Users\mocha\Documents\stadion-utama-riau-3d"
_H = runpy.run_path(os.path.join(REPO, "assets-src", "blender", "unri", "sekre_assets.py"))
_material, fresh = _H["material"], _H["fresh"]
EXPORT_PY = _H["EXPORT_PY"]
PI = math.pi
LO = {"on": False}  # LOD rendah: tanpa Subdivision Surface, penampang & tabung disederhanakan


def material(name, rgb, rough=0.6, metal=0.0):
    m = _material(name, rgb, rough, metal)
    m.diffuse_color = (*rgb, 1.0)  # Workbench membaca warna viewport
    return m


def mats():
    return {
        "bodi": material("unri:bodi", (0.92, 0.92, 0.92), rough=0.38, metal=0.05),
        "hitam": material("unri:hitam", (0.035, 0.035, 0.04), rough=0.72),
        "krom": material("unri:krom", (0.72, 0.74, 0.76), rough=0.28, metal=0.85),
        "lampu": material("unri:lampu", (0.96, 0.95, 0.88), rough=0.12),
        "merah": material("unri:kaca-merah", (0.72, 0.05, 0.05), rough=0.2),
    }


# ---------------- pembantu geometri ----------------

def _obj(name, bm, mat, smooth=True, sub=0):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = smooth
    ob = bpy.data.objects.new(name, me)
    ob.data.materials.append(mat)
    bpy.context.collection.objects.link(ob)
    if sub:
        mod = ob.modifiers.new("Sub", "SUBSURF")
        mod.levels = sub
        mod.render_levels = sub
    return ob


def _sgn(v):
    return 1.0 if v >= 0 else -1.0


def ring_pts(w, h, cx, cz, n=8, p=3.0):
    """Superelips berlengan lebar w, tinggi h di bidang XZ; p=2 elips, p>2 makin persegi."""
    out = []
    for k in range(n):
        a = 2 * PI * k / n + PI / n * 0.0
        c, s = math.cos(a), math.sin(a)
        out.append((cx + w / 2 * _sgn(c) * abs(c) ** (2 / p), cz + h / 2 * _sgn(s) * abs(s) ** (2 / p)))
    return out


def loft(name, secs, mat, sub=1, n=8, p=3.0, smooth=True, cap=True):
    """Bentuk dari penampang berurutan sepanjang Y: secs = [(y, w, h, cz[, cx])…]."""
    if LO["on"]:
        sub, n = 0, min(n, 6)
    bm = bmesh.new()
    rings = []
    for sec in secs:
        y, w, h, cz = sec[:4]
        cx = sec[4] if len(sec) > 4 else 0.0
        rings.append([bm.verts.new((x, y, z)) for x, z in ring_pts(w, h, cx, cz, n, p)])
    for a, b in zip(rings, rings[1:]):
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((a[i], a[j], b[j], b[i]))
    if cap:
        bm.faces.new(rings[0][::-1])
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _obj(name, bm, mat, smooth=smooth, sub=sub)


def _catmull(pts, per=3):
    P = [Vector(p) for p in pts]
    if len(P) < 3 or per <= 1:
        return P
    ext = [P[0] * 2 - P[1]] + P + [P[-1] * 2 - P[-2]]
    out = []
    for i in range(1, len(ext) - 2):
        p0, p1, p2, p3 = ext[i - 1], ext[i], ext[i + 1], ext[i + 2]
        for s in range(per):
            t = s / per
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(P[-1])
    return out


def tube(name, pts, r, mat, sides=6, per=1, cap=True, r2=None, smooth=True):
    """Tabung menyusuri polyline (opsional dihaluskan Catmull-Rom, per = titik per segmen); r2 = jari-jari ujung."""
    if LO["on"]:
        sides, per = min(sides, 4), 1
    P = _catmull(pts, per)
    bm = bmesh.new()
    rings = []
    for i, p in enumerate(P):
        t = (P[min(i + 1, len(P) - 1)] - P[max(i - 1, 0)]).normalized()
        up = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((0, 1, 0))
        a = t.cross(up).normalized()
        b = a.cross(t).normalized()
        rr = r if r2 is None else r + (r2 - r) * i / max(1, len(P) - 1)
        rings.append([bm.verts.new(p + a * math.cos(2 * PI * k / sides) * rr + b * math.sin(2 * PI * k / sides) * rr) for k in range(sides)])
    for a, b in zip(rings, rings[1:]):
        for i in range(sides):
            j = (i + 1) % sides
            bm.faces.new((a[i], a[j], b[j], b[i]))
    if cap:
        bm.faces.new(rings[0][::-1])
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _obj(name, bm, mat, smooth=smooth)


def blk(name, mat, size, loc, rot=(0, 0, 0), sub=0, smooth=False, bevel=0.0):
    """Kotak ber-skala size di loc, diputar rot (Euler XYZ)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel / max(size) if max(size) else bevel, segments=1, affect="EDGES")
    m = Matrix.Translation(loc) @ Matrix.Rotation(rot[2], 4, "Z") @ Matrix.Rotation(rot[1], 4, "Y") @ Matrix.Rotation(rot[0], 4, "X")
    s = Matrix.Diagonal((size[0], size[1], size[2], 1.0))
    bm.transform(m @ s)
    return _obj(name, bm, mat, smooth=smooth, sub=sub)


def cylx(name, mat, r, length, loc, sides=12, axis="X", r2=None, smooth=True):
    """Silinder bersumbu X (axis='X') atau Y; r2 = jari-jari ujung (kerucut terpancung)."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=sides, radius1=r, radius2=r if r2 is None else r2, depth=length)
    rot = Matrix.Rotation(PI / 2, 4, "Y") if axis == "X" else Matrix.Rotation(PI / 2, 4, "X")
    bm.transform(Matrix.Translation(loc) @ rot)
    return _obj(name, bm, mat, smooth=smooth)


def lathe(name, mat, profile, center, segs=20, smooth=True):
    """Benda putar mengelilingi sumbu X di center (x, y, z); profile = [(radius, aksial)…] tidak tertutup di ujung."""
    cx, cy, cz = center
    bm = bmesh.new()
    rings = []
    for k in range(segs):
        a = 2 * PI * k / segs
        ca, sa = math.cos(a), math.sin(a)
        rings.append([bm.verts.new((cx + ax, cy + r * ca, cz + r * sa)) for r, ax in profile])
    m = len(profile)
    for k in range(segs):
        k2 = (k + 1) % segs
        for i in range(m - 1):
            bm.faces.new((rings[k][i], rings[k2][i], rings[k2][i + 1], rings[k][i + 1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _obj(name, bm, mat, smooth=smooth)


# ---------------- komponen bersama ----------------

class Ctx:
    def __init__(self, detail, style, spec):
        self.detail = detail
        self.hi = detail == "hi"
        self.style = style
        self.s = spec
        self.m = mats()


def wheel(c, tag, y, r, tw, kind="cast", disc=False, drum=False):
    m = c.m
    segs = 22 if c.hi else 12
    t = tw / 2
    prof = [(r - 0.07, -t * 0.88), (r - 0.032, -t), (r - 0.006, -t * 0.62), (r, -t * 0.22), (r, t * 0.22), (r - 0.006, t * 0.62), (r - 0.032, t), (r - 0.07, t * 0.88)]
    if not c.hi:
        prof = [(r - 0.05, -t), (r, 0), (r - 0.05, t)]
    lathe(f"ban-{tag}", m["hitam"], prof, (0, y, r), segs=segs)
    rr = r - 0.07
    if c.hi:
        lathe(f"velg-{tag}", m["krom"], [(rr + 0.012, -t * 0.7), (rr - 0.004, -t * 0.5), (rr - 0.012, t * 0.2), (rr + 0.004, t * 0.7)], (0, y, r), segs=segs)
        n = 5 if kind == "cast" else 8
        for i in range(n):
            a = 2 * PI * i / n + 0.3
            w = 0.034 if kind == "cast" else 0.009
            blk(f"ruji-{tag}-{i}", m["krom"], (0.02, w, rr * 0.92), (0, y + math.cos(a) * rr * 0.5, r + math.sin(a) * rr * 0.5), rot=(a - PI / 2, 0, 0), smooth=False)
        cylx(f"hub-{tag}", m["krom"], 0.034, 0.1, (0, y, r), sides=10)
    else:
        cylx(f"hub-{tag}", m["krom"], rr * 0.82, t * 1.2, (0, y, r), sides=10)
    if disc and c.hi:
        cylx(f"cakram-{tag}", m["krom"], rr * 0.7, 0.006, (0.032 + t * 0.2, y, r), sides=18)
        blk(f"kaliper-{tag}", m["hitam"], (0.03, 0.07, 0.08), (0.04 + t * 0.2, y - 0.1, r + rr * 0.55), smooth=False)
    if drum and c.hi:
        cylx(f"tromol-{tag}", m["krom"], 0.085, 0.09, (0, y, r), sides=14)


def fork_geom(c, yf, r, top, rake_deg):
    """Garpu teleskopik dari as roda ke dudukan atas; kembalikan (titik atas as roda→atas)."""
    m = c.m
    sx = 0.075
    for sd in (-1, 1):
        low = Vector((sd * sx, yf, r))
        up = Vector((sd * sx * 1.02, top.y, top.z))
        mid = low.lerp(up, 0.42)
        tube(f"garpu-bawah-{sd}", [low, mid], 0.016, m["krom"], sides=6)
        tube(f"garpu-atas-{sd}", [mid, up], 0.021, m["hitam"] if c.style != "sport" else m["krom"], sides=6)
    blk("kepala-garpu", m["hitam"], (0.2, 0.07, 0.04), (0, top.y, top.z - 0.02), smooth=False)


def handlebar(c, top, width, drop=0.0, sweep=0.06, grip_h=0.0):
    m = c.m
    hb = [Vector((-width / 2, top.y - sweep - 0.04, top.z + 0.1 + grip_h)), Vector((-width * 0.28, top.y - 0.01, top.z + 0.09 + grip_h)), Vector((0, top.y + 0.0, top.z + 0.09)),
          Vector((width * 0.28, top.y - 0.01, top.z + 0.09 + grip_h)), Vector((width / 2, top.y - sweep - 0.04, top.z + 0.1 + grip_h))]
    tube("stang", hb, 0.0125, m["krom"], sides=6, per=2 if c.hi else 1)
    for sd in (-1, 1):
        p = hb[0] if sd < 0 else hb[-1]
        cylx(f"grip-{sd}", m["hitam"], 0.019, 0.1, (p.x * 0.93 + sd * 0.0, p.y, p.z), sides=8 if c.hi else 6)
        if c.hi:
            tube(f"tuas-{sd}", [Vector((p.x * 0.8, p.y + 0.005, p.z + 0.012)), Vector((p.x * 0.72, p.y + 0.09, p.z + 0.0))], 0.006, m["hitam"], sides=4)
            tube(f"tangkai-spion-{sd}", [Vector((p.x * 0.72, p.y + 0.01, p.z + 0.02)), Vector((p.x * 0.78, p.y - 0.03, p.z + 0.11)), Vector((p.x * 0.88, p.y - 0.045, p.z + 0.155))], 0.0065, m["hitam"], sides=4)
            bm = bmesh.new()
            bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=5, radius=0.5)
            bm.transform(Matrix.Translation((p.x * 0.88 + sd * 0.02, p.y - 0.05, p.z + 0.17)) @ Matrix.Diagonal((0.115, 0.022, 0.075, 1.0)))
            _obj(f"spion-badan-{sd}", bm, m["hitam"])
    return hb


def rear_suspension(c, yr, r, pivot_y, pivot_z, top_y, top_z, x=0.13, spring=True):
    m = c.m
    for sd in (-1, 1):
        tube(f"lengan-ayun-{sd}", [Vector((sd * 0.09, pivot_y, pivot_z)), Vector((sd * 0.1, (pivot_y + yr) / 2, (pivot_z + r) / 2 - 0.01)), Vector((sd * 0.085, yr, r))], 0.019, m["hitam"], sides=6)
        low = Vector((sd * x, yr + 0.1, r + 0.05))
        top = Vector((sd * (x + 0.02), top_y, top_z))
        tube(f"shock-{sd}", [low, top], 0.011, m["krom"], sides=6)
        if spring:
            tube(f"pegas-{sd}", [low.lerp(top, 0.2), low.lerp(top, 0.82)], 0.026, m["hitam"], sides=6, cap=True)


def plate_and_tail(c, y, z, rot=0.0):
    m = c.m
    blk("pelat", m["lampu"], (0.2, 0.012, 0.13), (0, y - 0.02, z - 0.1), rot=(rot, 0, 0), smooth=False)
    blk("lampu-rem", m["merah"], (0.14, 0.04, 0.05), (0, y, z + 0.0), smooth=False, bevel=0.01)


def stand_and_pegs(c, ground_foot, frame_pt):
    m = c.m
    tube("standar", [frame_pt, ground_foot], 0.012, m["hitam"], sides=5)
    for sd in (-1, 1):
        blk(f"pijakan-{sd}", m["krom"], (0.09, 0.05, 0.016), (sd * 0.2, -0.04, 0.28), smooth=False)


def exhaust(c, pts, r, muffler_from, r_muf, color="krom"):
    m = c.m
    tube("knalpot-pipa", pts[:muffler_from + 1], r, m[color], sides=8 if c.hi else 5, per=2 if c.hi else 1)
    tube("knalpot-peredam", pts[muffler_from:], r_muf, m[color], sides=10 if c.hi else 6, per=1, r2=r_muf * 0.82)
    last = pts[-1]
    cylx("knalpot-ujung", m["hitam"], r_muf * 0.62, 0.02, (last.x, last.y - 0.01, last.z), sides=8, axis="Y")


# ---------------- gaya bebek (A01) ----------------

def build_bebek(c):
    m = c.m
    r, wb = 0.285, 1.22
    yf, yr = wb / 2, -wb / 2
    wheel(c, "depan", yf, r, 0.075, kind="cast", drum=True)
    wheel(c, "belakang", yr, r, 0.09, kind="cast", drum=True)
    top = Vector((0, 0.33, 0.9))
    fork_geom(c, yf, r, top, 26)
    handlebar(c, top, 0.64)
    # rumah lampu & speedometer
    loft("rumah-lampu", [(0.30, 0.18, 0.15, 0.97), (0.38, 0.23, 0.2, 0.975), (0.46, 0.2, 0.18, 0.965), (0.50, 0.12, 0.12, 0.96)], m["bodi"], sub=1)
    blk("lensa-lampu", m["lampu"], (0.13, 0.03, 0.1), (0, 0.5, 0.96), smooth=False, bevel=0.01)
    # tameng kaki & penutup tengah
    loft("tameng-kaki", [(0.20, 0.30, 0.55, 0.58), (0.27, 0.38, 0.6, 0.6), (0.34, 0.26, 0.5, 0.64)], m["bodi"], sub=1)
    loft("penutup-tengah", [(0.14, 0.17, 0.28, 0.4), (-0.06, 0.2, 0.2, 0.34), (-0.30, 0.24, 0.24, 0.48)], m["bodi"], sub=1)
    # rangka tulang punggung
    tube("rangka", [Vector((0, 0.3, 0.76)), Vector((0, 0.04, 0.42)), Vector((0, -0.3, 0.46))], 0.028, m["hitam"], sides=6, per=2 if c.hi else 1)
    # mesin
    loft("blok-mesin", [(-0.12, 0.2, 0.28, 0.3), (0.0, 0.22, 0.3, 0.3), (0.13, 0.18, 0.24, 0.28)], m["hitam"], sub=1)
    cylx("tutup-mesin", m["krom"], 0.085, 0.04, (0.115, -0.02, 0.28), sides=12 if c.hi else 8)
    loft("silinder", [(0.1, 0.1, 0.2, 0.43), (0.2, 0.1, 0.16, 0.5), (0.3, 0.1, 0.12, 0.5)], m["hitam"], sub=0, n=6)
    # jok & badan belakang
    loft("jok", [(-0.5, 0.2, 0.07, 0.775), (-0.4, 0.24, 0.09, 0.78), (-0.1, 0.27, 0.095, 0.775), (0.1, 0.2, 0.07, 0.76)], m["hitam"], sub=1)
    loft("penutup-samping", [(-0.62, 0.2, 0.2, 0.62), (-0.4, 0.27, 0.26, 0.58), (-0.05, 0.26, 0.2, 0.52)], m["bodi"], sub=1)
    loft("ekor", [(-0.78, 0.14, 0.1, 0.71), (-0.6, 0.2, 0.15, 0.68), (-0.4, 0.2, 0.15, 0.68)], m["bodi"], sub=1)
    plate_and_tail(c, -0.82, 0.69, 0.0)
    tube("pegangan-belakang", [Vector((-0.1, -0.45, 0.76)), Vector((-0.1, -0.8, 0.8)), Vector((0.1, -0.8, 0.8)), Vector((0.1, -0.45, 0.76))], 0.011, m["krom"], sides=5)
    # spakbor
    loft("spakbor-depan", [(yf - 0.24, 0.12, 0.03, 0.46), (yf - 0.08, 0.14, 0.03, 0.57), (yf + 0.1, 0.14, 0.03, 0.6), (yf + 0.24, 0.12, 0.03, 0.5)], m["hitam"], sub=1, n=6)
    loft("spakbor-belakang", [(yr - 0.18, 0.15, 0.03, 0.4), (yr - 0.02, 0.17, 0.03, 0.58), (yr + 0.26, 0.17, 0.03, 0.55)], m["hitam"], sub=1, n=6)
    rear_suspension(c, yr, r, -0.18, 0.28, -0.36, 0.55)
    ex = [Vector(p) for p in [(0.13, 0.13, 0.26), (0.15, -0.05, 0.14), (0.17, -0.5, 0.2), (0.18, -0.62, 0.26), (0.19, -0.96, 0.36)]]
    exhaust(c, ex, 0.022, 3, 0.045)
    loft("rantai-pelindung", [(-0.4, 0.04, 0.06, 0.2, -0.1), (-0.15, 0.04, 0.06, 0.24, -0.1), (0.05, 0.04, 0.1, 0.27, -0.1)], m["hitam"], sub=0, n=6) if c.hi else None
    stand_and_pegs(c, Vector((-0.27, -0.05, 0.0)), Vector((-0.1, -0.08, 0.26)))


# ---------------- gaya matic (A02) ----------------

def build_matic(c):
    m = c.m
    r, wb = 0.25, 1.26
    yf, yr = wb / 2, -wb / 2
    wheel(c, "depan", yf, r, 0.09, kind="cast", disc=True)
    wheel(c, "belakang", yr, r, 0.1, kind="cast", drum=True)
    top = Vector((0, 0.38, 0.8))
    fork_geom(c, yf, r, top, 27)
    handlebar(c, top, 0.6, grip_h=0.0)
    # penutup stang + lampu depan terpadu
    loft("penutup-stang", [(0.26, 0.3, 0.17, 1.0), (0.34, 0.4, 0.2, 1.0), (0.43, 0.34, 0.22, 0.99), (0.5, 0.2, 0.16, 0.97)], m["bodi"], sub=1)
    blk("lensa-lampu", m["lampu"], (0.2, 0.03, 0.11), (0, 0.52, 0.965), smooth=False, bevel=0.012)
    blk("lampu-sein-kiri", m["lampu"], (0.07, 0.025, 0.04), (-0.17, 0.5, 1.04), smooth=False)
    blk("lampu-sein-kanan", m["lampu"], (0.07, 0.025, 0.04), (0.17, 0.5, 1.04), smooth=False)
    # apron depan (tameng kaki besar) + penutup leher
    loft("apron", [(0.14, 0.34, 0.62, 0.58), (0.24, 0.44, 0.68, 0.62), (0.37, 0.38, 0.62, 0.68), (0.45, 0.2, 0.4, 0.7)], m["bodi"], sub=1)
    # dek kaki
    loft("dek-kaki", [(-0.36, 0.34, 0.05, 0.255), (-0.1, 0.42, 0.06, 0.25), (0.14, 0.38, 0.05, 0.28)], m["hitam"], sub=1, p=4)
    # badan belakang besar
    loft("badan-belakang", [(-0.82, 0.2, 0.2, 0.69), (-0.6, 0.32, 0.34, 0.66), (-0.3, 0.36, 0.42, 0.6), (-0.04, 0.3, 0.34, 0.5), (0.04, 0.2, 0.18, 0.4)], m["bodi"], sub=1)
    loft("jok", [(-0.66, 0.24, 0.07, 0.855), (-0.45, 0.3, 0.09, 0.85), (-0.2, 0.31, 0.09, 0.835), (0.04, 0.2, 0.07, 0.8)], m["hitam"], sub=1)
    # CVT / mesin kiri
    loft("cvt", [(-0.3, 0.1, 0.2, 0.26, -0.15), (-0.05, 0.12, 0.26, 0.27, -0.15), (0.12, 0.1, 0.2, 0.27, -0.15)], m["hitam"], sub=1)
    plate_and_tail(c, -0.86, 0.72, 0.0)
    # spakbor
    loft("spakbor-depan", [(yf - 0.22, 0.12, 0.03, 0.4), (yf - 0.06, 0.14, 0.03, 0.5), (yf + 0.1, 0.14, 0.03, 0.52), (yf + 0.22, 0.12, 0.03, 0.43)], m["bodi"], sub=1, n=6)
    loft("pelindung-lumpur", [(yr - 0.12, 0.2, 0.025, 0.34), (yr + 0.02, 0.22, 0.025, 0.4)], m["hitam"], sub=0, n=6)
    # shock belakang (kiri-kanan)
    for sd in (-1, 1):
        low = Vector((sd * 0.16, yr + 0.05, 0.3))
        tp = Vector((sd * 0.18, yr - 0.12, 0.6))
        tube(f"shock-{sd}", [low, tp], 0.012, m["krom"], sides=6)
        tube(f"pegas-{sd}", [low.lerp(tp, 0.25), low.lerp(tp, 0.8)], 0.026, m["hitam"], sides=6)
    ex = [Vector(p) for p in [(0.13, 0.0, 0.2), (0.16, -0.3, 0.19), (0.17, -0.55, 0.27), (0.18, -0.95, 0.4)]]
    exhaust(c, ex, 0.026, 1, 0.055)
    blk("pelindung-panas", m["krom"], (0.025, 0.4, 0.07), (0.21, -0.6, 0.31), rot=(-0.12, 0, 0), smooth=False) if c.hi else None
    stand_and_pegs(c, Vector((-0.27, -0.12, 0.0)), Vector((-0.12, -0.15, 0.26)))


# ---------------- gaya sport (A03) ----------------

def build_sport(c):
    m = c.m
    r, wb = 0.29, 1.32
    yf, yr = wb / 2, -wb / 2
    wheel(c, "depan", yf, r, 0.1, kind="cast", disc=True)
    wheel(c, "belakang", yr, r, 0.13, kind="cast", disc=True)
    top = Vector((0, 0.36, 0.86))
    fork_geom(c, yf, r, top, 25)
    handlebar(c, top, 0.6, grip_h=-0.05, sweep=0.1)
    # fairing depan + kaca, tangki mengalir ke jok dan ekor runcing
    loft("fairing", [(0.66, 0.1, 0.14, 0.78), (0.5, 0.24, 0.3, 0.82), (0.3, 0.34, 0.4, 0.86), (0.1, 0.34, 0.36, 0.9)], m["bodi"], sub=1)
    blk("lensa-kiri", m["lampu"], (0.09, 0.03, 0.06), (-0.07, 0.62, 0.79), rot=(0, 0, 0.25), smooth=False)
    blk("lensa-kanan", m["lampu"], (0.09, 0.03, 0.06), (0.07, 0.62, 0.79), rot=(0, 0, -0.25), smooth=False)
    blk("kaca-depan", m["hitam"], (0.2, 0.014, 0.12), (0, 0.2, 1.06), rot=(-1.15, 0, 0), smooth=False)
    loft("tangki", [(0.3, 0.2, 0.15, 0.88), (0.12, 0.33, 0.24, 0.9), (-0.08, 0.32, 0.24, 0.9), (-0.22, 0.22, 0.16, 0.86)], m["bodi"], sub=1)
    loft("ekor", [(-0.88, 0.1, 0.1, 0.97), (-0.65, 0.18, 0.16, 0.94), (-0.42, 0.25, 0.2, 0.9), (-0.2, 0.24, 0.16, 0.86)], m["bodi"], sub=1)
    loft("jok-depan", [(-0.34, 0.25, 0.07, 0.81), (-0.1, 0.27, 0.08, 0.815), (0.06, 0.2, 0.06, 0.8)], m["hitam"], sub=1)
    loft("jok-belakang", [(-0.7, 0.16, 0.05, 0.9), (-0.42, 0.2, 0.06, 0.885)], m["hitam"], sub=1, n=6)
    plate_and_tail(c, -0.84, 0.94, 0.0)
    # rangka dua sisi + mesin + radiator
    for sd in (-1, 1):
        tube(f"rangka-{sd}", [Vector((sd * 0.12, 0.3, 0.8)), Vector((sd * 0.16, 0.0, 0.62)), Vector((sd * 0.14, -0.3, 0.45))], 0.02, m["krom"], sides=6, per=2 if c.hi else 1)
    loft("blok-mesin", [(-0.18, 0.22, 0.26, 0.38), (0.0, 0.26, 0.3, 0.4), (0.2, 0.22, 0.26, 0.42)], m["hitam"], sub=1)
    cylx("tutup-mesin", m["krom"], 0.075, 0.04, (0.14, -0.0, 0.34), sides=12 if c.hi else 8)
    loft("fairing-bawah", [(0.42, 0.12, 0.12, 0.34), (0.2, 0.34, 0.3, 0.46), (-0.05, 0.32, 0.26, 0.5), (-0.22, 0.22, 0.16, 0.54)], m["bodi"], sub=1)
    loft("spakbor-depan", [(yf - 0.2, 0.13, 0.03, 0.46), (yf - 0.04, 0.15, 0.03, 0.62), (yf + 0.1, 0.15, 0.03, 0.62), (yf + 0.2, 0.13, 0.03, 0.55)], m["hitam"], sub=1, n=6)
    loft("spakbor-belakang", [(yr - 0.18, 0.2, 0.03, 0.3), (yr + 0.02, 0.22, 0.03, 0.52)], m["hitam"], sub=0, n=6)
    # monoshock + lengan ayun
    for sd in (-1, 1):
        tube(f"lengan-ayun-{sd}", [Vector((sd * 0.09, -0.3, 0.38)), Vector((sd * 0.11, -0.5, 0.33)), Vector((sd * 0.095, yr, r))], 0.022, m["krom"], sides=6)
    tube("monoshock", [Vector((0, -0.28, 0.42)), Vector((0, -0.45, 0.72))], 0.016, m["hitam"], sides=6)
    tube("pegas", [Vector((0, -0.3, 0.45)), Vector((0, -0.42, 0.67))], 0.032, m["krom"], sides=6)
    ex = [Vector(p) for p in [(0.13, 0.22, 0.24), (0.17, -0.1, 0.15), (0.2, -0.5, 0.27), (0.2, -0.65, 0.4), (0.18, -0.98, 0.6)]]
    exhaust(c, ex, 0.025, 2, 0.05)
    stand_and_pegs(c, Vector((-0.28, -0.1, 0.0)), Vector((-0.13, -0.12, 0.34)))


# ---------------- gaya tua / klasik (A04) ----------------

def build_tua(c):
    m = c.m
    r, wb = 0.29, 1.22
    yf, yr = wb / 2, -wb / 2
    wheel(c, "depan", yf, r, 0.07, kind="wire", drum=True)
    wheel(c, "belakang", yr, r, 0.075, kind="wire", drum=True)
    top = Vector((0, 0.34, 0.86))
    fork_geom(c, yf, r, top, 27)
    handlebar(c, top, 0.66, sweep=0.08)
    # lampu bulat krom
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=14 if c.hi else 8, v_segments=8 if c.hi else 5, radius=0.5)
    bm.transform(Matrix.Translation((0, 0.44, 0.97)) @ Matrix.Diagonal((0.17, 0.17, 0.17, 1.0)))
    _obj("rumah-lampu", bm, m["krom"])
    blk("lensa-lampu", m["lampu"], (0.12, 0.03, 0.12), (0, 0.525, 0.97), smooth=False, bevel=0.012)
    # tangki + rangka + penutup samping
    loft("tangki", [(-0.12, 0.2, 0.16, 0.8), (0.0, 0.3, 0.2, 0.83), (0.2, 0.3, 0.2, 0.83), (0.32, 0.18, 0.14, 0.8)], m["bodi"], sub=1)
    tube("rangka", [Vector((0, 0.3, 0.72)), Vector((0, 0.0, 0.5)), Vector((0, -0.3, 0.5))], 0.03, m["hitam"], sides=6)
    loft("penutup-samping", [(-0.45, 0.28, 0.16, 0.56), (-0.3, 0.3, 0.2, 0.56), (-0.15, 0.28, 0.16, 0.52)], m["bodi"], sub=1)
    loft("jok", [(-0.62, 0.22, 0.07, 0.76), (-0.4, 0.26, 0.09, 0.77), (-0.05, 0.28, 0.09, 0.775), (0.1, 0.2, 0.07, 0.76)], m["hitam"], sub=1)
    # mesin tua (kotak berlekuk + sirip)
    loft("blok-mesin", [(-0.15, 0.21, 0.3, 0.3), (0.0, 0.23, 0.32, 0.3), (0.12, 0.2, 0.26, 0.28)], m["hitam"], sub=1)
    cylx("tutup-mesin", m["krom"], 0.08, 0.04, (0.12, -0.03, 0.29), sides=12 if c.hi else 8)
    for i in range(3 if c.hi else 1):
        blk(f"sirip-{i}", m["hitam"], (0.12, 0.12, 0.02), (0, 0.16 + i * 0.002, 0.43 + i * 0.03), rot=(-0.6, 0, 0), smooth=False)
    # spakbor krom
    loft("spakbor-depan", [(yf - 0.26, 0.11, 0.03, 0.44), (yf - 0.08, 0.13, 0.03, 0.57), (yf + 0.12, 0.13, 0.03, 0.6), (yf + 0.26, 0.11, 0.03, 0.5)], m["krom"], sub=1, n=6)
    loft("spakbor-belakang", [(yr - 0.24, 0.14, 0.03, 0.36), (yr - 0.04, 0.16, 0.03, 0.56), (yr + 0.3, 0.16, 0.03, 0.56)], m["krom"], sub=1, n=6)
    plate_and_tail(c, yr - 0.27, 0.46, 0.0)
    rear_suspension(c, yr, r, -0.2, 0.28, -0.4, 0.62, x=0.14)
    ex = [Vector(p) for p in [(0.12, 0.1, 0.24), (0.15, -0.1, 0.17), (0.19, -0.5, 0.2), (0.2, -0.7, 0.24), (0.2, -1.05, 0.31)]]
    exhaust(c, ex, 0.024, 3, 0.05)
    loft("pelindung-rantai", [(-0.55, 0.04, 0.07, 0.24, -0.11), (-0.2, 0.04, 0.07, 0.28, -0.11), (0.05, 0.04, 0.1, 0.28, -0.11)], m["krom"], sub=0, n=6) if c.hi else None
    stand_and_pegs(c, Vector((-0.27, -0.1, 0.0)), Vector((-0.1, -0.12, 0.28)))


# ---------------- LOD jauh (±150 segitiga, hanya unri:bodi + unri:hitam) ----------------

FAR = {
    "bebek": dict(r=0.285, wb=1.22, tw=0.08, w=0.26, zb=0.62, hb=0.3, seat=0.78, bar=0.95, top=0.9),
    "matic": dict(r=0.25, wb=1.26, tw=0.095, w=0.34, zb=0.6, hb=0.42, seat=0.84, bar=1.0, top=0.8),
    "sport": dict(r=0.29, wb=1.32, tw=0.11, w=0.3, zb=0.82, hb=0.3, seat=0.82, bar=0.95, top=0.86),
    "tua": dict(r=0.29, wb=1.22, tw=0.075, w=0.26, zb=0.68, hb=0.26, seat=0.77, bar=0.97, top=0.86),
}


def build_far(c):
    """Siluet minimal untuk parkir jauh: dua roda 8 sisi, cangkang bodi, jok, garpu+stang sebagai kotak."""
    m = c.m
    f = FAR[c.style]
    r, wb = f["r"], f["wb"]
    yf, yr = wb / 2, -wb / 2
    for tag, y in (("depan", yf), ("belakang", yr)):
        cylx(f"ban-{tag}", m["hitam"], r, f["tw"], (0, y, r), sides=8)
    loft("cangkang", [(yr - 0.1, f["w"] * 0.7, f["hb"] * 0.8, f["zb"] + 0.06), (-0.1, f["w"], f["hb"], f["zb"]), (0.28, f["w"] * 0.7, f["hb"] * 1.2, f["zb"] - 0.04)], m["bodi"], sub=0, n=4, p=4)
    blk("jok", m["hitam"], (0.24, 0.62, 0.07), (0, -0.3, f["seat"]), smooth=False)
    top = (0, yf - 0.28, f["top"])
    blk("garpu", m["hitam"], (0.15, 0.06, f["top"] - r + 0.04), (0, (yf + top[1]) / 2, (r + f["top"]) / 2), rot=(0.45, 0, 0), smooth=False)
    blk("stang", m["hitam"], (0.62, 0.05, 0.05), (0, top[1] - 0.02, f["bar"]), smooth=False)


STYLES = {
    "a01-motor-bebek": ("bebek", build_bebek, 6.0),
    "a02-motor-matic": ("matic", build_matic, 6.0),
    "a03-motor-sport": ("sport", build_sport, 5.0),
    "a04-motor-tua": ("tua", build_tua, 6.0),
}
SHORT = {"a01": "a01-motor-bebek", "a02": "a02-motor-matic", "a03": "a03-motor-sport", "a04": "a04-motor-tua"}


def _merge_lean(deg):
    """Terapkan modifier SUBSURF (agar lean mempengaruhi mesh final) lalu miringkan semua mesh di sumbu Y."""
    rot = Matrix.Rotation(-math.radians(deg), 4, "Y")
    for ob in list(bpy.context.collection.objects):
        ob.matrix_world = rot @ ob.matrix_world


def _preview(path, label):
    """Render lembar kontak 2×2 (samping kiri, 3/4 depan, 3/4 belakang, depan) memakai Workbench."""
    import numpy as np
    sc = bpy.context.scene
    try:
        sc.render.engine = "BLENDER_WORKBENCH"
    except TypeError:
        pass
    sc.render.resolution_x, sc.render.resolution_y = 640, 440
    sc.render.film_transparent = False
    sc.display.shading.light = "STUDIO"
    sc.display.shading.color_type = "MATERIAL"
    sc.display.shading.show_cavity = False
    world = bpy.data.worlds.new("w")
    world.color = (0.72, 0.78, 0.86)
    sc.world = world
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    cam.data.lens = 55
    bpy.context.scene.collection.objects.link(cam)
    sc.camera = cam
    views = [((-3.4, 0.0, 0.8), (0, 0, 0.5)), ((-2.3, 2.7, 1.3), (0, 0, 0.5)), ((2.4, -2.9, 1.5), (0, 0, 0.5)), ((0.3, 3.6, 0.9), (0, 0, 0.5))]
    tiles = []
    for i, (eye, look) in enumerate(views):
        cam.location = eye
        cam.rotation_euler = (Vector(look) - Vector(eye)).to_track_quat("-Z", "Y").to_euler()
        tmp = os.path.join(os.path.dirname(path), f"_tmp{i}.png")
        sc.render.filepath = tmp
        bpy.ops.render.render(write_still=True)
        img = bpy.data.images.load(tmp)
        a = np.array(img.pixels[:], dtype=np.float32).reshape(img.size[1], img.size[0], 4)
        tiles.append(a)
        bpy.data.images.remove(img)
        os.remove(tmp)
    top = np.concatenate(tiles[:2], axis=1)
    bot = np.concatenate(tiles[2:], axis=1)
    sheet = np.concatenate([bot, top], axis=0)  # array piksel Blender dari bawah ke atas
    out = bpy.data.images.new(label, width=sheet.shape[1], height=sheet.shape[0])
    out.pixels = sheet.ravel().tolist()
    out.filepath_raw = path
    out.file_format = "PNG"
    out.save()


def build(stem, detail="hi", export=True, preview=None):
    style, fn, lean = STYLES[stem]
    coll = fresh(f"UNRI_{stem}_{detail}")
    coll.name = f"UNRI_{stem.upper().replace('-', '_')}_{detail}"
    LO["on"] = detail != "hi"
    (build_far if detail == "far" else fn)(Ctx(detail, style, None))
    _merge_lean(lean)
    result = {"aset": stem, "detail": detail}
    if export:
        glb_name = {"hi": f"{stem}.glb", "lo": f"{stem}-lod.glb", "far": f"{stem}-far.glb"}[detail]
        exporter = runpy.run_path(EXPORT_PY)
        glb = os.path.join(REPO, "public", "models", "unri", glb_name)
        meshes, tris, kb = exporter["export_collection"](coll.name, glb, ratios={})
        result.update(mesh=meshes, segitiga=tris, kb=kb, glb=glb)
        if detail == "hi":
            blend = os.path.join(REPO, "assets-src", "blender", "unri", f"{stem}.blend")
            if preview:
                _preview(preview, stem)
            bpy.ops.wm.save_as_mainfile(filepath=blend)
            result["blend"] = blend
    elif preview:
        _preview(preview, stem)
    return result


if __name__ == "__main__" or os.environ.get("M7_MOTOR_RUN"):
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out_dir = os.environ.get("M7_PREVIEW_DIR")
    export = not os.environ.get("M7_NO_EXPORT")
    only_detail = os.environ.get("M7_DETAIL")
    for key in [SHORT[a] for a in argv] if argv else list(STYLES):
        for detail in ([only_detail] if only_detail else ["hi", "lo", "far"]):
            pv = os.path.join(out_dir, f"{key}-{detail}.png") if out_dir else None
            print("M7:", build(key, detail, export=export, preview=pv if detail == "hi" or only_detail else None))
