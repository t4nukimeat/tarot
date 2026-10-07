// Интерфейс приложения. Данные: window.CARDS, META, SPREADS, DECKS; толкование: window.TAROT.
(function () {
  const T = window.TAROT, M = window.META;
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
  const h = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const store = {
    get(k, d) { try { const v = localStorage.getItem("tarot." + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("tarot." + k, JSON.stringify(v)); } catch { /* приватный режим */ } },
  };
  // Локальный сервер есть только при запуске через server.py; на GitHub Pages сайт статический.
  let HAS_API = location.protocol.startsWith("http");
  const IS_LOCAL = location.protocol === "file:" || /^(127\.0\.0\.1|localhost)$/.test(location.hostname);
  const ALL = window.CARDS.slice().sort((a, b) => order(a) - order(b));
  function order(c) { return c.arcana === "major" ? c.num : 100 + "wcsp".indexOf(c.suit) * 20 + c.rank; }
  const plural = (n, a, b, c) => n + " " + (n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? b : c);
  const spreadById = id => window.SPREADS.find(s => s.id === id) || window.SPREADS[0];

  let DECKS = window.DECKS || [];
  const state = {
    theme: store.get("theme", "general"),
    question: "",
    spreadId: "free",
    useRev: store.get("useRev", true),
    items: [],      // [{id, rev}] или null для пустой позиции
    active: 0,
    deckId: store.get("deck", null),
    filter: "all",
    search: "",
  };

  // ——— Колода и картинки ———
  function deck() { return DECKS.find(d => d.id === state.deckId) || DECKS[0] || null; }
  function img(cardId, d) {
    d = d || deck();
    const f = d && d.cards && d.cards[cardId];
    return f ? `decks/${encodeURIComponent(d.id)}/raw/${encodeURIComponent(f)}` : null;
  }
  function imgTag(cardId, rev, d) {
    const src = img(cardId, d);
    const c = T.byId[cardId];
    return src ? `<img loading="lazy" src="${src}" alt="${esc(c.name)}" class="${rev ? "rev" : ""}">` : `<div class="noimg">${esc(c.name)}</div>`;
  }

  // ——— Вкладки ———
  function showTab(name) {
    document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === name));
    document.querySelectorAll(".tab").forEach(t => t.classList.toggle("on", t.id === "tab-" + name));
    if (name === "spreads") renderSpreads();
    if (name === "cards") renderLibrary();
    if (name === "decks") renderDecks();
    if (name === "journal") renderJournal();
    store.set("tab", name);
    window.scrollTo({ top: 0 });
  }
  $("#tabs").addEventListener("click", e => { const b = e.target.closest("button"); if (b) showTab(b.dataset.tab); });

  // ——— Модалка ———
  function openModal(node) { const body = $("#modalBody"); body.innerHTML = ""; body.append(node); $("#modal").hidden = false; }
  function closeModal() { $("#modal").hidden = true; }
  $("#modalX").onclick = closeModal;
  $("#modal").addEventListener("click", e => { if (e.target.id === "modal") closeModal(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
  function toast(msg) { const t = h(`<div class="toast">${esc(msg)}</div>`); document.body.append(t); setTimeout(() => t.remove(), 2200); }

  // ——— Шаг 1: тема ———
  function renderThemes() {
    const box = $("#themeChips");
    box.innerHTML = M.themes.map(t => `<button class="chip ${t.id === state.theme ? "on" : ""}" data-id="${t.id}" title="${esc(t.hint)}">${t.icon} ${esc(t.name)}</button>`).join("");
  }
  $("#themeChips").addEventListener("click", e => {
    const b = e.target.closest(".chip"); if (!b) return;
    state.theme = b.dataset.id; store.set("theme", state.theme); renderThemes(); renderResult();
  });
  $("#question").addEventListener("input", e => { state.question = e.target.value; });

  // ——— Шаг 2: схема ———
  function renderSpreadSelect() {
    const groups = {};
    window.SPREADS.forEach(s => (groups[s.group] = groups[s.group] || []).push(s));
    $("#spreadSelect").innerHTML = Object.entries(groups).map(([g, list]) =>
      `<optgroup label="${esc(g)}">${list.map(s => `<option value="${s.id}" ${s.id === state.spreadId ? "selected" : ""}>${esc(s.name)}${s.positions.length ? ` — ${s.positions.length}` : ""}</option>`).join("")}</optgroup>`).join("");
    const sp = spreadById(state.spreadId);
    $("#spreadHint").innerHTML = esc(sp.about) + ` <a href="#" id="spreadMore">Подробнее о схеме</a>`;
    $("#spreadMore").onclick = e => { e.preventDefault(); showTab("spreads"); renderSpreadDetail(sp.id); };
  }
  function setSpread(id, keepCards) {
    state.spreadId = id;
    const sp = spreadById(id);
    const old = state.items.filter(Boolean);
    if (sp.positions.length) {
      state.items = sp.positions.map(p => p.fixed ? { id: p.fixed, rev: false } : null);
      if (keepCards) {
        const pool = old.filter(o => !state.items.some(y => y && y.id === o.id));
        state.items = state.items.map(x => x || pool.shift() || null);
      }
    } else state.items = keepCards ? old : [];
    state.active = nextEmpty();
    renderSpreadSelect(); renderSlots(); renderPicker(); renderResult();
  }
  $("#spreadSelect").addEventListener("change", e => setSpread(e.target.value, true));

  // ——— Шаг 3: позиции ———
  function nextEmpty() {
    const sp = spreadById(state.spreadId);
    if (!sp.positions.length) return state.items.length;
    const i = state.items.findIndex(x => !x);
    return i === -1 ? -1 : i;
  }
  function renderSlots() {
    const sp = spreadById(state.spreadId);
    const box = $("#slots");
    const rows = [];
    const n = sp.positions.length ? sp.positions.length : state.items.length + 1;
    for (let i = 0; i < n; i++) {
      const it = state.items[i];
      const pos = sp.positions[i];
      const fixed = pos && pos.fixed;
      const c = it && T.byId[it.id];
      const title = pos ? pos.t : (c ? `Карта ${i + 1}` : "Добавьте карту");
      const sub = c ? T.fullName(c, it.rev) : (pos && pos.h ? pos.h : "выберите карту справа");
      rows.push(`<div class="slot ${i === state.active ? "active" : ""} ${fixed ? "fixed" : ""}" data-i="${i}">
        <div class="mini">${c ? imgTag(c.id, it.rev) : i + 1}</div>
        <div class="lbl"><b>${i + 1}. ${esc(title)}</b><span>${esc(sub)}</span></div>
        <div class="acts">${c && !fixed ? `${state.useRev ? `<button class="icon-btn ${it.rev ? "on" : ""}" data-act="rev" title="Перевернуть">↻</button>` : ""}<button class="icon-btn" data-act="del" title="Убрать">✕</button>` : ""}</div>
      </div>`);
    }
    box.innerHTML = rows.join("");
    const act = state.active;
    $("#pickHint").textContent = act === -1 ? "Все позиции заполнены. Нажмите на позицию слева, чтобы заменить карту." :
      sp.positions.length ? `Выберите карту для позиции ${act + 1}: «${sp.positions[act].t}»` : "Нажимайте на карты в том порядке, в каком они легли.";
  }
  $("#slots").addEventListener("click", e => {
    const slot = e.target.closest(".slot"); if (!slot) return;
    const i = +slot.dataset.i;
    const btn = e.target.closest("[data-act]");
    const sp = spreadById(state.spreadId);
    if (btn && btn.dataset.act === "rev") { state.items[i].rev = !state.items[i].rev; }
    else if (btn && btn.dataset.act === "del") {
      if (sp.positions.length) state.items[i] = null; else state.items.splice(i, 1);
      state.active = sp.positions.length ? i : state.items.length;
    } else if (!slot.classList.contains("fixed")) state.active = i;
    renderSlots(); renderPicker(); renderResult();
  });
  $("#useRev").checked = state.useRev;
  $("#useRev").addEventListener("change", e => {
    state.useRev = e.target.checked; store.set("useRev", state.useRev);
    if (!state.useRev) state.items.forEach(x => x && (x.rev = false));
    renderSlots(); renderResult();
  });
  $("#clearBtn").onclick = () => setSpread(state.spreadId, false);
  $("#randomBtn").onclick = () => {
    if (state.active === -1) return toast("Все позиции заполнены");
    const used = new Set(state.items.filter(Boolean).map(x => x.id));
    const free = ALL.filter(c => !used.has(c.id));
    const c = free[Math.floor(Math.random() * free.length)];
    place(c.id, state.useRev && Math.random() < 0.5);
  };

  function place(id, rev) {
    const sp = spreadById(state.spreadId);
    const exists = state.items.findIndex(x => x && x.id === id);
    if (exists !== -1 && exists !== state.active) {
      if (sp.positions[exists] && sp.positions[exists].fixed) return toast("Эта карта уже лежит в раскладе");
      if (sp.positions.length) state.items[exists] = null; else { state.items.splice(exists, 1); if (state.active > exists) state.active--; }
    }
    if (sp.positions.length) {
      if (state.active === -1) return toast("Сначала выберите позицию слева");
      state.items[state.active] = { id, rev: !!rev };
    } else {
      state.items[state.active] = { id, rev: !!rev };
    }
    state.active = nextEmpty();
    renderSlots(); renderPicker(); renderResult();
  }

  // ——— Выбор карты ———
  const FILTERS = [["all", "Все"], ["major", "Старшие"], ["w", "Жезлы"], ["c", "Кубки"], ["s", "Мечи"], ["p", "Пентакли"]];
  function filterCards(f, q) {
    q = (q || "").trim().toLowerCase().replace(/ё/g, "е");
    return ALL.filter(c => (f === "all" || (f === "major" ? c.arcana === "major" : c.suit === f)) &&
      (!q || (c.name + " " + c.kUp + " " + c.kRev).toLowerCase().replace(/ё/g, "е").includes(q)));
  }
  function suitTabs(box, cur) { box.innerHTML = FILTERS.map(([id, n]) => `<button class="chip ${id === cur ? "on" : ""}" data-f="${id}">${n}</button>`).join(""); }
  function renderPicker() {
    suitTabs($("#suitTabs"), state.filter);
    const used = new Set(state.items.filter(Boolean).map(x => x.id));
    $("#cardGrid").innerHTML = filterCards(state.filter, state.search).map(c =>
      `<button class="pick ${used.has(c.id) ? "used" : ""}" data-id="${c.id}" title="${esc(c.name)}: ${esc(c.kUp)}"><div class="img">${imgTag(c.id, false)}</div><span class="cap">${esc(c.name)}</span></button>`).join("");
  }
  $("#suitTabs").addEventListener("click", e => { const b = e.target.closest("[data-f]"); if (b) { state.filter = b.dataset.f; renderPicker(); } });
  $("#cardSearch").addEventListener("input", e => { state.search = e.target.value; renderPicker(); });
  $("#cardGrid").addEventListener("click", e => { const b = e.target.closest(".pick"); if (b) place(b.dataset.id, false); });

  // ——— Схема на столе ———
  function board(sp, items, size) {
    const W = size || 86, H = Math.round(W * 1.62), gx = W * 1.18, gy = H * 1.08;
    let layout = sp.layout;
    if (!sp.positions.length) {
      const n = Math.max(items.length, 1), per = Math.min(n, 7);
      layout = items.map((_, i) => [i % per, Math.floor(i / per) * 1.05]);
    }
    if (!layout.length) return h(`<div></div>`);
    const xs = layout.map(p => p[0]), ys = layout.map(p => p[1]);
    const minX = Math.min(...xs), minY = Math.min(...ys);
    const bw = (Math.max(...xs) - minX) * gx + W + 20, bh = (Math.max(...ys) - minY) * gy + H + 20;
    const maxW = Math.min(window.innerWidth - 80, 1100), maxH = 680;
    const k = Math.min(1, maxW / bw, maxH / bh);
    const el = h(`<div class="board" style="width:${bw * k}px;height:${bh * k}px"></div>`);
    layout.forEach(([x, y, r], i) => {
      const it = items[i];
      const left = ((x - minX) * gx + 10) * k, top = ((y - minY) * gy + 10) * k;
      const rot = r || 0;
      const node = h(`<div class="bcard" style="left:${left}px;top:${top}px;width:${W * k}px;height:${H * k}px;transform:rotate(${rot}deg);z-index:${rot === 90 ? 3 : 1}">
        <span class="badge" style="transform:rotate(${-rot}deg)">${i + 1}</span>
        ${it ? `<div class="face">${imgTag(it.id, it.rev)}</div>` : `<div class="face empty">${i + 1}</div>`}</div>`);
      if (it) node.title = T.fullName(T.byId[it.id], it.rev) + (sp.positions[i] ? " — " + sp.positions[i].t : "");
      el.append(node);
    });
    return el;
  }

  // ——— Результат ———
  const ICON = { core: "✦", combo: "★", reflect: "☾", arcana: "◈", suit: "♣", element: "△", number: "№", orient: "↻", court: "♛", tone: "✦", quint: "✧", tip: "!", yesno: "?" };
  function toneBadge(t) { const cls = t >= 1 ? "p" : t <= -1 ? "n" : "z"; return `<span class="tone ${cls}">${T.toneWord(t)}</span>`; }
  function itemsFull() { return state.items.map(x => x ? { card: T.byId[x.id], rev: state.useRev && x.rev } : null); }

  function renderResult() {
    const box = $("#result");
    const sp = spreadById(state.spreadId);
    const items = itemsFull();
    const filled = items.filter(Boolean);
    box.innerHTML = "";
    if (!filled.length) return;
    const tn = T.themeName(state.theme);

    const p1 = h(`<div class="panel"><h2>Расклад: ${esc(sp.name)}</h2><p class="sub">Тема — «${esc(tn)}»${state.question ? ` · Вопрос: ${esc(state.question)}` : ""}</p><div class="board-wrap"></div></div>`);
    p1.querySelector(".board-wrap").append(board(sp, state.items.map(x => x && { id: x.id, rev: state.useRev && x.rev })));
    box.append(p1);

    const p2 = h(`<div class="panel"><h2>Значения карт в теме «${esc(tn)}»</h2><div class="list"></div></div>`);
    items.forEach((it, i) => {
      if (!it) return;
      const c = it.card, pos = sp.positions[i];
      const tx = T.cardText(c, it.rev, state.theme);
      const t = c.tone[it.rev ? 1 : 0];
      const node = h(`<div class="cardblock">
        <div class="img" data-id="${c.id}">${imgTag(c.id, it.rev)}</div>
        <div>
          ${pos ? `<span class="pos">${i + 1}. ${esc(pos.t)}${pos.h ? " — " + esc(pos.h) : ""}</span>` : ""}
          <h3>${esc(T.fullName(c, it.rev))}${toneBadge(t)}</h3>
          <div class="meta">${esc(T.describe(c))}</div>
          <div class="keys">${esc(tx.keys)}</div>
          <p>${esc(tx.text)}</p>
          ${state.theme !== "general" ? `<p class="general"><b>В целом:</b> ${esc(tx.general)}</p>` : ""}
        </div></div>`);
      node.querySelector(".img").onclick = () => openCard(c.id);
      p2.querySelector(".list").append(node);
    });
    box.append(p2);

    if (filled.length >= 2) {
      const p3 = h(`<div class="panel"><h2>Как карты взаимодействуют</h2><p class="sub">Связи в теме «${esc(tn)}»: соседние карты и особые сочетания.</p><div class="list"></div></div>`);
      T.pairsFor(items, sp).forEach(({ i, j, label }) => {
        const A = items[i], B = items[j];
        const r = T.pair(A, B, state.theme);
        const posLbl = sp.positions.length ? `позиции ${i + 1} и ${j + 1}: «${sp.positions[i].t}» и «${sp.positions[j].t}»` : `карты ${i + 1} и ${j + 1}`;
        const node = h(`<div class="pairblock">
          <div class="pairhead"><div class="duo"><div>${imgTag(A.card.id, A.rev)}</div><div>${imgTag(B.card.id, B.rev)}</div></div>
          <div><h4>${esc(r.title)}</h4><div class="lbl">${esc(posLbl)}${label ? " · " + esc(label) : ""}</div></div></div>
          ${r.lines.map(l => `<div class="line ${l.kind}"><span class="ic">${ICON[l.kind] || "·"}</span><span>${esc(l.text)}</span></div>`).join("")}
        </div>`);
        p3.querySelector(".list").append(node);
      });
      box.append(p3);

      const sum = T.summary(items, state.theme, sp);
      if (sum.length) {
        box.append(h(`<div class="panel"><h2>Общая картина</h2>${sum.map(l => `<div class="line"><span class="ic">${ICON[l.kind] || "·"}</span><span>${esc(l.text)}</span></div>`).join("")}
          <p class="hint">Это подсказки, а не готовый ответ: толкование остаётся за вами.</p></div>`));
      }
    }

    const p4 = h(`<div class="panel"><h3>Мои заметки</h3><textarea class="input notes" placeholder="Что вы видите в этом раскладе?"></textarea><div class="row-btns"><button class="btn">Сохранить в дневник</button></div></div>`);
    p4.querySelector("button").onclick = () => saveJournal(p4.querySelector("textarea").value);
    box.append(p4);
  }

  // ——— Подробности карты ———
  function openCard(id) {
    const c = T.byId[id];
    const rows = M.themes.map((t, i) => `<tr><th>${t.icon} ${esc(t.name)}</th><td>${esc(c.up[i])}</td><td>${esc(c.rev[i])}</td></tr>`).join("");
    const refl = M.reflections[id] ? Object.entries(M.reflections[id]).map(([k, v]) => k === "_all" ? v : `${T.byId[k.replace(/r$/, "")].name}${/r$/.test(k) ? " (перевёрнутая)" : ""} — ${v}`) : [];
    const back = Object.entries(M.reflections).filter(([, r]) => r[id] || r[id + "r"]).map(([m, r]) => `${T.byId[m].name} — ${r[id] || r[id + "r"]}`);
    const yes = M.yesNo[c.yes];
    openModal(h(`<div class="cardinfo">
      <div><div class="big">${imgTag(id, false)}</div></div>
      <div>
        <h2>${esc(c.name)}</h2>
        <div class="meta">${esc(T.describe(c))}</div>
        <p><b>Прямая:</b> <span class="keys">${esc(c.kUp)}</span><br><b>Перевёрнутая:</b> <span class="keys">${esc(c.kRev)}</span></p>
        <p class="hint">Да/нет: ${esc(yes)} (перевёрнутая — «нет»).</p>
        ${refl.length ? `<p class="hint"><b>Отражения в младших арканах:</b> ${refl.map(esc).join("; ")}</p>` : ""}
        ${back.length ? `<p class="hint"><b>Отражает старший аркан:</b> ${back.map(esc).join("; ")}</p>` : ""}
        <table><thead><tr><th></th><th>Прямая</th><th>Перевёрнутая</th></tr></thead><tbody>${rows}</tbody></table>
      </div></div>`));
  }

  // ——— Библиотека карт ———
  let libFilter = "all", libSearch = "";
  function renderLibrary() {
    suitTabs($("#libSuitTabs"), libFilter);
    $("#libGrid").innerHTML = filterCards(libFilter, libSearch).map(c =>
      `<button class="pick" data-id="${c.id}"><div class="img">${imgTag(c.id, false)}</div><span class="cap"><b style="color:var(--ink)">${esc(c.name)}</b><br>${esc(c.kUp)}</span></button>`).join("");
  }
  $("#libSuitTabs").addEventListener("click", e => { const b = e.target.closest("[data-f]"); if (b) { libFilter = b.dataset.f; renderLibrary(); } });
  $("#libSearch").addEventListener("input", e => { libSearch = e.target.value; renderLibrary(); });
  $("#libGrid").addEventListener("click", e => { const b = e.target.closest(".pick"); if (b) openCard(b.dataset.id); });

  // ——— Схемы ———
  let curSpread = "guide";
  function renderSpreads() {
    const groups = {};
    window.SPREADS.forEach(s => (groups[s.group] = groups[s.group] || []).push(s));
    $("#spreadList").innerHTML = `<button data-id="guide" class="${curSpread === "guide" ? "on" : ""}">Как гадать: основы <span class="cnt">гид</span></button>` +
      Object.entries(groups).map(([g, list]) => `<h4>${esc(g)}</h4>` + list.map(s =>
        `<button data-id="${s.id}" class="${s.id === curSpread ? "on" : ""}">${esc(s.name)}<span class="cnt">${s.positions.length ? plural(s.positions.filter(p => !p.fixed).length, "карта", "карты", "карт") : "∞"}</span></button>`).join("")).join("");
    renderSpreadDetail(curSpread);
  }
  $("#spreadList").addEventListener("click", e => { const b = e.target.closest("button"); if (b) { curSpread = b.dataset.id; renderSpreads(); } });
  function renderSpreadDetail(id) {
    curSpread = id;
    document.querySelectorAll("#spreadList button").forEach(b => b.classList.toggle("on", b.dataset.id === id));
    const box = $("#spreadDetail");
    if (id === "guide") { box.innerHTML = GUIDE; return; }
    const sp = spreadById(id);
    box.innerHTML = "";
    const fixed = sp.fixedCard ? T.byId[sp.fixedCard] : null;
    box.append(h(`<div><h2>${esc(sp.name)}</h2><p>${esc(sp.about)}</p></div>`));
    if (sp.layout.length) {
      const items = sp.positions.map(p => p.fixed ? { id: p.fixed, rev: false } : null);
      const wrap = h(`<div class="board-wrap"></div>`); wrap.append(board(sp, items, 70)); box.append(wrap);
    }
    box.append(h(`<div>
      <h3>Как раскладывать</h3><p>${esc(sp.howto)}</p>
      ${sp.positions.length ? `<h3>Позиции</h3><ol>${sp.positions.map(p => `<li><b>${esc(p.t)}</b>${p.h ? ` <span>— ${esc(p.h)}</span>` : ""}</li>`).join("")}</ol>` : ""}
      ${sp.tips ? `<div class="tips">${sp.tips.map(t => `<p>${esc(t)}</p>`).join("")}</div>` : ""}
      ${fixed ? `<p class="hint">Аркан расклада: ${esc(fixed.name)} — ${esc(fixed.kUp)}.</p>` : ""}
      <div class="row-btns"><button class="btn" id="useSpread">Разложить по этой схеме</button></div></div>`));
    $("#useSpread").onclick = () => { showTab("read"); setSpread(sp.id, false); };
  }
  const GUIDE = `<div class="guide">
    <h2>Как гадать: основы</h2>
    <p>Коротко по книге Лиз Дин «The Ultimate Guide to Tarot». Приложение не гадает за вас: оно подсказывает значения и связи, а вывод делаете вы.</p>
    <h3>Перед раскладом</h3>
    <p><b>Очистка колоды.</b> Разверните карты веером, подуйте на край, сложите и один раз постучите по колоде.</p>
    <p><b>Пространство.</b> Спокойное место, ровная поверхность и ткань для гадания. Можно зажечь свечу и задать намерение; после расклада поблагодарить и погасить свечу.</p>
    <h3>Как выбирать карты</h3>
    <p><b>Веер</b> — когда нужно немного карт. Разложите колоду веером рубашкой вверх и выбирайте карты по одной левой рукой («рука судьбы»), выкладывая их по схеме рубашкой вверх.</p>
    <p><b>Срезка</b> — для больших раскладов (Кельтский крест, Древо Жизни). Срежьте колоду левой рукой дважды, чтобы было три стопки; выберите стопку, которая станет верхом, сложите остальные под неё и выкладывайте карты сверху.</p>
    <p><b>Переворачивайте карты вбок</b>, слева направо, а не сверху вниз: иначе случайно перевернёте карту.</p>
    <h3>Как читать</h3>
    <p><b>Сначала картинка.</b> Посмотрите на карту до значения: какая деталь бросается в глаза? Это «крючок» интуиции. Говорите, что приходит в голову, как будто рассказываете историю.</p>
    <p><b>Начните со старших арканов.</b> Можно гадать только по 22 старшим, пока не освоитесь: младшие — «разбавленные» версии старших.</p>
    <p><b>Перевёрнутые карты.</b> Кто-то учитывает их всегда, кто-то никогда — как вам ближе. Перевёрнутое значение обычно «тяжелее» прямого, но есть исключения: перевёрнутые Дьявол и Пятёрка Кубков легче прямых. Переключатель «Учитываю перевёрнутые» на вкладке «Расклад».</p>
    <p><b>Масти по стихиям:</b> Жезлы — Огонь (действие, проекты, «я желаю»), Кубки — Вода (чувства, «я чувствую»), Мечи — Воздух (мысли, решения, «я думаю»), Пентакли — Земля (деньги, дом, тело, «я обладаю»).</p>
    <p><b>Числа младших:</b> 1 — начало, 2 — партнёрство и баланс, 3 — признание, 4 — стабильность, 5 — испытание, 6 — гармония, 7 — потенциал, 8 — награда и движение, 9 — интенсивность, 10 — завершение. Число окрашено мастью: Тройка Мечей — боль, Тройка Кубков — праздник.</p>
    <p><b>Придворные:</b> Пажи — Земля, Рыцари — Огонь, Королевы — Вода, Короли — Воздух (Королева Жезлов — Вода в Огне: чувства и интуиция плюс общение и энергия).</p>
    <p><b>Цвета:</b> красный — энергия, страсть, материальное; жёлтый — сознание, самовыражение; синий — истина и ясность; зелёный — природа и рост; серый — неизвестность; фиолетовый — интуиция, духовность; чёрный — защита или гнёт; белый — чистота; оранжевый — творчество, импульс.</p>
    <h3>Если расклад непонятен</h3>
    <p>Перетасуйте и разложите снова. Если выпадают те же или похожие карты — читайте их. Если в позиции «вы/ситуация» Десятка Жезлов, возможно, сейчас слишком много всего: отложите гадание на пару дней.</p>
    <h3>Квинтэссенция</h3>
    <p>Сложите номера старших арканов в раскладе и сведите к числу до 21: например, II + XXI + XIV = 37 → 3 + 7 = 10, Колесо Фортуны. Эта карта — дополнительная подсказка. Приложение считает её в «Общей картине».</p>
  </div>`;

  // ——— Колоды ———
  async function refreshDecks() {
    if (!HAS_API) return;
    try {
      const r = await fetch("api/decks");
      if (r.ok && (r.headers.get("Content-Type") || "").includes("json")) DECKS = await r.json(); else HAS_API = false;
    } catch { HAS_API = false; }
  }
  function setDeck(id) { state.deckId = id; store.set("deck", id); renderSlots(); renderPicker(); renderResult(); renderDecks(); toast("Колода: " + (deck() ? deck().title.split(" — ")[0] : "")); }
  function renderDecks() {
    const box = $("#decksView");
    const cur = deck();
    box.innerHTML = "";
    box.append(h(`<div><h2>Колоды</h2><p class="hint">Карты берутся из галереи rozamira-tarot.ru и хранятся у вас на компьютере. Выберите колоду для раскладов. «Проверить карты» поможет поправить, если какая-то картинка стоит не на своём месте.</p></div>`));
    const grid = h(`<div class="deck-grid"></div>`);
    DECKS.forEach(d => {
      const n = Object.keys(d.cards || {}).length;
      const node = h(`<div class="deck ${cur && d.id === cur.id ? "on" : ""}">
        <div class="fan"><div>${imgTag("maj00", false, d)}</div><div>${imgTag("maj17", false, d)}</div><div>${imgTag("maj21", false, d)}</div></div>
        <h4>${esc(d.title)}</h4>
        ${n < 78 ? `<div class="warn">Распознано ${n} из 78 — нужна проверка</div>` : d.confidence === "numbered" && !d.checked ? `<div class="warn" style="color:var(--gold)">Карты разложены по номерам — стоит проверить</div>` : ""}
        <div class="acts"><button class="btn" data-act="use">${cur && d.id === cur.id ? "Выбрана" : "Выбрать"}</button><button class="btn ghost" data-act="map">${HAS_API ? "Проверить карты" : "Все карты"}</button>${HAS_API ? `<button class="btn danger" data-act="del" title="Удалить колоду">✕</button>` : ""}</div></div>`);
      node.addEventListener("click", e => {
        const a = e.target.closest("[data-act]"); if (!a) return;
        if (a.dataset.act === "use") setDeck(d.id);
        if (a.dataset.act === "map") openMapper(d);
        if (a.dataset.act === "del") deleteDeck(d);
      });
      grid.append(node);
    });
    box.append(grid);
    box.append(catalogPanel());
  }
  async function deleteDeck(d) {
    if (!window.confirm(`Удалить колоду «${d.title}» с компьютера?`)) return;
    const r = await fetch("api/deck/" + encodeURIComponent(d.id), { method: "DELETE" });
    if (r.ok) { await refreshDecks(); if (state.deckId === d.id) state.deckId = DECKS[0] && DECKS[0].id; renderDecks(); renderPicker(); }
  }

  let catalog = null;
  function catalogPanel() {
    const p = h(`<div class="catalog"><h3>Добавить колоду с сайта</h3>
      ${HAS_API ? `<p class="hint">Поиск по всем альбомам галереи. Скачивание занимает около минуты.</p>
      <input class="input small" id="catQ" placeholder="Например: Ленорман, кошки, Marseille, Thoth…">
      <div id="catJob"></div><div class="catalog-list" id="catList"></div>`
      : IS_LOCAL ? `<p class="hint">Чтобы скачивать новые колоды, запустите приложение через <b>«Таро»</b> в меню приложений (или <code>python3 ~/tarot-app/server.py</code>) — откроется адрес http://127.0.0.1:8777.</p>`
      : `<p class="hint">В веб-версии доступны колоды выше; добавлять новые можно в настольной версии приложения.</p>`}</div>`);
    if (!HAS_API) return p;
    const list = p.querySelector("#catList"), q = p.querySelector("#catQ");
    const draw = () => {
      if (!catalog) { list.innerHTML = `<div>Загружаю каталог…</div>`; return; }
      const s = q.value.trim().toLowerCase();
      const have = new Set(DECKS.map(d => d.source));
      const rows = catalog.filter(x => !s || x.title.toLowerCase().includes(s)).slice(0, 150);
      list.innerHTML = rows.map(x => `<div><span>${esc(x.title)}</span>${have.has(x.url) ? `<span class="hint">уже есть</span>` : `<button class="btn ghost" data-url="${esc(x.url)}" data-title="${esc(x.title)}">Скачать</button>`}</div>`).join("") || `<div>Ничего не найдено</div>`;
    };
    q.addEventListener("input", draw);
    list.addEventListener("click", e => { const b = e.target.closest("[data-url]"); if (b) startImport(b.dataset.url, b.dataset.title, p); });
    if (!catalog) fetch("api/catalog").then(r => r.json()).then(c => { catalog = c; draw(); }).catch(() => { list.innerHTML = "<div>Каталог недоступен</div>"; });
    draw();
    return p;
  }
  async function startImport(url, title, panel) {
    const job = panel.querySelector("#catJob");
    job.innerHTML = `<p class="hint">Скачиваю «${esc(title)}»…</p><div class="progress"><div></div></div>`;
    const r = await fetch("api/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, title }) });
    const { job: id, error } = await r.json();
    if (error) { job.innerHTML = `<p class="hint" style="color:var(--bad)">${esc(error)}</p>`; return; }
    const poll = async () => {
      const s = await (await fetch("api/job/" + id)).json();
      const bar = job.querySelector(".progress div");
      if (bar && s.total) bar.style.width = Math.round(100 * s.done / s.total) + "%";
      if (s.state === "running") return setTimeout(poll, 700);
      if (s.state === "error") { job.innerHTML = `<p class="hint" style="color:var(--bad)">Не получилось: ${esc(s.msg)}</p>`; return; }
      await refreshDecks();
      const d = DECKS.find(x => x.id === s.deck);
      const n = d ? Object.keys(d.cards).length : 0;
      job.innerHTML = `<p class="hint">Готово: «${esc(title)}», распознано ${n} из 78.</p>`;
      renderDecks();
      if (d && (n < 78 || d.confidence !== "named")) { toast("Проверьте, все ли карты на своих местах"); openMapper(d); }
    };
    poll();
  }

  // ——— Проверка соответствия карт ———
  const ORDERS = ["wcsp", "wcps", "wscp", "wspc", "wpcs", "wpsc", "cwsp", "cwps", "cswp", "cspw", "cpws", "cpsw", "swcp", "swpc", "scwp", "scpw", "spwc", "spcw", "pwcs", "pwsc", "pcws", "pcsw", "pswc", "pscw"];
  function recompute(d) {
    const cards = {};
    const seq = d.seq || [];
    if (d.confidence === "numbered" && seq.length) {
      const nb = d.numbered || {};
      const ids = Array.from({ length: 22 }, (_, i) => "maj" + String(i).padStart(2, "0")).concat([...(nb.order || "wcsp")].flatMap(s => Array.from({ length: 14 }, (_, r) => s + String(r + 1).padStart(2, "0"))));
      if (nb.swap811) [ids[8], ids[11]] = [ids[11], ids[8]];
      ids.forEach((id, i) => { const f = seq[(+nb.offset || 0) + i]; if (f) cards[id] = f; });
    } else Object.assign(cards, d.auto || {});
    Object.entries(d.manual || {}).forEach(([k, v]) => { if (v) cards[k] = v; else delete cards[k]; });
    d.cards = cards;
  }
  function openMapper(orig) {
    const d = JSON.parse(JSON.stringify(orig));
    d.manual = d.manual || {};
    const node = h(`<div><h2>Проверка карт</h2><p class="hint">${esc(d.title)}. Под каждой картинкой — название карты, которое ей присвоено. Если картинка не та, нажмите на неё и выберите правильную.</p>
      <div class="mapper-tools"></div><div class="mapper-grid"></div>
      <div class="row-btns">${HAS_API ? `<button class="btn" data-act="save">Сохранить</button>` : `<span class="hint">${IS_LOCAL ? "Сохранение доступно при запуске через сервер." : "Просмотр соответствия карт."}</span>`}<button class="btn ghost" data-act="close">Закрыть</button></div></div>`);
    const tools = node.querySelector(".mapper-tools"), grid = node.querySelector(".mapper-grid");
    if (d.confidence === "numbered") {
      const sn = s => [...s].map(ch => M.suits[ch].name).join(", ");
      tools.innerHTML = `<label>Сдвиг (сколько лишних файлов в начале)<input type="number" class="input" style="width:110px" min="0" max="40" value="${+d.numbered.offset || 0}" data-k="offset"></label>
        <label>Порядок мастей после старших<select class="input" data-k="order">${ORDERS.map(o => `<option value="${o}" ${o === d.numbered.order ? "selected" : ""}>${sn(o)}</option>`).join("")}</select></label>
        <label class="switch" style="flex-direction:row"><input type="checkbox" data-k="swap811" ${d.numbered.swap811 ? "checked" : ""}> Сила и Справедливость поменяны (8 ↔ 11)</label>`;
      tools.addEventListener("change", e => {
        const k = e.target.dataset.k; if (!k) return;
        d.numbered[k] = k === "swap811" ? e.target.checked : k === "offset" ? +e.target.value : e.target.value;
        d.manual = {}; draw();
      });
    }
    const draw = () => {
      recompute(d);
      grid.innerHTML = ALL.map(c => `<button class="pick" data-id="${c.id}"><div class="img">${imgTag(c.id, false, d)}</div><span class="cap">${esc(c.name)}${d.manual[c.id] ? " ✎" : ""}</span></button>`).join("");
    };
    grid.addEventListener("click", e => {
      const b = e.target.closest(".pick"); if (!b) return;
      const cid = b.dataset.id;
      const pool = h(`<div><h3>Картинка для «${esc(T.byId[cid].name)}»</h3><div class="pool">${d.files.map(f => `<button class="pick" data-f="${esc(f)}"><div class="img"><img loading="lazy" src="decks/${encodeURIComponent(d.id)}/raw/${encodeURIComponent(f)}"></div></button>`).join("")}</div><div class="row-btns"><button class="btn ghost" data-act="back">Назад</button></div></div>`);
      pool.addEventListener("click", ev => {
        const p = ev.target.closest("[data-f]");
        if (p) {
          const f = p.dataset.f;
          const other = Object.keys(d.cards).find(k => d.cards[k] === f && k !== cid);
          if (other) d.manual[other] = d.cards[cid] || "";  // меняем местами
          d.manual[cid] = f; draw(); openModal(node);
        }
        if (ev.target.closest("[data-act=back]")) openModal(node);
      });
      openModal(pool);
    });
    node.addEventListener("click", async e => {
      const a = e.target.closest("[data-act]"); if (!a) return;
      if (a.dataset.act === "close") closeModal();
      if (a.dataset.act === "save") {
        const r = await fetch("api/deck/" + encodeURIComponent(d.id), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ numbered: d.numbered, manual: d.manual, checked: true }) });
        if (r.ok) { await refreshDecks(); closeModal(); renderDecks(); renderPicker(); renderResult(); toast("Сохранено"); }
        else toast("Не удалось сохранить");
      }
    });
    draw();
    openModal(node);
  }

  // ——— Дневник ———
  function saveJournal(notes) {
    const list = store.get("journal", []);
    list.unshift({ at: new Date().toISOString(), theme: state.theme, question: state.question, spread: state.spreadId, deck: deck() && deck().id, useRev: state.useRev, items: state.items, notes });
    store.set("journal", list.slice(0, 300));
    toast("Сохранено в дневник");
  }
  function renderJournal() {
    const list = store.get("journal", []);
    const box = $("#journalView");
    box.innerHTML = `<h2>Дневник раскладов</h2><p class="hint">Хранится только в этом браузере.</p>`;
    if (!list.length) { box.append(h(`<div class="empty-state">Пока пусто. Сохраните расклад кнопкой «Сохранить в дневник».</div>`)); return; }
    list.forEach((j, idx) => {
      const sp = spreadById(j.spread);
      const d = DECKS.find(x => x.id === j.deck);
      const node = h(`<div class="jentry"><div>
        <b>${esc(sp.name)}</b> · ${esc(T.themeName(j.theme))}${j.question ? ` · «${esc(j.question)}»` : ""}
        <div class="when">${new Date(j.at).toLocaleString("ru-RU")}</div>
        <div class="thumbs">${(j.items || []).filter(Boolean).map(x => `<div title="${esc(T.fullName(T.byId[x.id], x.rev))}">${imgTag(x.id, j.useRev && x.rev, d)}</div>`).join("")}</div>
        ${j.notes ? `<p>${esc(j.notes)}</p>` : ""}</div>
        <div class="row-btns"><button class="btn ghost" data-act="open">Открыть</button><button class="btn danger" data-act="del">✕</button></div></div>`);
      node.addEventListener("click", e => {
        const a = e.target.closest("[data-act]"); if (!a) return;
        if (a.dataset.act === "del") { list.splice(idx, 1); store.set("journal", list); renderJournal(); }
        if (a.dataset.act === "open") {
          Object.assign(state, { theme: j.theme, question: j.question || "", spreadId: j.spread, useRev: j.useRev, items: j.items.map(x => x && { ...x }) });
          if (j.deck && DECKS.some(x => x.id === j.deck)) state.deckId = j.deck;
          $("#question").value = state.question; $("#useRev").checked = state.useRev;
          state.active = nextEmpty();
          showTab("read"); renderThemes(); renderSpreadSelect(); renderSlots(); renderPicker(); renderResult();
          const ta = document.querySelector("#result textarea"); if (ta) ta.value = j.notes || "";
        }
      });
      box.append(node);
    });
  }

  // ——— Старт ———
  async function init() {
    await refreshDecks();
    if (!deck() && DECKS[0]) state.deckId = DECKS[0].id;
    renderThemes(); renderSpreadSelect(); renderSlots(); renderPicker(); renderResult();
    const tab = store.get("tab", "read");
    if (tab !== "read") showTab(tab);
  }
  window.TAROT_APP = { state, place, setSpread, showTab };
  init();
})();
