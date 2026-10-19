"""
V11–V14 Pohon & semak kampus UNRI (Blender MCP atau headless):

    import runpy
    ns = runpy.run_path(r"C:\\Users\\mocha\\Documents\\stadion-utama-riau-3d\\assets-src\\blender\\unri\\v11_pohon_kampus.py")
    print(ns["build"]())

Rujukan: Street View Jl. Prof. Aras Mulyadi (Jan 2025): batang tinggi ramping dan lurus (mahoni/akasia), tajuk
renggang di sepertiga atas, banyak pohon kecil bercabang dan semak di bawahnya. Tiap varian punya LOD0 dan -lod.
Origin = dasar batang di tanah, Z atas (Blender) -> Y atas (three.js). Skala: tinggi aktual dalam meter;
game menskalakan per instans 0,8–1,25 dan mewarnai tipis per instans.
Material: unri:kulit-kayu, unri:daun-gelap, unri:daun-terang. Gumpalan daun berselang-seling gelap/terang.
Bentuk spesifik = [INFERENSI] dari foto (spesies tidak dipastikan; mahoni dominan menurut riset kampus).
"""
import math
import os
import random
import runpy

import bmesh
import bpy
from mathutils import Matrix, Vector

REPO = r"C:\Users\mocha\Documents\stadion-utama-riau-3d"
OUT_DIR = os.path.join(REPO, "public", "models", "unri")
OUT_BLEND = os.path.join(REPO, "assets-src", "blender", "unri", "v11_pohon_kampus.blend")

PALETTE = {
    "unri:kulit-kayu": ("#5B4636", 0.95),
    "unri:daun-gelap": ("#2E5A2B", 0.85),
    "unri:daun-terang": ("#5F8F3C", 0.85),
}

# nama, seed, tinggi, jari-jari dasar, awal tajuk (fraksi tinggi), cabang, gumpalan per cabang, radius gumpalan, batang
VARIANTS = {
    "v11-pohon-ramping": dict(seed=11, h=15.0, r0=0.30, crown=0.46, branches=6, clumps=2, cr=(1.5, 2.3), stems=1, lean=0.04),
    "v12-pohon-kecil": dict(seed=12, h=7.5, r0=0.17, crown=0.34, branches=5, clumps=2, cr=(1.1, 1.7), stems=2, lean=0.10),
    "v13-pohon-lurus": dict(seed=13, h=18.0, r0=0.24, crown=0.62, branches=5, clumps=2, cr=(1.2, 1.9), stems=1, lean=0.02),
    "v14-semak": dict(seed=14, h=1.5, r0=0.03, crown=0.0, branches=0, clumps=0, cr=(0.5, 0.9), stems=0, lean=0.0),
}


def _lin(h):
    h = h.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(out)


def _material(name):
    hexv, rough = PALETTE[name]
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*_lin(hexv), 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = 0.0
    return m


class Acc:
    def __init__(self):
        self.bm = {}

    def get(self, mat):
        return self.bm.setdefault(mat, bmesh.new())

    def limb(self, p0, p1, r0, r1, seg=6, mat="unri:kulit-kayu"):
        d = Vector(p1) - Vector(p0)
        mid = (Vector(p0) + Vector(p1)) / 2
        m = Matrix.Translation(mid) @ d.to_track_quat("Z", "Y").to_matrix().to_4x4()
        try:
            bmesh.ops.create_cone(self.get(mat), cap_ends=True, segments=seg, radius1=r0, radius2=r1, depth=d.length,
                                  matrix=m)
        except TypeError:
            bmesh.ops.create_cone(self.get(mat), cap_ends=True, segments=seg, diameter1=2 * r0, diameter2=2 * r1,
                                  depth=d.length, matrix=m)

    def clump(self, c, radius, rng, light, flat=0.72, subdiv=1):
        bm = self.get("unri:daun-terang" if light else "unri:daun-gelap")
        res = bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0,
                                         matrix=Matrix.Translation(c) @ Matrix.Diagonal((radius, radius, radius * flat, 1.0)))
        for v in res["verts"]:
            k = rng.uniform(0.78, 1.16)
            v.co = Vector(c) + (v.co - Vector(c)) * k


def _tree(spec, lod):
    rng = random.Random(spec["seed"])
    acc = Acc()
    h, r0 = spec["h"], spec["r0"]
    if spec["stems"] == 0:                                   # semak: gumpalan rendah dan beberapa batang tipis
        n = 5 if not lod else 3
        for i in range(n):
            a = rng.uniform(0, math.tau)
            r = rng.uniform(0.0, 0.55)
            acc.clump((r * math.cos(a), r * math.sin(a), rng.uniform(0.5, 1.0)), rng.uniform(*spec["cr"]), rng, i % 2 == 0,
                      flat=0.85, subdiv=1 if not lod else 0)
        return acc
    seg = 8 if not lod else 5
    for s in range(spec["stems"]):
        a0 = rng.uniform(0, math.tau)
        off = 0.0 if spec["stems"] == 1 else rng.uniform(0.15, 0.30)
        base = Vector((off * math.cos(a0), off * math.sin(a0), 0.0))
        lean_dir = Vector((math.cos(a0), math.sin(a0), 0.0))
        stem_h = h * (1.0 if s == 0 else rng.uniform(0.75, 0.92))
        pts = []
        steps = 4 if not lod else 2
        for k in range(steps + 1):
            t = k / steps
            p = base + lean_dir * spec["lean"] * stem_h * t * t + Vector((rng.uniform(-0.05, 0.05), rng.uniform(-0.05, 0.05), 0.0)) * (1 if 0 < k < steps else 0)
            pts.append(Vector((p.x, p.y, stem_h * t)))
        radii = [r0 * (1 - 0.62 * (k / steps)) * (1.0 if s == 0 else 0.7) for k in range(steps + 1)]
        for k in range(steps):
            acc.limb(pts[k], pts[k + 1], radii[k], radii[k + 1], seg=seg)
        # pelebaran akar
        if not lod:
            acc.limb(pts[0] - Vector((0, 0, 0.02)), pts[0] + Vector((0, 0, 0.55)), radii[0] * 1.35, radii[0] * 1.0, seg=seg)
        # cabang dan gumpalan daun dari awal tajuk ke puncak
        z0 = stem_h * spec["crown"]
        nb = spec["branches"] if not lod else max(2, spec["branches"] // 2)
        for b in range(nb):
            t = (b + 0.5) / nb
            z = z0 + (stem_h - z0) * (t ** 0.85)
            ang = b * 2.39996 + rng.uniform(-0.4, 0.4)       # sudut emas
            length = (1.2 + 2.2 * (1 - t)) * (h / 14.0 + 0.4)
            out = Vector((math.cos(ang), math.sin(ang), 0.0))
            start = Vector((lean_dir.x * spec["lean"] * stem_h * (z / stem_h) ** 2 + base.x, lean_dir.y * spec["lean"] * stem_h * (z / stem_h) ** 2 + base.y, z))
            end = start + out * length + Vector((0, 0, length * rng.uniform(0.35, 0.8)))
            rb = max(0.035, r0 * 0.30 * (1 - t * 0.7))
            acc.limb(start, end, rb, rb * 0.45, seg=5 if not lod else 4)
            for c in range(spec["clumps"] if not lod else 1):
                cc = end + Vector((rng.uniform(-0.6, 0.6), rng.uniform(-0.6, 0.6), rng.uniform(0.0, 0.7)))
                acc.clump(cc, rng.uniform(*spec["cr"]) * (1.0 if not lod else 1.25), rng, (b + c) % 2 == 0,
                          subdiv=1 if not lod else 0)
        top = pts[-1] + Vector((0, 0, 0.5))
        acc.clump(top, rng.uniform(*spec["cr"]) * 0.95, rng, True, subdiv=1 if not lod else 0)
    return acc


def _emit(name, acc):
    for cn in (name, f"{name}_Ekspor"):
        c = bpy.data.collections.get(cn)
        if c:
            for o in list(c.objects):
                bpy.data.objects.remove(o, do_unlink=True)
            bpy.data.collections.remove(c)
    coll = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(coll)
    for mat, bm in acc.bm.items():
        me = bpy.data.meshes.new(f"{name}_{mat.split(':')[1]}")
        bm.to_mesh(me)
        bm.free()
        if mat.startswith("unri:daun"):                  # gumpalan daun halus, selaras gaya pohon game
            me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
        me.materials.append(_material(mat))
        coll.objects.link(bpy.data.objects.new(me.name, me))
    return coll


def build(only=None):
    exp = runpy.run_path(os.path.join(REPO, "assets-src", "blender", "export_glb.py"))["export_collection"]
    out = {}
    for name, spec in VARIANTS.items():
        if only and name not in only:
            continue
        for lod in (False, True):
            cname = f"SUR_{name}{'_lod' if lod else ''}"
            _emit(cname, _tree(spec, lod))
            path = os.path.join(OUT_DIR, f"{name}{'-lod' if lod else ''}.glb")
            n_mesh, tris, kb = exp(cname, path)
            out[os.path.basename(path)] = {"tri": tris, "kb": kb}
    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND, copy=True)
    return out
