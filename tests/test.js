// Запуск: gjs -m tests/test.js (из корня проекта). Проверяет данные и толкование.
// в gjs window уже есть и указывает на globalThis
import GLib from "gi://GLib";
const root = GLib.get_current_dir();
const load = p => { const [, b] = GLib.file_get_contents(root + "/" + p); (0, eval)(new TextDecoder().decode(b)); };
["data/meta.js", "data/cards-major.js", "data/cards-cups-pentacles.js", "data/cards-swords-wands.js", "data/spreads.js", "js/interpret.js"].forEach(load);
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; print("FAIL: " + m); } };
const C = window.CARDS;
ok(C.length === 78, "78 карт, есть " + C.length);
ok(new Set(C.map(c => c.id)).size === 78, "уникальные id");
for (const c of C) {
  ok(c.up.length === 7 && c.rev.length === 7, c.id + " — 7 тем");
  ok([...c.up, ...c.rev].every(t => typeof t === "string" && t.length > 3), c.id + " — пустой текст");
  ok(["yes", "no", "neutral", "unknown", "fight"].includes(c.yes), c.id + " yes");
  ok(c.tone.every(t => t >= -2 && t <= 2), c.id + " tone");
  ok(c.kUp && c.kRev, c.id + " keys");
}
for (const s of window.SPREADS) ok(s.positions.length === s.layout.length, "схема " + s.id + ": позиций " + s.positions.length + ", мест " + s.layout.length);
// Да/нет по книге
const no = ["s03","s05","s06","s07","s08","s09","s10","s12","c05","c07","c08","p05","maj13","maj15","maj16","maj18"];
no.forEach(id => ok(window.TAROT.byId[id].yes === "no", id + " должна быть «нет»"));
["s04","c04","maj09","maj12"].forEach(id => ok(window.TAROT.byId[id].yes === "neutral", id + " нейтрально"));
// Ссылки в мета-данных
Object.keys(window.META.combos).forEach(k => k.split("+").forEach(id => ok(window.TAROT.byId[id], "combo " + k)));
Object.entries(window.META.reflections).forEach(([m, r]) => { ok(window.TAROT.byId[m], m); Object.keys(r).forEach(k => k !== "_all" && ok(window.TAROT.byId[k.replace(/r$/, "")], "refl " + m + " " + k)); });
// Толкование пары из примера: финансы, Императрица + Паж Кубков перевёрнутый
const T = window.TAROT;
const p = T.pair({ card: T.byId.maj03, rev: false }, { card: T.byId.c11, rev: true }, "money");
print("\n== " + p.title); p.lines.forEach(l => print("[" + l.kind + "] " + l.text));
ok(p.lines.length >= 4, "в паре должно быть несколько аспектов");
// Каждая пара во всех темах не падает
const themes = window.META.themes.map(t => t.id);
let n = 0;
for (const a of C) for (const b of C) { if (a === b) continue; const th = themes[n % 7]; const r = T.pair({ card: a, rev: n % 3 === 0 }, { card: b, rev: n % 5 === 0 }, th); n++;
  ok(r.lines.every(l => l.text && !/undefined|NaN|null/.test(l.text)), "пара " + a.id + "+" + b.id + ": " + JSON.stringify(r.lines.find(l => /undefined|NaN|null/.test(l.text)))); if (fails > 5) break; }
// Сводка
const items = ["maj02","maj21","maj14","c01","c02","w10"].map((id, i) => ({ card: T.byId[id], rev: i === 3 }));
const s = T.summary(items, "love", null); print("\n== сводка"); s.forEach(l => print("[" + l.kind + "] " + l.text));
ok(s.some(l => l.kind === "quint" && /Колесо Фортуны/.test(l.text)), "квинтэссенция 2+21+14=37→10");
const yn = T.summary([{ card: T.byId.maj19, rev: false }, { card: T.byId.s09, rev: false }, { card: T.byId.w05, rev: false }], "general", window.SPREADS.find(x => x.id === "yesno"));
print(yn.find(l => l.kind === "yesno").text);
print(fails ? `\n${fails} ошибок` : "\nВсе проверки прошли");
if (fails) { const S = (await import("system")).default; S.exit(1); }
