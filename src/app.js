/* 2plat: application shell — tabs, files, playtest, export, boot */
(function () {
  'use strict';
  const API = window.api || null;
  const ORDER = ['sprites', 'objects', 'levels', 'sounds', 'music', 'settings'];
  let saveTimer = null, warnedQuota = false;

  /* ---------- project load / migrate ---------- */
  function migrate(p) {
    if (!p || typeof p !== 'object' || !Array.isArray(p.levels) || !p.settings) throw new Error('Not a 2plat project');
    p.format = '2plat'; p.version = 1; p.name = p.name || 'Untitled';
    p.sprites = p.sprites || []; p.objects = p.objects || []; p.sounds = p.sounds || []; p.music = p.music || [];
    p.settings = Object.assign({ title: p.name, width: 320, height: 180, tileSize: 16, gravity: 900, bg: '#1a1c2c', pixelArt: true, startLevel: 0, music: '', hud: ['score', 'lives'], vars: [{ name: 'score', value: 0 }, { name: 'lives', value: 3 }] }, p.settings);
    p.objects = p.objects.map((o) => Plat2Templates.defObject(o));
    p.levels.forEach((l) => { l.instances = l.instances || []; l.instances.forEach((i) => { if (!i.id) i.id = uid('i'); }); });
    p.music.forEach((m) => m.tracks.forEach((t) => { t.notes = t.notes || []; }));
    if (!p.levels.length) p.levels.push(Plat2Templates.newLevel('Level 1', 50, 12));
    return p;
  }
  function loadProject(p, file) {
    p = migrate(p);
    if (App.editors.music.hide) App.editors.music.hide();
    App.proj = p; App.file = file || null; App.dirty = false;
    Object.values(App.editors).forEach((e) => e.reset && e.reset());
    $('#pname').value = p.name;
    updateTitle(); setTab(App.tab || 'sprites', true); updateStatus();
  }
  App.loadProject = loadProject;

  /* ---------- dirty / autosave ---------- */
  App.markDirty = function () {
    App.dirty = true; updateTitle(); updateStatus();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem('2plat.autosave', JSON.stringify(App.proj)); } catch (e) { if (!warnedQuota) { warnedQuota = true; toast('Autosave is full — save your project to a file!', 'err'); } }
    }, 1200);
  };
  function updateTitle() {
    document.title = (App.dirty ? '• ' : '') + (App.proj ? App.proj.name : '2plat') + ' — 2plat';
    if (API && API.setDirty) API.setDirty(App.dirty);
  }
  function updateStatus() {
    const st = $('#status'); if (!st || !App.proj) return; const P = App.proj;
    st.replaceChildren(h('span', null, '🎨 ' + P.sprites.length), h('span', null, '🧩 ' + P.objects.length), h('span', null, '🗺️ ' + P.levels.length), h('span', null, '🔊 ' + P.sounds.length), h('span', null, '🎵 ' + P.music.length),
      h('span', { class: 'spacer' }), h('span', null, (App.file ? App.file.replace(/^.*[\\/]/, '') : 'unsaved project') + (App.dirty ? '  ● unsaved changes' : '  ✓ saved')));
  }

  /* ---------- tabs ---------- */
  function setTab(name, force) {
    if (App.tab !== name || force) {
      const prev = App.editors[App.tab]; if (prev && prev.hide && App.tab !== name) prev.hide();
    }
    App.tab = name;
    document.querySelectorAll('.rail-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.pane').forEach((p) => p.classList.toggle('active', p.dataset.tab === name));
    const ed = App.editors[name]; if (ed && ed.show) ed.show();
  }
  App.setTab = setTab;

  /* ---------- files ---------- */
  App.saveBlob = async function (name, blob, mime) {
    if (API && API.saveFile) {
      const b64 = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.readAsDataURL(blob); });
      const p = await API.saveFile(name, b64, true); if (p) toast('Saved ' + p.replace(/^.*[\\/]/, ''), 'ok');
    } else download(name, blob, mime);
  };
  async function saveProject(asNew) {
    App.proj.name = $('#pname').value.trim() || 'Untitled';
    const json = JSON.stringify(App.proj);
    if (API && API.saveProject) {
      const p = await API.saveProject(json, asNew ? null : App.file, App.proj.name + '.2plat');
      if (!p) return false; App.file = p;
    } else { download(App.proj.name.replace(/\W+/g, '_') + '.2plat', json, 'application/json'); App.file = App.proj.name + '.2plat'; }
    App.dirty = false; updateTitle(); updateStatus(); toast('Project saved', 'ok');
    try { localStorage.setItem('2plat.autosave', json); } catch (e) { /* ignore */ }
    return true;
  }
  async function guardDirty() {
    if (!App.dirty) return true;
    return confirmBox('Unsaved changes', 'You have unsaved changes. Discard them and continue?', 'Discard', true);
  }
  async function openProject() {
    if (!(await guardDirty())) return;
    try {
      if (API && API.openProject) { const r = await API.openProject(); if (!r) return; loadProject(JSON.parse(r.data), r.path); }
      else { const f = (await pickFile('.2plat,.json'))[0]; if (!f) return; loadProject(JSON.parse(await readAsText(f)), f.name); }
      toast('Project opened', 'ok');
    } catch (e) { toast('Could not open project: ' + e.message, 'err'); }
  }
  App.showTemplates = function (first) {
    const body = h('div', null, h('p', { class: 'hint' }, first ? 'Welcome to 2plat! Pick a starting point — you can change everything.' : 'Starting a new project replaces the current one.'),
      ...Plat2Templates.list.map((t) => h('div', { class: 'tpl', onclick: async () => {
        if (!first && !(await guardDirty())) return;
        document.querySelectorAll('.modal-back').forEach((m) => m.remove());
        loadProject(Plat2Templates.make(t.id)); App.dirty = !first; updateTitle(); updateStatus(); setTab(t.id === 'blank' ? 'sprites' : 'levels', true);
      } }, h('div', null, h('b', null, t.name), h('div', { class: 'muted' }, t.desc)))));
    modal({ title: first ? 'New game' : 'New project', body, buttons: [{ label: first ? 'Close' : 'Cancel' }], width: 520 });
  };

  /* ---------- playtest ---------- */
  App.play = async function (opts) {
    opts = opts || {};
    if (App.playing) return;
    if (!App.proj.levels.length) { toast('Add a level first', 'err'); return; }
    const S = App.proj.settings; let lvIdx = opts.startLevel != null ? opts.startLevel : S.startLevel || 0;
    const L = App.proj.levels[lvIdx] || App.proj.levels[0];
    if (!L.instances.some((i) => { const o = App.object(i.obj); return o && o.isPlayer; })) toast('Heads up: this level has no player object', 'err');
    App.playing = true;
    if (App.editors.music.hide) App.editors.music.hide();
    const ov = $('#play'); ov.replaceChildren(); ov.classList.add('open');
    const cv = h('canvas', { tabindex: '0' });
    let game = null;
    const fitCanvas = () => {
      const stage = $('.stage', ov); if (!stage) return;
      const aw = stage.clientWidth - 16, ah = stage.clientHeight - 16;
      let s = Math.min(aw / S.width, ah / S.height); if (S.pixelArt !== false && s >= 1) s = Math.floor(s);
      cv.style.width = Math.floor(S.width * s) + 'px'; cv.style.height = Math.floor(S.height * s) + 'px';
      cv.style.imageRendering = S.pixelArt === false ? 'auto' : 'pixelated';
    };
    const close = () => {
      if (game) game.stop(); App.sharedAudio().stopMusic(); window.removeEventListener('resize', fitCanvas); window.removeEventListener('keydown', onKey, true);
      ov.classList.remove('open'); ov.replaceChildren(); App.playing = false;
    };
    const restart = () => { if (game) game.stop(); start(); };
    const onKey = (e) => { if (e.key === 'F8') { e.preventDefault(); close(); } else if (e.key === 'F5') { e.preventDefault(); restart(); } };
    const start = async () => {
      game = new Plat2.Game(cv, clone(App.proj), { audio: App.sharedAudio(), skipTitle: opts.skipTitle !== false, startLevel: lvIdx });
      await game.load(); fitCanvas(); game.start(); cv.focus();
    };
    ov.append(
      h('div', { class: 'bar' }, h('b', { style: { color: 'var(--accent)' } }, '▶ Playtest'), h('span', { class: 'muted' }, 'Move: arrows/WASD · Jump: Space · Action: X · Pause: Esc · Mute: M · Restart: F5 · Back: F8'),
        h('span', { class: 'spacer' }), h('button', { class: 'btn', onclick: restart }, '↻ Restart'), h('button', { class: 'btn danger', onclick: close }, '✕ Back to editor')),
      h('div', { class: 'stage' }, cv));
    window.addEventListener('resize', fitCanvas); window.addEventListener('keydown', onKey, true);
    await start();
  };

  /* ---------- export ---------- */
  async function runtimeSource() {
    if (API && API.readText) return API.readText('src/runtime.js');
    return (await fetch('src/runtime.js')).text();
  }
  async function buildHtml() { return Plat2Export.buildHtml(App.proj, await runtimeSource()); }
  App.exportHtml = async function () {
    try {
      const html = await buildHtml();
      const name = (App.proj.name || 'game').replace(/\W+/g, '_') + '.html';
      await App.saveBlob(name, new Blob([html], { type: 'text/html' }), 'text/html');
    } catch (e) { toast('Export failed: ' + e.message, 'err'); }
  };

  /* ---------- help ---------- */
  function showHelp() {
    const row = (a, b) => h('tr', null, h('td', null, h('kbd', null, a)), h('td', null, b));
    modal({
      title: '2plat — quick guide', width: 640, buttons: [{ label: 'Got it', primary: true }],
      body: h('div', null,
        h('p', null, h('b', null, 'Make a game in 5 steps')),
        h('ol', null, h('li', null, h('b', null, 'Sprites'), ' — draw pixel art (or import PNGs), with animation frames.'),
          h('li', null, h('b', null, 'Objects'), ' — turn sprites into things: players, enemies, blocks, coins. Pick a behavior and add logic rules.'),
          h('li', null, h('b', null, 'Levels'), ' — paint objects onto a grid. Press ▶ to playtest right there.'),
          h('li', null, h('b', null, 'Sounds & Music'), ' — design effects and write tunes with the piano roll.'),
          h('li', null, h('b', null, 'Settings'), ' — resolution, gravity, variables. Then ', h('b', null, 'Export'), ' a standalone HTML game anyone can play.')),
        h('p', null, h('b', null, 'Shortcuts')),
        h('table', { class: 'help' },
          row('Ctrl+S', 'Save project'), row('Ctrl+O', 'Open project'), row('Ctrl+Z / Ctrl+Y', 'Undo / redo (in the sprite and level editors)'),
          row('F5', 'Playtest from the start level'), row('F6', 'Playtest the level you are editing'),
          row('B E G I L R O', 'Tool shortcuts (brush, eraser, fill/grid, picker, line, rect, ellipse)'),
          row('Space + drag', 'Pan the level view (also middle mouse)'), row('Wheel', 'Zoom the level view'),
          row('Del / arrows', 'Delete / nudge selected objects (Select tool)'), row('Ctrl+C / V', 'Copy / paste selection')),
        h('p', { class: 'hint' }, 'Your work autosaves in this app; use Save to keep a .2plat file. Logic rules are the heart of 2plat: "When touching Coin → destroy it, add 10 to score, play sound."')),
    });
  }

  /* ---------- keyboard ---------- */
  function typing(t) { return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable); }
  window.addEventListener('keydown', (e) => {
    if (App.playing) return;
    if (document.querySelector('.modal-back')) return;
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (mod && k === 's') { e.preventDefault(); saveProject(e.shiftKey); return; }
    if (mod && k === 'o') { e.preventDefault(); openProject(); return; }
    if (e.key === 'F5') { e.preventDefault(); App.play({}); return; }
    if (e.key === 'F6') { e.preventDefault(); App.play({ startLevel: levelIndexForPlay() }); return; }
    if (typing(e.target)) return;
    const ed = App.editors[App.tab];
    if (ed && ed.onKey && ed.onKey(e)) return;
  });
  window.addEventListener('keyup', (e) => { const ed = App.editors[App.tab]; if (ed && ed.onKeyUp) ed.onKeyUp(e); });
  function levelIndexForPlay() {
    const sel = document.querySelector('#pane-levels .list-item.sel'); if (!sel || App.tab !== 'levels') return App.proj.settings.startLevel || 0;
    return Array.from(sel.parentNode.children).indexOf(sel);
  }
  window.addEventListener('beforeunload', (e) => { if (App.dirty && !API) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- shell ---------- */
  function buildShell() {
    const app = $('#app');
    app.replaceChildren(
      h('div', { id: 'top' },
        h('div', { id: 'logo' }, '2', h('span', null, 'plat')),
        h('input', { id: 'pname', type: 'text', title: 'Project name', oninput: (e) => { App.proj.name = e.target.value; App.touch(); } }),
        h('button', { class: 'btn', onclick: () => App.showTemplates() }, '📄 New'), h('button', { class: 'btn', onclick: openProject }, '📂 Open'),
        h('button', { class: 'btn', onclick: () => saveProject(false), title: 'Ctrl+S' }, '💾 Save'),
        h('button', { class: 'btn', onclick: () => App.exportHtml() }, '🌐 Export game'),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn', onclick: showHelp }, '? Help'),
        h('button', { class: 'btn play', title: 'F5', onclick: () => App.play({}) }, '▶ Play')),
      h('div', { id: 'main' },
        h('div', { id: 'rail' }, ORDER.map((k) => h('button', { class: 'rail-btn', 'data-tab': k, onclick: () => setTab(k) }, h('span', { class: 'ic' }, App.editors[k].icon), h('span', { class: 'tx' }, App.editors[k].title)))),
        h('div', { id: 'content' }, ORDER.map((k) => { const pane = h('div', { class: 'pane', id: 'pane-' + k, 'data-tab': k }); App.editors[k].mount(pane); return pane; }))),
      h('div', { id: 'status' }));
    document.body.append(h('div', { id: 'play' }));
  }

  function boot() {
    App.proj = { sprites: [], objects: [], levels: [], sounds: [], music: [], settings: { tileSize: 16, width: 320, height: 180, vars: [], hud: [] } };
    buildShell();
    let p = null;
    try { const s = localStorage.getItem('2plat.autosave'); if (s) p = JSON.parse(s); } catch (e) { p = null; }
    if (p) { try { loadProject(p); App.dirty = true; updateTitle(); updateStatus(); toast('Restored your last session', 'ok'); } catch (e) { p = null; } }
    if (!p) { loadProject(Plat2Templates.make('platformer')); App.dirty = false; updateTitle(); updateStatus(); setTab('levels'); App.showTemplates(true); }
    if (window.Plat2Events) Plat2Events.announce(toast);
    if (API && API.onMenu) API.onMenu((a) => {
      if (a === 'new') App.showTemplates(); else if (a === 'open') openProject(); else if (a === 'save') saveProject(false); else if (a === 'saveas') saveProject(true);
      else if (a === 'export') App.exportHtml(); else if (a === 'play') App.play({}); else if (a === 'help') showHelp();
    });
  }
  document.addEventListener('DOMContentLoaded', boot);
})();
