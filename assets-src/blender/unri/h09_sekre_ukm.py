"""
H09 Gedung Sekretariat UKM ("blok biru") Kampus UNRI Bina Widya, untuk Blender (MCP atau headless):

    import runpy
    ns = runpy.run_path(r"C:\\Users\\mocha\\Documents\\stadion-utama-riau-3d\\assets-src\\blender\\unri\\h09_sekre_ukm.py")
    print(ns["build"]())

Sumber ukuran: citra satelit Google Maps yang dikalibrasi ke OSM (docs/research/sekre-ukm/sekre-ukm-blok-biru.md).
Bentuk L, satu lantai, atap pelana seng biru kobalt (bergelombang), dinding putih keabu-abuan, pintu biru,
jendela tinggi berpanel vertikal. Warna cat dan detail fasad diambil dari Street View [T]; teras, tangga,
AC, dan lampu dinding [INFERENSI].

Frame GLB: origin = pusat bbox gedung di tanah. Blender +X timur, +Y utara  ->  three.js +X timur, -Z utara
(game: +Z selatan). Material per objek "unri:<nama>"; ekspor lewat export_glb.py; koordinat pintu/papan nama
ditulis ke h09-sekre-ukm.json dalam koordinat game-lokal (x timur, z selatan).
"""
import json
import math
import os
import runpy

import bmesh
import bpy
from mathutils import Matrix, Vector

REPO = r"C:\Users\mocha\Documents\stadion-utama-riau-3d"
EXPORT_PY = os.path.join(REPO, "assets-src", "blender", "export_glb.py")
OUT_GLB = os.path.join(REPO, "public", "models", "unri", "h09-sekre-ukm.glb")
OUT_JSON = os.path.join(REPO, "public", "models", "unri", "h09-sekre-ukm.json")
OUT_BLEND = os.path.join(REPO, "assets-src", "blender", "unri", "h09_sekre_ukm.blend")
COLL = "SUR_SekreUKM"

# ---- ukuran (meter, Blender x timur / y utara, origin pusat bbox) -------------------------------------------
FLOOR = 0.45
WALL_TOP = FLOOR + 3.30
OVER = 0.90                      # tritisan atap
RIDGE_Z = 5.77
EAVE_Z = 3.42
H_WALL = dict(x0=-17.35, x1=6.15, y0=-15.2, y1=-4.2)     # sayap barat-timur (bubungan sepanjang X)
V_WALL = dict(x0=6.15, x1=17.35, y0=-15.2, y1=15.2)      # sayap utara-selatan (bubungan sepanjang Y)
H_ROOF = dict(axis="x", center=-9.7, a0=-18.25, a1=11.75, hw=6.4)
V_ROOF = dict(axis="y", center=11.75, a0=-16.1, a1=16.1, hw=6.5)

PALETTE = {
    "unri:dinding": ("#E4E5DF", 0.92, 0.0),
    "unri:plint": ("#A8AAA5", 0.95, 0.0),
    "unri:atap-biru": ("#2352C4", 0.36, 0.35),
    "unri:atap-bubungan": ("#1A3E99", 0.4, 0.35),
    "unri:plafon": ("#E8E6DE", 0.9, 0.0),
    "unri:kusen": ("#F1F1EC", 0.6, 0.0),
    "unri:pintu-biru": ("#1B3D8F", 0.55, 0.0),
    "unri:kaca": ("#5D7A8A", 0.08, 0.2),
    "unri:beton": ("#ABABA6", 0.95, 0.0),
    "unri:talang": ("#8E9193", 0.5, 0.5),
    "unri:ac": ("#EEF0EF", 0.5, 0.0),
    "unri:papan-nama": ("#F5F5F1", 0.7, 0.0),
    "unri:kayu": ("#8A5A33", 0.8, 0.0),
    "unri:tong-biru": ("#1F4FB5", 0.5, 0.0),
    "unri:logam-gelap": ("#2B2D30", 0.6, 0.5),
    "unri:lampu-emisif": ("#FFF1CC", 0.4, 0.0),
}
M = {k.split(":")[1]: k for k in PALETTE}


def _lin(h):
    h = h.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(out)


def _socket(bsdf, *names):
    for n in names:
        s = bsdf.inputs.get(n)
        if s is not None:
            return s
    return None


def _material(name):
    hexv, rough, metal = PALETTE[name]
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    _socket(bsdf, "Base Color").default_value = (*_lin(hexv), 1.0)
    _socket(bsdf, "Roughness").default_value = rough
    _socket(bsdf, "Metallic").default_value = metal
    if name == "unri:lampu-emisif":
        _socket(bsdf, "Emission Color", "Emission").default_value = (*_lin(hexv), 1.0)
        _socket(bsdf, "Emission Strength").default_value = 0.0
    return m


class Acc:
    """Kumpulan bmesh per material dengan tumpukan matriks (rotasi saja, determinan positif)."""

    def __init__(self):
        self._bm = {}
        self._stack = [Matrix.Identity(4)]

    def bm(self, mat):
        if mat not in self._bm:
            self._bm[mat] = bmesh.new()
        return self._bm[mat]

    def push(self, m):
        self._stack.append(self._stack[-1] @ m)

    def pop(self):
        self._stack.pop()

    @property
    def m(self):
        return self._stack[-1]

    def box(self, mat, c, s, rz=0.0, rx=0.0):
        local = (Matrix.Translation(c) @ Matrix.Rotation(rz, 4, "Z") @ Matrix.Rotation(rx, 4, "X")
                 @ Matrix.Diagonal((s[0], s[1], s[2], 1.0)))
        bmesh.ops.create_cube(self.bm(mat), size=1.0, matrix=self.m @ local)

    def cyl(self, mat, c, r, h, seg=14):
        mtx = self.m @ Matrix.Translation(c)
        try:
            bmesh.ops.create_cone(self.bm(mat), cap_ends=True, segments=seg, radius1=r, radius2=r, depth=h, matrix=mtx)
        except TypeError:
            bmesh.ops.create_cone(self.bm(mat), cap_ends=True, segments=seg, diameter1=2 * r, diameter2=2 * r,
                                  depth=h, matrix=mtx)

    def quad(self, mat, pts):
        bm = self.bm(mat)
        bm.faces.new([bm.verts.new(self.m @ Vector(p)) for p in pts])

    def hull(self, mat, pts):
        bm = self.bm(mat)
        vs = [bm.verts.new(self.m @ Vector(p)) for p in pts]
        bmesh.ops.convex_hull(bm, input=vs)


# ---- atap pelana bergelombang -----------------------------------------------------------------------------------
def gable_roof(acc, axis, center, a0, a1, hw):
    base = (Matrix.Translation((0, center, 0)) if axis == "x"
            else Matrix.Translation((center, 0, 0)) @ Matrix.Rotation(math.pi / 2, 4, "Z"))
    acc.push(base)
    ze, zr = EAVE_Z, RIDGE_Z
    pitch = math.atan2(zr - ze, hw)
    length = a1 - a0
    period, amp = 0.50, 0.018
    n = int(math.ceil(length / (period / 4)))
    da = length / n
    for side in (1, -1):
        rows = []
        for i in range(n + 1):
            a = a0 + i * da
            c = amp * math.sin(2 * math.pi * (a - a0) / period)
            rows.append(((a, 0.0, zr + c), (a, side * hw, ze + c)))
        for i in range(n):
            r0, e0 = rows[i]
            r1, e1 = rows[i + 1]
            quad = [r0, r1, e1, e0]
            acc.quad(M["atap-biru"], quad if side == 1 else quad[::-1])
        # soffit (sisi bawah tritisan): strip selebar tritisan, menghadap bawah
        b_in, b_out = side * (hw - OVER - 0.1), side * hw
        z_in = zr - abs(b_in) * (zr - ze) / hw - 0.07
        z_out = ze - 0.07
        strip = [(a0, b_in, z_in), (a1, b_in, z_in), (a1, b_out, z_out), (a0, b_out, z_out)]
        acc.quad(M["plafon"], strip[::-1] if side == 1 else strip)
        # lisplang (fascia) sepanjang tepi tritisan dan papan list di sisi gable
        acc.box(M["kusen"], ((a0 + a1) / 2, side * (hw + 0.02), ze - 0.10), (length + 0.1, 0.04, 0.22))
        slope = math.hypot(hw, zr - ze)
        for a_end in (a0, a1):
            acc.box(M["kusen"], (a_end, side * hw / 2, (zr + ze) / 2 - 0.09), (0.05, slope, 0.20),
                    rx=-pitch * side)
        # bubungan
        acc.box(M["atap-bubungan"], ((a0 + a1) / 2, side * 0.12, zr + 0.025), (length + 0.1, 0.30, 0.045),
                rx=-pitch * side)
        # talang air di bawah tepi tritisan
        acc.box(M["talang"], ((a0 + a1) / 2, side * (hw + 0.07), ze - 0.17), (length - 0.1, 0.11, 0.09))
    acc.pop()


def gable_wall(acc, axis, a_wall, center, half_w, z_top, z_ridge, depth=0.30):
    """Segitiga dinding gable pada bidang a=a_wall (tebal `depth` ke arah dalam)."""
    inward = -1.0 if a_wall > 0 else 1.0   # semua ujung gable gedung ini: a>0 di sisi utara/timur
    pts = []
    for da in (0.0, depth * inward):
        a = a_wall + da
        for b, z in ((-half_w, z_top), (half_w, z_top), (0.0, z_ridge)):
            pts.append((a, center + b, z) if axis == "x" else (center + b, a, z))
    acc.hull(M["dinding"], pts)


# ---- modul fasad ------------------------------------------------------------------------------------------------------
def window(acc, loc, rz):
    z0 = FLOOR + 1.00
    h, w = 1.50, 1.30
    zc = z0 + h / 2
    acc.box(M["kaca"], loc(0, 0.00, zc), (w - 0.14, 0.02, h - 0.14), rz)
    acc.box(M["kusen"], loc(-(w / 2 - 0.035), 0.03, zc), (0.07, 0.08, h), rz)
    acc.box(M["kusen"], loc((w / 2 - 0.035), 0.03, zc), (0.07, 0.08, h), rz)
    acc.box(M["kusen"], loc(0, 0.03, z0 + 0.035), (w, 0.08, 0.07), rz)
    acc.box(M["kusen"], loc(0, 0.03, z0 + h - 0.035), (w, 0.08, 0.07), rz)
    for du in (-0.29, 0.0, 0.29):
        acc.box(M["kusen"], loc(du, 0.035, zc), (0.035, 0.06, h - 0.14), rz)
    acc.box(M["kusen"], loc(0, 0.08, z0 - 0.025), (w + 0.2, 0.16, 0.05), rz)       # ambang bawah
    acc.box(M["kusen"], loc(0, 0.06, z0 + h + 0.04), (w + 0.12, 0.12, 0.05), rz)   # penutup atas


def door(acc, loc, rz, with_sign=True):
    zc = FLOOR + 1.05
    acc.box(M["kusen"], loc(0, 0.04, zc + 0.05), (1.14, 0.10, 2.25), rz)
    acc.box(M["pintu-biru"], loc(0, 0.085, zc), (0.94, 0.05, 2.10), rz)
    for dz in (-0.55, 0.45):
        acc.box(M["pintu-biru"], loc(0, 0.115, zc + dz * 0.9), (0.70, 0.02, 0.80), rz)
    acc.box(M["logam-gelap"], loc(0.34, 0.14, zc - 0.05), (0.04, 0.05, 0.14), rz)
    if with_sign:
        acc.box(M["papan-nama"], loc(0, 0.06, FLOOR + 2.62), (1.50, 0.04, 0.40), rz)
    acc.box(M["lampu-emisif"], loc(0.95, 0.07, FLOOR + 2.35), (0.14, 0.10, 0.08), rz)


def face(acc, name, origin, t, length, pattern, doors, ac_bays=(), step_doors=True):
    n = (-t[1], t[0])
    rz = math.atan2(t[1], t[0])
    bl = length / len(pattern)

    def make_loc(px, py):
        return lambda du, dv, dz: Vector((px + t[0] * du + n[0] * dv, py + t[1] * du + n[1] * dv, dz))

    for i, kind in enumerate(pattern):
        u = (i + 0.5) * bl
        px, py = origin[0] + t[0] * u, origin[1] + t[1] * u
        loc = make_loc(px, py)
        if kind == "W":
            window(acc, loc, rz)
        elif kind[0] in "DB":
            door(acc, loc, rz, with_sign=kind[0] == "D")
            if step_doors:
                acc.box(M["beton"], loc(0, 0.70, 0.225), (1.7, 1.1, 0.45), rz)
            doors.append(dict(id=kind, face=name, pos=(px + n[0] * 0.15, py + n[1] * 0.15), normal=n,
                              sign=(px + n[0] * 0.09, py + n[1] * 0.09, FLOOR + 2.62)))
        if i in ac_bays:
            acc.box(M["ac"], loc(1.45, 0.34, 2.75), (0.90, 0.36, 0.62), rz)
            acc.box(M["logam-gelap"], loc(1.45, 0.17, 2.40), (0.70, 0.30, 0.04), rz)


# ---- badan bangunan -------------------------------------------------------------------------------------------------------
def body(acc):
    for w in (H_WALL, V_WALL):
        cx, cy = (w["x0"] + w["x1"]) / 2, (w["y0"] + w["y1"]) / 2
        sx, sy = w["x1"] - w["x0"], w["y1"] - w["y0"]
        acc.box(M["dinding"], (cx, cy, (FLOOR + WALL_TOP) / 2), (sx, sy, WALL_TOP - FLOOR))
        acc.box(M["plint"], (cx, cy, (FLOOR + 0.30) / 2), (sx + 0.06, sy + 0.06, FLOOR + 0.30))
    # teras beton di depan dinding sisi dalam huruf L (utara sayap H, barat sayap V)
    acc.box(M["beton"], ((H_WALL["x0"] - 0.1 + V_WALL["x0"] + 1.2) / 2, H_WALL["y1"] + 0.6, 0.1125),
            ((V_WALL["x0"] + 1.2) - (H_WALL["x0"] - 0.1), 1.2, 0.225))
    acc.box(M["beton"], (V_WALL["x0"] - 0.6, (H_WALL["y1"] + 0.6 + V_WALL["y1"]) / 2, 0.1125),
            (1.2, V_WALL["y1"] - (H_WALL["y1"] + 0.6), 0.225))
    # gable + atap
    for roof in (H_ROOF, V_ROOF):
        gable_roof(acc, roof["axis"], roof["center"], roof["a0"], roof["a1"], roof["hw"])
    gable_wall(acc, "x", H_WALL["x0"], (H_WALL["y0"] + H_WALL["y1"]) / 2, (H_WALL["y1"] - H_WALL["y0"]) / 2,
               WALL_TOP, RIDGE_Z)
    gable_wall(acc, "y", V_WALL["y1"], (V_WALL["x0"] + V_WALL["x1"]) / 2, (V_WALL["x1"] - V_WALL["x0"]) / 2,
               WALL_TOP, RIDGE_Z)
    gable_wall(acc, "y", V_WALL["y0"], (V_WALL["x0"] + V_WALL["x1"]) / 2, (V_WALL["x1"] - V_WALL["x0"]) / 2,
               WALL_TOP, RIDGE_Z)
    for (x, y, rz) in ((H_WALL["x0"] - 0.16, -9.7, math.pi / 2), (11.75, V_WALL["y1"] + 0.16, 0.0),
                       (11.75, V_WALL["y0"] - 0.16, 0.0)):
        acc.box(M["kusen"], (x, y, WALL_TOP + 1.05), (0.80, 0.06, 0.50), rz)
    # pipa talang turun di sudut-sudut
    for (x, y) in ((H_WALL["x0"] - 0.05, H_WALL["y1"] + 0.07), (H_WALL["x0"] - 0.05, H_WALL["y0"] - 0.07),
                   (V_WALL["x1"] + 0.07, V_WALL["y1"] + 0.07), (V_WALL["x1"] + 0.07, V_WALL["y0"] - 0.07),
                   (V_WALL["x0"] - 0.07, V_WALL["y1"] + 0.07)):
        acc.box(M["talang"], (x, y, EAVE_Z / 2 - 0.1), (0.08, 0.08, EAVE_Z - 0.2))


def faces(acc):
    doors = []
    face(acc, "utara-H", (H_WALL["x0"], H_WALL["y1"]), (1, 0), 23.5, ["D1", "W", "D2", "W", "D3", "W"], doors)
    face(acc, "barat-V", (V_WALL["x0"], H_WALL["y1"]), (0, 1), 19.4, ["W", "D4", "W", "D5", "W"], doors)
    face(acc, "selatan", (V_WALL["x1"], H_WALL["y0"]), (-1, 0), 34.7,
         ["W", "W", "W", "W", "B1", "W", "W", "W", "W"], doors, ac_bays=(1, 3, 7), step_doors=False)
    face(acc, "timur-V", (V_WALL["x1"], V_WALL["y1"]), (0, -1), 30.4,
         ["W", "W", "W", "W", "W", "W", "W", "W"], doors, ac_bays=(2, 5))
    face(acc, "barat-H", (H_WALL["x0"], H_WALL["y0"]), (0, 1), 11.0, ["W", "W", "W"], doors)
    face(acc, "utara-V", (V_WALL["x0"], V_WALL["y1"]), (1, 0), 11.2, ["W", "W", "W"], doors)
    return doors


def yard_props(acc):
    """Bangku kayu, tong biru, dan lampu halaman di sisi dalam L (sesuai foto Street View) [INFERENSI posisi]."""
    for bx in (-11.5, -4.6):
        by = -0.4
        acc.box(M["kayu"], (bx, by, 0.46), (1.9, 0.46, 0.06))
        acc.box(M["kayu"], (bx, by - 0.2, 0.74), (1.9, 0.05, 0.40))
        for dx in (-0.8, 0.8):
            acc.box(M["beton"], (bx + dx, by, 0.22), (0.12, 0.44, 0.44))
    for (tx, ty) in ((-13.3, -2.95), (-12.75, -2.9), (1.9, -3.0)):
        acc.cyl(M["tong-biru"], (tx, ty, 0.43), 0.27, 0.86)
        acc.cyl(M["logam-gelap"], (tx, ty, 0.87), 0.285, 0.03)
    acc.cyl(M["logam-gelap"], (-0.9, -1.6, 2.1), 0.05, 4.2, seg=8)
    acc.box(M["kusen"], (-0.9, -1.6, 4.25), (0.5, 0.18, 0.12))


# ---- keluaran -----------------------------------------------------------------------------------------------------------------
def _clear(coll_name):
    for name in (coll_name, f"{coll_name}_Ekspor"):
        c = bpy.data.collections.get(name)
        if not c:
            continue
        for o in list(c.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        bpy.data.collections.remove(c)
    for me in [m for m in bpy.data.meshes if m.users == 0]:
        bpy.data.meshes.remove(me)


def _emit(acc):
    coll = bpy.data.collections.new(COLL)
    bpy.context.scene.collection.children.link(coll)
    for name, bm in acc._bm.items():
        me = bpy.data.meshes.new(f"SekreUKM_{name.split(':')[1]}")
        bm.to_mesh(me)
        bm.free()
        me.materials.append(_material(name))
        ob = bpy.data.objects.new(me.name, me)
        coll.objects.link(ob)
    return coll


def _door_json(doors):
    out = []
    for d in doors:
        px, py = d["pos"]
        nx, ny = d["normal"]
        sx, sy, sz = d["sign"]
        out.append({"id": d["id"], "face": d["face"], "x": round(px, 3), "z": round(-py, 3),
                    "normal": [round(nx, 3), round(-ny, 3)], "sign": {"x": round(sx, 3), "y": round(sz, 3), "z": round(-sy, 3)}})
    return out


def build():
    _clear(COLL)
    acc = Acc()
    body(acc)
    doors = faces(acc)
    yard_props(acc)
    coll = _emit(acc)
    runpy_ns = runpy.run_path(EXPORT_PY)
    n_mesh, tris, kb = runpy_ns["export_collection"](COLL, OUT_GLB)
    meta = {
        "frame": "origin=pusat bbox gedung di tanah; x timur, z selatan (game-lokal); y atas",
        "worldOrigin": {"x": -99.65, "z": 1014.9},
        "floorY": FLOOR, "wallTopY": WALL_TOP, "ridgeY": RIDGE_Z,
        "wallsFootprintLocal": [[-17.35, 4.2], [6.15, 4.2], [6.15, -15.2], [17.35, -15.2], [17.35, 15.2], [-17.35, 15.2]],
        "roofOutlineLocal": [[-18.25, 3.3], [5.25, 3.3], [5.25, -16.1], [18.25, -16.1], [18.25, 16.1], [-18.25, 16.1]],
        "doors": _door_json(doors),
        "stats": {"meshes": n_mesh, "triangles": tris, "kb": kb},
    }
    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    os.makedirs(os.path.dirname(OUT_BLEND), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND, copy=True)
    return {"collection": coll.name, **meta["stats"], "glb": OUT_GLB}
