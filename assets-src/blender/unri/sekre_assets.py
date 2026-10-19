"""
Aset interior sekre (M5) untuk Blender, dijalankan lewat Blender MCP (execute_blender_code):

    import runpy
    ns = runpy.run_path(r"C:\\Users\\mocha\\Documents\\stadion-utama-riau-3d\\assets-src\\blender\\unri\\sekre_assets.py")
    print(ns["build"]("s07-piala"))

Konvensi katalog: meter, origin di tengah alas, DEPAN menghadap +Y Blender (= -Z three.js setelah ekspor Y-up),
satu material per objek bernama "unri:<nama>" (warna di Principled BSDF, node dicari per tipe). build() membuka
file kosong (read_homefile use_empty, add-on tetap aktif) dan MENOLAK bila file yang terbuka punya perubahan belum
disimpan, membangun koleksi, mengekspor GLB lewat export_glb.py, lalu menyimpan .blend.
"""
import math
import os
import runpy

import bpy

REPO = r"C:\Users\mocha\Documents\stadion-utama-riau-3d"
EXPORT_PY = os.path.join(REPO, "assets-src", "blender", "export_glb.py")
PI = math.pi


def _socket(bsdf, *names):
    for n in names:
        s = bsdf.inputs.get(n)
        if s is not None:
            return s
    for s in bsdf.inputs:
        if s.identifier in names:
            return s
    return None


def material(name, rgb, rough=0.6, metal=0.0, alpha=1.0, emission=None):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    _socket(bsdf, "Base Color").default_value = (*rgb, 1.0)
    _socket(bsdf, "Roughness").default_value = rough
    _socket(bsdf, "Metallic").default_value = metal
    if alpha < 1.0:
        _socket(bsdf, "Alpha").default_value = alpha
        try:
            m.surface_render_method = "BLENDED"
        except (AttributeError, TypeError):
            m.blend_method = "BLEND"
    if emission:
        _socket(bsdf, "Emission Color", "Emission").default_value = (*emission, 1.0)
        _socket(bsdf, "Emission Strength").default_value = 2.0
    return m


def fresh(coll_name):
    if bpy.data.is_dirty:
        raise RuntimeError("File Blender yang terbuka punya perubahan belum disimpan: minta user menyimpan dulu.")
    bpy.ops.wm.read_homefile(use_empty=True)
    coll = bpy.data.collections.new(coll_name)
    bpy.context.scene.collection.children.link(coll)
    bpy.context.view_layer.active_layer_collection = bpy.context.view_layer.layer_collection.children[coll.name]
    return coll


def _finish(o, name, mat):
    o.name = name
    o.data.materials.clear()
    o.data.materials.append(mat)
    return o


def box(name, size, loc, mat, rot=(0, 0, 0), bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel > 0:
        mod = o.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 3
    return _finish(o, name, mat)


def cyl(name, r, depth, loc, mat, rot=(0, 0, 0), verts=24, r2=None, caps=True):
    fill = "NGON" if caps else "NOTHING"
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, vertices=verts, location=loc, rotation=rot, end_fill_type=fill)
    else:
        bpy.ops.mesh.primitive_cone_add(radius1=r, radius2=r2, depth=depth, vertices=verts, location=loc, rotation=rot, end_fill_type=fill)
    return _finish(bpy.context.active_object, name, mat)


def torus(name, major, minor, loc, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=24, minor_segments=8, location=loc, rotation=rot)
    return _finish(bpy.context.active_object, name, mat)


def sphere(name, r, loc, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=16, ring_count=8, location=loc)
    return _finish(bpy.context.active_object, name, mat)


def solidify(o, t):
    mod = o.modifiers.new("Tebal", "SOLIDIFY")
    mod.thickness = t
    return o


# ---------------- aset ----------------

def s07_piala():
    emas = material("unri:emas", (0.83, 0.62, 0.2), rough=0.28, metal=1.0)
    kayu = material("unri:alas-kayu", (0.2, 0.13, 0.09), rough=0.5)
    marmer = material("unri:marmer", (0.9, 0.88, 0.84), rough=0.3)
    box("alas", (0.15, 0.15, 0.05), (0, 0, 0.025), kayu, bevel=0.004)
    box("marmer", (0.11, 0.11, 0.07), (0, 0, 0.085), marmer, bevel=0.003)
    cyl("batang", 0.025, 0.1, (0, 0, 0.17), emas, r2=0.012, verts=20)
    solidify(cyl("cawan", 0.03, 0.13, (0, 0, 0.285), emas, r2=0.065, verts=32, caps=False), 0.004)
    cyl("dasar-cawan", 0.03, 0.004, (0, 0, 0.222), emas, verts=20)
    torus("pegangan-kiri", 0.035, 0.007, (-0.07, 0, 0.29), emas, rot=(PI / 2, 0, 0))
    torus("pegangan-kanan", 0.035, 0.007, (0.07, 0, 0.29), emas, rot=(PI / 2, 0, 0))
    torus("bibir", 0.066, 0.005, (0, 0, 0.35), emas)
    cyl("leher-hiasan", 0.012, 0.05, (0, 0, 0.39), emas, r2=0.004, verts=12)
    sphere("bintang", 0.022, (0, 0, 0.43), emas)
    box("plakat", (0.06, 0.003, 0.02), (0, 0.0565, 0.085), emas)
    return "UNRI_S07_Piala"


def s13_dispenser():
    badan = material("unri:dispenser-badan", (0.92, 0.93, 0.94), rough=0.35)
    detail = material("unri:dispenser-detail", (0.45, 0.5, 0.53), rough=0.5)
    merah = material("unri:kran-merah", (0.8, 0.12, 0.12), rough=0.4)
    biru = material("unri:kran-biru", (0.1, 0.45, 0.85), rough=0.4)
    galon = material("unri:galon-kaca", (0.55, 0.77, 0.92), rough=0.08, alpha=0.5)
    air = material("unri:air", (0.37, 0.66, 0.83), rough=0.05)
    box("badan", (0.32, 0.32, 0.9), (0, 0, 0.45), badan, bevel=0.012)
    box("panel-kran", (0.26, 0.01, 0.28), (0, 0.165, 0.62), detail, bevel=0.003)
    cyl("kran-panas", 0.012, 0.05, (-0.05, 0.19, 0.66), merah, rot=(PI / 2, 0, 0), verts=16)
    cyl("kran-dingin", 0.012, 0.05, (0.05, 0.19, 0.66), biru, rot=(PI / 2, 0, 0), verts=16)
    box("tatakan", (0.2, 0.1, 0.02), (0, 0.2, 0.5), detail, bevel=0.003)
    box("leher", (0.3, 0.3, 0.04), (0, 0, 0.92), detail, bevel=0.005)
    cyl("galon-leher", 0.05, 0.04, (0, 0, 0.96), galon, r2=0.135, verts=32)
    cyl("galon", 0.135, 0.27, (0, 0, 1.115), galon, verts=32)
    cyl("air-sisa", 0.128, 0.07, (0, 0, 1.015), air, verts=32)
    return "UNRI_S13_Dispenser"


def s14_kipas():
    badan = material("unri:kipas-badan", (0.9, 0.9, 0.9), rough=0.4)
    kepala = material("unri:kipas-kepala", (0.82, 0.83, 0.85), rough=0.35, metal=0.3)
    baling = material("unri:kipas-baling", (0.31, 0.76, 0.97), rough=0.2, alpha=0.85)
    cyl("dasar", 0.22, 0.04, (0, 0, 0.02), badan, r2=0.2, verts=40)
    cyl("tiang", 0.018, 0.98, (0, 0, 0.53), badan, verts=16)
    box("tombol", (0.06, 0.05, 0.08), (0, 0.03, 0.32), badan, bevel=0.006)
    cyl("motor", 0.08, 0.14, (0, -0.09, 1.05), kepala, rot=(PI / 2, 0, 0), r2=0.07, verts=24)
    torus("ring-dalam", 0.21, 0.006, (0, 0.03, 1.05), kepala, rot=(PI / 2, 0, 0))
    torus("ring-luar", 0.21, 0.006, (0, 0.1, 1.05), kepala, rot=(PI / 2, 0, 0))
    for i in range(12):
        a = i / 12 * 2 * PI
        box(f"ruji-{i}", (0.005, 0.005, 0.21), (math.cos(a) * 0.105, 0.1, 1.05 + math.sin(a) * 0.105), kepala, rot=(0, a - PI / 2, 0))
        box(f"ruji-tepi-{i}", (0.004, 0.07, 0.004), (math.cos(a) * 0.21, 0.065, 1.05 + math.sin(a) * 0.21), kepala)
    cyl("hub", 0.03, 0.03, (0, 0.065, 1.05), baling, rot=(PI / 2, 0, 0), verts=16)
    for i in range(3):
        a = i * 2 * PI / 3
        b = box(f"bilah-{i}", (0.075, 0.008, 0.17), (math.sin(a) * 0.1, 0.065, 1.05 + math.cos(a) * 0.1), baling, bevel=0.01)
        b.rotation_euler = (0.0, a, 0.0)          # sebar 120° di bidang depan (sumbu Y = arah tiup)
        b.rotation_euler.rotate_axis("Z", 0.3)    # sudut serang bilah
    return "UNRI_S14_Kipas"


def s15_printer():
    badan = material("unri:printer-badan", (0.84, 0.82, 0.77), rough=0.45)
    gelap = material("unri:printer-gelap", (0.2, 0.2, 0.21), rough=0.5)
    kertas = material("unri:kertas", (0.97, 0.97, 0.95), rough=0.8)
    box("badan", (0.45, 0.38, 0.2), (0, 0, 0.1), badan, bevel=0.015)
    box("penutup", (0.42, 0.2, 0.03), (0, -0.05, 0.215), badan, bevel=0.006)
    box("baki-keluar", (0.3, 0.15, 0.01), (0, 0.24, 0.2), gelap, rot=(-0.3, 0, 0))
    box("kertas", (0.28, 0.12, 0.002), (0, 0.24, 0.21), kertas, rot=(-0.3, 0, 0))
    box("panel", (0.1, 0.005, 0.03), (0.14, 0.191, 0.15), gelap)
    return "UNRI_S15_Printer"


def s17_laptop():
    badan = material("unri:laptop-badan", (0.23, 0.24, 0.26), rough=0.35, metal=0.4)
    keyboard = material("unri:keyboard", (0.08, 0.08, 0.09), rough=0.6)
    layar = material("unri:layar-emisif", (0.03, 0.04, 0.05), rough=0.2, emission=(0.6, 0.75, 1.0))
    box("alas", (0.34, 0.24, 0.018), (0, 0, 0.009), badan, bevel=0.004)
    box("keyboard", (0.3, 0.12, 0.002), (0, -0.03, 0.019), keyboard)
    box("touchpad", (0.09, 0.06, 0.001), (0, 0.075, 0.019), keyboard)
    tilt = 0.26                                    # tutup terbuka ±105°, miring ke belakang (−Y)
    cy = -0.12 - math.sin(tilt) * 0.11
    cz = 0.018 + math.cos(tilt) * 0.11
    box("tutup", (0.34, 0.008, 0.22), (0, cy, cz), badan, rot=(-tilt, 0, 0), bevel=0.003)
    box("layar", (0.3, 0.001, 0.18), (0, cy + 0.0045 * math.cos(tilt), cz + 0.0045 * math.sin(tilt)), layar, rot=(-tilt, 0, 0))
    return "UNRI_S17_Laptop"


def s19_gitar():
    kayu = material("unri:gitar-kayu", (0.79, 0.55, 0.29), rough=0.35)
    leher = material("unri:gitar-leher", (0.29, 0.18, 0.11), rough=0.45)
    hitam = material("unri:gitar-hitam", (0.04, 0.04, 0.04), rough=0.5)
    senar = material("unri:senar", (0.85, 0.85, 0.82), rough=0.25, metal=1.0)
    cyl("badan-bawah", 0.19, 0.1, (0, 0, 0.21), kayu, rot=(PI / 2, 0, 0), verts=40)
    cyl("badan-atas", 0.145, 0.1, (0, 0, 0.45), kayu, rot=(PI / 2, 0, 0), verts=36)
    box("pinggang", (0.26, 0.1, 0.12), (0, 0, 0.33), kayu)
    cyl("lubang-suara", 0.055, 0.004, (0, 0.051, 0.4), hitam, rot=(PI / 2, 0, 0), verts=24)
    box("bridge", (0.1, 0.02, 0.012), (0, 0.055, 0.12), hitam)
    box("leher", (0.05, 0.03, 0.42), (0, 0, 0.77), leher)
    box("kepala", (0.075, 0.025, 0.13), (0, 0, 0.935), leher, bevel=0.005)
    for i in range(6):
        x = -0.0125 + i * 0.005
        cyl(f"senar-{i}", 0.0008, 0.8, (x, 0.04, 0.52), senar, verts=6)
        cyl(f"pasak-{i}", 0.006, 0.03, (-0.045 if i < 3 else 0.045, 0, 0.9 + (i % 3) * 0.035), senar, rot=(0, PI / 2, 0), verts=8)
    return "UNRI_S19_Gitar"


def s20_tas():
    kain = material("unri:tas-kain", (0.12, 0.16, 0.27), rough=0.85)
    aksen = material("unri:tas-aksen", (0.85, 0.36, 0.12), rough=0.6)
    box("badan", (0.3, 0.18, 0.42), (0, 0, 0.21), kain, bevel=0.05)
    box("saku", (0.22, 0.06, 0.18), (0, 0.1, 0.14), kain, bevel=0.025)
    box("ritsleting", (0.2, 0.004, 0.006), (0, 0.131, 0.22), aksen)
    torus("pegangan", 0.04, 0.008, (0, 0, 0.43), aksen, rot=(PI / 2, 0, 0))
    box("tali-kiri", (0.04, 0.02, 0.36), (-0.08, -0.095, 0.24), aksen)
    box("tali-kanan", (0.04, 0.02, 0.36), (0.08, -0.095, 0.24), aksen)
    return "UNRI_S20_Tas"


BUILDERS = {
    "s07-piala": s07_piala,
    "s13-dispenser-galon": s13_dispenser,
    "s14-kipas-berdiri": s14_kipas,
    "s15-printer-tua": s15_printer,
    "s17-laptop": s17_laptop,
    "s19-gitar-akustik": s19_gitar,
    "s20-tas-ransel": s20_tas,
}


def build(stem, ratios=None):
    """Bangun aset `stem`, ekspor GLB ke public/models/unri/, simpan .blend; kembalikan ringkasan."""
    coll = fresh(f"UNRI_{stem}")
    coll.name = BUILDERS[stem]()
    exporter = runpy.run_path(EXPORT_PY)
    glb = os.path.join(REPO, "public", "models", "unri", f"{stem}.glb")
    meshes, tris, kb = exporter["export_collection"](coll.name, glb, ratios=ratios or {})
    blend = os.path.join(REPO, "assets-src", "blender", "unri", f"{stem}.blend")
    os.makedirs(os.path.dirname(blend), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=blend)
    return {"aset": stem, "mesh": meshes, "segitiga": tris, "kb": kb, "glb": glb, "blend": blend}
