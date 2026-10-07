// Свои колоды из картинок пользователя. Хранятся в IndexedDB этого браузера.
(function () {
  const DB = "tarot-custom", VER = 1;
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB, VER);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains("decks")) d.createObjectStore("decks", { keyPath: "id" });
        if (!d.objectStoreNames.contains("images")) d.createObjectStore("images");
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  function tx(store, mode, fn) {
    return db().then(d => new Promise((res, rej) => {
      const t = d.transaction(store, mode);
      const out = fn(t.objectStore(store));
      t.oncomplete = () => res(out && "result" in out ? out.result : out);
      t.onerror = () => rej(t.error);
    }));
  }
  const urls = new Map(); // ключ картинки → objectURL

  async function list() {
    let metas;
    try { metas = await tx("decks", "readonly", s => s.getAll()); } catch { return []; }
    const keys = await tx("images", "readonly", s => s.getAllKeys());
    const out = [];
    for (const m of metas.sort((a, b) => a.created - b.created)) {
      const cards = {};
      for (const k of keys.filter(k => k.startsWith(m.id + "|"))) {
        if (!urls.has(k)) {
          const blob = await tx("images", "readonly", s => s.get(k));
          if (blob) urls.set(k, URL.createObjectURL(blob));
        }
        if (urls.has(k)) cards[k.split("|")[1]] = urls.get(k);
      }
      out.push({ ...m, custom: true, cards });
    }
    return out;
  }
  async function create(title, base) {
    const id = "my-" + Date.now().toString(36);
    await tx("decks", "readwrite", s => s.put({ id, title, base, created: Date.now() }));
    return id;
  }
  async function update(id, patch) {
    const m = await tx("decks", "readonly", s => s.get(id));
    await tx("decks", "readwrite", s => s.put({ ...m, ...patch }));
  }
  // Уменьшаем фото, чтобы не раздувать хранилище
  async function shrink(file) {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 760 / bmp.height, 460 / bmp.width);
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    return new Promise(res => c.toBlob(res, "image/jpeg", 0.86));
  }
  async function setImage(deckId, cardId, file) {
    const blob = await shrink(file);
    const k = deckId + "|" + cardId;
    await tx("images", "readwrite", s => s.put(blob, k));
    if (urls.has(k)) URL.revokeObjectURL(urls.get(k));
    urls.set(k, URL.createObjectURL(blob));
    return urls.get(k);
  }
  async function removeImage(deckId, cardId) {
    const k = deckId + "|" + cardId;
    await tx("images", "readwrite", s => s.delete(k));
    if (urls.has(k)) { URL.revokeObjectURL(urls.get(k)); urls.delete(k); }
  }
  async function remove(deckId) {
    const keys = await tx("images", "readonly", s => s.getAllKeys());
    await tx("images", "readwrite", s => keys.filter(k => k.startsWith(deckId + "|")).forEach(k => s.delete(k)));
    await tx("decks", "readwrite", s => s.delete(deckId));
  }

  // Угадываем карту по имени файла (как в загрузчике колод)
  const MAJ = [/fool|шут|дурак/, /magician|magus|маг(?!ия)/, /priestess|жриц/, /empress|императриц/, /emperor|император(?!иц)/, /hierophant|pope|иерофант|жрец/,
    /lovers?|влюбл/, /chariot|колесниц/, /strength|сила/, /hermit|отшельник/, /wheel|fortune|колесо|фортун/, /justice|правосуд|справедлив/,
    /hanged|повешен/, /death|смерть/, /temperance|умерен/, /devil|дьявол/, /tower|башн/, /star|звезд/, /moon|луна/, /sun|солнце/, /judge?ment|суд/, /world|мир/];
  const SUIT = [["w", /wand|rod|stave|baton|club|жезл|посох/], ["c", /cup|chalice|чаш|кубк/], ["s", /sword|blade|меч/], ["p", /pentacle|pent|coin|disc|disk|пентакл|денар|монет/]];
  const RANK = [[1, /ace|туз/], [2, /two|двойк/], [3, /three|тройк/], [4, /four|четв/], [5, /five|пят/], [6, /six|шест/], [7, /seven|сем/], [8, /eight|восьм/], [9, /nine|девят/], [10, /ten|десят/],
    [11, /page|паж|валет|princess/], [12, /knight|рыцар|всадник/], [13, /queen|королев|дама/], [14, /king|корол(?!ев)/]];
  const ORDER = Array.from({ length: 22 }, (_, i) => "maj" + String(i).padStart(2, "0")).concat(["w", "c", "s", "p"].flatMap(s => Array.from({ length: 14 }, (_, r) => s + String(r + 1).padStart(2, "0"))));
  function guess(name) {
    const n = name.toLowerCase().replace(/ё/g, "е").replace(/\.[a-z0-9]+$/, "").replace(/[_\-.]+/g, " ");
    const suit = SUIT.find(([, re]) => re.test(n));
    if (suit) {
      const rest = n.replace(suit[1], " ");
      const r = RANK.find(([, re]) => re.test(rest));
      if (r) return suit[0] + String(r[0]).padStart(2, "0");
      const num = (rest.match(/\d+/g) || []).map(Number).filter(x => x >= 1 && x <= 14).pop();
      if (num) return suit[0] + String(num).padStart(2, "0");
      return null;
    }
    const mi = MAJ.findIndex(re => re.test(n));
    if (mi >= 0) return ORDER[mi];
    const only = n.trim().match(/^(\d{1,2})$/);
    if (only && +only[1] < 78) return ORDER[+only[1]];
    return null;
  }

  window.CUSTOM = { list, create, update, setImage, removeImage, remove, guess, ORDER, supported: "indexedDB" in window };
})();
