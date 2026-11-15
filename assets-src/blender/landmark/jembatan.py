"""
Jembatan Siak (Pekanbaru) — 3 jembatan x 3 tingkat LOD → 9 GLB (mode Kota).

Jalankan (Blender headless):
    "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" -b --python-expr "import runpy;print(runpy.run_path(r'<repo>\\assets-src\\blender\\landmark\\jembatan.py')['build']())"

Fakta (OSM): garis geladak dari way bertag bridge — Siak I `71286129` (balok, 402 m), Siak III `465906574`+`1529638955`+`1529638956`
(rangka/busur, ±372 m), Siak IV = Jl. Jenderal Sudirman `313965178`/`38659704` (±830 m, dua jalur, sumbu = tengah keduanya).
Fakta (foto Wikimedia Commons, 2021): Siak I = jembatan balok datar berpagar kuning; Siak III = busur baja oranye yang miring ke
dalam, dua palang silang, penggantung vertikal, pagar biru; Siak IV = jembatan kabel, pilon beton putih berbentuk A, kabel kuning.
Letak sungai: garis tengah `public/far/rivers.bin` memotong geladak di s = 241 m (Siak I), 279 m (Siak III), 454 m (Siak IV).
[INFERENSI] lebar geladak (Siak I 12, Siak III 16, Siak IV 18,5 dari sumber), tinggi busur 26 m, tinggi pilon 62 m, jarak pilar.

Koordinat model = dunia: Blender x = +X timur, Blender y = -Z dunia (selatan = -Y), z atas; origin = titik tengah garis.
Karena itu `yaw` di landmarks.js = 0 dan posisi = titik tengah. Permukaan geladak 6 cm di atas jalan agar mobil kota tidak tertutup.
"""
import math
import os

import bpy

REPO = r"C:\Users\mocha\Documents\stadion-utama-riau-3d"
OUT_DIR = os.path.join(REPO, "public", "models", "landmark")
OUT_BLEND = os.path.join(REPO, "assets-src", "blender", "landmark", "jembatan.blend")
DECK_TOP = 0.06

C = {
    "aspal": "#34363b", "beton": "#b9b6ab", "pilar": "#a8a597", "kuning": "#e0b61e", "oranye": "#e8941a", "biru": "#2f86d4",
    "putih": "#d9dad6", "kabel": "#f0c018", "abu": "#a9adb0", "tanda": "#2a2d31",
}


def lin(hex_):
    h = hex_.lstrip("#")
    out = []
    for i in (0, 2, 4):
        v = int(h[i:i + 2], 16) / 255.0
        out.append(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4)
    return (out[0], out[1], out[2], 1.0)


class Path:
    def __init__(self, pts):
        self.pts = pts
        self.cum = [0.0]
        for a, b in zip(pts, pts[1:]):
            self.cum.append(self.cum[-1] + math.dist(a, b))
        self.length = self.cum[-1]

    def frame(self, s):
        s = max(0.0, min(self.length, s))
        for i in range(len(self.pts) - 1):
            if s <= self.cum[i + 1] or i == len(self.pts) - 2:
                a, b = self.pts[i], self.pts[i + 1]
                t = (s - self.cum[i]) / max(1e-9, self.cum[i + 1] - self.cum[i])
                dx, dy = b[0] - a[0], b[1] - a[1]
                L = math.hypot(dx, dy)
                tx, ty = dx / L, dy / L
                return (a[0] + dx * t, a[1] + dy * t, tx, ty)
        raise RuntimeError

    def at(self, s, off, z):
        x, y, tx, ty = self.frame(s)
        return (x - ty * off, y + tx * off, z)  # normal kiri = (-ty, tx)

    def breaks(self, s0, s1, step):
        """Titik bagi s0..s1: tiap `step` dan di tiap sudut garis."""
        ss = {s0, s1}
        n = max(1, int(math.ceil((s1 - s0) / step)))
        for k in range(n + 1):
            ss.add(s0 + (s1 - s0) * k / n)
        for c in self.cum[1:-1]:
            if s0 < c < s1:
                ss.add(c)
        return sorted(ss)


class Mesh:
    def __init__(self):
        self.v, self.f, self.c = [], [], []

    def poly(self, pts, col):
        idx = []
        for p in pts:
            self.v.append(p)
            idx.append(len(self.v) - 1)
        for i in range(1, len(idx) - 1):
            self.f.append((idx[0], idx[i], idx[i + 1]))
            self.c.append(lin(col))

    def strip(self, path, s0, s1, o0, o1, z0, z1, col, step=12.0, caps=True):
        """Balok memanjang mengikuti garis: o0 kanan .. o1 kiri, z0 bawah .. z1 atas."""
        ss = path.breaks(s0, s1, step)
        for a, b in zip(ss, ss[1:]):
            P = lambda s, o, z: path.at(s, o, z)  # noqa: E731
            self.poly([P(a, o0, z1), P(b, o0, z1), P(b, o1, z1), P(a, o1, z1)], col)
            self.poly([P(a, o1, z1), P(b, o1, z1), P(b, o1, z0), P(a, o1, z0)], col)
            self.poly([P(a, o0, z0), P(b, o0, z0), P(b, o0, z1), P(a, o0, z1)], col)
            self.poly([P(a, o1, z0), P(b, o1, z0), P(b, o0, z0), P(a, o0, z0)], col)
        if caps:
            P = path.at
            self.poly([P(s0, o0, z0), P(s0, o0, z1), P(s0, o1, z1), P(s0, o1, z0)], col)
            self.poly([P(s1, o1, z0), P(s1, o1, z1), P(s1, o0, z1), P(s1, o0, z0)], col)

    def prism(self, p, q, w, col, caps=False, wz=None):
        """Batang persegi dari p ke q (tiga dimensi); penampang w x wz."""
        wz = wz or w
        d = (q[0] - p[0], q[1] - p[1], q[2] - p[2])
        L = math.sqrt(sum(c * c for c in d))
        d = tuple(c / L for c in d)
        up = (0, 0, 1) if abs(d[2]) < 0.95 else (1, 0, 0)
        # a = d x up (horizontal sisi), b = d x a
        a = (d[1] * up[2] - d[2] * up[1], d[2] * up[0] - d[0] * up[2], d[0] * up[1] - d[1] * up[0])
        la = math.sqrt(sum(c * c for c in a))
        a = tuple(c / la * w / 2 for c in a)
        b = (d[1] * a[2] - d[2] * a[1], d[2] * a[0] - d[0] * a[2], d[0] * a[1] - d[1] * a[0])
        lb = math.sqrt(sum(c * c for c in b))
        b = tuple(c / lb * wz / 2 for c in b)
        def corner(o, sa, sb):
            return (o[0] + a[0] * sa + b[0] * sb, o[1] + a[1] * sa + b[1] * sb, o[2] + a[2] * sa + b[2] * sb)
        for (sa0, sb0), (sa1, sb1) in [((1, -1), (1, 1)), ((1, 1), (-1, 1)), ((-1, 1), (-1, -1)), ((-1, -1), (1, -1))]:
            self.poly([corner(p, sa0, sb0), corner(q, sa0, sb0), corner(q, sa1, sb1), corner(p, sa1, sb1)], col)
        if caps:
            self.poly([corner(p, 1, -1), corner(p, 1, 1), corner(p, -1, 1), corner(p, -1, -1)][::-1], col)
            self.poly([corner(q, 1, -1), corner(q, 1, 1), corner(q, -1, 1), corner(q, -1, -1)], col)

    def box(self, cx, cy, z0, sx, sy, h, col):
        x0, x1, y0, y1, z1 = cx - sx / 2, cx + sx / 2, cy - sy / 2, cy + sy / 2, z0 + h
        self.poly([(x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)], col)
        self.poly([(x0, y1, z0), (x0, y0, z0), (x0, y0, z1), (x0, y1, z1)], col)
        self.poly([(x1, y1, z0), (x0, y1, z0), (x0, y1, z1), (x1, y1, z1)], col)
        self.poly([(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)], col)
        self.poly([(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], col)

    def to_object(self, name):
        me = bpy.data.meshes.new(name)
        me.from_pydata(self.v, [], self.f)
        me.update()
        attr = me.color_attributes.new("Col", "FLOAT_COLOR", "CORNER")
        for pi, poly in enumerate(me.polygons):
            for li in poly.loop_indices:
                attr.data[li].color = self.c[pi]
            poly.use_smooth = False
        ob = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(ob)
        return ob


def pier(m, path, s, width, lod):
    x, y, _, _ = path.frame(s)
    _, _, tx, ty = path.frame(s)
    # tiang persegi di bawah geladak, menembus air/tanah (dasar -7 m)
    for off in (-width * 0.28, width * 0.28):
        px, py, _ = path.at(s, off, 0)
        m.box(px, py, -7.0, 2.2, 2.2, 7.0 - 1.7, C["pilar"])
    if lod == 0:
        m.strip(path, s - 1.2, s + 1.2, -width / 2 + 0.6, width / 2 - 0.6, -1.9, -1.05, C["pilar"], caps=True)


def deck(m, path, width, rail_col, lod, rail_h=1.0):
    step = 12.0 if lod == 0 else 30.0 if lod == 1 else 400.0
    L = path.length
    m.strip(path, 0, L, -width / 2, width / 2, -1.7, DECK_TOP - 0.03, C["beton"], step)
    # lapisan aspal: tepi atasnya = permukaan geladak (hanya sisi atas yang terlihat)
    m.strip(path, 0, L, -width / 2 + 0.7, width / 2 - 0.7, DECK_TOP - 0.03, DECK_TOP, C["aspal"], step, caps=False)
    if lod < 2:
        for sgn in (-1, 1):
            o = sgn * (width / 2 - 0.25)
            m.strip(path, 0, L, o - 0.25, o + 0.25, DECK_TOP, DECK_TOP + rail_h, rail_col, step)


def build_siak1(lod):
    pts = JALUR["siak1"]
    path = Path(pts)
    m = Mesh()
    W = 12.0
    deck(m, path, W, C["kuning"], lod)
    if lod < 2:
        for s in range(170, 330, 35 if lod == 0 else 70):
            pier(m, path, s, W, lod)
    return m


def build_siak3(lod):
    path = Path(JALUR["siak3"])
    m = Mesh()
    W = 16.0
    deck(m, path, W, C["biru"], lod)
    a, b = 205.0, 355.0                      # bentang busur, berpusat di titik sungai memotong (s = 279 m)
    H = 26.0                                 # [INFERENSI] tinggi busur
    lean = 3.2                               # puncak lebih sempit dari kaki (busur miring ke dalam)
    n = 14 if lod == 0 else 8 if lod == 1 else 4
    for sgn in (-1, 1):
        prev = None
        for k in range(n + 1):
            t = k / n
            s = a + (b - a) * t
            h = 4.0 * H * t * (1.0 - t)
            off = sgn * (W / 2 + 0.3 - lean * 4.0 * t * (1.0 - t))
            p = path.at(s, off, DECK_TOP + h)
            if prev:
                m.prism(prev, p, 1.7, C["oranye"], caps=False)
            prev = p
        if lod == 0:  # penggantung vertikal tiap ±12 m
            for k in range(1, 12):
                t = k / 12
                s = a + (b - a) * t
                h = 4.0 * H * t * (1.0 - t)
                off = sgn * (W / 2 + 0.3 - lean * 4.0 * t * (1.0 - t))
                m.prism(path.at(s, off, DECK_TOP + 0.9), path.at(s, off, DECK_TOP + h - 0.6), 0.22, C["abu"])
    # palang silang di puncak
    for t in (0.34, 0.5, 0.66) if lod < 2 else (0.5,):
        s = a + (b - a) * t
        h = 4.0 * H * t * (1.0 - t)
        off = W / 2 + 0.3 - lean * 4.0 * t * (1.0 - t)
        m.prism(path.at(s, -off, DECK_TOP + h), path.at(s, off, DECK_TOP + h), 1.1, C["oranye"], wz=1.3)
    if lod < 2:
        for s in (a - 6, b + 6):
            pier(m, path, s, W, lod)
    return m


def build_siak4(lod):
    path = Path(JALUR["siak4"])
    m = Mesh()
    W = 18.5
    deck(m, path, W, C["abu"], lod, rail_h=1.1)
    sp = 450.0                                # pilon di sungai (garis tengah sungai memotong di s = 454 m)
    Hp = 62.0                                 # [INFERENSI]
    for sgn in (-1, 1):                       # kaki A: lebar di geladak, menyatu di puncak
        base = path.at(sp, sgn * (W / 2 - 1.0), DECK_TOP - 1.7)
        top = path.at(sp, sgn * 1.4, DECK_TOP + Hp)
        m.prism(base, top, 3.4, C["putih"], caps=True, wz=3.0)
    # pelana/penahan kabel di puncak
    m.prism(path.at(sp, -2.4, DECK_TOP + Hp - 4), path.at(sp, 2.4, DECK_TOP + Hp - 4), 3.2, C["putih"], wz=3.0)
    if lod < 2:
        m.prism(path.at(sp, -(W / 2 - 3.5), DECK_TOP + 9.0), path.at(sp, (W / 2 - 3.5), DECK_TOP + 9.0), 2.2, C["putih"], wz=2.0)  # palang bawah
    # kabel kuning: kipas dua sisi (bentang kiri/kanan), 2 bidang
    nc = 10 if lod == 0 else 6 if lod == 1 else 3
    for side in (-1, 1):
        for sgn in (-1, 1):
            for k in range(nc):
                dist = 22.0 + (150.0 - 22.0) * k / max(1, nc - 1)
                z_top = DECK_TOP + Hp - 6.0 - 2.4 * (nc - 1 - k) * (10.0 / nc)
                top = path.at(sp, sgn * 1.0, z_top)
                bot = path.at(sp + side * dist, sgn * (W / 2 - 2.2), DECK_TOP + 0.2)
                m.prism(top, bot, 0.34 if lod < 2 else 0.6, C["kabel"])
    if lod < 2:
        for s in range(365, 545, 42 if lod == 0 else 85):
            if abs(s - sp) > 25:
                pier(m, path, s, W, lod)
        pier(m, path, sp - 10, W, lod)
        pier(m, path, sp + 10, W, lod)
    return m


def _material():
    mat = bpy.data.materials.get("jembatan:warna") or bpy.data.materials.new("jembatan:warna")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    vc = next((n for n in nt.nodes if n.type == "VERTEX_COLOR"), None) or nt.nodes.new("ShaderNodeVertexColor")
    vc.layer_name = "Col"
    nt.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.9
    return mat


JALUR = {}
ANCHOR = {}


def _load_paths():
    """Garis geladak dalam koordinat dunia (x, z) → model (x, -z) relatif ke titik tengah."""
    raw = {
        "siak1": [(5261, -6147), (5327, -6543)],
        "siak3": SIAK3_NODES,
        "siak4": [(6471.5, -6599), (6463, -5769)],
    }
    for k, pts in raw.items():
        xs = [p[0] for p in pts]
        zs = [p[1] for p in pts]
        cx, cz = (min(xs) + max(xs)) / 2, (min(zs) + max(zs)) / 2
        ANCHOR[k] = (round(cx, 1), round(cz, 1))
        JALUR[k] = [(x - cx, -(z - cz)) for x, z in pts]


# simpul way Siak III (Overpass 2026-11-14; dunia x, z): 465906574 + 1529638955 + 1529638956
SIAK3_NODES = [(5508.3, -6622.5), (5531.9, -6557.6), (5551.9, -6495.6), (5558.7, -6472.9), (5561.6, -6453.2), (5561.6, -6430.5), (5557.1, -6276.1), (5556.8, -6259.5)]
_load_paths()
BUILDERS = {"siak1": build_siak1, "siak3": build_siak3, "siak4": build_siak4}
FILES = {"siak1": "jembatan-siak-1", "siak3": "jembatan-siak-3", "siak4": "jembatan-siak-4"}


def build():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    os.makedirs(OUT_DIR, exist_ok=True)
    mat = _material()
    res = {"anchor": ANCHOR, "panjang": {k: round(Path(v).length) for k, v in JALUR.items()}}
    for key, fn in BUILDERS.items():
        for lod in (0, 1, 2):
            ob = fn(lod).to_object(f"{FILES[key]}_LOD{lod}")
            ob.data.materials.append(mat)
            ob.data.calc_loop_triangles()
            tris = len(ob.data.loop_triangles)
            bpy.ops.object.select_all(action="DESELECT")
            ob.select_set(True)
            bpy.context.view_layer.objects.active = ob
            path = os.path.join(OUT_DIR, f"{FILES[key]}-lod{lod}.glb")
            kw = dict(filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_yup=True)
            try:
                bpy.ops.export_scene.gltf(export_vertex_color="ACTIVE", **kw)
            except TypeError:
                bpy.ops.export_scene.gltf(**kw)
            res[f"{key}-lod{lod}"] = (tris, round(os.path.getsize(path) / 1024, 1))
            ob.hide_set(True)
    for o in bpy.data.objects:
        o.hide_set(False)
    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
    return res
