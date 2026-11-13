/* =========================================================
   ICE BEAR — landing page (vanilla JS, không phụ thuộc thư viện)
   ========================================================= */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  /* ---------------------------------------------------------
     Gấu (SVG dùng chung cho hero + phần phỏng vấn)
  --------------------------------------------------------- */
  const bearSVG = (id) => `
  <svg class="bear" viewBox="0 0 300 380" role="img" aria-label="Ice Bear">
    <defs>
      <linearGradient id="bg-${id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d3e4f1"/>
      </linearGradient>
    </defs>
    <ellipse class="bear__leg bear__leg--l" cx="108" cy="352" rx="38" ry="20" fill="#dbe8f2"/>
    <ellipse class="bear__leg bear__leg--r" cx="192" cy="352" rx="38" ry="20" fill="#dbe8f2"/>
    <g class="bear__torso">
      <g class="bear__ear bear__ear--l"><circle cx="92" cy="54" r="25" fill="#f4f9fd"/><circle cx="92" cy="56" r="11" fill="#c9d9e6"/></g>
      <g class="bear__ear bear__ear--r"><circle cx="208" cy="54" r="25" fill="#f4f9fd"/><circle cx="208" cy="56" r="11" fill="#c9d9e6"/></g>
      <rect x="58" y="34" width="184" height="324" rx="92" fill="url(#bg-${id})"/>
      <ellipse cx="150" cy="268" rx="56" ry="68" fill="#ffffff" opacity=".75"/>
      <g class="bear__arm bear__arm--l"><ellipse cx="64" cy="238" rx="24" ry="62" fill="#f4f9fd" stroke="#d3e1ec" stroke-width="2" transform="rotate(9 64 238)"/></g>
      <g class="bear__arm bear__arm--r"><ellipse cx="236" cy="238" rx="24" ry="62" fill="#f4f9fd" stroke="#d3e1ec" stroke-width="2" transform="rotate(-9 236 238)"/></g>
      <ellipse cx="150" cy="150" rx="35" ry="26" fill="#ffffff"/>
      <g class="bear__eyes">
        <circle class="bear__eye" cx="117" cy="118" r="6.5" fill="#1b2433"/>
        <circle class="bear__eye" cx="183" cy="118" r="6.5" fill="#1b2433"/>
      </g>
      <ellipse cx="150" cy="139" rx="12" ry="8" fill="#1b2433"/>
      <path d="M150 147v9M141 161h18" stroke="#1b2433" stroke-width="3" stroke-linecap="round" fill="none"/>
    </g>
  </svg>`;

  $$('.bear-slot').forEach((slot) => { slot.outerHTML = bearSVG(slot.dataset.bear); });
  const bears = $$('.bear');

  /* ---------------------------------------------------------
     Tách chữ
  --------------------------------------------------------- */
  function splitWords(el, wrapCls, innerCls) {
    let i = 0;
    const walk = (node, extra) => {
      const frag = document.createDocumentFragment();
      node.childNodes.forEach((n) => {
        if (n.nodeType === 3) {
          n.textContent.split(/(\s+)/).forEach((tok) => {
            if (!tok) return;
            if (/^\s+$/.test(tok)) { frag.append(' '); return; }
            const w = document.createElement('span');
            w.className = wrapCls;
            if (innerCls) {
              const inner = document.createElement('span');
              inner.className = innerCls + (extra ? ' ' + extra : '');
              inner.style.setProperty('--i', i++);
              inner.textContent = tok;
              w.append(inner);
            } else {
              w.textContent = tok;
              i++;
            }
            frag.append(w);
          });
        } else if (n.tagName === 'BR') {
          frag.append(document.createElement('br'));
        } else {
          frag.append(walk(n, 'accent'));
        }
      });
      return frag;
    };
    const f = walk(el, '');
    el.textContent = '';
    el.append(f);
  }
  $$('[data-split]').forEach((el) => splitWords(el, 'w', 'w__i'));
  const manifesto = $('#manifesto');
  splitWords(manifesto, 'mw', null);
  const mWords = $$('.mw', manifesto);

  /* ---------------------------------------------------------
     Loader
  --------------------------------------------------------- */
  const loader = $('#loader');
  const loaderNum = $('#loaderNum');
  const loaderBar = $('#loaderBar');
  let assetsReady = false;
  const markReady = () => { assetsReady = true; };
  Promise.all([
    document.fonts ? document.fonts.ready : Promise.resolve(),
    new Promise((r) => (document.readyState === 'complete' ? r() : addEventListener('load', r, { once: true }))),
  ]).then(markReady);
  setTimeout(markReady, 3500);

  let lp = 0;
  function loadTick() {
    lp += assetsReady ? 2.6 : (lp < 82 ? 0.9 : 0);
    const v = Math.min(100, lp);
    loaderNum.textContent = Math.floor(v * 0.9);
    loaderBar.style.transform = `scaleX(${v / 100})`;
    if (v < 100) return requestAnimationFrame(loadTick);
    loader.classList.add('done');
    document.body.classList.remove('is-loading');
    document.body.classList.add('is-ready');
    measure();
    setTimeout(() => loader.remove(), 1300);
  }
  if (REDUCE) { lp = 100; assetsReady = true; }
  requestAnimationFrame(loadTick);

  /* ---------------------------------------------------------
     Reveal + counters
  --------------------------------------------------------- */
  const fmt = new Intl.NumberFormat('vi-VN');
  function runCount(el) {
    const to = +el.dataset.count;
    if (REDUCE) { el.textContent = fmt.format(to); return; }
    const t0 = performance.now();
    const dur = 2000;
    const step = (t) => {
      const p = clamp((t - t0) / dur);
      const e = 1 - Math.pow(2, -10 * p);
      el.textContent = fmt.format(Math.round(to * (p >= 1 ? 1 : e)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add('in');
      $$('[data-count]', en.target).forEach(runCount);
      io.unobserve(en.target);
    });
  }, { threshold: 0.18, rootMargin: '0px 0px -6% 0px' });
  $$('[data-reveal], [data-split]').forEach((el) => io.observe(el));

  /* ---------------------------------------------------------
     Con trỏ + nút hút nam châm + thẻ nghiêng 3D
  --------------------------------------------------------- */
  const pointer = { x: innerWidth / 2, y: innerHeight / 2, nx: 0, ny: 0, sx: 0, sy: 0, vx: 0 };
  let lastPX = pointer.x;
  addEventListener('pointermove', (e) => {
    pointer.x = e.clientX; pointer.y = e.clientY;
    pointer.nx = e.clientX / innerWidth * 2 - 1;
    pointer.ny = e.clientY / innerHeight * 2 - 1;
  }, { passive: true });

  const cursorEl = $('.cursor');
  const cDot = $('.cursor__dot');
  const cRing = $('.cursor__ring');
  const ring = { x: pointer.x, y: pointer.y };
  if (FINE && !REDUCE) {
    document.documentElement.classList.add('has-cursor');
    const hoverSel = 'a, button, [role="button"], [data-tilt], .bear';
    document.addEventListener('pointerover', (e) => { if (e.target.closest(hoverSel)) cursorEl.classList.add('is-hover'); });
    document.addEventListener('pointerout', (e) => { if (e.target.closest(hoverSel)) cursorEl.classList.remove('is-hover'); });
    addEventListener('pointerdown', () => cursorEl.classList.add('is-down'));
    addEventListener('pointerup', () => cursorEl.classList.remove('is-down'));
    document.addEventListener('mouseleave', () => cursorEl.classList.add('is-hidden'));
    document.addEventListener('mouseenter', () => cursorEl.classList.remove('is-hidden'));

    $$('[data-magnetic]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${dx * 0.3}px, ${dy * 0.4}px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });

    $$('[data-tilt]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        el.style.setProperty('--ry', `${(px - 0.5) * 18}deg`);
        el.style.setProperty('--rx', `${(0.5 - py) * 14}deg`);
        el.style.setProperty('--gx', `${px * 100}%`);
        el.style.setProperty('--gy', `${py * 100}%`);
      });
      el.addEventListener('pointerleave', () => {
        el.style.setProperty('--ry', '0deg');
        el.style.setProperty('--rx', '0deg');
      });
    });
  }

  /* ---------------------------------------------------------
     Sao + cực quang (canvas)
  --------------------------------------------------------- */
  const hero = $('.hero');
  const starsC = $('#stars');
  const auroraC = $('#aurora');
  const actx = auroraC.getContext('2d');
  const bands = [
    { c: '94,255,193', y: 0.2, h: 0.62, s: 0.00024, f: 1.3, a: 0.95 },
    { c: '76,201,240', y: 0.1, h: 0.55, s: 0.00018, f: 0.9, a: 0.6 },
    { c: '167,139,250', y: 0.04, h: 0.5, s: 0.00014, f: 1.7, a: 0.5 },
  ];
  let aw = 0, ah = 0, grads = [];

  function drawStars() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = starsC.width = hero.clientWidth * dpr;
    const h = starsC.height = hero.clientHeight * dpr;
    const ctx = starsC.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    const n = Math.round(w * h / (5200 * dpr * dpr));
    for (let i = 0; i < n; i++) {
      const y = Math.pow(Math.random(), 1.6) * h * 0.72;
      const r = (Math.random() < 0.06 ? 1.6 : Math.random() * 0.9 + 0.2) * dpr;
      ctx.globalAlpha = Math.random() * 0.7 + 0.2;
      ctx.fillStyle = Math.random() < 0.2 ? '#bfe6ff' : '#ffffff';
      ctx.beginPath(); ctx.arc(Math.random() * w, y, r, 0, 6.283); ctx.fill();
    }
  }
  function sizeAurora() {
    aw = auroraC.width = Math.max(120, Math.ceil(hero.clientWidth / 5));
    ah = auroraC.height = Math.max(80, Math.ceil(auroraC.clientHeight / 5));
    grads = bands.map((b) => {
      const g = actx.createLinearGradient(0, 0, 0, 1);
      g.addColorStop(0, `rgba(${b.c},0)`);
      g.addColorStop(0.22, `rgba(${b.c},.95)`);
      g.addColorStop(1, `rgba(${b.c},0)`);
      return g;
    });
  }
  function drawAurora(t) {
    actx.setTransform(1, 0, 0, 1, 0, 0);
    actx.clearRect(0, 0, aw, ah);
    actx.globalCompositeOperation = 'lighter';
    for (let bi = 0; bi < bands.length; bi++) {
      const b = bands[bi];
      const tt = t * b.s;
      actx.fillStyle = grads[bi];
      for (let x = 0; x < aw; x++) {
        const nx = x / aw;
        const wave = Math.sin(nx * 6 * b.f + tt * 3) + Math.sin(nx * 13 * b.f - tt * 5) * 0.5 + Math.sin(nx * 29 + tt * 9) * 0.25;
        const streak = 0.5 + 0.5 * Math.sin(nx * 80 * b.f + tt * 14 + Math.sin(nx * 18 + tt * 4) * 3);
        const env = 0.5 + 0.5 * Math.sin(nx * 3.2 + tt * 2 + bi * 2.1);
        const a = b.a * (0.3 + 0.7 * streak) * env;
        if (a < 0.02) continue;
        actx.globalAlpha = a;
        actx.setTransform(1, 0, 0, b.h * ah * (0.55 + 0.45 * streak), x, (b.y + wave * 0.07) * ah);
        actx.fillRect(0, 0, 1, 1);
      }
    }
  }

  /* ---------------------------------------------------------
     Tuyết (canvas toàn trang)
  --------------------------------------------------------- */
  const snowC = $('#snow');
  const sctx = snowC.getContext('2d');
  let sw = 0, sh = 0, sdpr = 1, flakes = [];
  function sizeSnow() {
    sdpr = Math.min(devicePixelRatio || 1, 1.5);
    sw = innerWidth; sh = innerHeight;
    snowC.width = sw * sdpr; snowC.height = sh * sdpr;
    const n = REDUCE ? 0 : Math.round(clamp(sw / 11, 40, 150));
    flakes = Array.from({ length: n }, () => newFlake(true));
  }
  function newFlake(anywhere) {
    const z = Math.random();
    return {
      x: Math.random() * sw,
      y: anywhere ? Math.random() * sh : -10,
      z,
      r: 0.6 + z * 2.6,
      vy: 0.35 + z * 1.5,
      ph: Math.random() * 6.283,
      o: 0.25 + z * 0.65,
    };
  }
  let wind = 0;
  function drawSnow(t, scrollVel, k) {
    sctx.setTransform(sdpr, 0, 0, sdpr, 0, 0);
    sctx.clearRect(0, 0, sw, sh);
    sctx.fillStyle = '#fff';
    wind = lerp(wind, clamp(pointer.vx * 0.06, -5, 5) + 0.35, 0.04);
    for (const f of flakes) {
      f.y += (f.vy - scrollVel * 0.06 * (0.3 + f.z)) * k;
      f.x += (wind * (0.3 + f.z) + Math.sin(t * 0.001 + f.ph) * 0.35) * k;
      if (f.y > sh + 10) { f.y = -10; f.x = Math.random() * sw; }
      else if (f.y < -20) { f.y = sh + 10; }
      if (f.x > sw + 10) f.x = -10; else if (f.x < -10) f.x = sw + 10;
      sctx.globalAlpha = f.o;
      sctx.beginPath(); sctx.arc(f.x, f.y, f.r, 0, 6.283); sctx.fill();
    }
  }

  /* ---------------------------------------------------------
     Marquee
  --------------------------------------------------------- */
  const marq = $$('.marquee__row').map((row) => {
    const track = $('.marquee__track', row);
    const base = track.innerHTML;
    track.innerHTML = base + base;          // một "nửa" đủ rộng
    const half = track.innerHTML;
    track.innerHTML = half + half;          // nhân đôi để lặp vô tận
    return { el: track, dir: +row.dataset.dir, x: 0, half: 1 };
  });

  /* ---------------------------------------------------------
     Bong bóng dưới nước
  --------------------------------------------------------- */
  const bubbles = $('#bubbles');
  if (!REDUCE) {
    for (let i = 0; i < 22; i++) {
      const s = document.createElement('span');
      const size = 6 + Math.random() * 22;
      s.style.cssText = `left:${Math.random() * 100}%;width:${size}px;height:${size}px;--dx:${(Math.random() - 0.5) * 120}px;animation-duration:${7 + Math.random() * 9}s;animation-delay:${-Math.random() * 16}s;opacity:${0.3 + Math.random() * 0.5}`;
      bubbles.append(s);
    }
  }

  /* ---------------------------------------------------------
     Tủ lạnh
  --------------------------------------------------------- */
  const fridge = $('#fridgeBox');
  const fridgeBtn = $('#fridgeBtn');
  const fridgeNote = $('#fridgeNote');
  const openNotes = ['Suỵt. Ice Bear đang ngủ.', 'Ice Bear hé một mắt. Ice Bear ngủ tiếp.', 'Hơi lạnh đang thoát ra ngoài. Ice Bear không vui.'];
  let fridgeOpens = 0;
  function toggleFridge() {
    const open = fridge.classList.toggle('open');
    fridgeBtn.setAttribute('aria-expanded', open);
    $('span', fridgeBtn).textContent = open ? 'Đóng lại (nhẹ thôi)' : 'Mở tủ lạnh';
    fridgeNote.textContent = open ? openNotes[fridgeOpens++ % openNotes.length] : 'Ice Bear cảm ơn.';
  }
  fridge.addEventListener('click', toggleFridge);
  fridge.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleFridge(); } });
  fridgeBtn.addEventListener('click', toggleFridge);

  /* ---------------------------------------------------------
     Phỏng vấn Ice Bear
  --------------------------------------------------------- */
  const lines = [
    'Ice Bear đồng ý.',
    'Ice Bear không có điểm yếu.',
    'Ice Bear đã nấu xong bữa tối.',
    'Ice Bear thích trang web này.',
    'Ice Bear cần thêm đá.',
    'Ice Bear tin bạn.',
    'Ice Bear ngủ trong tủ lạnh. Đừng hỏi.',
    'Ice Bear thấy hôm nay hơi nóng.',
    'Ice Bear không bình luận.',
    'Ice Bear sẽ ghi nhớ chuyện này.',
    'Ice Bear nghĩ bạn nên uống nước.',
    'Ice Bear đã sửa xong lỗi đó từ hôm qua.',
  ];
  const talkText = $('#talkText');
  const talkBear = $('#talkBear .bear');
  let lineIdx = -1, typeTimer = 0;
  function say() {
    let n;
    do { n = Math.floor(Math.random() * lines.length); } while (n === lineIdx);
    lineIdx = n;
    const txt = lines[n];
    clearInterval(typeTimer);
    if (talkBear) {
      talkBear.classList.remove('is-boop', 'is-wave');
      void talkBear.getBoundingClientRect();
      talkBear.classList.add('is-boop', 'is-wave');
    }
    if (REDUCE) { talkText.textContent = txt; return; }
    let i = 0;
    talkText.textContent = '';
    typeTimer = setInterval(() => {
      talkText.textContent = txt.slice(0, ++i);
      if (i >= txt.length) clearInterval(typeTimer);
    }, 32);
  }
  $('#talkBtn').addEventListener('click', say);
  if (talkBear) talkBear.addEventListener('click', say);
  const heroBear = $('.floe .bear');
  if (heroBear) heroBear.addEventListener('click', () => {
    heroBear.classList.remove('is-wave');
    void heroBear.getBoundingClientRect();
    heroBear.classList.add('is-wave');
  });

  /* ---------------------------------------------------------
     Đo đạc layout
  --------------------------------------------------------- */
  const els = {
    hero,
    heroPin: $('#heroPin'),
    about: $('#manifesto'),
    skills: $('#skills'),
    dive: $('#dive'),
    arctic: $('#arcticViz'),
  };
  const M = {};
  let vw = innerWidth, vh = innerHeight, docH = 1, skillsDist = 0;
  const skillsTrack = $('#skillsTrack');
  const diveBear = $('#diveBear');
  let diveBearW = 300;

  function measure() {
    vw = innerWidth; vh = innerHeight;
    const y = scrollY;
    for (const k in els) {
      const r = els[k].getBoundingClientRect();
      M[k] = { top: r.top + y, h: r.height };
    }
    docH = document.documentElement.scrollHeight - vh;
    skillsDist = Math.max(0, skillsTrack.scrollWidth - vw);
    diveBearW = diveBear.offsetWidth;
    marq.forEach((m) => { m.half = m.el.scrollWidth / 2; });
  }
  function onResize() {
    drawStars(); sizeAurora(); sizeSnow(); measure();
  }
  let rT = 0;
  addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(onResize, 120); });
  addEventListener('load', measure);
  if (document.fonts) document.fonts.ready.then(measure);
  onResize();

  /* ---------------------------------------------------------
     Vòng lặp chính
  --------------------------------------------------------- */
  const nav = $('#nav');
  const progress = $('#progress');
  const parallax = $$('[data-px]').map((el) => ({ el, mx: +el.dataset.mx || 0, z: +el.dataset.z || 0, ty: +el.dataset.ty || 0, pow: +el.dataset.pow || 1.6 }));
  const titleWrap = $('.hero__title-wrap');
  const titleEl = $('.hero__title');
  const heroWhite = $('#heroWhite');
  const heroCopy = $('.hero__copy');
  const heroHint = $('.hero__hint');
  const skillsBar = $('#skillsBar');
  const diveDark = $('#diveDark');
  const diveHead = $('#diveHead');
  const diveDepth = $('#diveDepth');
  const diveTime = $('#diveTime');
  const diveCaps = $$('.dive__cap');
  const arcticIce = $('#arcticIce');
  const arcticYear = $('#arcticYear');

  let sy = scrollY, lastRawY = scrollY, navHidden = false, lastT = 0;
  // hệ số lerp độc lập với tần số quét (60/120/144Hz cho cảm giác như nhau)
  const ease = (k, f) => 1 - Math.pow(1 - k, f);
  let lastDepth = '', lastTime = '', lastYear = '';

  function frame(t) {
    const f = clamp((t - (lastT || t)) / 16.667, 0.25, 6);
    lastT = t;
    const raw = scrollY;
    const prev = sy;
    sy = REDUCE ? raw : lerp(sy, raw, ease(FINE ? 0.24 : 0.11, f));
    if (Math.abs(raw - sy) < 0.05) sy = raw;
    const vel = (sy - prev) / f;

    // pointer smoothing
    pointer.sx = lerp(pointer.sx, pointer.nx, ease(0.06, f));
    pointer.sy = lerp(pointer.sy, pointer.ny, ease(0.06, f));
    pointer.vx = pointer.x - lastPX; lastPX = pointer.x;

    // cursor
    if (FINE && !REDUCE) {
      ring.x = lerp(ring.x, pointer.x, ease(0.16, f));
      ring.y = lerp(ring.y, pointer.y, ease(0.16, f));
      cDot.style.transform = `translate3d(${pointer.x}px,${pointer.y}px,0)`;
      cRing.style.transform = `translate3d(${ring.x}px,${ring.y}px,0)`;
    }

    // progress + nav
    progress.style.transform = `scaleX(${clamp(raw / docH)})`;
    if (raw !== lastRawY) {
      const down = raw > lastRawY && raw > 300;
      if (down !== navHidden) { navHidden = down; nav.classList.toggle('is-hidden', down); }
      nav.classList.toggle('is-solid', raw > 60);
      lastRawY = raw;
    }

    // HERO
    // camera lao về phía gấu, zoom xuyên vào bụng trắng rồi hoà vào section kế tiếp
    const heroRange = M.heroPin.h - vh;
    const heroOn = sy < heroRange + vh;
    if (heroOn) {
      const hp = clamp(sy / heroRange);
      if (!REDUCE && hp < 0.97) drawAurora(t);
      const calm = 1 - hp;
      for (const p of parallax) {
        const e = Math.pow(hp, p.pow);
        p.el.style.transform = `translate3d(${pointer.sx * p.mx * calm}px,${e * p.ty * vh + pointer.sy * p.mx * 0.5 * calm}px,0) scale(${1 + e * p.z})`;
      }
      titleWrap.style.opacity = clamp(1 - hp / 0.5);
      titleEl.style.letterSpacing = `${-0.035 + hp * 0.3}em`;
      heroWhite.style.opacity = clamp((hp - 0.68) / 0.26);
      heroCopy.style.opacity = clamp(1 - hp * 5);
      heroHint.style.visibility = hp > 0.12 ? 'hidden' : '';
    }

    // mắt gấu nhìn theo chuột
    if (FINE && !REDUCE) {
      for (const b of bears) {
        const r = b.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) continue;
        const cx = r.left + r.width / 2, cy = r.top + r.height * 0.31;
        const dx = pointer.x - cx, dy = pointer.y - cy;
        const d = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, d / 260) * 4.5;
        b._ex = lerp(b._ex || 0, dx / d * k, 0.12);
        b._ey = lerp(b._ey || 0, dy / d * k, 0.12);
        $('.bear__eyes', b).style.transform = `translate(${b._ex}px,${b._ey}px)`;
      }
    }

    // MARQUEE
    if (!REDUCE) {
      for (const m of marq) {
        m.x += m.dir * (0.7 + Math.abs(vel) * 0.45) * f;
        if (m.x <= -m.half) m.x += m.half;
        if (m.x > 0) m.x -= m.half;
        m.el.style.transform = `translate3d(${m.x}px,0,0) skewX(${clamp(vel * -0.25, -8, 8)}deg)`;
      }
    }

    // MANIFESTO – chữ sáng dần theo cuộn
    if (!REDUCE) {
      const a = M.about;
      const p = clamp((sy + vh * 0.78 - a.top) / (a.h + vh * 0.25));
      const n = mWords.length;
      const head = p * (n + 6);
      for (let i = 0; i < n; i++) mWords[i].style.opacity = 0.12 + 0.88 * clamp((head - i) / 6);
    }

    // SKILLS – cuộn ngang
    {
      const s = M.skills;
      const p = clamp((sy - s.top) / (s.h - vh));
      skillsTrack.style.transform = `translate3d(${-p * skillsDist}px,0,0)`;
      skillsBar.style.transform = `scaleX(${p})`;
    }

    // DIVE
    {
      const d = M.dive;
      const p = clamp((sy - d.top) / (d.h - vh));
      const near = sy > d.top - vh && sy < d.top + d.h;
      if (near) {
        diveDark.style.opacity = p * 0.92;
        const hp = clamp(p / 0.14);
        diveHead.style.opacity = 1 - hp;
        diveHead.style.transform = `translateY(calc(-50% - ${hp * 80}px)) scale(${1 + hp * 0.08})`;

        const bp = clamp((p - 0.04) / 0.92);
        const x = lerp(-diveBearW * 1.1, vw + diveBearW * 0.1, bp);
        const amp = vh * 0.12;
        const y = vh * 0.4 + Math.sin(bp * Math.PI * 3) * amp + bp * vh * 0.06;
        const slope = Math.atan2(Math.cos(bp * Math.PI * 3) * amp * Math.PI * 3, vw + diveBearW * 1.2);
        diveBear.style.transform = `translate3d(${x}px,${y - diveBearW * 0.25}px,0) rotate(${slope}rad)`;

        const depth = (p * 13.6).toFixed(1);
        if (depth !== lastDepth) { diveDepth.textContent = lastDepth = depth; }
        const secs = Math.round(p * 190);
        const tm = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
        if (tm !== lastTime) { diveTime.textContent = lastTime = tm; }

        diveCaps.forEach((c, i) => {
          const c0 = 0.14 + i * 0.28;
          const lp = (p - c0) / 0.26;               // 0..1 trong khoảng hiển thị
          const o = lp < 0 || lp > 1 ? 0 : Math.min(1, Math.min(lp, 1 - lp) * 5);
          c.style.opacity = i === 2 && p > 0.9 ? Math.max(o, clamp((1 - p) * 10)) : o;
          c.style.transform = `translate3d(0,${(0.5 - clamp(lp)) * 50}px,0)`;
        });
      }
      // tuyết mờ đi khi ở dưới nước
      const fadeIn = clamp((sy + vh * 0.4 - d.top) / (vh * 0.4));
      const fadeOut = clamp((d.top + d.h - vh * 0.3 - sy) / (vh * 0.4));
      snowC.style.opacity = 1 - Math.min(fadeIn, fadeOut);
    }

    // ARCTIC – băng co lại
    {
      const a = M.arctic;
      const p = clamp((sy + vh * 0.85 - a.top) / (a.h + vh * 0.45));
      arcticIce.style.transform = `scale(${lerp(1, 0.5, p)}) rotate(${p * -10}deg)`;
      const yr = String(Math.round(lerp(1979, 2026, p)));
      if (yr !== lastYear) arcticYear.textContent = lastYear = yr;
    }

    if (!REDUCE && snowC.style.opacity !== '0') drawSnow(t, vel, f);

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
