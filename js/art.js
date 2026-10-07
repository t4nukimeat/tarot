// Картины для оформления (общественное достояние, Wikimedia Commons) и золочёные рамы.
(function () {
  const P = {
    venus: { src: "assets/ren/venus.jpg", who: "Сандро Боттичелли", what: "Рождение Венеры", when: "ок. 1485", where: "Галерея Уффици, Флоренция" },
    venusFace: { src: "assets/ren/venus-face.jpg", who: "Сандро Боттичелли", what: "Рождение Венеры (фрагмент)", when: "ок. 1485", where: "Галерея Уффици" },
    graces: { src: "assets/ren/graces.jpg", who: "Сандро Боттичелли", what: "Весна: три грации", when: "1480-е", where: "Галерея Уффици" },
    putti: { src: "assets/ren/putti.jpg", who: "Рафаэль Санти", what: "Сикстинская мадонна (путти)", when: "1512–1513", where: "Галерея старых мастеров, Дрезден" },
    melencolia: { src: "assets/ren/melencolia.jpg", who: "Альбрехт Дюрер", what: "Меланхолия I", when: "1514", where: "Метрополитен-музей" },
    annunciation: { src: "assets/ren/annunciation.jpg", who: "Фра Анджелико", what: "Благовещение", when: "1425–1426", where: "Музей Прадо, Мадрид" },
    vsStar: { src: "assets/ren/vs-star.jpg", who: "Бонифачо Бембо", what: "Звезда, таро Висконти-Сфорца", when: "XV век", where: "" },
    vsSun: { src: "assets/ren/vs-sun.jpg", who: "Бонифачо Бембо", what: "Солнце, таро Висконти-Сфорца", when: "XV век", where: "" },
    vsMoon: { src: "assets/ren/vs-moon.jpg", who: "Бонифачо Бембо", what: "Луна, таро Висконти-Сфорца", when: "XV век", where: "" },
    vsLovers: { src: "assets/ren/vs-lovers.jpg", who: "Бонифачо Бембо", what: "Влюблённые, таро Висконти-Сфорца", when: "XV век", where: "" },
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  // Картина в раме с музейной подписью
  function framed(key, opt = {}) {
    const p = P[key];
    const label = opt.label === false ? "" : `<figcaption class="label"><b>${esc(p.who)}</b><br>${esc(p.what)}, ${esc(p.when)}${p.where && !opt.short ? `<br>${esc(p.where)}` : ""}</figcaption>`;
    return `<figure style="margin:0" class="${opt.cls || ""}"><div class="frame ${opt.thin ? "thin" : ""}"${opt.style ? ` style="${opt.style}"` : ""}><img src="${p.src}" alt="${esc(p.what)}" loading="lazy"></div>${label}</figure>`;
  }
  window.ART = { P, framed };
})();
