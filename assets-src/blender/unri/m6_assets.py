"""
Aset zona Rektorat (M6) untuk Blender — N01 papan batu "UNIVERSITAS RIAU", N02 huruf nama Rektorat,
N03 kanopi merah Rektorat, N04 kubah mozaik Masjid Arfa'unnas. Dijalankan headless:

    "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" -b --python assets-src/blender/unri/m6_assets.py -- n01 n02 n03 n04

atau lewat Blender MCP: ns = runpy.run_path(<path ini>); print(ns["build"]("n01-papan-batu-unri")).
Konvensi katalog: meter, origin di tengah alas, DEPAN menghadap +Y Blender (= -Z three.js setelah ekspor Y-up),
satu material per objek "unri:<nama>". Pembantu geometri dipinjam dari sekre_assets.py (M5). build() membuka file
kosong, menolak bila file yang terbuka punya perubahan belum disimpan, mengekspor GLB (export_glb.py), menyimpan .blend.
Rujukan [T]: papan batu lengkung "UNIVERSITAS RIAU" di tepi danau (foto drone 2016 Commons Taman_Unri.jpg); huruf
nama di puncak blok tengah Rektorat; kanopi beratap merah di depan Rektorat (bentuk selembayung TIDAK terkonfirmasi →
limas melengkung netral); kubah bermozaik ubin putih-ungu/biru pola wajik + mahkota bulan sabit (foto 2023 Commons
Masjid_Arfaunnas_unri.jpg). Ukuran, jumlah batu, warna persisnya [INFERENSI].
"""
import math
import os
import random
import runpy

import bmesh
import bpy
from mathutils import Matrix, Vector

REPO = r"C:\Users\mocha\Documents\stadion-utama-riau-3d"
_H = runpy.run_path(os.path.join(REPO, "assets-src", "blender", "unri", "sekre_assets.py"))
material, fresh, box, cyl, sphere, torus, _finish = (_H[k] for k in ("material", "fresh", "box", "cyl", "sphere", "torus", "_finish"))
EXPORT_PY = _H["EXPORT_PY"]
PI = math.pi


def _mesh_object(name, bm, mat):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    ob.data.materials.append(mat)
    bpy.context.collection.objects.link(ob)
    return ob


def _text(name, body, size, extrude, bevel, mat, loc, rot, align_x="CENTER", align_y="CENTER"):
    cu = bpy.data.curves.new(name, "FONT")
    cu.body = body
    cu.size = size
    cu.extrude = extrude
    cu.bevel_depth = bevel
    cu.bevel_resolution = 1
    cu.resolution_u = 3
    cu.align_x = align_x
    cu.align_y = align_y
    ob = bpy.data.objects.new(name, cu)
    ob.data.materials.append(mat)
    bpy.context.collection.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = rot
    return ob


# ---------------- N01 papan batu lengkung ----------------

def n01_papan_batu():
    """6 m × 0,6 × 1,6 m: dinding batu alam tersusun per lapis, melengkung cekung ke depan (+Y), alas & penutup beton,
    huruf kuningan "UNIVERSITAS RIAU" timbul mengikuti lengkung (R = 7 m)."""
    rnd = random.Random(373856980)
    batu = [material(f"unri:batu-alam-{k}", c, rough=0.96) for k, c in zip("abc", [(0.40, 0.37, 0.32), (0.33, 0.31, 0.28), (0.46, 0.42, 0.35)])]
    beton = material("unri:beton-alas", (0.62, 0.61, 0.58), rough=0.9)
    kuningan = material("unri:huruf-kuningan", (0.8, 0.62, 0.26), rough=0.32, metal=0.85)
    R, T, L = 7.0, 0.5, 6.0
    half = math.asin(L / 2 / R)
    row_h = [0.26, 0.3, 0.27, 0.3, 0.28]
    z = 0.2
    for r, h in enumerate(row_h):
        s = -L / 2 - 0.02
        k = 0
        while s < L / 2 + 0.02:
            ln = rnd.uniform(0.42, 0.95)
            if s + ln > L / 2 + 0.02 or L / 2 - (s + ln) < 0.3:
                ln = L / 2 + 0.02 - s
            mid = s + ln / 2
            a = mid / R
            depth = T + rnd.uniform(-0.04, 0.05)
            bpy.ops.mesh.primitive_cube_add(size=1)
            o = bpy.context.active_object
            o.scale = (ln - 0.025, depth, h - 0.02 + rnd.uniform(-0.015, 0.015))
            bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
            mod = o.modifiers.new("Bevel", "BEVEL")
            mod.width = 0.018
            mod.segments = 2
            # pusat blok di busur: muka depan cekung ke +Y; tengah tebal di belakang (−Y dari muka)
            jit = 0.02 + rnd.uniform(-0.012, 0.012)  # muka maju/mundur sedikit (batu tidak rata)
            nx, ny = -math.sin(a), math.cos(a)        # normal muka depan (ke pusat busur)
            o.location = (R * math.sin(a) - nx * (depth / 2 - jit), R - R * math.cos(a) - ny * (depth / 2 - jit), z + h / 2)
            o.rotation_euler = (0, 0, a)
            _finish(o, f"batu-{r}-{k}", batu[(r * 2 + k + rnd.randrange(3)) % 3])
            s += ln
            k += 1
        z += h
    top = z
    # penutup beton melengkung (potongan busur) + alas
    bm = bmesh.new()
    n = 36
    rings = []
    for i in range(n + 1):
        a = -half + 2 * half * i / n
        cs, sn = math.cos(a), math.sin(a)
        f = (R * sn, R - R * cs)
        b = ((R + T + 0.12) * sn, R - (R + T + 0.12) * cs)
        f2 = ((R - 0.1) * sn, R - (R - 0.1) * cs)
        rings.append([bm.verts.new((f2[0], f2[1], top)), bm.verts.new((f2[0], f2[1], top + 0.1)), bm.verts.new((b[0], b[1], top + 0.1)), bm.verts.new((b[0], b[1], top))])
    for i in range(n):
        a, b = rings[i], rings[i + 1]
        for k in range(4):
            bm.faces.new((a[k], b[k], b[(k + 1) % 4], a[(k + 1) % 4]))
    bm.faces.new(rings[0][::-1])
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    _mesh_object("penutup", bm, beton)
    box("alas", (L + 0.5, 1.5, 0.2), (0, -0.05, 0.1), beton, bevel=0.015)
    teks, jarak = "UNIVERSITAS RIAU", 0.345
    ch_i = [i for i, c in enumerate(teks) if c != " "]
    for i in ch_i:
        a = -(i - (len(teks) - 1) / 2) * jarak / R  # pemirsa di +Y menghadap -Y: kanan = -X
        # tegak pada busur muka batu: titik muka + sedikit ke depan
        nx, ny = -math.sin(a), math.cos(a)
        _text(f"huruf-{i}", teks[i], 0.4, 0.035, 0.005, kuningan,
              (R * math.sin(a) + nx * 0.075, R - R * math.cos(a) + ny * 0.075, 0.98), (PI / 2, 0.0, PI + a))
    return "UNRI_N01"


# ---------------- N02 huruf nama Rektorat ----------------

def n02_huruf_rektorat():
    """18 × 0,3 × 1,5 m: huruf timbul berpelat bayang, emisif (menyala malam), menghadap +Y."""
    emas = material("unri:huruf-rektorat-emisif", (0.86, 0.72, 0.34), rough=0.38, metal=0.7, emission=(1.0, 0.88, 0.69))
    rel = material("unri:rel-gelap", (0.12, 0.13, 0.15), rough=0.6)
    o = _text("teks", "UNIVERSITAS RIAU", 2.0, 0.12, 0.012, emas, (0, -0.04, 0), (PI / 2, 0.0, PI), align_y="BOTTOM_BASELINE")
    bpy.context.view_layer.update()
    w, h = o.dimensions.x, o.dimensions.z if o.dimensions.z > 0.05 else o.dimensions.y
    o.scale = (18.0 / w, 18.0 / w, 18.0 / w)
    bpy.context.view_layer.update()
    # rel penopang tipis di belakang huruf
    box("rel-atas", (17.6, 0.06, 0.05), (0, -0.2, 1.25), rel)
    box("rel-bawah", (17.6, 0.06, 0.05), (0, -0.2, 0.18), rel)
    return "UNRI_N02"


# ---------------- N03 kanopi merah ----------------

def n03_kanopi():
    """9,6 × 9,3 × ±5 m: 4 tiang putih berpangkal & berkepala, lisplang, plafon emisif, balok, atap limas
    melengkung (cekung di lereng, sudut sedikit terangkat — netral, bukan selembayung) dengan genteng bergaris."""
    putih = material("unri:kolom-putih", (0.93, 0.92, 0.9), rough=0.7)
    merah = material("unri:genteng-merah", (0.5, 0.06, 0.06), rough=0.62)
    gelap = material("unri:rusuk-merah", (0.3, 0.05, 0.05), rough=0.7)
    plafon = material("unri:plafon-emisif", (0.95, 0.93, 0.88), rough=0.8, emission=(1.0, 0.92, 0.78))
    emas = material("unri:puncak-emas", (0.83, 0.65, 0.23), rough=0.3, metal=0.85)
    EAVE, LIS, W, D = 3.3, 0.45, 9.6, 9.3
    for (x, y) in [(-3.8, -3.7), (-3.8, 3.7), (3.9, -3.7), (3.9, 3.7)]:
        cyl(f"tiang-{x}-{y}", 0.225, EAVE - 0.5, (x, y, 0.25 + (EAVE - 0.5) / 2), putih, verts=20)
        box(f"pangkal-{x}-{y}", (0.6, 0.6, 0.25), (x, y, 0.125), putih, bevel=0.02)
        box(f"kepala-{x}-{y}", (0.55, 0.55, 0.22), (x, y, EAVE - 0.11), putih, bevel=0.02)
        cyl(f"cincin-{x}-{y}", 0.27, 0.07, (x, y, EAVE - 0.28), putih, verts=20)
    box("lis-barat", (0.25, D, LIS), (-W / 2 + 0.125, 0, EAVE + LIS / 2), putih, bevel=0.01)
    box("lis-timur", (0.25, D, LIS), (W / 2 - 0.125, 0, EAVE + LIS / 2), putih, bevel=0.01)
    box("lis-selatan", (W, 0.25, LIS), (0, -D / 2 + 0.125, EAVE + LIS / 2), putih, bevel=0.01)
    box("lis-utara", (W, 0.25, LIS), (0, D / 2 - 0.125, EAVE + LIS / 2), putih, bevel=0.01)
    for i, x in enumerate((-3.8, 3.9)):
        box(f"balok-{i}", (0.3, D - 0.6, 0.28), (x, 0, EAVE - 0.14), putih, bevel=0.01)
    bm = bmesh.new()
    pw, pd, z = (W - 0.5) / 2, (D - 0.5) / 2, EAVE + 0.02
    bm.faces.new([bm.verts.new(p) for p in [(-pw, -pd, z), (-pw, pd, z), (pw, pd, z), (pw, -pd, z)]])
    _mesh_object("plafon", bm, plafon)
    # atap: grid polar-persegi, tinggi menurut profil cekung; sudut sedikit terangkat
    RW, RD, H = W + 0.7, D + 0.7, 1.7
    nx, nz = 18, 18
    bm = bmesh.new()
    grid = []
    for i in range(nx + 1):
        col = []
        for j in range(nz + 1):
            u = i / nx * 2 - 1
            v = j / nz * 2 - 1
            m = max(abs(u), abs(v))                      # 0 puncak … 1 tepi
            prof = H * (1 - m) ** 1.55                   # cekung (lereng melandai ke tepi)
            lift = 0.28 * (abs(u) * abs(v)) ** 2.2       # sudut terangkat halus
            col.append(bm.verts.new((u * RW / 2, v * RD / 2, EAVE + LIS - 0.02 + prof + lift)))
        grid.append(col)
    for i in range(nx):
        for j in range(nz):
            bm.faces.new((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = _mesh_object("atap", bm, merah)
    sol = ob.modifiers.new("Tebal", "SOLIDIFY")
    sol.thickness = 0.05
    # rusuk genteng: garis sejajar tepi (batang tipis mengikuti profil) di tiap lereng
    for side in range(4):
        for k in range(1, 9):
            t = k / 9.0
            m = 1 - t
            hh = H * m ** 1.55
            half_x = RW / 2 * t
            half_z = RD / 2 * t
            ln = (RW if side % 2 == 0 else RD) * t
            y = hh + EAVE + LIS - 0.02 + 0.045
            if side == 0:
                box(f"rusuk-{side}-{k}", (ln * 0.98, 0.07, 0.04), (0, -half_z, y), gelap)
            elif side == 1:
                box(f"rusuk-{side}-{k}", (ln * 0.98, 0.07, 0.04), (0, half_z, y), gelap)
            elif side == 2:
                box(f"rusuk-{side}-{k}", (0.07, ln * 0.98, 0.04), (-half_x, 0, y), gelap)
            else:
                box(f"rusuk-{side}-{k}", (0.07, ln * 0.98, 0.04), (half_x, 0, y), gelap)
    # rusuk sudut (4 hip) mengikuti permukaan atap (rantai segmen), + puncak
    def _surf(u, v):
        m = max(abs(u), abs(v))
        return Vector((u * RW / 2, v * RD / 2, EAVE + LIS - 0.02 + H * (1 - m) ** 1.55 + 0.28 * (abs(u) * abs(v)) ** 2.2 + 0.03))

    steps = 10
    for (sx, sz) in [(-1, -1), (-1, 1), (1, -1), (1, 1)]:
        for k in range(steps):
            a = _surf(sx * (1 - k / steps), sz * (1 - k / steps))
            b = _surf(sx * (1 - (k + 1) / steps), sz * (1 - (k + 1) / steps))
            d = a - b
            o = cyl(f"hip-{sx}-{sz}-{k}", 0.06, d.length, (a + b) / 2, gelap, verts=8)
            o.rotation_mode = "QUATERNION"
            o.rotation_quaternion = d.to_track_quat("Z", "Y")
    cyl("puncak-leher", 0.1, 0.5, (0, 0, EAVE + LIS + H + 0.2), emas, r2=0.05, verts=12)
    sphere("puncak-bola", 0.14, (0, 0, EAVE + LIS + H + 0.55), emas)
    cyl("puncak-ujung", 0.05, 0.35, (0, 0, EAVE + LIS + H + 0.85), emas, r2=0.01, verts=8)
    return "UNRI_N03"


# ---------------- N04 kubah mozaik ----------------

def _mozaik_image():
    img = bpy.data.images.get("N04_mozaik") or bpy.data.images.new("N04_mozaik", 256, 256)
    UNGU, PUTIH, BIRU, NAT = (0.36, 0.30, 0.62), (0.95, 0.95, 0.97), (0.25, 0.39, 0.66), (0.55, 0.55, 0.60)
    px = []
    for j in range(256):
        for i in range(256):
            d = abs((i + 0.5) / 256 - 0.5) + abs((j + 0.5) / 256 - 0.5)
            c = NAT if abs(d - 0.5) < 0.025 or abs(d - 0.28) < 0.012 else (UNGU if d < 0.28 else (PUTIH if d < 0.5 else BIRU))
            px.extend((c[0], c[1], c[2], 1.0))
    img.pixels = px
    try:
        img.pack()
    except RuntimeError:
        pass
    return img


def n04_kubah():
    """Ø 10 × 8 m: kubah runcing berdiameter 10 m (profil beku = masjidArfaunnas.js), mozaik wajik 20 × 5, cincin
    dasar oker, mahkota emas (leher, dua bola, bulan sabit 1,45π menghadap atas)."""
    mozaik = material("unri:kubah-mozaik", (1.0, 1.0, 1.0), rough=0.32, metal=0.1)
    tn = mozaik.node_tree.nodes.new("ShaderNodeTexImage")
    tn.image = _mozaik_image()
    bsdf = next(n for n in mozaik.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    mozaik.node_tree.links.new(tn.outputs["Color"], bsdf.inputs["Base Color"])
    oker = material("unri:cincin-oker", (0.78, 0.59, 0.18), rough=0.5, metal=0.3)
    emas = material("unri:mahkota-emas", (0.83, 0.65, 0.23), rough=0.3, metal=0.85)
    PROF = [(5.0, 0.0), (4.95, 0.9), (4.75, 1.8), (4.35, 2.7), (3.7, 3.6), (2.85, 4.4), (1.8, 5.1), (0.8, 5.6), (0.0, 5.9)]
    SEG = 40
    bm = bmesh.new()
    grid = [[bm.verts.new((r * math.cos(2 * PI * s / SEG), r * math.sin(2 * PI * s / SEG), z)) for (r, z) in PROF] for s in range(SEG)]
    uv = bm.loops.layers.uv.new("UVMap")
    for s in range(SEG):
        a, b = grid[s], grid[(s + 1) % SEG]
        for k in range(len(PROF) - 1):
            f = bm.faces.new((a[k], b[k], b[k + 1], a[k + 1]))
            for loop in f.loops:
                col_i = s + (1 if loop.vert in (b[k], b[k + 1]) else 0)
                row = k + (1 if loop.vert in (a[k + 1], b[k + 1]) else 0)
                loop[uv].uv = (col_i / SEG * 20.0, row / (len(PROF) - 1) * 5.0)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    _mesh_object("kubah", bm, mozaik)
    torus("cincin-dasar", 5.0, 0.12, (0, 0, 0.05), oker)
    torus("cincin-tengah", 4.72, 0.06, (0, 0, 1.85), oker)
    TOP = 5.9
    cyl("leher", 0.22, 0.9, (0, 0, TOP + 0.4), emas, r2=0.16, verts=12)
    sphere("bola-besar", 0.32, (0, 0, TOP + 1.1), emas)
    sphere("bola-kecil", 0.24, (0, 0, TOP + 1.55), emas)
    RM, RT, NM, NT, ARC = 0.55, 0.08, 28, 8, PI * 1.45
    start = PI / 2 + (2 * PI - ARC) / 2
    bm = bmesh.new()
    rings = []
    for i in range(NM + 1):
        t = start + ARC * i / NM
        ring = []
        for j in range(NT):
            p = 2 * PI * j / NT
            rr = RM + RT * math.cos(p)
            ring.append(bm.verts.new((rr * math.cos(t), RT * math.sin(p), TOP + 2.3 + rr * math.sin(t))))
        rings.append(ring)
    for i in range(NM):
        for j in range(NT):
            bm.faces.new((rings[i][j], rings[i + 1][j], rings[i + 1][(j + 1) % NT], rings[i][(j + 1) % NT]))
    bm.faces.new(rings[0][::-1])
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    _mesh_object("bulan-sabit", bm, emas)
    return "UNRI_N04"


BUILDERS = {
    "n01-papan-batu-unri": n01_papan_batu,
    "n02-huruf-nama-rektorat": n02_huruf_rektorat,
    "n03-kanopi-merah-rektorat": n03_kanopi,
    "n04-kubah-mozaik": n04_kubah,
}


def _preview(coll_name, path, eye, look):
    """Render pratinjau cepat (Workbench) agar bentuk dapat ditinjau tanpa viewport."""
    sc = bpy.context.scene
    try:
        sc.render.engine = "BLENDER_WORKBENCH"
    except TypeError:
        pass
    sc.render.resolution_x, sc.render.resolution_y = 900, 600
    sc.display.shading.light = "STUDIO"
    sc.display.shading.color_type = "MATERIAL"
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    bpy.context.scene.collection.objects.link(cam)
    cam.location = eye
    direction = Vector(look) - Vector(eye)
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    sc.camera = cam
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam, do_unlink=True)


def build(stem, ratios=None, preview=None):
    """Bangun aset `stem`, ekspor GLB ke public/models/unri/, simpan .blend; kembalikan ringkasan."""
    coll = fresh(f"UNRI_{stem}")
    coll.name = BUILDERS[stem]()
    exporter = runpy.run_path(EXPORT_PY)
    glb = os.path.join(REPO, "public", "models", "unri", f"{stem}.glb")
    meshes, tris, kb = exporter["export_collection"](coll.name, glb, ratios=ratios or {})
    blend = os.path.join(REPO, "assets-src", "blender", "unri", f"{stem}.blend")
    os.makedirs(os.path.dirname(blend), exist_ok=True)
    if preview:
        _preview(coll.name, preview["path"], preview["eye"], preview["look"])
    bpy.ops.wm.save_as_mainfile(filepath=blend)
    return {"aset": stem, "mesh": meshes, "segitiga": tris, "kb": kb, "glb": glb, "blend": blend}


PREVIEWS = {
    "n01-papan-batu-unri": {"eye": (2.5, 9.0, 2.6), "look": (0, 0.0, 0.9)},
    "n02-huruf-nama-rektorat": {"eye": (0, 26, 1.5), "look": (0, 0, 0.75)},
    "n03-kanopi-merah-rektorat": {"eye": (13, 12, 5.5), "look": (0, 0, 2.2)},
    "n04-kubah-mozaik": {"eye": (12, 14, 8), "look": (0, 0, 3.4)},
}

if __name__ == "__main__" or os.environ.get("M6_ASSETS_RUN"):
    import sys

    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out_dir = os.environ.get("M6_PREVIEW_DIR")
    for stem in [s for s in BUILDERS if not argv or s.split("-")[0] in argv or s in argv]:
        pv = None
        if out_dir:
            pv = {"path": os.path.join(out_dir, stem + ".png"), **PREVIEWS[stem]}
        print("M6:", build(stem, preview=pv))
