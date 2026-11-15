"""
Pustaka bersama skrip landmark Kota (dimuat lewat runpy oleh bangunan.py): mesh warna-per-vertex datar, ekstrusi jejak OSM,
atap, kubah, polygon, dan ekspor 3 LOD. Koordinat model: Blender x = +X dunia, y = -Z dunia, z atas (lihat jembatan.py).
"""
import math
import os

import bpy
from mathutils import Vector
from mathutils.geometry import tessellate_polygon

REPO = r"C:\Users\mocha\Documents\stadion-utama-riau-3d"
OUT_DIR = os.path.join(REPO, "public", "models", "landmark")


def lin(hex_):
    h = hex_.lstrip("#")
    out = []
    for i in (0, 2, 4):
        v = int(h[i:i + 2], 16) / 255.0
        out.append(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4)
    return (out[0], out[1], out[2], 1.0)


def hash01(*a):
    h = 2166136261
    for v in a:
        h = ((h ^ (int(v * 1000) & 0xFFFFFFFF)) * 16777619) & 0xFFFFFFFF
    h ^= h >> 13
    h = (h * 1274126177) & 0xFFFFFFFF
    return (h & 0xFFFF) / 65535.0


# ---------- polygon ----------
def area(pts):
    return sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(pts, pts[1:] + pts[:1])) / 2.0


def ccw(pts):
    return pts if area(pts) > 0 else pts[::-1]


def centroid(pts):
    return (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))


def inside(pt, pts):
    x, y = pt
    c = False
    for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]):
        if (y0 > y) != (y1 > y) and x < (x1 - x0) * (y - y0) / (y1 - y0) + x0:
            c = not c
    return c


def simplify(pts, tol):
    """Douglas–Peucker untuk cincin tertutup (jaga minimal 4 titik)."""
    if tol <= 0 or len(pts) <= 4:
        return pts

    def dp(seg):
        a, b = seg[0], seg[-1]
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dy) or 1e-9
        idx, dmax = 0, 0.0
        for i in range(1, len(seg) - 1):
            d = abs(dy * (seg[i][0] - a[0]) - dx * (seg[i][1] - a[1])) / L
            if d > dmax:
                idx, dmax = i, d
        if dmax > tol:
            return dp(seg[:idx + 1])[:-1] + dp(seg[idx:])
        return [a, b]

    far = max(range(len(pts)), key=lambda i: math.dist(pts[0], pts[i]))
    ring = pts[:far + 1], pts[far:] + [pts[0]]
    out = dp(list(ring[0]))[:-1] + dp(list(ring[1]))[:-1]
    return out if len(out) >= 4 else pts


def min_rect(pts):
    """Persegi panjang berluas minimum: (cx, cy, sudut sumbu panjang, panjang, lebar)."""
    best = None
    for k in range(0, 180):
        t = math.radians(k * 0.5)
        c, s = math.cos(t), math.sin(t)
        us = [p[0] * c + p[1] * s for p in pts]
        vs = [-p[0] * s + p[1] * c for p in pts]
        a = (max(us) - min(us)) * (max(vs) - min(vs))
        if best is None or a < best[0]:
            best = (a, t, (max(us) + min(us)) / 2, (max(vs) + min(vs)) / 2, max(us) - min(us), max(vs) - min(vs))
    _, t, cu, cv, L, W = best
    c, s = math.cos(t), math.sin(t)
    cx, cy = cu * c - cv * s, cu * s + cv * c
    if W > L:
        L, W, t = W, L, t + math.pi / 2
    return cx, cy, t, L, W


# ---------- mesh ----------
class Mesh:
    def __init__(self):
        self.v, self.f, self.c = [], [], []

    def poly(self, pts, col):
        idx = []
        for p in pts:
            self.v.append(tuple(p))
            idx.append(len(self.v) - 1)
        for i in range(1, len(idx) - 1):
            self.f.append((idx[0], idx[i], idx[i + 1]))
            self.c.append(lin(col))

    def poly_out(self, pts, ref, col):
        """Poligon yang normalnya menjauhi titik `ref` (untuk bentuk cembung/atap)."""
        n = [0, 0, 0]
        for a, b in zip(pts, pts[1:] + pts[:1]):
            n[0] += (a[1] - b[1]) * (a[2] + b[2])
            n[1] += (a[2] - b[2]) * (a[0] + b[0])
            n[2] += (a[0] - b[0]) * (a[1] + b[1])
        c = [sum(p[i] for p in pts) / len(pts) for i in range(3)]
        if sum(n[i] * (c[i] - ref[i]) for i in range(3)) < 0:
            pts = pts[::-1]
        self.poly(pts, col)

    def box(self, cx, cy, z0, sx, sy, h, col):
        x0, x1, y0, y1, z1 = cx - sx / 2, cx + sx / 2, cy - sy / 2, cy + sy / 2, z0 + h
        self.poly([(x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)], col)
        self.poly([(x0, y1, z0), (x0, y0, z0), (x0, y0, z1), (x0, y1, z1)], col)
        self.poly([(x1, y1, z0), (x0, y1, z0), (x0, y1, z1), (x1, y1, z1)], col)
        self.poly([(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)], col)
        self.poly([(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], col)

    def prism(self, p, q, w, col, caps=False, wz=None):
        wz = wz or w
        d = (q[0] - p[0], q[1] - p[1], q[2] - p[2])
        L = math.sqrt(sum(c * c for c in d)) or 1e-9
        d = tuple(c / L for c in d)
        up = (0, 0, 1) if abs(d[2]) < 0.95 else (1, 0, 0)
        a = (d[1] * up[2] - d[2] * up[1], d[2] * up[0] - d[0] * up[2], d[0] * up[1] - d[1] * up[0])
        la = math.sqrt(sum(c * c for c in a)) or 1e-9
        a = tuple(c / la * w / 2 for c in a)
        b = (d[1] * a[2] - d[2] * a[1], d[2] * a[0] - d[0] * a[2], d[0] * a[1] - d[1] * a[0])
        lb = math.sqrt(sum(c * c for c in b)) or 1e-9
        b = tuple(c / lb * wz / 2 for c in b)

        def corner(o, sa, sb):
            return (o[0] + a[0] * sa + b[0] * sb, o[1] + a[1] * sa + b[1] * sb, o[2] + a[2] * sa + b[2] * sb)
        for (sa0, sb0), (sa1, sb1) in [((1, -1), (1, 1)), ((1, 1), (-1, 1)), ((-1, 1), (-1, -1)), ((-1, -1), (1, -1))]:
            self.poly([corner(p, sa0, sb0), corner(q, sa0, sb0), corner(q, sa1, sb1), corner(p, sa1, sb1)], col)
        if caps:
            self.poly([corner(p, 1, -1), corner(p, 1, 1), corner(p, -1, 1), corner(p, -1, -1)][::-1], col)
            self.poly([corner(q, 1, -1), corner(q, 1, 1), corner(q, -1, 1), corner(q, -1, -1)], col)

    def revolve(self, cx, cy, z0, profile, seg, col, col2=None, cap_top=False):
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

    # --- bangunan ---
    def top(self, pts, z, col):
        pts = ccw(pts)
        tris = tessellate_polygon([[Vector((x, y, 0)) for x, y in pts]])
        for i, j, k in tris:
            a, b, c = pts[i], pts[j], pts[k]
            if (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) < 0:
                j, k = k, j
            self.v += [(pts[i][0], pts[i][1], z), (pts[j][0], pts[j][1], z), (pts[k][0], pts[k][1], z)]
            n = len(self.v)
            self.f.append((n - 3, n - 2, n - 1))
            self.c.append(lin(col))

    def extrude(self, pts, z0, z1, wall, roof=None, bands=None, flip_roof=False):
        """Dinding dari cincin `pts` (x, y), alas z0 → z1. bands = [(f0, f1, warna)] pecahan tinggi per lantai (opsional)."""
        pts = ccw(pts)
        for a, b in zip(pts, pts[1:] + pts[:1]):
            if math.dist(a, b) < 0.05:
                continue
            if bands:
                # per lantai tidak diketahui di sini: pemanggil memberi `bands` sebagai daftar (z_lo, z_hi, warna) mutlak
                for lo, hi, col in bands:
                    self.poly([(a[0], a[1], lo), (b[0], b[1], lo), (b[0], b[1], hi), (a[0], a[1], hi)], col)
            else:
                self.poly([(a[0], a[1], z0), (b[0], b[1], z0), (b[0], b[1], z1), (a[0], a[1], z1)], wall)
        if roof:
            self.top(pts, z1, roof)

    def hip(self, cx, cy, ang, L, W, z0, h, ridge, col, ref_z=None):
        """Atap perisai/pelana: persegi panjang L (sumbu ang) x W, bubungan sepanjang L*ridge (0 = limas, 1 = pelana)."""
        c, s = math.cos(ang), math.sin(ang)
        P = lambda u, v, z: (cx + u * c - v * s, cy + u * s + v * c, z)  # noqa: E731
        r = L * ridge / 2
        top = z0 + h
        ref = (cx, cy, z0 - 1.0 if ref_z is None else ref_z)
        self.poly_out([P(-L / 2, -W / 2, z0), P(L / 2, -W / 2, z0), P(r, 0, top), P(-r, 0, top)], ref, col)
        self.poly_out([P(L / 2, W / 2, z0), P(-L / 2, W / 2, z0), P(-r, 0, top), P(r, 0, top)], ref, col)
        self.poly_out([P(L / 2, -W / 2, z0), P(L / 2, W / 2, z0), P(r, 0, top)], ref, col)
        self.poly_out([P(-L / 2, W / 2, z0), P(-L / 2, -W / 2, z0), P(-r, 0, top)], ref, col)

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


ONION = [(0.92, 0.0), (1.0, 0.10), (1.02, 0.22), (0.95, 0.38), (0.80, 0.55), (0.58, 0.72), (0.32, 0.87), (0.12, 0.96), (0.0, 1.0)]


def dome(m, cx, cy, z0, R, H, seg, rings, col, col2=None):
    prof = ONION if rings >= 8 else [ONION[0], ONION[2], ONION[4], ONION[6], ONION[8]] if rings >= 5 else [ONION[0], ONION[3], ONION[6], ONION[8]]
    m.revolve(cx, cy, z0, [(R * r, H * z) for r, z in prof], seg, col, col2)


def x_finial(m, x, y, z, ang, s, col):
    """Selembayung: dua papan bersilang di ujung bubungan (sepanjang sumbu atap)."""
    c, sn = math.cos(ang), math.sin(ang)
    for k in (-1, 1):
        m.prism((x - c * s * 0.5 * k, y - sn * s * 0.5 * k, z), (x + c * s * 0.5 * k, y + sn * s * 0.5 * k, z + s * 1.6), 0.25 * s, col, wz=0.12 * s)


def material():
    mat = bpy.data.materials.get("landmark:warna") or bpy.data.materials.new("landmark:warna")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    vc = next((n for n in nt.nodes if n.type == "VERTEX_COLOR"), None) or nt.nodes.new("ShaderNodeVertexColor")
    vc.layer_name = "Col"
    nt.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.9
    return mat


def export_lods(slug, builder, mat):
    """builder(lod) → Mesh; ekspor slug-lod{0,1,2}.glb; kembalikan [(segitiga, KB)]."""
    os.makedirs(OUT_DIR, exist_ok=True)
    res = []
    for lod in (0, 1, 2):
        ob = builder(lod).to_object(f"{slug}_LOD{lod}")
        ob.data.materials.append(mat)
        ob.data.calc_loop_triangles()
        tris = len(ob.data.loop_triangles)
        bpy.ops.object.select_all(action="DESELECT")
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        path = os.path.join(OUT_DIR, f"{slug}-lod{lod}.glb")
        kw = dict(filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_yup=True)
        try:
            bpy.ops.export_scene.gltf(export_vertex_color="ACTIVE", **kw)
        except TypeError:
            bpy.ops.export_scene.gltf(**kw)
        res.append((tris, round(os.path.getsize(path) / 1024, 1)))
        ob.hide_set(True)
    return res
