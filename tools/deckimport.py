"""Импорт колоды с rozamira-tarot.ru: скачивает картинки альбома и угадывает,
какой файл — какая карта. Результат: decks/<id>/raw/* и decks/<id>/deck.json.
"""
import html as htmlmod
import json
import os
import re
import urllib.parse
import urllib.request
from collections import defaultdict

UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) TarotApp/1.0"}
SITE = "https://www.rozamira-tarot.ru"
SUITS = ["w", "c", "s", "p"]  # жезлы, кубки, мечи, пентакли
ALL_IDS = [f"maj{i:02d}" for i in range(22)] + [f"{s}{r:02d}" for s in SUITS for r in range(1, 15)]

MAJOR_WORDS = [
    (0, r"fool|jester|шут|дурак"),
    (1, r"magician|magus|juggler|bateleur|маг(?!ия)"),
    (2, r"priestess|papess|popess|жрица"),
    (3, r"empress|императрица"),
    (4, r"emperor|император(?!ица)"),
    (5, r"hierophant|pope|pontiff|иерофант|жрец|папа"),
    (6, r"lovers?|влюбл[её]н"),
    (7, r"chariot|колесница"),
    (8, r"strength|strenght|force|fortitude|lust|сила"),
    (9, r"hermit|отшельник"),
    (10, r"wheel|fortune|колесо|фортун"),
    (11, r"justice|adjustment|правосуд|справедлив"),
    (12, r"hanged|повешен"),
    (13, r"death|смерть"),
    (14, r"temperance|умерен"),
    (15, r"devil|дьявол"),
    (16, r"tower|башня"),
    (17, r"star|звезда"),
    (18, r"moon|луна"),
    (19, r"sun|солнце"),
    (20, r"judge?ment|aeon|суд"),
    (21, r"world|universe|мир"),
]
SUIT_WORDS = [
    ("w", r"wands?|rods?|staves|staffs?|batons?|clubs|sceptres?|жезл|посох"),
    ("c", r"cups?|chalices?|goblets?|cauldrons?|чаш|кубк"),
    ("s", r"swords?|blades|spades|меч"),
    ("p", r"pentacles?|pents|coins?|discs?|disks?|denari|stones|пентакл|денар|монет|диск"),
]
RANK_WORDS = [
    (1, r"ace|туз"), (2, r"two|двойк"), (3, r"three|тройк"), (4, r"four|четв[её]рк"),
    (5, r"five|пят[её]рк"), (6, r"six|ш[её]ст[её]рк"), (7, r"seven|сем[её]рк"),
    (8, r"eight|восьм[её]рк"), (9, r"nine|девятк"), (10, r"ten|десятк"),
    (11, r"page|princess|knave|jack|valet|паж|валет|принцесс"),
    (12, r"knight|рыцарь|всадник"), (13, r"queen|королев|дама"), (14, r"king|король"),
]
SUIT_LETTER = {"w": "w", "c": "c", "s": "s", "p": "p", "d": "p"}


def fetch(url, binary=False):
    req = urllib.request.Request(url, headers=UA)
    data = urllib.request.urlopen(req, timeout=60).read()
    return data if binary else data.decode("utf-8", "replace")


def album_images(page_html):
    """Список путей /google/taro/... в порядке появления, без дублей."""
    out = []
    for m in re.finditer(r'href="(/google/taro/[^"]+\.(?:jpe?g|png|webp|gif))"', page_html, re.I):
        p = htmlmod.unescape(m.group(1))
        if p not in out:
            out.append(p)
    return out


def album_title(page_html):
    m = re.search(r"<h1[^>]*>(.*?)</h1>", page_html, re.S) or re.search(r"<title>(.*?)</title>", page_html, re.S)
    t = re.sub(r"<[^>]+>", "", htmlmod.unescape(m.group(1))).strip() if m else "Колода"
    t = re.sub(r"^Альбом\s+", "", t)
    return re.split(r"\s+[|«]", t)[0].strip()


def _stem(path):
    name = urllib.parse.unquote(path.rsplit("/", 1)[-1])
    name = re.sub(r"(\.(jpe?g|png|webp|gif))+$", "", name, flags=re.I)
    return name


def _family(stem):
    """Шаблон имени: цифры → #, чтобы отделить разные наборы файлов в одном альбоме."""
    s = re.sub(r"\d+", "#", stem.lower())
    return re.sub(r"[a-zа-яё]+", "a", s)


def parse_name(stem, prefix=""):
    """Пытается понять карту по имени файла. Возвращает id или None."""
    s = stem.lower().replace("ё", "е")
    if prefix and s.startswith(prefix):
        s = s[len(prefix):]
    s = re.sub(r"[_\-.]+", " ", s)
    s = re.sub(r"\(\d+\)", " ", s)
    suit = None
    for sid, pat in SUIT_WORDS:
        if re.search(r"(?<![a-zа-я])(" + pat + ")", s):
            suit = sid
            break
    if suit is None:
        m = re.match(r"^\s*([wcsp])c([1-4])[pkq]\b", s)
        if m:
            return f"{SUIT_LETTER[m.group(1)]}{10 + int(m.group(2)):02d}"
        m = re.match(r"^\s*([wcsp])\s*(kn|k|q|p)\s*$", s)
        if m:
            return f"{SUIT_LETTER[m.group(1)]}{ {'p': 11, 'kn': 12, 'q': 13, 'k': 14}[m.group(2)]:02d}"
        m = re.match(r"^\s*(?:minor\s*)?([wcspd])\s*(\d{1,2})\b", s)
        if m and not re.match(r"^\s*maj", s):
            suit = SUIT_LETTER[m.group(1)]
            r = int(m.group(2))
            return f"{suit}{r:02d}" if 1 <= r <= 14 else None
    if suit:
        rest = s
        for sid, pat in SUIT_WORDS:
            rest = re.sub(r"(?<![a-zа-я])(" + pat + r")[a-zа-я]*", " ", rest)
        rest = re.sub(r"\b(minor|major|arcana|of|the|младш|аркан)\w*", " ", rest)
        for r, pat in RANK_WORDS:
            if re.search(r"(?<![a-zа-я])(" + pat + ")", rest):
                return f"{suit}{r:02d}"
        nums = [int(x) for x in re.findall(r"\d+", rest)]
        nums = [n for n in nums if 1 <= n <= 14]
        if nums:
            return f"{suit}{nums[-1]:02d}"
        return None
    for n, pat in MAJOR_WORDS:
        if re.search(r"(?<![a-zа-я])(" + pat + r")(?![a-z])", s):
            return f"maj{n:02d}"
    m = re.match(r"^\s*(?:maj|major|am|trump|arcana)\s*(\d{1,2})\b", s)
    if m and int(m.group(1)) <= 21:
        return f"maj{int(m.group(1)):02d}"
    return None


def _common_prefix(stems):
    if len(stems) < 2:
        return ""
    p = os.path.commonprefix([x.lower() for x in stems])
    p = re.sub(r"\d+$", "", p)
    # Режем только по границе слова, чтобы не съесть «Ace»/«Туз».
    m = re.match(r"^(.*[\s_\-.])", p)
    return m.group(1) if m else ""


def auto_map(paths):
    """Возвращает (mapping {card_id: path}, confidence 'named'|'numbered'|'partial')."""
    fams = defaultdict(list)
    for p in paths:
        fams[_family(_stem(p))].append(p)
    per_family = []
    for fam_paths in fams.values():
        stems = [_stem(p).replace("ё", "е") for p in fam_paths]
        prefix = _common_prefix(stems)
        m = {}
        for p, st in zip(fam_paths, stems):
            cid = parse_name(st, prefix)
            if cid and cid not in m:
                m[cid] = p
        # Группа из одних номеров 0..21 рядом с мастями (Wild Unknown 0..21).
        if not m and len(fam_paths) <= 24:
            for p, st in zip(fam_paths, stems):
                rest = st.lower()[len(prefix):].strip(" _-")
                if re.fullmatch(r"\d{1,2}", rest) and int(rest) <= 21:
                    m.setdefault(f"maj{int(rest):02d}", p)
        per_family.append(m)
    per_family.sort(key=len, reverse=True)
    best = {}
    for m in per_family:
        for cid, p in m.items():
            best.setdefault(cid, p)
    if len(best) >= 78:
        return best, "named", []
    if len(best) >= 60:
        return best, "partial", []
    # Нумерованные файлы: берём самую большую группу с числами и раскладываем
    # в типичном порядке (0–21 старшие, далее жезлы, кубки, мечи, пентакли).
    numbered = []
    for fam_paths in fams.values():
        nums = []
        for p in fam_paths:
            ds = re.findall(r"\d+", _stem(p))
            if ds:
                nums.append((int(ds[-1]), p))
        if len(nums) > len(numbered):
            numbered = nums
    numbered.sort()
    seq = [p for _, p in numbered]
    if len(seq) >= 78:
        return {}, "numbered", seq
    return best, "partial", seq


def slugify(url):
    s = url.rstrip("/").rsplit("/", 1)[-1]
    s = re.sub(r"\.html$", "", s)
    s = re.sub(r"^albom-", "", s)
    return re.sub(r"[^a-z0-9-]", "", s)[:60] or "deck"


def import_deck(url, decks_dir, progress=lambda done, total, msg: None, title=None, deck_id=None):
    page = fetch(url)
    paths = album_images(page)
    if not paths:
        raise RuntimeError("В альбоме не нашлось картинок")
    deck_id = deck_id or slugify(url)
    ddir = os.path.join(decks_dir, deck_id)
    rdir = os.path.join(ddir, "raw")
    os.makedirs(rdir, exist_ok=True)
    local = {}
    used = set()
    for i, p in enumerate(paths):
        progress(i, len(paths), "Скачиваю картинки")
        ext = os.path.splitext(p)[1].lower() or ".jpg"
        base = re.sub(r"[^0-9A-Za-zА-Яа-яЁё_-]+", "_", _stem(p))[:50] or "img"
        name = f"{i:03d}_{base}{ext}"
        while name in used:
            name = "x" + name
        used.add(name)
        dest = os.path.join(rdir, name)
        if not os.path.exists(dest):
            quoted = urllib.parse.quote(p, safe="/()")
            data = fetch(SITE + quoted, binary=True)
            with open(dest, "wb") as f:
                f.write(data)
        local[p] = name
    progress(len(paths), len(paths), "Распознаю карты")
    mapping, conf, seq = auto_map(paths)
    back = None
    for p in paths:
        if re.search(r"(?i)\bback|рубашк|оборот", _stem(p)):
            back = local[p]
            break
    deck = {
        "id": deck_id,
        "title": title or album_title(page),
        "source": url,
        "confidence": conf,
        "back": back,
        "files": [local[p] for p in paths],
        "auto": {cid: local[p] for cid, p in mapping.items()},
        "seq": [local[p] for p in seq],
        "numbered": {"offset": 0, "order": "wcsp", "swap811": False},
        "manual": {},
    }
    recompute(deck)
    with open(os.path.join(ddir, "deck.json"), "w", encoding="utf-8") as f:
        json.dump(deck, f, ensure_ascii=False, indent=1)
    return deck


def recompute(deck):
    """Итоговое соответствие карта → файл: авто/нумерация + ручные правки."""
    cards = {}
    seq = deck.get("seq") or []
    if deck.get("confidence") == "numbered" and seq:
        nb = deck.get("numbered") or {}
        off = int(nb.get("offset", 0))
        order = nb.get("order", "wcsp")
        ids = [f"maj{i:02d}" for i in range(22)] + [f"{s}{r:02d}" for s in order for r in range(1, 15)]
        if nb.get("swap811"):
            ids[8], ids[11] = ids[11], ids[8]
        for i, cid in enumerate(ids):
            if 0 <= off + i < len(seq) and seq[off + i]:
                cards[cid] = seq[off + i]
    else:
        cards.update(deck.get("auto") or {})
    for cid, f in (deck.get("manual") or {}).items():
        if f:
            cards[cid] = f
        else:
            cards.pop(cid, None)
    deck["cards"] = cards
    return deck


def save_deck(decks_dir, deck):
    recompute(deck)
    with open(os.path.join(decks_dir, deck["id"], "deck.json"), "w", encoding="utf-8") as f:
        json.dump(deck, f, ensure_ascii=False, indent=1)


def write_manifest(decks_dir):
    """decks/decks.js — список колод для приложения (работает и без сервера)."""
    decks = []
    for d in sorted(os.listdir(decks_dir)):
        fp = os.path.join(decks_dir, d, "deck.json")
        if os.path.isfile(fp):
            with open(fp, encoding="utf-8") as f:
                decks.append(json.load(f))
    order = {"rider-waite-tarot-taro-rajder-uejt": 0}
    decks.sort(key=lambda x: (order.get(x["id"], 1), x["title"].lower()))
    with open(os.path.join(decks_dir, "decks.js"), "w", encoding="utf-8") as f:
        f.write("window.DECKS = ")
        json.dump(decks, f, ensure_ascii=False)
        f.write(";\n")
    return decks


if __name__ == "__main__":
    import sys
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ddir = os.path.join(here, "decks")
    for u in sys.argv[1:]:
        d = import_deck(u, ddir, lambda a, b, m: print(f"\r{m} {a}/{b}", end="", file=sys.stderr))
        missing = [c for c in ALL_IDS if c not in d["cards"]]
        print(f"\n{d['id']}: {d['title']} — {len(d['cards'])}/78, {d['confidence']}, нет: {missing[:12]}")
    write_manifest(ddir)
