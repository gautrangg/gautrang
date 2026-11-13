/* =========================================================
   ICE BEAR — bản tư liệu thật · bộ máy hiệu ứng
   - LivePhoto: ảnh thật "sống" bằng WebGL (nước gợn, sóng lan theo chuột, cực quang lay động)
   - Snow: tuyết có độ sâu trường ảnh
   - Sound: tiếng gió tổng hợp, bị nghẹt lại khi lặn xuống nước
   ========================================================= */
window.FX = (() => {
  'use strict';
  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);

  /* ---------------------------------------------------------
     LivePhoto
  --------------------------------------------------------- */
  const Q = { gl: 1, snow: 1 };          // hệ số chất lượng, do bộ tự điều chỉnh đặt
  const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const FRAG = `
precision highp float;
uniform sampler2D uTex;
uniform vec2 uRes, uImg, uFocus, uAlign;
uniform float uTime, uZoom, uMode, uAmp;
uniform vec3 uRip[6];
void main(){
  vec2 st = gl_FragCoord.xy / uRes; st.y = 1. - st.y;
  float ra = uRes.x / uRes.y, ia = uImg.x / uImg.y;
  vec2 sc = ra > ia ? vec2(1., ia / ra) : vec2(ra / ia, 1.);
  vec2 uv = (st - .5) * sc + .5 + (uAlign - .5) * (1. - sc);
  uv = (uv - uFocus) / uZoom + uFocus;
  float t = uTime, m = 1.;
  vec2 d = vec2(0.);
  if (uMode < .5) {                       // hero: chỉ vùng nước chuyển động, gấu và băng đứng yên
    float y0 = mix(.64, .46, smoothstep(.36, .58, uv.x));
    m = smoothstep(y0, y0 + .11, uv.y);
  } else if (uMode < 1.5) {               // gấu đang bơi: giữ yên khuôn mặt
    m = smoothstep(.75, 1.5, length((uv - vec2(.43, .36)) / vec2(.2, .24)));
  } else {                                // cực quang: chỉ bầu trời
    m = 1. - smoothstep(.42, .72, uv.y);
  }
  if (uMode < 1.5) {
    d.x = (sin(uv.y * 150. - t * 2.2) * .6 + sin(uv.y * 67. + t * 1.4 + uv.x * 9.)) * .0016;
    d.y = sin(uv.x * 34. + t * 1.2 + uv.y * 40.) * .0011;
  } else {
    d.x = sin(uv.y * 7. + t * .45 + sin(uv.x * 4. + t * .3) * 2.) * .010;
    d.y = sin(uv.x * 10. + t * .6) * .007;
  }
  vec2 rip = vec2(0.); float glint = 0.;
  for (int i = 0; i < 6; i++) {
    float age = t - uRip[i].z;
    if (age > 0. && age < 4.5) {
      vec2 dv = (st - uRip[i].xy) * vec2(ra, 1.);
      float dist = length(dv), front = age * .26;
      float w = sin((dist - front) * 60.) * exp(-abs(dist - front) * 10.) * exp(-age * 1.05);
      rip += normalize(dv + 1e-5) * w; glint += w;
    }
  }
  uv += (d * uAmp + rip * .011) * m;
  vec3 col = texture2D(uTex, clamp(uv, 0., 1.)).rgb;
  col += glint * .1 * m;
  if (uMode > 1.5) col *= 1. + m * .24 * sin(uv.x * 16. + t * 1.3 + sin(uv.y * 9. - t) * 2.);
  col *= 1. - .34 * pow(length(st - .5) * 1.25, 2.5);
  gl_FragColor = vec4(col, 1.);
}`;

  class LivePhoto {
    constructor(canvas) {
      this.c = canvas;
      this.mode = { hero: 0, swim: 1, aurora: 2 }[canvas.dataset.mode || 'hero'];
      this.zoom = 1; this.amp = 1;
      this.focus = [0.5, 0.5]; this.align = [0.5, 0.5];
      this.rips = new Float32Array(18).fill(-99); this.ri = 0;
      this.visible = false; this.ready = false; this.drawn = false;
      const gl = this.gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
      if (!gl) return;
      const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
      const pr = gl.createProgram();
      gl.attachShader(pr, mk(gl.VERTEX_SHADER, VERT)); gl.attachShader(pr, mk(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { this.gl = null; return; }
      gl.useProgram(pr);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      this.u = {}; ['uRes', 'uImg', 'uFocus', 'uAlign', 'uTime', 'uZoom', 'uMode', 'uAmp', 'uRip'].forEach((n) => { this.u[n] = gl.getUniformLocation(pr, n); });
      canvas.style.visibility = 'hidden';
      const img = new Image();
      img.onload = () => {
        try {
          const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
          this.iw = img.naturalWidth; this.ih = img.naturalHeight;
          this.ready = true; this.resize(); canvas.style.visibility = '';
        } catch (e) { this.gl = null; }      // ảnh bị chặn (file://) → giữ ảnh nền CSS
      };
      // ảnh nhúng sẵn dạng data URI để WebGL chạy được cả khi mở file trực tiếp
      img.src = (window.ICE_TEX && window.ICE_TEX[canvas.dataset.tex]) || canvas.dataset.src;
      new IntersectionObserver((e) => { this.visible = e[0].isIntersecting; }).observe(canvas);
    }
    resize() {
      if (!this.gl) return;
      const dpr = Math.min(devicePixelRatio || 1, 1.25) * Q.gl;
      const w = Math.round(this.c.clientWidth * dpr), h = Math.round(this.c.clientHeight * dpr);
      if (w && h && (this.c.width !== w || this.c.height !== h)) { this.c.width = w; this.c.height = h; this.gl.viewport(0, 0, w, h); this.drawn = false; }
    }
    ripple(clientX, clientY, time) {
      const r = this.c.getBoundingClientRect();
      const i = (this.ri++ % 6) * 3;
      this.rips[i] = (clientX - r.left) / r.width; this.rips[i + 1] = (clientY - r.top) / r.height; this.rips[i + 2] = time;
    }
    draw(time) {
      const gl = this.gl;
      if (!gl || !this.ready || !this.visible) return;
      if (REDUCE && this.drawn) return;
      const u = this.u;
      gl.uniform2f(u.uRes, this.c.width, this.c.height); gl.uniform2f(u.uImg, this.iw, this.ih);
      gl.uniform2f(u.uFocus, this.focus[0], this.focus[1]); gl.uniform2f(u.uAlign, this.align[0], this.align[1]);
      gl.uniform1f(u.uTime, REDUCE ? 0 : time); gl.uniform1f(u.uZoom, this.zoom); gl.uniform1f(u.uMode, this.mode); gl.uniform1f(u.uAmp, this.amp);
      gl.uniform3fv(u.uRip, this.rips);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this.drawn = true;
    }
  }

  const live = {};
  document.querySelectorAll('canvas.gl').forEach((c) => { live[c.dataset.tex] = new LivePhoto(c); });
  if (live.hero) { live.hero.align = [0.5, 0.4]; live.hero.focus = [0.53, 0.5]; }
  if (live.swim) live.swim.focus = [0.42, 0.42];
  if (live.aurora) live.aurora.amp = 1;

  // sóng lan theo chuột trên mặt nước
  const now = () => performance.now() / 1000;
  const bindRipples = (host, lp) => {
    if (!host || !lp || REDUCE) return;
    let lx = 0, ly = 0, lt = 0;
    host.addEventListener('pointermove', (e) => {
      const t = now();
      if (Math.hypot(e.clientX - lx, e.clientY - ly) > 110 || t - lt > 0.5) { lp.ripple(e.clientX, e.clientY, t); lx = e.clientX; ly = e.clientY; lt = t; }
    }, { passive: true });
    host.addEventListener('pointerdown', (e) => lp.ripple(e.clientX, e.clientY, now()), { passive: true });
  };
  bindRipples(document.querySelector('.hero'), live.hero);
  bindRipples(document.querySelector('.dive__stage'), live.swim);
  addEventListener('resize', () => Object.values(live).forEach((l) => l.resize()));

  /* ---------------------------------------------------------
     Tuyết: hạt gần ống kính to và nhoè, hạt xa nhỏ và nét
  --------------------------------------------------------- */
  const snowC = document.getElementById('snow');
  const sctx = snowC.getContext('2d');
  const sprites = [2, 7, 16].map((blur, i) => {
    const s = document.createElement('canvas'); const R = [6, 16, 40][i]; s.width = s.height = R * 2;
    const g = s.getContext('2d'); const gr = g.createRadialGradient(R, R, 0, R, R, R);
    gr.addColorStop(0, 'rgba(255,255,255,' + [1, 0.8, 0.5][i] + ')'); gr.addColorStop([0.5, 0.35, 0.25][i], 'rgba(255,255,255,' + [0.75, 0.4, 0.22][i] + ')'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, R * 2, R * 2); return s;
  });
  let sw = 0, sh = 0, sdpr = 1, flakes = [], wind = 0.4;
  const newFlake = (any) => {
    const z = Math.pow(Math.random(), 3);                    // phần lớn ở xa, vài hạt lướt sát ống kính
    return { x: Math.random() * sw, y: any ? Math.random() * sh : -40, z, r: 1.4 + z * z * 24, vy: 0.5 + z * 3.2, ph: Math.random() * 6.28, o: 0.7 - z * 0.5, sp: z < 0.35 ? 0 : z < 0.7 ? 1 : 2 };
  };
  const sizeSnow = () => {
    sdpr = 1; sw = innerWidth; sh = innerHeight;
    snowC.width = sw * sdpr; snowC.height = sh * sdpr;
    flakes = Array.from({ length: REDUCE ? 0 : Math.round(clamp(sw / 13, 36, 110) * Q.snow) }, () => newFlake(true));
  };
  sizeSnow(); addEventListener('resize', sizeSnow);
  const snow = {
    opacity: 1,
    draw(t, vel, k, pvx) {
      if (!flakes.length || this.opacity <= 0.01) { if (this.dirty) { sctx.setTransform(1, 0, 0, 1, 0, 0); sctx.clearRect(0, 0, snowC.width, snowC.height); this.dirty = false; } return; }
      this.dirty = true;
      sctx.setTransform(sdpr, 0, 0, sdpr, 0, 0); sctx.clearRect(0, 0, sw, sh);
      wind = lerp(wind, clamp(pvx * 0.05, -4, 4) + 0.7 + Math.sin(t * 0.0003) * 0.5, 0.03);
      for (const f of flakes) {
        f.y += (f.vy - vel * 0.07 * (0.2 + f.z)) * k;
        f.x += (wind * (0.4 + f.z * 2.4) + Math.sin(t * 0.001 + f.ph) * 0.4) * k;
        if (f.y > sh + 50) { f.y = -40; f.x = Math.random() * sw; } else if (f.y < -60) f.y = sh + 40;
        if (f.x > sw + 50) f.x = -40; else if (f.x < -50) f.x = sw + 40;
        sctx.globalAlpha = f.o * this.opacity;
        sctx.drawImage(sprites[f.sp], f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);
      }
    },
  };

  /* ---------------------------------------------------------
     Tiếng gió (WebAudio, không tải file)
  --------------------------------------------------------- */
  const sound = {
    on: false, ac: null,
    toggle() {
      try {
        if (!this.ac) {
          const ac = this.ac = new (window.AudioContext || window.webkitAudioContext)();
          const buf = ac.createBuffer(1, ac.sampleRate * 4, ac.sampleRate); const d = buf.getChannelData(0);
          let b = 0; for (let i = 0; i < d.length; i++) { b = b * 0.985 + (Math.random() * 2 - 1) * 0.12; d[i] = b; }   // nhiễu nâu
          const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
          const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.7;
          this.lp = ac.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 5000;
          this.gain = ac.createGain(); this.gain.gain.value = 0;
          const lfo = ac.createOscillator(); lfo.frequency.value = 0.11; const lg = ac.createGain(); lg.gain.value = 260; lfo.connect(lg); lg.connect(bp.frequency);
          const lfo2 = ac.createOscillator(); lfo2.frequency.value = 0.07; const lg2 = ac.createGain(); lg2.gain.value = 0.25; this.vca = ac.createGain(); this.vca.gain.value = 0.7; lfo2.connect(lg2); lg2.connect(this.vca.gain);
          src.connect(bp); bp.connect(this.lp); this.lp.connect(this.vca); this.vca.connect(this.gain); this.gain.connect(ac.destination);
          src.start(); lfo.start(); lfo2.start();
        }
        this.on = !this.on; this.ac.resume();
        this.gain.gain.setTargetAtTime(this.on ? 0.9 : 0, this.ac.currentTime, 0.5);
      } catch (e) { this.on = false; }
      return this.on;
    },
    muffle(x) { if (this.lp && this.on) this.lp.frequency.setTargetAtTime(lerp(5000, 260, clamp(x)), this.ac.currentTime, 0.15); },
    off() { if (this.on) { this.on = false; this.gain.gain.setTargetAtTime(0, this.ac.currentTime, 0.2); } },
  };

  // 0 = đầy đủ · 1 = nhẹ · 2 = tối thiểu
  function quality(tier) {
    Q.gl = [1, 0.7, 0.5][tier]; Q.snow = [1, 0.5, 0][tier];
    document.documentElement.classList.toggle('lite', tier > 0);
    Object.values(live).forEach((l) => l.resize()); sizeSnow();
  }
  return { live, snow, sound, quality, drawLive(time) { for (const k in live) live[k].draw(time); } };
})();
