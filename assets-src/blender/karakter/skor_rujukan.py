"""
Skor kemiripan model vs lembar rujukan (Python sistem): per tampak, IoU siluet (render skor_render.py vs masker
rujukan) dan selisih warna rata-rata di area irisan (0–255). Juga menulis gambar banding
<out>/banding_<pid>.png (atas: rujukan, tengah: model, bawah: beda siluet merah=hanya rujukan, biru=hanya model).
Pemakaian: python skor_rujukan.py <folder render> [pid ...]
"""
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from karakter_ref import view_mask  # noqa: E402

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sumber', 'preset')


def score(out, pid):
    ref = np.asarray(Image.open(os.path.join(SRC, f'ref-{pid}.jpg')).convert('RGB')).astype(np.float32) / 255
    w3 = ref.shape[1] // 3
    rows, res = [], {}
    for k, name in enumerate(('front', 'side', 'back')):
        r = ref[:, k * w3:(k + 1) * w3]
        rm = view_mask(r)
        im = np.asarray(Image.open(os.path.join(out, f'{pid}_{name}.png')).convert('RGBA')).astype(np.float32) / 255
        im = im[:, :w3]
        mm = im[..., 3] > 0.5
        inter, union = (rm & mm).sum(), (rm | mm).sum()
        iou = inter / max(union, 1)
        cd = np.abs(r[rm & mm] - im[..., :3][rm & mm]).mean() * 255 if inter else 255.0
        res[name] = (round(float(iou), 3), round(float(cd), 1))
        diff = np.zeros_like(r)
        diff[rm & ~mm] = (1, 0.15, 0.15)
        diff[mm & ~rm] = (0.2, 0.4, 1)
        diff[rm & mm] = r[rm & mm] * 0.35
        model = np.where(mm[..., None], im[..., :3], 0.12)
        rows.append(np.concatenate([r, model, diff], axis=0))
    sheet = np.concatenate(rows, axis=1)
    Image.fromarray((sheet * 255).astype(np.uint8)).resize((sheet.shape[1] // 3, sheet.shape[0] // 3)).save(
        os.path.join(out, f'banding_{pid}.png'))
    return res


if __name__ == '__main__':
    out = sys.argv[1]
    for pid in sys.argv[2:] or ('cardigan_hijab', 'tactical_blonde'):
        r = score(out, pid)
        mean_iou = sum(v[0] for v in r.values()) / 3
        print(pid, r, f'IoU rata-rata {mean_iou:.3f}')
