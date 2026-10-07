#!/usr/bin/env python3
"""Локальный сервер приложения «Таро»: раздаёт файлы и умеет скачивать колоды.

Запуск: python3 server.py  →  http://127.0.0.1:8777
"""
import json
import os
import re
import shutil
import sys
import threading
import uuid
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
DECKS = os.path.join(ROOT, "decks")
sys.path.insert(0, os.path.join(ROOT, "tools"))
import deckimport  # noqa: E402

HOST, PORT = "127.0.0.1", 8777
JOBS = {}
LOCK = threading.Lock()
SITE_ALBUM = re.compile(r"^https://(www\.)?rozamira-tarot\.ru/galeria/[^?#]+\.html$")


def load_decks():
    out = []
    for d in sorted(os.listdir(DECKS)):
        fp = os.path.join(DECKS, d, "deck.json")
        if os.path.isfile(fp):
            with open(fp, encoding="utf-8") as f:
                out.append(json.load(f))
    out.sort(key=lambda x: (x["id"] != "rider-waite-tarot-taro-rajder-uejt", x["title"].lower()))
    return out


def run_import(job_id, url, title):
    job = JOBS[job_id]

    def progress(done, total, msg):
        job.update(done=done, total=total, msg=msg)

    try:
        with LOCK:
            d = deckimport.import_deck(url, DECKS, progress, title=title or None)
            deckimport.write_manifest(DECKS)
        job.update(state="done", deck=d["id"])
    except Exception as e:  # сеть, пустой альбом и т.п.
        job.update(state="error", msg=str(e))


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, fmt, *args):
        pass

    def send_json(self, obj, code=200):
        data = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n) or b"{}")

    def deck_path(self, path):
        deck_id = unquote(path.rsplit("/", 1)[-1])
        if not re.fullmatch(r"[a-z0-9-]+", deck_id):
            return None, None
        return deck_id, os.path.join(DECKS, deck_id)

    def end_headers(self):
        if self.path.endswith((".js", ".css", ".html")) or self.path == "/":
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/decks":
            return self.send_json(load_decks())
        if path == "/api/catalog":
            with open(os.path.join(ROOT, "data", "catalog.json"), encoding="utf-8") as f:
                return self.send_json(json.load(f))
        if path.startswith("/api/job/"):
            job = JOBS.get(path.rsplit("/", 1)[-1])
            return self.send_json(job or {"state": "error", "msg": "нет такой задачи"}, 200 if job else 404)
        return super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/import":
            b = self.body()
            url = (b.get("url") or "").strip()
            if not SITE_ALBUM.match(url):
                return self.send_json({"error": "Нужна ссылка на альбом rozamira-tarot.ru/galeria/…"}, 400)
            job_id = uuid.uuid4().hex[:10]
            JOBS[job_id] = {"state": "running", "done": 0, "total": 0, "msg": "Начинаю"}
            threading.Thread(target=run_import, args=(job_id, url, b.get("title")), daemon=True).start()
            return self.send_json({"job": job_id})
        if path.startswith("/api/deck/"):
            deck_id, ddir = self.deck_path(path)
            fp = ddir and os.path.join(ddir, "deck.json")
            if not fp or not os.path.isfile(fp):
                return self.send_json({"error": "нет такой колоды"}, 404)
            b = self.body()
            with LOCK:
                with open(fp, encoding="utf-8") as f:
                    deck = json.load(f)
                for k in ("numbered", "manual", "title", "checked"):
                    if k in b:
                        deck[k] = b[k]
                deckimport.save_deck(DECKS, deck)
                deckimport.write_manifest(DECKS)
            return self.send_json(deck)
        self.send_error(404)

    def do_DELETE(self):
        path = urlparse(self.path).path
        if path.startswith("/api/deck/"):
            deck_id, ddir = self.deck_path(path)
            if not ddir or not os.path.isdir(ddir):
                return self.send_json({"error": "нет такой колоды"}, 404)
            with LOCK:
                shutil.rmtree(ddir)
                deckimport.write_manifest(DECKS)
            return self.send_json({"ok": True})
        self.send_error(404)


def main():
    url = f"http://{HOST}:{PORT}/"
    try:
        srv = ThreadingHTTPServer((HOST, PORT), Handler)
    except OSError:
        # Уже запущен — просто открываем
        webbrowser.open(url)
        return
    print(f"Таро: {url}  (Ctrl+C — остановить)")
    if "--no-browser" not in sys.argv:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
