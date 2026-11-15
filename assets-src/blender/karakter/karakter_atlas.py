"""
Pelukis atlas 512² karakter jadi (Python sistem + PIL; dipanggil karakter_preset.py lewat subprocess):
kuadran kiri atas = wajah (proyeksi depan kepala), kanan atas = motif batik, bawah = putih (warna dari vertex).
Pemakaian: python karakter_atlas.py <keluaran.png> <hex alis>
"""
import math
import sys

TAU = math.tau
SKIN = 0xF2C8A2
HEAD_H = 0.245
FACE_W = 0.163           # lebar wajah yang dipetakan (kepala ×1,09)
EYE_H, BROW_H, LIP_H = 0.107, 0.137, 0.041  # tinggi fitur dari dagu




def paint_atlas(path, brow_hex, iris_hex=0x6B4423):
    from PIL import Image, ImageDraw, ImageFilter
    S = 4  # supersampling
    A = 512 * S
    img = Image.new('RGB', (A, A), (255, 255, 255))
    d = ImageDraw.Draw(img)
    skin = ((SKIN >> 16) & 255, (SKIN >> 8) & 255, SKIN & 255)
    d.rectangle((0, 0, A // 2, A // 2), fill=skin)

    def px(x, h):  # wajah: x meter, h dari dagu → piksel kuadran kiri atas
        return ((x + FACE_W / 2) / FACE_W * (A // 2), (1 - h / HEAD_H) * (A // 2))

    def poly(pts, fill):
        d.polygon([px(*p) for p in pts], fill=fill)

    def rgb(h):
        return ((h >> 16) & 255, (h >> 8) & 255, h & 255)
    # rona pipi + bayangan hidung
    for sx in (1, -1):
        cx, cy = px(sx * 0.040, 0.062)
        r = 0.011 / FACE_W * (A // 2)
        d.ellipse((cx - r * 1.3, cy - r, cx + r * 1.3, cy + r), fill=(240, 188, 166))
    poly([(-0.003, 0.092), (0.002, 0.092), (0.003, 0.064), (-0.006, 0.060)], (228, 176, 146))
    for sx in (1, -1):
        cx, cy = px(sx * 0.0075, 0.058)
        d.ellipse((cx - 5 * S, cy - 3 * S, cx + 5 * S, cy + 3 * S), fill=(190, 130, 110))
    for sx in (1, -1):
        ex = sx * 0.034
        # putih mata (almond)
        poly([(ex - sx * 0.0208, EYE_H - 0.0013), (ex - sx * 0.0078, EYE_H + 0.0104), (ex + sx * 0.0130, EYE_H + 0.0091),
              (ex + sx * 0.0221, EYE_H + 0.0026), (ex + sx * 0.0104, EYE_H - 0.0078), (ex - sx * 0.0104, EYE_H - 0.0078)], (250, 248, 246))
        # iris + pupil + kilau
        cx, cy = px(ex - sx * 0.0013, EYE_H + 0.0013)
        r = 0.0098 / FACE_W * (A // 2)
        d.ellipse((cx - r, cy - r * 1.08, cx + r, cy + r * 1.08), fill=rgb(iris_hex))
        d.ellipse((cx - r * 0.5, cy - r * 0.55, cx + r * 0.5, cy + r * 0.55), fill=(35, 22, 15))
        d.ellipse((cx - r * 0.55 + r * 0.25, cy - r * 0.7, cx - r * 0.05 + r * 0.25, cy - r * 0.2), fill=(255, 255, 255))
        # bulu mata atas tebal bersayap
        poly([(ex - sx * 0.0221, EYE_H - 0.0013), (ex - sx * 0.0078, EYE_H + 0.0137), (ex + sx * 0.0143, EYE_H + 0.0123),
              (ex + sx * 0.0286, EYE_H + 0.0117), (ex + sx * 0.0208, EYE_H + 0.0059), (ex + sx * 0.0117, EYE_H + 0.0088),
              (ex - sx * 0.0078, EYE_H + 0.0097), (ex - sx * 0.0195, EYE_H)], (30, 22, 20))
        poly([(ex - sx * 0.0130, EYE_H - 0.0084), (ex + sx * 0.0130, EYE_H - 0.0078), (ex + sx * 0.0130, EYE_H - 0.0094),
              (ex - sx * 0.0130, EYE_H - 0.0097)], (150, 105, 90))
        # alis melengkung
        poly([(ex - sx * 0.019, BROW_H - 0.002), (ex - sx * 0.008, BROW_H + 0.004), (ex + sx * 0.008, BROW_H + 0.0055),
              (ex + sx * 0.020, BROW_H + 0.001), (ex + sx * 0.019, BROW_H - 0.0015), (ex + sx * 0.007, BROW_H + 0.0025),
              (ex - sx * 0.008, BROW_H + 0.0015), (ex - sx * 0.018, BROW_H - 0.004)], rgb(brow_hex))
    # bibir
    poly([(-0.014, LIP_H), (-0.006, LIP_H + 0.0045), (0.0, LIP_H + 0.003), (0.006, LIP_H + 0.0045), (0.014, LIP_H),
          (0.0, LIP_H - 0.0015)], (196, 112, 100))
    poly([(-0.013, LIP_H), (0.0, LIP_H - 0.0015), (0.013, LIP_H), (0.008, LIP_H - 0.0065), (-0.008, LIP_H - 0.0065)],
         (214, 132, 118))
    # Batik (kuadran kanan atas): dasar sogan + kawung + bunga + parang.
    import random
    rnd = random.Random(7)
    bat = Image.new('RGB', (A // 2, A // 2), (75, 42, 28))
    main, d = img, ImageDraw.Draw(bat)
    x0, y0, B = 0, 0, A // 2
    for i in range(-8, 16):  # parang diagonal
        off = i * 70 * S
        d.line([(x0 + off, y0 + B), (x0 + off + B, y0)], fill=(120, 72, 42), width=10 * S)
        for k in range(0, B, 36 * S):
            cx, cy = x0 + off + k, y0 + B - k
            d.ellipse((cx - 7 * S, cy - 7 * S, cx + 7 * S, cy + 7 * S), fill=(200, 150, 96))
    for _ in range(22):  # bunga
        cx, cy = x0 + rnd.randrange(B), y0 + rnd.randrange(B)
        r = rnd.randrange(14, 26) * S
        for k in range(5):
            a = TAU * k / 5
            px_, py_ = cx + math.cos(a) * r * 0.7, cy + math.sin(a) * r * 0.7
            d.ellipse((px_ - r * 0.45, py_ - r * 0.45, px_ + r * 0.45, py_ + r * 0.45), fill=(214, 168, 112))
        d.ellipse((cx - r * 0.3, cy - r * 0.3, cx + r * 0.3, cy + r * 0.3), fill=(120, 60, 34))
    main.paste(bat, (A // 2, 0))
    img = main.filter(ImageFilter.GaussianBlur(S * 0.6)).resize((512, 512), Image.LANCZOS)
    img.save(path)


if __name__ == '__main__':
    paint_atlas(sys.argv[1], int(sys.argv[2], 16))
