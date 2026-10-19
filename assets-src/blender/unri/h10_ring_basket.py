"""
H10 Tiang ring basket lapangan UNRI (Blender MCP atau headless):

    import runpy
    ns = runpy.run_path(r"C:\\Users\\mocha\\Documents\\stadion-utama-riau-3d\\assets-src\\blender\\unri\\h10_ring_basket.py")
    print(ns["build"]())

Ring FIBA: papan 1,80 x 1,05 m, tepi ring 3,05 m, diameter dalam 0,45 m. Origin = tengah dasar tiang di tanah,
DEPAN (arah lapangan) = +Y Blender (= -Z three.js). Tiang berdiri 1,20 m di luar garis belakang, lengan
menjulur 1,60 m ke arah lapangan. Bentuk tiang/papan [INFERENSI] (foto satelit tidak menunjukkan detail).
"""
import math
import os
import runpy

import bmesh
import bpy
from mathutils import Matrix

REPO = r"C:\Users\mocha\Documents\stadion-utama-riau-3d"
OUT_GLB = os.path.join(REPO, "public", "models", "unri", "h10-ring-basket.glb")
OUT_BLEND = os.path.join(REPO, "assets-src", "blender", "unri", "h10_ring_basket.blend")
COLL = "SUR_RingBasket"

PALETTE = {
    "unri:tiang-biru": ("#1F4E9E", 0.5, 0.4),
    "unri:papan-putih": ("#EDEDE8", 0.5, 0.0),
    "unri:ring-oranye": ("#E0561B", 0.45, 0.5),
    "unri:jaring": ("#F2F2F0", 0.9, 0.0),
    "unri:bantalan": ("#8E4238", 0.9, 0.0),
    "unri:logam-gelap": ("#2B2D30", 0.6, 0.5),
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


def _box(bms, mat, c, s, rx=0.0):
    m = Matrix.Translation(c) @ Matrix.Rotation(rx, 4, "X") @ Matrix.Diagonal((s[0], s[1], s[2], 1.0))
    bmesh.ops.create_cube(bms.setdefault(mat, bmesh.new()), size=1.0, matrix=m)


def _cyl(bms, mat, c, r1, r2, h, seg=16):
    bm = bms.setdefault(mat, bmesh.new())
    m = Matrix.Translation(c)
    try:
        bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r1, radius2=r2, depth=h, matrix=m)
    except TypeError:
        bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, diameter1=2 * r1, diameter2=2 * r2, depth=h, matrix=m)


def _torus(bms, mat, c, major, minor, seg=24, ring=8):
    bm = bms.setdefault(mat, bmesh.new())
    verts = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        row = []
        for j in range(ring):
            b = 2 * math.pi * j / ring
            r = major + minor * math.cos(b)
            row.append(bm.verts.new((c[0] + r * math.cos(a), c[1] + r * math.sin(a), c[2] + minor * math.sin(b))))
        verts.append(row)
    for i in range(seg):
        for j in range(ring):
            bm.faces.new([verts[i][j], verts[(i + 1) % seg][j], verts[(i + 1) % seg][(j + 1) % ring],
                          verts[i][(j + 1) % ring]])


def build():
    for name in (COLL, f"{COLL}_Ekspor"):
        c = bpy.data.collections.get(name)
        if c:
            for o in list(c.objects):
                bpy.data.objects.remove(o, do_unlink=True)
            bpy.data.collections.remove(c)
    bms = {}
    # tiang: dasar beton + tiang persegi 0,15 m setinggi 3,6 m, lengan miring ke arah lapangan (+Y)
    _box(bms, "unri:bantalan", (0, 0, 0.7), (0.24, 0.24, 1.40))                    # bantalan pelindung tiang (ramping, merah pudar)
    _box(bms, "unri:tiang-biru", (0, 0, 2.70), (0.15, 0.15, 3.60))
    _box(bms, "unri:tiang-biru", (0, 0.80, 3.55), (0.12, 1.70, 0.12))
    _box(bms, "unri:tiang-biru", (0, 0.55, 3.15), (0.08, 1.10, 0.08), rx=math.radians(-26))
    # papan: 1,80 lebar x 1,05 tinggi, bawah papan 2,90 m; ring di 3,05 m menjorok 0,15 m dari papan
    bz, by = 3.45, 1.62
    _box(bms, "unri:papan-putih", (0, by, bz), (1.80, 0.05, 1.05))
    for dx in (-0.45, 0.45):
        _box(bms, "unri:ring-oranye", (dx, by + 0.03, bz - 0.20), (0.03, 0.01, 0.59))
    _box(bms, "unri:ring-oranye", (0, by + 0.03, bz - 0.50), (0.93, 0.01, 0.03))
    _box(bms, "unri:ring-oranye", (0, by + 0.03, bz - 0.09), (0.93, 0.01, 0.03))
    ring_c = (0, by + 0.05 + 0.15 + 0.225, 3.05)
    _torus(bms, "unri:ring-oranye", ring_c, 0.225, 0.009)
    _box(bms, "unri:logam-gelap", (0, by + 0.05 + 0.075, 3.05), (0.12, 0.15, 0.025))   # braket ring
    # jaring: kerucut terpotong 0,40 m, 12 segmen, berongga (rangka garis tebal)
    bm = bms.setdefault("unri:jaring", bmesh.new())
    seg = 12
    top = [(ring_c[0] + 0.225 * math.cos(2 * math.pi * i / seg), ring_c[1] + 0.225 * math.sin(2 * math.pi * i / seg), 3.05)
           for i in range(seg)]
    bot = [(ring_c[0] + 0.13 * math.cos(2 * math.pi * i / seg), ring_c[1] + 0.13 * math.sin(2 * math.pi * i / seg), 2.65)
           for i in range(seg)]
    for i in range(seg):
        j = (i + 1) % seg
        a = bm.verts.new(top[i]); b = bm.verts.new(top[j]); c = bm.verts.new(bot[j]); d = bm.verts.new(bot[i])
        bm.faces.new([a, b, c, d])
    coll = bpy.data.collections.new(COLL)
    bpy.context.scene.collection.children.link(coll)
    for name, bm in bms.items():
        me = bpy.data.meshes.new(f"RingBasket_{name.split(':')[1]}")
        bm.to_mesh(me)
        bm.free()
        me.materials.append(_material(name))
        coll.objects.link(bpy.data.objects.new(me.name, me))
    ns = runpy.run_path(os.path.join(REPO, "assets-src", "blender", "export_glb.py"))
    n_mesh, tris, kb = ns["export_collection"](COLL, OUT_GLB)
    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND, copy=True)
    return {"meshes": n_mesh, "triangles": tris, "kb": kb, "glb": OUT_GLB}
