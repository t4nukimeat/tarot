"""Собирает список всех альбомов галереи rozamira-tarot.ru в catalog.json."""
import json, re, sys, time, urllib.request, html
BASE = "https://www.rozamira-tarot.ru/galeria"
UA = {"User-Agent": "Mozilla/5.0"}
def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read().decode("utf-8", "replace")
out, seen = [], set()
first = get(BASE)
last = max(int(x) for x in re.findall(r'/galeria/page/(\d+)', first))
for p in range(1, last + 1):
    page = first if p == 1 else get(f"{BASE}/page/{p}")
    for url, title in re.findall(r'<h2><a href="(https://www.rozamira-tarot.ru/galeria/[^"]+\.html)"[^>]*>([^<]+)</a></h2>', page):
        if url not in seen:
            seen.add(url)
            t = html.unescape(title).strip()
            t = re.sub(r'^Альбом\s+', '', t)
            out.append({"url": url, "title": t})
    print(p, len(out), file=sys.stderr)
    time.sleep(0.3)
json.dump(out, open(sys.argv[1], "w"), ensure_ascii=False, indent=0)
