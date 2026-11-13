"""
Render pembanding (Blender): model dalam A-pose rujukan, tanpa cahaya (tekstur × warna vertex), latar transparan,
kamera ortografik yang dikalibrasi SAMA dengan tiap tampak lembar rujukan → <out>/<pid>_<tampak>.png berukuran
sama dengan kolom tampak itu. Dinilai oleh skor_rujukan.py (Python sistem).
Jalankan: blender -b --python-expr "import runpy;print(runpy.run_path(r'<skrip>')['build'](r'<out>'))"
"""
import math
import os
import runpy

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))


def unlit(obj):
    mat = obj.data.materials[0]
    nt = mat.node_tree
    for n in list(nt.nodes):
        if n.type == 'BSDF_PRINCIPLED':
            nt.nodes.remove(n)
    tex = next(n for n in nt.nodes if n.type == 'TEX_IMAGE')
    vc = nt.nodes.new('ShaderNodeVertexColor')
    vc.layer_name = 'Col'
    mix = nt.nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.blend_type = 'MULTIPLY'
    mix.inputs['Factor'].default_value = 1.0
    nt.links.new(tex.outputs['Color'], mix.inputs[6])
    nt.links.new(vc.outputs['Color'], mix.inputs[7])
    emit = nt.nodes.new('ShaderNodeEmission')
    nt.links.new(mix.outputs[2], emit.inputs['Color'])
    nt.links.new(emit.outputs['Emission'], next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL').inputs['Surface'])
    mat.use_backface_culling = False


def build(out, pids=('cardigan_hijab', 'tactical_blonde')):
    K = runpy.run_path(os.path.join(HERE, 'karakter_preset.py'))
    lines = []
    for pid in pids:
        obj, _arm, tris = K['build_one'](pid, export=False, pose='ref')
        data = K['build_one'].__globals__['REF']
        unlit(obj)
        sc = bpy.context.scene
        for o in sc.objects:
            if o.get('rujukan'):
                o.hide_render = True
        try:
            sc.render.engine = 'BLENDER_EEVEE'
        except TypeError:
            sc.render.engine = 'BLENDER_EEVEE_NEXT'
        sc.view_settings.view_transform = 'Standard'
        sc.render.film_transparent = True
        cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
        sc.collection.objects.link(cam)
        sc.camera = cam
        cam.data.type = 'ORTHO'
        H = data['image']['h']
        for k, name in ((0, 'front'), (1, 'side'), (2, 'back')):
            v = data['views'][k]
            s, c, w, bot = v['s'], v['c'], v['w'], v['bot']
            sc.render.resolution_x, sc.render.resolution_y = w, H
            cam.data.ortho_scale = max(w, H) * s
            zc = (bot - H / 2) * s
            if name == 'front':
                cam.location = ((w / 2 - c) * s, -5, zc)
                cam.rotation_euler = (math.radians(90), 0, 0)
            elif name == 'back':
                cam.location = ((c - w / 2) * s, 5, zc)
                cam.rotation_euler = (math.radians(90), 0, math.radians(180))
            else:
                cam.location = (-5, (c - w / 2) * s, zc)
                cam.rotation_euler = (math.radians(90), 0, math.radians(-90))
            sc.render.filepath = os.path.join(out, f'{pid}_{name}.png')
            bpy.ops.render.render(write_still=True)
        lines.append(f'{pid}: {tris} tris')
    return '\n'.join(lines)
