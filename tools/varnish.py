"""Тёплый «старый лак» и мягкая виньетка для ренессансных картин."""
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageOps, ImageChops
src, out, w = sys.argv[1], sys.argv[2], int(sys.argv[3])
crop = sys.argv[4] if len(sys.argv) > 4 else None
im = Image.open(src).convert("RGB")
if crop:
    x0, y0, x1, y1 = map(float, crop.split(","))
    W, H = im.size
    im = im.crop((int(x0 * W), int(y0 * H), int(x1 * W), int(y1 * H)))
im = ImageOps.contain(im, (w, w * 2), Image.LANCZOS)
warm = Image.new("RGB", im.size, (205, 160, 95))
im = Image.blend(im, ImageChops.multiply(im, warm), 0.18)
mask = Image.new("L", im.size, 0)
d = ImageDraw.Draw(mask)
m = int(min(im.size) * 0.06)
d.rectangle((m, m, im.size[0] - m, im.size[1] - m), fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(min(im.size) * 0.09))
dark = Image.blend(im, Image.new("RGB", im.size, (30, 18, 8)), 0.45)
im = Image.composite(im, dark, mask)
im.save(out, quality=84, optimize=True, progressive=True)
