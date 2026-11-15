"""
Pack orang low poly (FBX kiriman user 2026-11-15, mentah di data-src/vendor-people/, TIDAK di-commit: lisensi
pack tidak disertakan) → GLB untuk web.

    "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" -b --python-expr
      "import runpy;print(runpy.run_path(r'<repo>\\assets-src\\blender\\orang\\orang_pack.py')['build_all']())"

Keluaran public/models/orang/:
- <id>.glb   : satu karakter ber-skin (rig biped 29 tulang "bip …", sama untuk semua), TANPA tekstur (palet dimuat
               sekali di runtime: src/entities/Orang.js) dan tanpa animasi.
- anim.glb   : hanya armature + semua klip animasi terpilih (nama klip = kunci ANIM di bawah).
Ukuran meter, tinggi ±1,7 m; depan karakter = +Z three (ditangani runtime bila perlu).
"""
import math
import os

import bpy
import mathutils

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
SRC = os.path.join(r"C:\Users\mocha\Documents\stadion-utama-riau-3d", "data-src", "vendor-people")
OUT = os.path.join(REPO, "public", "models", "orang")

KARAKTER = {
    "kasual-wanita-g": "casual_Female_G.fbx",
    "kasual-wanita-k": "casual_Female_K.fbx",
    "kasual-pria-g": "casual_Male_G.fbx",
    "kasual-pria-k": "casual_Male_K.fbx",
    "dokter-pria": "Doctor_Male_B.fbx",
    "lansia-wanita": "elder_Female_A.fbx",
    "anak-laki": "little_boy_B.fbx",
    "polisi-wanita": "police_Female_A.fbx",
    "pekerja-pria": "worker_Male_constructor_B.fbx",
}

ANIM = {
    "diam-p": "idle_m_1_200f.fbx",
    "diam-w": "idle_f_1_150f.fbx",
    "diam-p2": "idle_m_2_220f.fbx",
    "diam-w2": "idle_f_2_190f.fbx",
    "telepon": "idle_phoneTalking_180f.fbx",
    "cek-diri": "idle_selfcheck_1_300f.fbx",
    "jalan-p": "locom_m_basicWalk_30f.fbx",
    "jalan-w": "locom_f_basicWalk_30f.fbx",
    "jalan-santai-p": "locom_m_slowWalk_40f.fbx",
    "jalan-santai-w": "locom_f_slowWalk_40f.fbx",
    "jalan-telepon-p": "locom_m_phoneWalking_40f.fbx",
    "jalan-telepon-w": "locom_f_phoneWalking_40f.fbx",
    "jogging-p": "locom_m_jogging_30f.fbx",
    "jogging-w": "locom_f_jogging_30f.fbx",
    "lari-p": "locom_m_running_20f.fbx",
    "lari-w": "locom_f_running_20f.fbx",
    "pemanasan": "exercise_warmingUp_170f.fbx",
    "joget": "dance_hype_100f.fbx",
    "palu": "ani_wtool_hammerUse.fbx",
}


def _empty():
    bpy.ops.wm.read_homefile(use_empty=True)


def _import(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=path, use_anim=True)
    return [o for o in bpy.data.objects if o not in before]


NORMALIZE = os.environ.get("ORANG_NORMALIZE", "1") == "1"


def _normalize(objs):
    """Lepas parent rig_CharRoot (skala 0,01) lalu terapkan rotasi+skala ke armature & mesh: semua dalam meter tanpa
    skala tersembunyi (tanpa ini matriks bind skin ×100 vs tulang ×0,01 → vertex mengerut/terlempar di three.js)."""
    arm = next(o for o in objs if o.type == "ARMATURE")
    meshes = [o for o in objs if o.type == "MESH"]
    if not NORMALIZE:
        return arm, meshes
    tulang = {o.name: o.parent_bone for o in meshes if o.parent_type == "BONE"}  # mesh kaku (rambut dll.) di tulang
    bpy.ops.object.select_all(action="DESELECT")
    for o in [arm, *meshes]:
        o.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)  # lokasi juga: aksesori berpusat di kepala
    # Mesh FBX tersimpan Y-atas (gaya Unity) sedangkan kerangka Z-atas: mesh rebah 90° terhadap tulang. Putar datanya.
    for o in meshes:
        world = o.matrix_world.copy()
        if o.name in tulang:  # kaku: sudah benar di dunia; tempel lagi ke tulangnya agar ikut animasi
            o.parent = arm
            o.parent_type = "BONE"
            o.parent_bone = tulang[o.name]
            o.matrix_world = world
            continue
        o.data.transform(mathutils.Matrix.Rotation(math.radians(90), 4, "X"))
        o.parent = arm
        o.matrix_parent_inverse = arm.matrix_world.inverted()
    for o in [o for o in objs if o.type == "EMPTY"]:
        bpy.data.objects.remove(o, do_unlink=True)
    return arm, meshes


def _export(path, objs, animations):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    kw = dict(filepath=path, export_format="GLB", use_selection=True, export_yup=True, export_apply=False,
              export_skins=True, export_animations=animations, export_materials="NONE", export_texcoords=True,
              export_normals=True)
    if animations:
        kw.update(export_animation_mode="ACTIONS", export_force_sampling=True, export_frame_step=1,
                  export_def_bones=True, export_optimize_animation_size=True)
    bpy.ops.export_scene.gltf(**kw)
    return os.path.getsize(path) // 1024


def build_karakter(key, fname):
    _empty()
    objs = _import(os.path.join(SRC, fname))
    for a in list(bpy.data.actions):
        bpy.data.actions.remove(a)
    for o in objs:
        if o.animation_data:
            o.animation_data_clear()
    arm, meshes = _normalize(objs)
    arm.data.pose_position = "REST"
    objs = [arm, *meshes]
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)
    kb = _export(os.path.join(OUT, f"{key}.glb"), objs, animations=False)
    return {"id": key, "segitiga": tris, "kb": kb, "tinggi": round(max(o.dimensions.z for o in meshes), 2)}


def build_anim():
    _empty()
    base = None
    keep = []
    for key, fname in ANIM.items():
        objs = _import(os.path.join(SRC, "Animations.fbx", fname))
        arm, _m = _normalize(objs)
        objs = [arm, *_m]
        act = arm.animation_data.action if arm.animation_data else None
        if act is None:
            raise RuntimeError(f"{fname}: armature tanpa aksi")
        act.name = key
        act.use_fake_user = True
        keep.append(act)
        if base is None:
            base = arm
            base_objs = objs
        else:
            for o in objs:
                bpy.data.objects.remove(o, do_unlink=True)
    # buang aksi lain (root/rig_CharRoot) agar hanya klip tulang yang terekspor
    for a in list(bpy.data.actions):
        if a not in keep:
            bpy.data.actions.remove(a)
    rest = [o for o in base_objs if o.type != "MESH"]
    for o in [o for o in base_objs if o.type == "MESH"]:
        bpy.data.objects.remove(o, do_unlink=True)
    # tiap aksi jadi trek NLA pada armature dasar → ACTIONS mode mengekspor semuanya
    base.animation_data.action = None
    for act in keep:
        tr = base.animation_data.nla_tracks.new()
        tr.name = act.name
        tr.strips.new(act.name, int(act.frame_range[0]), act)
        tr.mute = True
    kb = _export(os.path.join(OUT, "anim.glb"), rest, animations=True)
    return {"anim": len(keep), "kb": kb}


def build_all():
    os.makedirs(OUT, exist_ok=True)
    out = [build_karakter(k, f) for k, f in KARAKTER.items()]
    out.append(build_anim())
    return out


def build_anim_saja():
    os.makedirs(OUT, exist_ok=True)
    return build_anim()
