"""Обработка фото для оформления: дымка, лавандовый оттенок, зерно."""
import random, sys
from PIL import Image, ImageFilter, ImageEnhance, ImageChops, ImageOps
src, out = sys.argv[1], sys.argv[2]
w = int(sys.argv[3]) if len(sys.argv) > 3 else 1400
crop = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] != "-" else None
light = float(sys.argv[5]) if len(sys.argv) > 5 else 0.22
grain = int(sys.argv[6]) if len(sys.argv) > 6 else 28
im = Image.open(src).convert("RGB")
if crop:
    x0, y0, x1, y1 = [float(v) for v in crop.split(",")]
    W, H = im.size
    im = im.crop((int(x0 * W), int(y0 * H), int(x1 * W), int(y1 * H)))
im = ImageOps.contain(im, (w, w * 2))
im = ImageEnhance.Color(im).enhance(0.85)
r, g, b = im.split()
r = r.point(lambda v: int(v * 0.94 + 10)); g = g.point(lambda v: int(v * 0.95 + 10)); b = b.point(lambda v: min(255, int(v * 1.02 + 22)))
im = Image.merge("RGB", (r, g, b))
glow = im.filter(ImageFilter.GaussianBlur(14))
im = ImageChops.screen(im, ImageEnhance.Brightness(glow).enhance(0.45))
im = Image.blend(im, Image.new("RGB", im.size, (236, 238, 248)), light)
random.seed(7)
noise = Image.effect_noise(im.size, grain).convert("L")
im = ImageChops.add(im, Image.merge("RGB", (noise,) * 3), scale=1.0, offset=-128)
im.save(out, quality=80, optimize=True, progressive=True)
