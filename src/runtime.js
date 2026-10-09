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
      this.parts = []; this.floats = [];
      this.cam = { x: 0, y: 0 }; this.shake = { a: 0, t: 0 };
      this.time = 0; this.fade = 0; this.respawnT = 0; this.dying = false;
      this.checkpoint = null; this.endText = ''; this.levelBanner = 0;
      this.running = false; this._raf = 0; this._acc = 0; this._last = 0;
      this._onKey = this._onKey.bind(this);
      this._onKeyUp = this._onKeyUp.bind(this);
      this._onClick = this._onClick.bind(this);
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
      return Promise.all(jobs).then(() => { this.state = 'title'; return this; });
    }

    /* ---- lifecycle ---- */
    start() {
      if (this.running) return;
      this.running = true;
      root.addEventListener('keydown', this._onKey);
      root.addEventListener('keyup', this._onKeyUp);
      this.cv.addEventListener('pointerdown', this._onClick);
      this._last = (root.performance || Date).now();
      this._raf = root.requestAnimationFrame(this._frame);
    }
    stop() {
      this.running = false;
      root.cancelAnimationFrame && root.cancelAnimationFrame(this._raf);
      root.removeEventListener('keydown', this._onKey);
      root.removeEventListener('keyup', this._onKeyUp);
      this.cv.removeEventListener('pointerdown', this._onClick);
      this.audio.stopMusic();
    }
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
      if (e.code === 'KeyM') this.audio.setMuted(!this.audio.muted);
    }
    _onKeyUp(e) {
      delete this.rawHeld[e.code];
      const groups = CODE_TO_GROUPS[e.code];
      if (groups) groups.forEach((g) => {
        if (!KEY_GROUPS[g].some((c) => this.rawHeld[c])) { this.held[g] = false; this.released[g] = true; }
      });
    }
    _onClick() { this.pressed.confirm = true; this.audio.ensure(); }
    // programmatic input (used by tests, touch buttons, etc.)
    press(g) { this.held[g] = true; this.pressed[g] = true; }
    release(g) { this.held[g] = false; this.released[g] = true; }

    /* ---- game flow ---- */
    newGame() {
      this.vars = {};
      (this.s.vars || []).forEach((v) => { this.vars[v.name] = Number(v.value) || 0; });
      this.checkpoint = null;
      this.loadLevel(this.opts.startLevel != null ? this.opts.startLevel : (this.s.startLevel || 0));
      this.state = 'play';
    }
    endGame(kind, text) {
      if (this.state !== 'play') return;
      this.state = kind;
      this.endText = text || '';
      this.audio.stopMusic();
    }
    nextLevel() {
      if (this.levelIdx + 1 < this.p.levels.length) { this.checkpoint = null; this.loadLevel(this.levelIdx + 1); }
      else this.endGame('win', 'You finished the game!');
    }
    loseLife() {
      if (this.dying || this.state !== 'play') return;
      this.vars.lives = (this.vars.lives == null ? 1 : this.vars.lives) - 1;
      this.shake = { a: 4, t: 0.3 };
      this.insts.forEach((i) => { if (this.isPlayer(i) && !i.dead) { this.spawnFx(i, 'burst'); i.dead = true; } });
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
      this.parts = []; this.floats = []; this.dying = false; this.stamp = 0; this.dirty = true;
      for (const it of L.instances) {
        const o = this.objs[it.obj];
        if (o) this.spawn(o, it.x, it.y, { quiet: true });
      }
      this.insts.slice().forEach((i) => this.fire(i, 'create'));
      const pl = this.findPlayer();
      if (this.checkpoint && this.checkpoint.level === idx && pl) { pl.x = this.checkpoint.x; pl.y = this.checkpoint.y; }
      if (pl) { this.cam.x = pl.x + pl.w / 2 - this.W / 2; this.cam.y = pl.y + pl.h / 2 - this.H / 2; }
      this.clampCam();
      this.fade = 1; this.levelBanner = 1.6;
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
        coyote: 0, jumpBuf: 0, jumps: 0, ox: x, oy: y, mdx: 0, mdy: 0, flash: 0,
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
        if (P.confirm || this.opts.skipTitle) this.newGame();
      } else if (this.state === 'gameover' || this.state === 'win') {
        if (P.confirm) { this.state = 'title'; this.audio.stopMusic(); if (this.opts.skipTitle) this.newGame(); }
      } else if (this.state === 'paused') {
        if (P.pause || P.confirm) this.state = 'play';
      } else if (this.state === 'play') {
        if (P.pause) this.state = 'paused';
        else this.update(dt);
      }
      this.pressed = {}; this.released = {};
    }

    update(dt) {
      if (this.fade > 0) this.fade = Math.max(0, this.fade - dt * 2.5);
      if (this.levelBanner > 0) this.levelBanner -= dt;
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
        if (i.obj.gravity) i.vy = Math.min(i.vy + G * ((i.obj.props && i.obj.props.gravityScale) || 1) * dt, 420);
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
        if (i.landed && this.isPlayer(i)) this.sfxByName('land');
        if (i.life > 0) { i.life -= dt; if (i.life <= 0) this.kill(i, true); }
        if (i.obj.behavior === 'bullet' && (i.hitX || i.hitY)) this.kill(i);
      }
      for (const i of list) if (!i.dead) this.runRules(i, dt);
      this.insts = this.insts.filter((i) => !i.dead);

      // lives
      if (this.vars.lives != null && this.vars.lives <= 0 && !this.dying) this.endGame('gameover', 'Out of lives');

      // particles / floaters
      for (const p of this.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; }
      this.parts = this.parts.filter((p) => p.life > 0);
      for (const f of this.floats) { f.life -= dt; f.y -= 14 * dt; }
      this.floats = this.floats.filter((f) => f.life > 0);
      if (this.shake.t > 0) this.shake.t -= dt;

      // camera
      const pl = this.findPlayer();
      if (pl) {
        const tx = pl.x + pl.w / 2 - this.W / 2, ty = pl.y + pl.h / 2 - this.H / 2;
        const k = Math.min(1, dt * 7);
        this.cam.x += (tx - this.cam.x) * k; this.cam.y += (ty - this.cam.y) * k;
      }
      this.clampCam();
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
          if (i.coyote > 0) { i.vy = -(p.jump || 270); i.jumps = 1; i.coyote = 0; i.jumpBuf = 0; this.sfxByName('jump'); }
          else if (i.jumps < maxJ && i.jumps > 0) { i.vy = -(p.jump || 270) * 0.9; i.jumps++; i.jumpBuf = 0; this.sfxByName('jump'); }
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
          else if (a.to === 'restart') this.restartLevel();
          else if (a.to === 'first') { this.checkpoint = null; this.loadLevel(0); }
          else { this.checkpoint = null; this.loadLevel(clamp(Number(a.index) || 0, 0, this.p.levels.length - 1)); }
          break;
        case 'text': if (s) this.floats.push({ x: s.x + s.w / 2, y: s.y - 2, text: String(a.text || ''), life: 1.1 }); break;
        case 'velocity': {
          if (!s) break;
          const vx = a.vx === '' || a.vx == null ? null : Number(a.vx), vy = a.vy === '' || a.vy == null ? null : Number(a.vy);
          if (vx != null) s.vx = a.mode === 'add' ? s.vx + vx * s.dir : vx * (a.mode === 'abs' ? 1 : s.dir);
          if (vy != null) s.vy = a.mode === 'add' ? s.vy + vy : vy;
          break;
        }
        case 'jump': if (s) { s.vy = -(Number(a.power) || 250); s.onGround = false; s.coyote = 0; } break;
        case 'shake': this.shake = { a: Number(a.amount) || 3, t: Number(a.time) || 0.25 }; break;
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
      const c = this.center(i), n = kind === 'burst' ? 14 : 7, col = color || i.obj.fxColor || i.obj.color || '#ffffff';
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2, sp = (kind === 'burst' ? 70 : 35) * (0.4 + Math.random());
        this.parts.push({ x: c.x, y: c.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, life: 0.35 + Math.random() * 0.3, c: col, size: 1 + (Math.random() * 2 | 0) });
      }
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
    render() {
      const c = this.ctx, W = this.W, H = this.H;
      if (this.state === 'loading') { c.fillStyle = '#000'; c.fillRect(0, 0, W, H); return; }
      const L = this.level;
      // background
      if (this.state === 'title' || !L) {
        const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1a1c2c'); g.addColorStop(1, '#333c57');
        c.fillStyle = g; c.fillRect(0, 0, W, H);
      } else {
        if (L.bg2) { const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, L.bg || '#1a1c2c'); g.addColorStop(1, L.bg2); c.fillStyle = g; }
        else c.fillStyle = L.bg || this.s.bg || '#1a1c2c';
        c.fillRect(0, 0, W, H);
      }
      if (L && this.state !== 'title') {
        if (this.dirty) { this.insts.sort((a, b) => (a.obj.layer || 0) - (b.obj.layer || 0) || a.id - b.id); this.dirty = false; }
        let sx = 0, sy = 0;
        if (this.shake.t > 0) { sx = (Math.random() - 0.5) * 2 * this.shake.a; sy = (Math.random() - 0.5) * 2 * this.shake.a; }
        const cx = Math.round(this.cam.x + sx), cy = Math.round(this.cam.y + sy);
        for (const i of this.insts) {
          if (i.dead) continue;
          const x = Math.round(i.x) - cx, y = Math.round(i.y) - cy;
          if (x > W || y > H || x + i.w < 0 || y + i.h < 0) continue;
          const sid = this.curSprite(i);
          if (sid !== i.spr) { i.spr = sid; i.animT = 0; }
          const sp = this.sprites[sid];
          if (sp && sp.imgs.length) {
            const n = sp.imgs.length, f = n > 1 ? Math.floor(i.animT * (sp.def.fps || 6)) % n : 0;
            const im = sp.imgs[f];
            if (im) {
              if (i.dir < 0 && i.obj.flip !== false && i.obj.behavior !== 'none') {
                c.save(); c.translate(x + i.w, y); c.scale(-1, 1); c.drawImage(im, 0, 0); c.restore();
              } else c.drawImage(im, x, y);
            }
          } else { c.fillStyle = i.obj.color || '#ff00ff'; c.fillRect(x, y, i.w, i.h); }
        }
        for (const p of this.parts) { c.globalAlpha = clamp(p.life * 3, 0, 1); c.fillStyle = p.c; c.fillRect(Math.round(p.x - cx), Math.round(p.y - cy), p.size, p.size); }
        c.globalAlpha = 1;
        c.font = 'bold 8px monospace'; c.textAlign = 'center';
        for (const f of this.floats) { c.fillStyle = '#000'; c.fillText(f.text, Math.round(f.x - cx) + 1, Math.round(f.y - cy) + 1); c.fillStyle = '#fff'; c.fillText(f.text, Math.round(f.x - cx), Math.round(f.y - cy)); }
        this.drawHud(c);
      }
      if (this.fade > 0) { c.fillStyle = 'rgba(0,0,0,' + this.fade + ')'; c.fillRect(0, 0, W, H); }
      if (this.state === 'title') this.drawCenter(c, this.s.title || this.p.name || 'My Game', 'Press ENTER or click to start', true);
      else if (this.state === 'paused') this.drawCenter(c, 'PAUSED', 'Esc to resume', false, true);
      else if (this.state === 'gameover') this.drawCenter(c, 'GAME OVER', this.endText || 'Press ENTER', false, true);
      else if (this.state === 'win') this.drawCenter(c, 'YOU WIN!', this.endText || 'Press ENTER', false, true);
    }
    drawHud(c) {
      const hud = this.s.hud || ['score', 'lives'];
      c.textAlign = 'left'; c.font = 'bold 8px monospace';
      let y = 10;
      for (const n of hud) {
        if (this.vars[n] === undefined) continue;
        const t = n + ': ' + this.vars[n];
        c.fillStyle = '#000'; c.fillText(t, 5, y + 1); c.fillStyle = '#fff'; c.fillText(t, 4, y);
        y += 10;
      }
      if (this.levelBanner > 0 && this.level) {
        c.textAlign = 'center'; c.globalAlpha = clamp(this.levelBanner, 0, 1);
        c.fillStyle = '#000'; c.fillText(this.level.name || '', this.W / 2 + 1, 21); c.fillStyle = '#ffcd75'; c.fillText(this.level.name || '', this.W / 2, 20);
        c.globalAlpha = 1;
      }
    }
    drawCenter(c, title, sub, big, dim) {
      if (dim) { c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(0, 0, this.W, this.H); }
      c.textAlign = 'center';
      c.font = 'bold ' + (big ? 20 : 16) + 'px monospace';
      c.fillStyle = '#000'; c.fillText(title, this.W / 2 + 1, this.H / 2 - 7);
      c.fillStyle = '#ffcd75'; c.fillText(title, this.W / 2, this.H / 2 - 8);
      c.font = 'bold 8px monospace'; c.fillStyle = '#fff';
      c.fillText(sub, this.W / 2, this.H / 2 + 12);
      if (big) { c.fillStyle = '#94b0c2'; c.fillText('made with 2plat', this.W / 2, this.H - 8); }
    }
  }

  root.Plat2 = { Game, createAudio, SFX_PRESETS, KEY_GROUPS };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Plat2;
})(typeof window !== 'undefined' ? window : globalThis);
