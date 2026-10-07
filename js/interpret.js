// Толкование: значения карт в теме и то, как карты взаимодействуют.
// Чистые функции без DOM — их проверяет tests/run.sh.
(function () {
  const M = window.META;
  const byId = {};
  window.CARDS.forEach(c => { byId[c.id] = c; });

  const themeName = id => (M.themes.find(t => t.id === id) || M.themes[0]).name;
  const themeIdx = id => Math.max(0, M.themes.findIndex(t => t.id === id));

  // Род карты для согласования: m, f, n, pl
  function gender(c) {
    const w = c.name.split(" ")[0];
    if (w === "Влюблённые") return "pl";
    if (w === "Колесо" || w === "Солнце") return "n";
    if (/^(Туз|Паж|Рыцарь|Король|Шут|Маг|Император|Иерофант|Отшельник|Повешенный|Дьявол|Суд|Мир)$/.test(w)) return "m";
    return "f";
  }
  const G = (c, forms) => forms[["m", "f", "n", "pl"].indexOf(gender(c))];
  function fullName(c, rev) { return c.name + (rev ? " (" + G(c, ["перевёрнутый", "перевёрнутая", "перевёрнутое", "перевёрнутые"]) + ")" : ""); }
  const revShort = c => G(c, ["перевёрнут", "перевёрнута", "перевёрнуто", "перевёрнуты"]);
  function keys(c, rev) { return rev ? c.kRev : c.kUp; }
  function tone(c, rev) { return c.tone[rev ? 1 : 0]; }
  function isCourt(c) { return c.arcana === "minor" && c.rank >= 11; }
  function reduce(n) { while (n > 21) n = String(n).split("").reduce((a, d) => a + +d, 0); return n; }
  function digitRoot(n) { while (n > 9) n = String(n).split("").reduce((a, d) => a + +d, 0); return n; }
  function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }

  function cardText(c, rev, theme) {
    const i = themeIdx(theme);
    const arr = rev ? c.rev : c.up;
    return { text: arr[i] || arr[0], general: arr[0], keys: keys(c, rev) };
  }

  function toneWord(t) {
    if (t >= 2) return "очень благоприятная";
    if (t === 1) return "благоприятная";
    if (t === 0) return "нейтральная";
    if (t === -1) return "непростая";
    return "тяжёлая";
  }

  function describe(c) {
    if (c.arcana === "major") return `Старший аркан ${c.num}, стихия — ${M.elements[c.element].name.toLowerCase()}, ${c.astro}`;
    const s = M.suits[c.suit];
    const nm = c.rank <= 10 ? `число ${c.rank} — ${M.numbers[c.rank]}` : "придворная карта";
    return `${s.name}, стихия — ${M.elements[c.element].name.toLowerCase()}; ${nm}; ${c.astro}`;
  }

  // ——— Пара карт ———
  function pair(A, B, theme) {
    const a = A.card, b = B.card;
    const out = { title: `${fullName(a, A.rev)} + ${fullName(b, B.rev)}`, lines: [] };
    const L = (kind, text) => out.lines.push({ kind, text });
    const tn = themeName(theme);
    const lensA = a.arcana === "major" ? null : M.suitLens[a.suit][theme];
    const lensB = b.arcana === "major" ? null : M.suitLens[b.suit][theme];

    // 1. Суть сочетания в теме
    const tA = tone(a, A.rev), tB = tone(b, B.rev);
    let core = `В теме «${tn}» ${fullName(a, A.rev)} — это ${keys(a, A.rev)}, а ${fullName(b, B.rev)} — ${keys(b, B.rev)}.`;
    if (tA >= 1 && tB >= 1) core += " Обе карты благоприятны: они поддерживают друг друга, и вместе их «плюс» сильнее, чем по отдельности.";
    else if (tA <= -1 && tB <= -1) core += " Обе карты непростые: вместе они очерчивают одну проблему с двух сторон — часто одна показывает причину, другая следствие. Это предупреждение, а не приговор.";
    else if ((tA >= 1 && tB <= -1) || (tA <= -1 && tB >= 1)) {
      const good = tA >= 1 ? a : b, bad = tA >= 1 ? b : a;
      const goodRev = tA >= 1 ? A.rev : B.rev, badRev = tA >= 1 ? B.rev : A.rev;
      core += ` Здесь ресурс и препятствие: ${fullName(good, goodRev)} — то, на что можно опереться, ${fullName(bad, badRev)} — то, с чем предстоит справиться.`;
      core += tA <= -1 ? " Трудная карта идёт первой, светлая — второй: движение от проблемы к решению." : " Светлая карта идёт первой, трудная — второй: хорошее начало требует внимания, чтобы не упустить его.";
    } else {
      const neu = tA === 0 ? a : b, other = tA === 0 ? b : a;
      const nr = tA === 0 ? A.rev : B.rev, or = tA === 0 ? B.rev : A.rev;
      if (tA === 0 && tB === 0) core += " Обе карты нейтральны: это скорее процесс и пауза, чем событие; многое зависит от ваших действий.";
      else core += ` ${fullName(neu, nr)} ${G(neu, ["нейтрален", "нейтральна", "нейтрально", "нейтральны"])} и ${G(neu, ["служит", "служит", "служит", "служат"])} фоном или условием для того, что несёт ${fullName(other, or)}.`;
    }
    L("core", core);

    // 2. Классическое сочетание
    const k1 = a.id + "+" + b.id, k2 = b.id + "+" + a.id;
    const combo = M.combos[k1] || M.combos[k2];
    if (combo) L("combo", combo + (A.rev || B.rev ? " Перевёрнутая карта ослабляет или задерживает это сочетание." : ""));

    // 3. Отражения из книги
    const refl = (maj, majRev, min, minRev) => {
      const r = M.reflections[maj.id];
      if (!r) return null;
      if (r._all && min.arcana === "minor") return `${maj.name}: ${r._all}. Здесь это ${M.suits[min.suit].name.toLowerCase()} — ${M.suits[min.suit].short}.`;
      const hit = r[min.id + (minRev ? "r" : "")] || (!/r$/.test(min.id) && r[min.id]);
      if (!hit) return null;
      return `По книге ${min.name} — «отражение» карты ${maj.name} среди младших арканов (${hit}). Большой урок ${maj.name} проявляется в конкретном, бытовом событии ${min.name}.`;
    };
    if (a.arcana === "major" && b.arcana === "minor") { const t = refl(a, A.rev, b, B.rev); if (t) L("reflect", t); }
    if (b.arcana === "major" && a.arcana === "minor") { const t = refl(b, B.rev, a, A.rev); if (t) L("reflect", t); }

    // 4. Уровень арканов
    if (a.arcana === "major" && b.arcana === "major") {
      L("arcana", "Два старших аркана: это не бытовая мелочь, а важный жизненный поворот. Обе силы крупные — решения сейчас влияют надолго.");
      const ra = digitRoot(a.num), rb = digitRoot(b.num);
      if (a.num !== b.num && a.num > 0 && b.num > 0 && ra === rb)
        L("number", `Нумерологическая связь: ${a.num} и ${b.num} сводятся к одному числу (${ra}). Это две стороны одной энергии — то, что начинает одна карта, продолжает другая.`);
    } else if (a.arcana !== b.arcana) {
      const maj = a.arcana === "major" ? a : b, min = maj === a ? b : a;
      const minRev = maj === a ? B.rev : A.rev;
      L("arcana", `${maj.name} ${G(maj, ["задаёт", "задаёт", "задаёт", "задают"])} главный урок, а ${min.name} показывает, где он проявится: ${M.suitLens[min.suit][theme]}.`);
      if (min.rank <= 10 && maj.num > 0 && digitRoot(maj.num) === min.rank)
        L("number", `Число ${min.rank} связывает обе карты: аркан ${maj.num} сводится к ${min.rank}, так что ${min.name} звучит как «малая версия» ${maj.name}${minRev ? ", пока заблокированная" : ""}.`);
    } else {
      L("arcana", "Обе карты — младшие арканы: речь о повседневном уровне. Обстоятельства подвижны, и многое в ваших руках.");
    }

    // 5. Масти и стихии
    if (a.arcana === "minor" && b.arcana === "minor") {
      if (a.suit === b.suit) L("suit", `Обе карты — ${M.suits[a.suit].name}: в теме «${tn}» на первый план выходит ${lensA}.`);
      else L("suit", `${M.suits[a.suit].name} (${lensA}) встречаются с ${M.suits[b.suit].name.toLowerCase()} (${lensB}).`);
    }
    const rel = M.elementRel(a.element, b.element);
    L("element", `${M.elements[a.element].name} и ${M.elements[b.element].name.toLowerCase()}. ` + M.elementPairText[rel][theme]);

    // 6. Числа
    if (a.arcana === "minor" && b.arcana === "minor") {
      if (a.rank === b.rank) {
        const g = M.groups[a.rank];
        if (g) L("number", g[2]);
        else L("number", `Одинаковое число ${a.rank} (${M.numbers[a.rank]}) звучит сразу в двух сферах — ${M.suits[a.suit].short} и ${M.suits[b.suit].short}. Тема числа становится главной.`);
      } else if (a.suit === b.suit && Math.abs(a.rank - b.rank) === 1 && a.rank <= 10 && b.rank <= 10) {
        const lo = a.rank < b.rank ? a : b, hi = lo === a ? b : a;
        L("number", `Соседние числа одной масти: сюжет развивается от ${lo.rank} (${M.numbers[lo.rank]}) к ${hi.rank} (${M.numbers[hi.rank]}).`);
      }
    }

    // 7. Ориентация
    if (A.rev && B.rev) L("orient", "Обе карты перевёрнуты: энергия ушла внутрь или задержана. Это время пересмотра и внутренней работы, а не решительных шагов.");
    else if (A.rev || B.rev) {
      const r = A.rev ? a : b, u = A.rev ? b : a;
      const its = G(r, ["его", "её", "его", "их"]);
      if (tone(r, true) >= 1) L("orient", `${r.name} ${revShort(r)}, но здесь это скорее облегчение: старое напряжение отпускает. ${u.name} ${G(u, ["подсказывает", "подсказывает", "подсказывает", "подсказывают"])}, куда направить освободившиеся силы.`);
      else L("orient", `${r.name} ${revShort(r)}: ${its} энергия задержана, искажена или обращена внутрь. ${u.name} в прямом положении ${G(u, ["показывает", "показывает", "показывает", "показывают"])}, через что эту энергию можно освободить.`);
    }

    // 8. Придворные карты как люди
    if (isCourt(a) && isCourt(b)) L("court", `Две придворные карты — это могут быть два человека или две роли в одной ситуации. ${a.name} и ${b.name}: присмотритесь, как эти характеры уживаются друг с другом.`);
    else if (isCourt(a) || isCourt(b)) {
      const ct = isCourt(a) ? a : b, other = ct === a ? b : a;
      L("court", `${ct.name} может обозначать человека (или вашу роль), через которого в теме «${tn}» проявляется ${other.name}.`);
    }
    return out;
  }

  // Какие пары показывать
  function pairsFor(items, spread) {
    const res = [];
    const seen = new Set();
    const add = (i, j, label) => {
      if (i >= items.length || j >= items.length || !items[i] || !items[j]) return;
      const k = i < j ? i + "-" + j : j + "-" + i;
      if (seen.has(k)) return;
      seen.add(k);
      res.push({ i, j, label });
    };
    if (spread && spread.pairs) spread.pairs.forEach(([i, j, l]) => add(i, j, l));
    if (!(spread && spread.pairs)) for (let i = 0; i + 1 < items.length; i++) add(i, i + 1, null);
    // Значимые сочетания между несоседними картами
    for (let i = 0; i < items.length; i++) for (let j = i + 2; j < items.length; j++) {
      const a = items[i], b = items[j];
      if (!a || !b) continue;
      const known = M.combos[a.card.id + "+" + b.card.id] || M.combos[b.card.id + "+" + a.card.id];
      const r1 = M.reflections[a.card.id] && M.reflections[a.card.id][b.card.id];
      const r2 = M.reflections[b.card.id] && M.reflections[b.card.id][a.card.id];
      if (known || r1 || r2) add(i, j, "особое сочетание");
    }
    return res;
  }

  // ——— Общая картина ———
  function summary(items, theme, spread) {
    const L = [];
    const cs = items.filter(Boolean);
    if (cs.length < 2) return L;
    const tn = themeName(theme);
    const majors = cs.filter(x => x.card.arcana === "major");
    const minors = cs.filter(x => x.card.arcana === "minor");
    const revs = cs.filter(x => x.rev);
    const courts = cs.filter(x => isCourt(x.card));

    const avg = cs.reduce((s, x) => s + tone(x.card, x.rev), 0) / cs.length;
    let mood = avg >= 1 ? "благоприятный" : avg > 0.2 ? "скорее благоприятный" : avg >= -0.2 ? "смешанный" : avg > -1 ? "напряжённый" : "тяжёлый";
    L.push({ kind: "tone", text: `Общий фон расклада в теме «${tn}»: ${mood}.` });

    if (cs.length >= 3 && majors.length / cs.length >= 0.5) L.push({ kind: "arcana", text: `Старших арканов ${majors.length} из ${cs.length}: ситуация судьбоносная, затронуты важные жизненные уроки, и не всё зависит от вас.` });
    else if (cs.length >= 3 && majors.length === 0) L.push({ kind: "arcana", text: "Ни одного старшего аркана: всё происходит на повседневном уровне, и обстоятельства в ваших руках." });

    const suitCount = {};
    minors.forEach(x => { suitCount[x.card.suit] = (suitCount[x.card.suit] || 0) + 1; });
    const top = Object.entries(suitCount).sort((a, b) => b[1] - a[1]);
    if (top.length && top[0][1] >= 2 && (top.length === 1 || top[0][1] > top[1][1]))
      L.push({ kind: "suit", text: `Преобладают ${M.suits[top[0][0]].name} (${top[0][1]}): в теме «${tn}» главное сейчас — ${M.suitLens[top[0][0]][theme]}.` });
    if (minors.length >= 4) {
      const missing = Object.keys(M.suits).filter(s => !suitCount[s]);
      if (missing.length === 1) L.push({ kind: "suit", text: `Нет ни одной карты масти ${M.suits[missing[0]].gen}: стихия «${M.elements[M.suits[missing[0]].element].name}» (${M.elements[M.suits[missing[0]].element].short}) сейчас в тени — возможно, именно её не хватает.` });
    }

    if (revs.length >= Math.ceil(cs.length / 2) && cs.length >= 3) L.push({ kind: "orient", text: `Перевёрнутых карт ${revs.length} из ${cs.length}: многое задержано или идёт внутри. Хорошее время для пересмотра, а не для резких шагов.` });
    if (courts.length >= 2) L.push({ kind: "court", text: `Придворных карт ${courts.length}: в ситуации участвует несколько людей, или вы играете разные роли.` });

    const rankCount = {};
    minors.forEach(x => { rankCount[x.card.rank] = (rankCount[x.card.rank] || 0) + 1; });
    Object.entries(rankCount).forEach(([r, n]) => {
      if (n < 2) return;
      const g = M.groups[r];
      if (g && g[Math.min(n, 4)]) L.push({ kind: "number", text: g[Math.min(n, 4)] });
      else if (+r <= 10) L.push({ kind: "number", text: `Число ${r} повторяется ${n} раза: ${M.numbers[r]} — сквозной мотив расклада.` });
    });

    const sum = majors.reduce((s, x) => s + x.card.num, 0);
    if (majors.length >= 2 && sum > 0) {
      const q = reduce(sum);
      const qc = byId["maj" + String(q).padStart(2, "0")];
      if (qc) L.push({ kind: "quint", text: `Квинтэссенция: сумма старших арканов ${majors.map(x => x.card.num).join(" + ")} = ${sum} → ${q}, ${qc.name} (${qc.kUp}). Это дополнительная подсказка к раскладу.`, card: qc.id });
    }

    if (cs.some(x => x.card.id === "w10")) L.push({ kind: "tip", text: "В раскладе Десятка Жезлов: по книге она иногда означает, что сейчас слишком много всего и вопрос не получается разглядеть ясно — можно переложить через день-два." });
    const overrule = cs.filter(x => !x.rev && ["maj19", "p01", "s01", "w01"].includes(x.card.id));
    if (overrule.length) L.push({ kind: "tip", text: `${overrule.map(x => x.card.name).join(", ")} в прямом положении — по книге такие карты перекрывают негатив соседних младших арканов.` });

    if (spread && spread.id === "celtic" && items[9] && isCourt(items[9].card)) L.push({ kind: "tip", text: "Итоговая (10-я) карта — придворная: по книге исход зависит от вас самих." });

    if (spread && spread.yesno) {
      const ans = cs.map(x => x.rev ? "no" : x.card.yes);
      const yes = ans.filter(a => a === "yes" || a === "fight").length;
      let verdict;
      if (ans.includes("unknown")) verdict = "Среди карт есть «ответ пока неизвестен» (Двойка Мечей или Десятка Жезлов).";
      if (yes === 3) verdict = (verdict ? verdict + " " : "") + "Три «да» — ответ уверенный.";
      else if (yes === 2) verdict = (verdict ? verdict + " " : "") + "Два «да» — скорее да, но может понадобиться время.";
      else verdict = (verdict ? verdict + " " : "") + "Большинство карт — «нет» или «нейтрально»: ответ скорее отрицательный.";
      L.push({ kind: "yesno", text: `Да/нет: ${ans.map(a => M.yesNo[a]).join(" · ")}. ${verdict}` });
    }
    return L;
  }

  window.TAROT = { gender, byId, cardText, describe, pair, pairsFor, summary, themeName, toneWord, fullName, isCourt, reduce };
})();
