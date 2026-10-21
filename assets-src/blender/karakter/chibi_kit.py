"""
Kit bagian karakter chibi kartun (kepala+telinga+hidung, wajah mata anime, rambut, hijab, torso berkerah)
untuk Humanoid prosedural (src/entities/Humanoid.kit.js). Semua bagian dibangun parametrik (tanpa sculpt)
sehingga bisa dibuat ulang; koordinat = ruang pivot Humanoid (meter, tinggi dasar 1.7 m):

  - Bagian kepala relatif pivot kepala: pusat kepala di z = CY, wajah menghadap -Y Blender (= +Z three).
  - torso relatif pivot spine (pinggul), pusat torso di z = 0.24.

Ekspor glTF Y-up: (x, y, z) Blender -> (x, z, -y) three. Wajah memakai atribut warna 'Col' (COLOR_0).

Jalankan:
  blender -b --python-expr "import runpy;print(runpy.run_path(r'<skrip>')['build']())"
"""
import math
import os
import runpy

import bmesh
import bpy
from mathutils import Vector

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'public', 'models', 'karakter', 'chibi-kit.glb')
COLL = 'KIT_Chibi'

# Ellipsoid kepala (sedikit lebih lebar dari tinggi; harus serasi dengan DIM.headR = 0.30 di Humanoid.dim.js)
CY = 0.24
HA, HB, HC = 0.31, 0.29, 0.30   # setengah lebar (x), dalam (y), tinggi (z)

# Palet wajah (sRGB hex)
WHITE = 0xffffff
IRIS = 0x4a2e1c
IRIS_LIGHT = 0x9a6638
PUPIL = 0x1a120c
LASH = 0x1c1714
BROW = 0x3a2a1e
MOUTH = 0x9c4a3c
CHEEK = 0xf5a3b0


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def rgb(hexv):
    return tuple(srgb_to_linear(((hexv >> s) & 255) / 255) for s in (16, 8, 0)) + (1.0,)


def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


# ---------------------------------------------------------------- pembuat mesh

class Builder:
    """Kumpulan verts/faces (+warna per vertex opsional) -> objek Blender."""

    def __init__(self):
        self.verts, self.faces, self.cols = [], [], []

    def add(self, verts, faces, color=None):
        base = len(self.verts)
        self.verts += verts
        self.faces += [tuple(i + base for i in f) for f in faces]
        self.cols += [color] * len(verts)

    def to_object(self, name, smooth_shade=True, colored=False):
        me = bpy.data.meshes.new(name)
        me.from_pydata(self.verts, [], self.faces)
        me.validate()
        if colored:
            attr = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
            for i, c in enumerate(self.cols):
                attr.data[i].color = c
        for p in me.polygons:
            p.use_smooth = smooth_shade
        ob = bpy.data.objects.new(name, me)
        bpy.data.collections[COLL].objects.link(ob)
        return ob


def ellipsoid(ob_builder, cx, cy, cz, rx, ry, rz, seg=16, rings=10, color=None):
    verts = [(cx, cy, cz + rz)]
    for r in range(1, rings):
        th = math.pi * r / rings
        for s in range(seg):
            ph = 2 * math.pi * s / seg
            verts.append((cx + rx * math.sin(th) * math.cos(ph), cy + ry * math.sin(th) * math.sin(ph), cz + rz * math.cos(th)))
    verts.append((cx, cy, cz - rz))
    faces = [(0, 1 + (s + 1) % seg, 1 + s) for s in range(seg)]
    for r in range(rings - 2):
        a, b = 1 + r * seg, 1 + (r + 1) * seg
        faces += [(a + s, a + (s + 1) % seg, b + (s + 1) % seg, b + s) for s in range(seg)]
    last = len(verts) - 1
    a = 1 + (rings - 2) * seg
    faces += [(a + s, a + (s + 1) % seg, last) for s in range(seg)]
    ob_builder.add(verts, faces, color)


def head_point(u, v, lift):
    """Titik di permukaan ellipsoid kepala untuk sudut wajah (u ke kanan-model, v ke atas), + lift sepanjang arah."""
    d = (math.sin(u) * math.cos(v), -math.cos(u) * math.cos(v), math.sin(v))
    t = 1 / math.sqrt((d[0] / HA) ** 2 + (d[1] / HB) ** 2 + (d[2] / HC) ** 2)
    k = t + lift
    return (d[0] * k, d[1] * k, CY + d[2] * k)


# ---------------------------------------------------------------- bagian

def build_head():
    b = Builder()
    ellipsoid(b, 0, 0, CY, HA, HB, HC, seg=24, rings=14)
    for s in (-1, 1):  # telinga: elips pipih di samping, sedikit ke belakang
        ellipsoid(b, s * (HA - 0.01), 0.02, CY - 0.03, 0.035, 0.05, 0.065, seg=10, rings=6)
    return b.to_object('head')


def decal_ellipse(b, uc, vc, hu, hv, lift, color, seg=18, rot=0.0):
    verts = [head_point(uc, vc, lift)]
    for i in range(seg):
        a = 2 * math.pi * i / seg
        du, dv = hu * math.cos(a), hv * math.sin(a)
        du, dv = du * math.cos(rot) - dv * math.sin(rot), du * math.sin(rot) + dv * math.cos(rot)
        verts.append(head_point(uc + du, vc + dv, lift))
    b.add(verts, [(0, 1 + i, 1 + (i + 1) % seg) for i in range(seg)], color)


def decal_arc(b, uc, vc, hu, hv, a0, a1, thick_fn, lift, color, seg=16):
    """Pita melengkung di sekitar elips (bulu mata/alis); thick_fn(t) tebal radial (radian) untuk t 0..1."""
    verts, faces = [], []
    for i in range(seg + 1):
        t = i / seg
        a = a0 + (a1 - a0) * t
        th = thick_fn(t)
        for k in (0, th):
            verts.append(head_point(uc + (hu + k) * math.cos(a), vc + (hv + k) * math.sin(a), lift))
    for i in range(seg):
        faces.append((2 * i, 2 * i + 2, 2 * i + 3, 2 * i + 1))
    b.add(verts, faces, color)


def build_face():
    b = Builder()
    for s in (-1, 1):
        uc, vc = s * 0.36, -0.08
        decal_ellipse(b, uc, vc, 0.165, 0.2, 0.002, rgb(WHITE))
        decal_ellipse(b, uc + s * 0.006, vc - 0.015, 0.13, 0.17, 0.004, rgb(IRIS))
        decal_ellipse(b, uc + s * 0.006, vc - 0.085, 0.088, 0.066, 0.005, rgb(IRIS_LIGHT))
        decal_ellipse(b, uc + s * 0.006, vc - 0.015, 0.062, 0.085, 0.006, rgb(PUPIL))
        decal_ellipse(b, uc - s * 0.045, vc + 0.055, 0.042, 0.046, 0.008, rgb(WHITE), seg=10)
        decal_ellipse(b, uc + s * 0.05, vc - 0.08, 0.018, 0.018, 0.008, rgb(WHITE), seg=8)
        # bulu mata atas: tebal di tengah, sayap kecil di sudut luar
        a_out, a_in = (0.0, math.pi) if s > 0 else (math.pi, 0.0)
        decal_arc(b, uc, vc, 0.165, 0.2, a_out - s * 0.25, a_in + s * 0.15,
                  lambda t: 0.02 + 0.035 * math.sin(math.pi * min(1, t * 1.3)), 0.009, rgb(LASH))
        decal_arc(b, uc, vc + 0.3, 0.12, 0.035, math.pi * 0.15, math.pi * 0.85,
                  lambda t: 0.024 * math.sin(math.pi * t) + 0.007, 0.004, rgb(BROW), seg=10)
        decal_ellipse(b, s * 0.56, -0.31, 0.09, 0.05, 0.002, rgb(CHEEK), seg=14)
    # mulut kecil melengkung (senyum tipis)
    decal_arc(b, 0, -0.31, 0.06, 0.03, math.pi * 1.15, math.pi * 1.85,
              lambda t: 0.016 + 0.01 * math.sin(math.pi * t), 0.003, rgb(MOUTH), seg=10)
    ob = b.to_object('face', smooth_shade=True, colored=True)
    outward_normals(ob)
    return ob


def outward_normals(ob):
    """Decal terbuka: balik muka yang normalnya menghadap ke dalam kepala."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bad = [f for f in bm.faces if f.normal.dot(f.calc_center_median() - Vector((0, 0, CY))) < 0]
    bmesh.ops.reverse_faces(bm, faces=bad)
    bm.to_mesh(ob.data)
    bm.free()


def shell(name, cut_fn, offset_fn=None, drape=False, flare_fn=None, keep_fn=None, n_az=32, n_rings=12, thickness=0.0,
          point_fn=None, snap_fn=None):
    """
    Cangkang rambut/hijab parametrik menyelubungi kepala.
      cut_fn(phi) -> parameter potong u (radian sepanjang meridian dari ubun-ubun; > pi/2 = di bawah ekuator).
      offset_fn(phi, u) -> jarak dari kulit kepala (m).
      drape: di bawah ekuator turun lurus (silinder, untuk rambut panjang/hijab) alih-alih mengikuti bola kepala.
      keep_fn(phi, z) -> False untuk melubangi (jendela wajah hijab).
      point_fn(phi, u) -> (x, y, z) menggantikan pemetaan bawaan; snap_fn(co) memindahkan vertex tepi lubang.
    phi = 0 menghadap depan (-Y), positif ke +X.
    """
    flare_fn = flare_fn or (lambda phi, L: 1.0)
    verts, idx = [], {}
    rc = HC
    for r in range(n_rings + 1):
        for a in range(n_az):
            phi = 2 * math.pi * a / n_az
            u = cut_fn(phi) * r / n_rings
            if point_fn:
                idx[(r, a)] = len(verts)
                verts.append(point_fn(phi, u))
                continue
            o = offset_fn(phi, u)
            if not drape or u <= math.pi / 2:
                th = min(u, math.pi * 0.95)
                h, z = math.sin(th), CY + (HC + o) * math.cos(th)
                x, y = (HA + o) * h * math.sin(phi), -(HB + o) * h * math.cos(phi)
            else:
                L = (u - math.pi / 2) * rc
                f = flare_fn(phi, L)
                x, y, z = (HA + o) * f * math.sin(phi), -(HB + o) * f * math.cos(phi), CY - L
            idx[(r, a)] = len(verts)
            verts.append((x, y, z))
    faces = []
    for r in range(n_rings):
        for a in range(n_az):
            q = (idx[(r, a)], idx[(r + 1, a)], idx[(r + 1, (a + 1) % n_az)], idx[(r, (a + 1) % n_az)])
            if keep_fn:
                cx = sum(verts[i][0] for i in q) / 4
                cy = sum(verts[i][1] for i in q) / 4
                cz = sum(verts[i][2] for i in q) / 4
                if not keep_fn(math.atan2(cx, -cy), cz):
                    continue
            faces.append(q[::-1])
    b = Builder()
    b.add(verts, faces)
    ob = b.to_object(name)
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)  # satukan kutub atas
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if sum(f.normal.dot(f.calc_center_median() - Vector((0, 0, CY))) for f in bm.faces) < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    if snap_fn:
        for v in bm.verts:
            if v.is_boundary and keep_fn and v.co.z > CY - 0.4:
                v.co = Vector(snap_fn(tuple(v.co)))
    bm.to_mesh(ob.data)
    bm.free()
    if thickness > 0:
        m = ob.modifiers.new('Tebal', 'SOLIDIFY')
        m.thickness = thickness
        m.offset = 1.0
    return ob


def u_at(zrel):
    """Parameter meridian untuk ketinggian zrel (relatif CY) di bola; < -0 bisa turun ke bawah ekuator (mode bola)."""
    return math.acos(max(-0.97, min(1.0, zrel / HC)))


def front_w(phi, power=2.0):
    return max(0.0, math.cos(phi)) ** power


def tooth(phi, n, amp):
    """Gigi gergaji untuk ujung poni (jumlah n mengelilingi kepala)."""
    t = (phi * n / (2 * math.pi)) % 1.0
    return amp * (1 - abs(2 * t - 1))


def clumps(phi, u, n, amp):
    """Gumpalan helai (punggung bergelombang) makin kuat ke bawah."""
    return amp * (u / math.pi) * (0.5 + 0.5 * math.cos(n * phi))


def zcut_blend(phi, front, side, back):
    c = math.cos(phi)
    return front * max(0, c) ** 2 + side * (1 - c * c) + back * max(0, -c) ** 2


def build_hair():
    obs = []
    # helmet = potongan mangkuk (gaya referensi): poni runcing sampai alis, samping di atas telinga
    obs.append(shell('hair_helmet',
                     lambda p: u_at(zcut_blend(p, 0.11, -0.04, -0.16)) + (0.25 + 0.75 * front_w(p, 0.6)) * tooth(p, 20, 0.22),
                     lambda p, u: 0.034 + 0.012 * math.cos(u) + clumps(p, u, 11, 0.022)))
    obs.append(shell('hair_bob',
                     lambda p: u_at(zcut_blend(p, 0.08, -0.17, -0.19)) + front_w(p, 1.5) * tooth(p, 20, 0.12),
                     lambda p, u: 0.03 + clumps(p, u, 9, 0.022) + 0.02 * (1 - front_w(p)) * (u / math.pi)))
    obs.append(shell('hair_buzz',
                     lambda p: u_at(zcut_blend(p, 0.13, 0.03, -0.1)),
                     lambda p, u: 0.012, n_rings=10))
    # rambut panjang: tirai lurus sampai punggung, poni depan
    long_cut = lambda p: (u_at(0.08) + front_w(p, 1.0) * tooth(p, 20, 0.12)) if math.cos(p) > 0.55 else \
        math.pi / 2 + (0.36 + 0.12 * max(0, -math.cos(p))) / HC
    obs.append(shell('hair_long', long_cut, lambda p, u: 0.03 + clumps(p, u, 9, 0.02), drape=True,
                     flare_fn=lambda p, L: 1.0 + 0.25 * L, n_rings=18))
    # afro: gumpalan besar bergelombang, dahi & wajah tetap terbuka
    obs.append(shell('hair_afro',
                     lambda p: u_at(zcut_blend(p, 0.12, -0.06, -0.2)),
                     lambda p, u: 0.06 + 0.06 * math.sin(min(u, 2.2) * 1.3) + 0.018 * math.sin(6 * p) * math.sin(5 * u),
                     n_az=36, n_rings=14))
    # pet (topi satpam/pengunjung): mahkota sampai dahi + lidah topi ke depan
    pet = shell('hair_cap', lambda p: u_at(zcut_blend(p, 0.13, 0.06, 0.0)), lambda p, u: 0.035, n_az=28, n_rings=8)
    vb = Builder()
    ellipsoid(vb, 0, -(HB + 0.07), CY + 0.135, 0.14, 0.12, 0.012, seg=16, rings=4)
    obs.append(attach(pet, vb))
    # helm proyek: kubah + pinggiran
    hat = shell('hair_hardhat', lambda p: u_at(0.12), lambda p, u: 0.045, n_az=28, n_rings=8)
    hb = Builder()
    ellipsoid(hb, 0, -0.02, CY + 0.115, HA + 0.1, HB + 0.11, 0.014, seg=24, rings=4)
    obs.append(attach(hat, hb))
    hl = shell('hair_bun', lambda p: u_at(zcut_blend(p, 0.08, 0.0, -0.1)) + front_w(p, 1.0) * tooth(p, 20, 0.12),
               lambda p, u: 0.026 + clumps(p, u, 11, 0.015))
    obs.append(hl)
    hb = Builder()
    ellipsoid(hb, 0, 0.09, CY + HC + 0.02, 0.11, 0.11, 0.1, seg=14, rings=8)
    obs.append(attach(hl, hb))
    ht = shell('hair_twintails', lambda p: u_at(zcut_blend(p, 0.08, 0.0, -0.12)) + front_w(p, 1.0) * tooth(p, 20, 0.12),
               lambda p, u: 0.026 + clumps(p, u, 11, 0.015))
    tb = Builder()
    for s in (-1, 1):
        ellipsoid(tb, s * (HA + 0.06), 0.1, CY - 0.06, 0.08, 0.08, 0.2, seg=12, rings=8)
        ellipsoid(tb, s * (HA + 0.02), 0.08, CY + 0.1, 0.05, 0.05, 0.05, seg=8, rings=5)
    obs.append(attach(ht, tb))
    return obs


def attach(ob, builder):
    """Tambah geometri builder ke objek (setelah solidify diterapkan)."""
    apply_mods(ob)
    extra = builder.to_object(ob.name + '_x')
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    extra.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.join()
    return ob


def build_hijab():
    """
    Hijab instan kartun: membungkus kepala rapat, menyelip di bawah dagu (depan mengikuti kepala sampai
    sudut theta_t), lalu menjuntai melebar menutup bahu & dada; ujung depan sedikit lancip.
    Jendela wajah = elips di ruang (phi, z) dengan tepi di-snap mulus.
    """
    win_c, win_hz, win_hp = CY - 0.045, 0.22, 0.8

    def ell(p, z):
        p = math.atan2(math.sin(p), math.cos(p))  # bungkus ke -pi..pi (grid memakai 0..2pi)
        return math.hypot(p / win_hp, (z - win_c) / win_hz)

    def theta_t(p):
        return 1.7 + 0.88 * front_w(p, 1.0)

    def offset(p, z):
        return 0.012 + 0.035 * smooth((ell(p, z) - 1.0) / 0.7)

    def on_head(p, th):
        z0 = CY + HC * math.cos(th)
        o = offset(p, z0)
        h = math.sin(th)
        return ((HA + o) * h * math.sin(p), -(HB + o) * h * math.cos(p), CY + (HC + o) * math.cos(th))

    def bottom_z(p):
        return CY - 0.6 - 0.07 * front_w(p, 3.0)

    def cut(p):
        tt = theta_t(p)
        return tt + (on_head(p, tt)[2] - bottom_z(p)) / HC

    def point(p, u):
        tt = theta_t(p)
        if u <= tt:
            return on_head(p, u)
        x0, y0, z0 = on_head(p, tt)
        L = (u - tt) * HC
        r0 = math.hypot(x0 / HA, y0 / HB)
        r_sh = 1.05 + 0.4 * (1 - front_w(p, 1.0)) - 0.12 * max(0, -math.cos(p))
        r = r0 + (r_sh - r0) * smooth(L / 0.26)
        return (HA * r * math.sin(p), -HB * r * math.cos(p), z0 - L)

    def keep(p, z):
        return ell(p, z) > 1.0

    def snap(co):
        x, y, z = co
        p = math.atan2(x, -y)
        e = ell(p, z)
        p2, z2 = p / e, win_c + (z - win_c) / e
        th = math.acos(max(-1.0, min(1.0, (z2 - CY) / (HC + 0.012))))
        o = 0.012
        return ((HA + o) * math.sin(th) * math.sin(p2), -(HB + o) * math.sin(th) * math.cos(p2), z2)

    return shell('hijab', cut, keep_fn=keep, point_fn=point, snap_fn=snap, n_az=44, n_rings=22)


def build_torso():
    b = Builder()
    w, h, d, zc = 0.34, 0.30, 0.24, 0.24
    bpy.ops.mesh.primitive_cube_add(size=1)
    ob = bpy.context.active_object
    ob.name = 'torso'
    for c in ob.users_collection:
        c.objects.unlink(ob)
    bpy.data.collections[COLL].objects.link(ob)
    ob.scale = (w, d, h)
    ob.location = (0, 0, zc)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.transform_apply(location=True, scale=True)
    me = ob.data
    for v in me.vertices:  # sedikit melebar ke bawah (kemeja kotak kartun)
        if v.co.z < zc:
            v.co.x *= 1.08
            v.co.y *= 1.05
    bev = ob.modifiers.new('Bulat', 'BEVEL')
    bev.width = 0.07
    bev.segments = 3
    apply_mods(ob)
    for p in ob.data.polygons:
        p.use_smooth = True
    # kerah kemeja: dua sayap segitiga tebal di leher depan
    top, fy = zc + h / 2, -d / 2
    for s in (-1, 1):
        a = (s * 0.012, fy - 0.012, top - 0.015)
        bb = (s * 0.11, fy + 0.03, top + 0.005)
        c = (s * 0.035, fy - 0.03, top - 0.09)
        off = (0, 0.018, 0)
        v = [a, bb, c] + [tuple(x + o for x, o in zip(p, off)) for p in (a, bb, c)]
        f = [(0, 1, 2), (5, 4, 3), (0, 3, 4, 1), (1, 4, 5, 2), (2, 5, 3, 0)]
        if s < 0:
            f = [t[::-1] for t in f]
        b.add(v, f)
    return attach(ob, b)


def apply_mods(ob):
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    for m in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


# ---------------------------------------------------------------- utama

def reset():
    coll = bpy.data.collections.get(COLL)
    if coll:
        for o in list(coll.objects):
            bpy.data.objects.remove(o, do_unlink=True)
    else:
        coll = bpy.data.collections.new(COLL)
        bpy.context.scene.collection.children.link(coll)
    if bpy.context.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')


def finish_part(builder, name):
    """Objek bagian badan: normal keluar per pulau mesh (ujung terbuka rok/celana tetap benar), halus."""
    ob = builder.to_object(name)
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    seen = set()
    for f0 in bm.faces:
        if f0.index in seen:
            continue
        island, stack = [], [f0]
        seen.add(f0.index)
        while stack:
            f = stack.pop()
            island.append(f)
            for e in f.edges:
                for g in e.link_faces:
                    if g.index not in seen:
                        seen.add(g.index)
                        stack.append(g)
        c = sum((f.calc_center_median() for f in island), Vector()) / len(island)
        score = sum(f.normal.dot(Vector((fc.x - c.x, fc.y - c.y, 0))) for f in island for fc in [f.calc_center_median()])
        if score < 0:
            bmesh.ops.reverse_faces(bm, faces=island)
    bm.to_mesh(ob.data)
    bm.free()
    return ob


def build(export=True):
    reset()
    body = runpy.run_path(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'chibi_body.py'))
    obs = [build_head(), build_face(), build_hijab(), build_torso(), *build_hair(),
           *body['build_body'](Builder, ellipsoid, finish_part)]
    mat = bpy.data.materials.get('KIT_Dasar') or bpy.data.materials.new('KIT_Dasar')
    for o in obs:
        apply_mods(o)
        o.data.materials.clear()
        o.data.materials.append(mat)
    stats = {o.name: len(o.data.loop_triangles) or sum(len(p.vertices) - 2 for p in o.data.polygons) for o in obs}
    if export:
        os.makedirs(os.path.dirname(OUT), exist_ok=True)
        bpy.ops.object.select_all(action='DESELECT')
        for o in obs:
            o.select_set(True)
        bpy.ops.export_scene.gltf(
            filepath=os.path.abspath(OUT), use_selection=True, export_format='GLB', export_yup=True,
            export_apply=True, export_texcoords=False, export_normals=True, export_materials='NONE',
            export_vertex_color='ACTIVE', export_animations=False,
        )
        stats['kb'] = round(os.path.getsize(OUT) / 1024, 1)
    return stats
