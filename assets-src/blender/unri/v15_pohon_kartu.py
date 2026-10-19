"""
V15 Pohon & semak kampus UNRI versi KARTU DAUN (gaya kartun, M8 T4). Headless:

    blender.exe -b --python-expr "import runpy;print(runpy.run_path(r'<repo>\\assets-src\\blender\\unri\\v15_pohon_kartu.py')['build']())"

Tata letak batang, cabang, dan pusat gumpalan IDENTIK dengan v11_pohon_kampus.py (skrip itu dipanggil; `Acc` diganti agar
limb jadi batang ber-UV dan gumpalan jadi gerombol kartu). Perbedaan:
  - Batang/cabang: tabung ber-UV silinder dalam METER (u = keliling / 1 m, v = panjang / 1 m, kelipatan bulat bila keliling >= 0,75 m)
    sehingga tekstur kulit `Bark001` (tile 1 m, dipasang runtime lewat nama material `unri:kulit-kayu`) tidak melar.
  - Tajuk: 8-14 kartu melengkung (3x2 simpul = 4 segitiga) per gerombol, tersebar di kulit bola kecil di sekitar pusat gerombol,
    normal simpul dibengkokkan ke luar dari pusat gerombol (shading bola) + sedikit ke atas; UV ke varian atlas daun
    (public/textures/daun/atlas.webp; persegi UV = ruang Blender dari public/textures/manifest.json `atlases[daun]`).
    Material `unri:daun-kartu` (alpha-test dipasang runtime).
  - LOD1 = gumpalan halus seperti V11-V14 (material unri:*), tanpa kartu.
Origin = dasar batang di tanah, Z atas (Blender) -> Y atas (three.js).
"""
import json
import math
import os
import random
import runpy

import bmesh
import bpy
from mathutils import Vector

try:  # repo = tiga tingkat di atas skrip ini (juga benar di git worktree); cadangan bila dijalankan via MCP tanpa __file__
    REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
except NameError:
    REPO = r"C:\Users\mocha\Documents\stadion-utama-riau-3d"
HERE = os.path.join(REPO, "assets-src", "blender", "unri")
OUT_DIR = os.path.join(REPO, "public", "models", "unri")
OUT_BLEND = os.path.join(HERE, "v15_pohon_kartu.blend")
MANIFEST = os.path.join(REPO, "public", "textures", "manifest.json")

BARK_MAT = "unri:kulit-kayu"
CARD_MAT = "unri:daun-kartu"
TILE_M = 1.0

# nama berkas -> (kunci spesifikasi v11, kartu per gerombol, varian atlas bergiliran)
VARIANTS = {
    "v15-pohon-ramping": ("v11-pohon-ramping", 10, ("mahoni", "akasia", "mahoni", "rimbun")),
    "v15-pohon-kecil": ("v12-pohon-kecil", 8, ("rimbun", "mahoni", "semak")),
    "v15-pohon-lurus": ("v13-pohon-lurus", 10, ("akasia", "mahoni", "akasia", "rimbun")),
    "v15-semak": ("v14-semak", 12, ("semak", "rimbun", "mahoni")),
}


def _rects():
    with open(MANIFEST, encoding="utf-8") as f:
        atlas = next(a for a in json.load(f)["atlases"] if a["name"] == "daun")
    return {v["id"]: v["blender"] for v in atlas["variants"]}


def _material(name, color):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = 0.9
    return m


class CardAcc:
    """Pengganti Acc v11: limb -> tabung ber-UV (bmesh kulit), clump -> catat (dirakit jadi kartu sesudahnya)."""

    def __init__(self):
        self.bark = bmesh.new()
        self.uv = self.bark.loops.layers.uv.new("UVMap")
        self.clumps = []
        self.rng = random.Random(7)

    def limb(self, p0, p1, r0, r1, seg=6, mat="unri:kulit-kayu"):
        p0, p1 = Vector(p0), Vector(p1)
        axis = p1 - p0
        length = axis.length
        if length < 1e-6:
            return
        axis.normalize()
        ref = Vector((1, 0, 0)) if abs(axis.x) < 0.9 else Vector((0, 1, 0))
        a = axis.cross(ref).normalized()
        b = axis.cross(a)
        circ = math.tau * max(r0, r1)
        urep = max(1.0, round(circ / TILE_M)) if circ >= 0.75 else circ / TILE_M
        v0 = self.rng.uniform(0, 1)
        rings = []
        for end, (p, r) in enumerate(((p0, r0), (p1, r1))):
            rings.append([self.bark.verts.new(p + (a * math.cos(i * math.tau / seg) + b * math.sin(i * math.tau / seg)) * r)
                          for i in range(seg + 1)])
        for i in range(seg):
            f = self.bark.faces.new((rings[0][i], rings[0][i + 1], rings[1][i + 1], rings[1][i]))
            f.smooth = True
            us = (i / seg * urep, (i + 1) / seg * urep)
            coords = ((us[0], v0), (us[1], v0), (us[1], v0 + length / TILE_M), (us[0], v0 + length / TILE_M))
            for loop, uv in zip(f.loops, coords):
                loop[self.uv].uv = uv

    def clump(self, c, radius, rng, light, flat=0.72, subdiv=1):
        self.clumps.append((Vector(c), radius))
        # jaga urutan acak v11 tetap sama dengan pembuatan gumpalan asli (tata letak batang identik)
        for _ in range(0):
            rng.uniform(0, 1)


def _basis(n, rng):
    up = Vector((0, 0, 1)) - n * n.z
    if up.length < 0.15:
        up = Vector((1, 0, 0)) - n * n.x
    up.normalize()
    right = up.cross(n).normalized()
    roll = rng.uniform(-0.7, 0.7)
    cr, sr = math.cos(roll), math.sin(roll)
    return right * cr + up * sr, up * cr - right * sr


def _cards_mesh(clumps, n_cards, order, rects, rng, name):
    """Satu mesh kartu untuk semua gerombol; normal simpul = arah dari pusat gerombol (+ condong ke atas)."""
    verts, faces, uvs, centers = [], [], [], []
    k = 0
    for ci, (c, radius) in enumerate(clumps):
        for j in range(n_cards):
            z = rng.uniform(-0.2, 1.0)
            ang = rng.uniform(0, math.tau)
            r = math.sqrt(max(0.0, 1 - z * z))
            n = Vector((r * math.cos(ang), r * math.sin(ang), z))
            pos = c + n * radius * rng.uniform(0.22, 0.5)
            size = radius * rng.uniform(1.6, 2.05)
            right, up = _basis(n, rng)
            bend = size * 0.15
            rect = rects[order[(ci + j) % len(order)]]
            base = len(verts)
            for cy in (-0.5, 0.5):
                for cx in (-0.5, 0.0, 0.5):
                    verts.append(pos + right * (cx * size) + up * (cy * size) + n * (bend * (1 - (2 * cx) ** 2) - bend * 0.5))
                    centers.append(c)
                    uvs.append((rect["u0"] + (cx + 0.5) * (rect["u1"] - rect["u0"]), rect["v0"] + (cy + 0.5) * (rect["v1"] - rect["v0"])))
            faces.append((base, base + 1, base + 4, base + 3))
            faces.append((base + 1, base + 2, base + 5, base + 4))
            k += 1
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    uvl = me.uv_layers.new(name="UVMap")
    for loop in me.loops:
        uvl.data[loop.index].uv = uvs[loop.vertex_index]
    me.update()
    normals = []
    for loop in me.loops:
        d = me.vertices[loop.vertex_index].co - centers[loop.vertex_index]
        d = d.normalized() if d.length > 1e-6 else Vector((0, 0, 1))
        normals.append(tuple((d + Vector((0, 0, 0.35))).normalized()))
    me.normals_split_custom_set(normals)
    me.materials.append(_material(CARD_MAT, (0.2, 0.45, 0.15, 1.0)))
    return me


def _collection(name):
    for cn in (name,):
        c = bpy.data.collections.get(cn)
        if c:
            for o in list(c.objects):
                bpy.data.objects.remove(o, do_unlink=True)
            bpy.data.collections.remove(c)
    coll = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(coll)
    return coll


def _export_selected(coll, path):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    tris = 0
    for o in coll.objects:
        o.select_set(True)
        o.data.calc_loop_triangles()
        tris += len(o.data.loop_triangles)
    bpy.context.view_layer.objects.active = coll.objects[0]
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=False, export_yup=True,
                              export_normals=True, export_texcoords=True, export_materials="EXPORT")
    return tris, round(os.path.getsize(path) / 1024)


def build(only=None):
    v11 = runpy.run_path(os.path.join(HERE, "v11_pohon_kampus.py"))
    tree_fn = v11["_tree"]
    glob = tree_fn.__globals__
    OrigAcc = glob["Acc"]
    specs = v11["VARIANTS"]
    rects = _rects()
    export_collection = runpy.run_path(os.path.join(REPO, "assets-src", "blender", "export_glb.py"))["export_collection"]
    out = {}
    for fname, (key, n_cards, order) in VARIANTS.items():
        if only and fname not in only:
            continue
        spec = specs[key]
        glob["Acc"] = CardAcc
        try:
            acc = tree_fn(spec, False)
        finally:
            glob["Acc"] = OrigAcc
        cname = f"SUR_{fname}"
        coll = _collection(cname)
        if len(acc.bark.verts):
            me = bpy.data.meshes.new(f"{fname}_kulit")
            acc.bark.to_mesh(me)
            acc.bark.free()
            me.materials.append(_material(BARK_MAT, (0.36, 0.27, 0.21, 1.0)))
            coll.objects.link(bpy.data.objects.new(me.name, me))
        else:
            acc.bark.free()
        rng = random.Random(spec["seed"] + 150)
        cards = _cards_mesh(acc.clumps, n_cards, order, rects, rng, f"{fname}_daun")
        coll.objects.link(bpy.data.objects.new(cards.name, cards))
        tris, kb = _export_selected(coll, os.path.join(OUT_DIR, f"{fname}.glb"))
        out[f"{fname}.glb"] = {"tri": tris, "kb": kb, "clumps": len(acc.clumps)}
        # LOD1: gumpalan halus V11-V14 (material unri:*)
        lname = f"SUR_{fname}_lod"
        v11["_emit"](lname, tree_fn(spec, True))
        n_mesh, ltris, lkb = export_collection(lname, os.path.join(OUT_DIR, f"{fname}-lod.glb"))
        out[f"{fname}-lod.glb"] = {"tri": ltris, "kb": lkb}
    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND, copy=True)
    return out
