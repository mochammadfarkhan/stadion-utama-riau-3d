"""
F01–F03 mini game kebun dekat sekre (Blender MCP atau headless):

    import runpy
    ns = runpy.run_path(r"C:\\Users\\mocha\\Documents\\stadion-utama-riau-3d\\assets-src\\blender\\unri\\f01_kebun.py")
    print(ns["build"]())

Gaya: mainan/kartun (bentuk tebal, warna cerah, tanpa tekstur) agar selaras gaya kartun default. Semua bentuk
[INFERENSI] (bukan dari foto lokasi). DEPAN = -Y Blender (= +Z three.js, konvensi kendaraan pemain); origin di tanah.
- f01-traktor.glb: traktor kecil ±3,0 m; roda belakang/depan bermaterial sendiri (diputar di three.js pada poros
  AXLE_*), kursi pengemudi di SEAT.
- f02-rumah-kebun.glb: rumah kayu panggung rendah 6 x 5 m, atap seng pelana, teras + tangga depan.
- f03-tanaman-{1,2,3}.glb: tanaman cabai tahap tunas, tumbuh, berbuah (satu petak 1 m); tunas dipakai semua jenis.
- f04-jagung-{2,3}.glb: jagung tumbuh / berbuah (tongkol + malai); f05-terong-{2,3}.glb: terong tumbuh / berbuah.
"""
import math
import os
import runpy

import bmesh
import bpy
from mathutils import Matrix

REPO = r"C:\Users\mocha\Documents\stadion-utama-riau-3d"
OUT_DIR = os.path.join(REPO, "public", "models", "unri")
OUT_BLEND = os.path.join(REPO, "assets-src", "blender", "unri", "f01_kebun.blend")

# poros & kursi traktor (Blender: x kanan, y belakang, z atas) — disalin ke src/world/props/unri/kebun.js
AXLE_REAR = (0.0, 0.75, 0.62)
AXLE_FRONT = (0.0, -0.95, 0.36)
SEAT = (0.0, 0.42, 1.18)

PALETTE = {
    "kebun:bodi-merah": ("#D2402E", 0.45, 0.1),
    "kebun:bodi-gelap": ("#2E3136", 0.6, 0.3),
    "kebun:kursi": ("#3B3A36", 0.8, 0.0),
    "kebun:lampu": ("#FFE9A0", 0.3, 0.0),
    "kebun:ban-belakang": ("#26272A", 0.9, 0.0),
    "kebun:velg-belakang": ("#F2C230", 0.5, 0.2),
    "kebun:ban-depan": ("#26272A", 0.9, 0.0),
    "kebun:velg-depan": ("#F2C230", 0.5, 0.2),
    "kebun:kayu-dinding": ("#C98B52", 0.85, 0.0),
    "kebun:kayu-gelap": ("#7A4E2D", 0.85, 0.0),
    "kebun:kusen-putih": ("#EFE8D8", 0.7, 0.0),
    "kebun:atap-seng": ("#B5482F", 0.55, 0.3),
    "kebun:kaca": ("#3E5C6B", 0.2, 0.0),
    "kebun:daun": ("#4E9A3A", 0.8, 0.0),
    "kebun:daun-muda": ("#8CC63F", 0.8, 0.0),
    "kebun:batang": ("#5E7D2E", 0.8, 0.0),
    "kebun:cabai": ("#D7261E", 0.4, 0.0),
    "kebun:daun-jagung": ("#6FAE3A", 0.8, 0.0),
    "kebun:tongkol": ("#E9C33A", 0.6, 0.0),
    "kebun:kelobot": ("#B7C76A", 0.8, 0.0),
    "kebun:malai": ("#C9A55A", 0.9, 0.0),
    "kebun:terong": ("#5B2A6E", 0.3, 0.0),
    "kebun:kelopak": ("#3F7A2A", 0.8, 0.0),
}


def _lin(h):
    h = h.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(out)


def _material(name):
    hexv, rough, metal = PALETTE[name]
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*_lin(hexv), 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    return m


def _box(bms, mat, c, s, rx=0.0, rz=0.0):
    m = (Matrix.Translation(c) @ Matrix.Rotation(rz, 4, "Z") @ Matrix.Rotation(rx, 4, "X")
         @ Matrix.Diagonal((s[0], s[1], s[2], 1.0)))
    bmesh.ops.create_cube(bms.setdefault(mat, bmesh.new()), size=1.0, matrix=m)


def _cyl(bms, mat, c, r1, r2, h, seg=16, axis="Z", rx=0.0):
    bm = bms.setdefault(mat, bmesh.new())
    rot = {"Z": Matrix.Identity(4), "X": Matrix.Rotation(math.pi / 2, 4, "Y"), "Y": Matrix.Rotation(math.pi / 2, 4, "X")}[axis]
    m = Matrix.Translation(c) @ Matrix.Rotation(rx, 4, "X") @ rot
    try:
        bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r1, radius2=r2, depth=h, matrix=m)
    except TypeError:
        bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, diameter1=2 * r1, diameter2=2 * r2, depth=h, matrix=m)


def _ball(bms, mat, c, r, sx=1.0, sy=1.0, sz=1.0):
    m = Matrix.Translation(c) @ Matrix.Diagonal((sx, sy, sz, 1.0))
    bmesh.ops.create_icosphere(bms.setdefault(mat, bmesh.new()), subdivisions=1, radius=r, matrix=m)


def _prism(bms, mat, x0, x1, y0, y1, z0, ridge_z, over=0.0):
    """Atap pelana: bubungan sejajar X (sisi miring menghadap depan/belakang)."""
    bm = bms.setdefault(mat, bmesh.new())
    ym = (y0 + y1) / 2
    for pts in (((x0, y0 - over, z0), (x1, y0 - over, z0), (x1, ym, ridge_z), (x0, ym, ridge_z)),
                ((x0, ym, ridge_z), (x1, ym, ridge_z), (x1, y1 + over, z0), (x0, y1 + over, z0))):
        bm.faces.new([bm.verts.new(p) for p in pts])
        bm.faces.new([bm.verts.new(p) for p in reversed(pts)])  # sisi bawah (plafon tritisan)


def _gable(bms, mat, x, y0, y1, z0, ridge_z):
    bm = bms.setdefault(mat, bmesh.new())
    pts = ((x, y0, z0), (x, y1, z0), (x, (y0 + y1) / 2, ridge_z))
    bm.faces.new([bm.verts.new(p) for p in pts])
    bm.faces.new([bm.verts.new(p) for p in reversed(pts)])


def _wheel(bms, side, axle, r, w, lugs):
    tire, rim = f"kebun:ban-{side}", f"kebun:velg-{side}"
    for sx in (-1, 1):
        x = sx * (0.72 if side == "belakang" else 0.55)
        c = (x, axle[1], axle[2])
        _cyl(bms, tire, c, r, r, w, seg=20, axis="X")
        _cyl(bms, rim, (x + sx * 0.01, axle[1], axle[2]), r * 0.55, r * 0.55, w + 0.02, seg=12, axis="X")
        for i in range(lugs):  # kembang ban chevron sederhana
            a = 2 * math.pi * i / lugs
            p = (x, axle[1] + r * math.sin(a), axle[2] + r * math.cos(a))
            _box(bms, tire, p, (w * 0.9, 0.09, 0.07), rx=-a)


def _traktor():
    b = {}
    _wheel(b, "belakang", AXLE_REAR, 0.62, 0.38, 14)
    _wheel(b, "depan", AXLE_FRONT, 0.36, 0.22, 10)
    _box(b, "kebun:bodi-gelap", (0, -0.2, 0.62), (0.55, 2.0, 0.28))                 # sasis
    _box(b, "kebun:bodi-gelap", (0, AXLE_FRONT[1], AXLE_FRONT[2]), (1.0, 0.14, 0.12))  # gandar depan
    _box(b, "kebun:bodi-gelap", (0, AXLE_REAR[1], AXLE_REAR[2]), (1.2, 0.18, 0.18))    # gandar belakang
    _box(b, "kebun:bodi-merah", (0, -0.78, 1.0), (0.78, 1.25, 0.62))                # kap mesin
    _cyl(b, "kebun:bodi-merah", (0, -0.78, 1.31), 0.39, 0.39, 1.25, seg=16, axis="Y")  # kap membulat
    _box(b, "kebun:bodi-gelap", (0, -1.42, 0.98), (0.66, 0.06, 0.5))                # gril
    for i in range(4):
        _box(b, "kebun:bodi-merah", (0, -1.455, 0.8 + i * 0.12), (0.6, 0.02, 0.04))
    for sx in (-1, 1):
        _ball(b, "kebun:lampu", (sx * 0.27, -1.43, 1.3), 0.08, sy=0.5)
        _box(b, "kebun:bodi-merah", (sx * 0.72, AXLE_REAR[1], 1.32), (0.46, 1.05, 0.06))  # spakbor
        _box(b, "kebun:bodi-merah", (sx * 0.72, AXLE_REAR[1] - 0.52, 1.05), (0.46, 0.06, 0.54))
    _box(b, "kebun:bodi-gelap", (0, 0.25, 0.86), (1.0, 0.85, 0.06))                 # pijakan kaki
    _box(b, "kebun:bodi-merah", (0, 0.42, 1.0), (0.5, 0.5, 0.3))                    # rumah transmisi
    _box(b, "kebun:kursi", (0, SEAT[1], SEAT[2] - 0.04), (0.46, 0.42, 0.08))       # dudukan
    _box(b, "kebun:kursi", (0, SEAT[1] + 0.24, SEAT[2] + 0.2), (0.46, 0.08, 0.42), rx=math.radians(-12))
    _cyl(b, "kebun:bodi-gelap", (0, -0.1, 1.28), 0.03, 0.03, 0.55, seg=8, rx=math.radians(-35))  # tiang setir
    _cyl(b, "kebun:bodi-gelap", (0, 0.05, 1.5), 0.19, 0.19, 0.04, seg=16, rx=math.radians(-35))  # setir
    _cyl(b, "kebun:bodi-gelap", (0.24, -1.0, 1.75), 0.045, 0.06, 0.75, seg=8)       # knalpot
    return b


def _rumah():
    b = {}
    w, d, stilt, wall = 6.0, 5.0, 0.6, 2.6
    for x in (-2.8, 0, 2.8):
        for y in (-2.3, 0, 2.3):
            _box(b, "kebun:kayu-gelap", (x, y, stilt / 2), (0.2, 0.2, stilt))         # tiang panggung
    _box(b, "kebun:kayu-gelap", (0, 0, stilt + 0.06), (w + 0.2, d + 0.2, 0.12))       # lantai
    _box(b, "kebun:kayu-dinding", (0, 0, stilt + 0.12 + wall / 2), (w, d, wall))     # badan dinding
    for i in range(9):  # papan horizontal (garis bayangan)
        z = stilt + 0.4 + i * 0.27
        _box(b, "kebun:kayu-gelap", (0, -d / 2 - 0.01, z), (w, 0.02, 0.03))
        _box(b, "kebun:kayu-gelap", (0, d / 2 + 0.01, z), (w, 0.02, 0.03))
    top = stilt + 0.12 + wall
    _gable(b, "kebun:kayu-dinding", -w / 2, -d / 2, d / 2, top, top + 1.6)
    _gable(b, "kebun:kayu-dinding", w / 2, -d / 2, d / 2, top, top + 1.6)
    _prism(b, "kebun:atap-seng", -w / 2 - 0.4, w / 2 + 0.4, -d / 2, d / 2, top - 0.05, top + 1.65, over=0.6)
    # depan (-Y): pintu tengah, dua jendela, teras + tangga
    _box(b, "kebun:kayu-gelap", (0, -d / 2 - 0.03, stilt + 1.12), (0.95, 0.06, 1.95))
    _box(b, "kebun:kusen-putih", (0, -d / 2 - 0.02, stilt + 1.12), (1.1, 0.04, 2.1))
    for sx in (-1, 1):
        _box(b, "kebun:kusen-putih", (sx * 1.9, -d / 2 - 0.02, stilt + 1.55), (1.1, 0.04, 1.0))
        _box(b, "kebun:kaca", (sx * 1.9, -d / 2 - 0.04, stilt + 1.55), (0.9, 0.04, 0.8))
        _box(b, "kebun:kusen-putih", (sx * 1.9, -d / 2 - 0.06, stilt + 1.55), (0.06, 0.04, 0.8))
        _box(b, "kebun:kusen-putih", (sx * 2.2, d / 2 + 0.02, stilt + 1.55), (1.0, 0.04, 0.9))
        _box(b, "kebun:kaca", (sx * 2.2, d / 2 + 0.04, stilt + 1.55), (0.8, 0.04, 0.7))
    _box(b, "kebun:kayu-gelap", (0, -d / 2 - 0.75, stilt + 0.06), (w, 1.5, 0.1))      # teras
    for x in (-2.9, -1.0, 1.0, 2.9):
        _box(b, "kebun:kayu-gelap", (x, -d / 2 - 1.42, stilt / 2), (0.15, 0.15, stilt))
        _box(b, "kebun:kusen-putih", (x, -d / 2 - 1.42, stilt + 0.55), (0.06, 0.06, 1.0))
    _box(b, "kebun:kusen-putih", (-2.0, -d / 2 - 1.42, stilt + 0.95), (1.85, 0.05, 0.06))
    _box(b, "kebun:kusen-putih", (2.0, -d / 2 - 1.42, stilt + 0.95), (1.85, 0.05, 0.06))
    for i in range(3):
        _box(b, "kebun:kayu-gelap", (0, -d / 2 - 1.65 - i * 0.28, stilt - 0.18 - i * 0.18), (1.2, 0.3, 0.08))
    return b


def _tanaman(stage):
    b = {}
    if stage == 1:
        _cyl(b, "kebun:batang", (0, 0, 0.06), 0.012, 0.01, 0.12, seg=5)
        for a in (0, math.pi):
            _ball(b, "kebun:daun-muda", (0.05 * math.cos(a), 0.05 * math.sin(a), 0.13), 0.05, sz=0.35)
        return b
    h = 0.35 if stage == 2 else 0.6
    _cyl(b, "kebun:batang", (0, 0, h / 2), 0.02, 0.012, h, seg=6)
    for i in range(5 if stage == 2 else 7):
        a = i * 2.4
        r = 0.1 + 0.03 * (i % 3)
        _ball(b, "kebun:daun", (r * math.cos(a), r * math.sin(a), h * (0.55 + 0.08 * (i % 4))), 0.11 if stage == 2 else 0.15, sz=0.6)
    if stage == 3:
        for i in range(8):
            a = i * 2.1 + 0.5
            r = 0.16 + 0.04 * (i % 2)
            _ball(b, "kebun:cabai", (r * math.cos(a), r * math.sin(a), h * (0.35 + 0.07 * (i % 4))), 0.03, sx=0.7, sy=0.7, sz=2.2)
    return b


def _jagung(stage):
    b = {}
    h = 0.9 if stage == 2 else 1.6
    _cyl(b, "kebun:batang", (0, 0, h / 2), 0.03, 0.018, h, seg=6)
    n = 7 if stage == 2 else 10
    for i in range(n):  # daun pita panjang melengkung keluar (kotak tipis miring)
        a = i * 2.4
        z = h * (0.2 + 0.7 * i / n)
        L = 0.45 if stage == 2 else 0.6
        c = (math.cos(a) * L * 0.45, math.sin(a) * L * 0.45, z + 0.08)
        _box(b, "kebun:daun-jagung", c, (L, 0.12, 0.012), rx=0.0, rz=a)
        bm = b["kebun:daun-jagung"]
        bm.verts.ensure_lookup_table()
        for v in bm.verts[-8:]:  # lengkungkan ujung daun ke bawah
            d = (v.co.x * math.cos(a) + v.co.y * math.sin(a))
            if d > L * 0.5:
                v.co.z -= (d - L * 0.5) * 0.6
    if stage == 3:
        for i, a in enumerate((0.6, 3.4)):
            z = h * (0.45 + 0.12 * i)
            c = (math.cos(a) * 0.07, math.sin(a) * 0.07, z)
            _ball(b, "kebun:kelobot", c, 0.075, sz=2.4)
            _ball(b, "kebun:tongkol", (c[0] * 1.3, c[1] * 1.3, z + 0.1), 0.035, sz=1.6)
        for a in (0, 2.1, 4.2):  # malai di pucuk
            _box(b, "kebun:malai", (math.cos(a) * 0.06, math.sin(a) * 0.06, h + 0.12), (0.015, 0.015, 0.28), rx=0.35 * math.cos(a), rz=a)
    return b


def _terong(stage):
    b = {}
    h = 0.35 if stage == 2 else 0.55
    _cyl(b, "kebun:batang", (0, 0, h / 2), 0.022, 0.014, h, seg=6)
    for i in range(6 if stage == 2 else 8):  # daun lebar
        a = i * 2.4
        r = 0.12 + 0.04 * (i % 2)
        _ball(b, "kebun:daun", (r * math.cos(a), r * math.sin(a), h * (0.5 + 0.08 * (i % 4))), 0.13 if stage == 2 else 0.16, sx=1.3, sz=0.35)
    if stage == 3:
        for i in range(4):
            a = i * 1.7 + 0.3
            c = (0.24 * math.cos(a), 0.24 * math.sin(a), h * 0.3)
            _ball(b, "kebun:terong", c, 0.06, sx=0.9, sy=0.9, sz=2.4)
            _ball(b, "kebun:kelopak", (c[0], c[1], c[2] + 0.11), 0.03, sz=0.6)
    return b


def _export(coll_name, bms, glb_name):
    for name in (coll_name, f"{coll_name}_Ekspor"):
        c = bpy.data.collections.get(name)
        if c:
            for o in list(c.objects):
                bpy.data.objects.remove(o, do_unlink=True)
            bpy.data.collections.remove(c)
    coll = bpy.data.collections.new(coll_name)
    bpy.context.scene.collection.children.link(coll)
    for name, bm in bms.items():
        me = bpy.data.meshes.new(f"{coll_name}_{name.split(':')[1]}")
        bm.to_mesh(me)
        bm.free()
        me.materials.append(_material(name))
        coll.objects.link(bpy.data.objects.new(me.name, me))
    ns = runpy.run_path(os.path.join(REPO, "assets-src", "blender", "export_glb.py"))
    n_mesh, tris, kb = ns["export_collection"](coll_name, os.path.join(OUT_DIR, glb_name))
    return {"glb": glb_name, "meshes": n_mesh, "triangles": tris, "kb": kb}


def build():
    out = [
        _export("KBN_Traktor", _traktor(), "f01-traktor.glb"),
        _export("KBN_Rumah", _rumah(), "f02-rumah-kebun.glb"),
    ]
    for s in (1, 2, 3):
        out.append(_export(f"KBN_Tanaman{s}", _tanaman(s), f"f03-tanaman-{s}.glb"))
    for s in (2, 3):
        out.append(_export(f"KBN_Jagung{s}", _jagung(s), f"f04-jagung-{s}.glb"))
        out.append(_export(f"KBN_Terong{s}", _terong(s), f"f05-terong-{s}.glb"))
    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND, copy=True)
    return out
