"""
Ekspor koleksi Blender ke GLB siap web (dijalankan di Blender, mis. lewat MCP atau Text Editor).

Langkah: salin semua objek koleksi sumber dengan modifier diterapkan, gabung per material
(1 mesh = 1 draw call per material), kurangi segitiga untuk material berat (decimate),
lalu ekspor hanya koleksi salinan dengan sumbu Y ke atas (three.js).

Pemakaian:
    export_collection("SUR_LancangKuning", r"...\\public\\models\\monumen\\lancang-kuning.glb",
                      ratios={"LK_CatPutih": 0.4})
"""
import os

import bmesh
import bpy


def _merged_copies(src, exp, ratios):
    deps = bpy.context.evaluated_depsgraph_get()
    by_mat = {}
    for o in src.objects:
        if o.type not in ("MESH", "CURVE", "FONT") or not o.material_slots:
            continue
        me = bpy.data.meshes.new_from_object(o.evaluated_get(deps))
        me.transform(o.matrix_world)
        by_mat.setdefault(o.material_slots[0].material.name, []).append(me)
    for mname, meshes in by_mat.items():
        bm = bmesh.new()
        for me in meshes:
            bm.from_mesh(me)
            bpy.data.meshes.remove(me)
        out = bpy.data.meshes.new(f"EX_{mname}")
        bm.to_mesh(out)
        bm.free()
        out.materials.clear()
        out.materials.append(bpy.data.materials[mname])
        for p in out.polygons:
            p.material_index = 0
        ob = bpy.data.objects.new(f"EX_{mname}", out)
        exp.objects.link(ob)
        if mname in ratios:
            bpy.context.view_layer.objects.active = ob
            d = ob.modifiers.new("Kurangi", "DECIMATE")
            d.ratio = ratios[mname]
            bpy.ops.object.modifier_apply(modifier="Kurangi")


def export_collection(src_name, path, ratios=None):
    """Ekspor koleksi `src_name` ke `path`; kembalikan (jumlah mesh, segitiga, KB)."""
    ratios = ratios or {}
    src = bpy.data.collections[src_name]
    exp_name = f"{src_name}_Ekspor"
    exp = bpy.data.collections.get(exp_name) or bpy.data.collections.new(exp_name)
    if exp.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(exp)
    for o in list(exp.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    lcs = bpy.context.view_layer.layer_collection.children
    lcs[exp.name].hide_viewport = False
    _merged_copies(src, exp, ratios)
    tris = 0
    for o in exp.objects:
        o.data.calc_loop_triangles()
        tris += len(o.data.loop_triangles)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.context.view_layer.active_layer_collection = lcs[exp.name]
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_active_collection=True,
                              use_selection=False, export_apply=True, export_yup=True)
    lcs[exp.name].hide_viewport = True
    bpy.context.view_layer.active_layer_collection = lcs[src.name]
    return len(exp.objects), tris, round(os.path.getsize(path) / 1024)
