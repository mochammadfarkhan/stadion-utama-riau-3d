"""
Kit avatar manekin (tanpa wajah) dari base mesh tersegmen CC0 (sumber/StylisedBaseMesh_{Male,Female}.fbx) untuk
Humanoid (src/entities/Humanoid.kit.js). Proporsi realistis (≈ 7,6 kepala), tinggi dinormalkan ke 1,7 m.

Tiap gender g ∈ {m, f} → bagian `{g}_{nama}` dalam ruang pivot Humanoid (origin = pivot, Blender Z-up, menghadap -Y):
  pelvis (pivot body)      torso, neck (pivot spine = body)      head (pivot kepala = puncak leher)
  arm_upper_{l,r} (bahu)   arm_lower_{l,r}, hand_{l,r} (siku)    leg_thigh_{l,r} (pinggul)   leg_shin_{l,r}, foot_{l,r} (lutut)
Lengan & kaki A-pose diluruskan ke bawah (rotasi segmen kaku di sekitar sendi), telapak kaki dikembalikan datar.
Ukuran rig (koordinat three: x, y atas, z depan; meter) disimpan di node kosong `rig_{g}` (glTF extras → userData).

Jalankan:
  blender -b --python-expr "import runpy;print(runpy.run_path(r'<skrip>')['build']())"
"""
import os
import re
import runpy

import bpy
from mathutils import Matrix, Quaternion, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = {'m': os.path.join(HERE, 'sumber', 'StylisedBaseMesh_Male.fbx'), 'f': os.path.join(HERE, 'sumber', 'StylisedBaseMesh_Female.fbx')}
OUT = os.path.join(HERE, '..', '..', '..', 'public', 'models', 'karakter', 'manekin-kit.glb')
HEIGHT = 1.7
DOWN = Vector((0, 0, -1))
SIDES = ('l', 'r')
TARGET_QUADS = 96  # per segmen halus (≈ 192 segitiga)
BREAST = 0.75      # skala segmen dada wanita terhadap pusatnya


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def key(name):
    """Nama segmen FBX → kunci seragam (M_Shoulders_L / F_Shoulder_L → shoulder_l; F_Elbow → elbow_l)."""
    n = re.sub(r'\.\d+$', '', name.lower())[2:]
    n = n.replace('shoulders', 'shoulder')
    return 'elbow_l' if n == 'elbow' else n


def import_segments(path):
    """Impor FBX; hanya objek baru dari impor ini (bagian gender sebelumnya tidak tersentuh), ke ruang dunia."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    obs = [o for o in new if o.type == 'MESH']
    world = {o: o.matrix_world.copy() for o in obs}
    for o in obs:
        o.parent = None
    for o in obs:
        o.data.transform(world[o])
        o.matrix_world = Matrix.Identity(4)
    for o in new:
        if o.type != 'MESH':
            bpy.data.objects.remove(o)
    return {key(o.name): o for o in obs}


def transform_all(segs, m):
    for o in segs.values():
        o.data.transform(m)


def verts(o):
    return [v.co.copy() for v in o.data.vertices]


def bbox(o):
    vs = verts(o)
    lo = Vector([min(v[i] for v in vs) for i in range(3)])
    hi = Vector([max(v[i] for v in vs) for i in range(3)])
    return lo, hi


def center(o):
    lo, hi = bbox(o)
    return (lo + hi) / 2


def far_end(o, ref, frac=0.05):
    """Rata-rata titik terjauh dari `ref` (ujung segmen kapsul = letak sendi berikutnya)."""
    vs = sorted(verts(o), key=lambda v: (v - ref).length, reverse=True)
    top = vs[:max(3, int(len(vs) * frac))]
    return sum(top, Vector()) / len(top)


def rotate_about(obs, pivot, quat):
    m = Matrix.Translation(pivot) @ quat.to_matrix().to_4x4() @ Matrix.Translation(-pivot)
    for o in obs:
        o.data.transform(m)
    return m


def straighten(segs):
    """Lurusan lengan & kaki ke bawah; kembalikan posisi sendi setelahnya."""
    j = {}
    for s in SIDES:
        sh, el = center(segs[f'shoulder_{s}']), center(segs[f'elbow_{s}'])
        wr = far_end(segs[f'lower_arm_{s}'], el)
        fingers = [o for k, o in segs.items() if k.startswith('finger_') and k.endswith(f'_{s}')]
        q1 = (el - sh).rotation_difference(DOWN)
        # Tutup bahu (deltoid) ikut turun separuh sudut lengan: tidak lagi mencuat seperti bantalan A-pose.
        rotate_about([segs[f'shoulder_{s}']], sh, Quaternion().slerp(q1, 0.5))
        m1 = rotate_about([segs[f'upper_arm_{s}'], segs[f'elbow_{s}'], segs[f'lower_arm_{s}'], segs[f'hand_{s}'], *fingers], sh, q1)
        el, wr = m1 @ el, m1 @ wr
        m2 = rotate_about([segs[f'lower_arm_{s}'], segs[f'hand_{s}'], *fingers], el, (wr - el).rotation_difference(DOWN))
        wr = m2 @ wr

        kn = center(segs[f'knee_{s}'])
        # Ujung atas paha masuk ke dalam pinggul: pusat putar = pusat tutup bulatnya (turun sejari-jari paha).
        top = far_end(segs[f'upper_leg_{s}'], kn)
        lo, hi = bbox(segs[f'upper_leg_{s}'])
        hip = top + (kn - top).normalized() * min(hi.x - lo.x, hi.y - lo.y) / 2
        an = far_end(segs[f'lower_leg_{s}'], kn)
        q3 = (kn - hip).rotation_difference(DOWN)
        m3 = rotate_about([segs[f'upper_leg_{s}'], segs[f'knee_{s}'], segs[f'lower_leg_{s}'], segs[f'feet_{s}']], hip, q3)
        kn, an = m3 @ kn, m3 @ an
        q4 = (an - kn).rotation_difference(DOWN)
        m4 = rotate_about([segs[f'lower_leg_{s}'], segs[f'feet_{s}']], kn, q4)
        an = m4 @ an
        rotate_about([segs[f'feet_{s}']], an, (q4 @ q3).inverted())  # telapak kembali datar
        j[s] = {'shoulder': sh, 'elbow': el, 'wrist': wr, 'hip': hip, 'knee': kn, 'ankle': an}
    return j


def reduce(o, target=TARGET_QUADS):
    """Un-subdivide berulang (kubus ter-subdivide: 1536 → 384 → 96 quad) sampai ≤ target; sendi & jari tetap."""
    bpy.context.view_layer.objects.active = o
    while len(o.data.polygons) > target:
        n = len(o.data.polygons)
        mod = o.modifiers.new('kurangi', 'DECIMATE')
        mod.decimate_type = 'UNSUBDIV'
        mod.iterations = 2
        bpy.ops.object.modifier_apply(modifier=mod.name)
        if len(o.data.polygons) >= n:
            break
    for p in o.data.polygons:
        p.use_smooth = True


def part(name, obs, pivot):
    """Gabung segmen jadi satu objek bernama `name` dengan origin di pivot (Blender coords)."""
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    if len(obs) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = ob.data.name = name
    ob.data.transform(Matrix.Translation(-pivot))
    return ob


def three(v):
    """Blender (x, y, z) → three (x, z, -y)."""
    return [round(v.x, 4), round(v.z, 4), round(-v.y, 4)]


def build_gender(g):
    segs = import_segments(SRC[g])
    lo = Vector([min(bbox(o)[0][i] for o in segs.values()) for i in range(3)])
    hi = Vector([max(bbox(o)[1][i] for o in segs.values()) for i in range(3)])
    s = HEIGHT / (hi.z - lo.z)
    mid = (lo + hi) / 2
    transform_all(segs, Matrix.Scale(s, 4) @ Matrix.Translation(Vector((-mid.x, -mid.y, -lo.z))))
    j = straighten(segs)
    for k in ('breast_l', 'breast_r'):
        if k in segs:  # dada wanita dikecilkan (NPC kampus berbaju; sumber sangat menonjol)
            c = center(segs[k])
            segs[k].data.transform(Matrix.Translation(c) @ Matrix.Diagonal((BREAST, BREAST, BREAST, 1)) @ Matrix.Translation(-c))
    for o in segs.values():
        reduce(o)

    pelvis = (j['l']['hip'] + j['r']['hip']) / 2
    neck_vs = sorted(verts(segs['neck']), key=lambda v: v.z, reverse=True)
    neck_top = sum(neck_vs[:max(3, len(neck_vs) // 8)], Vector()) / max(3, len(neck_vs) // 8)
    neck_top.x = 0
    head_lo, head_hi = bbox(segs['head'])
    thigh_lo, thigh_hi = bbox(segs['upper_leg_l'])
    rig = {
        'hipY': round(pelvis.z, 4),
        'hipHalfWidth': round((j['l']['hip'].x - j['r']['hip'].x) / 2, 4),
        'neck': three(neck_top - pelvis),
        'shoulderL': three(j['l']['shoulder'] - pelvis), 'shoulderR': three(j['r']['shoulder'] - pelvis),
        'upperArm': round(sum((j[x]['elbow'] - j[x]['shoulder']).length for x in SIDES) / 2, 4),
        'lowerArm': round(sum((j[x]['wrist'] - j[x]['elbow']).length for x in SIDES) / 2, 4),
        'thigh': round(sum((j[x]['knee'] - j[x]['hip']).length for x in SIDES) / 2, 4),
        'shin': round(sum((j[x]['ankle'] - j[x]['knee']).length for x in SIDES) / 2, 4),
        'thighR': round(min(thigh_hi.x - thigh_lo.x, thigh_hi.y - thigh_lo.y) / 2, 4),
        'headCenter': three((head_lo + head_hi) / 2 - neck_top),
        'headHalf': [round((head_hi.x - head_lo.x) / 2, 4), round((head_hi.z - head_lo.z) / 2, 4), round((head_hi.y - head_lo.y) / 2, 4)],
    }

    # Baju & aksesori dibuat dari segmen yang sudah lurus SEBELUM segmen digabung per bagian (manekin_baju.py).
    baju = runpy.run_path(os.path.join(HERE, 'manekin_baju.py'))['build_clothes'](g, segs, j, pelvis, neck_top)
    obs = baju + [
        part(f'{g}_pelvis', [segs['hips']], pelvis),
        part(f'{g}_torso', [segs[k] for k in ('stomach', 'chest', 'breast_l', 'breast_r') if k in segs], pelvis),
        part(f'{g}_neck', [segs['neck']], pelvis),
        part(f'{g}_head', [segs['head']], neck_top),
    ]
    for x in SIDES:
        fingers = [o for k, o in segs.items() if k.startswith('finger_') and k.endswith(f'_{x}')]
        obs += [
            part(f'{g}_arm_upper_{x}', [segs[f'shoulder_{x}'], segs[f'upper_arm_{x}']], j[x]['shoulder']),
            part(f'{g}_arm_lower_{x}', [segs[f'elbow_{x}'], segs[f'lower_arm_{x}']], j[x]['elbow']),
            part(f'{g}_hand_{x}', [segs[f'hand_{x}'], *fingers], j[x]['elbow']),
            part(f'{g}_leg_thigh_{x}', [segs[f'upper_leg_{x}']], j[x]['hip']),
            part(f'{g}_leg_shin_{x}', [segs[f'knee_{x}'], segs[f'lower_leg_{x}']], j[x]['knee']),
            part(f'{g}_foot_{x}', [segs[f'feet_{x}']], j[x]['knee']),
        ]
    empty = bpy.data.objects.new(f'rig_{g}', None)
    bpy.context.scene.collection.objects.link(empty)
    for k, v in rig.items():
        empty[k] = v
    return obs + [empty], rig


def build(export=True):
    reset()
    stats, objs = {}, []
    for g in ('m', 'f'):
        obs, rig = build_gender(g)
        objs += obs
        stats[f'rig_{g}'] = rig
        stats[f'tri_{g}'] = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in obs if o.type == 'MESH')
        stats[f'parts_{g}'] = len([o for o in obs if o.type == 'MESH'])
    if export:
        os.makedirs(os.path.dirname(OUT), exist_ok=True)
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs:
            o.select_set(True)
        bpy.ops.export_scene.gltf(
            filepath=os.path.abspath(OUT), use_selection=True, export_format='GLB', export_yup=True,
            export_apply=True, export_texcoords=False, export_normals=True, export_materials='NONE',
            export_extras=True, export_animations=False,
        )
        stats['kb'] = round(os.path.getsize(OUT) / 1024, 1)
    return stats
