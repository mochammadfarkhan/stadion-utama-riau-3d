"""
Landmark Pekanbaru lainnya (bangunan, tugu, bandara) → GLB 3 LOD per landmark, dari JEJAK OSM + bentuk khas.

Jalankan (Blender headless):
    "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" -b --python-expr "import runpy;print(runpy.run_path(r'<repo>\\assets-src\\blender\\landmark\\bangunan.py')['build']())"

Keluaran: public/models/landmark/<id>-lod{0,1,2}.glb + src/city/landmarks.data.js (daftar posisi, DIHASILKAN skrip ini).
Jejak: assets-src/blender/landmark/osm/footprints.json (Overpass 2026-11-15; way/node OSM, koordinat dunia x, z).

Fakta = jejak (bentuk denah), nama, jumlah lantai bila ada di OSM. Foto (Commons/Maps) = ciri khas (atap Melayu bertingkat di Kantor
Gubernur, kaca + atap miring di Soeman HS, plang "MAL SKA", patung tiga ikan selais, busur oranye dll).
[INFERENSI] tinggi per lantai, warna merek, bentuk atap Balai Adat/Anjung Seni/Museum (gaya atap Melayu umum), kubah Masjid Raya Senapelan,
bentuk Tugu Zapin/Keris/Perjuangan/Bambu Runcing/Skyhawk, tinggi hangar & terminal.
"""
import json
import math
import os
import runpy

import bpy

HERE = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else r"C:\Users\mocha\Documents\stadion-utama-riau-3d\assets-src\blender\landmark"
_C = runpy.run_path(os.path.join(HERE, "lm_common.py"))
Mesh, extrude_unused = _C["Mesh"], None
area, ccw, centroid, inside, simplify, min_rect, hash01 = (_C[k] for k in ("area", "ccw", "centroid", "inside", "simplify", "min_rect", "hash01"))
dome, x_finial, material, export_lods = _C["dome"], _C["x_finial"], _C["material"], _C["export_lods"]
REPO = _C["REPO"]
FOOT = json.load(open(os.path.join(HERE, "osm", "footprints.json"), encoding="utf-8"))
OUT_BLEND = os.path.join(HERE, "bangunan.blend")
OUT_JS = os.path.join(REPO, "src", "city", "landmarks.data.js")

GLASS = "#1f2c35"
BATU = "#d9d3c4"


def way(wid):
    return [tuple(p) for p in FOOT["way"][str(wid)]["pts"]][:-1]


def tag(wid, k, default=None):
    return FOOT["way"][str(wid)]["tags"].get(k, default)


class Frame:
    """Titik tengah (dunia) → koordinat model (x, -z) relatif."""
    def __init__(self, pts_list):
        xs = [p[0] for pts in pts_list for p in pts]
        zs = [p[1] for pts in pts_list for p in pts]
        self.cx, self.cz = round((min(xs) + max(xs)) / 2, 1), round((min(zs) + max(zs)) / 2, 1)

    def pts(self, pts):
        return [(x - self.cx, -(z - self.cz)) for x, z in pts]

    def pt(self, x, z):
        return (x - self.cx, -(z - self.cz))


def bands(z0, n, fh, wall, glass=GLASS):
    out = []
    for k in range(n):
        z = z0 + k * fh
        out += [(z, z + 0.26 * fh, wall), (z + 0.26 * fh, z + 0.78 * fh, glass), (z + 0.78 * fh, z + fh, wall)]
    return out


def tol(lod):
    return (0.0, 1.5, 4.0)[lod]


def ac_boxes(m, poly, z, lod, seed):
    if lod:
        return
    xs, ys = [p[0] for p in poly], [p[1] for p in poly]
    n = 0
    for i in range(14):
        for j in range(14):
            x = min(xs) + (max(xs) - min(xs)) * (i + 0.5) / 14
            y = min(ys) + (max(ys) - min(ys)) * (j + 0.5) / 14
            if hash01(i, j, seed) < 0.12 and inside((x, y), poly) and n < 16:
                m.box(x, y, z, 3.2, 2.2, 1.6, "#8e9195")
                n += 1


def sign_on_longest(m, poly, z, length, col, lod):
    if lod:
        return
    poly = ccw(poly)
    a, b = max(zip(poly, poly[1:] + poly[:1]), key=lambda e: math.dist(*e))
    L = math.dist(a, b)
    dx, dy = (b[0] - a[0]) / L, (b[1] - a[1]) / L
    nx, ny = dy, -dx
    c = ((a[0] + b[0]) / 2 + nx * 0.5, (a[1] + b[1]) / 2 + ny * 0.5)
    h = min(length, L * 0.5) / 2
    m.prism((c[0] - dx * h, c[1] - dy * h, z), (c[0] + dx * h, c[1] + dy * h, z), 0.7, col, wz=3.2)


# ---------------- bangunan umum (mal, hotel, pasar) ----------------
def b_mal(spec):
    fr = Frame([way(w) for w in spec["ways"]])

    def build(lod):
        m = Mesh()
        for w in spec["ways"]:
            poly = simplify(fr.pts(way(w)), tol(lod))
            n = int(tag(w, "building:levels", spec["levels"]))
            H = n * spec["fh"]
            wall, acc = spec["wall"], spec["accent"]
            m.extrude(poly, 0, H, wall, roof="#8a8d8f", bands=bands(0, n, spec["fh"], wall) if lod == 0 else None)
            m.extrude(poly, H, H + 1.3, acc)
            ac_boxes(m, poly, H, lod, w)
            sign_on_longest(m, poly, H - 4.2, spec.get("sign", 22), acc, lod)
        return m
    return fr, build


def _facade_fins(m, cx, cy, ang, L, W, z0, z1, count, col, depth=0.65, width=0.55):
    """Tambah sirip vertikal ritmis di dua sisi panjang bangunan."""
    c, s = math.cos(ang), math.sin(ang)
    for side in (-1, 1):
        v = side * (W * 0.5 + depth * 0.4)
        for i in range(1, count):
            u = -L * 0.45 + L * 0.9 * (i / count)
            px = cx + u * c - v * s
            py = cy + u * s + v * c
            m.prism((px, py, z0), (px, py, z1), width, col, wz=width)


def _soft_bands(z0, n, fh, wall, glass="#243547"):
    """Pita jendela lebih ramping (26% tinggi lantai) agar fasad tidak tampak belang zebra."""
    out = []
    for k in range(n):
        z = z0 + k * fh
        out += [(z, z + 0.42 * fh, wall), (z + 0.42 * fh, z + 0.68 * fh, glass), (z + 0.68 * fh, z + fh, wall)]
    return out


def _grow(poly, d):
    """Cincin diperbesar ke luar ±d (skala dari titik berat; cukup untuk pelat/lis tipis)."""
    cx, cy = centroid(poly)
    out = []
    for x, y in poly:
        r = math.hypot(x - cx, y - cy) or 1e-9
        out.append((cx + (x - cx) * (r + d) / r, cy + (y - cy) * (r + d) / r))
    return out


def _slabs(m, poly, zs, d, t, col):
    """Pelat lantai menonjol d meter di tiap ketinggian zs (relief nyata: memberi garis bayangan)."""
    g = _grow(ccw(poly), d)
    for z in zs:
        m.extrude(g, z, z + t, col, roof=col)


def _piers(m, poly, z0, z1, step, w, col, off=0.35):
    """Pilar tegak tiap ±step meter mengikuti keliling cincin (termasuk bagian melengkung), menonjol off."""
    poly = ccw(poly)
    carry = step / 2
    for a, b in zip(poly, poly[1:] + poly[:1]):
        L = math.dist(a, b)
        if L < 1e-6:
            continue
        dx, dy = (b[0] - a[0]) / L, (b[1] - a[1]) / L
        u = carry
        while u <= L:
            x, y = a[0] + dx * u + dy * off, a[1] + dy * u - dx * off
            m.prism((x, y, z0), (x, y, z1), w, col)
            u += step
        carry = u - L


def _tree(m, x, y, z, s=1.0):
    """Pohon peneduh kecil: batang + tajuk bulat 2 nada (48 segitiga)."""
    m.prism((x, y, z), (x, y, z + 2.2 * s), 0.35 * s, "#5a3d24")
    m.revolve(x, y, z + 1.8 * s, [(0.0, 0), (1.7 * s, 1.0 * s), (2.0 * s, 2.2 * s), (1.3 * s, 3.4 * s), (0.0, 4.2 * s)], 6, "#3f8f3a", "#2f7a30")


def b_mal_ska(spec):
    """Mal SKA Pekanbaru: cladding Gull Grey, 3 skylight berangka putih, kanopi entrance, pylon simpang."""
    fr = Frame([way(w) for w in spec["ways"]])

    def build(lod):
        m = Mesh()
        w = spec["ways"][0]
        poly = simplify(fr.pts(way(w)), tol(lod))
        H = 5 * 4.5
        wall, panel, blue, gold, glass = "#e2e5ea", "#cfd5dd", "#1f6feb", "#f0a830", "#4f9fd6"
        m.extrude(poly, 0, 0.35, "#d8d3c8")  # pelataran trotoar mal
        fh = 4.43
        ska_bands = [(0.35, 1.1, "#9aa0a8"), (1.1, 3.9, "#243547"), (3.9, 0.35 + fh, wall)]   # lantai dasar: plint + etalase kaca tinggi
        for k in range(1, 5):
            z = 0.35 + k * fh
            ska_bands += [(z, z + 0.36 * fh, wall), (z + 0.36 * fh, z + 0.72 * fh, "#243547"), (z + 0.72 * fh, z + fh, wall)]
        m.extrude(poly, 0.35, H, wall, roof="#978f84", bands=ska_bands if lod == 0 else None)  # atap kerikil (gambar rujukan Flow)
        m.extrude(poly, H, H + 1.4, panel)
        m.extrude(poly, H + 1.4, H + 2.0, blue)

        cx, cy, ang, L, W = min_rect(poly)
        c, s = math.cos(ang), math.sin(ang)
        # 3 skylight atrium kaca + rangka kisi putih
        for k in (-0.28, 0.0, 0.28):
            ux = cx + c * (L * k)
            uy = cy + s * (L * k)
            m.box(ux, uy, H + 1.4, L * 0.23, W * 0.48, 0.6, "#e9e2d0")
            m.hip(ux, uy, ang, L * 0.21, W * 0.44, H + 2.0, 4.2, 0.72, glass)
            if lod == 0:   # rangka kisi baja skylight: rusuk melintang, gording, balok bubungan
                Ls, Wd, z0s, top, fr_c = L * 0.21, W * 0.44, H + 2.0, H + 6.2, "#f4f6f8"
                r = Ls * 0.72 / 2
                Q = lambda u, v, z: (ux + u * c - v * s, uy + u * s + v * c, z)  # noqa: E731
                m.prism(Q(-r, 0, top + 0.1), Q(r, 0, top + 0.1), 0.4, fr_c)
                for i in range(7):
                    u = -r + 2 * r * i / 6
                    for sv in (-1, 1):
                        m.prism(Q(u, sv * Wd / 2, z0s + 0.1), Q(u, 0, top + 0.1), 0.3, fr_c)
                for sv in (-1, 1):
                    m.prism(Q(-r - (Ls / 2 - r) * 0.5, sv * Wd / 4, z0s + 2.2), Q(r + (Ls / 2 - r) * 0.5, sv * Wd / 4, z0s + 2.2), 0.3, fr_c)
        # Kanopi main entrance menghadap Simpang SKA (+L/2)
        ex = cx + c * (L * 0.48)
        ey = cy + s * (L * 0.48)
        m.box(ex, ey, 6.5, 14.0, 26.0, 1.2, panel)
        m.box(ex, ey, 7.7, 14.4, 26.4, 0.5, blue)
        # Pylon menara SKA di sudut simpang
        px = cx + c * (L * 0.43) - s * (-W * 0.38)
        py = cy + s * (L * 0.43) + c * (-W * 0.38)
        m.box(px, py, H + 1.4, 8.5, 8.5, 9.0, blue)
        m.box(px, py, H + 10.4, 9.2, 9.2, 1.4, gold)
        if lod == 0:
            _piers(m, poly, 0.35, H, 9.0, 0.9, "#f1f3f6")                                   # pilar mengikuti lekuk fasad
            _slabs(m, poly, [0.35 + k * fh - 0.25 for k in range(1, 5)], 0.5, 0.5, "#f1f3f6")  # pelat lantai menonjol
            sign_on_longest(m, poly, H - 3.4, 36, blue, lod)
            P = lambda u, v, z: (cx + u * c - v * s, cy + u * s + v * c, z)  # noqa: E731
            quad = lambda u0, u1, v0, v1, z, col: m.poly([P(u0, v0, z), P(u1, v0, z), P(u1, v1, z), P(u0, v1, z)], col)  # noqa: E731
            # unit AC atap + saluran udara (gambar rujukan Flow): dua lajur di luar skylight
            for sv in (-1, 1):
                vv = sv * W * 0.37
                ends = []
                for k in (-0.33, -0.11, 0.11, 0.33):
                    x, y, _ = P(L * k, vv, 0)
                    if not inside((x, y), poly):
                        continue
                    # unit AC-nya sendiri = potongan 'ac' (src/city/parts.data.js); di sini hanya saluran udaranya
                    m.prism(P(L * k, vv, H + 0.7), P(L * k, vv - sv * 3.0, H + 0.7), 0.9, "#c9ccd0", wz=0.7)
                    ends.append(L * k)
                if len(ends) > 1:
                    m.prism(P(min(ends), vv - sv * 3.0, H + 0.7), P(max(ends), vv - sv * 3.0, H + 0.7), 1.0, "#c9ccd0", wz=0.8)
            # pintu masuk: dinding kaca + tiang kanopi; rangka sudut pylon
            for v in (-11, -4, 4, 11):
                m.prism(P(L * 0.48 + 6.0, v, 0.35), P(L * 0.48 + 6.0, v, 6.5), 0.7, "#eef2f6")
            m.prism(P(L * 0.5 + 0.4, -10, 3.3), P(L * 0.5 + 0.4, 10, 3.3), 0.5, "#2c4a66", wz=5.6)
            for a, b in ((-1, -1), (-1, 1), (1, -1), (1, 1)):
                m.prism((px + a * 4.25, py + b * 4.25, H + 1.4), (px + a * 4.25, py + b * 4.25, H + 10.4), 0.5, "#eef2f6")
            # tapak: pelataran, jalur antar-jemput, parkiran berpetak, pot tanaman, pohon (hanya LOD0; collider memakai LOD2)
            quad(L / 2 - 2, L / 2 + 30, -W * 0.5, W * 0.5, 0.06, "#d9d2c2")
            quad(L / 2 + 9, L / 2 + 16, -W * 0.46, W * 0.46, 0.08, "#4a4d55")
            v0 = W / 2 + 6.0   # parkiran di sisi jalan (+W); sisi -W ditempati Swiss-Belinn
            quad(-L * 0.38, L * 0.46, v0, v0 + 24.0, 0.05, "#4a4d55")
            for row in (2.0, 16.0):
                for i in range(int(L * 0.8 / 2.6)):
                    u = -L * 0.36 + i * 2.6
                    quad(u, u + 0.16, v0 + row, v0 + row + 5.0, 0.09, "#e8e8e4")
            # pohon, pot, lampu, pintu & kanopi parkiran = potongan (src/city/parts.data.js), bukan bagian mesh ini
        return m
    return fr, build


def b_living_world(spec):
    """Living World Pekanbaru: fasad modern abu-putih & kaca curtain wall, kanopi megah, atrium berangka."""
    fr = Frame([way(w) for w in spec["ways"]])

    def build(lod):
        m = Mesh()
        w = spec["ways"][0]
        poly = simplify(fr.pts(way(w)), tol(lod))
        H = 5 * 4.4
        wall, dark, wood, green, glass = "#eceae4", "#464d57", "#c98548", "#269956", "#78cfc6"
        m.extrude(poly, 0, 0.35, "#d8d3c8")  # pelataran depan
        m.extrude(poly, 0.35, H, wall, roof="#b4b8be", bands=_soft_bands(0.35, 5, 4.33, wall, "#20303c") if lod == 0 else None)
        m.extrude(poly, H, H + 1.5, dark)
        m.extrude(poly, H + 1.5, H + 2.0, green)

        cx, cy, ang, L, W = min_rect(poly)
        c, s = math.cos(ang), math.sin(ang)
        # Atrium skylight bertingkat + rangka putih + teras hijau di atap
        m.box(cx, cy, H + 1.5, L * 0.48, W * 0.46, 0.8, "#f2f4f7")
        m.hip(cx, cy, ang, L * 0.44, W * 0.42, H + 2.3, 5.2, 0.68, glass)
        for sg in (-1, 1):
            tx = cx + c * (L * 0.33 * sg)
            ty = cy + s * (L * 0.33 * sg)
            m.box(tx, ty, H + 1.5, 16.0, W * 0.38, 0.6, "#5aa854")
        # Kanopi curtain wall & main entrance menghadap Jl. Tuanku Tambusai (-W/2)
        fx = cx - s * (-W * 0.48)
        fy = cy + c * (-W * 0.48)
        m.box(fx, fy, 4.5, 36.0, 8.0, 12.0, "#243b4a")
        m.box(fx, fy, 7.2, 40.0, 14.0, 1.0, dark)
        m.box(fx, fy, 8.2, 40.4, 14.4, 0.4, wood)
        # Menara penanda Living World di sudut barat laut
        px = cx + c * (-L * 0.36) - s * (-W * 0.36)
        py = cy + s * (-L * 0.36) + c * (-W * 0.36)
        m.box(px, py, H + 1.5, 8.5, 8.5, 8.0, dark)
        m.box(px, py, H + 9.5, 9.0, 9.0, 1.4, green)
        if lod == 0:
            _facade_fins(m, cx, cy, ang, L, W, 2.5, H, 12, wood)
            sign_on_longest(m, poly, H - 3.2, 34, green, lod)
            ac_boxes(m, poly, H + 1.5, lod, w)
        return m
    return fr, build


def b_swiss_belinn(spec):
    """Swiss-Belinn SKA: podium batu krem + menara hotel krem-abu 12 lantai + mahkota modern."""
    fr = Frame([way(w) for w in spec["ways"]])

    def build(lod):
        m = Mesh()
        w = spec["ways"][0]
        poly = simplify(fr.pts(way(w)), tol(lod))
        H = 12 * 3.6
        wall, blue, accent = "#ebe8e0", "#224d8f", "#c94638"
        m.extrude(poly, 0, 10.5, "#dfd9ce", roof=None, bands=_soft_bands(0, 3, 3.5, "#dfd9ce", "#223446") if lod == 0 else None)
        m.extrude(poly, 10.5, H, wall, roof="#9aa3b0")   # jendela menara = potongan 'jendela' (aturan ring di src/city/parts.data.js)
        m.extrude(poly, H, H + 2.0, blue)
        m.extrude(poly, H + 2.0, H + 2.6, accent)
        cx, cy, ang, L, W = min_rect(poly)
        m.hip(cx, cy, ang, L * 0.72, W * 0.72, H + 2.6, 3.6, 0.5, "#2b62b5")
        if lod == 0:   # mengikuti gambar rujukan Flow: kisi pilar + pelat, podium, balkon ujung, kanopi, peralatan atap
            c, s = math.cos(ang), math.sin(ang)
            P = lambda u, v, z: (cx + u * c - v * s, cy + u * s + v * c, z)  # noqa: E731
            _slabs(m, poly, [10.5 + 3.6 * k - 0.18 for k in range(1, 9)], 0.35, 0.36, "#f5f7fa")
            _slabs(m, poly, [10.2], 0.9, 0.6, "#cfc7b6")                    # tepi podium
            _piers(m, poly, 0.0, 10.2, 6.0, 0.8, "#cfc7b6", off=0.45)
            for k in range(9):                                              # balkon di kedua ujung
                z = 10.5 + 3.6 * k + 0.2
                for su in (-1, 1):
                    m.prism(P(su * (L / 2 + 0.8), -W * 0.3, z + 0.5), P(su * (L / 2 + 0.8), W * 0.3, z + 0.5), 1.6, "#f5f7fa", wz=1.0)
            for sv in (-1, 1):                                              # kanopi masuk + tiang di kedua sisi panjang
                m.prism(P(-7, sv * (W / 2 + 3.2), 4.8), P(7, sv * (W / 2 + 3.2), 4.8), 6.0, blue, wz=0.5)
                for u in (-6, 6):
                    m.prism(P(u, sv * (W / 2 + 5.6), 0.0), P(u, sv * (W / 2 + 5.6), 4.6), 0.5, "#eef2f6")
            hx, hy, _ = P(L * 0.42, 0, 0)
            m.box(hx, hy, H + 2.6, 4.0, 5.0, 3.0, "#d9d5cc")               # kepala tangga
            for u in (-0.42, -0.36):
                ax, ay, _ = P(L * u, 0, 0)
                m.box(ax, ay, H + 2.6, 2.4, 2.0, 1.5, "#b9bcc0")
        return m
    return fr, build


def b_flyover_ska(spec):
    """Flyover Simpang SKA (Jl. Soekarno-Hatta di atas Jl. Tuanku Tambusai): oprit, geladak, pilar ganda, ornamen Melayu merah-kuning-hijau, PJU."""
    cx, cz = 3308.0, -1870.0
    fr = Frame([[(cx, cz)]])
    dx, dy = -45.0, 800.0
    norm = math.hypot(dx, dy)
    ux, uy = dx / norm, dy / norm
    nx, ny = -uy, ux

    def build(lod):
        m = Mesh()
        W, H, thick = 16.5, 6.2, 1.1
        pts_s = [-360, -180, -100, 0, 100, 180, 360] if lod < 2 else [-360, -180, 180, 360]
        z_of = lambda s: H if abs(s) <= 180 else H * max(0.01, (360 - abs(s)) / 180.0)  # noqa: E731

        for i in range(len(pts_s) - 1):
            s0, s1 = pts_s[i], pts_s[i + 1]
            z0, z1 = z_of(s0), z_of(s1)
            p0 = (ux * s0, uy * s0, z0)
            p1 = (ux * s1, uy * s1, z1)
            if abs((s0 + s1) * 0.5) > 180:
                bot0 = max(0.0, z0 * 0.5)
                bot1 = max(0.0, z1 * 0.5)
                m.prism((ux * s0, uy * s0, bot0), (ux * s1, uy * s1, bot1), W - 0.8, "#d4d8df", wz=max(z0, z1))
            m.prism(p0, p1, W, "#323640", caps=True, wz=thick)
            for sg in (-1, 1):
                off = sg * (W * 0.5 - 0.35)
                m.prism((p0[0] + nx * off, p0[1] + ny * off, z0 + 0.55), (p1[0] + nx * off, p1[1] + ny * off, z1 + 0.55), 0.65, "#eceff4", wz=0.95)
                if abs((s0 + s1) * 0.5) <= 180:
                    # Tiga pita warna adat Melayu Riau (Merah, Kuning-Emas, Hijau) sepanjang bentang tengah
                    eoff = sg * (W * 0.5 + 0.06)
                    m.prism((p0[0] + nx * eoff, p0[1] + ny * eoff, z0 + 0.45), (p1[0] + nx * eoff, p1[1] + ny * eoff, z1 + 0.45), 0.2, "#c9362b", wz=0.32)
                    m.prism((p0[0] + nx * eoff, p0[1] + ny * eoff, z0 + 0.05), (p1[0] + nx * eoff, p1[1] + ny * eoff, z1 + 0.05), 0.2, "#f0b83a", wz=0.38)
                    m.prism((p0[0] + nx * eoff, p0[1] + ny * eoff, z0 - 0.38), (p1[0] + nx * eoff, p1[1] + ny * eoff, z1 - 0.38), 0.2, "#269956", wz=0.34)
            m.prism((p0[0], p0[1], z0 + 0.45), (p1[0], p1[1], z1 + 0.45), 0.65, "#dde1e8", wz=0.65)

        # Pilar kolom ganda berpondasi (lebih ramping & arsitektural)
        for s in (-165, -95, 95, 165):
            px, py = ux * s, uy * s
            for sg in (-1, 1):
                m.box(px + nx * (4.2 * sg), py + ny * (4.2 * sg), 0.0, 2.0, 2.0, H - 0.9, "#bcc2cc")
            m.prism((px - nx * 6.8, py - ny * 6.8, H - 0.8), (px + nx * 6.8, py + ny * 6.8, H - 0.8), 2.1, "#cfd4dc", caps=True, wz=0.95)

        if lod == 0:
            # Sepasang ornamen selembayung Melayu di puncak bentang tengah (s = 0)
            for sg in (-1, 1):
                x_finial(m, nx * (W * 0.52 * sg), ny * (W * 0.52 * sg), H + 1.1, math.atan2(ny, nx), 2.8, "#f0b83a")
            # Tiang PJU ganda di median (kepala gelap agar menyala hangat di malam hari)
            for s in range(-300, 301, 60):
                px, py, pz = ux * s, uy * s, z_of(s)
                m.box(px, py, pz + 0.6, 0.32, 0.32, 5.2, "#d8dde5")
                m.prism((px - nx * 2.4, py - ny * 2.4, pz + 5.7), (px + nx * 2.4, py + ny * 2.4, pz + 5.7), 0.24, "#d8dde5", wz=0.22)
                for sg in (-1, 1):
                    m.box(px + nx * (2.3 * sg), py + ny * (2.3 * sg), pz + 5.45, 0.8, 0.5, 0.28, "#12151a")
        return m
    return fr, build


# ---------------- Melayu: atap bertingkat + selembayung ----------------
def melayu_roof(m, poly, z0, lod, roof, trim, scale=1.0, tiers=2, h1=7.0, eave=2.5):
    cx, cy, ang, L, W = min_rect(poly)
    L, W = (L + eave) * scale, (W + eave) * scale
    m.hip(cx, cy, ang, L, W, z0, h1, 0.78, roof)
    top = z0 + h1
    if tiers >= 2:
        L2, W2 = L * 0.55, max(W * 0.5, 6.0)
        m.hip(cx, cy, ang, L2, W2, top, h1 * 0.75, 0.7, roof)
        top += h1 * 0.75
    if lod < 2:
        for sgn in (-1, 1):
            r = (L2 if tiers >= 2 else L) * 0.5 * 0.7
            x_finial(m, cx + math.cos(ang) * r * sgn, cy + math.sin(ang) * r * sgn, top - 0.4, ang, 2.6, trim)
    return top


def b_melayu(spec):
    fr = Frame([way(w) for w in spec["ways"]])

    def build(lod):
        m = Mesh()
        for w in spec["ways"]:
            poly = simplify(fr.pts(way(w)), tol(lod))
            H = spec["h"]
            n = spec.get("floors", 1)
            fh = H / n
            m.extrude(poly, 0, H, spec["wall"], roof=spec["roof"], bands=bands(0, n, fh, spec["wall"], "#3a3226") if lod == 0 else None)
            m.extrude(poly, H - 1.0, H, spec["trim"])
            melayu_roof(m, poly, H, lod, spec["roof"], spec["trim"], tiers=spec.get("tiers", 2), h1=spec.get("h1", 7.0), eave=spec.get("eave", 2.5))
        return m
    return fr, build


def _rangka(rect, sf):
    """P(u, d, z) → titik denah model. u = sumbu panjang min_rect, d = sf * v (d positif = sisi DEPAN)."""
    cx, cy, ang, _, _ = rect
    c, s = math.cos(ang), math.sin(ang)
    return lambda u, d, z: (cx + u * c - sf * d * s, cy + u * s + sf * d * c, z)


def _kotak_p(m, P, u0, u1, d0, d1, z0, z1, col, roof=None):
    """Kotak sejajar rangka P (tanpa alas)."""
    m.extrude([P(u0, d0, 0)[:2], P(u1, d0, 0)[:2], P(u1, d1, 0)[:2], P(u0, d1, 0)[:2]], z0, z1, col, roof=roof)


def _panel_d(m, P, u0, u1, d, z0, z1, out, col):
    """Panel tipis di muka d = konstan, normal ke arah out (+1 / -1 sepanjang d)."""
    m.poly_out([P(u0, d, z0), P(u1, d, z0), P(u1, d, z1), P(u0, d, z1)], P((u0 + u1) / 2, d - out * 3, (z0 + z1) / 2), col)


def _panel_u(m, P, u, d0, d1, z0, z1, out, col):
    m.poly_out([P(u, d0, z0), P(u, d1, z0), P(u, d1, z1), P(u, d0, z1)], P(u - out * 3, (d0 + d1) / 2, (z0 + z1) / 2), col)


def _pelana(m, Q, a0, a1, hw, zw, zr, e, ee, roof, wall, trim, lod, ang_ridge, fin=2.4, ends=(True, True)):
    """Atap pelana sepanjang sumbu a (bidang tebar layar di a0 dan a1), dinding selebar 2*hw, puncak dinding zw, bubungan zr.
    Tritisan samping e, ujung ee. wall = warna tebar layar (segitiga); trim = lisplang + selembayung (lod < 2)."""
    s = (zr - zw) / hw
    ze = zw - s * e
    ref = Q((a0 + a1) / 2, 0, zw - 2.0)
    for sb in (-1, 1):
        m.poly_out([Q(a0 - ee, sb * (hw + e), ze), Q(a1 + ee, sb * (hw + e), ze), Q(a1 + ee, 0, zr), Q(a0 - ee, 0, zr)], ref, roof)
    for a, ae, on in ((a0, a0 - ee, ends[0]), (a1, a1 + ee, ends[1])):
        if not on:
            continue
        if wall:
            m.poly_out([Q(a, -hw, zw), Q(a, hw, zw), Q(a, 0, zr - 0.2)], ref, wall)
        if trim and lod < 2:
            for sb in (-1, 1):
                m.prism(Q(ae, sb * (hw + e), ze), Q(ae, 0, zr), 0.5, trim, wz=0.5)
            x, y, _ = Q(ae, 0, 0)
            x_finial(m, x, y, zr - 0.3, ang_ridge, fin, trim)


def _inner_rect(pts):
    """Persegi panjang sejajar sumbu terbesar di dalam cincin pts (tepi calon = koordinat titik sudut)."""
    us = sorted({round(p[0], 2) for p in pts})
    ds = sorted({round(p[1], 2) for p in pts})
    best, e = None, 0.6
    for i, u0 in enumerate(us):
        for u1 in us[i + 1:]:
            for j, d0 in enumerate(ds):
                for d1 in ds[j + 1:]:
                    a = (u1 - u0) * (d1 - d0)
                    if best and a <= best[0]:
                        continue
                    cs = [(u0 + e, d0 + e), (u1 - e, d0 + e), (u1 - e, d1 - e), (u0 + e, d1 - e),
                          ((u0 + u1) / 2, d0 + e), ((u0 + u1) / 2, d1 - e), (u0 + e, (d0 + d1) / 2), (u1 - e, (d0 + d1) / 2)]
                    if not all(inside(c, pts) for c in cs):
                        continue
                    if any(u0 + e < p[0] < u1 - e and d0 + e < p[1] < d1 - e for p in pts):
                        continue
                    best = (a, u0 + e, u1 - e, d0 + e, d1 - e)
    return best[1:]


def _edge_d(pts, u):
    """d terbesar tempat garis u = konstan memotong tepi cincin pts (u, d)."""
    out = []
    for (u0, d0), (u1, d1) in zip(pts, pts[1:] + pts[:1]):
        if (u0 - u) * (u1 - u) <= 0 and abs(u1 - u0) > 1e-6:
            out.append(d0 + (d1 - d0) * (u - u0) / (u1 - u0))
    return max(out)


def b_gubernur(spec):
    """Kantor Gubernur Riau (sayap 4 lantai) + Menara Lancang Kuning (9 lantai), gaya Melayu Riau.
    DEPAN = sisi TIMUR (halaman rumput lebar ke Jl. Jend. Sudirman, x ≈ +160 m; jalan & bangunan dari data Overture):
    di barat sayap ada gedung kantor lain berjarak ±1,5 m, menara ada tepat di selatan sayap.
    Sayap: podium + tangga, serambi bertiang lantai dasar, pilaster tiap ±6 m, atap limas panjang + tiga paviliun menonjol
    beratap pelana melintang (tebar layar menghadap depan, lisplang emas, selembayung), paviliun tengah = pintu utama + beranda.
    Menara: podium 2 lantai mengikuti jejak, badan kaca dengan pilar sudut + rusuk tegak, lantai puncak mundur, mahkota
    Melayu dua tingkat (limas lebar + pelana tinggi). Selasar beratap pelana bila jarak ≤ 25 m.
    [INFERENSI] semua bentuk di atas (tanpa foto rujukan); jejak + jumlah lantai menara dari OSM. Pintu/kanopi/pohon/lampu =
    potongan (src/city/parts.data.js)."""
    fr = Frame([way(w) for w in spec["ways"]])
    GENTENG, EMAS, KREM, KREM2, TERAS = "#a8472c", "#d8aa2e", "#e6dcc3", "#f4efe0", "#b9b2a3"
    KACA = "#26323a"

    def front_sign(ang):
        # v rangka = (-sin, cos); pilih tanda yang mengarah ke TIMUR (+x denah) = halaman depan
        return 1 if -math.sin(ang) > 0 else -1

    # --- sayap kantor ---
    poly0 = fr.pts(way(spec["ways"][0]))
    R0 = min_rect(poly0)
    cx, cy, ang, L, W = R0
    sf = front_sign(ang)
    P = _rangka(R0, sf)
    print(f"[gubernur] frame sayap: {{ cx: {cx:.3f}, cy: {cy:.3f}, ang: {ang:.4f}, L: {L:.3f}, W: {W:.3f} }} sf={sf} "
          f"(d+ = v{'+' if sf > 0 else '-'}, arah depan denah = ({-sf * math.sin(ang):.3f}, {sf * math.cos(ang):.3f}))")
    hu, hw0 = L / 2, W / 2
    zp, fh = 0.9, 4.2
    H = zp + 4 * fh
    ang_d = math.atan2(sf * math.cos(ang), -sf * math.sin(ang))   # arah sumbu d di denah
    # paviliun: (u tengah, setengah lebar, menonjol, tambahan tinggi)
    PAV = [(-0.32 * L, 7.0, 4.0, 0.0), (0.0, 10.0, 6.0, fh), (0.32 * L, 7.0, 4.0, 0.0)]
    porch_d = hw0 + 6.0 + 5.2            # tepi depan beranda paviliun tengah
    pf = porch_d + 1.5                   # tepi depan teras di depan beranda (awal tangga)

    def free_spans():
        """Rentang u fasad depan yang tidak tertutup paviliun."""
        cuts = sorted((uc - pw, uc + pw) for uc, pw, _, _ in PAV)
        out, u = [], -hu
        for a, b in cuts:
            out.append((u, a))
            u = b
        out.append((u, hu))
        return out

    def covered(u):
        return any(abs(u - uc) < pw + 0.6 for uc, pw, _, _ in PAV)

    # --- menara ---
    tp0 = fr.pts(way(spec["ways"][1]))
    RT = min_rect(tp0)
    sfT = front_sign(RT[2])
    PT = _rangka(RT, sfT)
    cT, sT = math.cos(RT[2]), math.sin(RT[2])
    tud = [((x - RT[0]) * cT + (y - RT[1]) * sT, sfT * (-(x - RT[0]) * sT + (y - RT[1]) * cT)) for x, y in tp0]
    bu0, bu1, bd0, bd1 = _inner_rect(tud)
    bu0, bu1, bd0, bd1 = bu0 + 4.0, bu1 - 4.0, bd0 + 4.0, bd1 - 4.0       # podium lebih lebar ±4 m dari badan
    ubc, dbc, Lb, Wb = (bu0 + bu1) / 2, (bd0 + bd1) / 2, bu1 - bu0, bd1 - bd0
    de = _edge_d(tud, ubc)                                               # muka depan podium di poros badan
    fT = 3.8
    zpod, ztop, TH = 2 * fT, 8 * fT, 9 * fT
    print(f"[gubernur] menara: rangka ang {RT[2]:.4f} sf={sfT}, badan u {bu0:.1f}..{bu1:.1f} d {bd0:.1f}..{bd1:.1f} "
          f"({Lb:.1f} x {Wb:.1f} m), muka depan podium d {de:.1f}")
    # pintu menara (untuk resep potongan, dalam rangka sayap: u, v)
    tx, ty, _ = PT(ubc, de, 0)
    tu = (tx - cx) * math.cos(ang) + (ty - cy) * math.sin(ang)
    tv = -(tx - cx) * math.sin(ang) + (ty - cy) * math.cos(ang)
    print(f"[gubernur] pintu menara di rangka sayap: u {tu:.2f} v {tv:.2f}; pintu utama sayap: u 0 v {sf * (hw0 + 6.05):.2f}")
    site = [P(-hu - 2, -hw0 - 0.5, 0), P(hu + 2, -hw0 - 0.5, 0), P(hu + 2, hw0 + 30, 0), P(-hu - 2, hw0 + 30, 0)]
    print("[gubernur] site:", [[round(x, 1), round(y, 1)] for x, y, _ in site])

    # --- selasar: sinar dari ujung selatan sayap (−u) ke jejak menara ---
    ax, ay, _ = P(-hu, 0, 0)
    dx, dy = -math.cos(ang), -math.sin(ang)
    gap = None
    for (x0, y0), (x1, y1) in zip(tp0, tp0[1:] + tp0[:1]):
        ex, ey = x1 - x0, y1 - y0
        den = dx * ey - dy * ex
        if abs(den) < 1e-9:
            continue
        t = ((x0 - ax) * ey - (y0 - ay) * ex) / den
        k = ((x0 - ax) * dy - (y0 - ay) * dx) / den
        if t > 0 and 0 <= k <= 1:
            gap = t if gap is None else min(gap, t)
    print(f"[gubernur] jarak sayap-menara: {gap:.1f} m")

    def wing(m, lod):
        # 1. podium/teras + tangga
        if lod < 2:
            ring = [(-hu - 2, -hw0 - 0.5), (hu + 2, -hw0 - 0.5), (hu + 2, hw0 + 2)]
            for uc, pw, p, _ in sorted(PAV, key=lambda t: -t[0]):
                dd = pf if p > 5 else hw0 + p + 2
                ring += [(uc + pw + 2, hw0 + 2), (uc + pw + 2, dd), (uc - pw - 2, dd), (uc - pw - 2, hw0 + 2)]
            ring.append((-hu - 2, hw0 + 2))
            m.extrude([P(u, d, 0)[:2] for u, d in ring], 0, zp, BATU, roof=BATU)
            _kotak_p(m, P, -8, 8, pf - 0.3, pf + 1.6, 0, 0.6, "#cfc8b6", roof="#cfc8b6")
            _kotak_p(m, P, -9, 9, pf - 0.3, pf + 3.2, 0, 0.3, "#cfc8b6", roof="#cfc8b6")
        # 2. badan: lantai dasar depan dimundurkan 3 m (serambi), lantai atas penuh
        if lod == 2:
            _kotak_p(m, P, -hu, hu, -hw0, hw0, 0, H, KREM)
        else:
            _kotak_p(m, P, -hu, hu, -hw0, hw0 - 3.0, zp, zp + fh, KREM)
            _kotak_p(m, P, -hu, hu, -hw0, hw0, zp + fh, H, KREM)
            _panel_d(m, P, -hu, hu, hw0 - 3.0 + 0.06, zp + 0.4, zp + fh - 0.5, 1, "#6f6656")   # dinding serambi digelapkan
        if lod == 0:
            m.poly_out([P(-hu, hw0 - 3.0, zp + fh), P(hu, hw0 - 3.0, zp + fh), P(hu, hw0, zp + fh), P(-hu, hw0, zp + fh)],
                       P(0, hw0 - 1.5, zp + fh + 3), "#d9cfb6")                                   # plafon serambi
            n = max(1, round(L / 6.0))
            step = L / n
            for k in range(n + 1):                       # pilaster + kolom serambi
                u = -hu + k * step
                _kotak_p(m, P, u - 0.45, u + 0.45, -hw0 - 0.5, -hw0 + 0.2, zp, H, KREM2)
                if not covered(u):
                    _kotak_p(m, P, u - 0.45, u + 0.45, hw0 - 0.2, hw0 + 0.5, zp + fh, H, KREM2)
                    _kotak_p(m, P, u - 0.3, u + 0.3, hw0 - 0.7, hw0 - 0.1, zp, zp + fh, KREM2)
            for k in range(n):                           # ceruk jendela: pita kaca + ambang terang per lantai
                u0, u1 = -hu + k * step + 0.9, -hu + (k + 1) * step - 0.9
                for f in range(4):
                    z0 = zp + f * fh
                    _panel_d(m, P, u0, u1, -hw0 - 0.06, z0 + 1.0, z0 + 3.2, -1, KACA)
                    _panel_d(m, P, u0 - 0.2, u1 + 0.2, -hw0 - 0.06, z0 + 0.7, z0 + 1.0, -1, KREM2)
                    if f == 0 or covered((u0 + u1) / 2):
                        continue
                    _panel_d(m, P, u0, u1, hw0 + 0.06, z0 + 1.0, z0 + 3.2, 1, KACA)
                    _panel_d(m, P, u0 - 0.2, u1 + 0.2, hw0 + 0.06, z0 + 0.7, z0 + 1.0, 1, KREM2)
                if not covered((u0 + u1) / 2):           # pintu/jendela kaca di dinding serambi
                    _panel_d(m, P, u0 + 0.6, u1 - 0.6, hw0 - 3.0 + 0.12, zp + 0.5, zp + 3.0, 1, KACA)
            for su in (-1, 1):                           # jendela dinding ujung
                for f in range(4):
                    z0 = zp + f * fh
                    _panel_u(m, P, su * (hu + 0.06), -hw0 + 2.5, hw0 - 5.0, z0 + 1.0, z0 + 3.2, su, KACA)
            for a, b in free_spans():                    # balok serambi
                if b - a > 1:
                    _kotak_p(m, P, a, b, hw0 + 0.05, hw0 + 0.35, zp + fh - 0.45, zp + fh + 0.35, KREM2)
        elif lod == 1:                                   # LOD1: satu pita kaca per lantai per rentang fasad depan
            for a, b in free_spans():
                if b - a > 3:
                    for f in range(1, 4):
                        _panel_d(m, P, a + 1.2, b - 1.2, hw0 + 0.06, zp + f * fh + 1.0, zp + f * fh + 3.2, 1, KACA)
        # 3. atap limas panjang
        m.hip(cx, cy, ang, L + 3.6, W + 3.6, H, 6.5, 0.85, GENTENG)
        if lod < 2:
            for sd in (-1, 1):
                m.prism(P(-hu - 1.8, sd * (hw0 + 1.8), H), P(hu + 1.8, sd * (hw0 + 1.8), H), 0.4, KREM2, wz=0.5)
        # 4. tiga paviliun melintang
        for uc, pw, p, extra in PAV:
            zw = H + extra
            dfront = hw0 + p
            center = extra > 0
            a0 = -hw0 - 0.3 if center else -hw0
            _kotak_p(m, P, uc - pw, uc + pw, a0 if center else hw0 - 0.3, dfront, zp if lod < 2 else 0, zw, KREM)
            Q = (lambda uc_: (lambda a, b, z: P(uc_ + b, a, z)))(uc)
            zr = zw + (10.0 if center else 8.0)
            _pelana(m, Q, a0, dfront, pw, zw, zr, 1.5, 1.2, GENTENG, KREM2 if lod < 2 else None, EMAS, lod, ang_d, fin=2.6 if center else 2.2)
            if lod == 0:
                m.prism(P(uc - pw, dfront + 0.15, zw), P(uc + pw, dfront + 0.15, zw), 0.3, EMAS, wz=0.5)   # pita emas kaki tebar layar
                for su in (-1, 1):                       # pilaster sudut paviliun
                    _kotak_p(m, P, uc + su * pw - 0.6, uc + su * pw + 0.6, dfront - 0.6, dfront + 0.4, zp, zw, KREM2)
            if lod < 2:
                nfl = 5 if center else 4
                for f in range(1, nfl):
                    z0 = zp + f * fh
                    _panel_d(m, P, uc - pw + 1.6, uc + pw - 1.6, dfront + 0.06, z0 + 1.0, z0 + 3.2, 1, KACA)
                    _panel_d(m, P, uc - pw + 1.4, uc + pw - 1.4, dfront + 0.06, z0 + 0.7, z0 + 1.0, 1, KREM2)
                if not center:
                    _panel_d(m, P, uc - pw + 1.6, uc + pw - 1.6, dfront + 0.06, zp + 1.0, zp + 3.2, 1, KACA)
            if center and lod < 2:                       # beranda bertiang dua lantai + pelana kecil di depan
                zb = zp + 2 * fh
                _kotak_p(m, P, uc - 8, uc + 8, dfront - 0.3, porch_d, zb, zb + 0.6, KREM2, roof=KREM2)
                for u in (-7.0, -3.5, 3.5, 7.0):
                    _kotak_p(m, P, uc + u - 0.4, uc + u + 0.4, porch_d - 1.0, porch_d - 0.2, zp, zb, KREM2)
                _pelana(m, Q, dfront - 0.3, porch_d, 8.0, zb + 0.6, zb + 5.6, 0.8, 0.8, GENTENG, KREM2, EMAS, lod, ang_d,
                        fin=1.8, ends=(False, True))
        # 5. selasar ke menara
        if gap is not None and gap <= 25 and lod < 2:
            _kotak_p(m, P, -hu - gap - 0.5, -hu + 0.5, -2.5, 2.5, 0, 4.2, KREM)
            _pelana(m, P, -hu - gap - 0.5, -hu + 0.5, 2.5, 4.2, 6.4, 0.8, 0.0, GENTENG, None, None, lod, ang, ends=(False, False))
            if lod == 0:
                for sd in (-1, 1):
                    _panel_d(m, P, -hu - gap + 0.5, -hu - 0.5, sd * 2.56, 1.2, 3.4, sd, KACA)

    def tower(m, lod):
        # 1. podium 2 lantai mengikuti jejak + parapet
        tp = simplify(tp0, tol(lod))
        m.extrude(tp, 0, zpod, KREM, roof=TERAS, bands=bands(0, 2, fT, KREM, GLASS) if lod == 0 else None)
        if lod == 0:
            pr = ccw(tp)
            inner = _grow(pr, -0.35)
            m.extrude(pr, zpod, zpod + 1.0, KREM2)
            for (a, b), (ai, bi) in zip(zip(pr, pr[1:] + pr[:1]), zip(inner, inner[1:] + inner[:1])):
                m.poly([(bi[0], bi[1], zpod), (ai[0], ai[1], zpod), (ai[0], ai[1], zpod + 1.0), (bi[0], bi[1], zpod + 1.0)], KREM2)
                m.poly([(a[0], a[1], zpod + 1.0), (b[0], b[1], zpod + 1.0), (bi[0], bi[1], zpod + 1.0), (ai[0], ai[1], zpod + 1.0)], KREM2)
        # 2. badan kaca + pilar sudut + rusuk tegak + pelat lantai
        _kotak_p(m, PT, bu0, bu1, bd0, bd1, zpod, ztop if lod < 2 else TH + 0.4, GLASS if lod < 2 else KREM, roof=None if lod < 2 else KREM)
        if lod < 2:
            for u0, u1 in ((bu0 - 0.3, bu0 + 2.2), (bu1 - 2.2, bu1 + 0.3)):
                for d0, d1 in ((bd0 - 0.3, bd0 + 2.2), (bd1 - 2.2, bd1 + 0.3)):
                    _kotak_p(m, PT, u0, u1, d0, d1, zpod, ztop, KREM2)
            sp = 3.5 if lod == 0 else 7.0
            for a, b in ((bu0 + 2.2, bu1 - 2.2),):
                n = max(1, round((b - a) / sp))
                for k in range(1, n):
                    u = a + (b - a) * k / n
                    for d0, d1 in ((bd1 - 0.1, bd1 + 0.45), (bd0 - 0.45, bd0 + 0.1)):
                        _kotak_p(m, PT, u - 0.25, u + 0.25, d0, d1, zpod, ztop, KREM2)
            a, b = bd0 + 2.2, bd1 - 2.2
            n = max(1, round((b - a) / sp))
            for k in range(1, n):
                d = a + (b - a) * k / n
                for u0, u1 in ((bu1 - 0.1, bu1 + 0.45), (bu0 - 0.45, bu0 + 0.1)):
                    _kotak_p(m, PT, u0, u1, d - 0.25, d + 0.25, zpod, ztop, KREM2)
            if lod == 0:
                for k in range(1, 6):
                    z = zpod + k * fT
                    _kotak_p(m, PT, bu0 - 0.12, bu1 + 0.12, bd0 - 0.12, bd1 + 0.12, z - 0.18, z + 0.18, KREM2)
            # 3. pita emas + lantai puncak dimundurkan 1,5 m
            _kotak_p(m, PT, bu0 - 0.5, bu1 + 0.5, bd0 - 0.5, bd1 + 0.5, ztop, ztop + 0.7, EMAS, roof=TERAS)
            _kotak_p(m, PT, bu0 + 1.5, bu1 - 1.5, bd0 + 1.5, bd1 - 1.5, ztop + 0.7, TH + 0.4, KREM)
            if lod == 0:
                for sd in (-1, 1):
                    _panel_d(m, PT, bu0 + 3.0, bu1 - 3.0, dbc + sd * (Wb / 2 - 1.5 + 0.06), ztop + 1.5, TH - 0.4, sd, KACA)
                for su in (-1, 1):
                    _panel_u(m, PT, ubc + su * (Lb / 2 - 1.5 + 0.06), bd0 + 3.0, bd1 - 3.0, ztop + 1.5, TH - 0.4, su, KACA)
        # 4. mahkota Melayu dua tingkat
        zc = TH + 0.4
        bx, by, _ = PT(ubc, dbc, 0)
        L1, W1 = Lb - 3.0 + 6.0, Wb - 3.0 + 6.0
        m.hip(bx, by, RT[2], L1, W1, zc, 5.0, 0.55, GENTENG)
        if lod < 2:
            for sd in (-1, 1):
                m.prism(PT(ubc - L1 / 2, dbc + sd * W1 / 2, zc), PT(ubc + L1 / 2, dbc + sd * W1 / 2, zc), 0.5, EMAS, wz=0.5)
            for su in (-1, 1):
                m.prism(PT(ubc + su * L1 / 2, dbc - W1 / 2, zc), PT(ubc + su * L1 / 2, dbc + W1 / 2, zc), 0.5, EMAS, wz=0.5)
        an, hw2 = 0.25 * Lb, max(4.0, 0.18 * Wb)
        if lod < 2:
            _kotak_p(m, PT, ubc - an, ubc + an, dbc - hw2, dbc + hw2, zc + 2.5, zc + 6.0, KREM2)
        Q2 = lambda a, b, z: PT(ubc + a, dbc + b, z)  # noqa: E731
        _pelana(m, Q2, -an, an, hw2, zc + 6.0, zc + 12.0, 1.5, 1.5, GENTENG, KREM2 if lod < 2 else None, EMAS, lod, RT[2], fin=3.0)
        # 5. kanopi masuk depan (pelat + 4 kolom); pintu = potongan
        if lod < 2:
            _kotak_p(m, PT, ubc - 7, ubc + 7, de - 0.3, de + 6.0, 4.6, 5.2, KREM2, roof=KREM2)
            if lod == 0:
                _kotak_p(m, PT, ubc - 7.1, ubc + 7.1, de + 5.95, de + 6.2, 4.5, 5.3, EMAS)
                for u in (-6.0, -3.5, 3.5, 6.0):
                    _kotak_p(m, PT, ubc + u - 0.3, ubc + u + 0.3, de + 5.0, de + 5.6, 0, 4.6, KREM2)

    def build(lod):
        m = Mesh()
        wing(m, lod)
        tower(m, lod)
        return m
    return fr, build


def b_soeman(spec):
    """Perpustakaan Soeman Hs.: konsep REHAL (penyangga Al-Qur'an, X) + BUKU TERBUKA.
    Penampang melintang = V lebar: dua fasad kaca panjang condong keluar, atap dua "halaman" tinggi di tepi luar dan turun
    ke lembah tengah (skylight), ujung lancip menjorok; dinding ujung bermotif X putih gading. Depan (lobi, tangga) = sisi -v.
    [INFERENSI] 6 lantai x 4 m, sudut condong, tinggi atap; pintu/kanopi/pohon/lampu = potongan (src/city/parts.data.js)."""
    fr = Frame([way(w) for w in spec["ways"]])
    poly0 = fr.pts(way(spec["ways"][0]))
    cx, cy, ang, L, W = min_rect(poly0)
    print(f"[soeman] frame: {{ cx: {cx:.3f}, cy: {cy:.3f}, ang: {ang:.4f}, L: {L:.3f}, W: {W:.3f} }}")
    c, s = math.cos(ang), math.sin(ang)
    P = lambda u, v, z: (cx + u * c - v * s, cy + u * s + v * c, z)  # noqa: E731

    n, H, zb = 6, 24.0, 1.0            # lantai, tinggi atap fasad, puncak podium
    vb, vt = 0.34 * W, 0.50 * W        # kaki & puncak fasad condong (|v|)
    vk, zk = vt + 2.5, H + 8.5         # ujung lancip "halaman"
    zv = H - 1.5                       # lembah tengah atap
    GL, GL2 = "#1c3140", "#8fb4c9"     # kaca gelap / biru terang (dikenali shader malam)
    ATAP, GADING, BETON, PELAT = "#a9bccb", "#f4efe0", "#b8bec2", "#e6e8e6"
    ref = P(0, 0, H / 2)

    def vz(z):
        return vb + (z - zb) / (H - zb) * (vt - vb)

    def kotak(u0, u1, v0, v1, z0, z1, col, roof=None):
        m.extrude([P(u0, v0, 0)[:2], P(u1, v0, 0)[:2], P(u1, v1, 0)[:2], P(u0, v1, 0)[:2]], z0, z1, col, roof=roof)

    def half(sv, k=1.0, zc=14.0):
        """Setengah penampang (v, z) sisi sv (cembung); k = skala terhadap (0, zc) untuk panel kaca."""
        pts = [(sv * vb, zb), (0, zb), (0, zv), (sv * vk, zk), (sv * vt, H)]
        return [(v * k, zc + (z - zc) * k) for v, z in pts]

    m = None

    def build(lod):
        nonlocal m
        m = Mesh()
        hu = L / 2
        # 1. podium batu + dua anak tangga lebar di depan (-v)
        kotak(-hu - 2.5, hu + 2.5, -W / 2 - 2.5, W / 2 + 2.5, 0, zb, BATU, roof=BATU)
        if lod < 2:
            for k, zt in enumerate((0.35, 0.7)):
                kotak(-12, 12, -W / 2 - 2.5 - (2 - k) * 1.5, -W / 2 - 1.5, 0, zt, "#cfc8b6", roof="#cfc8b6")
        # 2. dua fasad panjang condong keluar ("halaman buku")
        for sv in (-1, 1):
            if lod == 0:
                fh = (H - zb) / n
                for k in range(n):
                    z0 = zb + k * fh
                    for a, b, col in ((z0, z0 + 0.22 * fh, PELAT), (z0 + 0.22 * fh, z0 + fh, GL)):
                        m.poly_out([P(-hu, sv * vz(a), a), P(hu, sv * vz(a), a), P(hu, sv * vz(b), b), P(-hu, sv * vz(b), b)], ref, col)
                for i in range(1, 14):          # rusuk tegak putih ikut condong
                    u = -hu + L * i / 14
                    m.prism(P(u, sv * (vb + 0.4), zb), P(u, sv * (vt + 0.4), H), 0.7, GADING, wz=0.7)
            else:
                m.poly_out([P(-hu, sv * vb, zb), P(hu, sv * vb, zb), P(hu, sv * vt, H), P(-hu, sv * vt, H)], ref, GL)
            # 3. atap halaman: lembah -> ujung lancip; bidang bawah ujung (tebal "halaman") putih gading
            m.poly_out([P(-hu, 0, zv), P(hu, 0, zv), P(hu, sv * vk, zk), P(-hu, sv * vk, zk)], ref, ATAP)
            m.poly_out([P(-hu, sv * vt, H), P(hu, sv * vt, H), P(hu, sv * vk, zk), P(-hu, sv * vk, zk)], ref, GADING)
            if lod == 0:                        # gording atap: garis "halaman" melintang
                for i in range(1, 10):
                    u = -hu + L * i / 10
                    m.prism(P(u, sv * 2.0, zv + (zk - zv) * 2.0 / vk + 0.25), P(u, sv * (vk - 0.6), zk - (zk - zv) * 0.6 / vk + 0.25), 0.4, GADING, wz=0.3)
        # 4. dinding ujung (beton + panel kaca) + rehal X menonjol
        for su in (-1, 1):
            for sv in (-1, 1):
                m.poly_out([P(su * hu, v, z) for v, z in half(sv)], ref, BETON)
                if lod < 2:
                    m.poly_out([P(su * (hu + 0.06), v, z) for v, z in half(sv, 0.8)], ref, GL)
                ux = su * (hu + (0.55 if sv < 0 else 0.65))   # dua balok X beda 0,1 m: tidak berimpit di persilangan
                m.prism(P(ux, sv * vk, zk), P(ux, -sv * vb, zb), 0.9, GADING, caps=lod < 2, wz=1.4)
        # lembah: skylight memanjang
        m.prism(P(-hu + 4, 0, H - 0.8), P(hu - 4, 0, H - 0.8), 3.2, GL2, caps=True, wz=2.4)
        # 5. lobi rendah di tengah depan (-v): kaca + pelat atap datar + 4 kolom
        if lod < 2:
            kotak(-8, 8, -vb + 2, -vb - 7, zb, 7.0, GL)
            kotak(-9.5, 9.5, -vb + 1, -vb - 8.5, 7.0, 7.8, PELAT, roof=PELAT)
            if lod == 0:
                for u in (-7.6, -4.2, 4.2, 7.6):   # celah tengah untuk potongan pintu + kanopi
                    m.prism(P(u, -vb - 7.8, zb), P(u, -vb - 7.8, 7.0), 0.6, GADING)
        return m
    return fr, build


def b_masjid(spec):
    fr = Frame([way(w) for w in spec["ways"]])

    def build(lod):
        m = Mesh()
        poly = simplify(fr.pts(way(spec["ways"][0])), tol(lod))
        cx, cy, ang, L, W = min_rect(poly)
        Hw = 9.0
        m.extrude(poly, 0, Hw, "#e8e2d0", roof="#9d9a92", bands=bands(0, 2, 4.5, "#e8e2d0", "#2a3b3a") if lod == 0 else None)
        R = min(L, W) * 0.3
        seg = 20 if lod == 0 else 12 if lod == 1 else 8
        m.revolve(cx, cy, Hw, [(R * 0.9, 0), (R * 0.9, 4.0)], seg, "#ece5d2")
        dome(m, cx, cy, Hw + 4.0, R, R * 1.2, seg, 8 if lod == 0 else 5 if lod == 1 else 3, spec["dome"], spec.get("dome2"))
        if lod < 2:
            m.revolve(cx, cy, Hw + 4.0 + R * 1.2, [(0.5, 0), (0.2, 2.4), (0, 3.4)], 6, "#d8aa2e")
        mx, my = cx + math.cos(ang) * (L / 2 + 1.5), cy + math.sin(ang) * (L / 2 + 1.5)
        seg2 = 8 if lod == 0 else 6
        m.revolve(mx, my, 0, [(1.7, 0), (1.7, 26)], seg2, "#e2d08e")
        m.revolve(mx, my, 26, [(2.5, 0), (2.5, 1.0), (1.4, 1.0)], seg2, "#3a9a88", cap_top=True)
        dome(m, mx, my, 27, 1.9, 3.6, seg2 if lod < 2 else 4, 5 if lod == 0 else 3, spec["dome"], None)
        return m
    return fr, build


# ---------------- tugu / monumen ----------------
def at_node(nid):
    n = FOOT["node"][str(nid)]
    return n["x"], n["z"]


def b_tugu_selais(spec):
    x, z = at_node(spec["node"])

    def build(lod):
        m = Mesh()
        seg = 24 if lod == 0 else 14 if lod == 1 else 8
        m.revolve(0, 0, 0, [(11.0, 0), (11.0, 0.9), (10.0, 0.9)], seg, "#cdc7b8", cap_top=True)
        m.revolve(0, 0, 0, [(10.0, 0.4), (10.0, 0.5)], seg, "#4a7ea6", cap_top=True)
        m.revolve(0, 0, 0.5, [(4.4, 0), (4.0, 2.6), (3.2, 2.6)], seg, "#bdb7a5", cap_top=True)
        n = 8 if lod == 0 else 5 if lod == 1 else 3
        for f in range(3):
            base = 2 * math.pi * f / 3
            prev = None
            for k in range(n + 1):
                t = k / n
                r = 2.3 * (1 - t) + 0.5
                th = base + 1.1 * t
                p = (r * math.cos(th), r * math.sin(th), 3.1 + 8.8 * t)
                if prev:
                    m.prism(prev, p, 1.7 * (1 - 0.65 * t) + 0.3, "#b87333", caps=True)
                prev = p
            if lod < 2:  # sirip ekor mekar di puncak
                for sg in (-1, 1):
                    m.prism(prev, (prev[0] + math.cos(base + 1.1 + sg * 0.9) * 1.6, prev[1] + math.sin(base + 1.1 + sg * 0.9) * 1.6, prev[2] + 1.8), 0.35, "#b87333")
        return m
    return Frame([[(x, z)]]), build


def obelisk(m, h, w, col, cap, steps=3):
    for k in range(steps):
        m.box(0, 0, k * 0.5, w * 1.8 + (steps - k) * 1.4, w * 1.8 + (steps - k) * 1.4, 0.5, "#bdb7a5")
    s0 = steps * 0.5
    m.prism((0, 0, s0), (0, 0, s0 + h), w, col, caps=True)
    m.prism((0, 0, s0 + h), (0, 0, s0 + h + w), w * 0.7, cap, caps=True)


def b_tugu_zapin(spec):
    x, z = at_node(spec["node"])

    def build(lod):
        m = Mesh()
        obelisk(m, 9.0, 1.8, "#e8e0c8", "#d8aa2e")
        if lod < 2:  # [INFERENSI] empat "lengan penari zapin" melengkung di sekeliling tiang
            for k in range(4):
                a = math.pi / 2 * k
                m.prism((math.cos(a) * 0.9, math.sin(a) * 0.9, 2.2), (math.cos(a) * 2.8, math.sin(a) * 2.8, 7.2), 0.5, "#d8aa2e")
        return m
    return Frame([[(x, z)]]), build


def b_tugu_perjuangan(spec):
    x, z = at_node(spec["node"])

    def build(lod):
        m = Mesh()
        obelisk(m, 13.0, 1.6, "#d9d3c4", "#8a8d8f", steps=4)
        return m
    return Frame([[(x, z)]]), build


def b_tugu_keris(spec):
    x, z = at_node(spec["node"])

    def build(lod):
        m = Mesh()
        m.revolve(0, 0, 0, [(5.0, 0), (4.5, 1.2), (3.0, 1.2)], 10 if lod < 2 else 6, "#bdb7a5", cap_top=True)
        m.prism((0, 0, 1.2), (0, 0, 4.0), 1.0, "#d8aa2e", caps=True)  # hulu emas
        n = 14 if lod == 0 else 8 if lod == 1 else 4
        for k in range(n):  # bilah bergelombang (luk), makin runcing
            t = k / n
            cx = 0.9 * math.sin(k * 0.95) * (1 - 0.6 * t)
            m.box(cx, 0, 4.0 + t * 18.0, 2.6 * (1 - t) + 0.45, 0.8, 18.0 / n + 0.05, "#c9ced0")
        return m
    return Frame([[(x, z)]]), build


def b_tugu_bambu(spec):
    x, z = at_node(spec["node"])

    def build(lod):
        m = Mesh()
        m.revolve(0, 0, 0, [(4.5, 0), (4.0, 1.0), (3.0, 1.0)], 10 if lod < 2 else 6, "#bdb7a5", cap_top=True)
        for k in range(5):
            a = 2 * math.pi * k / 5
            hh = 11.0 + 3.0 * hash01(k, 7)
            cx, cy = 1.6 * math.cos(a), 1.6 * math.sin(a)
            m.revolve(cx, cy, 1.0, [(0.75, 0), (0.7, hh * 0.45)], 6, "#b3261e")
            m.revolve(cx, cy, 1.0 + hh * 0.45, [(0.7, 0), (0.7, 1.0)], 6, "#e8e4da")
            m.revolve(cx, cy, 1.0 + hh * 0.45 + 1.0, [(0.7, 0), (0.55, hh * 0.35), (0, hh * 0.2)], 6, "#b3261e")
        return m
    return Frame([[(x, z)]]), build


def b_skyhawk(spec):
    x, z = at_node(spec["node"])

    def build(lod):
        m = Mesh()
        m.prism((0, 0, 0), (0, 0, 6.2), 1.0, "#bdb7a5", caps=True)
        g = "#8f969c"
        m.prism((-5.0, 0, 7.0), (5.0, 0, 7.9), 1.5, g, caps=True)           # badan
        m.prism((-0.8, -5.2, 7.5), (-0.8, 5.2, 7.5), 2.4, g, wz=0.3)      # sayap
        m.prism((-4.4, 0, 7.4), (-5.2, 0, 10.0), 0.3, g, wz=1.8)          # sirip ekor
        m.prism((-4.5, -2.0, 7.6), (-4.5, 2.0, 7.6), 1.4, g, wz=0.25)     # sayap ekor
        return m
    return Frame([[(x, z)]]), build


# ---------------- bandara ----------------
def b_terminal(spec):
    fr = Frame([way(w) for w in spec["ways"]])

    def build(lod):
        m = Mesh()
        term = simplify(fr.pts(way(spec["ways"][0])), tol(lod))
        H = 12.0
        m.extrude(term, 0, H, "#dfe1e0", roof="#9aa0a6", bands=bands(0, 2, 6.0, "#dfe1e0", "#1c2d3a") if lod == 0 else None)
        cx, cy, ang, L, W = min_rect(term)
        m.hip(cx, cy, ang, L * 0.9, W * 0.5, H, 3.0, 1.0, "#c9ced0")  # atap tengah sedikit naik
        vip = simplify(fr.pts(way(spec["ways"][1])), tol(lod))
        m.extrude(vip, 0, 8.0, "#e6dcc3", roof="#8c3a24")
        melayu_roof(m, vip, 8.0, lod, "#8c3a24", "#d8aa2e", tiers=1, h1=6.0, eave=2.0)
        return m
    return fr, build


def strip(m, line, width, z, col):
    for a, b in zip(line, line[1:]):
        L = math.dist(a, b)
        if L < 0.1:
            continue
        nx, ny = -(b[1] - a[1]) / L * width / 2, (b[0] - a[0]) / L * width / 2
        m.poly([(a[0] - nx, a[1] - ny, z), (b[0] - nx, b[1] - ny, z), (b[0] + nx, b[1] + ny, z), (a[0] + nx, a[1] + ny, z)], col)


def b_landasan(spec):
    air = [w for w, d in FOOT["way"].items() if d["tags"].get("aeroway") in ("runway", "taxiway", "apron") or d["tags"].get("building") == "hangar" or "hangar" in str(d["tags"])]
    runway, aprons = ["30627063"], ["30627087", "583654434", "634318391", "634318394"]
    hangars = ["315317230", "634318398", "634318404", "634318407", "918692687", "918692688"]
    tax = [w for w, d in FOOT["way"].items() if d["tags"].get("aeroway") == "taxiway"]
    use = runway + aprons + hangars + tax
    fr = Frame([[tuple(p) for p in FOOT["way"][w]["pts"]] for w in use])

    def build(lod):
        m = Mesh()
        for w in aprons:
            m.top(simplify(fr.pts([tuple(p) for p in FOOT["way"][w]["pts"]][:-1]), 2 * lod), 0.12, "#707174")
        for w in tax:
            strip(m, fr.pts([tuple(p) for p in FOOT["way"][w]["pts"]]), 23.0, 0.14, "#505257")
        rw = fr.pts([tuple(p) for p in FOOT["way"][runway[0]]["pts"]])
        strip(m, rw, 45.0, 0.16, "#3b3d41")
        if lod == 0:
            seglen = [math.dist(a, b) for a, b in zip(rw, rw[1:])]
            tot = sum(seglen)
            s = 40.0
            while s < tot - 40:
                acc, i = 0.0, 0
                while acc + seglen[i] < s:
                    acc += seglen[i]
                    i += 1
                t = (s - acc) / seglen[i]
                p0 = (rw[i][0] + (rw[i + 1][0] - rw[i][0]) * t, rw[i][1] + (rw[i + 1][1] - rw[i][1]) * t)
                t2 = min(1.0, (s + 28 - acc) / seglen[i])
                p1 = (rw[i][0] + (rw[i + 1][0] - rw[i][0]) * t2, rw[i][1] + (rw[i + 1][1] - rw[i][1]) * t2)
                strip(m, [p0, p1], 1.2, 0.2, "#e8e8e4")
                s += 60.0
        for w in hangars:
            poly = simplify(fr.pts([tuple(p) for p in FOOT["way"][w]["pts"]][:-1]), 2 * lod)
            m.extrude(poly, 0, 11.0, "#a9b0b4", roof="#8f979c")
            cx, cy, ang, L, W = min_rect(poly)
            m.hip(cx, cy, ang, L, W, 11.0, 3.5, 1.0, "#8f979c")
        return m
    return fr, build


# ---------------- daftar ----------------
MAL = dict(fh=4.6, levels=4)
SPECS = [
    dict(id="kantor-gubernur-riau", name="Kantor Gubernur Riau + Menara Lancang Kuning", fn=b_gubernur, ways=[318513897, 318513901]),
    dict(id="perpustakaan-soeman-hs", name="Perpustakaan Soeman Hs.", fn=b_soeman, ways=[318103012]),
    dict(id="balai-adat-melayu-riau", name="Balai Adat Melayu Riau", fn=b_melayu, ways=[1294872408], h=7.0, floors=1, wall="#e8dcc0", roof="#8c3a24", trim="#d8aa2e", tiers=2, h1=8.0, eave=3.0),
    dict(id="anjung-seni-idrus-tintin", name="Anjung Seni Idrus Tintin", fn=b_melayu, ways=[290157956], h=8.0, floors=1, wall="#e6d9b8", roof="#7c2f1d", trim="#d8aa2e", tiers=2, h1=8.0, eave=3.0),
    dict(id="museum-sang-nila-utama", name="Museum Sang Nila Utama", fn=b_melayu, ways=[1082088975], h=6.5, floors=1, wall="#e8e0c8", roof="#8c3a24", trim="#d8aa2e", tiers=1, h1=7.0, eave=2.5),
    dict(id="mal-ska", name="Mal SKA", fn=b_mal_ska, ways=[280698814]),
    dict(id="swiss-belinn-ska", name="Swiss-Belinn SKA", fn=b_swiss_belinn, ways=[327403746]),
    dict(id="living-world", name="Living World Pekanbaru", fn=b_living_world, ways=[327710042]),
    dict(id="flyover-ska", name="Flyover Simpang SKA", fn=b_flyover_ska),
    dict(id="ciputra-seraya-mall", name="Mal Ciputra Seraya", fn=b_mal, ways=[327709577], wall="#e9dccb", accent="#b5382c", sign=24, **MAL),
    dict(id="mall-pekanbaru", name="Mall Pekanbaru", fn=b_mal, ways=[465740381], wall="#ddd9d2", accent="#c57a1a", sign=22, **MAL),
    dict(id="plaza-suka-ramai", name="Plaza Suka Ramai", fn=b_mal, ways=[465325690], wall="#e6ddcc", accent="#7a3b8f", sign=28, **{**MAL, "levels": 3}),
    dict(id="plaza-citra", name="Plaza Citra", fn=b_mal, ways=[318513887], wall="#d9d6cf", accent="#2e7d7a", sign=22, **MAL),
    dict(id="pasar-bawah", name="Pasar Bawah", fn=b_mal, ways=[1253091010], wall="#d9c9a8", accent="#a0482a", sign=20, fh=4.2, levels=4),
    dict(id="hotel-furaya", name="Hotel Furaya", fn=b_mal, ways=[737845378], wall="#e9e5da", accent="#8a6d2a", sign=20, fh=3.5, levels=7),
    dict(id="masjid-raya-senapelan", name="Masjid Raya Senapelan", fn=b_masjid, ways=[1293729477], dome="#3f8f5a", dome2="#2f7a4a"),
    dict(id="tugu-selais", name="Tugu Selais Tiga Sepadan", fn=b_tugu_selais, node=12007849467),
    dict(id="tugu-zapin", name="Tugu Zapin 0 KM", fn=b_tugu_zapin, node=3221127383),
    dict(id="tugu-keris", name="Tugu Keris", fn=b_tugu_keris, node=3101596368),
    dict(id="tugu-perjuangan", name="Tugu Perjuangan", fn=b_tugu_perjuangan, node=3203037814),
    dict(id="tugu-bambu-runcing", name="Tugu Bambu Runcing", fn=b_tugu_bambu, node=3203037813),
    dict(id="monumen-skyhawk", name="Monumen Pesawat Skyhawk", fn=b_skyhawk, node=12618267339),
    dict(id="bandara-terminal", name="Terminal Bandara SSK II", fn=b_terminal, ways=[311878399, 327379139]),
    dict(id="bandara-landasan", name="Landasan Bandara SSK II", fn=b_landasan, lod=[3200, 6400]),
]


def build(only=None):
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    mat = material()
    res, entries = {}, []
    for sp in SPECS:
        if only and sp["id"] not in only:
            continue
        fr, builder = sp["fn"](sp)
        res[sp["id"]] = export_lods(sp["id"], builder, mat)
        entries.append(dict(id=sp["id"], name=sp["name"], x=fr.cx, z=fr.cz, lod=sp.get("lod", [1300, 2800])))
    if not only:
        with open(OUT_JS, "w", encoding="utf-8", newline="\n") as f:
            f.write("// DIHASILKAN oleh assets-src/blender/landmark/bangunan.py — jangan sunting tangan.\n"
                    "// Model memakai koordinat dunia relatif ke titik tengah (yaw 0), lihat docs/kota/landmark/README.md.\n"
                    "export const GENERATED_LANDMARKS = Object.freeze([\n")
            for e in entries:
                f.write(f"  {{ id: '{e['id']}', name: '{e['name']}', x: {e['x']}, z: {e['z']}, yaw: 0, files: ['{e['id']}-lod0.glb', '{e['id']}-lod1.glb', '{e['id']}-lod2.glb'], lod: {e['lod']} }},\n")
            f.write("]);\n")
        bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
    return {k: [t for t, _ in v] for k, v in res.items()}
