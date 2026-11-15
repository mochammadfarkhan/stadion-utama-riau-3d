"""
Pencocokan model ke gambar rujukan (alur user: rujukan sebagai plane 2D, vertex dimaju-mundurkan sampai pas).

Lembar rujukan = 3 tampak berjajar (depan | samping menghadap kanan | belakang) di latar polos. Untuk tiap baris
tinggi (bin 1 cm) siluet rujukan diukur: lebar (tampak depan) dan jangkauan depan/belakang (tampak samping), lalu
vertex model di ketinggian itu diskalakan menjauh/mendekat sumbu sampai siluetnya sama. Lengan tidak ikut
(rujukan A-pose, game lengan menggantung); kepala & badan dicocokkan terpisah.

add_reference_planes() memasang lembar yang sama sebagai plane bertekstur di belakang/samping model (disimpan di
.blend) untuk penyuntingan vertex manual.
Dipakai oleh karakter_preset.py (di dalam Blender: bpy + numpy).
"""
import bpy
import numpy as np

BIN = 0.01


def _load(path):
    img = bpy.data.images.load(path, check_existing=True)
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    return img, px.reshape(h, w, 4)[::-1, :, :3]  # baris 0 = atas


def _mask(rgb):
    patch = np.concatenate([rgb[:20, :20].reshape(-1, 3), rgb[:20, -20:].reshape(-1, 3)])
    bg = np.median(patch, axis=0)
    return np.linalg.norm(rgb - bg, axis=2) > 0.085


def _raw_runs(row):
    idx = np.flatnonzero(np.diff(np.concatenate([[0], row.astype(np.int8), [0]])))
    return list(zip(idx[::2], idx[1::2] - 1))


def _runs(row, gap=6, small=5):
    """Run bersih: celah ≤ gap piksel ditutup, run ≤ small piksel dibuang (derau JPEG/faset gelap)."""
    out = []
    for a, b in _raw_runs(row):
        if out and a - out[-1][1] - 1 <= gap:
            out[-1] = (out[-1][0], b)
        else:
            out.append((a, b))
    return [(a, b) for a, b in out if b - a + 1 > small]


class Sheet:
    """Satu tampak (kolom ke-k dari 3) beserta skala meter/piksel terhadap tinggi model."""

    def __init__(self, rgb, k, model_top):
        w = rgb.shape[1] // 3
        self.m = _mask(rgb[:, k * w:(k + 1) * w])
        rows = np.flatnonzero(self.m.sum(axis=1) >= 3)
        self.top, self.bot = rows[0], rows[-1]
        self.s = model_top / (self.bot - self.top + 1)  # meter per piksel
        self.x0 = k * w

    def row_at(self, z):
        return int(round(self.bot - z / self.s))

    def center(self, z0, z1, near, wmin=0.0, wmax=9.0):
        """Kolom pusat: median titik tengah run terdekat `near` (lebar wmin..wmax meter) pada baris z0..z1."""
        cs = []
        for z in np.arange(z0, z1, BIN):
            r = self.row_at(z)
            if not 0 <= r < self.m.shape[0]:
                continue
            runs = [ab for ab in _runs(self.m[r]) if wmin <= (ab[1] - ab[0]) * self.s <= wmax]
            if runs:
                a, b = min(runs, key=lambda ab: abs((ab[0] + ab[1]) / 2 - near))
                cs.append((a + b) / 2)
        return float(np.median(cs)) if cs else near

    def leg_center(self, z0=0.30, z1=0.45, half=0.2):
        """Pusat dari massa kolom kaki bawah (tangan A-pose & kuncir tidak sampai ketinggian ini)."""
        mid = self.m.shape[1] / 2
        lim = int(half / self.s)
        cols = []
        for z in np.arange(z0, z1, BIN):
            r = self.row_at(z)
            if 0 <= r < self.m.shape[0]:
                for a, b in _runs(self.m[r]):
                    if abs((a + b) / 2 - mid) < lim:
                        cols.extend(range(a, b + 1))
        return float(np.mean(cols)) if cols else mid

    def extent(self, z, c, reach):
        """(kiri, kanan) dalam meter dari pusat c: gabungan run yang ujung terdekatnya ≤ reach meter dari c."""
        r = self.row_at(z)
        if not 0 <= r < self.m.shape[0]:
            return None
        lim = reach / self.s
        pick = [ab for ab in _runs(self.m[r]) if (ab[0] <= c <= ab[1]) or min(abs(ab[0] - c), abs(ab[1] - c)) <= lim]
        if not pick:
            return None
        return (c - min(a for a, _ in pick)) * self.s, (max(b for _, b in pick) - c) * self.s


def _smooth(f, k=7):
    keys = sorted(f)
    out = {}
    for i, z in enumerate(keys):
        win = [f[keys[j]] for j in range(max(0, i - k // 2), min(len(keys), i + k // 2 + 1))]
        out[z] = sum(win) / len(win)
    return out


def _interp(f, z):
    if not f:
        return 1.0
    keys = sorted(f)
    if z <= keys[0]:
        return f[keys[0]]
    if z >= keys[-1]:
        return f[keys[-1]]
    i = int((z - keys[0]) / BIN)
    i = max(0, min(len(keys) - 2, i))
    a, b = keys[i], keys[i + 1]
    t = (z - a) / (b - a) if b > a else 0
    return f[a] * (1 - t) + f[b] * t


def fit(m, ref_path, chin_z, head=True, body=True, lo=0.78, hi=1.28):
    """Dorong-tarik vertex m.v (Mesh karakter_preset) ke siluet rujukan. Mengembalikan ringkasan faktor."""
    _img, rgb = _load(ref_path)
    top = max(v.z for v in m.v)
    front, side = Sheet(rgb, 0, top), Sheet(rgb, 1, top)
    fc, sc = front.leg_center(), side.leg_center()
    arm = lambda w: sum(v for k, v in w.items() if k.startswith(('shoulder', 'elbow', 'hand')))  # noqa: E731
    groups = {
        'head': [i for i, w in enumerate(m.w) if w.get('headPivot', 0) > 0.5 and arm(w) < 0.3],
        'body': [i for i, w in enumerate(m.w) if w.get('headPivot', 0) <= 0.5 and arm(w) < 0.3],
    }
    report = {}
    for g, ids in groups.items():
        if (g == 'head' and not head) or (g == 'body' and not body) or not ids:
            continue
        zs = np.array([m.v[i].z for i in ids])
        band = {}
        for i, z in zip(ids, zs):
            band.setdefault(round(z / BIN), []).append(i)
        fx, ff, fb = {}, {}, {}
        for key, vs in band.items():
            z = key * BIN
            if (g == 'head') != (z > chin_z - 0.01) or z < 0.24:  # sepatu tidak dicocokkan
                continue
            hw = max(abs(m.v[i].x) for i in vs)
            fr = max(-m.v[i].y for i in vs)
            bk = max(m.v[i].y for i in vs)
            e = front.extent(z, fc, 0.10)
            if e and hw > 0.01:
                fx[z] = max(lo, min(hi, (e[0] + e[1]) / 2 / hw))
            e = side.extent(z, sc, 0.05)
            if e:
                if fr > 0.01:
                    ff[z] = max(lo, min(hi, e[1] / fr))  # tampak samping menghadap kanan: kanan = depan
                if bk > 0.01 and g == 'body':
                    fb[z] = max(lo, min(hi, e[0] / bk))
        fx, ff, fb = _smooth(fx), _smooth(ff), _smooth(fb)
        for i in ids:
            v = m.v[i]
            v.x *= _interp(fx, v.z)
            if v.y < 0:
                v.y *= _interp(ff, v.z)
            elif fb:
                v.y *= _interp(fb, v.z)
        report[g] = {k: (round(min(f.values()), 2), round(max(f.values()), 2)) for k, f in
                     (('lebar', fx), ('depan', ff), ('belakang', fb)) if f}
    return report


def add_reference_planes(ref_path, model_top, chin_z):
    """Plane rujukan: tampak depan di belakang model (y = +0,6), tampak samping di sisi (x = −0,6)."""
    img, rgb = _load(ref_path)
    out = []
    for k, name in ((0, 'ref_depan'), (1, 'ref_samping')):
        sh = Sheet(rgb, k, model_top)
        h, w3 = rgb.shape[0], rgb.shape[1] // 3
        c = sh.leg_center()
        H, W = h * sh.s, w3 * sh.s
        z0 = -(h - 1 - sh.bot) * sh.s  # baris kaki di z = 0
        left = -c * sh.s
        me = bpy.data.meshes.new(name)
        if k == 0:  # bidang XZ, dilihat dari -Y; kiri gambar = kanan karakter (−X)
            verts = [(left, 0.6, z0), (left + W, 0.6, z0), (left + W, 0.6, z0 + H), (left, 0.6, z0 + H)]
        else:  # bidang YZ di x = −0,6; kanan gambar = depan karakter (−Y)
            verts = [(-0.6, -left, z0), (-0.6, -left - W, z0), (-0.6, -left - W, z0 + H), (-0.6, -left, z0 + H)]
        me.from_pydata(verts, [], [(0, 1, 2, 3)])
        uv = me.uv_layers.new()
        u0, u1 = k / 3, (k + 1) / 3
        for li, (u, v) in enumerate(((u0, 0), (u1, 0), (u1, 1), (u0, 1))):
            uv.data[li].uv = (u, v)
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        nt = mat.node_tree
        for n in list(nt.nodes):
            if n.type == 'BSDF_PRINCIPLED':
                nt.nodes.remove(n)
        emit = nt.nodes.new('ShaderNodeEmission')
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = img
        out_node = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
        nt.links.new(tex.outputs['Color'], emit.inputs['Color'])
        nt.links.new(emit.outputs['Emission'], out_node.inputs['Surface'])
        me.materials.append(mat)
        ob = bpy.data.objects.new(name, me)
        ob['rujukan'] = True
        bpy.context.scene.collection.objects.link(ob)
        out.append(ob)
    return out
