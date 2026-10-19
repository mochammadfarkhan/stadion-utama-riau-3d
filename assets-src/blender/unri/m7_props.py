"""
Props kampus M7 untuk Blender — P02 halte Trans Metro Pekanbaru dan N10 lambang UNRI. Dijalankan headless:

    "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" -b --python assets-src/blender/unri/m7_props.py -- p02 n10
    (env M7_PREVIEW_DIR=<dir> → render pratinjau PNG)

Konvensi katalog: meter, origin di tengah alas, DEPAN menghadap +Y Blender (= −Z three.js setelah ekspor Y-up), satu material
per objek "unri:<nama>". Pembantu geometri dipinjam dari sekre_assets.py (M5).
P02 (6 × 2 × 3 m): halte TMP beratap dan berbangku ada di OSM [T]; warna & detail [INFERENSI]. Sisi terbuka (jalan) di +Y.
N10 (1 × 0,05 × 1 m): deskripsi resmi unri.ac.id/lambang [T] — Lancang Kuning dalam segi lima; dasar hijau lumut; kuning emas;
pohon hayat 1 daun kecil + 10 daun besar (tanggal 1, bulan 10); teratai 6 kelopak besar + 2 kecil (tahun 62); perahu & tiang
layar kuning; laut & gelombang. Tata letak gambar [INFERENSI] (bukan salinan gambar resmi). Muka depan +Y.
"""
import math
import os
import runpy
import sys

import bmesh
import bpy
from mathutils import Vector

REPO = r"C:\Users\mocha\Documents\stadion-utama-riau-3d"
_H = runpy.run_path(os.path.join(REPO, "assets-src", "blender", "unri", "sekre_assets.py"))
_material, fresh, box, cyl, sphere = (_H[k] for k in ("material", "fresh", "box", "cyl", "sphere"))
EXPORT_PY = _H["EXPORT_PY"]
PI = math.pi


def material(name, rgb, rough=0.6, metal=0.0):
    m = _material(name, rgb, rough, metal)
    m.diffuse_color = (*rgb, 1.0)
    return m


def prism(name, pts_xz, y0, y1, mat):
    """Prisma dari poligon di bidang XZ, tebal sepanjang Y dari y0 ke y1 (muka depan = +Y)."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    back = [bm.verts.new((x, y0, z)) for x, z in pts_xz]
    front = [bm.verts.new((x, y1, z)) for x, z in pts_xz]
    bm.faces.new(back[::-1])
    bm.faces.new(front)
    n = len(pts_xz)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((back[i], back[j], front[j], front[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    ob.data.materials.append(mat)
    bpy.context.collection.objects.link(ob)
    return ob


def ellipsoid(name, radii, loc, mat, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=1.0, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.scale = radii
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.name = name
    o.data.materials.clear()
    o.data.materials.append(mat)
    return o


def text(name, body, size, extrude, mat, loc, rot):
    cu = bpy.data.curves.new(name, "FONT")
    cu.body = body
    cu.size = size
    cu.extrude = extrude
    cu.align_x = "CENTER"
    cu.align_y = "CENTER"
    ob = bpy.data.objects.new(name, cu)
    ob.data.materials.append(mat)
    bpy.context.collection.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = rot
    return ob


def p02_halte():
    logam = material("unri:logam-halte", (0.55, 0.58, 0.6), rough=0.4, metal=0.7)
    atap = material("unri:atap-halte", (0.18, 0.31, 0.43), rough=0.5)
    kaca = material("unri:kaca-halte", (0.6, 0.75, 0.8), rough=0.05)
    papan = material("unri:papan-halte", (0.95, 0.95, 0.95), rough=0.6)
    huruf = material("unri:huruf-halte", (0.1, 0.25, 0.45), rough=0.6)
    for i, (x, y) in enumerate(((-2.8, -0.85), (2.8, -0.85), (-2.8, 0.85), (2.8, 0.85))):
        cyl(f"tiang-{i}", 0.05, 2.6, (x, y, 1.3), logam, verts=10)
    box("atap", (6.4, 2.4, 0.08), (0, 0, 2.72), atap, rot=(-0.06, 0, 0), bevel=0.02)
    box("panel-belakang", (5.6, 0.03, 1.4), (0, -0.88, 1.35), kaca)
    box("rangka-panel", (5.7, 0.05, 0.05), (0, -0.88, 2.07), logam)
    box("rangka-panel-bawah", (5.7, 0.05, 0.05), (0, -0.88, 0.62), logam)
    box("dudukan", (4.0, 0.42, 0.06), (0, -0.6, 0.45), logam, bevel=0.01)
    for i, x in enumerate((-1.8, 0.0, 1.8)):
        box(f"kaki-bangku-{i}", (0.05, 0.36, 0.42), (x, -0.6, 0.21), logam)
    box("papan-nama", (2.6, 0.06, 0.42), (0, 1.15, 3.0), papan, bevel=0.01)
    text("teks-halte", "HALTE TRANS METRO", 0.2, 0.004, huruf, (0, 1.19, 3.0), (PI / 2, 0, PI))
    return "UNRI_P02_Halte"


def _pentagon(radius, cz):
    return [(radius * math.sin(2 * PI * k / 5), cz + radius * math.cos(2 * PI * k / 5)) for k in range(5)]


def n10_lambang():
    emas = material("unri:lambang-emas", (0.83, 0.63, 0.09), rough=0.35, metal=0.6)
    hijau = material("unri:lambang-hijau", (0.31, 0.36, 0.18), rough=0.7)
    kuning = material("unri:lambang-kuning", (0.95, 0.76, 0.0), rough=0.5)
    putih = material("unri:lambang-putih", (0.96, 0.96, 0.94), rough=0.5)
    biru = material("unri:lambang-biru", (0.24, 0.55, 1.0), rough=0.5)
    daun = material("unri:lambang-daun", (0.55, 0.76, 0.29), rough=0.6)
    cz = 0.5
    prism("bingkai", _pentagon(0.5, cz), -0.025, 0.0, emas)
    prism("dasar", _pentagon(0.455, cz), 0.0, 0.008, hijau)
    for i in range(3):
        box(f"gelombang-{i}", (0.5 - i * 0.06, 0.006, 0.022), (0, 0.011, cz - 0.3 + i * 0.05), biru)
    prism("lambung", [(-0.24, cz - 0.1), (0.24, cz - 0.1), (0.17, cz - 0.18), (-0.17, cz - 0.18)], 0.008, 0.02, kuning)
    box("tiang-layar", (0.016, 0.012, 0.3), (0, 0.014, cz + 0.05), kuning)
    prism("layar", [(-0.012, cz - 0.08), (-0.012, cz + 0.18), (-0.17, cz - 0.06)], 0.008, 0.018, kuning)  # cermin: penonton di +Y melihat −X ke kanan
    tx, tz = 0.2, cz + 0.12  # dilihat dari depan (+Y) sumbu X terbalik: pohon di kiri penonton = +X
    box("batang-pohon", (0.02, 0.01, 0.14), (tx, 0.013, tz - 0.07), emas)
    for i in range(10):  # 10 daun besar = bulan Oktober
        a = -PI * 0.9 + i / 9 * PI * 0.8
        ellipsoid(f"daun-besar-{i}", (0.03, 0.006, 0.012), (tx - math.cos(a) * 0.07, 0.014, tz - math.sin(a) * 0.07), daun, rot=(0, -a, 0))
    ellipsoid("daun-kecil", (0.015, 0.006, 0.007), (tx, 0.014, tz + 0.1), daun, rot=(0, PI / 2, 0))  # tanggal 1
    lx, lz = -0.2, cz + 0.05
    for i in range(6):  # 6 kelopak besar
        a = -PI + i / 5 * PI
        ellipsoid(f"kelopak-besar-{i}", (0.035, 0.006, 0.014), (lx - math.cos(a) * 0.04, 0.014, lz - math.sin(a) * 0.04), putih, rot=(0, -a, 0))
    for s in (-1, 1):  # 2 kelopak kecil → tahun 62
        ellipsoid(f"kelopak-kecil-{s}", (0.018, 0.006, 0.008), (lx - s * 0.07, 0.014, lz - 0.05), putih, rot=(0, -s * 0.4, 0))
    return "UNRI_N10_Lambang"


BUILDERS = {"p02-halte-tmp": p02_halte, "n10-lambang-unri": n10_lambang}
PREVIEWS = {"p02-halte-tmp": {"eye": (7.5, 7.5, 3.5), "look": (0, 0, 1.4)}, "n10-lambang-unri": {"eye": (0.0, 1.7, 0.6), "look": (0, 0, 0.5)}}


def _preview(path, eye, look):
    sc = bpy.context.scene
    try:
        sc.render.engine = "BLENDER_WORKBENCH"
    except TypeError:
        pass
    sc.render.resolution_x, sc.render.resolution_y = 800, 600
    sc.display.shading.light = "STUDIO"
    sc.display.shading.color_type = "MATERIAL"
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    bpy.context.scene.collection.objects.link(cam)
    cam.location = eye
    cam.rotation_euler = (Vector(look) - Vector(eye)).to_track_quat("-Z", "Y").to_euler()
    sc.camera = cam
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam, do_unlink=True)


def build(stem, preview=None):
    coll = fresh(f"UNRI_{stem}")
    coll.name = BUILDERS[stem]()
    exporter = runpy.run_path(EXPORT_PY)
    glb = os.path.join(REPO, "public", "models", "unri", f"{stem}.glb")
    meshes, tris, kb = exporter["export_collection"](coll.name, glb, ratios={})
    if preview:
        _preview(preview, **PREVIEWS[stem])
    blend = os.path.join(REPO, "assets-src", "blender", "unri", f"{stem}.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend)
    return {"aset": stem, "mesh": meshes, "segitiga": tris, "kb": kb}


if __name__ == "__main__" or os.environ.get("M7_PROPS_RUN"):
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out_dir = os.environ.get("M7_PREVIEW_DIR")
    for stem in [s for s in BUILDERS if not argv or s.split("-")[0] in argv or s in argv]:
        pv = os.path.join(out_dir, stem + ".png") if out_dir else None
        print("M7:", build(stem, preview=pv))
