"""
Masjid Agung An-Nur (Pekanbaru) — landmark hero untuk mode Kota, 3 tingkat LOD → 3 GLB.

Jalankan (Blender headless):
    "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" -b --python-expr "import runpy;print(runpy.run_path(r'<repo>\\assets-src\\blender\\landmark\\an_nur.py')['build']())"

Fakta (OSM way 465323008): jejak ±61 m melintang x 73 m ke arah depan (sumbu panjang 26° dari timur, ke WNW-ESE), 2 lantai, pusat lat 0.5266441 lon 101.4508221.
Fakta (Google Maps/Commons): fasad batu berlengkung, kubah utama toska besar + kubah kecil lebih rendah di depannya,
kubah samping, menara ramping krem; total 10 kubah + 4 menara.
Depan = ke plaza putih luas di timur-tenggara (citra satelit Google Maps).
[INFERENSI] semua ukuran detail (tinggi kubah ±38 m, menara ±54 m, jumlah ceruk, tata letak 1 utama + 1 depan + 4 samping
+ 4 puncak menara = 10 kubah). 
Konvensi: DEPAN = -Y Blender (= +Z three.js), origin di tanah pusat jejak, sumbu Z atas (diekspor Y-atas).
Warna per vertex (tanpa tekstur), datar (low poly). Segitiga: LOD0 ≤ 5 rb, LOD1 ≈ 0,8 rb, LOD2 ≈ 0,2 rb.
"""
import math
import os

import bpy

REPO = r"C:\Users\mocha\Documents\stadion-utama-riau-3d"
OUT_DIR = os.path.join(REPO, "public", "models", "landmark")
OUT_BLEND = os.path.join(REPO, "assets-src", "blender", "landmark", "an_nur.blend")

C = {
    "plinth": "#b9b09a", "wall": "#dcd1b6", "trim": "#c9d1b0", "plaza": "#e7e4d9", "kolam": "#b4b0a0", "frame": "#c9b57a", "dark": "#2a3b3a",
    "dome": "#3aa391", "dome2": "#2f8f80", "drum": "#ece5d2", "gold": "#d8aa2e", "shaft": "#e2d08e",
    "band": "#3a9a88", "roof": "#9d9a92", "step": "#cfc7b2",
}


def lin(hex_):
    h = hex_.lstrip("#")
    out = []
    for i in (0, 2, 4):
        v = int(h[i:i + 2], 16) / 255.0
        out.append(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4)
    return (out[0], out[1], out[2], 1.0)


class Mesh:
    def __init__(self):
        self.v, self.f, self.c = [], [], []

    def _vi(self, p):
        self.v.append(p)
        return len(self.v) - 1

    def poly(self, pts, col):
        idx = [self._vi(p) for p in pts]
        for i in range(1, len(idx) - 1):
            self.f.append((idx[0], idx[i], idx[i + 1]))
            self.c.append(lin(col))

    def box(self, cx, cy, z0, sx, sy, h, col):
        x0, x1, y0, y1, z1 = cx - sx / 2, cx + sx / 2, cy - sy / 2, cy + sy / 2, z0 + h
        self.poly([(x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)], col)
        self.poly([(x0, y1, z0), (x0, y0, z0), (x0, y0, z1), (x0, y1, z1)], col)
        self.poly([(x1, y1, z0), (x0, y1, z0), (x0, y1, z1), (x1, y1, z1)], col)
        self.poly([(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)], col)
        self.poly([(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], col)

    def revolve(self, cx, cy, z0, profile, seg, col, col2=None, cap_top=False):
        """profile: [(r, dz)] naik; col2 = warna segmen selang-seling (rusuk kubah)."""
        for j in range(len(profile) - 1):
            (r0, d0), (r1, d1) = profile[j], profile[j + 1]
            for i in range(seg):
                a0, a1 = 2 * math.pi * i / seg, 2 * math.pi * (i + 1) / seg
                c = col2 if (col2 and i % 2) else col
                p00 = (cx + r0 * math.cos(a0), cy + r0 * math.sin(a0), z0 + d0)
                p10 = (cx + r0 * math.cos(a1), cy + r0 * math.sin(a1), z0 + d0)
                p11 = (cx + r1 * math.cos(a1), cy + r1 * math.sin(a1), z0 + d1)
                p01 = (cx + r1 * math.cos(a0), cy + r1 * math.sin(a0), z0 + d1)
                if r1 <= 1e-6:
                    self.poly([p00, p10, (cx, cy, z0 + d1)], c)
                else:
                    self.poly([p00, p10, p11, p01], c)
        if cap_top:
            r, d = profile[-1]
            for i in range(seg):
                a0, a1 = 2 * math.pi * i / seg, 2 * math.pi * (i + 1) / seg
                self.poly([(cx, cy, z0 + d), (cx + r * math.cos(a0), cy + r * math.sin(a0), z0 + d),
                           (cx + r * math.cos(a1), cy + r * math.sin(a1), z0 + d)], col)

    def arch(self, nx, ny, px, py, zb, w, zs, col, arcseg=5, off=0.05, rect_only=False):
        """Panel datar pada dinding berarah normal (nx,ny): bawah di zb, lengkung di atas zs. (px,py) = pusat bawah."""
        ux, uy = -ny, nx
        pts = [(-w / 2, zb), (w / 2, zb), (w / 2, zs)]
        if rect_only:
            pts.append((-w / 2, zs))
        else:
            for k in range(1, arcseg):
                t = math.pi * k / arcseg
                pts.append(((w / 2) * math.cos(t), zs + (w / 2) * math.sin(t)))
            pts.append((-w / 2, zs))
        self.poly([(px + ux * u + nx * off, py + uy * u + ny * off, z) for u, z in pts], col)

    def to_object(self, name):
        me = bpy.data.meshes.new(name)
        me.from_pydata(self.v, [], self.f)
        me.update()
        attr = me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
        for pi, poly in enumerate(me.polygons):
            col = self.c[pi]
            for li in poly.loop_indices:
                attr.data[li].color = col
        for p in me.polygons:
            p.use_smooth = False
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        return ob


ONION = [(0.92, 0.0), (1.0, 0.10), (1.02, 0.22), (0.95, 0.38), (0.80, 0.55), (0.58, 0.72), (0.32, 0.87), (0.12, 0.96), (0.0, 1.0)]


def dome(m, cx, cy, z0, R, H, seg, rings, col=C["dome"], col2=C["dome2"]):
    prof = ONION if rings >= 8 else [ONION[0], ONION[2], ONION[4], ONION[6], ONION[8]] if rings >= 5 else [ONION[0], ONION[3], ONION[6], ONION[8]]
    m.revolve(cx, cy, z0, [(R * r, H * z) for r, z in prof], seg, col, col2)


def finial(m, cx, cy, z0, s, seg):
    m.revolve(cx, cy, z0, [(0.5 * s, 0), (0.35 * s, 0.5 * s), (0.6 * s, 0.9 * s), (0.2 * s, 2.0 * s), (0, 3.2 * s)], seg, C["gold"])


def minaret(m, cx, cy, lod):
    seg = 8 if lod == 0 else 6 if lod == 1 else 4
    m.box(cx, cy, 0.0, 4.4, 4.4, 7.0, C["trim"]) if lod < 2 else None
    z = 7.0 if lod < 2 else 1.2
    m.revolve(cx, cy, z, [(2.0, 0), (2.0, 35 - z)], seg, C["shaft"], cap_top=False)
    if lod < 2:
        m.revolve(cx, cy, 35, [(3.1, 0), (3.1, 1.2), (2.2, 1.2)], seg, C["band"], cap_top=True)
        m.revolve(cx, cy, 36.2, [(1.5, 0), (1.5, 9.8)], seg, C["shaft"])
        m.revolve(cx, cy, 46, [(2.0, 0), (2.0, 0.6)], seg, C["band"], cap_top=True)
        dome(m, cx, cy, 46.6, 2.0, 3.6, seg * 2 if lod == 0 else seg, 5 if lod == 0 else 3)
        finial(m, cx, cy, 50.2, 0.9, 6 if lod == 0 else 4)
    else:
        m.revolve(cx, cy, 35, [(2.0, 0), (1.2, 11), (0, 19)], seg, C["dome"])


def build_lod(lod):
    m = Mesh()
    BX, BY = 54.0, 65.0      # badan utama (melintang x depan-belakang y)
    PX, PY = 61.0, 73.0      # alas (plinth): 61 m melintang x 73 m ke arah depan (OSM, sumbu pendek = lebar fasad)
    Z0, ZT = 1.2, 14.5       # lantai badan & atap datar
    m.box(0, 0, 0, PX, PY, Z0, C["plinth"])
    # plaza putih di depan (citra satelit: ±120 m lebar x ±110 m, 4 kolam bintang 2x2)
    m.box(0, -PY / 2 - 55.0, 0, 120.0, 110.0, 0.12, C["plaza"])
    if lod < 2:
        for px in (-28.0, 28.0):
            for py in (-PY / 2 - 28.0, -PY / 2 - 82.0):
                m.revolve(px, py, 0.12, [(9.0, 0), (9.0, 0.1)], 8, C["kolam"], cap_top=True)
    m.box(0, 0, Z0, BX, BY, ZT - Z0 - 1.0, C["wall"])
    m.box(0, 0, ZT - 1.0, BX + 1.0, BY + 1.0, 1.0, C["trim"])
    # tangga depan
    steps = 4 if lod == 0 else 2 if lod == 1 else 1
    for k in range(steps):
        m.box(0, -PY / 2 - 1.2 - k * 1.4, 0, 22 - k * 1.0, 2.8, 0.3 * (steps - k) if lod else 0.3 * (4 - k), C["step"])
    # portiko depan
    m.box(0, -BY / 2 - 2.5, Z0, 22, 5, 17 - Z0, C["wall"])
    m.box(0, -BY / 2 - 2.5, 17, 23, 5.6, 1.0, C["trim"])
    # ceruk lengkung & jendela
    if lod == 0:
        pw = 3.4
        for side, (nx, ny) in enumerate([(0, -1), (0, 1), (-1, 0), (1, 0)]):
            length = BX if ny else BY
            n = int(length / 5.4)
            gap = length / (n + 1)
            for i in range(n):
                u = -length / 2 + gap * (i + 1)
                px, py = (u, ny * BY / 2) if ny else (nx * BX / 2, u)
                if side == 0 and abs(u) < 14:
                    continue  # tertutup portiko
                m.arch(nx, ny, px, py, 2.4, pw + 0.7, 6.4, C["frame"], off=0.04)
                m.arch(nx, ny, px, py, 2.5, pw, 6.4, C["dark"], off=0.08)
                m.arch(nx, ny, px, py, 9.2, 2.4, 12.2, C["frame"], off=0.04, rect_only=True)
                m.arch(nx, ny, px, py, 9.4, 1.9, 12.0, C["dark"], off=0.08, rect_only=True)
        # lengkung besar portiko
        m.arch(0, -1, 0, -BY / 2 - 5.0, 2.4, 10.0, 11.0, C["frame"], arcseg=8, off=0.04)
        m.arch(0, -1, 0, -BY / 2 - 5.0, 2.5, 9.0, 11.0, C["dark"], arcseg=8, off=0.08)
    elif lod == 1:
        for nx, ny in [(0, -1), (0, 1), (-1, 0), (1, 0)]:
            length = BX if ny else BY
            px, py = (0, ny * BY / 2) if ny else (nx * BX / 2, 0)
            m.arch(nx, ny, px, py, 2.4, length - 12, 8.5, C["dark"], off=0.05, rect_only=True)
    # atap datar
    m.box(0, 0, ZT, BX - 1.0, BY - 1.0, 0.15, C["roof"]) if lod < 2 else None
    # kubah utama
    seg_main = 24 if lod == 0 else 12 if lod == 1 else 8
    rings = 8 if lod == 0 else 5 if lod == 1 else 3
    if lod < 2:
        m.revolve(0, 0, ZT, [(12.5, 0), (12.5, 7.5)], 16 if lod == 0 else 10, C["drum"], cap_top=False)
        if lod == 0:
            for k in range(12):
                a = 2 * math.pi * (k + 0.5) / 12
                m.arch(math.cos(a), math.sin(a), 12.5 * math.cos(a), 12.5 * math.sin(a), ZT + 2.0, 1.8, ZT + 5.0, C["dark"], arcseg=3, off=0.05)
        dome(m, 0, 0, ZT + 7.5, 13.5, 16.0, seg_main, rings)
        finial(m, 0, 0, ZT + 23.5, 1.4, 8 if lod == 0 else 5)
    else:
        dome(m, 0, 0, ZT, 13.5, 23.5, seg_main, rings)
    # kubah kecil depan (di atap, dekat portiko)
    ds = 16 if lod == 0 else 8 if lod == 1 else 6
    dome(m, 0, -20.0, ZT, 6.5, 8.0, ds, 5 if lod == 0 else 3 if lod < 2 else 3)
    # 4 kubah samping
    for sx in (-1, 1):
        for sy in (-1, 1):
            cx, cy = sx * 17.0, sy * 17.0
            if lod < 2:
                m.revolve(cx, cy, ZT, [(5.2, 0), (5.2, 4.0)], 12 if lod == 0 else 8, C["drum"])
                dome(m, cx, cy, ZT + 4.0, 6.0, 7.5, 16 if lod == 0 else 8, 5 if lod == 0 else 3)
            else:
                dome(m, cx, cy, ZT, 6.0, 11.0, 6, 3)
            minaret(m, sx * (PX / 2 - 1.5), sy * (PY / 2 - 1.5), lod)
    return m


def _material():
    mat = bpy.data.materials.get("annur:warna") or bpy.data.materials.new("annur:warna")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    vc = next((n for n in nt.nodes if n.type == "VERTEX_COLOR"), None) or nt.nodes.new("ShaderNodeVertexColor")
    vc.layer_name = "Col"
    nt.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.9
    return mat


def build():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    os.makedirs(OUT_DIR, exist_ok=True)
    mat = _material()
    res = {}
    for lod in (0, 1, 2):
        ob = build_lod(lod).to_object(f"AnNur_LOD{lod}")
        ob.data.materials.append(mat)
        ob.data.calc_loop_triangles()
        tris = len(ob.data.loop_triangles)
        bpy.ops.object.select_all(action="DESELECT")
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        path = os.path.join(OUT_DIR, f"an-nur-lod{lod}.glb")
        kw = dict(filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_yup=True)
        try:
            bpy.ops.export_scene.gltf(export_vertex_color="ACTIVE", **kw)
        except TypeError:
            bpy.ops.export_scene.gltf(**kw)
        res[lod] = (tris, round(os.path.getsize(path) / 1024, 1))
        ob.hide_set(True)
    for o in bpy.data.objects:
        o.hide_set(False)
    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
    return res
