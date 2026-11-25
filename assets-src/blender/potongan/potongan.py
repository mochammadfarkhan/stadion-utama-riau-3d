"""
Kotak potongan (modular kit) untuk landmark Kota: tiap potongan = SATU GLB kecil di public/models/potongan/<nama>.glb.
Disusun di game menurut daftar di src/city/parts.data.js (lihat docs/model/POTONGAN.md).

Jalankan (Blender headless), semua atau sebagian:
    "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" -b --python-expr "import runpy;print(runpy.run_path(r'<repo>\\assets-src\\blender\\potongan\\potongan.py')['build']())"
    ... ['build'](only=['ac', 'pohon'])

Konvensi tiap potongan: alas di z=0 (tanah/atap tempat ia berdiri), titik asal di tengah alas, DEPAN = -Y Blender
(= +Z three.js), satuan meter, warna per vertex datar, satu mesh. Bentuk mengikuti gambar rujukan Google Flow
(renders/ska-sebelum/rujukan-flow-mal-ska.png, renders/peta-gambar/hasil-flow-an-nur-v1.png).
Potongan boleh diganti berkas GLB dari sumber lain (Blender tangan, pustaka CC0) asal konvensinya sama.
"""
import math
import os
import runpy

import bpy

HERE = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else r"C:\Users\mocha\Documents\stadion-utama-riau-3d\assets-src\blender\potongan"
_C = runpy.run_path(os.path.join(HERE, "..", "landmark", "lm_common.py"))
Mesh, material, REPO = _C["Mesh"], _C["material"], _C["REPO"]
OUT_DIR = os.path.join(REPO, "public", "models", "potongan")

KACA = "#1c2a3a"      # gelap (< 0,05 luminans): shader landmark menjadikannya kaca biru siang & jendela menyala malam
PUTIH, KREM, ABU, ABU_TUA = "#f1f3f6", "#e9e2d0", "#b9bcc0", "#6f747a"
HIJAU, HIJAU_TUA, BATANG = "#3f8f3a", "#2c6e2c", "#5a3d24"


def p_ac():
    """Unit AC atap: badan, kisi samping, rumah kipas bundar, kaki."""
    m = Mesh()
    for sx in (-1.3, 1.3):
        for sy in (-0.8, 0.8):
            m.box(sx, sy, 0.0, 0.25, 0.25, 0.35, ABU_TUA)
    m.box(0, 0, 0.35, 3.6, 2.4, 1.5, ABU)
    m.box(0, -1.22, 0.6, 3.0, 0.06, 0.9, ABU_TUA)          # kisi depan
    m.box(0, 1.22, 0.6, 3.0, 0.06, 0.9, ABU_TUA)
    for cx in (-0.9, 0.9):
        m.revolve(cx, 0, 1.85, [(0.72, 0), (0.72, 0.28)], 8, ABU_TUA, cap_top=True)
        m.revolve(cx, 0, 2.13, [(0.5, 0), (0.5, 0.05)], 8, "#3a3f45", cap_top=True)
    return m


def p_pohon():
    """Pohon peneduh rimbun: batang + tajuk 4 gumpal dua nada (±7,5 m, lebar ±6 m)."""
    m = Mesh()
    m.revolve(0, 0, 0, [(0.28, 0), (0.2, 2.6)], 5, BATANG)
    for cx, cy, z, r, h in ((0, 0, 2.3, 3.1, 5.2), (1.9, 0.7, 2.1, 2.2, 3.8), (-1.6, -1.0, 2.2, 2.1, 3.6), (0.2, 1.6, 2.4, 1.8, 3.2)):
        m.revolve(cx, cy, z, [(0.0, 0), (r * 0.8, h * 0.22), (r, h * 0.5), (r * 0.7, h * 0.8), (0.0, h)], 6, HIJAU, HIJAU_TUA)
    return m


def p_palem():
    """Palem raja: batang ramping 8 m + 7 pelepah melengkung (dari gambar rujukan Flow)."""
    m = Mesh()
    m.revolve(0, 0, 0, [(0.32, 0), (0.22, 3.0), (0.2, 8.0)], 5, "#8a7a62")
    for k in range(7):
        a = 2 * math.pi * k / 7
        c, s = math.cos(a), math.sin(a)
        m.prism((0, 0, 8.0), (c * 1.8, s * 1.8, 8.9), 0.9, HIJAU, wz=0.12)
        m.prism((c * 1.8, s * 1.8, 8.9), (c * 3.4, s * 3.4, 7.9), 0.7, HIJAU_TUA, wz=0.12)
    m.revolve(0, 0, 7.7, [(0.45, 0), (0.3, 0.6)], 5, HIJAU_TUA, cap_top=True)
    return m


def p_lampu():
    """Lampu jalan/parkir: alas, tiang 7 m, lengan, kepala lampu (krem terang)."""
    m = Mesh()
    m.box(0, 0, 0, 0.5, 0.5, 0.4, ABU_TUA)
    m.revolve(0, 0, 0.4, [(0.11, 0), (0.08, 6.6)], 5, "#4a4f57")
    m.prism((0, 0, 6.9), (0, -1.5, 7.15), 0.12, "#4a4f57")
    m.box(0, -1.6, 7.0, 0.5, 0.9, 0.16, "#f6f0d8")
    return m


def p_pot():
    """Pot tanaman panjang: bak batu + tiga gumpal semak + bunga kecil."""
    m = Mesh()
    m.box(0, 0, 0, 6.0, 2.2, 0.6, "#cfc7b2")
    m.box(0, 0, 0.6, 5.5, 1.7, 0.08, "#4d3a28")
    for cx, r, h in ((-1.8, 0.95, 1.1), (0.0, 1.1, 1.3), (1.8, 0.9, 1.0)):
        m.revolve(cx, 0, 0.6, [(r, 0), (r * 0.9, h * 0.5), (r * 0.5, h * 0.85), (0.0, h)], 6, HIJAU, HIJAU_TUA)
    for cx, col in ((-0.9, "#e3c341"), (0.9, "#d95a4a")):
        m.box(cx, -0.55, 0.68, 0.3, 0.3, 0.25, col)
    return m


def p_kanopi():
    """Kanopi pintu masuk kaca 14 x 6 m: 4 tiang, rangka putih, kaca biru berusuk, lis depan."""
    m = Mesh()
    for sx in (-6.3, 6.3):
        for sy in (-5.4, -0.6):
            m.revolve(sx, sy, 0, [(0.28, 0), (0.28, 4.6)], 6, PUTIH)
    m.box(0, -3.0, 4.6, 14.0, 6.0, 0.3, PUTIH)             # rangka
    m.box(0, -3.0, 4.9, 13.4, 5.4, 0.08, "#4f9fd6")        # kaca (biru: bukan "jendela gelap", tidak menyala malam)
    for i in range(6):
        x = -6.7 + 13.4 * i / 5
        m.box(x, -3.0, 4.98, 0.14, 5.4, 0.1, PUTIH)        # rusuk
    m.box(0, -6.0, 4.3, 14.2, 0.2, 0.9, "#1f6feb")         # lis depan (tempat nama)
    return m


def p_pintu():
    """Pintu masuk kaca 6 x 4 m menempel dinding (punggung di y=0): kusen krem, 2 daun + sisi tetap, kaca atas, anak tangga."""
    m = Mesh()
    m.box(0, -1.2, 0, 7.4, 2.4, 0.18, "#cfc7b2")           # bordes
    m.box(0, -2.7, 0, 7.4, 0.6, 0.09, "#cfc7b2")
    m.box(0, -0.2, 0.18, 6.4, 0.4, 4.2, KREM)              # kusen
    for x0, w in ((-2.25, 1.3), (-0.72, 1.36), (0.72, 1.36), (2.25, 1.3)):
        m.box(x0, -0.43, 0.3, w, 0.06, 2.7, KACA)          # daun/sisi kaca
    m.box(0, -0.43, 3.15, 5.8, 0.06, 0.95, KACA)           # kaca atas
    for x in (-0.72 - 0.25, 0.72 + 0.25 - 0.5):
        m.box(x + 0.25, -0.5, 1.2, 0.06, 0.08, 0.9, "#d8aa2e")   # gagang
    return m


def p_jendela():
    """Jendela 2,4 x 1,8 m menempel dinding (punggung di y=0, alas z=0 = ambang bawah): bingkai menonjol, ambang, kaca 2 daun."""
    m = Mesh()
    m.box(0, -0.12, 0.0, 2.6, 0.24, 2.0, PUTIH)            # bingkai
    m.box(0, -0.2, -0.14, 2.9, 0.4, 0.14, KREM)            # ambang
    for x in (-0.6, 0.6):
        m.box(x, -0.26, 0.14, 1.08, 0.05, 1.72, KACA)
    return m


def _arch(m, y, zb, w, zs, col, seg=6, rise=None):
    """Panel lengkung tegak menghadap -Y di bidang y: alas zb, mulai lengkung zs (setengah lingkaran, atau runcing bila rise)."""
    pts = [(-w / 2, zb), (w / 2, zb), (w / 2, zs)]
    for k in range(1, seg):
        if rise:
            u = 1 - 2 * k / seg
            pts.append(((w / 2) * u, zs + rise * (1 - abs(u)) ** 0.6))
        else:
            t = math.pi * k / seg
            pts.append(((w / 2) * math.cos(t), zs + (w / 2) * math.sin(t)))
    pts.append((-w / 2, zs))
    m.poly([(x, y, z) for x, z in pts], col)


def p_jendela_lengkung():
    """Jendela lengkung masjid 3,4 m (punggung di y=0, alas z=0): kusen emas berelief, kaca gelap, tiang tengah, ambang."""
    m = Mesh()
    for sx in (-1.9, 1.9):
        m.box(sx, -0.17, 0.0, 0.42, 0.34, 4.1, "#c9b57a")        # kusen tegak
    _arch(m, -0.34, 3.9, 4.6, 4.0, "#c9b57a", seg=8)              # kepala lengkung (emas)
    _arch(m, -0.36, 0.1, 3.4, 4.0, KACA, seg=8)                   # kaca
    m.box(0, -0.4, 0.1, 0.16, 0.08, 3.9, "#c9b57a")               # tiang tengah
    m.box(0, -0.4, 2.6, 3.4, 0.08, 0.14, "#c9b57a")               # palang
    m.box(0, -0.25, -0.2, 4.7, 0.5, 0.2, "#e9e2d0")               # ambang
    return m


def p_air_mancur():
    """Kolam air mancur segi delapan r 9 m: bibir batu, air, tugu bertingkat, pancuran."""
    m = Mesh()
    m.revolve(0, 0, 0, [(9.0, 0), (9.0, 0.55), (8.3, 0.55), (8.3, 0.3)], 8, "#cfc7b2")
    m.revolve(0, 0, 0.3, [(8.3, 0), (8.3, 0.02)], 8, "#3f9fc8", cap_top=True)       # air
    m.revolve(0, 0, 0.3, [(2.2, 0), (2.2, 0.7), (1.6, 0.7)], 8, "#cfc7b2", cap_top=True)
    m.revolve(0, 0, 1.0, [(0.5, 0), (0.4, 1.6), (1.5, 1.9), (1.5, 2.05)], 8, "#e9e2d0", cap_top=True)
    m.revolve(0, 0, 3.05, [(0.18, 0), (0.1, 1.6), (0.0, 2.2)], 5, "#dff2fb")         # pancuran
    return m


def p_lampu_taman():
    """Lampu taman 4,6 m: alas, tiang, dua bola lampu krem."""
    m = Mesh()
    m.revolve(0, 0, 0, [(0.35, 0), (0.22, 0.5), (0.12, 0.7), (0.09, 4.0)], 6, "#3f4650")
    m.prism((-0.7, 0, 4.0), (0.7, 0, 4.0), 0.1, "#3f4650")
    for sx in (-0.7, 0.7):
        m.revolve(sx, 0, 4.0, [(0.0, 0), (0.3, 0.2), (0.3, 0.5), (0.0, 0.7)], 6, "#f6f0d8")
    return m


PARTS = {"ac": p_ac, "pohon": p_pohon, "palem": p_palem, "lampu": p_lampu, "pot": p_pot, "kanopi": p_kanopi, "pintu": p_pintu, "jendela": p_jendela,
         "jendela-lengkung": p_jendela_lengkung, "air-mancur": p_air_mancur, "lampu-taman": p_lampu_taman}


def build(only=None):
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    os.makedirs(OUT_DIR, exist_ok=True)
    mat = material()
    res = {}
    for name, fn in PARTS.items():
        if only and name not in only:
            continue
        ob = fn().to_object(f"potongan_{name}")
        ob.data.materials.append(mat)
        ob.data.calc_loop_triangles()
        bpy.ops.object.select_all(action="DESELECT")
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        path = os.path.join(OUT_DIR, f"{name}.glb")
        kw = dict(filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_yup=True)
        try:
            bpy.ops.export_scene.gltf(export_vertex_color="ACTIVE", **kw)
        except TypeError:
            bpy.ops.export_scene.gltf(**kw)
        res[name] = (len(ob.data.loop_triangles), round(os.path.getsize(path) / 1024, 1))
        ob.hide_set(True)
    return res
