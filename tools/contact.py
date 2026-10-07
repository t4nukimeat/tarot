"""Контактный лист колоды: 78 карт по порядку с подписями (для проверки)."""
import json, os, sys
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from deckimport import ALL_IDS
ddir, out = sys.argv[1], sys.argv[2]
d = json.load(open(os.path.join(ddir, "deck.json")))
W, H, cols = 90, 150, 14
rows = [ALL_IDS[:11], ALL_IDS[11:22], *[ALL_IDS[22 + 14 * i: 36 + 14 * i] for i in range(4)]]
sheet = Image.new("RGB", (cols * W, len(rows) * (H + 14)), "white")
dr = ImageDraw.Draw(sheet)
for r, ids in enumerate(rows):
    for c, cid in enumerate(ids):
        x = (c % cols) * W
        y = r * (H + 14)
        if c >= cols:  # majors в две строки не влезают — сжимаем
            pass
        f = d["cards"].get(cid)
        if f:
            try:
                im = Image.open(os.path.join(ddir, "raw", f)).convert("RGB")
                im.thumbnail((W - 4, H - 4))
                sheet.paste(im, (x + 2, y + 2))
            except Exception as e:
                dr.text((x + 4, y + 40), "ERR", fill="red")
        dr.text((x + 2, y + H), cid, fill="black")
sheet.save(out)
