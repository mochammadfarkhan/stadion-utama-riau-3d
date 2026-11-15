"""
Rig karakter jadi (GLB kiriman user di sumber/preset/*.glb, A-pose, tanpa rig) → GLB ber-skin siap game.

Per model: semua mesh digabung jadi SATU mesh (1 draw call), warna material → atribut warna vertex (linear),
lengan A-pose diputar tegak ke bawah (rest pose game: lengan menggantung lurus), lalu armature 13 tulang
bernama SAMA dengan pivot Humanoid (body, spine, headPivot, shoulder/elbow/hand L/R, hip/knee L/R) dan bobot
dihitung geometris (peralihan halus di bahu, siku, pergelangan, pinggul, lutut, leher). Hasil:
  public/models/karakter/preset-<id>.glb   (dimuat game, Humanoid.preset.js)
  assets-src/blender/karakter/sumber/preset/<id>-rig.blend   (untuk diperhalus manual di Blender)

Koordinat Blender: +X kiri-model (L), -Y depan (= +Z game), +Z atas. Model menghadap +Z glTF.
Jalankan: blender -b --python-expr "import runpy;print(runpy.run_path(r'<skrip ini>')['build']())"
"""
import math
import os

import bpy
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
SRC = os.path.join(ROOT, 'assets-src', 'blender', 'karakter', 'sumber', 'preset')
OUT = os.path.join(ROOT, 'public', 'models', 'karakter')
PRESETS = ('tactical_blonde', 'tactical_hijab', 'cardigan_hijab')

# Titik sendi (diukur dari model; ketiga model berbagi badan dasar yang sama).
HIP_Z = 0.89            # body/spine + pinggul
HIP_X = 0.095
KNEE_Z = 0.48
NECK_Z = 1.37
SHOULDER = (0.154, 1.30)  # (x, z) bahu kiri; kanan dicerminkan
ARM_TILT = math.radians(31.5)  # sudut A-pose dari vertikal
UPPER_ARM = 0.19
LOWER_ARM = 0.23        # siku → titik pegang (tengah telapak)
ARM_R = 0.075           # jari-jari tabung lengan (+lengan baju)

BONES = ('body', 'spine', 'headPivot', 'shoulderL', 'elbowL', 'handL', 'shoulderR', 'elbowR', 'handR',
         'hipL', 'kneeL', 'hipR', 'kneeR')
PARENT = {'spine': 'body', 'headPivot': 'spine', 'shoulderL': 'spine', 'elbowL': 'shoulderL', 'handL': 'elbowL',
          'shoulderR': 'spine', 'elbowR': 'shoulderR', 'handR': 'elbowR', 'hipL': 'body', 'kneeL': 'hipL',
          'hipR': 'body', 'kneeR': 'hipR'}
HEAD_ONLY = ('Hair',)          # rambut (termasuk kuncir) ikut kepala sepenuhnya
PELVIS_ONLY = ('Outfit_Cardigan',)
HAND_MATS = ('handbag', 'watch_band')  # tas jinjing & tali jam ikut tangan sepenuhnya  # ujung kardigan di bawah pinggul ikut panggul, bukan paha


def ramp(v, a, b):
    """0 di a, 1 di b (linier, dijepit)."""
    if b == a:
        return 1.0 if v >= b else 0.0
    return max(0.0, min(1.0, (v - a) / (b - a)))


ARM_SKIN = ('Arms', 'Limbs')  # mesh kulit lengan (Limbs juga berisi kaki: hanya z > ARM_MIN_Z)
ARM_MIN_Z = 0.8
BIN = 0.02


def inner_profile(objs):
    """Sisi DALAM lengan |x| per ketinggian (bin 2 cm) dari mesh kulit lengan: batas badan ↔ lengan."""
    prof = {}
    for o in objs:
        if not o.name.startswith(ARM_SKIN):
            continue
        for v in o.data.vertices:
            p = o.matrix_world @ v.co
            if p.z > ARM_MIN_Z and abs(p.x) > 0.1:
                k = round(p.z / BIN)
                prof[k] = min(prof.get(k, 9.0), abs(p.x))
    return prof


def inner_x(prof, z):
    k = round(z / BIN)
    for dk in (0, -1, 1, -2, 2):
        if k + dk in prof:
            return prof[k + dk]
    return None


def arm_weights(p, side, prof=None, force=False):
    """Bobot lengan {tulang: w} untuk titik p (Vector) di sisi side ('L' x>0 / 'R' x<0), atau None.
    force: titik pasti lengan (mesh kulit lengan). prof: profil sisi dalam lengan (inner_profile)."""
    sx = 1 if side == 'L' else -1
    s = Vector((sx * SHOULDER[0], 0.0, SHOULDER[1]))
    a = Vector((sx * math.sin(ARM_TILT), 0.0, -math.cos(ARM_TILT)))
    d = p - s
    t = d.dot(a)
    perp = (d - a * t).length
    axis_x = sx * SHOULDER[0] + sx * (SHOULDER[1] - p.z) * math.tan(ARM_TILT)
    outward = (p.x - axis_x) * sx  # >0 sisi luar lengan, <0 menuju badan
    far_out = abs(p.x) > 0.26 and p.z > 0.6  # tas jinjing / ujung lengan baju lebar
    xin = inner_x(prof, p.z) if prof else None
    tol = 0.015 if p.z > 1.15 else 0.065 # di bawah ketiak badan menyempit: ujung lengan baju boleh lebih ke dalam
    beside = xin is not None and abs(p.x) >= xin - tol and perp < ARM_R + 0.04  # lengan baju menyelubungi
    if not (force or far_out or beside) and (t < -0.03 or perp > ARM_R or outward < -0.05):
        return None
    t = max(t, -0.03)
    on_arm = ramp(t, -0.02, 0.06)
    elbow = ramp(t, UPPER_ARM - 0.04, UPPER_ARM + 0.04)
    hand = ramp(t, UPPER_ARM + LOWER_ARM - 0.06, UPPER_ARM + LOWER_ARM)
    w = {'spine': 1 - on_arm,
         f'shoulder{side}': on_arm * (1 - elbow),
         f'elbow{side}': on_arm * elbow * (1 - hand),
         f'hand{side}': on_arm * elbow * hand}
    return w


def body_weights(p, obj_name):
    """Bobot badan/kepala/kaki untuk titik di luar lengan."""
    if obj_name.startswith(HEAD_ONLY):
        return {'headPivot': 1.0}
    if p.z >= HIP_Z + 0.02:
        head = ramp(p.z, NECK_Z - 0.04, NECK_Z + 0.04)
        spine = ramp(p.z, HIP_Z + 0.02, HIP_Z + 0.14)
        return {'body': 1 - spine, 'spine': spine * (1 - head), 'headPivot': spine * head}
    if obj_name.startswith(PELVIS_ONLY) and abs(p.x) > 0.06 or obj_name.startswith(PELVIS_ONLY) and p.z > 0.75:
        return {'body': 1.0}
    leg = ramp(HIP_Z + 0.02 - p.z, 0.0, 0.12)
    knee = ramp(KNEE_Z + 0.05 - p.z, 0.0, 0.10)
    left = ramp(p.x, -0.025, 0.025)  # selangkangan dibagi rata
    w = {'body': 1 - leg}
    for side, share in (('L', left), ('R', 1 - left)):
        w[f'hip{side}'] = leg * share * (1 - knee)
        w[f'knee{side}'] = leg * share * knee
    return w


def straightened(p, w):
    """Putar titik lengan dari A-pose ke tegak (sudut dicampur bobot lengan agar ketiak tidak sobek)."""
    for side, sx in (('L', 1), ('R', -1)):
        arm = w.get(f'shoulder{side}', 0) + w.get(f'elbow{side}', 0) + w.get(f'hand{side}', 0)
        if arm <= 0:
            continue
        ang = -sx * ARM_TILT * arm
        s = Vector((sx * SHOULDER[0], 0.0, SHOULDER[1]))
        d = p - s
        c, si = math.cos(ang), math.sin(ang)
        return s + Vector((d.x * c - d.z * si, d.y, d.x * si + d.z * c))
    return p


def joint_heads():
    """Posisi kepala tulang (Blender) pada rest pose lengan tegak."""
    h = {'body': (0, 0, HIP_Z), 'spine': (0, 0, HIP_Z), 'headPivot': (0, 0, NECK_Z)}
    for side, sx in (('L', 1), ('R', -1)):
        x, z = sx * SHOULDER[0], SHOULDER[1]
        h[f'shoulder{side}'] = (x, 0, z)
        h[f'elbow{side}'] = (x, 0, z - UPPER_ARM)
        h[f'hand{side}'] = (x, 0, z - UPPER_ARM - LOWER_ARM)
        h[f'hip{side}'] = (sx * HIP_X, 0, HIP_Z)
        h[f'knee{side}'] = (sx * HIP_X, 0, KNEE_Z)
    return h


def tail_of(name, heads):
    child = next((c for c, par in PARENT.items() if par == name and c not in ('shoulderL', 'shoulderR', 'hipL', 'hipR')), None)
    hx, hy, hz = heads[name]
    if child:
        cx, cy, cz = heads[child]
        if (Vector((cx, cy, cz)) - Vector((hx, hy, hz))).length > 1e-3:
            return (cx, cy, cz)
    if name == 'body':
        return (hx, hy, hz - 0.1)
    if name == 'headPivot':
        return (hx, hy, hz + 0.25)
    if name.startswith('knee'):
        return (hx, hy, 0.05)
    if name.startswith('hand'):
        return (hx, hy, hz - 0.08)
    return (hx, hy, hz + 0.1)


def srgb_to_linear(v):
    return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4


def bake_vertex_colors(obj):
    """Warna dasar material per poligon → atribut warna sudut FLOAT (linear), lalu satu material polos.
    Angka baseColor di GLB kiriman ternyata nilai sRGB (celana 0.42/0.48/0.31 = hijau zaitun; dibaca linear jadi
    pucat di game), jadi dikonversi sRGB → linear dulu. [INFERENSI] dari perbandingan bidikan, bukan dari pembuat model."""
    me = obj.data
    attr = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
    cols = []
    for m in me.materials:
        c = (0.8, 0.8, 0.8, 1.0)
        if m and m.use_nodes:
            bsdf = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
            if bsdf:
                r, g, b, a = bsdf.inputs['Base Color'].default_value
                c = (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), a)
        cols.append(c)
    for poly in me.polygons:
        c = cols[poly.material_index] if cols else (0.8, 0.8, 0.8, 1.0)
        for li in poly.loop_indices:
            attr.data[li].color = c
    me.color_attributes.active_color = attr
    mat = bpy.data.materials.new('preset_vc')
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    vc = nodes.new('ShaderNodeVertexColor')
    vc.layer_name = 'Col'
    mat.node_tree.links.new(vc.outputs['Color'], bsdf.inputs['Base Color'])
    me.materials.clear()
    me.materials.append(mat)


def rig_one(pid):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, f'{pid}.glb'))
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    # Bobot dihitung per objek sumber (aturan per bagian: rambut, kardigan) sebelum digabung.
    per_obj = {}
    prof = inner_profile(meshes)
    for o in meshes:
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        o.select_set(False)
        ws = []
        hand_mat = {i for i, m in enumerate(o.data.materials) if m and m.name.startswith(HAND_MATS)}
        hand_verts = {vi for poly in o.data.polygons if poly.material_index in hand_mat for vi in poly.vertices}
        for v in o.data.vertices:
            p = v.co.copy()
            w = None
            if v.index in hand_verts:
                w = {f"hand{'L' if p.x > 0 else 'R'}": 1.0}
            skin = o.name.startswith(ARM_SKIN) and p.z > ARM_MIN_Z
            if w is None and not o.name.startswith(HEAD_ONLY) and abs(p.x) > 0.08 and p.z > 0.6:
                w = arm_weights(p, 'L' if p.x > 0 else 'R', prof, force=skin)
            if w is None:
                w = body_weights(p, o.name)
            ws.append(w)
        for name in BONES:
            o.vertex_groups.new(name=name)
        for v, w in zip(o.data.vertices, ws):
            for b, val in w.items():
                if val > 1e-4:
                    o.vertex_groups[b].add([v.index], val, 'REPLACE')
            v.co = straightened(v.co.copy(), w)
        per_obj[o.name] = len(ws)
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    body = bpy.context.view_layer.objects.active
    body.name = f'preset_{pid}'
    body.data.name = body.name
    bake_vertex_colors(body)

    arm_data = bpy.data.armatures.new(f'rig_{pid}')
    arm = bpy.data.objects.new(f'rig_{pid}', arm_data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    heads = joint_heads()
    eb = {}
    for name in BONES:
        b = arm_data.edit_bones.new(name)
        b.head = heads[name]
        b.tail = tail_of(name, heads)
        eb[name] = b
    for name, par in PARENT.items():
        eb[name].parent = eb[par]
    bpy.ops.object.mode_set(mode='OBJECT')
    body.parent = arm
    mod = body.modifiers.new('Armature', 'ARMATURE')
    mod.object = arm

    os.makedirs(OUT, exist_ok=True)
    blend = os.path.join(SRC, f'{pid}-rig.blend')
    bpy.ops.wm.save_as_mainfile(filepath=blend)
    for o in bpy.context.scene.objects:
        o.select_set(o in (arm, body))
    out = os.path.join(OUT, f'preset-{pid}.glb')
    kw = dict(filepath=out, export_format='GLB', use_selection=True, export_skins=True, export_animations=False,
              export_morph=False, export_yup=True, export_apply=False, export_normals=True,
              export_texcoords=False)
    try:
        bpy.ops.export_scene.gltf(**kw, export_vertex_color='ACTIVE')
    except TypeError:
        bpy.ops.export_scene.gltf(**kw, export_colors=True)
    tris = sum(len(p.vertices) - 2 for p in body.data.polygons)
    return f'{pid}: {tris} tris, {len(body.data.vertices)} verts, parts={per_obj} → {os.path.relpath(out, ROOT)}'


def build():
    return '\n'.join(rig_one(pid) for pid in PRESETS)
