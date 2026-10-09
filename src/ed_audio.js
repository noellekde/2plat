/* 2plat: sound effect designer and music tracker */
(function () {
  'use strict';
  const WAVES = [['square', 'Square'], ['saw', 'Sawtooth'], ['triangle', 'Triangle'], ['sine', 'Sine'], ['noise', 'Noise']];
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (a) => a[(Math.random() * a.length) | 0];

  /* ======================================================== SOUNDS */
  const SO = { id: null };
  let sel = {};
  const cur = () => App.sound(SO.id);
  const GENS = {
    Pickup: () => { const f = rnd(500, 1000); return { wave: 'square', freq: f, endFreq: f * rnd(1.4, 2.2), dur: rnd(0.08, 0.2), vol: 0.3, vibrato: 0 }; },
    Laser: () => ({ wave: pick(['saw', 'square']), freq: rnd(900, 2200), endFreq: rnd(80, 400), dur: rnd(0.1, 0.3), vol: 0.3, vibrato: 0 }),
    Explosion: () => ({ wave: 'noise', freq: rnd(1200, 3200), endFreq: rnd(50, 200), dur: rnd(0.35, 0.9), vol: 0.6, vibrato: 0 }),
    Jump: () => { const f = rnd(180, 380); return { wave: 'square', freq: f, endFreq: f * rnd(1.8, 3), dur: rnd(0.12, 0.25), vol: 0.32, vibrato: 0 }; },
    Hit: () => ({ wave: pick(['noise', 'saw']), freq: rnd(300, 900), endFreq: rnd(40, 120), dur: rnd(0.1, 0.3), vol: 0.45, vibrato: 0 }),
    Powerup: () => { const f = rnd(200, 400); return { wave: 'square', freq: f, endFreq: f * rnd(3, 5), dur: rnd(0.25, 0.5), vol: 0.33, vibrato: rnd(10, 30), vibSpeed: rnd(12, 28) }; },
    Blip: () => { const f = rnd(300, 1200); return { wave: pick(['triangle', 'square', 'sine']), freq: f, endFreq: f, dur: rnd(0.04, 0.1), vol: 0.4, vibrato: 0 }; },
  };
  function playCur() { const s = cur(); if (s) App.sharedAudio().playSfx(s); drawCurve(); }
  function drawCurve() {
    const s = cur(), c = sel.curve; if (!s || !c) return;
    const W = c.width, H = c.height, x = c.getContext('2d');
    x.clearRect(0, 0, W, H); x.fillStyle = '#0b0c14'; x.fillRect(0, 0, W, H);
    x.strokeStyle = '#242742'; x.lineWidth = 1; x.beginPath(); for (let i = 1; i < 4; i++) { x.moveTo(0, (H * i) / 4); x.lineTo(W, (H * i) / 4); } x.stroke();
    const lf = (f) => Math.log(Math.max(20, f)), lo = Math.log(20), hi = Math.log(4000);
    x.strokeStyle = '#41a6f6'; x.lineWidth = 2; x.beginPath();
    for (let i = 0; i <= 100; i++) {
      const t = i / 100, f = s.freq * Math.pow(Math.max(20, s.endFreq || s.freq) / Math.max(20, s.freq), t);
      const py = H - ((lf(f) - lo) / (hi - lo)) * H * 0.9 - 6, px = t * W;
      i ? x.lineTo(px, py) : x.moveTo(px, py);
    }
    x.stroke();
    x.strokeStyle = '#ffcd75'; x.lineWidth = 1.5; x.beginPath();
    for (let i = 0; i <= 100; i++) { const t = i / 100, a = Math.pow(0.0001, t) * (t < 0.03 ? t / 0.03 : 1); const py = H - a * (s.vol || 0.5) * H * 1.6 - 2; i ? x.lineTo(t * W, py) : x.moveTo(t * W, py); }
    x.stroke();
    x.fillStyle = '#8b90b8'; x.font = '10px sans-serif'; x.fillText('pitch (blue) · volume (yellow) · ' + (s.dur || 0).toFixed(2) + 's', 6, 12);
  }
  function renderSoundList() {
    sel.list.replaceChildren(...App.proj.sounds.map((s) => h('div', { class: 'list-item' + (s.id === SO.id ? ' sel' : ''), onclick: () => { SO.id = s.id; renderSoundList(); renderSoundForm(); } },
      h('button', { class: 'btn small', title: 'Play', onclick: (e) => { e.stopPropagation(); App.sharedAudio().playSfx(s); } }, '▶'),
      h('div', { class: 'nm' }, s.name, h('div', { class: 'sub' }, s.wave + ' · ' + (s.dur || 0).toFixed(2) + 's')))));
  }
  function renderSoundForm() {
    const s = cur(); if (!sel.form) return;
    if (!s) { sel.form.replaceChildren(h('p', { class: 'hint', style: { padding: '20px' } }, 'Create a sound with ＋ New.')); return; }
    if (s.vibrato == null) s.vibrato = 0;
    if (s.vibSpeed == null) s.vibSpeed = 12;
    if (s.endFreq == null) s.endFreq = s.freq;
    const ch = () => { App.touch(); drawCurve(); renderSoundList(); };
    const sync = () => { App.touch(); renderSoundForm(); App.sharedAudio().playSfx(s); renderSoundList(); };
    sel.form.replaceChildren(h('div', { style: { maxWidth: '620px' } },
      h('div', { class: 'section-title' }, 'Sound effect'),
      field('Name', fText(s, 'name', () => { App.touch(); renderSoundList(); }, { style: 'width:160px' }), h('span', { class: 'hint', style: { margin: 0 } }, 'Name it jump / land / laser / death and the engine uses it automatically.')),
      field('Wave', fSelect(s, 'wave', WAVES, sync)),
      field(s.wave === 'noise' ? 'Filter start' : 'Pitch start', fRange(s, 'freq', 40, 3000, 10, ch), h('span', { class: 'muted' }, 'Hz')),
      field(s.wave === 'noise' ? 'Filter end' : 'Pitch end', fRange(s, 'endFreq', 40, 3000, 10, ch), h('span', { class: 'muted' }, 'Hz')),
      field('Length', fRange(s, 'dur', 0.03, 2, 0.01, ch), h('span', { class: 'muted' }, 'sec')),
      field('Volume', fRange(s, 'vol', 0.05, 1, 0.01, ch)),
      s.wave !== 'noise' ? field('Vibrato depth', fRange(s, 'vibrato', 0, 80, 1, ch), h('span', { class: 'muted' }, 'Hz')) : null,
      s.wave !== 'noise' && s.vibrato ? field('Vibrato speed', fRange(s, 'vibSpeed', 1, 40, 1, ch)) : null,
      sel.curve = h('canvas', { width: 560, height: 130, style: { width: '100%', maxWidth: '560px', borderRadius: '8px', border: '1px solid var(--border)', margin: '12px 0' } }),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: playCur }, '▶ Play'),
        h('button', { class: 'btn', onclick: () => { Object.assign(s, { freq: Math.max(40, s.freq * rnd(0.85, 1.15)), endFreq: Math.max(40, s.endFreq * rnd(0.85, 1.15)), dur: clamp(s.dur * rnd(0.85, 1.15), 0.03, 2) }); App.touch(); renderSoundForm(); App.sharedAudio().playSfx(s); } }, '🎲 Mutate')),
      h('div', { class: 'section-title' }, 'Generate'),
      h('div', { class: 'row' }, Object.keys(GENS).map((k) => h('button', { class: 'btn', onclick: () => { Object.assign(s, GENS[k]()); s.vibSpeed = s.vibSpeed || 12; App.touch(); renderSoundForm(); App.sharedAudio().playSfx(s); renderSoundList(); } }, '✨ ' + k))),
      h('p', { class: 'hint' }, 'Generators make a random sound of that type — click again for a new variation, then fine-tune the sliders.')));
    drawCurve();
  }
  function newSound() {
    promptBox('New sound', 'Name', 'sfx_' + (App.proj.sounds.length + 1)).then((n) => {
      if (!n) return; const s = Plat2Templates.newSound(); s.name = n.trim(); Object.assign(s, GENS.Blip()); s.vibSpeed = 12;
      App.proj.sounds.push(s); App.touch(); SO.id = s.id; renderSoundList(); renderSoundForm(); App.sharedAudio().playSfx(s);
    });
  }
  function dupSound() { const s = cur(); if (!s) return; const n = clone(s); n.id = uid('s'); n.name = s.name + '_copy'; App.proj.sounds.push(n); App.touch(); SO.id = n.id; renderSoundList(); renderSoundForm(); }
  async function delSound() {
    const s = cur(); if (!s) return;
    if (!(await confirmBox('Delete sound', 'Delete "' + s.name + '"? Actions that play it will go silent.', 'Delete', true))) return;
    App.proj.sounds = App.proj.sounds.filter((x) => x !== s);
    App.proj.objects.forEach((o) => (o.rules || []).forEach((r) => (r.actions || []).forEach((a) => { if (a.sound === s.id) a.sound = ''; })));
    App.touch(); SO.id = App.proj.sounds[0] ? App.proj.sounds[0].id : null; renderSoundList(); renderSoundForm();
  }
  function mountSounds(root) {
    sel.list = h('div', { class: 'side-scroll' }); sel.form = h('div', { class: 'form-scroll' });
    root.append(h('div', { class: 'sidebar' }, h('div', { class: 'side-head' }, h('h3', null, 'Sounds'), h('button', { class: 'btn small', onclick: newSound }, '＋ New'), h('button', { class: 'btn small', onclick: dupSound }, '⧉'), h('button', { class: 'btn small', onclick: delSound }, '🗑')), sel.list),
      h('div', { class: 'workarea', style: { background: 'var(--bg)' } }, sel.form));
  }
  function showSounds() { if (!cur()) SO.id = App.proj.sounds[0] ? App.proj.sounds[0].id : null; renderSoundList(); renderSoundForm(); }
  App.editors.sounds = { title: 'Sounds', icon: '🔊', mount: mountSounds, show: showSounds, reset: () => { SO.id = null; }, refresh: renderSoundList };

  /* ======================================================== MUSIC */
  const MU = { id: null, track: 0, base: 48, rows: 36, scale: 'pentatonic', root: 0, playing: false, step: -1, drag: null };
  let me = {};
  const mcur = () => App.musicOf(MU.id);
  const SCALES = { none: null, major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], pentatonic: [0, 2, 4, 7, 9], blues: [0, 3, 5, 6, 7, 10] };
  const NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const CW = 22, RH = 14, KW = 46;
  const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function stopPlay() { App.sharedAudio().stopMusic(); MU.playing = false; MU.step = -1; drawRoll(); renderMusicBar(); }
  function startPlay() {
    const m = mcur(); if (!m) return; MU.playing = true;
    App.sharedAudio().playMusic(m, (s) => { MU.step = s; drawRoll(); });
    renderMusicBar();
  }
  function ensureNotes(m) { m.tracks.forEach((t) => { while (t.notes.length < m.steps) t.notes.push(0); t.notes.length = m.steps; }); }
  function drawRoll() {
    const m = mcur(), c = me.roll; if (!m || !c) return;
    ensureNotes(m);
    const W = KW + m.steps * CW, H = MU.rows * RH;
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; c.style.width = W + 'px'; c.style.height = H + 'px'; }
    const x = c.getContext('2d'); x.clearRect(0, 0, W, H);
    const sc = SCALES[MU.scale];
    for (let r = 0; r < MU.rows; r++) {
      const midi = MU.base + MU.rows - 1 - r, pc = midi % 12, black = [1, 3, 6, 8, 10].includes(pc), inScale = sc && sc.includes((pc - MU.root + 12) % 12);
      x.fillStyle = inScale ? (pc === MU.root ? '#2d3a66' : '#222a4d') : (black ? '#10111a' : '#171925'); x.fillRect(KW, r * RH, W - KW, RH);
      x.fillStyle = black ? '#1b1d2e' : '#d9dcf0'; x.fillRect(0, r * RH, KW - 2, RH - 1);
      if (pc === 0) { x.fillStyle = '#1a1c2c'; x.font = '10px sans-serif'; x.fillText('C' + (Math.floor(midi / 12) - 1), 6, r * RH + 11); }
      x.strokeStyle = pc === 0 ? '#3c4270' : '#1f2238'; x.beginPath(); x.moveTo(KW, r * RH + 0.5); x.lineTo(W, r * RH + 0.5); x.stroke();
    }
    for (let s = 0; s <= m.steps; s++) { x.strokeStyle = s % 4 === 0 ? '#3c4270' : '#1f2238'; x.beginPath(); x.moveTo(KW + s * CW + 0.5, 0); x.lineTo(KW + s * CW + 0.5, H); x.stroke(); }
    // other tracks faint
    m.tracks.forEach((t, ti) => { if (ti === MU.track) return; x.fillStyle = 'rgba(148,176,194,0.25)'; t.notes.forEach((n, s) => { if (n > 0) { const r = MU.base + MU.rows - 1 - n; if (r >= 0 && r < MU.rows) x.fillRect(KW + s * CW + 2, r * RH + 3, CW - 4, RH - 6); } }); });
    const t = m.tracks[MU.track];
    if (t) {
      const len = Math.max(1, Math.round((t.len || 1)));
      t.notes.forEach((n, s) => {
        if (n <= 0) return; const r = MU.base + MU.rows - 1 - n; if (r < 0 || r >= MU.rows) return;
        x.fillStyle = t.muted ? '#566c86' : '#ffcd75'; x.fillRect(KW + s * CW + 1, r * RH + 1, Math.min(len, m.steps - s) * CW - 2, RH - 2);
        x.fillStyle = '#ef7d57'; x.fillRect(KW + s * CW + 1, r * RH + 1, CW - 2, RH - 2);
      });
    }
    if (MU.step >= 0) { x.fillStyle = 'rgba(65,166,246,0.25)'; x.fillRect(KW + MU.step * CW, 0, CW, H); }
  }
  function cellAt(e) {
    const r = me.roll.getBoundingClientRect();
    const s = Math.floor((e.clientX - r.left - KW) / CW), row = Math.floor((e.clientY - r.top) / RH);
    return { s, midi: MU.base + MU.rows - 1 - row };
  }
  function previewNote(t, midi) {
    const hz = midiHz(midi); App.sharedAudio().playSfx({ wave: t.wave === 'noise' ? 'noise' : t.wave, freq: t.wave === 'noise' ? 2000 + midi * 20 : hz, endFreq: t.wave === 'noise' ? 800 : hz, dur: 0.14, vol: Math.min(1, (t.vol || 0.2) * 1.6) });
  }
  function rollDown(e) {
    const m = mcur(), t = m && m.tracks[MU.track]; if (!t || e.offsetX < KW) return;
    me.roll.setPointerCapture(e.pointerId);
    const c = cellAt(e); if (c.s < 0 || c.s >= m.steps) return;
    const erase = e.button === 2 || t.notes[c.s] === c.midi;
    MU.drag = { erase, lastS: c.s };
    applyCell(t, c, erase, true);
  }
  function applyCell(t, c, erase, preview) {
    if (c.s < 0 || c.s >= t.notes.length) return;
    t.notes[c.s] = erase ? 0 : c.midi; if (!erase && preview) previewNote(t, c.midi);
    App.touch(); drawRoll();
  }
  function rollMove(e) {
    if (!MU.drag) return; const m = mcur(), t = m.tracks[MU.track], c = cellAt(e);
    if (c.s !== MU.drag.lastS && c.s >= 0) { MU.drag.lastS = c.s; applyCell(t, c, MU.drag.erase, !MU.drag.erase); }
  }
  function randomMelody() {
    const m = mcur(), t = m.tracks[MU.track]; const sc = SCALES[MU.scale] || SCALES.pentatonic; if (!t) return;
    const pool = []; for (let n = MU.base + 12; n < MU.base + 30; n++) if (sc.includes(((n % 12) - MU.root + 12) % 12)) pool.push(n);
    let i = (pool.length / 2) | 0;
    t.notes = t.notes.map((_, s) => { if (Math.random() < (s % 4 === 0 ? 0.85 : 0.45)) { i = clamp(i + pick([-2, -1, -1, 0, 1, 1, 2]), 0, pool.length - 1); return pool[i]; } return 0; });
    App.touch(); drawRoll();
  }
  function transpose(d) { const t = mcur().tracks[MU.track]; if (!t) return; t.notes = t.notes.map((n) => (n > 0 ? clamp(n + d, 1, 127) : 0)); App.touch(); drawRoll(); }

  function renderMusicList() {
    me.list.replaceChildren(...App.proj.music.map((m) => h('div', { class: 'list-item' + (m.id === MU.id ? ' sel' : ''), onclick: () => { if (MU.playing) stopPlay(); MU.id = m.id; MU.track = 0; renderMusicList(); renderMusicBar(); renderTracks(); drawRoll(); } },
      h('div', { class: 'nm' }, m.name, h('div', { class: 'sub' }, m.bpm + ' bpm · ' + m.tracks.length + ' tracks')))));
  }
  function renderMusicBar() {
    const m = mcur(); if (!me.bar) return;
    if (!m) { me.bar.replaceChildren(); return; }
    me.bar.replaceChildren(
      h('button', { class: 'btn play', onclick: () => (MU.playing ? stopPlay() : startPlay()) }, MU.playing ? '■ Stop' : '▶ Play'),
      h('span', { class: 'sep' }),
      h('label', { class: 'muted' }, 'Name ', fText(m, 'name', () => { App.touch(); renderMusicList(); }, { style: 'width:120px' })),
      h('label', { class: 'muted' }, 'BPM ', fNum(m, 'bpm', () => App.touch(), { min: 40, max: 240, style: 'width:60px' })),
      h('label', { class: 'muted' }, 'Steps ', h('select', { onchange: (e) => { m.steps = +e.target.value; ensureNotes(m); App.touch(); drawRoll(); } }, [16, 32, 64].map((n) => h('option', { value: n, selected: m.steps === n }, n)))),
      h('span', { class: 'sep' }),
      h('label', { class: 'muted' }, 'Scale ', h('select', { onchange: (e) => { MU.scale = e.target.value; drawRoll(); } }, Object.keys(SCALES).map((k) => h('option', { value: k, selected: MU.scale === k }, k)))),
      h('label', { class: 'muted' }, 'Key ', h('select', { onchange: (e) => { MU.root = +e.target.value; drawRoll(); } }, NOTE.map((n, i) => h('option', { value: i, selected: MU.root === i }, n)))),
      h('button', { class: 'btn small', title: 'Scroll piano roll down an octave', onclick: () => { MU.base = Math.max(12, MU.base - 12); drawRoll(); } }, '▼ oct'),
      h('button', { class: 'btn small', onclick: () => { MU.base = Math.min(84, MU.base + 12); drawRoll(); } }, '▲ oct'));
  }
  function renderTracks() {
    const m = mcur(); if (!me.tracks) return;
    if (!m) { me.tracks.replaceChildren(); return; }
    me.tracks.replaceChildren(
      ...m.tracks.map((t, i) => h('div', { class: 'track-row' + (i === MU.track ? ' sel' : ''), onclick: () => { MU.track = i; renderTracks(); drawRoll(); } },
        h('div', { style: { flex: 1 } },
          h('div', { class: 'row' }, h('b', null, 'Track ' + (i + 1)), fSelect(t, 'wave', WAVES, () => App.touch()),
            h('label', { class: 'chk', onclick: (e) => e.stopPropagation() }, h('input', { type: 'checkbox', checked: !!t.muted, onchange: (e) => { t.muted = e.target.checked; App.touch(); drawRoll(); } }), 'mute')),
          h('div', { class: 'row', style: { marginTop: '5px' }, onclick: (e) => e.stopPropagation() }, h('span', { class: 'muted' }, 'vol'), fRange(t, 'vol', 0, 0.6, 0.01, () => App.touch()), h('span', { class: 'muted' }, 'len'), fNum(t, 'len', () => { App.touch(); drawRoll(); }, { min: 0.25, max: 8, step: 0.25, style: 'width:54px' }))),
        h('button', { class: 'btn small danger', onclick: (e) => { e.stopPropagation(); if (m.tracks.length < 2) return; m.tracks.splice(i, 1); MU.track = Math.max(0, Math.min(MU.track, m.tracks.length - 1)); App.touch(); renderTracks(); drawRoll(); } }, '✕'))),
      h('div', { class: 'row', style: { marginTop: '8px' } }, h('button', { class: 'btn small', onclick: () => { m.tracks.push({ wave: 'square', vol: 0.12, len: 1, notes: new Array(m.steps).fill(0) }); MU.track = m.tracks.length - 1; App.touch(); renderTracks(); drawRoll(); } }, '＋ Track')),
      h('div', { class: 'panel-box' }, h('h4', null, 'Selected track tools'),
        h('div', { class: 'row' }, h('button', { class: 'btn small', onclick: randomMelody }, '🎲 Random melody'), h('button', { class: 'btn small danger', onclick: () => { m.tracks[MU.track].notes.fill(0); App.touch(); drawRoll(); } }, 'Clear')),
        h('div', { class: 'row', style: { marginTop: '6px' } }, h('button', { class: 'btn small', onclick: () => transpose(-1) }, '−1'), h('button', { class: 'btn small', onclick: () => transpose(1) }, '+1'), h('button', { class: 'btn small', onclick: () => transpose(-12) }, '−oct'), h('button', { class: 'btn small', onclick: () => transpose(12) }, '+oct'))),
      h('p', { class: 'hint' }, 'Click a cell to place a note, click it again to remove it, drag to paint, right-click to erase. "len" stretches how long each note rings. Assign a song to a level (Levels tab) or to the whole game (Settings).'));
  }
  async function newMusic() {
    const n = await promptBox('New music', 'Name', 'song_' + (App.proj.music.length + 1)); if (!n) return;
    const m = Plat2Templates.newMusic(); m.name = n.trim(); App.proj.music.push(m); App.touch(); MU.id = m.id; MU.track = 0; renderMusicList(); renderMusicBar(); renderTracks(); drawRoll();
  }
  function dupMusic() { const m = mcur(); if (!m) return; const n = clone(m); n.id = uid('m'); n.name = m.name + ' copy'; App.proj.music.push(n); App.touch(); MU.id = n.id; renderMusicList(); renderMusicBar(); renderTracks(); drawRoll(); }
  async function delMusic() {
    const m = mcur(); if (!m) return;
    if (!(await confirmBox('Delete music', 'Delete "' + m.name + '"?', 'Delete', true))) return;
    stopPlay(); App.proj.music = App.proj.music.filter((x) => x !== m);
    App.proj.levels.forEach((l) => { if (l.music === m.id) l.music = ''; }); if (App.proj.settings.music === m.id) App.proj.settings.music = '';
    App.touch(); MU.id = App.proj.music[0] ? App.proj.music[0].id : null; renderMusicList(); renderMusicBar(); renderTracks(); drawRoll();
  }
  function mountMusic(root) {
    me.list = h('div', { class: 'side-scroll' }); me.bar = h('div', { class: 'toolbar' }); me.tracks = h('div', { class: 'side-scroll' });
    me.roll = h('canvas', { id: 'roll', oncontextmenu: (e) => e.preventDefault() });
    me.hint = h('p', { class: 'hint', style: { fontSize: '14px', padding: '20px' } }, 'No music yet. Click ＋ New to write a tune with the piano roll.');
    me.roll.addEventListener('pointerdown', rollDown); me.roll.addEventListener('pointermove', rollMove);
    me.roll.addEventListener('pointerup', () => { MU.drag = null; }); me.roll.addEventListener('pointercancel', () => { MU.drag = null; });
    root.append(h('div', { class: 'sidebar' }, h('div', { class: 'side-head' }, h('h3', null, 'Music'), h('button', { class: 'btn small', onclick: newMusic }, '＋ New'), h('button', { class: 'btn small', onclick: dupMusic }, '⧉'), h('button', { class: 'btn small', onclick: delMusic }, '🗑')), me.list),
      h('div', { class: 'workarea' }, me.bar, h('div', { class: 'piano-wrap' }, me.roll, me.hint)),
      h('div', { class: 'sidebar right' }, h('div', { class: 'side-head' }, h('h3', null, 'Tracks')), me.tracks));
  }
  function showMusic() {
    if (!mcur()) MU.id = App.proj.music[0] ? App.proj.music[0].id : null;
    renderMusicList(); renderMusicBar(); renderTracks(); drawRoll();
    if (me.roll) me.roll.style.display = mcur() ? '' : 'none';
    if (me.hint) me.hint.style.display = mcur() ? 'none' : 'block';
  }
  App.editors.music = { title: 'Music', icon: '🎵', mount: mountMusic, show: showMusic, hide: () => { if (MU.playing) stopPlay(); }, reset: () => { if (MU.playing) stopPlay(); MU.id = null; MU.track = 0; }, refresh: renderMusicList };
})();
