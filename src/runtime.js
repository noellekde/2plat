/* 2plat runtime — runs games made in the 2plat editor.
   Used for in-editor playtesting AND embedded in exported games. */
(function (root) {
  'use strict';

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  /* ------------------------------------------------------------------ AUDIO */
  const SFX_PRESETS = {
    jump:      { wave: 'square',   freq: 260,  endFreq: 620,  dur: 0.18, vol: 0.35 },
    coin:      { wave: 'square',   freq: 880,  endFreq: 1320, dur: 0.14, vol: 0.30 },
    hit:       { wave: 'saw',      freq: 300,  endFreq: 60,   dur: 0.25, vol: 0.45 },
    explosion: { wave: 'noise',    freq: 2200, endFreq: 80,   dur: 0.60, vol: 0.65 },
    powerup:   { wave: 'square',   freq: 300,  endFreq: 1200, dur: 0.35, vol: 0.35, vibrato: 20, vibSpeed: 20 },
    laser:     { wave: 'saw',      freq: 1400, endFreq: 200,  dur: 0.20, vol: 0.30 },
    blip:      { wave: 'triangle', freq: 600,  endFreq: 600,  dur: 0.08, vol: 0.50 },
    land:      { wave: 'noise',    freq: 600,  endFreq: 100,  dur: 0.08, vol: 0.30 },
    death:     { wave: 'saw',      freq: 500,  endFreq: 40,   dur: 0.55, vol: 0.40, vibrato: 30, vibSpeed: 14 },
  };

  function createAudio() {
    let ctx = null, master = null, noiseBuf = null, timer = null;
    let volume = 0.6, muted = false;
    function ensure() {
      if (!ctx) {
        const AC = root.AudioContext || root.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : volume;
        master.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    function noise() {
      if (!noiseBuf) {
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      return noiseBuf;
    }
    const wt = (w) => (w === 'saw' ? 'sawtooth' : w || 'square');

    function playSfx(p, vol) {
      if (!p) return;
      const c = ensure(); if (!c) return;
      const t = c.currentTime, dur = Math.max(0.03, p.dur || 0.2);
      const g = c.createGain();
      const v = (p.vol == null ? 0.5 : p.vol) * (vol == null ? 1 : vol);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(Math.max(0.0002, v), t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      g.connect(master);
      if (p.wave === 'noise') {
        const s = c.createBufferSource(); s.buffer = noise(); s.loop = true;
        const f = c.createBiquadFilter(); f.type = 'lowpass';
        f.frequency.setValueAtTime(Math.max(60, p.freq || 1000), t);
        f.frequency.exponentialRampToValueAtTime(Math.max(40, p.endFreq || 200), t + dur);
        s.connect(f); f.connect(g); s.start(t); s.stop(t + dur + 0.02);
      } else {
        const o = c.createOscillator(); o.type = wt(p.wave);
        o.frequency.setValueAtTime(Math.max(20, p.freq || 440), t);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, p.endFreq || p.freq || 440), t + dur);
        if (p.vibrato) {
          const l = c.createOscillator(), lg = c.createGain();
          l.frequency.value = p.vibSpeed || 12; lg.gain.value = p.vibrato;
          l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.02);
        }
        o.connect(g); o.start(t); o.stop(t + dur + 0.02);
      }
    }

    const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
    function playNote(tr, midi, t, dur) {
      const c = ctx, g = c.createGain();
      g.connect(master);
      const vol = tr.vol == null ? 0.2 : tr.vol;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(Math.max(0.0002, vol), t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.95);
      if (tr.wave === 'noise') {
        const s = c.createBufferSource(); s.buffer = noise();
        const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2000 + midi * 20;
        s.connect(f); f.connect(g); s.start(t); s.stop(t + dur);
      } else {
        const o = c.createOscillator(); o.type = wt(tr.wave); o.frequency.value = midiHz(midi);
        o.connect(g); o.start(t); o.stop(t + dur);
      }
    }
    function stopMusic() { if (timer) { clearInterval(timer); timer = null; } }
    function playMusic(m, onStep) {
      stopMusic();
      if (!m) return;
      const c = ensure(); if (!c) return;
      const len = m.steps || 32, stepDur = 60 / (m.bpm || 120) / 4;
      let step = 0, next = c.currentTime + 0.1;
      timer = setInterval(() => {
        while (next < c.currentTime + 0.25) {
          if (onStep) { const s = step % len; setTimeout(() => onStep(s), Math.max(0, (next - c.currentTime) * 1000)); }
          for (const tr of m.tracks) {
            if (tr.muted) continue;
            const n = tr.notes[step % len];
            if (n > 0) playNote(tr, n, next, stepDur * (tr.len || 1));
          }
          step++; next += stepDur;
        }
      }, 50);
    }
    function setVolume(v) { volume = v; if (master && !muted) master.gain.value = v; }
    function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : volume; }
    return { ensure, playSfx, playMusic, stopMusic, setVolume, setMuted, get muted() { return muted; } };
  }

  /* ------------------------------------------------------------------ INPUT */
  const KEY_GROUPS = {
    left:   ['ArrowLeft', 'KeyA'],
    right:  ['ArrowRight', 'KeyD'],
    up:     ['ArrowUp', 'KeyW'],
    down:   ['ArrowDown', 'KeyS'],
    jump:   ['Space', 'ArrowUp', 'KeyW', 'KeyZ'],
    action: ['KeyX', 'KeyJ', 'KeyK', 'ShiftLeft', 'ShiftRight'],
  };
  const CODE_TO_GROUPS = {};
  Object.keys(KEY_GROUPS).forEach((g) => KEY_GROUPS[g].forEach((c) => { (CODE_TO_GROUPS[c] = CODE_TO_GROUPS[c] || []).push(g); }));

  /* ------------------------------------------------------------- PIXEL FONT */
  // 5x7 bitmap font (upper case, digits, punctuation). Crisp at any scale, identical on every computer.
  const GLYPHS = {
    ' ': '...../...../...../...../...../...../.....',
    A: '.###./#...#/#...#/#####/#...#/#...#/#...#', B: '####./#...#/#...#/####./#...#/#...#/####.', C: '.####/#..../#..../#..../#..../#..../.####',
    D: '####./#...#/#...#/#...#/#...#/#...#/####.', E: '#####/#..../#..../####./#..../#..../#####', F: '#####/#..../#..../####./#..../#..../#....',
    G: '.####/#..../#..../#.###/#...#/#...#/.###.', H: '#...#/#...#/#...#/#####/#...#/#...#/#...#', I: '#####/..#../..#../..#../..#../..#../#####',
    J: '..###/...#./...#./...#./...#./#..#./.##..', K: '#...#/#..#./#.#../##.../#.#../#..#./#...#', L: '#..../#..../#..../#..../#..../#..../#####',
    M: '#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#', N: '#...#/##..#/#.#.#/#..##/#...#/#...#/#...#', O: '.###./#...#/#...#/#...#/#...#/#...#/.###.',
    P: '####./#...#/#...#/####./#..../#..../#....', Q: '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#', R: '####./#...#/#...#/####./#.#../#..#./#...#',
    S: '.####/#..../#..../.###./....#/....#/####.', T: '#####/..#../..#../..#../..#../..#../..#..', U: '#...#/#...#/#...#/#...#/#...#/#...#/.###.',
    V: '#...#/#...#/#...#/#...#/#...#/.#.#./..#..', W: '#...#/#...#/#...#/#.#.#/#.#.#/##.##/#...#', X: '#...#/#...#/.#.#./..#../.#.#./#...#/#...#',
    Y: '#...#/#...#/.#.#./..#../..#../..#../..#..', Z: '#####/....#/...#./..#../.#.../#..../#####',
    0: '.###./#...#/#..##/#.#.#/##..#/#...#/.###.', 1: '..#../.##../..#../..#../..#../..#../.###.', 2: '.###./#...#/....#/...#./..#../.#.../#####',
    3: '####./....#/....#/.###./....#/....#/####.', 4: '...#./..##./.#.#./#..#./#####/...#./...#.', 5: '#####/#..../####./....#/....#/#...#/.###.',
    6: '..##./.#.../#..../####./#...#/#...#/.###.', 7: '#####/....#/...#./..#../.#.../.#.../.#...', 8: '.###./#...#/#...#/.###./#...#/#...#/.###.',
    9: '.###./#...#/#...#/.####/....#/...#./.##..',
    '.': '...../...../...../...../...../.##../.##..', ',': '...../...../...../...../.##../..#../.#...', ':': '...../.##../.##../...../.##../.##../.....',
    '!': '..#../..#../..#../..#../..#../...../..#..', '?': '.###./#...#/....#/...#./..#../...../..#..', '-': '...../...../...../#####/...../...../.....',
    '+': '...../..#../..#../#####/..#../..#../.....', '/': '....#/....#/...#./..#../.#.../#..../#....', '(': '...#./..#../.#.../.#.../.#.../..#../...#.',
    ')': '.#.../..#../...#./...#./...#./..#../.#...', "'": '..#../..#../.#.../...../...../...../.....', '"': '.#.#./.#.#./...../...../...../...../.....',
    '%': '##..#/##..#/...#./..#../.#.../#..##/#..##', '*': '...../#.#.#/.###./#####/.###./#.#.#/.....', '=': '...../...../#####/...../#####/...../.....',
    '<': '...#./..#../.#.../#..../.#.../..#../...#.', '>': '.#.../..#../...#./....#/...#./..#../.#...', '_': '...../...../...../...../...../...../#####',
    '#': '.#.#./#####/.#.#./.#.#./#####/.#.#./.....', ';': '...../.##../.##../...../.##../..#../.#...', '&': '.##../#..#./#.#../.#.../#.#.#/#..#./.##.#',
  };
  const CHAR_ORDER = Object.keys(GLYPHS);
  let fontAtlas = null; const tinted = {};
  function atlas(color) {
    if (!root.document) return null;
    if (!fontAtlas) {
      fontAtlas = root.document.createElement('canvas'); fontAtlas.width = CHAR_ORDER.length * 5; fontAtlas.height = 7;
      const x = fontAtlas.getContext('2d'); x.fillStyle = '#fff';
      CHAR_ORDER.forEach((ch, n) => GLYPHS[ch].split('/').forEach((row, y) => { for (let k = 0; k < 5; k++) if (row[k] === '#') x.fillRect(n * 5 + k, y, 1, 1); }));
    }
    if (!color || color === '#fff' || color === '#ffffff') return fontAtlas;
    let t = tinted[color];
    if (!t) {
      t = tinted[color] = root.document.createElement('canvas'); t.width = fontAtlas.width; t.height = 7;
      const x = t.getContext('2d'); x.drawImage(fontAtlas, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, t.width, 7);
    }
    return t;
  }
  function textWidth(str, scale) { return Math.max(0, String(str).length * 6 - 1) * (scale || 1); }
  /** Draw pixel text. opt: scale, color, align (left|center|right), shadow, outline, wave (px), t (time for wave) */
  function drawText(c, str, x, y, opt) {
    opt = opt || {}; str = String(str).toUpperCase();
    const sc = opt.scale || 1, w = textWidth(str, sc);
    let px = Math.round(opt.align === 'center' ? x - w / 2 : opt.align === 'right' ? x - w : x);
    const py = Math.round(y);
    const pass = (col, ox, oy) => {
      const at = atlas(col); if (!at) return;
      for (let i = 0; i < str.length; i++) {
        let n = CHAR_ORDER.indexOf(str[i]); if (n < 0) n = CHAR_ORDER.indexOf('?');
        if (str[i] === ' ') continue;
        const wy = opt.wave ? Math.round(Math.sin((opt.t || 0) * 4 + i * 0.7) * opt.wave) : 0;
        c.drawImage(at, n * 5, 0, 5, 7, px + i * 6 * sc + ox, py + oy + wy, 5 * sc, 7 * sc);
      }
    };
    if (opt.outline) { const o = sc; [[-o, 0], [o, 0], [0, -o], [0, o], [-o, -o], [o, o], [-o, o], [o, -o]].forEach(([a, b]) => pass(opt.outline, a, b)); }
    if (opt.shadow) pass(opt.shadow, sc, sc);
    pass(opt.color || '#fff', 0, 0);
    return w;
  }
  const HEART = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
  function drawHeart(c, x, y, fill, edge) {
    for (let r = 0; r < 6; r++) for (let k = 0; k < 7; k++) if (HEART[r][k] === '#') { c.fillStyle = fill; c.fillRect(x + k, y + r, 1, 1); }
    c.fillStyle = edge;
    c.fillRect(x + 1, y - 1, 2, 1); c.fillRect(x + 4, y - 1, 2, 1);
  }
  const mixHex = (a, b, t) => {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const f = (s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
    return '#' + ((1 << 24) | (f(16) << 16) | (f(8) << 8) | f(0)).toString(16).slice(1);
  };
  const okHex = (v, d) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : d);
  const hash1 = (n) => { n = (n ^ 61) ^ (n >>> 16); n = (n + (n << 3)) | 0; n ^= n >>> 4; n = Math.imul(n, 0x27d4eb2d); n ^= n >>> 15; return (n >>> 0) / 4294967296; };
  const ease = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const TAU = Math.PI * 2;

  /* ------------------------------------------------------------------- GAME */
  class Game {
    constructor(canvas, project, opts) {
      opts = opts || {};
      this.cv = canvas;
      this.ctx = canvas.getContext('2d');
      this.p = project;
      this.opts = opts;
      this.s = project.settings;
      canvas.width = this.s.width;
      canvas.height = this.s.height;
      this.ctx.imageSmoothingEnabled = false;
      this.audio = opts.audio || createAudio();
      this.W = this.s.width; this.H = this.s.height;
      this.sprites = {}; this.objs = {}; this.sounds = {}; this.musics = {};
      (project.sprites || []).forEach((sp) => { this.sprites[sp.id] = { def: sp, imgs: [] }; });
      (project.objects || []).forEach((o) => { this.objs[o.id] = o; });
      (project.sounds || []).forEach((s) => { this.sounds[s.id] = s; });
      (project.music || []).forEach((m) => { this.musics[m.id] = m; });
      this.held = {}; this.pressed = {}; this.released = {}; this.rawHeld = {};
      this.state = 'loading';
      this.vars = {}; this.insts = []; this.nid = 0;
      this.parts = []; this.floats = []; this.rings = [];
      this.cam = { x: 0, y: 0 }; this.lead = 0; this.shake = { a: 0, t: 0, d: 1 };
      this.time = 0; this.respawnT = 0; this.dying = false; this.freeze = 0; this.flash = { a: 0, c: '255,255,255' };
      this.checkpoint = null; this.endText = ''; this.banner = 0; this.trans = null; this.menu = null; this.hits = [];
      this.stats = { time: 0, deaths: 0 }; this.hv = {}; this.pop = {}; this.newBest = false;
      this.running = false; this._raf = 0; this._acc = 0; this._last = 0;
      this._onKey = this._onKey.bind(this);
      this._onKeyUp = this._onKeyUp.bind(this);
      this._onClick = this._onClick.bind(this);
      this._onMove = this._onMove.bind(this);
      this._onVis = this._onVis.bind(this);
      this._frame = this._frame.bind(this);
    }

    /* ---- asset loading ---- */
    load() {
      const jobs = [];
      Object.keys(this.sprites).forEach((id) => {
        const sp = this.sprites[id];
        sp.imgs = sp.def.frames.map((src) => new Promise((res) => {
          const im = new Image();
          im.onload = () => res(im);
          im.onerror = () => res(null);
          im.src = src;
        }));
        jobs.push(Promise.all(sp.imgs).then((ims) => { sp.imgs = ims; }));
      });
      return Promise.all(jobs).then(() => { this.openTitle(); return this; });
    }

    /* ---- lifecycle ---- */
    start() {
      if (this.running) return;
      this.running = true;
      root.addEventListener('keydown', this._onKey);
      root.addEventListener('keyup', this._onKeyUp);
      this.cv.addEventListener('pointerdown', this._onClick);
      this.cv.addEventListener('pointermove', this._onMove);
      if (root.document) root.document.addEventListener('visibilitychange', this._onVis);
      this._last = (root.performance || Date).now();
      this._raf = root.requestAnimationFrame(this._frame);
    }
    stop() {
      this.running = false;
      root.cancelAnimationFrame && root.cancelAnimationFrame(this._raf);
      root.removeEventListener('keydown', this._onKey);
      root.removeEventListener('keyup', this._onKeyUp);
      this.cv.removeEventListener('pointerdown', this._onClick);
      this.cv.removeEventListener('pointermove', this._onMove);
      if (root.document) root.document.removeEventListener('visibilitychange', this._onVis);
      this.audio.stopMusic();
    }
    _onVis() { if (root.document.hidden && this.state === 'play') this.openPause(); }
    _frame(now) {
      if (!this.running) return;
      const dt = Math.min(0.1, (now - this._last) / 1000);
      this._last = now;
      this._acc += dt;
      let n = 0;
      while (this._acc >= 1 / 60 && n < 5) { this.tick(1 / 60); this._acc -= 1 / 60; n++; }
      if (n === 5) this._acc = 0;
      this.render();
      this._raf = root.requestAnimationFrame(this._frame);
    }

    /* ---- input ---- */
    _onKey(e) {
      const groups = CODE_TO_GROUPS[e.code];
      if (groups || e.code === 'Enter' || e.code === 'Escape') {
        if (e.code !== 'Escape' || this.state !== 'title') e.preventDefault();
      }
      if (e.repeat) return;
      this.rawHeld[e.code] = true;
      if (groups) groups.forEach((g) => { this.held[g] = true; this.pressed[g] = true; });
      if (e.code === 'Enter' || e.code === 'Space') this.pressed.confirm = true;
      if (e.code === 'Escape') this.pressed.pause = true;
      if (e.code === 'KeyM') { this.audio.setMuted(!this.audio.muted); this.refreshMenuLabels(); }
    }
    _onKeyUp(e) {
      delete this.rawHeld[e.code];
      const groups = CODE_TO_GROUPS[e.code];
      if (groups) groups.forEach((g) => {
        if (!KEY_GROUPS[g].some((c) => this.rawHeld[c])) { this.held[g] = false; this.released[g] = true; }
      });
    }
    _pt(e) {
      const r = this.cv.getBoundingClientRect();
      return { x: (e.clientX - r.left) / r.width * this.W, y: (e.clientY - r.top) / r.height * this.H };
    }
    _hit(p) { for (const h of this.hits) if (p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h) return h; return null; }
    _onMove(e) {
      if (!this.menu) return;
      const h = this._hit(this._pt(e));
      if (h && this.menu.sel !== h.i) { this.menu.sel = h.i; this.ui('blip'); }
    }
    _onClick(e) {
      this.audio.ensure();
      if (!this.menu) return;
      const h = this._hit(this._pt(e));
      if (h) { this.menu.sel = h.i; this.pressed.confirm = true; }
      else if (this.state === 'title') { this.menu.sel = 0; this.pressed.confirm = true; }
    }
    // programmatic input (used by tests, touch buttons, etc.)
    press(g) { this.held[g] = true; this.pressed[g] = true; if (g === 'jump') this.pressed.confirm = true; }
    release(g) { this.held[g] = false; this.released[g] = true; }
    ui(name, vol) { const p = SFX_PRESETS[name]; if (p) this.audio.playSfx(p, vol == null ? 0.7 : vol); }

    /* ---- menus ---- */
    setMenu(items) { this.menu = { items, sel: 0 }; this.hits = []; }
    refreshMenuLabels() { if (this.menu) this.menu.items.forEach((it) => { if (it.dyn) it.label = it.dyn(); }); }
    stepMenu(P) {
      const m = this.menu; if (!m) return;
      const n = m.items.length;
      if (P.up) { m.sel = (m.sel + n - 1) % n; this.ui('blip'); }
      if (P.down) { m.sel = (m.sel + 1) % n; this.ui('blip'); }
      if (P.confirm) { const it = m.items[m.sel]; if (it) { this.ui('coin', 0.5); it.act(); this.refreshMenuLabels(); } }
    }
    soundItem() { const it = { label: '', act: () => this.audio.setMuted(!this.audio.muted), dyn: () => 'SOUND: ' + (this.audio.muted ? 'OFF' : 'ON') }; it.label = it.dyn(); return it; }
    openTitle() {
      this.state = 'title'; this.level = null; this.audio.stopMusic();
      const items = [{ label: 'START', act: () => this.newGame() }, this.soundItem()];
      this.setMenu(items);
    }
    openPause() {
      if (this.state !== 'play') return;
      this.state = 'paused'; this.ui('blip');
      const items = [{ label: 'RESUME', act: () => { this.state = 'play'; this.menu = null; } },
        { label: 'RESTART LEVEL', act: () => { this.state = 'play'; this.menu = null; this.stats.deaths++; this.restartLevel(); } }, this.soundItem()];
      if (!this.opts.skipTitle) items.push({ label: 'QUIT TO TITLE', act: () => { this.menu = null; this.openTitle(); } });
      this.setMenu(items);
    }
    bestKey() { return '2plat.best.' + String(this.s.title || this.p.name || 'game'); }
    best() { try { return Number(root.localStorage.getItem(this.bestKey())) || 0; } catch (e) { return 0; } }
    saveBest() {
      this.newBest = false;
      if (this.vars.score === undefined) return;
      const b = this.best();
      if (this.vars.score > b) { this.newBest = b > 0; try { root.localStorage.setItem(this.bestKey(), String(this.vars.score)); } catch (e) { /* storage blocked */ } }
    }

    /* ---- game flow ---- */
    newGame() {
      this.vars = {}; this.hv = {}; this.pop = {};
      (this.s.vars || []).forEach((v) => { this.vars[v.name] = Number(v.value) || 0; });
      this.checkpoint = null; this.stats = { time: 0, deaths: 0 }; this.menu = null; this.parts = []; this.rings = [];
      this.state = 'play';
      this.loadLevel(this.opts.startLevel != null ? this.opts.startLevel : (this.s.startLevel || 0));
    }
    endGame(kind, text) {
      if (this.state !== 'play') return;
      this.state = kind;
      this.endText = text || '';
      this.audio.stopMusic();
      this.saveBest();
      this.endT = 0;
      if (kind === 'win') this.ui('powerup', 0.8);
      const items = [{ label: kind === 'win' ? 'PLAY AGAIN' : 'TRY AGAIN', act: () => { this.menu = null; this.newGame(); } }];
      if (!this.opts.skipTitle) items.push({ label: 'TITLE', act: () => { this.menu = null; this.openTitle(); } });
      this.setMenu(items);
    }
    goLevel(fn) {
      const pl = this.findPlayer();
      if (this.trans) return;
      this.trans = { dir: 'out', t: 0, dur: 0.42, then: fn, cx: pl ? pl.x + pl.w / 2 - this.cam.x : this.W / 2, cy: pl ? pl.y + pl.h / 2 - this.cam.y : this.H / 2 };
    }
    nextLevel() {
      if (this.levelIdx + 1 < this.p.levels.length) this.goLevel(() => { this.checkpoint = null; this.loadLevel(this.levelIdx + 1); });
      else this.endGame('win', 'You finished the game!');
    }
    loseLife() {
      if (this.dying || this.state !== 'play') return;
      this.vars.lives = (this.vars.lives == null ? 1 : this.vars.lives) - 1;
      this.stats.deaths++;
      this.shake = { a: 5, t: 0.35, d: 0.35 }; this.freeze = 8; this.flash = { a: 0.55, c: '255,70,90' };
      this.insts.forEach((i) => { if (this.isPlayer(i) && !i.dead) { this.spawnFx(i, 'burst'); this.spawnFx(i, 'burst', '#ffffff'); i.dead = true; } });
      this.sfxByName('death');
      if (this.vars.lives <= 0) { this.endGame('gameover', 'Out of lives'); return; }
      this.dying = true; this.respawnT = 0.9;
    }
    sfxByName(n) { const s = this.sounds && Object.values(this.sounds).find((x) => x.name === n); if (s) this.audio.playSfx(s); }
    isPlayer(i) { return i.obj.isPlayer || i.obj.behavior === 'platformer' || i.obj.behavior === 'topdown'; }

    loadLevel(idx) {
      const L = this.p.levels[idx];
      if (!L) return;
      this.levelIdx = idx; this.level = L;
      this.tile = this.s.tileSize || 16;
      this.lw = L.w * this.tile; this.lh = L.h * this.tile;
      this.insts = []; this.grid = new Map(); this.movers = [];
      this.parts = []; this.floats = []; this.rings = []; this.dying = false; this.stamp = 0; this.dirty = true; this.freeze = 0;
      for (const it of L.instances) {
        const o = this.objs[it.obj];
        if (o) this.spawn(o, it.x, it.y, { quiet: true });
      }
      this.insts.slice().forEach((i) => this.fire(i, 'create'));
      const pl = this.findPlayer();
      if (this.checkpoint && this.checkpoint.level === idx && pl) { pl.x = this.checkpoint.x; pl.y = this.checkpoint.y; }
      if (pl) { this.cam.x = pl.x + pl.w / 2 - this.W / 2; this.cam.y = pl.y + pl.h / 2 - this.H / 2; }
      this.lead = 0; this.clampCam();
      this.banner = 2.4;
      this.trans = { dir: 'in', t: 0, dur: 0.5, cx: pl ? pl.x + pl.w / 2 - this.cam.x : this.W / 2, cy: pl ? pl.y + pl.h / 2 - this.cam.y : this.H / 2 };
      const m = this.musics[L.music || this.s.music];
      this.audio.playMusic(m || null);
    }
    restartLevel() { this.loadLevel(this.levelIdx); }

    /* ---- instances ---- */
    spawn(o, x, y, extra) {
      extra = extra || {};
      const sp = this.sprites[o.spriteId];
      const w = sp ? sp.def.w : (o.w || 16), h = sp ? sp.def.h : (o.h || 16);
      const i = {
        id: ++this.nid, obj: o, x, y, w, h, hb: this.hitbox(o, w, h),
        vx: extra.vx || 0, vy: extra.vy || 0, dir: extra.dir || 1,
        dead: false, onGround: false, hitX: 0, hitY: 0, wasGround: false, landed: false,
        vars: {}, timers: {}, touch: {}, t: 0, animT: 0, spr: o.spriteId,
        coyote: 0, jumpBuf: 0, jumps: 0, ox: x, oy: y, mdx: 0, mdy: 0, flash: 0, sx: 1, sy: 1, fall: 0, dust: 0,
      };
      this.insts.push(i);
      this.dirty = true;
      if (o.solid) {
        if (o.behavior === 'oscillate') this.movers.push(i); else this.gridAdd(i);
      }
      if (o.behavior === 'bullet' && !i.vx && !i.vy) i.vx = ((o.props && o.props.speed) || 200) * i.dir;
      i.life = o.behavior === 'bullet' ? ((o.props && o.props.life) || 3) : 0;
      if (!extra.quiet) this.fire(i, 'create');
      return i;
    }
    hitbox(o, w, h) {
      const b = o.hitBox;
      if (b && Number(b.w) > 0 && Number(b.h) > 0) return { x: Number(b.x) || 0, y: Number(b.y) || 0, w: Number(b.w), h: Number(b.h) };
      const n = o.hit || 0;
      return { x: n, y: n, w: w - n * 2, h: h - n * 2 };
    }
    box(i) { return { x: i.x + i.hb.x, y: i.y + i.hb.y, w: i.hb.w, h: i.hb.h }; }
    bottom(i) { return i.y + i.hb.y + i.hb.h; }
    center(i) { return { x: i.x + i.w / 2, y: i.y + i.h / 2 }; }
    findPlayer() { for (const i of this.insts) if (!i.dead && this.isPlayer(i)) return i; return null; }

    kill(i, quiet) {
      if (i.dead) return;
      i.dead = true;
      if (!quiet) this.fire(i, 'destroy');
      this.spawnFx(i, i.obj.destroyFx);
      if (!quiet && i.obj.category === 'enemies') { this.freeze = Math.max(this.freeze, 3); if (this.shake.t <= 0) this.shake = { a: 1.6, t: 0.14, d: 0.14 }; }
    }

    /* ---- solid grid ---- */
    gridAdd(i) {
      const b = this.box(i), C = 32;
      for (let cx = Math.floor(b.x / C); cx <= Math.floor((b.x + b.w - 0.001) / C); cx++)
        for (let cy = Math.floor(b.y / C); cy <= Math.floor((b.y + b.h - 0.001) / C); cy++) {
          const k = cx + ',' + cy;
          let a = this.grid.get(k); if (!a) this.grid.set(k, (a = []));
          a.push(i);
        }
    }
    solidsIn(b, self) {
      const C = 32, out = []; const st = ++this.stamp;
      for (let cx = Math.floor(b.x / C); cx <= Math.floor((b.x + b.w) / C); cx++)
        for (let cy = Math.floor(b.y / C); cy <= Math.floor((b.y + b.h) / C); cy++) {
          const a = this.grid.get(cx + ',' + cy);
          if (!a) continue;
          for (const s of a) if (!s.dead && s._q !== st && s !== self) { s._q = st; out.push(s); }
        }
      for (const m of this.movers) if (!m.dead && m !== self) out.push(m);
      return out;
    }
    solidAt(px, py) {
      const pt = { x: px, y: py, w: 0.1, h: 0.1 };
      return this.solidsIn(pt, null).some((s) => overlap(pt, this.box(s)));
    }

    /* ---- movement ---- */
    moveX(i, dx) {
      i.hitX = 0;
      if (!dx) return;
      i.x += dx;
      let b = this.box(i);
      for (const s of this.solidsIn(b, i)) {
        if (s.obj.oneWay) continue;
        const sb = this.box(s);
        if (overlap(b, sb)) {
          if (dx > 0) { i.x = sb.x - (i.hb.x + i.hb.w); i.hitX = 1; }
          else { i.x = sb.x + sb.w - i.hb.x; i.hitX = -1; }
          i.vx = 0 * i.vx;
          b = this.box(i);
        }
      }
    }
    moveY(i, dy) {
      i.hitY = 0;
      if (!dy) return;
      const prevBottom = this.bottom(i);
      i.y += dy;
      let b = this.box(i);
      for (const s of this.solidsIn(b, i)) {
        const sb = this.box(s);
        if (!overlap(b, sb)) continue;
        if (s.obj.oneWay) {
          if (dy > 0 && prevBottom <= sb.y + 0.5 && !(this.rawHeld.ArrowDown && i.obj.behavior === 'platformer')) {
            i.y = sb.y - (i.hb.y + i.hb.h); i.hitY = 1; i.vy = 0; i.onGround = true; b = this.box(i);
          }
          continue;
        }
        if (dy > 0) { i.y = sb.y - (i.hb.y + i.hb.h); i.hitY = 1; i.onGround = true; i.vy = 0; }
        else { i.y = sb.y + sb.h - i.hb.y; i.hitY = -1; i.vy = 0; }
        b = this.box(i);
      }
    }

    /* ---- main update ---- */
    tick(dt) {
      this.time += dt;
      const P = this.pressed;
      if (this.state === 'title') {
        if (this.opts.skipTitle && !this.menu) this.newGame(); else if (this.opts.skipTitle) this.newGame(); else this.stepMenu(P);
      } else if (this.state === 'gameover' || this.state === 'win') {
        this.endT += dt; this.stepMenu(P);
        if (this.state === 'win' && Math.random() < 0.35) this.confetti();
        this.stepParts(dt);
      } else if (this.state === 'paused') {
        if (P.pause) { this.state = 'play'; this.menu = null; } else this.stepMenu(P);
      } else if (this.state === 'play') {
        if (this.trans && this.trans.dir === 'out') {
          this.trans.t += dt; this.stepParts(dt);
          if (this.trans.t >= this.trans.dur) { const fn = this.trans.then; this.trans = null; if (fn) fn(); }
        } else if (P.pause && !this.trans) this.openPause();
        else {
          if (this.trans) { this.trans.t += dt; if (this.trans.t >= this.trans.dur) this.trans = null; }
          if (this.freeze > 0) { this.freeze--; if (this.shake.t > 0) this.shake.t -= dt * 0.5; } else this.update(dt);
        }
      }
      this.pressed = {}; this.released = {};
    }

    update(dt) {
      this.stats.time += dt;
      if (this.banner > 0) this.banner -= dt;
      if (this.flash.a > 0) this.flash.a = Math.max(0, this.flash.a - dt * 2.2);
      if (this.dying) { this.respawnT -= dt; if (this.respawnT <= 0) this.restartLevel(); }

      // index instances by object for collision rules
      this.byObj = new Map();
      for (const i of this.insts) {
        if (i.dead) continue;
        let a = this.byObj.get(i.obj.id); if (!a) this.byObj.set(i.obj.id, (a = []));
        a.push(i);
      }
      const G = this.s.gravity == null ? 900 : this.s.gravity;
      const list = this.insts.slice();
      // movers first so riders can follow them
      for (const i of list) if (!i.dead && i.obj.behavior === 'oscillate') this.stepOscillate(i, dt);
      for (const i of list) {
        if (i.dead || i.obj.behavior === 'oscillate') continue;
        i.t += dt; i.animT += dt;
        i.wasGround = i.onGround; i.onGround = false;
        this.behave(i, dt);
        if (i.obj.gravity) {
          let gs = (i.obj.props && i.obj.props.gravityScale) || 1;
          // a little hang time at the top of a held jump
          if (i.obj.behavior === 'platformer' && this.held.jump && Math.abs(i.vy) < 45) gs *= 0.62;
          i.fall = i.vy;
          i.vy = Math.min(i.vy + G * gs * dt, 420);
        }
        if (i.obj.collideSolids) {
          this.moveX(i, i.vx * dt);
          this.moveY(i, i.vy * dt);
        } else { i.x += i.vx * dt; i.y += i.vy * dt; i.hitX = 0; i.hitY = 0; }
        if (!i.onGround && i.obj.collideSolids && i.vy >= 0) {
          // standing on a mover: re-detect ground contact
          const b = this.box(i); b.y += 1;
          for (const m of this.movers) if (!m.dead && overlap(b, this.box(m)) && this.bottom(i) <= m.y + m.hb.y + 2) i.onGround = true;
        }
        i.landed = i.onGround && !i.wasGround;
        if (i.landed && this.isPlayer(i)) {
          this.sfxByName('land');
          const f = clamp(i.fall / 300, 0, 1);
          if (i.obj.behavior === 'platformer') { i.sx = 1 + 0.35 * f + 0.05; i.sy = 1 - 0.3 * f - 0.05; if (f > 0.25) this.dust(i, 5 + Math.round(f * 4)); }
        }
        if (i.obj.behavior === 'platformer' && i.onGround && Math.abs(i.vx) > 55) {
          i.dust -= dt; if (i.dust <= 0) { i.dust = 0.11; this.dust(i, 1, -i.dir); }
        }
        // settle squash & stretch back to normal
        if (i.sx !== 1 || i.sy !== 1) { const k = Math.min(1, dt * 14); i.sx += (1 - i.sx) * k; i.sy += (1 - i.sy) * k; if (Math.abs(i.sx - 1) < 0.01) i.sx = 1; if (Math.abs(i.sy - 1) < 0.01) i.sy = 1; }
        if (i.life > 0) { i.life -= dt; if (i.life <= 0) this.kill(i, true); }
        if (i.obj.behavior === 'bullet' && (i.hitX || i.hitY)) this.kill(i);
      }
      for (const i of list) if (!i.dead) this.runRules(i, dt);
      this.insts = this.insts.filter((i) => !i.dead);

      // lives
      if (this.vars.lives != null && this.vars.lives <= 0 && !this.dying) this.endGame('gameover', 'Out of lives');

      this.stepParts(dt);
      for (const k in this.vars) { if (this.hv[k] !== undefined && this.vars[k] > this.hv[k]) this.pop[k] = 0.35; this.hv[k] = this.vars[k]; }
      for (const k in this.pop) { this.pop[k] -= dt; if (this.pop[k] <= 0) delete this.pop[k]; }

      // camera: smooth follow with look-ahead in the direction of travel
      const pl = this.findPlayer();
      if (pl) {
        const platform = pl.obj.behavior === 'platformer';
        const wantLead = platform ? clamp(pl.vx * 0.28, -30, 30) : clamp(pl.vx * 0.2, -16, 16);
        this.lead += (wantLead - this.lead) * Math.min(1, dt * 2.6);
        const tx = pl.x + pl.w / 2 - this.W / 2 + this.lead;
        const ty = pl.y + pl.h / 2 - this.H / 2 - (platform ? 8 : 0);
        this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 6.5);
        this.cam.y += (ty - this.cam.y) * Math.min(1, dt * (platform && !pl.onGround ? 3 : 6));
      }
      this.clampCam();
    }
    stepParts(dt) {
      for (const p of this.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g == null ? 300 : p.g) * dt; p.vx *= p.drag || 1; }
      this.parts = this.parts.filter((p) => p.life > 0);
      for (const f of this.floats) { f.life -= dt; f.y -= 16 * dt; f.age = (f.age || 0) + dt; }
      this.floats = this.floats.filter((f) => f.life > 0);
      for (const r of this.rings) r.t += dt;
      this.rings = this.rings.filter((r) => r.t < r.max);
      if (this.shake.t > 0) this.shake.t -= dt;
    }
    clampCam() {
      const mx = this.lw - this.W, my = this.lh - this.H;
      this.cam.x = mx <= 0 ? mx / 2 : clamp(this.cam.x, 0, mx);
      this.cam.y = my <= 0 ? my / 2 : clamp(this.cam.y, 0, my);
    }

    stepOscillate(i, dt) {
      i.t += dt; i.animT += dt;
      const p = i.obj.props || {}, per = p.period || 3, d = p.dist || 48;
      const s = Math.sin((i.t / per) * Math.PI * 2) * d;
      const nx = p.axis === 'y' ? i.ox : i.ox + s, ny = p.axis === 'y' ? i.oy + s : i.oy;
      const dx = nx - i.x, dy = ny - i.y;
      if (i.obj.solid) {
        const top = i.y + i.hb.y;
        for (const a of this.insts) {
          if (a.dead || a === i || !a.obj.collideSolids) continue;
          const ab = this.box(a), mb = this.box(i);
          const standing = Math.abs(this.bottom(a) - top) <= 2.5 && ab.x < mb.x + mb.w && ab.x + ab.w > mb.x && a.vy >= 0;
          if (standing) { this.moveX(a, dx); a.y += dy; a.onGround = true; }
        }
      }
      i.x = nx; i.y = ny;
    }

    /* ---- behaviors ---- */
    behave(i, dt) {
      const o = i.obj, p = o.props || {}, hd = this.held, b = o.behavior;
      if (b === 'platformer') {
        const sp = p.speed || 90, acc = (i.wasGround ? 1 : 0.65) * (p.accel || 800);
        const ax = (hd.right ? 1 : 0) - (hd.left ? 1 : 0);
        const target = ax * sp;
        const dv = clamp(target - i.vx, -acc * dt, acc * dt);
        i.vx += dv;
        if (ax) i.dir = ax;
        // ground / coyote
        if (i.wasGround || i.onGround) { i.coyote = 0.1; i.jumps = 0; } else i.coyote -= dt;
        if (this.pressed.jump) i.jumpBuf = 0.1; else i.jumpBuf -= dt;
        const maxJ = p.maxJumps || 1;
        if (i.jumpBuf > 0) {
          if (i.coyote > 0) { i.vy = -(p.jump || 270); i.jumps = 1; i.coyote = 0; i.jumpBuf = 0; i.sx = 0.72; i.sy = 1.32; this.dust(i, 4); this.sfxByName('jump'); }
          else if (i.jumps < maxJ && i.jumps > 0) { i.vy = -(p.jump || 270) * 0.9; i.jumps++; i.jumpBuf = 0; i.sx = 0.75; i.sy = 1.28; this.ring(i, '#ffffff', 10); this.sfxByName('jump'); }
        }
        if (this.released.jump && i.vy < -60) i.vy *= 0.45;
      } else if (b === 'topdown') {
        const sp = p.speed || 80;
        const ax = (hd.right ? 1 : 0) - (hd.left ? 1 : 0), ay = (hd.down ? 1 : 0) - (hd.up ? 1 : 0);
        const l = Math.hypot(ax, ay) || 1;
        i.vx = (ax / l) * sp; i.vy = (ay / l) * sp;
        if (ax) i.dir = ax;
      } else if (b === 'patrol') {
        const sp = p.speed || 30;
        if (i.hitX) i.dir = -i.dir;
        else if (p.edge !== false && i.wasGround && i.obj.gravity) {
          const fx = i.dir > 0 ? i.x + i.hb.x + i.hb.w + 1 : i.x + i.hb.x - 1;
          if (!this.solidAt(fx, this.bottom(i) + 2)) i.dir = -i.dir;
        }
        i.vx = i.dir * sp;
      } else if (b === 'chaser') {
        const pl = this.findPlayer(), sp = p.speed || 40, range = p.range || 120;
        if (pl) {
          const a = this.center(i), c = this.center(pl), d = Math.hypot(c.x - a.x, c.y - a.y);
          if (d < range && d > 1) {
            i.vx = ((c.x - a.x) / d) * sp;
            i.vy = i.obj.gravity ? i.vy : ((c.y - a.y) / d) * sp;
            i.dir = c.x >= a.x ? 1 : -1;
          } else { i.vx = 0; if (!i.obj.gravity) i.vy = 0; }
        }
      } else if (b === 'bounce') {
        const sp = p.speed || 60;
        // remembered velocity (a collision zeroes vx/vy), reflected on contact
        if (!i.init) { i.init = true; i.pvx = sp; i.pvy = -sp; }
        if (i.hitX) i.pvx = -i.pvx;
        if (i.hitY) i.pvy = -i.pvy;
        i.vx = i.pvx; i.vy = i.pvy;
      } else if (b === 'turret') {
        const pl = this.findPlayer(), range = p.range || 140;
        i.timers.shoot = (i.timers.shoot || 0) + dt;
        if (pl) i.dir = pl.x >= i.x ? 1 : -1;
        const near = !pl || Math.hypot(pl.x - i.x, pl.y - i.y) < range;
        if (near && i.timers.shoot >= (p.interval || 1.5)) {
          i.timers.shoot = 0;
          const bo = this.objs[p.bullet];
          if (bo) {
            const c = this.center(i);
            const bs = (bo.props && bo.props.speed) || 100;
            this.spawn(bo, c.x - 4 + i.dir * (i.w / 2), c.y - 4, { vx: bs * i.dir, dir: i.dir });
            this.sfxByName('laser');
          }
        }
      }
    }

    /* ---- rules ---- */
    getVar(n, i) {
      if (typeof n === 'string' && n.startsWith('self.')) return (i && i.vars[n.slice(5)]) || 0;
      return this.vars[n] || 0;
    }
    setVar(n, v, i) {
      if (typeof n === 'string' && n.startsWith('self.')) { if (i) i.vars[n.slice(5)] = v; } else this.vars[n] = v;
    }
    cond(r, i) {
      const c = r.cond;
      if (!c || !c.var) return true;
      const a = this.getVar(c.var, i), b = Number(c.value) || 0;
      switch (c.op) {
        case '==': return a === b; case '!=': return a !== b;
        case '>': return a > b; case '>=': return a >= b;
        case '<': return a < b; case '<=': return a <= b;
        default: return true;
      }
    }
    fire(i, ev) {
      const rules = i.obj.rules; if (!rules) return;
      for (const r of rules) if (r.event === ev && this.cond(r, i)) this.exec(r.actions, { self: i, other: null });
    }
    runRules(i, dt) {
      const rules = i.obj.rules; if (!rules || !rules.length) return;
      for (let k = 0; k < rules.length; k++) {
        if (i.dead) return;
        const r = rules[k];
        switch (r.event) {
          case 'step': if (this.cond(r, i)) this.exec(r.actions, { self: i }); break;
          case 'keypress': if (this.pressedPrev(r.key) && this.cond(r, i)) this.exec(r.actions, { self: i }); break;
          case 'keyhold': if (this.held[r.key] && this.cond(r, i)) this.exec(r.actions, { self: i }); break;
          case 'timer':
            i.timers['r' + k] = (i.timers['r' + k] || 0) + dt;
            if (i.timers['r' + k] >= (r.seconds || 1)) { i.timers['r' + k] = 0; if (this.cond(r, i)) this.exec(r.actions, { self: i }); }
            break;
          case 'landed': if (i.landed && this.cond(r, i)) this.exec(r.actions, { self: i }); break;
          case 'hitwall': if ((i.hitX || i.hitY) && this.cond(r, i)) this.exec(r.actions, { self: i }); break;
          case 'outside':
            if ((i.x + i.w < -8 || i.y > this.lh + 32 || i.x > this.lw + 8 || i.y + i.h < -64) && this.cond(r, i)) this.exec(r.actions, { self: i });
            break;
          case 'collision': {
            const targets = this.byObj && this.byObj.get(r.target);
            const prev = i.touch[k] || {}, now = {};
            if (targets) {
              const a = this.box(i);
              for (const t of targets) {
                if (t === i || t.dead) continue;
                if (!overlap(a, this.box(t))) continue;
                now[t.id] = true;
                if (r.once !== false && prev[t.id]) continue;
                if (r.where && r.where !== 'any') {
                  const stomp = i.vy > 0 && this.bottom(i) - t.y <= t.h * 0.6 + 4;
                  if (r.where === 'stomp' && !stomp) continue;
                  if (r.where === 'side' && stomp) continue;
                }
                if (!this.cond(r, i)) continue;
                this.exec(r.actions, { self: i, other: t });
                if (i.dead) break;
              }
            }
            i.touch[k] = now;
            break;
          }
          default: break;
        }
      }
    }
    // pressed flags are cleared at the end of tick(), so they are still readable here
    pressedPrev(k) { return !!this.pressed[k]; }

    exec(actions, ctx) {
      if (!actions) return;
      for (const a of actions) this.act(a, ctx);
    }
    act(a, ctx) {
      const s = ctx.self, o = ctx.other;
      switch (a.type) {
        case 'var': {
          const cur = this.getVar(a.name, s), v = Number(a.value) || 0;
          let n = cur;
          if (a.op === 'set') n = v; else if (a.op === 'add') n = cur + v; else if (a.op === 'sub') n = cur - v;
          else if (a.op === 'mul') n = cur * v; else if (a.op === 'toggle') n = cur ? 0 : 1;
          this.setVar(a.name, n, s);
          break;
        }
        case 'destroy': { const t = a.who === 'other' ? o : s; if (t) this.kill(t); break; }
        case 'spawn': {
          const bo = this.objs[a.obj]; if (!bo || !s) break;
          const c = this.center(s), dir = s.dir || 1;
          const sp = this.sprites[bo.spriteId], bw = sp ? sp.def.w : (bo.w || 16), bh = sp ? sp.def.h : (bo.h || 16);
          this.spawn(bo, c.x - bw / 2 + (Number(a.ox) || 0) * dir, c.y - bh / 2 + (Number(a.oy) || 0),
            { vx: (Number(a.vx) || 0) * dir, vy: Number(a.vy) || 0, dir });
          break;
        }
        case 'sound': this.audio.playSfx(this.sounds[a.sound]); break;
        case 'music': this.audio.playMusic(this.musics[a.music] || null); break;
        case 'level':
          if (a.to === 'next') this.nextLevel();
          else if (a.to === 'restart') this.goLevel(() => this.restartLevel());
          else if (a.to === 'first') this.goLevel(() => { this.checkpoint = null; this.loadLevel(0); });
          else this.goLevel(() => { this.checkpoint = null; this.loadLevel(clamp(Number(a.index) || 0, 0, this.p.levels.length - 1)); });
          break;
        case 'text': if (s) this.floats.push({ x: s.x + s.w / 2, y: s.y - 2, text: String(a.text || ''), life: 1.2, age: 0 }); break;
        case 'velocity': {
          if (!s) break;
          const vx = a.vx === '' || a.vx == null ? null : Number(a.vx), vy = a.vy === '' || a.vy == null ? null : Number(a.vy);
          if (vx != null) s.vx = a.mode === 'add' ? s.vx + vx * s.dir : vx * (a.mode === 'abs' ? 1 : s.dir);
          if (vy != null) s.vy = a.mode === 'add' ? s.vy + vy : vy;
          break;
        }
        case 'jump': if (s) { s.vy = -(Number(a.power) || 250); s.onGround = false; s.coyote = 0; } break;
        case 'shake': { const t = Number(a.time) || 0.25; this.shake = { a: Number(a.amount) || 3, t, d: t }; break; }
        case 'win': this.endGame('win', a.text); break;
        case 'gameover': this.endGame('gameover', a.text); break;
        case 'loseLife': this.loseLife(); break;
        case 'teleport': if (s) { s.x = (Number(a.x) || 0) * this.tile; s.y = (Number(a.y) || 0) * this.tile; s.vx = s.vy = 0; } break;
        case 'flip': if (s) s.dir = -s.dir; break;
        case 'checkpoint': if (s) this.checkpoint = { level: this.levelIdx, x: s.x, y: s.y }; break;
        case 'particles': if (s) this.spawnFx(s, 'burst', a.color); break;
        default: break;
      }
    }

    /* ---- effects ---- */
    spawnFx(i, kind, color) {
      if (!kind || kind === 'none') return;
      const c = this.center(i), big = kind === 'burst', n = big ? 18 : 9, col = color || i.obj.fxColor || i.obj.color || '#ffffff';
      for (let k = 0; k < n; k++) {
        const a = Math.random() * TAU, sp = (big ? 95 : 48) * (0.35 + Math.random());
        const life = 0.3 + Math.random() * 0.35;
        this.parts.push({ x: c.x, y: c.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 34, life, max: life, c: k % 4 === 0 ? '#ffffff' : col, size: big ? 1 + (Math.random() * 2 | 0) : 1 + (k % 2), drag: 0.985 });
      }
      this.ring(i, col, big ? 18 : 12);
    }
    ring(i, color, r) { const c = this.center(i); this.rings.push({ x: c.x, y: c.y, t: 0, max: 0.28, r, c: color }); }
    dust(i, n, dir) {
      const bx = i.x + i.hb.x + i.hb.w / 2, by = this.bottom(i);
      for (let k = 0; k < n; k++) {
        const life = 0.2 + Math.random() * 0.2;
        this.parts.push({ x: bx + (Math.random() - 0.5) * 8, y: by - 1, vx: (dir ? dir * 18 : (Math.random() - 0.5) * 50) + (Math.random() - 0.5) * 12, vy: -8 - Math.random() * 16, life, max: life, c: '#e8ecf5', size: 1 + (k % 2), g: 20, drag: 0.96, soft: true });
      }
    }
    confetti() {
      const cols = ['#ffcd75', '#ef7d57', '#a7f070', '#73eff7', '#ff6bd6', '#ffffff'];
      const life = 1.6 + Math.random();
      this.parts.push({ x: Math.random() * this.W, y: -4, vx: (Math.random() - 0.5) * 30, vy: 20 + Math.random() * 30, life, max: life, c: cols[(Math.random() * cols.length) | 0], size: 2, g: 14, drag: 1, screen: true });
    }

    /* ---- drawing ---- */
    curSprite(i) {
      const o = i.obj;
      if (o.behavior === 'platformer') {
        if (!i.onGround && o.jumpSpriteId && this.sprites[o.jumpSpriteId]) return o.jumpSpriteId;
        if (Math.abs(i.vx) > 8 && o.runSpriteId && this.sprites[o.runSpriteId]) return o.runSpriteId;
      } else if (o.behavior === 'topdown') {
        if ((Math.abs(i.vx) + Math.abs(i.vy)) > 8 && o.runSpriteId && this.sprites[o.runSpriteId]) return o.runSpriteId;
      }
      return o.spriteId;
    }
    /** Parallax scenery behind the level: hills, city, stars, cave. Set per level in the Levels tab. */
    drawBackdrop(c, L, cx, cy) {
      const kind = L && L.backdrop; if (!kind || kind === 'none') return;
      const W = this.W, H = this.H, top = okHex(L.bg, '#1a1c2c'), bot = okHex(L.bg2, top), t = this.time;
      const shade = (k) => mixHex(bot, '#0b0d1c', 0.18 + k * 0.2);
      if (kind === 'hills') {
        [[0.12, 0.60, 22, 0.011, 0], [0.24, 0.72, 17, 0.017, 40], [0.42, 0.85, 13, 0.024, 90]].forEach(([f, hz, amp, fr, off], k) => {
          c.fillStyle = shade(k + 1);
          const base = H * hz - cy * f * 0.25;
          for (let x = 0; x < W; x += 2) {
            const wx = x + cx * f + off, y = Math.round(base + Math.sin(wx * fr) * amp + Math.sin(wx * fr * 2.7 + 1.3) * amp * 0.35);
            c.fillRect(x, y, 2, H - y);
          }
        });
      } else if (kind === 'city') {
        [[0.15, 0.58, 0], [0.3, 0.72, 7], [0.5, 0.86, 13]].forEach(([f, hz, seed], k) => {
          c.fillStyle = shade(k + 1);
          const bw = 18 + k * 4, off = cx * f, first = Math.floor(off / bw) - 1;
          for (let b = first; b < first + Math.ceil(W / bw) + 3; b++) {
            const bh = 26 + hash1(b * 31 + seed) * 70 * (1 - k * 0.2), x = Math.round(b * bw - off), y = Math.round(H * hz - bh * 0.6 - cy * f * 0.2);
            c.fillRect(x, y, bw - 2, H - y);
            if (k === 2) { c.fillStyle = mixHex('#ffe9a8', shade(k + 1), 0.55); for (let wy = y + 5; wy < y + bh && wy < H; wy += 8) for (let wx = x + 3; wx < x + bw - 5; wx += 6) if (hash1(b * 977 + wy * 13 + wx) > 0.55) c.fillRect(wx, wy, 2, 3); c.fillStyle = shade(k + 1); }
          }
        });
      } else if (kind === 'stars') {
        [[0.05, 60, 1, 11], [0.12, 36, 1, 23], [0.22, 18, 2, 37]].forEach(([f, n, sz, seed]) => {
          for (let s = 0; s < n; s++) {
            const x = ((hash1(s * 7 + seed) * W * 2 - cx * f) % W + W) % W, y = hash1(s * 13 + seed) * H * 0.85;
            const tw = 0.55 + 0.45 * Math.sin(t * (1 + hash1(s + seed) * 2) + s);
            c.globalAlpha = tw; c.fillStyle = '#ffffff'; c.fillRect(Math.round(x), Math.round(y), sz, sz);
          }
        });
        c.globalAlpha = 1;
        const mx = Math.round(W * 0.78 - cx * 0.03), my = Math.round(H * 0.22);
        c.fillStyle = '#f4f1de'; c.beginPath(); c.arc(mx, my, 11, 0, TAU); c.fill();
        c.fillStyle = top; c.beginPath(); c.arc(mx + 5, my - 3, 10, 0, TAU); c.fill();
        c.fillStyle = shade(1); const base = H * 0.88;
        for (let x = 0; x < W; x += 2) { const y = Math.round(base + Math.sin((x + cx * 0.2) * 0.02) * 8); c.fillRect(x, y, 2, H - y); }
      } else if (kind === 'cave') {
        [[0.14, 0, 1], [0.3, 0.07, 2]].forEach(([f, hz, k]) => {
          c.fillStyle = mixHex(bot, '#05060d', 0.35 + k * 0.2);
          for (let x = 0; x < W; x += 2) {
            const wx = x + cx * f, th = 14 + (Math.sin(wx * 0.045) + Math.sin(wx * 0.11 + 2)) * 9 + hash1(Math.floor(wx / 6)) * 8;
            c.fillRect(x, 0, 2, Math.round(th + H * hz - cy * f * 0.2));
            const bh = 10 + (Math.sin(wx * 0.05 + 1) + Math.sin(wx * 0.13)) * 6 + hash1(Math.floor(wx / 5) + 9) * 6;
            c.fillRect(x, Math.round(H - bh - cy * f * 0.15), 2, H);
          }
        });
        c.fillStyle = '#9be0b4';
        for (let s = 0; s < 14; s++) { c.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(t * 0.8 + s)); c.fillRect(Math.round(((hash1(s) * W * 1.6 - cx * 0.2) % W + W) % W), Math.round(H * (0.2 + hash1(s + 50) * 0.6)), 1, 1); }
        c.globalAlpha = 1;
      }
    }
    /** Darkness around the player: 'torch' (small pool of light) or 'vignette' (soft dark corners). */
    drawLight(c, L, px, py) {
      const mode = L && L.light; if (!mode || mode === 'none') return;
      const W = this.W, H = this.H;
      if (mode === 'vignette') {
        const g = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(4,3,12,0.62)'); c.fillStyle = g; c.fillRect(0, 0, W, H); return;
      }
      if (!this.lightCv) { this.lightCv = root.document.createElement('canvas'); this.lightCv.width = W; this.lightCv.height = H; }
      const lc = this.lightCv.getContext('2d'), r = 96 + Math.sin(this.time * 7) * 2 + Math.sin(this.time * 11.3) * 1.5;
      lc.globalCompositeOperation = 'source-over'; lc.clearRect(0, 0, W, H); lc.fillStyle = 'rgba(4,3,14,0.74)'; lc.fillRect(0, 0, W, H);
      lc.globalCompositeOperation = 'destination-out';
      const g = lc.createRadialGradient(px, py, r * 0.12, px, py, r);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.55, 'rgba(0,0,0,0.75)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      lc.fillStyle = g; lc.fillRect(0, 0, W, H);
      c.drawImage(this.lightCv, 0, 0);
      const w = c.createRadialGradient(px, py, 0, px, py, r * 0.9); w.addColorStop(0, 'rgba(255,170,80,0.13)'); w.addColorStop(1, 'rgba(255,170,80,0)');
      c.fillStyle = w; c.fillRect(0, 0, W, H);
    }
    drawInst(c, i, cx, cy) {
      const x = Math.round(i.x) - cx, y0 = Math.round(i.y) - cy;
      if (x > this.W || y0 > this.H || x + i.w < 0 || y0 + i.h < 0) return;
      const bob = i.obj.category === 'items' && !i.obj.solid ? Math.round(Math.sin(this.time * 3.2 + i.id) * 1.4) : 0;
      const y = y0 + bob;
      const sid = this.curSprite(i);
      if (sid !== i.spr) { i.spr = sid; i.animT = 0; }
      const sp = this.sprites[sid];
      if (sp && sp.imgs.length) {
        const n = sp.imgs.length, f = n > 1 ? Math.floor(i.animT * (sp.def.fps || 6)) % n : 0, im = sp.imgs[f];
        if (!im) return;
        const flip = i.dir < 0 && i.obj.flip !== false && i.obj.behavior !== 'none';
        if (i.sx !== 1 || i.sy !== 1 || flip) {
          c.save(); c.translate(x + i.w / 2, y + i.h); c.scale(flip ? -i.sx : i.sx, i.sy); c.drawImage(im, -i.w / 2, -i.h); c.restore();
        } else c.drawImage(im, x, y);
      } else { c.fillStyle = i.obj.color || '#ff00ff'; c.fillRect(x, y, i.w, i.h); }
    }
    render() {
      const c = this.ctx, W = this.W, H = this.H;
      this.hits = [];
      if (this.state === 'loading') { c.fillStyle = '#0d0e13'; c.fillRect(0, 0, W, H); drawText(c, 'LOADING', W / 2, H / 2 - 3, { align: 'center', color: '#8c90a6' }); return; }
      if (this.state === 'title') { this.drawTitle(c); return; }
      const L = this.level;
      if (L.bg2) { const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, L.bg || '#1a1c2c'); g.addColorStop(1, L.bg2); c.fillStyle = g; } else c.fillStyle = L.bg || this.s.bg || '#1a1c2c';
      c.fillRect(0, 0, W, H);
      if (this.dirty) { this.insts.sort((a, b) => (a.obj.layer || 0) - (b.obj.layer || 0) || a.id - b.id); this.dirty = false; }
      let sx = 0, sy = 0;
      if (this.shake.t > 0) { const k = this.shake.a * clamp(this.shake.t / (this.shake.d || 0.3), 0, 1); sx = (Math.random() - 0.5) * 2 * k; sy = (Math.random() - 0.5) * 2 * k; }
      const cx = Math.round(this.cam.x + sx), cy = Math.round(this.cam.y + sy);
      this.drawBackdrop(c, L, cx, cy);
      for (const i of this.insts) if (!i.dead) this.drawInst(c, i, cx, cy);
      for (const p of this.parts) {
        const k = p.max ? clamp(p.life / p.max, 0, 1) : clamp(p.life * 3, 0, 1);
        c.globalAlpha = p.soft ? k * 0.7 : Math.min(1, k * 1.6); c.fillStyle = p.c;
        const sz = Math.max(1, Math.round(p.size * (p.soft ? 0.6 + (1 - k) * 0.8 : 0.5 + k * 0.5)));
        c.fillRect(Math.round(p.x - (p.screen ? 0 : cx)), Math.round(p.y - (p.screen ? 0 : cy)), sz, sz);
      }
      c.globalAlpha = 1;
      for (const r of this.rings) {
        const k = r.t / r.max; c.globalAlpha = 1 - k; c.strokeStyle = r.c; c.lineWidth = 1;
        c.beginPath(); c.arc(Math.round(r.x - cx) + 0.5, Math.round(r.y - cy) + 0.5, 3 + ease(k) * r.r, 0, TAU); c.stroke();
      }
      c.globalAlpha = 1;
      for (const f of this.floats) {
        const pop = 1 + Math.max(0, 1 - f.age * 9) * 0.5, a = clamp(f.life * 2.5, 0, 1), gold = /^\+/.test(f.text);
        c.globalAlpha = a; drawText(c, f.text, f.x - cx, f.y - cy - (pop > 1 ? 2 : 0), { align: 'center', color: gold ? '#ffcd75' : '#ffffff', outline: '#1a1c2c' }); c.globalAlpha = 1;
      }
      const pl = this.findPlayer();
      this.drawLight(c, L, pl ? pl.x + pl.w / 2 - cx : W / 2, pl ? pl.y + pl.h / 2 - cy : H / 2);
      if (this.flash.a > 0) { c.fillStyle = 'rgba(' + this.flash.c + ',' + this.flash.a * 0.5 + ')'; c.fillRect(0, 0, W, H); }
      if (this.state === 'play' || this.state === 'paused') this.drawHud(c);
      this.drawBanner(c);
      this.drawTrans(c);
      if (this.state === 'paused') this.drawPause(c);
      else if (this.state === 'gameover' || this.state === 'win') this.drawEnd(c);
    }
    drawTrans(c) {
      const t = this.trans; if (!t) return;
      const k = clamp(t.t / t.dur, 0, 1), maxR = Math.hypot(this.W, this.H), r = (t.dir === 'in' ? ease(k) : 1 - ease(k)) * maxR;
      c.fillStyle = '#05060b';
      if (r <= 0.5) { c.fillRect(0, 0, this.W, this.H); return; }
      if (r >= maxR) return;
      c.beginPath(); c.rect(0, 0, this.W, this.H); c.arc(t.cx, t.cy, r, 0, TAU); c.fill('evenodd');
    }
    panel(c, x, y, w, h, a) {
      c.fillStyle = 'rgba(8,9,16,' + (a == null ? 0.55 : a) + ')';
      c.fillRect(x + 1, y, w - 2, h); c.fillRect(x, y + 1, w, h - 2);
    }
    drawHud(c) {
      const hud = this.s.hud || ['score', 'lives'], W = this.W;
      let y = 4;
      for (const n of hud) {
        const v = this.vars[n]; if (v === undefined) continue;
        if (n === 'score') {
          const pop = this.pop.score ? 1 : 0, str = String(Math.max(0, Math.round(v))).padStart(5, '0'), w = textWidth(str, 1) + 10;
          this.panel(c, W - w - 4, 4, w, 22);
          drawText(c, 'SCORE', W - 9, 8, { align: 'right', color: '#8c90a6' });
          drawText(c, str, W - 9, 17, { align: 'right', color: pop ? '#ffd479' : '#ffffff' });
        } else if (n === 'lives') {
          const cnt = Math.max(0, Math.round(v)), show = Math.min(cnt, 5), w = (cnt > 5 ? 36 : Math.max(cnt, 1) * 9) + 7;
          this.panel(c, 4, y, w, 14);
          if (cnt > 5) { drawHeart(c, 8, y + 4, '#ff4d6d', '#1a1c2c'); drawText(c, 'X' + cnt, 18, y + 4, { color: '#fff' }); }
          else for (let k = 0; k < show; k++) drawHeart(c, 8 + k * 9, y + 4, '#ff4d6d', '#1a1c2c');
          y += 17;
        } else {
          const str = n.toUpperCase() + ' ' + Math.round(v), w = textWidth(str, 1) + 9;
          this.panel(c, 4, y, w, 14);
          drawText(c, n.toUpperCase(), 8, y + 4, { color: '#8c90a6' });
          drawText(c, String(Math.round(v)), 8 + textWidth(n, 1) + 6, y + 4, { color: this.pop[n] ? '#ffd479' : '#ffffff' });
          y += 17;
        }
      }
    }
    drawBanner(c) {
      if (this.banner <= 0 || !this.level || this.state !== 'play') return;
      const W = this.W, t = 2.4 - this.banner, inK = ease(t / 0.35), outK = ease((this.banner) / 0.4);
      const k = Math.min(inK, outK), name = String(this.level.name || ''), m = /^(.*?)\s+[-:–]\s+(.*)$/.exec(name);
      const small = m ? m[1] : 'LEVEL ' + (this.levelIdx + 1), big = m ? m[2] : name;
      const w = Math.max(textWidth(big, 2), textWidth(small, 1)) + 28, x = Math.round(W / 2 - w / 2 - (1 - k) * (W / 2 + w / 2)), y = Math.round(this.H * 0.3);
      this.panel(c, x, y, w, 30, 0.7);
      c.fillStyle = '#ffc24b'; c.fillRect(x, y + 2, 2, 26);
      drawText(c, small, x + 12, y + 5, { color: '#ffc24b' });
      drawText(c, big, x + 12, y + 14, { scale: 2, color: '#ffffff', shadow: '#000' });
    }
    drawMenu(c, y0) {
      const m = this.menu; if (!m) return;
      const W = this.W;
      m.items.forEach((it, n) => {
        const w = Math.max(96, textWidth(it.label, 1) + 28), x = Math.round(W / 2 - w / 2), y = y0 + n * 17, sel = n === m.sel;
        this.panel(c, x, y, w, 14, sel ? 0.9 : 0.45);
        if (sel) { c.fillStyle = '#ffc24b'; c.fillRect(x + 1, y, w - 2, 1); c.fillRect(x + 1, y + 13, w - 2, 1); c.fillRect(x, y + 1, 1, 12); c.fillRect(x + w - 1, y + 1, 1, 12); }
        drawText(c, it.label, W / 2, y + 4, { align: 'center', color: sel ? '#ffc24b' : '#c9cde0' });
        if (sel) { drawText(c, '>', x + 6 + Math.round(Math.sin(this.time * 8)), y + 4, { color: '#ffc24b' }); }
        this.hits.push({ x, y, w, h: 14, i: n });
      });
    }
    drawPause(c) {
      c.fillStyle = 'rgba(5,6,12,0.7)'; c.fillRect(0, 0, this.W, this.H);
      drawText(c, 'PAUSED', this.W / 2, this.H * 0.2, { align: 'center', scale: 3, color: '#ffc24b', shadow: '#000' });
      this.drawMenu(c, Math.round(this.H * 0.2 + 36));
      drawText(c, 'ARROWS + ENTER, OR CLICK', this.W / 2, this.H - 14, { align: 'center', color: '#8c90a6' });
    }
    drawEnd(c) {
      const W = this.W, H = this.H, win = this.state === 'win', k = ease(this.endT / 0.5);
      c.fillStyle = 'rgba(5,6,12,' + 0.72 * k + ')'; c.fillRect(0, 0, W, H);
      for (const p of this.parts) if (p.screen) { c.fillStyle = p.c; c.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size); }
      const y = Math.round(H * 0.16 - (1 - k) * 14);
      c.globalAlpha = k;
      drawText(c, win ? 'YOU WIN!' : 'GAME OVER', W / 2, y, { align: 'center', scale: 3, color: win ? '#ffc24b' : '#ff5d73', shadow: '#000', wave: win ? 2 : 0, t: this.time });
      if (this.endText) drawText(c, this.endText, W / 2, y + 28, { align: 'center', color: '#c9cde0' });
      let ly = y + 44;
      const line = (label, val, col) => { drawText(c, label, W / 2 - 8, ly, { align: 'right', color: '#8c90a6' }); drawText(c, val, W / 2 + 8, ly, { color: col || '#fff' }); ly += 11; };
      if (this.vars.score !== undefined) { line('SCORE', String(Math.round(this.vars.score)), '#ffd479'); line('BEST', String(Math.max(this.best(), Math.round(this.vars.score)))); }
      if (win) { const s = Math.floor(this.stats.time); line('TIME', Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0')); }
      if (this.newBest) drawText(c, 'NEW BEST!', W / 2, ly, { align: 'center', color: '#a7f070' });
      c.globalAlpha = 1;
      this.drawMenu(c, Math.round(H - 12 - this.menu.items.length * 17 - 4));
    }
    drawTitle(c) {
      const W = this.W, H = this.H, t = this.time, L = this.p.levels[this.s.startLevel || 0] || this.p.levels[0] || {};
      const top = okHex(L.bg, okHex(this.s.bg, '#1a1c2c')), bot = okHex(L.bg2, mixHex(top, '#000000', 0.35));
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, top); g.addColorStop(1, bot); c.fillStyle = g; c.fillRect(0, 0, W, H);
      this.drawBackdrop(c, Object.assign({ backdrop: L.backdrop || 'hills' }, L, { backdrop: L.backdrop || 'hills' }), t * 14, 0);
      // floating hero
      const heroObj = (this.p.objects || []).find((o) => o.isPlayer) || (this.p.objects || [])[0];
      const sp = heroObj && this.sprites[heroObj.spriteId];
      if (sp && sp.imgs[0]) {
        const im = sp.imgs[Math.floor(t * (sp.def.fps || 2)) % sp.imgs.length] || sp.imgs[0], bob = Math.round(Math.sin(t * 2.4) * 3), sc = 2;
        c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(W / 2, H * 0.5 + 14 * sc, 9 * sc - bob * 0.5, 2.5, 0, 0, TAU); c.fill();
        c.drawImage(im, Math.round(W / 2 - im.width * sc / 2), Math.round(H * 0.5 - im.height * sc / 2 + bob), im.width * sc, im.height * sc);
      }
      const title = String(this.s.title || this.p.name || 'My Game'), maxScale = Math.max(2, Math.min(4, Math.floor((W - 24) / textWidth(title, 1))));
      drawText(c, title, W / 2, Math.round(H * 0.16), { align: 'center', scale: maxScale, color: '#ffc24b', shadow: '#1a1c2c', wave: 2, t });
      const b = this.best(); if (b) drawText(c, 'BEST ' + b, W / 2, Math.round(H * 0.16) + maxScale * 7 + 8, { align: 'center', color: '#ffffff', shadow: '#000' });
      this.drawMenu(c, Math.round(H * 0.68));
      drawText(c, 'MADE WITH 2PLAT', W / 2, H - 10, { align: 'center', color: 'rgba(255,255,255,0.55)' });
    }
  }

  root.Plat2 = { Game, createAudio, SFX_PRESETS, KEY_GROUPS, drawText, textWidth };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Plat2;
})(typeof window !== 'undefined' ? window : globalThis);
