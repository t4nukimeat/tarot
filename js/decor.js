// Декор: стеклянные звёздочки, рукописные спирали, фото в «кляксах».
(function () {
  let seed = 20261007;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const COLORS = ["#e24a45", "#3fae5a", "#3d6fd6", "#f0bd2a", "#2fb4c8", "#ec78a8", "#8a6ee0"];
  let uid = 0;

  // Скруглённая пятиконечная звезда с бликом
  function star(color) {
    const id = "sg" + (uid++);
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 19 : 46, a = -Math.PI / 2 + i * Math.PI / 5;
      pts.push([50 + r * Math.cos(a), 52 + r * Math.sin(a)]);
    }
    // сглаживаем углы квадратичными кривыми
    let d = "";
    pts.forEach((p, i) => {
      const n = pts[(i + 1) % 10], m = [(p[0] + n[0]) / 2, (p[1] + n[1]) / 2];
      d += (i ? " Q" : "M" + ((pts[9][0] + p[0]) / 2) + " " + ((pts[9][1] + p[1]) / 2) + " Q") + `${p[0].toFixed(1)} ${p[1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`;
    });
    return `<svg viewBox="0 0 100 100"><defs><radialGradient id="${id}" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".28" stop-color="${color}"/><stop offset="1" stop-color="${color}" stop-opacity=".95"/></radialGradient></defs>
      <path d="${d} Z" fill="url(#${id})" stroke="rgba(0,0,0,.18)" stroke-width="1.5" stroke-linejoin="round"/>
      <ellipse cx="40" cy="36" rx="9" ry="5" fill="#fff" opacity=".75" transform="rotate(-30 40 36)"/></svg>`;
  }

  // Рукописная спираль (Архимедова, с лёгким дрожанием)
  function spiralPath(cx, cy, maxR, turns, wobble) {
    const N = 140; let d = "";
    for (let i = 0; i <= N; i++) {
      const t = i / N, a = t * turns * 2 * Math.PI;
      const r = 4 + maxR * t + Math.sin(a * 3.1) * wobble;
      const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
      d += (i ? " L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
    }
    return d;
  }
  // Органическая клякса
  function blobPath(cx, cy, r, k) {
    const N = 9, pts = [];
    for (let i = 0; i < N; i++) {
      const a = i / N * 2 * Math.PI, rr = r * (0.84 + 0.3 * rnd() * k);
      pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
    }
    let d = "";
    pts.forEach((p, i) => {
      const n = pts[(i + 1) % N], m = [(p[0] + n[0]) / 2, (p[1] + n[1]) / 2];
      if (!i) { const l = pts[N - 1]; d += `M${((l[0] + p[0]) / 2).toFixed(1)} ${((l[1] + p[1]) / 2).toFixed(1)}`; }
      d += ` Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`;
    });
    return d + "Z";
  }
  // Фото внутри кляксы, сверху белая спираль
  function blob(img, opt = {}) {
    const id = "bc" + (uid++);
    const spiral = opt.spiral === false ? "" :
      `<path d="${spiralPath(100, 100, 62, 2.6, 2.5)}" fill="none" stroke="#fff" stroke-width="${opt.sw || 15}" stroke-linecap="round" stroke-linejoin="round" opacity=".95"/>`;
    return `<svg viewBox="0 0 200 200"><defs><clipPath id="${id}"><path d="${blobPath(100, 100, 88, 1)}"/></clipPath></defs>
      <image href="${img}" x="-20" y="-20" width="240" height="240" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>${spiral}</svg>`;
  }

  function scatterStars(box, n, opt = {}) {
    for (let i = 0; i < n; i++) {
      const s = document.createElement("span");
      s.className = "star";
      const size = (opt.min || 12) + rnd() * ((opt.max || 30) - (opt.min || 12));
      let x = rnd() * 100;
      if (opt.edges) x = rnd() < 0.5 ? rnd() * 7 : 93 + rnd() * 6.5;
      s.style.cssText = `left:${x}%;top:${(opt.top || 0) + rnd() * (opt.h || 100)}%;width:${size}px;height:${size}px;--r:${(rnd() * 60 - 30).toFixed(0)}deg;animation-delay:${(-rnd() * 5).toFixed(1)}s;animation-duration:${(4 + rnd() * 4).toFixed(1)}s`;
      s.innerHTML = star(COLORS[Math.floor(rnd() * COLORS.length)]);
      box.append(s);
    }
  }

  function init() {
    const layer = document.createElement("div");
    layer.className = "sky-layer";
    document.body.prepend(layer);
    scatterStars(layer, 26, { edges: true, min: 12, max: 26 });
    const hero = document.querySelector(".hero-inner");
    if (hero) {
      scatterStars(hero, 16, { min: 14, max: 30, top: 5, h: 60 });
      hero.querySelectorAll(".doodle").forEach(el => { el.innerHTML = `<svg viewBox="0 0 200 200"><path d="${spiralPath(100, 100, 80, 2.3, 3)}" fill="none" stroke="#fff" stroke-width="11" stroke-linecap="round" opacity=".9"/></svg>`; });
      hero.querySelectorAll("[data-blob]").forEach(el => { el.innerHTML = blob(el.dataset.blob, { sw: +el.dataset.sw || 15 }); });
    }
  }

  window.DECOR = { star, blob, spiralPath, scatterStars };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
