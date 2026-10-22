"""
Baju modular & aksesori untuk kit manekin (dipanggil manekin_kit.py lewat runpy). Semua bagian dibuat dari segmen
badan yang SUDAH diluruskan & dikurangi (Blender Z-up, menghadap -Y, meter), lalu dipindah ke frame pivot yang sama
dengan bagian badan yang ditutupinya, sehingga ikut animasi tanpa skin weight:

  cangkang (shell): verteks didorong sepanjang normal sebesar `tebal`, dipotong bidang Z (lengan pendek, keliman,
  mata kaki), dilonggarkan di sekitar sumbu tungkai (celana lebar);  rok/gamis: tabung loft parametrik dari pinggang;
  kerah/kacamata/jam: torus;  ransel/lencana/kartu: kotak.

Nama bagian = `{g}_{nama}` (sisi: `_l`/`_r`). Pemetaan outfit → bagian ada di src/entities/Humanoid.wardrobe.js.
"""
import math

import bmesh
import bpy
from mathutils import Matrix, Vector

TEBAL = {'kaos': 0.012, 'kemeja': 0.013, 'almamater': 0.022, 'celana': 0.010, 'lebar': 0.014, 'pendek': 0.016,
         'sepatu': 0.012, 'rompi': 0.03, 'celemek': 0.024}
LONGGAR = {'lebar_paha': 1.18, 'lebar_betis': 1.32, 'pendek': 1.16}


def _bbox(bm):
    xs = [v.co for v in bm.verts]
    lo = Vector([min(c[i] for c in xs) for i in range(3)])
    hi = Vector([max(c[i] for c in xs) for i in range(3)])
    return lo, hi


def _obj(name, bm, pivot, smooth=True):
    bm.transform(Matrix.Translation(-pivot))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = smooth
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def shell(segs, tebal, z_atas=None, z_bawah=None, longgar=1.0, depan=None):
    """Cangkang segmen: dorong sepanjang normal, potong Z (simpan di antara z_bawah..z_atas), longgarkan XY di sekitar
    pusat kotak, `depan` = simpan hanya sisi depan (y < nilai). Mengembalikan bmesh (koordinat dunia)."""
    bm = bmesh.new()
    for o in segs:
        bm.from_mesh(o.data)
    bm.normal_update()
    for v in bm.verts:
        v.co += v.normal * tebal
    cuts = [(z_atas, Vector((0, 0, 1)), True), (z_bawah, Vector((0, 0, -1)), True)]
    for z, n, outer in cuts:
        if z is not None:
            geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
            bmesh.ops.bisect_plane(bm, geom=geom, plane_co=Vector((0, 0, z)) if n.z > 0 else Vector((0, 0, z)),
                                   plane_no=n, clear_outer=outer)
    if depan is not None:
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=Vector((0, depan, 0)), plane_no=Vector((0, 1, 0)), clear_outer=True)
    if longgar != 1.0 and bm.verts:
        lo, hi = _bbox(bm)
        c = (lo + hi) / 2
        for v in bm.verts:
            v.co.x = c.x + (v.co.x - c.x) * longgar
            v.co.y = c.y + (v.co.y - c.y) * longgar
    return bm


def _circ_smooth(vals, passes):
    n = len(vals)
    for _ in range(passes):
        vals = [(vals[k - 1] + 2 * vals[k] + vals[(k + 1) % n]) / 4 for k in range(n)]
    return vals


def wrap(segs, z_top, z_bot, rings=8, seg=20, pad=0.012, straight=False, top_close=None, smooth=3, hang=True, slope=0.0):
    """Kain pembungkus di sekitar SATU sumbu tegak (segmen sudah diluruskan): irisan Z dari z_top ke z_bot; per sudut
    ambil jari-jari terluar titik segmen di irisan itu, haluskan melingkar & sepanjang Z, tambah `pad`.
      hang      : di bawah irisan terlebar kain tidak masuk ke dalam lagi (tanpa takik selangkangan/keliman bergerigi)
      straight  : jari-jari per sudut seragam sepanjang Z (kaki celana lebar lurus)
      top_close : (z, r) tutup kubah ke cincin kecil di atas (kerah leher / ujung bahu)
      slope     : bahu melandai: cincin atas & kubah diturunkan slope·cos²(sudut) di sisi kiri/kanan
    Tabung terbuka di bawah."""
    pts = [v.co for o in segs for v in o.data.vertices]
    zs = [z_top + (z_bot - z_top) * i / (rings - 1) for i in range(rings)]
    win = abs(z_top - z_bot) / (rings - 1) * 0.75 + 0.01
    slices = [[p for p in pts if abs(p.z - z) <= win] or sorted(pts, key=lambda p: abs(p.z - z))[:12] for z in zs]
    every = [p for sl in slices for p in sl]
    cx = sum(p.x for p in every) / len(every)
    cy = sum(p.y for p in every) / len(every)
    profile = []
    for sel in slices:
        radii = [0.0] * seg
        for p in sel:
            k = int(((math.atan2(p.y - cy, p.x - cx) + math.pi) / (2 * math.pi)) * seg) % seg
            radii[k] = max(radii[k], math.hypot(p.x - cx, p.y - cy))
        known = [k for k in range(seg) if radii[k] > 0]
        for k in range(seg):  # sudut kosong: ambil tetangga terdekat yang terisi
            if radii[k] == 0 and known:
                radii[k] = radii[min(known, key=lambda q: min(abs(q - k), seg - abs(q - k)))]
        profile.append(_circ_smooth(radii, 6))
    if hang:
        widest = max(range(rings), key=lambda i: sum(profile[i]))
        for i in range(widest + 1, rings):
            profile[i] = [max(a, b) for a, b in zip(profile[i], profile[i - 1])]
    for _ in range(smooth):  # haluskan sepanjang Z (tanpa benjolan sendi)
        profile = [[(x + 2 * y + w) / 4 for x, y, w in zip(a, b, c)]
                   for a, b, c in zip([profile[0]] + profile[:-1], profile, profile[1:] + [profile[-1]])]
    if straight:
        mx = [max(pr[k] for pr in profile) for k in range(seg)]
        profile = [mx for _ in profile]
    angles = [2 * math.pi * (k + 0.5) / seg - math.pi for k in range(seg)]
    bm = bmesh.new()
    loops = []
    if top_close:  # kubah: cincin kecil di puncak + cincin tengah 70% jari-jari
        z, r = top_close
        loops.append([bm.verts.new((cx + r * math.cos(a), cy + r * math.sin(a), z)) for a in angles])
        zm = (z + zs[0]) / 2
        loops.append([bm.verts.new((cx + (r + 0.7 * (profile[0][k] + pad - r)) * math.cos(a),
                                    cy + (r + 0.7 * (profile[0][k] + pad - r)) * math.sin(a),
                                    zm - 0.6 * slope * math.cos(a) ** 2)) for k, a in enumerate(angles)])
    for i, (z, radii) in enumerate(zip(zs, profile)):
        drop = slope * (1 - i / max(1, rings - 1)) ** 2  # landai bahu memudar ke bawah
        loops.append([bm.verts.new((cx + (radii[k] + pad) * math.cos(a), cy + (radii[k] + pad) * math.sin(a),
                                    z - drop * math.cos(a) ** 2)) for k, a in enumerate(angles)])
    for a, b in zip(loops, loops[1:]):
        for k in range(seg):
            bm.faces.new((a[k], b[k], b[(k + 1) % seg], a[(k + 1) % seg]))
    _outward(bm)
    return bm


def _outward(bm):
    """Normal tabung terbuka menghadap keluar dari sumbunya (recalc tidak andal untuk mesh terbuka)."""
    bm.normal_update()
    bm.faces.ensure_lookup_table()
    f = bm.faces[len(bm.faces) // 2]
    c = f.calc_center_median()
    axis = sum((v.co for v in bm.verts), Vector()) / len(bm.verts)
    if f.normal.dot(Vector((c.x - axis.x, c.y - axis.y, 0))) < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    bm.normal_update()


def tube(cx, cy, rings, seg=24):
    """Tabung loft terbuka: rings = [(z, rx, ry)] dari atas ke bawah (rok/gamis)."""
    bm = bmesh.new()
    loops = []
    for z, rx, ry in rings:
        loops.append([bm.verts.new((cx + rx * math.cos(a), cy + ry * math.sin(a), z))
                      for a in (2 * math.pi * k / seg for k in range(seg))])
    for a, b in zip(loops, loops[1:]):
        for k in range(seg):
            bm.faces.new((a[k], a[(k + 1) % seg], b[(k + 1) % seg], b[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    # tabung terbuka: pastikan normal menghadap keluar (recalc bisa terbalik pada mesh terbuka)
    f = bm.faces[0]
    f.normal_update()
    out = (f.calc_center_median() - Vector((cx, cy, f.calc_center_median().z)))
    if f.normal.dot(out) < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    return bm


def half(bm, cx, sx):
    """Paruh tabung di sisi sx (+1 = kiri karakter, +X; -1 = kanan) dari bidang X = cx."""
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=Vector((cx, 0, 0)), plane_no=Vector((-sx, 0, 0)), clear_outer=True)
    return bm


def torus(center, r_major, r_minor, axis='z', seg=18, tseg=6, sy=1.0):
    """Torus (kerah, gelang jam, bingkai kacamata). axis = sumbu lubang; sy = pipih arah Y (kerah elips)."""
    bm = bmesh.new()
    rings = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        ring = []
        for k in range(tseg):
            b = 2 * math.pi * k / tseg
            r = r_major + r_minor * math.cos(b)
            p, h = (r * math.cos(a), r * math.sin(a) * sy), r_minor * math.sin(b)
            co = {'z': (p[0], p[1], h), 'y': (p[0], h, p[1]), 'x': (h, p[0], p[1])}[axis]
            ring.append(bm.verts.new(Vector(co) + center))
        rings.append(ring)
    for i in range(seg):
        a, b = rings[i], rings[(i + 1) % seg]
        for k in range(tseg):
            bm.faces.new((a[k], b[k], b[(k + 1) % tseg], a[(k + 1) % tseg]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def box(center, size, bevel=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bm.transform(Matrix.Diagonal((*size, 1)))
    if bevel:
        bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bevel, segments=2, affect='EDGES', profile=0.5)
    bm.transform(Matrix.Translation(center))
    return bm


def merge(*bms):
    out = bmesh.new()
    for b in bms:
        me = bpy.data.meshes.new('tmp')
        b.to_mesh(me)
        out.from_mesh(me)
        bpy.data.meshes.remove(me)
        b.free()
    return out


def seg_box(o):
    vs = [v.co for v in o.data.vertices]
    return Vector([min(c[i] for c in vs) for i in range(3)]), Vector([max(c[i] for c in vs) for i in range(3)])


def build_clothes(g, segs, j, pelvis, neck_top):
    """Semua bagian baju & aksesori untuk gender g. j = sendi per sisi (shoulder/elbow/wrist/hip/knee/ankle)."""
    obs = []

    def add(name, bm, pivot, smooth=True):
        obs.append(_obj(f'{g}_{name}', bm, pivot, smooth))

    torso = [segs[k] for k in ('stomach', 'chest', 'breast_l', 'breast_r') if k in segs]
    hip_z = (j['l']['hip'].z + j['r']['hip'].z) / 2
    t_lo, t_hi = seg_box(segs['chest'])
    n_lo, n_hi = seg_box(segs['neck'])
    neck_c = Vector(((n_lo.x + n_hi.x) / 2, (n_lo.y + n_hi.y) / 2, 0))
    neck_r = (n_hi.x - n_lo.x) / 2

    # --- atasan (frame spine = pinggul): badan baju membungkus dada→pinggul, kerah menutup ke leher ---
    t_top = t_hi.z - 0.015
    neck_close = (n_lo.z + 0.02, neck_r + 0.012)
    for top, hem_z, collar in (('kaos', hip_z + 0.03, None), ('kemeja', hip_z + 0.0, 1.5), ('almamater', hip_z - 0.07, 1.9)):
        pad = TEBAL[top] + 0.008  # longgar di atas celana (tanpa saling tembus di pinggang)
        add(f'{top}_torso', wrap(torso + [segs['hips']], t_top, hem_z, rings=11, seg=24, pad=pad, top_close=neck_close,
                                 slope=0.035), pelvis)
        if collar:
            cz = n_lo.z + 0.035
            add(f'{top}_collar', torus(Vector((neck_c.x, neck_c.y, cz)), neck_r * collar, 0.012 if top == 'kemeja' else 0.02, sy=0.85), pelvis)
    for s in ('l', 'r'):
        arm = [segs[f'shoulder_{s}'], segs[f'upper_arm_{s}']]
        a_lo, a_hi = seg_box(segs[f'shoulder_{s}'])
        # puncak lengan sedikit di bawah puncak deltoid: menyatu dengan landai bahu badan baju (tanpa epolet)
        sh_top = a_hi.z - 0.04
        up = j[s]['shoulder'].z - j[s]['elbow'].z
        cap = (a_hi.z - 0.018, 0.035)
        add(f'kaos_sleeve_{s}', wrap(arm, sh_top, j[s]['elbow'].z + 0.5 * up, rings=5, seg=16, pad=TEBAL['kaos'] + 0.006,
                                     top_close=cap), j[s]['shoulder'])
        lower = [segs[f'elbow_{s}'], segs[f'lower_arm_{s}']]
        e_lo, e_hi = seg_box(segs[f'elbow_{s}'])
        for top in ('kemeja', 'almamater'):
            add(f'{top}_sleeve_upper_{s}', wrap(arm, sh_top, j[s]['elbow'].z - 0.01, rings=6, seg=16, pad=TEBAL[top], top_close=cap,
                                                hang=False), j[s]['shoulder'])
            add(f'{top}_sleeve_lower_{s}', wrap(lower, e_hi.z, j[s]['wrist'].z + 0.02, rings=6, seg=16, pad=TEBAL[top], hang=False),
                j[s]['elbow'])

    # --- bawahan (pinggul: frame body; paha: frame pinggul; betis: frame lutut) ---
    p_lo, p_hi = seg_box(segs['hips'])
    # Pinggul celana berhenti di sendi pinggul (tidak menyempit di selangkangan); paha mulai di dalamnya.
    add('celana_pelvis', wrap([segs['hips']], p_hi.z - 0.015, hip_z - 0.02, rings=5, seg=24, pad=TEBAL['celana']), pelvis)
    for s in ('l', 'r'):
        thigh, shin = [segs[f'upper_leg_{s}']], [segs[f'knee_{s}'], segs[f'lower_leg_{s}']]
        ankle = j[s]['ankle'].z + 0.03
        th = j[s]['hip'].z - j[s]['knee'].z
        thigh_top = j[s]['hip'].z + 0.05
        # paha turun melewati pusat lutut & betis mulai di atasnya: tumpang 5 cm, tanpa tangga di lutut
        knee_lo, knee_hi = j[s]['knee'].z - 0.02, j[s]['knee'].z + 0.03
        add(f'celana_thigh_{s}', wrap(thigh, thigh_top, knee_lo, rings=6, seg=16, pad=TEBAL['celana'], hang=False), j[s]['hip'])
        add(f'celana_shin_{s}', wrap(shin, knee_hi, ankle, rings=7, seg=16, pad=TEBAL['celana'], hang=False), j[s]['knee'])
        add(f'celana_lebar_thigh_{s}', wrap(thigh, thigh_top, knee_lo, rings=6, seg=16, pad=TEBAL['lebar'] + 0.012),
            j[s]['hip'])
        add(f'celana_lebar_shin_{s}', wrap(shin, knee_hi, ankle, rings=7, seg=16, pad=TEBAL['lebar'] + 0.008, straight=True),
            j[s]['knee'])
        add(f'pendek_thigh_{s}', wrap(thigh, thigh_top, j[s]['knee'].z + 0.45 * th, rings=5, seg=16, pad=TEBAL['pendek'] + 0.01),
            j[s]['hip'])
        add(f'sepatu_{s}', shell([segs[f'feet_{s}']], TEBAL['sepatu'], z_atas=j[s]['ankle'].z + 0.025), j[s]['knee'])

    cx, cy = (p_lo.x + p_hi.x) / 2, (p_lo.y + p_hi.y) / 2
    hx, hy = (p_hi.x - p_lo.x) / 2 * 1.08, (p_hi.y - p_lo.y) / 2 * 1.1
    waist = p_hi.z - 0.03
    knee_z = (j['l']['knee'].z + j['r']['knee'].z) / 2
    ankle_z = (j['l']['ankle'].z + j['r']['ankle'].z) / 2
    # Rok & gamis = dua paruh (kiri/kanan) yang ikut pivot paha (gamis: paruh bawah ikut lutut). Berdiri: menyatu
    # jadi kerucut; jalan: terbelah sedikit; duduk: jatuh menutupi paha/betis (tanpa kaki menembus kerucut kaku).
    rok = [(waist, hx, hy), (hip_z, hx * 1.12, hy * 1.12), (knee_z + 0.04, hx * 1.45, hy * 1.4)]
    gamis_atas = [(waist, hx, hy), (hip_z, hx * 1.12, hy * 1.12), (knee_z - 0.02, hx * 1.38, hy * 1.33)]
    gamis_bawah = [(knee_z + 0.04, hx * 1.36, hy * 1.31), (ankle_z + 0.03, hx * 1.75, hy * 1.6)]
    for side, sx in (('l', 1), ('r', -1)):
        add(f'rok_{side}', half(tube(cx, cy, rok), cx, sx), j[side]['hip'])
        add(f'gamis_atas_{side}', half(tube(cx, cy, gamis_atas), cx, sx), j[side]['hip'])
        add(f'gamis_bawah_{side}', half(tube(cx, cy, gamis_bawah), cx, sx), j[side]['knee'])

    # --- aksesori ---
    front = t_lo.y  # dada paling depan (Blender -Y)
    chest_z = t_lo.z + (t_hi.z - t_lo.z) * 0.62
    add('rompi', wrap(torso + [segs['hips']], t_hi.z - 0.06, hip_z + 0.05, rings=8, seg=24, pad=TEBAL['rompi']), pelvis)
    add('celemek', shell([segs['stomach'], segs['hips']], TEBAL['celemek'], z_atas=chest_z, z_bawah=hip_z - 0.18,
                         depan=(t_lo.y + t_hi.y) / 2 - 0.02), pelvis)
    add('acc_ransel', box(Vector((0, t_hi.y + 0.065, chest_z - 0.04)), (0.27, 0.13, 0.36), bevel=0.035), pelvis)
    add('acc_lencana', box(Vector((0.075, front - 0.012, chest_z)), (0.05, 0.008, 0.06), bevel=0.004), pelvis)
    card_z = chest_z - 0.06
    add('acc_kartu_id', merge(box(Vector((0, front - 0.016, card_z)), (0.055, 0.006, 0.08), bevel=0.003),
                              box(Vector((0.03, (front + neck_c.y) / 2 - 0.01, (card_z + n_lo.z) / 2 + 0.02)), (0.008, 0.004, n_lo.z - card_z)),
                              box(Vector((-0.03, (front + neck_c.y) / 2 - 0.01, (card_z + n_lo.z) / 2 + 0.02)), (0.008, 0.004, n_lo.z - card_z))),
        pelvis, smooth=False)
    h_lo, h_hi = seg_box(segs['head'])
    eye_z = h_lo.z + (h_hi.z - h_lo.z) * 0.52
    face_y = min(v.co.y for v in segs['head'].data.vertices if abs(v.co.z - eye_z) < 0.02 and abs(v.co.x) < 0.03)
    gx = (h_hi.x - h_lo.x) * 0.22
    lens = [torus(Vector((sx * gx, face_y - 0.012, eye_z)), 0.021, 0.003, axis='y') for sx in (1, -1)]
    bridge = box(Vector((0, face_y - 0.012, eye_z + 0.004)), (gx * 2 - 0.042, 0.004, 0.004))
    temples = [box(Vector((sx * (gx + 0.021), (face_y + (h_lo.y + h_hi.y) / 2) / 2, eye_z)), (0.004, abs(face_y - (h_lo.y + h_hi.y) / 2), 0.004))
               for sx in (1, -1)]
    add('acc_kacamata', merge(*lens, bridge, *temples), neck_top, smooth=False)
    w = j['l']['wrist']
    la_vs = [v.co for v in segs['lower_arm_l'].data.vertices if abs(v.co.z - (w.z + 0.045)) < 0.015]
    r = max(((v.x - w.x) ** 2 + (v.y - w.y) ** 2) ** 0.5 for v in la_vs) + 0.004 if la_vs else 0.035
    add('acc_jam_l', torus(Vector((w.x, w.y, w.z + 0.045)), r, 0.007, sy=0.9), j['l']['elbow'])
    return obs
