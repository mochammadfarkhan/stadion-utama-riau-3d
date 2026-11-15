"""
Aset sekre versi detail tinggi (preset Tinggi, keputusan user 2026-11-15): kipas, dispenser + galon, laptop, lemari.
Headless:
    "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" -b --python-expr
      "import runpy;print(runpy.run_path(r'<repo>\\assets-src\\blender\\unri\\sekre_hq.py')['build_all']())"
Konvensi sama dengan sekre_assets.py: meter, origin tengah alas, DEPAN +Y Blender (= −Z three.js). Nama material yang
dipakai runtime dipertahankan: unri:kipas-kepala / unri:kipas-baling (animasi kipas), unri:layar-emisif (layar laptop).
Ukuran mengikuti ASET di src/interiors/sekre/data.js (S09 0,9×0,45×1,8; S13 0,32×0,32×1,25; S14 0,45×0,45×1,3; S17 0,34×0,24).
"""
import math
import os
import runpy

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
H = runpy.run_path(os.path.join(HERE, "sekre_assets.py"))
EXPORT = runpy.run_path(os.path.join(REPO, "assets-src", "blender", "export_glb.py"))
material, box, cyl, torus, sphere, solidify = (H[k] for k in ("material", "box", "cyl", "torus", "sphere", "solidify"))
PI = math.pi


def fresh(name):
    bpy.ops.wm.read_homefile(use_empty=True)
    coll = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(coll)
    bpy.context.view_layer.active_layer_collection = bpy.context.view_layer.layer_collection.children[coll.name]
    return coll


def smooth(o, angle=0.6):
    try:
        o.data.shade_smooth()
    except AttributeError:
        for p in o.data.polygons:
            p.use_smooth = True
    try:
        mod = o.modifiers.new("Halus", "SMOOTH_BY_ANGLE")
        mod["Input_1"] = angle
    except Exception:  # noqa: BLE001 - modifier tidak tersedia di versi lama
        pass
    return o


def kipas():
    putih = material("hq:kipas-plastik", (0.93, 0.93, 0.92), rough=0.32)
    abu = material("hq:kipas-abu", (0.55, 0.57, 0.6), rough=0.4)
    krom = material("hq:kipas-krom", (0.85, 0.86, 0.88), rough=0.15, metal=1.0)
    kepala = material("unri:kipas-kepala", (0.9, 0.9, 0.9), rough=0.3, metal=0.2)
    baling = material("unri:kipas-baling", (0.35, 0.72, 0.95), rough=0.15, alpha=0.8)
    smooth(cyl("dasar", 0.215, 0.035, (0, 0, 0.0175), putih, r2=0.2, verts=64))
    smooth(cyl("dasar-atas", 0.14, 0.03, (0, 0, 0.05), putih, r2=0.09, verts=48))
    box("panel-tombol", (0.13, 0.05, 0.025), (0, 0.11, 0.045), abu, rot=(-0.25, 0, 0), bevel=0.006)
    for i, c in enumerate([(0.85, 0.2, 0.2), (0.93, 0.93, 0.92), (0.93, 0.93, 0.92), (0.93, 0.93, 0.92)]):
        tm = material(f"hq:kipas-tombol-{i}", c, rough=0.35)
        box(f"tombol-{i}", (0.022, 0.03, 0.012), (-0.042 + i * 0.028, 0.12, 0.062), tm, rot=(-0.25, 0, 0), bevel=0.002)
    smooth(cyl("tiang-bawah", 0.022, 0.55, (0, 0, 0.34), putih, verts=24))
    smooth(cyl("kerah", 0.028, 0.04, (0, 0, 0.62), abu, verts=24))
    smooth(cyl("tiang-atas", 0.016, 0.38, (0, 0, 0.82), krom, verts=24))
    smooth(cyl("leher", 0.03, 0.06, (0, -0.02, 0.99), putih, verts=24))
    # kepala: motor berventilasi + kisi
    smooth(cyl("motor", 0.085, 0.16, (0, -0.1, 1.05), kepala, rot=(PI / 2, 0, 0), r2=0.065, verts=48))
    for k in range(5):
        torus(f"ventilasi-{k}", 0.075 - k * 0.003, 0.003, (0, -0.15 + k * 0.022, 1.05), abu, rot=(PI / 2, 0, 0))
    smooth(sphere("tutup-motor", 0.064, (0, -0.18, 1.05), kepala))
    for ring, (r, y) in enumerate([(0.215, 0.0), (0.215, 0.1), (0.16, 0.115), (0.105, 0.125), (0.055, 0.13)]):
        torus(f"kisi-ring-{ring}", r, 0.0035, (0, y, 1.05), kepala, rot=(PI / 2, 0, 0))
    for i in range(24):
        a = i / 24 * 2 * PI
        # jari-jari depan (melengkung: dua ruas) + jari-jari tepi belakang–depan
        for (r0, r1, y0, y1) in [(0.04, 0.13, 0.13, 0.118), (0.13, 0.215, 0.118, 0.1)]:
            rm = (r0 + r1) / 2
            ln = math.hypot(r1 - r0, y1 - y0)
            o = box(f"ruji-{i}-{r0}", (0.004, 0.004, ln), (math.cos(a) * rm, (y0 + y1) / 2, 1.05 + math.sin(a) * rm), kepala)
            o.rotation_euler = (0, PI / 2 - a, 0)
        box(f"ruji-belakang-{i}", (0.0035, 0.1, 0.0035), (math.cos(a) * 0.215, 0.05, 1.05 + math.sin(a) * 0.215), kepala)
    smooth(cyl("logo-tengah", 0.045, 0.012, (0, 0.135, 1.05), abu, rot=(PI / 2, 0, 0), verts=32))
    smooth(cyl("hub", 0.035, 0.04, (0, 0.06, 1.05), baling, rot=(PI / 2, 0, 0), verts=32))
    for i in range(3):
        a = i * 2 * PI / 3
        b = box(f"bilah-{i}", (0.09, 0.006, 0.16), (math.sin(a) * 0.105, 0.06, 1.05 + math.cos(a) * 0.105), baling, bevel=0.03)
        b.rotation_euler = (0.0, a, 0.0)
        b.rotation_euler.rotate_axis("Z", 0.35)
        smooth(b)
    return "HQ_Kipas"


def dispenser():
    badan = material("hq:dispenser-badan", (0.94, 0.94, 0.95), rough=0.25)
    panel = material("hq:dispenser-panel", (0.18, 0.2, 0.22), rough=0.3)
    krom = material("hq:dispenser-krom", (0.8, 0.82, 0.85), rough=0.18, metal=1.0)
    merah = material("hq:kran-merah", (0.82, 0.1, 0.1), rough=0.3)
    biru = material("hq:kran-biru", (0.08, 0.42, 0.85), rough=0.3)
    led_m = material("hq:led-merah", (0.9, 0.1, 0.1), rough=0.3, emission=(1.0, 0.15, 0.1))
    led_h = material("hq:led-hijau", (0.1, 0.9, 0.2), rough=0.3, emission=(0.2, 1.0, 0.3))
    galon = material("unri:galon-kaca", (0.55, 0.78, 0.95), rough=0.05, alpha=0.45)
    air = material("hq:air", (0.35, 0.62, 0.85), rough=0.03, alpha=0.75)
    tutup = material("hq:galon-tutup", (0.1, 0.35, 0.8), rough=0.4)
    smooth(box("badan", (0.31, 0.31, 0.88), (0, 0, 0.46), badan, bevel=0.02))
    box("kaki", (0.29, 0.29, 0.02), (0, 0, 0.01), panel, bevel=0.004)
    box("panel-depan", (0.24, 0.012, 0.34), (0, 0.158, 0.66), panel, bevel=0.01)
    box("ceruk", (0.2, 0.06, 0.2), (0, 0.13, 0.6), panel, bevel=0.008)
    for x, m in ((-0.05, merah), (0.05, biru)):
        smooth(cyl(f"kran-{x}", 0.016, 0.045, (x, 0.18, 0.67), krom, rot=(PI / 2, 0, 0), verts=24))
        box(f"tuas-{x}", (0.03, 0.05, 0.012), (x, 0.205, 0.69), m, rot=(0.4, 0, 0), bevel=0.004)
        smooth(cyl(f"mulut-{x}", 0.007, 0.03, (x, 0.2, 0.645), krom, verts=12))
    box("tatakan", (0.2, 0.1, 0.022), (0, 0.18, 0.505), panel, bevel=0.004)
    for i in range(8):
        box(f"kisi-tatakan-{i}", (0.18, 0.006, 0.004), (0, 0.14 + i * 0.011, 0.518), krom)
    sphere("led-panas", 0.006, (-0.08, 0.166, 0.8), led_m)
    sphere("led-dingin", 0.006, (0.08, 0.166, 0.8), led_h)
    for side in (-1, 1):
        for k in range(10):
            box(f"ventilasi-{side}-{k}", (0.004, 0.2, 0.008), (side * 0.156, -0.02, 0.15 + k * 0.025), panel)
    smooth(box("bahu", (0.3, 0.3, 0.05), (0, 0, 0.925), badan, bevel=0.02))
    smooth(cyl("dudukan-galon", 0.11, 0.03, (0, 0, 0.96), panel, verts=48))
    # galon 19 L terbalik: leher di bawah, badan berusuk
    smooth(cyl("galon-leher", 0.03, 0.05, (0, 0, 0.995), galon, r2=0.05, verts=32))
    smooth(cyl("galon-bahu", 0.05, 0.05, (0, 0, 1.04), galon, r2=0.135, verts=48))
    smooth(cyl("galon", 0.135, 0.17, (0, 0, 1.15), galon, verts=48))
    smooth(cyl("galon-pantat", 0.135, 0.03, (0, 0, 1.25), galon, r2=0.12, verts=48))
    for k in range(4):
        torus(f"usuk-{k}", 0.136, 0.004, (0, 0, 1.08 + k * 0.045), galon)
    smooth(cyl("air", 0.128, 0.11, (0, 0, 1.09), air, verts=48))
    smooth(cyl("tutup-galon", 0.032, 0.02, (0, 0, 0.98), tutup, verts=24))
    box("label", (0.12, 0.002, 0.08), (0, 0.136, 1.15), material("hq:label-galon", (0.15, 0.4, 0.85), rough=0.5))
    return "HQ_Dispenser"


def laptop():
    alu = material("hq:laptop-aluminium", (0.62, 0.64, 0.67), rough=0.28, metal=0.9)
    tuts = material("hq:laptop-tuts", (0.06, 0.06, 0.07), rough=0.55)
    hitam = material("hq:laptop-bezel", (0.03, 0.03, 0.035), rough=0.35)
    layar = material("unri:layar-emisif", (0.03, 0.04, 0.05), rough=0.15, emission=(0.6, 0.75, 1.0))
    smooth(box("alas", (0.34, 0.235, 0.014), (0, 0, 0.007), alu, bevel=0.006))
    box("dek-keyboard", (0.3, 0.115, 0.001), (0, -0.025, 0.0145), hitam)
    rows = [(14, 0.0175), (14, 0.0175), (13, 0.019), (12, 0.0205), (11, 0.022)]
    for r, (n, w) in enumerate(rows):
        y = 0.018 - r * 0.0195
        x0 = -(n * w) / 2 + w / 2
        for c in range(n):
            box(f"tuts-{r}-{c}", (w - 0.0025, 0.016, 0.002), (x0 + c * w, y, 0.0155), tuts, bevel=0.0006)
    box("spasi", (0.1, 0.016, 0.002), (0, -0.08, 0.0155), tuts, bevel=0.0006)
    box("touchpad", (0.11, 0.065, 0.0008), (0, 0.075, 0.0144), material("hq:touchpad", (0.55, 0.57, 0.6), rough=0.2, metal=0.7))
    smooth(cyl("engsel", 0.006, 0.28, (0, -0.115, 0.016), hitam, rot=(0, PI / 2, 0), verts=16))
    tilt = 0.28
    cy = -0.117 - math.sin(tilt) * 0.11
    cz = 0.018 + math.cos(tilt) * 0.11
    smooth(box("tutup", (0.34, 0.006, 0.225), (0, cy, cz), alu, rot=(-tilt, 0, 0), bevel=0.004))
    nx, nz = math.cos(tilt), math.sin(tilt)
    box("bezel", (0.33, 0.001, 0.215), (0, cy + 0.0034 * nx, cz + 0.0034 * nz), hitam, rot=(-tilt, 0, 0))
    box("layar", (0.305, 0.001, 0.185), (0, cy + 0.0042 * nx, cz - 0.004 + 0.0042 * nz), layar, rot=(-tilt, 0, 0))
    sphere("kamera", 0.002, (0, cy + 0.004 * nx - 0.103 * math.sin(tilt), cz + 0.103 * math.cos(tilt)), hitam)
    return "HQ_Laptop"


def lemari():
    cat = material("hq:lemari-cat", (0.55, 0.58, 0.61), rough=0.38, metal=0.35)
    gelap = material("hq:lemari-gelap", (0.24, 0.26, 0.28), rough=0.45, metal=0.3)
    krom = material("hq:lemari-krom", (0.85, 0.86, 0.88), rough=0.15, metal=1.0)
    alu = material("hq:lemari-alu", (0.78, 0.8, 0.82), rough=0.3, metal=0.9)
    kaca = material("hq:lemari-kaca", (0.85, 0.92, 0.95), rough=0.03, alpha=0.18)
    W, D, Hh = 0.9, 0.45, 1.8
    # badan: punggung, sisi, atap, alas (dinding 1 cm, tepi dibevel)
    box("punggung", (W, 0.01, Hh), (0, -D / 2 + 0.005, Hh / 2), cat, bevel=0.002)
    for s in (-1, 1):
        box(f"sisi-{s}", (0.012, D, Hh), (s * (W / 2 - 0.006), 0, Hh / 2), cat, bevel=0.003)
    box("atap", (W, D, 0.015), (0, 0, Hh - 0.0075), cat, bevel=0.003)
    box("plint", (W - 0.02, D - 0.03, 0.06), (0, -0.01, 0.03), gelap, bevel=0.003)
    for z in (0.95, 1.35):  # rak tempat ordner (data.js ordnerSlots: y 0.97 & 1.36)
        box(f"rak-{z}", (W - 0.026, D - 0.03, 0.015), (0, -0.005, z - 0.0075), cat, bevel=0.002)
    # pintu bawah: dua daun berventilasi, gagang krom, lubang kunci
    for s in (-1, 1):
        x = s * 0.2225
        box(f"pintu-{s}", (0.43, 0.014, 0.86), (x, D / 2 - 0.007, 0.5), cat, bevel=0.004)
        box(f"lis-pintu-{s}", (0.39, 0.003, 0.82), (x, D / 2 + 0.001, 0.5), cat, bevel=0.002)
        for k in range(6):
            box(f"ventilasi-{s}-{k}", (0.26, 0.004, 0.008), (x, D / 2 + 0.002, 0.74 - k * 0.018), gelap)
        smooth(cyl(f"gagang-{s}", 0.007, 0.12, (s * 0.03, D / 2 + 0.03, 0.75), krom, verts=16))
        for dz in (-0.05, 0.05):
            smooth(cyl(f"kaki-gagang-{s}-{dz}", 0.005, 0.03, (s * 0.03, D / 2 + 0.015, 0.75 + dz), krom, rot=(PI / 2, 0, 0), verts=12))
    smooth(cyl("kunci", 0.008, 0.01, (0, D / 2 + 0.002, 0.88), krom, rot=(PI / 2, 0, 0), verts=20))
    # pintu kaca geser atas: bingkai aluminium dua rel
    for s, dy in ((-1, 0.0), (1, 0.018)):
        x = s * 0.2225
        y = D / 2 - 0.01 - dy
        for xx in (x - 0.2075, x + 0.2075):
            box(f"bingkai-tegak-{s}-{xx}", (0.02, 0.016, 0.78), (xx, y, 1.36), alu, bevel=0.002)
        for zz in (0.98, 1.74):
            box(f"bingkai-datar-{s}-{zz}", (0.435, 0.016, 0.02), (x, y, zz), alu, bevel=0.002)
        box(f"kaca-{s}", (0.395, 0.004, 0.74), (x, y, 1.36), kaca)
        box(f"pegangan-geser-{s}", (0.012, 0.006, 0.1), (x - s * 0.17, y + 0.011, 1.36), gelap, bevel=0.002)
    for zz in (0.965, 1.765):
        box(f"rel-{zz}", (W - 0.024, 0.04, 0.008), (0, D / 2 - 0.02, zz), alu)
    box("plakat", (0.08, 0.002, 0.025), (0, D / 2 + 0.001, 0.08), material("hq:plakat", (0.78, 0.66, 0.38), rough=0.3, metal=1.0))
    return "HQ_Lemari"


BUILDERS = {"kipas": kipas, "dispenser": dispenser, "laptop": laptop, "lemari": lemari}


def build(stem):
    coll = fresh(f"HQ_{stem}")
    coll.name = BUILDERS[stem]()
    glb = os.path.join(REPO, "public", "models", "sekre-hq", f"{stem}.glb")
    os.makedirs(os.path.dirname(glb), exist_ok=True)
    meshes, tris, kb = EXPORT["export_collection"](coll.name, glb, ratios={})
    return {"aset": stem, "mesh": meshes, "segitiga": tris, "kb": kb}


def build_all():
    return [build(s) for s in BUILDERS]
