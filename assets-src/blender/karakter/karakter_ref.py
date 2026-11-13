"""
Analisis lembar rujukan karakter (3 tampak berjajar: depan | samping kanan karakter, menghadap kanan | belakang)
untuk alur "rujukan → model": Python sistem (numpy, scipy, PIL); hasilnya dibaca karakter_preset.py di Blender.

Keluaran per lembar (di sebelah gambar):
  <nama>.json  kalibrasi tiap tampak (skala meter/piksel, baris telapak, kolom pusat), sudut & panjang lengan
               A-pose, profil siluet per tinggi (lebar depan, jangkauan depan/belakang samping)
  <nama>-tex.png  lembar dengan latar diisi warna figur terdekat (proyeksi yang meleset beberapa piksel tetap
               mengambil warna baju, bukan latar), diperkecil untuk GPU
Pemakaian: python karakter_ref.py <lembar.jpg> <tinggi_model_m> [--debug out.png]
"""
import json
import math
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

TEX_W = 1024  # lebar tekstur hasil (tinggi mengikuti rasio lembar)
STRIP = 8     # baris putih di bawah tekstur: UV untuk face berwarna vertex (bagian tanpa rujukan)
BIN = 0.01


def view_mask(rgb):
    """Masker figur: beda warna dari latar (median sudut), komponen terbesar, lubang diisi, tepi dirapikan."""
    h, w, _ = rgb.shape
    corners = np.concatenate([rgb[:30, :30].reshape(-1, 3), rgb[:30, -30:].reshape(-1, 3)])
    bg = np.median(corners, axis=0)
    diff = np.linalg.norm(rgb - bg, axis=2)
    chroma = rgb.max(axis=2) - rgb.min(axis=2)
    bg_chroma = float(bg.max() - bg.min())
    m = (diff > 0.07) | ((chroma - bg_chroma > 0.05) & (diff > 0.03))  # bayangan gelap berwarna ≠ latar abu
    m = ndimage.binary_opening(m, iterations=2)
    m = ndimage.binary_closing(m, iterations=3)
    lab, n = ndimage.label(m)
    if n == 0:
        return m
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    keep = 1 + int(np.argmax(sizes))
    # simpan juga komponen besar lain (kacamata di atas kepala, gelang) yang dekat figur utama
    big = [i + 1 for i, s in enumerate(sizes) if s > 0.002 * sizes.max()]
    m = np.isin(lab, big) if len(big) > 1 else lab == keep
    return ndimage.binary_fill_holes(m)


class View:
    def __init__(self, rgb, k, height):
        w3 = rgb.shape[1] // 3
        self.k, self.x0, self.w = k, k * w3, w3
        self.m = view_mask(rgb[:, k * w3:(k + 1) * w3])
        rows = np.flatnonzero(self.m.sum(axis=1) >= 2)
        self.top, self.bot = int(rows[0]), int(rows[-1])
        self.s = height / (self.bot - self.top + 1)  # meter per piksel
        self.c = self.leg_center()

    def row(self, z):
        return int(round(self.bot - z / self.s))

    def runs(self, z):
        r = self.row(z)
        if not 0 <= r < self.m.shape[0]:
            return []
        row = self.m[r].astype(np.int8)
        idx = np.flatnonzero(np.diff(np.concatenate([[0], row, [0]])))
        return [(int(a), int(b) - 1) for a, b in zip(idx[::2], idx[1::2])]

    def leg_center(self):
        cols = []
        for z in np.arange(0.30, 0.45, BIN):
            for a, b in self.runs(z):
                if abs((a + b) / 2 - self.w / 2) < 0.22 / self.s:
                    cols.extend(range(a, b + 1))
        return float(np.mean(cols)) if cols else self.w / 2

    def central(self, z, reach):
        """(kiri, kanan) meter dari pusat: run yang memuat pusat atau ujung terdekatnya ≤ reach."""
        lim = reach / self.s
        pick = [ab for ab in self.runs(z) if ab[0] <= self.c <= ab[1] or min(abs(ab[0] - self.c), abs(ab[1] - self.c)) <= lim]
        if not pick:
            return None
        return (self.c - min(a for a, _ in pick)) * self.s, (max(b for _, b in pick) - self.c) * self.s


def arm_fit(front):
    """Garis lengan A-pose di tampak depan: titik tengah run lengan yang terpisah dari badan, per sisi."""
    out = {}
    for side, sgn in (('R', -1), ('L', 1)):  # tampak depan: kanan karakter di kiri gambar
        pts = []
        for z in np.arange(0.70, 1.30, BIN):
            runs = front.runs(z)
            if len(runs) < 2:
                continue
            cand = [ab for ab in runs if sgn * ((ab[0] + ab[1]) / 2 - front.c) > 0.12 / front.s]
            if not cand:
                continue
            a, b = (min if sgn < 0 else max)(cand, key=lambda ab: (ab[0] + ab[1]) / 2)
            if (b - a) * front.s > 0.13:
                continue
            pts.append((sgn * ((a + b) / 2 - front.c) * front.s, z, (b - a) * front.s))
        if len(pts) < 8:
            continue
        x = np.array([p[0] for p in pts])
        z = np.array([p[1] for p in pts])
        k, b0 = np.polyfit(z, x, 1)  # x = k z + b0 (k < 0: makin turun makin keluar)
        tilt = math.degrees(math.atan(-k))
        low = pts[0]
        out[side] = {'tilt_deg': round(tilt, 2), 'x_at': [round(float(k * zz + b0), 4) for zz in (1.30, 1.10, 0.90)],
                     'lowest': [round(low[0], 3), round(low[1], 3)], 'samples': len(pts)}
    return out


def arm_runs(front, z):
    """Run lengan terpisah dari badan pada baris z: {'L'|'R': [jarak pusat dari sumbu (m, keluar +), setengah lebar]}."""
    out = {}
    for side, sgn in (('R', -1), ('L', 1)):
        cand = [ab for ab in front.runs(z) if sgn * ((ab[0] + ab[1]) / 2 - front.c) * front.s > 0.12
                and (ab[1] - ab[0]) * front.s < 0.13]
        if cand:
            a, b = (min if sgn < 0 else max)(cand, key=lambda ab: (ab[0] + ab[1]) / 2)
            out[side] = [round(sgn * ((a + b) / 2 - front.c) * front.s, 4), round((b - a + 1) / 2 * front.s, 4)]
    return out


def profiles(front, side, back):
    prof = []
    for z in np.arange(0.0, front.bot * front.s + 0.2, BIN):
        e = front.central(z, 0.10)
        f = side.central(z, 0.05)
        bk = back.central(z, 0.10)
        prof.append({'z': round(float(z), 3),
                     'front': [round(v, 4) for v in e] if e else None,
                     'side': [round(v, 4) for v in f] if f else None,
                     'back': [round(v, 4) for v in bk] if bk else None,
                     'arm': arm_runs(front, z) if 0.55 < z < 1.30 else {}})
    return prof


def inpaint(rgb, mask):
    """Latar diganti warna piksel figur terdekat (EDT indeks)."""
    _d, (iy, ix) = ndimage.distance_transform_edt(~mask, return_indices=True)
    return rgb[iy, ix]


def analyse(path, height, debug=None):
    img = Image.open(path).convert('RGB')
    rgb = np.asarray(img).astype(np.float32) / 255
    views = [View(rgb, k, height) for k in range(3)]
    front, side, back = views
    full_mask = np.zeros(rgb.shape[:2], bool)
    for v in views:
        full_mask[:, v.x0:v.x0 + v.w] = v.m
    filled = inpaint(rgb, full_mask)
    H, W = rgb.shape[:2]
    tex_h = int(round(H * TEX_W / W))
    tex = Image.fromarray((filled * 255).astype(np.uint8)).resize((TEX_W, tex_h), Image.LANCZOS)
    out = Image.new('RGB', (TEX_W, tex_h + STRIP), (255, 255, 255))
    out.paste(tex, (0, 0))
    base = path.rsplit('.', 1)[0]
    out.save(base + '-tex.png')
    data = {
        'image': {'w': W, 'h': H, 'tex_w': TEX_W, 'tex_h': tex_h, 'strip': STRIP},
        'views': [{'k': v.k, 'x0': v.x0, 'w': v.w, 'top': v.top, 'bot': v.bot, 's': v.s, 'c': v.c} for v in views],
        'arm': arm_fit(front),
        'profile': profiles(front, side, back),
    }
    with open(base + '.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=1)
    if debug:
        dbg = Image.fromarray((np.where(full_mask[..., None], rgb, rgb * 0.3) * 255).astype(np.uint8))
        d = ImageDraw.Draw(dbg)
        for v in views:
            d.line([(v.x0 + v.c, v.top), (v.x0 + v.c, v.bot)], fill=(255, 0, 0), width=2)
            d.line([(v.x0, v.bot), (v.x0 + v.w, v.bot)], fill=(0, 255, 0), width=2)
        for side_, info in data['arm'].items():
            sgn = -1 if side_ == 'R' else 1
            for zz, xx in zip((1.30, 1.10, 0.90), info['x_at']):
                px = front.x0 + front.c + sgn * xx / front.s
                py = front.row(zz)
                d.ellipse((px - 6, py - 6, px + 6, py + 6), outline=(0, 200, 255), width=3)
        dbg.resize((W // 2, H // 2)).save(debug)
    return data


if __name__ == '__main__':
    p, h = sys.argv[1], float(sys.argv[2])
    dbg = sys.argv[4] if len(sys.argv) > 4 and sys.argv[3] == '--debug' else None
    d = analyse(p, h, dbg)
    print(json.dumps({'arm': d['arm'], 'views': d['views']}, indent=1))
