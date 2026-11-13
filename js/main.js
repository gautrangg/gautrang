/* =========================================================
   ICE BEAR — bản tư liệu thật · kịch bản trang
   Nguyên tắc hiệu năng:
   - Cuộn hoàn toàn bằng trình duyệt (không chặn bánh xe chuột).
   - Mỗi khung hình chỉ ghi transform/opacity, không đọc layout.
   - Chỉ cập nhật section đang nằm trong màn hình, và chỉ khi vị trí cuộn đổi.
   - Máy yếu: tự hạ chất lượng hiệu ứng (FX.quality).
   ========================================================= */
(() => {
  'use strict';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ss = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const FX = window.FX;
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (!REDUCE) document.documentElement.style.scrollBehavior = 'smooth';   // chỉ áp dụng cho bấm menu

  /* ---------- tách chữ ---------- */
  function splitWords(el, wrapCls, innerCls) {
    let i = 0;
    const walk = (node, extra) => {
      const frag = document.createDocumentFragment();
      node.childNodes.forEach((n) => {
        if (n.nodeType === 3) {
          n.textContent.split(/(\s+)/).forEach((tok) => {
            if (!tok) return;
            if (/^\s+$/.test(tok)) { frag.append(' '); return; }
            const w = document.createElement('span'); w.className = wrapCls;
            if (innerCls) { const inner = document.createElement('span'); inner.className = innerCls + (extra ? ' ' + extra : ''); inner.style.setProperty('--i', i++); inner.textContent = tok; w.append(inner); }
            else w.textContent = tok;
            frag.append(w);
          });
        } else if (n.tagName === 'BR') frag.append(document.createElement('br'));
        else frag.append(walk(n, 'accent'));
      });
      return frag;
    };
    const f = walk(el, ''); el.textContent = ''; el.append(f);
  }
  $$('[data-split]').forEach((el) => splitWords(el, 'w', 'w__i'));
  const manifesto = $('#manifesto'); splitWords(manifesto, 'mw', null);
  const mWords = $$('.mw', manifesto);
  $$('.footer__big span').forEach((s, i) => s.style.setProperty('--i', i));

  /* ---------- loader ---------- */
  const loader = $('#loader'), loaderNum = $('#loaderNum'), loaderBar = $('#loaderBar');
  let assetsReady = false; const markReady = () => { assetsReady = true; };
  const heroImg = new Image(); heroImg.src = 'assets/hero-1920.jpg';
  Promise.all([
    document.fonts ? document.fonts.ready : 0,
    new Promise((r) => { if (heroImg.complete) r(); else { heroImg.onload = heroImg.onerror = r; } }),
  ]).then(markReady);
  setTimeout(markReady, 4000);
  let lp = REDUCE ? 100 : 0, readyAt = 0;
  (function loadTick() {
    lp += assetsReady ? 2.4 : (lp < 70 ? 0.8 : 0);
    const v = Math.min(100, lp);
    loaderNum.textContent = Math.floor(v * 0.81);
    loaderBar.style.transform = `scaleX(${v / 100})`;
    if (v < 100) return requestAnimationFrame(loadTick);
    loader.classList.add('done');
    document.body.classList.remove('is-loading'); document.body.classList.add('is-ready');
    readyAt = performance.now();
    measure();
    setTimeout(() => loader.remove(), 1700);
    setTimeout(predecode, 1800);
  })();

  // giải mã sẵn toàn bộ ảnh lúc rảnh, để khi cuộn tới không bị khựng vì giải mã
  function predecode() {
    const imgs = $$('main img'); let i = 0;
    const next = () => {
      const img = imgs[i++]; if (!img) { measure(); return; }
      img.loading = 'eager';
      (img.decode ? img.decode() : Promise.resolve()).catch(() => {}).then(() => setTimeout(next, 60));
    };
    next();
  }

  /* ---------- reveal / đếm số / video ---------- */
  const fmt = new Intl.NumberFormat('vi-VN');
  function runCount(el) {
    const to = +el.dataset.count;
    if (REDUCE) { el.textContent = fmt.format(to); return; }
    const t0 = performance.now();
    const step = (t) => { const p = clamp((t - t0) / 2200); el.textContent = fmt.format(Math.round(to * (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)))); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (!en.isIntersecting) return;
    en.target.classList.add('in'); $$('[data-count]', en.target).forEach(runCount); io.unobserve(en.target);
  }), { threshold: 0.16, rootMargin: '0px 0px -6% 0px' });
  $$('[data-reveal], [data-split], [data-ph], .footer').forEach((el) => io.observe(el));
  const vio = new IntersectionObserver((entries) => entries.forEach((en) => {
    const v = en.target;
    if (en.isIntersecting && !REDUCE) { const p = v.play(); if (p) p.catch(() => {}); } else v.pause();
  }), { threshold: 0.05 });
  $$('video').forEach((v) => vio.observe(v));

  /* ---------- con trỏ / nam châm ---------- */
  const pointer = { x: innerWidth / 2, y: innerHeight / 2, vx: 0 };
  let lastPX = pointer.x;
  addEventListener('pointermove', (e) => { pointer.x = e.clientX; pointer.y = e.clientY; }, { passive: true });
  const cursorEl = $('.cursor'), cDot = $('.cursor__dot'), cRing = $('.cursor__ring');
  const ring = { x: pointer.x, y: pointer.y };
  if (FINE && !REDUCE) {
    document.documentElement.classList.add('has-cursor');
    document.addEventListener('pointerover', (e) => cursorEl.classList.toggle('is-hover', !!e.target.closest('a, button, summary, .shot')));
    addEventListener('pointerdown', () => cursorEl.classList.add('is-down'));
    addEventListener('pointerup', () => cursorEl.classList.remove('is-down'));
    document.addEventListener('mouseleave', () => cursorEl.classList.add('is-hidden'));
    document.addEventListener('mouseenter', () => cursorEl.classList.remove('is-hidden'));
    $$('[data-magnetic]').forEach((el) => {
      let r = null;
      el.addEventListener('pointerenter', () => { r = el.getBoundingClientRect(); });
      el.addEventListener('pointermove', (e) => { if (r) el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.3}px, ${(e.clientY - r.top - r.height / 2) * 0.4}px)`; });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; r = null; });
    });
  }

  /* ---------- marquee ---------- */
  const marq = $$('.marquee__row').map((row) => {
    const track = $('.marquee__track', row); const base = track.innerHTML;
    track.innerHTML = base + base + base + base;
    return { el: track, dir: +row.dataset.dir, x: 0, half: 1 };
  });

  /* ---------- bong bóng ---------- */
  const bubbles = $('#bubbles');
  if (!REDUCE) for (let i = 0; i < 16; i++) {
    const s = document.createElement('span'); const size = 4 + Math.random() * Math.random() * 30;
    s.style.cssText = `left:${Math.random() * 100}%;width:${size}px;height:${size}px;--dx:${(Math.random() - 0.5) * 140}px;animation-duration:${6 + Math.random() * 9}s;animation-delay:${-Math.random() * 15}s;opacity:${0.35 + Math.random() * 0.5}`;
    bubbles.append(s);
  }

  /* ---------- hỏi Ice Bear ---------- */
  const lines = ['Ice Bear đồng ý.', 'Ice Bear không có điểm yếu.', 'Ice Bear thích trời lạnh hơn.', 'Ice Bear đã đi bộ cả ngày.', 'Ice Bear cần thêm băng.', 'Ice Bear tin bạn.', 'Ice Bear không bình luận.', 'Ice Bear sẽ ghi nhớ chuyện này.', 'Ice Bear nghĩ bạn nên mặc ấm.', 'Ice Bear thấy cực quang đêm nay đẹp.', 'Ice Bear bơi giỏi hơn bạn.', 'Ice Bear không lạnh. Ice Bear là lạnh.'];
  const talkText = $('#talkText'); let lineIdx = -1, typeTimer = 0;
  $('#talkBtn').addEventListener('click', () => {
    let n; do { n = Math.floor(Math.random() * lines.length); } while (n === lineIdx);
    lineIdx = n; const txt = lines[n]; clearInterval(typeTimer);
    if (FX.live.aurora) FX.live.aurora.amp = 4;                    // cực quang bùng lên khi Ice Bear trả lời
    if (REDUCE) { talkText.textContent = txt; return; }
    let i = 0; talkText.textContent = '';
    typeTimer = setInterval(() => { talkText.textContent = txt.slice(0, ++i); if (i >= txt.length) clearInterval(typeTimer); }, 34);
  });

  /* ---------- tiếng gió ---------- */
  const soundBtn = $('#soundBtn'), soundLbl = $('#soundLbl');
  soundBtn.addEventListener('click', () => {
    const on = FX.sound.toggle();
    soundBtn.classList.toggle('is-on', on); soundBtn.setAttribute('aria-pressed', on);
    soundLbl.textContent = on ? 'Tắt tiếng gió' : 'Bật tiếng gió';
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && FX.sound.on) soundBtn.click(); });

  /* ---------- đo đạc (chỉ khi tải xong / đổi kích thước) ---------- */
  const els = { heroPin: $('#heroPin'), marq: $('.marquee'), about: $('#about'), text: manifesto, gallery: $('#gallery'), film: $('#film'), dive: $('#dive'), rest: $('#rest'), arctic: $('#arcticViz') };
  const M = {}; let vw = innerWidth, vh = innerHeight, docH = 1, galleryDist = 0, dirty = true;
  const galleryTrack = $('#galleryTrack');
  const shots = $$('.shot').map((el) => ({ el, img: $('img', el), x: 0, w: 0 }));
  const phs = $$('[data-par]').map((el) => ({ el, img: $('img', el), k: +el.dataset.par, top: 0, h: 0 }));
  function measure() {
    vw = innerWidth; vh = innerHeight; const y = scrollY;
    for (const k in els) { const r = els[k].getBoundingClientRect(); M[k] = { top: r.top + y, h: r.height }; }
    docH = document.documentElement.scrollHeight - vh;
    galleryDist = Math.max(0, galleryTrack.scrollWidth - vw);
    shots.forEach((s) => { s.x = s.el.offsetLeft; s.w = s.el.offsetWidth; });
    phs.forEach((p) => { const r = p.el.getBoundingClientRect(); p.top = r.top + y; p.h = r.height; });
    marq.forEach((m) => { m.half = m.el.scrollWidth / 4; });
    dirty = true;
  }
  let rT = 0; addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(measure, 150); });
  addEventListener('load', measure); if (document.fonts) document.fonts.ready.then(measure);
  measure();
  const inView = (m, y, pad = 0) => y + vh + pad > m.top && y - pad < m.top + m.h;

  /* ---------- bộ tự điều chỉnh chất lượng ---------- */
  let tier = ((navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4) ? 1 : 0;
  FX.quality(tier);
  let ema = 16.7, slow = 0, cool = 0;
  function govern(dt) {
    if (dt > 250 || document.hidden || !readyAt || performance.now() - readyAt < 2500) return;
    ema = lerp(ema, dt, 0.06);
    if (cool > 0) { cool--; return; }
    slow = ema > 21 ? slow + 1 : Math.max(0, slow - 2);
    if (slow > 70 && tier < 2) { tier++; FX.quality(tier); slow = 0; cool = 150; ema = 16.7; }
  }

  /* ---------- vòng lặp chính ---------- */
  const nav = $('#nav'), progress = $('#progress');
  const heroHead = $('#heroHead'), heroQuote = $('#heroQuote'), heroFoot = $('.hero__foot'), heroShade = $('.hero__shade'), heroMedia = $('.hero__media');
  const galleryBar = $('#galleryBar');
  const filmFrame = $('#filmFrame'), filmVideo = $('#filmVideo'), filmTitle = $$('#filmTitle span'), filmOver = $('#filmOver'), filmShade = $('.film__shade'), filmHud = $('.film__hud'), filmTime = $('#filmTime');
  const diveTop = $('.dive__top'), diveUnder = $('#diveUnder'), diveUin = $('#diveUin'), diveImg = $('#diveImg'), diveLine = $('#diveLine'), diveHead = $('#diveHead'), diveHud = $('.dive__hud'), diveDeep = $('#diveDeep'), diveDepth = $('#diveDepth'), diveTime = $('#diveTime'), diveCaps = $$('.dive__cap');
  const restMedia = $('.rest__media'), arcticIce = $('#arcticIce'), arcticImg = $('img', arcticIce), arcticYear = $('#arcticYear');
  const ease = (k, f) => 1 - Math.pow(1 - k, f);
  let lastY = -1, navHidden = false, lastT = 0, vel = 0, last = {}, snowTick = 0;
  const setText = (el, key, v) => { if (last[key] !== v) { el.textContent = last[key] = v; } };

  function frame(t) {
    const dt = t - (lastT || t); lastT = t;
    const f = clamp(dt / 16.667, 0.25, 6);
    govern(dt);
    const y = scrollY;                                   // bám sát vị trí cuộn thật, không làm trễ
    const moved = y !== lastY || dirty;
    vel = lerp(vel, lastY < 0 ? 0 : (y - lastY) / f, ease(0.2, f));
    if (Math.abs(vel) < 0.01) vel = 0;
    pointer.vx = pointer.x - lastPX; lastPX = pointer.x;
    const time = t / 1000;

    if (FINE && !REDUCE) {
      ring.x = lerp(ring.x, pointer.x, ease(0.18, f)); ring.y = lerp(ring.y, pointer.y, ease(0.18, f));
      cDot.style.transform = `translate3d(${pointer.x}px,${pointer.y}px,0)`;
      cRing.style.transform = `translate3d(${ring.x}px,${ring.y}px,0)`;
    }

    if (moved) {
      progress.style.transform = `scaleX(${clamp(y / docH)})`;
      const down = y > lastY && y > 300;
      if (down !== navHidden) { navHidden = down; nav.classList.toggle('is-hidden', down); }
      nav.classList.toggle('is-solid', y > 60);

      // HERO — ống kính đẩy chậm vào con gấu, câu thoại hiện lên
      if (inView(M.heroPin, y)) {
        const hp = clamp(y / (M.heroPin.h - vh));
        const z = 1 + Math.pow(hp, 1.4) * 1.5;
        if (FX.live.hero && FX.live.hero.ready) FX.live.hero.zoom = z; else heroMedia.style.scale = z;
        heroHead.style.opacity = 1 - ss(0.05, 0.38, hp);
        heroHead.style.transform = `translate3d(0,${-hp * vh * 0.3}px,0) scale(${1 + hp * 0.35})`;
        heroFoot.style.opacity = 1 - ss(0, 0.12, hp);
        const q = ss(0.5, 0.72, hp);
        heroQuote.style.opacity = q * (1 - ss(0.92, 1, hp));
        heroQuote.style.transform = `translate3d(0,${(1 - q) * 60}px,0)`;
        heroShade.style.opacity = 1 + ss(0.5, 1, hp) * 0.6;
      }

      // MANIFESTO + ảnh trượt chậm
      if (!REDUCE && inView(M.about, y)) {
        const a = M.text, p = clamp((y + vh * 0.8 - a.top) / (a.h + vh * 0.3)), n = mWords.length, head = p * (n + 6);
        for (let i = 0; i < n; i++) mWords[i].style.opacity = (0.14 + 0.86 * clamp((head - i) / 6)).toFixed(2);
      }
      if (!REDUCE) for (const ph of phs) if (y + vh > ph.top && y < ph.top + ph.h) ph.img.style.translate = `0 ${(((y + vh / 2) - (ph.top + ph.h / 2)) * -ph.k).toFixed(1)}px`;

      // GALLERY — cuộn ngang, ảnh trượt ngược bên trong khung
      if (inView(M.gallery, y)) {
        const g = M.gallery, p = clamp((y - g.top) / (g.h - vh)), tx = -p * galleryDist;
        galleryTrack.style.transform = `translate3d(${tx.toFixed(1)}px,0,0)`;
        galleryBar.style.transform = `scaleX(${p})`;
        for (const s of shots) {
          const d = (s.x + tx + s.w / 2 - vw / 2) / vw;
          if (Math.abs(d) > 1.3) continue;
          s.img.style.transform = `translate3d(${(d * -7).toFixed(2)}%,0,0)`;
          if (Math.abs(d) < 0.55) s.el.classList.add('is-in');
        }
      }

      // FILM — khung hình nhỏ phóng to thành toàn màn hình
      if (inView(M.film, y)) {
        const m = M.film, p = clamp((y - m.top) / (m.h - vh)), e = ss(0, 0.5, p), sc = lerp(0.42, 1, e);
        filmFrame.style.transform = `scale(${sc.toFixed(4)})`;
        filmFrame.style.borderRadius = `${((1 - e) * 22 / sc).toFixed(1)}px`;
        filmVideo.style.transform = `scale(${(lerp(1.5, 1, e)).toFixed(4)})`;
        filmTitle[0].style.transform = `translate3d(${(-e * vw * 0.45).toFixed(1)}px,0,0)`;
        filmTitle[1].style.transform = `translate3d(${(e * vw * 0.45).toFixed(1)}px,0,0)`;
        const o = ss(0.52, 0.7, p);
        filmShade.style.opacity = o; filmHud.style.opacity = ss(0.4, 0.55, p);
        filmOver.style.opacity = o; filmOver.style.transform = `translate3d(0,${((1 - o) * 50).toFixed(1)}px,0)`;
      }

      // DIVE — mặt nước dâng qua ống kính, chìm dần xuống độ sâu
      {
        const d = M.dive, near = inView(d, y), p = clamp((y - d.top) / (d.h - vh));
        let under = 0, out = 0;
        if (near) {
          const sink = ss(0.1, 0.42, p); under = sink;
          out = ss(d.top + d.h - vh * 1.1, d.top + d.h - vh * 0.5, y);
          if (FX.live.swim) FX.live.swim.zoom = 1 + p * 0.5;
          diveTop.style.transform = `translate3d(0,${(-sink * 22).toFixed(2)}%,0)`;
          diveHead.style.opacity = 1 - ss(0.02, 0.13, p);
          diveHead.style.transform = `translate3d(0,${(-p * vh * 0.5).toFixed(1)}px,0)`;
          const L = lerp(104, 0, sink);                             // mực nước (% chiều cao màn hình)
          diveUnder.style.transform = `translate3d(0,${L.toFixed(2)}%,0)`;
          diveUin.style.transform = `translate3d(0,${(-L).toFixed(2)}%,0)`;
          diveLine.style.opacity = L < 102 ? clamp(L / 6) : 0;
          diveLine.style.transform = `translate3d(0,${(L * vh / 100).toFixed(1)}px,0)`;
          diveImg.style.transform = `translate3d(0,${((1 - sink) * 5 - ss(0.42, 1, p) * 4).toFixed(2)}%,0) scale(${(1 + ss(0.3, 1, p) * 0.14).toFixed(4)})`;
          diveDeep.style.opacity = ss(0.62, 1, p) * 0.72;
          diveHud.style.opacity = ss(0.12, 0.2, p);
          const dp = clamp((p - 0.2) / 0.8);
          setText(diveDepth, 'dd', (dp * 14.2).toFixed(1));
          const secs = Math.round(dp * 192);
          setText(diveTime, 'dt', `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`);
          diveCaps.forEach((c, i) => {
            const q = (p - (0.44 + i * 0.185)) / 0.18;
            const o = q < 0 || q > 1 ? 0 : Math.min(1, Math.min(q, 1 - q) * 5);
            c.style.opacity = i === 2 && p > 0.93 ? 1 : o;
            c.style.transform = `translate3d(0,${((0.5 - clamp(q)) * 50).toFixed(1)}px,0)`;
          });
        }
        FX.sound.muffle(under * (1 - out));
        FX.snow.opacity = 1 - (near ? ss(0.08, 0.3, p) * (1 - out) : 0);
      }

      // REST
      if (inView(M.rest, y)) restMedia.style.transform = `translate3d(0,${(((y - M.rest.top) / M.rest.h) * 14).toFixed(2)}%,0)`;

      // ARCTIC — mép băng lùi dần theo năm
      if (inView(M.arctic, y, 200)) {
        const a = M.arctic, p = clamp((y + vh * 0.8 - a.top) / (a.h + vh * 0.35)), s = lerp(1, 0.5, p);
        arcticIce.style.transform = `scale(${s.toFixed(4)})`; arcticImg.style.transform = `scale(${(1.15 / s).toFixed(4)}) rotate(${(p * 14).toFixed(2)}deg)`;
        setText(arcticYear, 'yr', String(Math.round(lerp(1979, 2026, p))));
      }
    }

    // những thứ chạy theo thời gian — chỉ khi đang nằm trong màn hình
    if (!REDUCE && inView(M.marq, y)) for (const m of marq) {
      m.x += m.dir * (0.9 + Math.abs(vel) * 0.5) * f;
      if (m.x <= -m.half) m.x += m.half; if (m.x > 0) m.x -= m.half;
      m.el.style.transform = `translate3d(${m.x.toFixed(1)}px,0,0)`;
    }
    if (inView(M.film, y)) setText(filmTime, 'ft', `00:${String(Math.floor(filmVideo.currentTime || 0)).padStart(2, '0')}`);
    if (FX.live.aurora && FX.live.aurora.amp > 1) FX.live.aurora.amp = lerp(FX.live.aurora.amp, 1, ease(0.02, f));

    FX.drawLive(time);
    if (!REDUCE && (tier === 0 || (snowTick++ & 1))) FX.snow.draw(t, vel, tier === 0 ? f : f * 2, pointer.vx);

    lastY = y; dirty = false;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
