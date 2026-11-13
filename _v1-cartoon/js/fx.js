/* =========================================================
   ICE BEAR — lớp hiệu ứng nâng cao (nạp sau main.js)
   ========================================================= */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------------------------------------------------------
     1. Loader vỡ thành mảnh băng
  --------------------------------------------------------- */
  const loader = $('#loader');
  if (loader && !REDUCE) {
    const cols = 6, rows = 4, pts = [];
    for (let r = 0; r <= rows; r++) {
      pts[r] = [];
      for (let c = 0; c <= cols; c++) {
        const edgeX = c === 0 || c === cols, edgeY = r === 0 || r === rows;
        pts[r][c] = [
          c / cols * 100 + (edgeX ? 0 : rand(-6, 6)),
          r / rows * 100 + (edgeY ? 0 : rand(-8, 8)),
        ];
      }
    }
    const frag = document.createDocumentFragment();
    const addShard = (a, b, c) => {
      const el = document.createElement('div');
      el.className = 'shard';
      const cx = (a[0] + b[0] + c[0]) / 3, cy = (a[1] + b[1] + c[1]) / 3;
      const dx = cx - 50, dy = cy - 50, dist = Math.hypot(dx, dy);
      el.style.clipPath = `polygon(${a[0]}% ${a[1]}%, ${b[0]}% ${b[1]}%, ${c[0]}% ${c[1]}%)`;
      el.style.transformOrigin = `${cx}% ${cy}%`;
      el.style.setProperty('--tx', `${dx * 1.3}vw`);
      el.style.setProperty('--ty', `${dy * 1.1 + 45}vh`);
      el.style.setProperty('--r', `${rand(-70, 70)}deg`);
      el.style.setProperty('--d', `${(dist / 70 * 0.28).toFixed(3)}s`);
      frag.append(el);
    };
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const p00 = pts[r][c], p10 = pts[r][c + 1], p01 = pts[r + 1][c], p11 = pts[r + 1][c + 1];
        if ((r + c) % 2) { addShard(p00, p10, p11); addShard(p00, p11, p01); }
        else { addShard(p00, p10, p01); addShard(p10, p11, p01); }
      }
    }
    const flash = document.createElement('div');
    flash.className = 'loader__flash';
    frag.append(flash);
    loader.prepend(frag);
  }

  /* ---------------------------------------------------------
     2. Cuộn quán tính (chuột/trackpad) + cuộn tới mục có easing
  --------------------------------------------------------- */
  if (FINE && !REDUCE) {
    document.documentElement.style.scrollBehavior = 'auto';
    let target = scrollY, cur = scrollY, running = false, last = 0, k = 0.1;
    const maxS = () => document.documentElement.scrollHeight - innerHeight;
    const tick = (t) => {
      const f = clamp((t - (last || t)) / 16.667, 0.25, 6);
      last = t;
      cur += (target - cur) * (1 - Math.pow(1 - k, f));
      if (Math.abs(target - cur) < 0.4) { cur = target; running = false; }
      scrollTo(0, cur);
      if (running) requestAnimationFrame(tick); else { last = 0; k = 0.1; }
    };
    const go = () => { if (!running) { running = true; last = 0; requestAnimationFrame(tick); } };

    addEventListener('wheel', (e) => {
      if (e.ctrlKey || document.body.classList.contains('is-loading')) return;
      e.preventDefault();
      let d = e.deltaY;
      if (e.deltaMode === 1) d *= 40; else if (e.deltaMode === 2) d *= innerHeight;
      if (!running) cur = target = scrollY;
      k = 0.1;
      target = clamp(target + d, 0, maxS());
      go();
    }, { passive: false });
    // người dùng kéo thanh cuộn / bấm phím → nhường lại quyền điều khiển
    addEventListener('scroll', () => { if (running && Math.abs(scrollY - cur) > 6) running = false; }, { passive: true });
    addEventListener('keydown', (e) => { if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) running = false; });

    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const el = a.getAttribute('href') === '#top' ? document.body : $(a.getAttribute('href'));
      if (!el) return;
      e.preventDefault();
      cur = scrollY;
      target = el === document.body ? 0 : clamp(el.getBoundingClientRect().top + scrollY, 0, maxS());
      k = 0.055;
      go();
    });
  }

  /* ---------------------------------------------------------
     3. Hạt tuyết theo con trỏ + nổ khi bấm
  --------------------------------------------------------- */
  let sparks = [], sctx = null, sdpr = 1, sparkDirty = false;
  const spark = document.createElement('canvas');
  if (!REDUCE) {
    spark.id = 'spark';
    spark.setAttribute('aria-hidden', 'true');
    document.body.append(spark);
    sctx = spark.getContext('2d');
    const size = () => {
      sdpr = Math.min(devicePixelRatio || 1, 1.5);
      spark.width = innerWidth * sdpr; spark.height = innerHeight * sdpr;
    };
    size();
    addEventListener('resize', size);
    const colors = ['#8fd3ff', '#5effc1', '#ffffff', '#a78bfa', '#4aa3e8'];
    const emit = (x, y, n, power) => {
      for (let i = 0; i < n && sparks.length < 260; i++) {
        const a = Math.random() * 6.283, v = rand(0.3, 1) * power;
        const max = rand(28, 60);
        sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - power * 0.25, r: rand(2.5, 6.5), rot: rand(0, 6.28), vr: rand(-0.15, 0.15), life: max, max, c: colors[(Math.random() * colors.length) | 0] });
      }
    };
    let px = 0, py = 0, acc = 0;
    addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      acc += Math.hypot(e.clientX - px, e.clientY - py);
      px = e.clientX; py = e.clientY;
      if (acc > 26) { emit(px, py, Math.min(3, (acc / 26) | 0), 1.4); acc = 0; }
    }, { passive: true });
    addEventListener('pointerdown', (e) => emit(e.clientX, e.clientY, 30, 7), { passive: true });
  }
  function drawSparks(f) {
    if (!sctx) return;
    if (!sparks.length) {
      if (sparkDirty) { sctx.setTransform(1, 0, 0, 1, 0, 0); sctx.clearRect(0, 0, spark.width, spark.height); sparkDirty = false; }
      return;
    }
    sparkDirty = true;
    sctx.setTransform(sdpr, 0, 0, sdpr, 0, 0);
    sctx.clearRect(0, 0, innerWidth, innerHeight);
    sctx.lineWidth = 1.4; sctx.lineCap = 'round';
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.life -= f;
      if (p.life <= 0) { sparks.splice(i, 1); continue; }
      p.vy += 0.07 * f; p.vx *= Math.pow(0.96, f); p.vy *= Math.pow(0.96, f);
      p.x += p.vx * f; p.y += p.vy * f; p.rot += p.vr * f;
      const a = p.life / p.max;
      sctx.globalAlpha = a;
      sctx.strokeStyle = p.c;
      sctx.beginPath();
      const r = p.r * (0.5 + a * 0.5);
      for (let j = 0; j < 3; j++) {
        const an = p.rot + j * 1.0472, c = Math.cos(an) * r, s = Math.sin(an) * r;
        sctx.moveTo(p.x - c, p.y - s); sctx.lineTo(p.x + c, p.y + s);
      }
      sctx.stroke();
    }
  }

  /* ---------------------------------------------------------
     4. Skills: thẻ xếp vòng cung, nghiêng theo tốc độ cuộn
  --------------------------------------------------------- */
  const skillsSec = $('#skills');
  const wraps = $$('.card').map((card) => {
    const w = document.createElement('div');
    w.className = 'card-wrap';
    card.before(w);
    w.append(card);
    return w;
  });
  function coverflow(vel) {
    const sr = skillsSec.getBoundingClientRect();
    if (sr.bottom < 0 || sr.top > innerHeight) return;
    const half = innerWidth / 2;
    for (const w of wraps) {
      const r = w.getBoundingClientRect();
      const d = clamp((r.left + r.width / 2 - half) / half, -1.6, 1.6);
      const lean = clamp(vel * -0.12, -7, 7);
      w.style.transform = `translate3d(0,${d * d * 70}px,0) rotate(${d * 5 + lean * 0.4}deg) skewX(${lean}deg) scale(${1 - Math.min(0.14, Math.abs(d) * 0.1)})`;
      if (Math.abs(d) < 0.85) w.classList.add('is-in');
    }
  }

  /* ---------------------------------------------------------
     5. Dive: vệt bong bóng sau gấu đang bơi
  --------------------------------------------------------- */
  const diveSec = $('#dive'), diveStage = $('.dive__stage'), diveBear = $('#diveBear');
  let trailX = 0, trailN = 0;
  function trail() {
    if (REDUCE) return;
    const sr = diveSec.getBoundingClientRect();
    if (sr.top > 0 || sr.bottom < innerHeight) return;
    const r = diveBear.getBoundingClientRect();
    const x = r.left + r.width * 0.9, y = r.top + r.height * 0.5;
    if (Math.abs(x - trailX) < 16 || trailN > 40) return;
    const back = x > trailX ? -1 : 1;
    trailX = x;
    for (let i = 0; i < 2; i++) {
      const b = document.createElement('span');
      const s = rand(5, 16);
      b.className = 'dive__trail';
      b.style.cssText = `left:${x + rand(-20, 10)}px;top:${y + rand(-14, 20)}px;width:${s}px;height:${s}px;--dx:${back * rand(20, 90)}px`;
      trailN++;
      b.addEventListener('animationend', () => { b.remove(); trailN--; });
      diveStage.append(b);
    }
  }

  /* ---------------------------------------------------------
     6. Gấu ở hero thỉnh thoảng tự vẫy tay
  --------------------------------------------------------- */
  const heroBear = $('.floe .bear');
  if (heroBear && !REDUCE) {
    setInterval(() => {
      if (scrollY > 150 || document.hidden) return;
      heroBear.classList.remove('is-wave');
      void heroBear.getBoundingClientRect();
      heroBear.classList.add('is-wave');
    }, 8000);
  }

  /* ---------------------------------------------------------
     7. Sàn nhảy: nhạc tổng hợp bằng WebAudio + equalizer thật
  --------------------------------------------------------- */
  const dance = $('#dance');
  const danceBtn = $('#danceBtn');
  const danceBear = $('.dance__stage .bear');
  const danceWord = $('.dance__word');
  const danceFloor = $('.dance__floor');
  const eq = $('#danceEq');
  const BARS = 44;
  const bars = [];
  for (let i = 0; i < BARS; i++) { const s = document.createElement('span'); eq.append(s); bars.push(s); }

  let dancing = false, ac = null, master = null, analyser = null, freq = null, noiseBuf = null, timer = 0, nextT = 0, step = 0;
  const STEP = 60 / 120 / 4;                      // nốt móc kép ở 120 BPM
  const BASS = [0, -1, 0, -1, 0, -1, 3, -1, 0, -1, 0, -1, 5, -1, 3, -1, -4, -1, -4, -1, -4, -1, 0, -1, -2, -1, -2, -1, 3, -1, 5, -1];
  const ARP = [0, 7, 12, 7, 3, 10, 12, 10, 5, 12, 15, 12, 3, 10, 7, 10];

  function env(node, t, peak, dur) {
    node.gain.setValueAtTime(peak, t);
    node.gain.exponentialRampToValueAtTime(0.001, t + dur);
  }
  function tone(type, f, t, peak, dur, cutoff) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    env(g, t, peak, dur);
    if (cutoff) { const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff; o.connect(lp); lp.connect(g); } else o.connect(g);
    g.connect(master); o.start(t); o.stop(t + dur + 0.02);
    return o;
  }
  function noise(t, peak, dur, type, f) {
    const s = ac.createBufferSource(), g = ac.createGain(), fl = ac.createBiquadFilter();
    s.buffer = noiseBuf; fl.type = type; fl.frequency.value = f;
    env(g, t, peak, dur);
    s.connect(fl); fl.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.02);
  }
  function pulse() {
    if (!dancing || REDUCE) return;
    danceWord.animate([{ transform: 'translateY(-50%) scale(1.05)' }, { transform: 'translateY(-50%) scale(1)' }], { duration: 420, easing: 'cubic-bezier(.22,1,.36,1)' });
    danceFloor.animate([{ transform: 'translateX(-50%) scale(1.18)', filter: 'brightness(1.8)' }, { transform: 'translateX(-50%) scale(1)', filter: 'brightness(1)' }], { duration: 420, easing: 'ease-out' });
  }
  function playStep(s, t) {
    if (s % 4 === 0) {
      const o = tone('sine', 150, t, 0.9, 0.3);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
      setTimeout(pulse, Math.max(0, (t - ac.currentTime) * 1000));
    }
    if (s % 8 === 4) noise(t, 0.35, 0.14, 'bandpass', 1600);
    if (s % 2 === 0) noise(t, s % 4 === 2 ? 0.16 : 0.07, 0.045, 'highpass', 7500);
    if (BASS[s] > -9 && BASS[s] !== -1) tone('sawtooth', 55 * Math.pow(2, BASS[s] / 12), t, 0.3, 0.22, 420);
    if (s % 2 === 0) tone('triangle', 440 * Math.pow(2, ARP[(s / 2) % 16] / 12), t, 0.09, 0.2);
  }
  function startAudio() {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      ac.resume();
      if (!noiseBuf) {
        noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.2, ac.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      master = ac.createGain(); master.gain.value = 0.45;
      analyser = ac.createAnalyser(); analyser.fftSize = 128; analyser.smoothingTimeConstant = 0.72;
      freq = new Uint8Array(analyser.frequencyBinCount);
      master.connect(analyser); analyser.connect(ac.destination);
      nextT = ac.currentTime + 0.06; step = 0;
      timer = setInterval(() => {
        while (nextT < ac.currentTime + 0.12) { playStep(step, nextT); nextT += STEP; step = (step + 1) % 32; }
      }, 25);
    } catch (err) { analyser = null; }
  }
  function stopAudio() {
    clearInterval(timer);
    if (master && ac) {
      const m = master;
      m.gain.setTargetAtTime(0, ac.currentTime, 0.05);
      setTimeout(() => m.disconnect(), 400);
    }
    master = null;
  }
  function setDance(on) {
    if (on === dancing) return;
    dancing = on;
    dance.classList.toggle('is-on', on);
    danceBear.classList.toggle('is-dancing', on);
    danceBtn.setAttribute('aria-pressed', on);
    $('span', danceBtn).textContent = on ? 'Tắt nhạc' : 'Bật nhạc cho Ice Bear';
    if (on) startAudio(); else { stopAudio(); bars.forEach((b) => { b.style.transform = ''; }); }
  }
  danceBtn.addEventListener('click', () => setDance(!dancing));
  danceBear.addEventListener('click', () => setDance(!dancing));
  // rời khỏi sàn nhảy thì tự tắt nhạc
  new IntersectionObserver((en) => { if (!en[0].isIntersecting) setDance(false); }, { threshold: 0 }).observe(dance);
  document.addEventListener('visibilitychange', () => { if (document.hidden) setDance(false); });

  function drawEq(t) {
    if (!dancing) return;
    if (analyser) analyser.getByteFrequencyData(freq);
    const mid = BARS / 2;
    for (let i = 0; i < BARS; i++) {
      const bin = Math.floor(Math.abs(i - mid + 0.5));
      const v = analyser ? freq[bin + 1] / 255 : 0.3 + 0.3 * Math.sin(t * 0.008 + i);
      bars[i].style.transform = `scaleY(${Math.max(0.015, v * v)})`;
    }
  }

  /* ---------------------------------------------------------
     Vòng lặp
  --------------------------------------------------------- */
  let lastY = scrollY, vel = 0, lastT = 0;
  function frame(t) {
    const f = clamp((t - (lastT || t)) / 16.667, 0.25, 6);
    lastT = t;
    const y = scrollY;
    vel = lerp(vel, (y - lastY) / f, 0.18);
    lastY = y;
    coverflow(REDUCE ? 0 : vel);
    trail();
    drawSparks(f);
    drawEq(t);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
