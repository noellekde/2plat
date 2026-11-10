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
    const stat = (icon, n, label) => h('span', { class: 'st', title: label }, ic(icon), n);
    st.replaceChildren(stat('sprites', P.sprites.length, 'Sprites'), stat('objects', P.objects.length, 'Objects'), stat('levels', P.levels.length, 'Levels'), stat('sounds', P.sounds.length, 'Sounds'), stat('music', P.music.length, 'Music'),
      h('span', { class: 'spacer' }),
      h('span', { class: 'muted' }, App.file ? App.file.replace(/^.*[\\/]/, '') : 'unsaved project'),
      h('span', { class: 'save' + (App.dirty ? ' dirty' : '') }, h('i'), App.dirty ? 'Unsaved changes' : 'All changes saved'));
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
    const pick = async (t) => {
      if (!first && !(await guardDirty())) return;
      document.querySelectorAll('.modal-back').forEach((m) => m.remove());
      loadProject(Plat2Templates.make(t.id)); App.dirty = !first; updateTitle(); updateStatus(); setTab(t.id === 'blank' ? 'sprites' : 'levels', true);
      if (first && window.Plat2Tour) setTimeout(() => Plat2Tour.start(true), 350);
    };
    const card = (t) => {
      const art = t.art || { bg: ['#2a2c3a', '#1a1b24'], sprites: [] };
      const imgs = (Plat2Templates.preview(t.id) || []).map((src) => h('img', { src, alt: '' }));
      return h('button', { class: 'tpl', type: 'button', onclick: () => pick(t) },
        h('div', { class: 'tpl-art', style: { background: 'linear-gradient(180deg,' + art.bg[0] + ',' + art.bg[1] + ')' } }, imgs.length ? null : h('div', { class: 'tpl-mark' }, ic('sparkle')), ...imgs),
        h('div', { class: 'tpl-body' }, h('span', { class: 'tpl-tag' }, t.tag || ''), h('b', null, t.name), h('span', null, t.desc)));
    };
    const body = h('div', null, h('p', { class: 'hint', style: { marginTop: 0 } }, first ? 'Pick a starting point. Everything in it can be changed, so you can\u2019t get this wrong.' : 'Starting a new project replaces the current one.'),
      h('div', { class: 'tpl-grid' }, ...Plat2Templates.list.map(card)));
    modal({ title: first ? 'Welcome to 2plat. What do you want to make?' : 'New project', body, buttons: [{ label: first ? 'Skip' : 'Cancel' }], width: 780 });
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
      App.game = game;
      await game.load(); fitCanvas(); game.start(); cv.focus();
    };
    ov.append(
      h('div', { class: 'bar' }, h('b', null, ic('play'), 'Playtest'), h('span', { class: 'muted' }, 'Move: arrows / WASD   Jump: Space   Action: X   Pause: Esc   Mute: M   Restart: F5   Back: F8'),
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
      title: 'Quick guide', width: 660, buttons: [{ label: 'Take the tour', onclick: () => { setTimeout(() => window.Plat2Tour && Plat2Tour.start(true), 200); } }, { label: 'Got it', primary: true }],
      body: h('div', null,
        h('ol', { class: 'guide-steps' },
          h('li', null, h('div', null, h('b', null, 'Sprites'), h('div', { class: 'muted' }, 'Draw pixel art, or import PNGs. Add frames to animate.'))),
          h('li', null, h('div', null, h('b', null, 'Objects'), h('div', { class: 'muted' }, 'Turn sprites into players, enemies, blocks and coins. Pick a behavior, then add logic rules.'))),
          h('li', null, h('div', null, h('b', null, 'Levels'), h('div', { class: 'muted' }, 'Paint objects onto a grid and press Play to test right there.'))),
          h('li', null, h('div', null, h('b', null, 'Sounds & Music'), h('div', { class: 'muted' }, 'Design effects and write tunes on the piano roll.'))),
          h('li', null, h('div', null, h('b', null, 'Settings & Export'), h('div', { class: 'muted' }, 'Set resolution, gravity and variables, then export one HTML file anyone can play.')))),
        h('div', { class: 'section-title' }, 'Shortcuts'),
        h('table', { class: 'help' },
          row('Ctrl+S', 'Save project'), row('Ctrl+O', 'Open project'), row('Ctrl+Z / Ctrl+Y', 'Undo / redo (sprite and level editors)'),
          row('F5', 'Play from the start level'), row('F6', 'Play the level you are editing'),
          row('B E G I L R O', 'Tool shortcuts (brush, eraser, fill/grid, picker, line, rect, ellipse)'),
          row('1 - 6', 'Jump between the tabs'),
          row('Space + drag', 'Pan the level view (also middle mouse)'), row('Wheel', 'Zoom the level view'),
          row('Del / arrows', 'Delete / nudge selected objects (Select tool)'), row('Ctrl+C / V', 'Copy / paste selection')),
        h('p', { class: 'hint' }, 'Your work autosaves in this app; use Save to keep a .2plat file. Rules are the heart of 2plat: "When touching Coin: destroy it, add 10 to score, play sound."')),
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
    if (!mod && !e.altKey && /^[1-6]$/.test(e.key) && App.tab !== 'levels' && App.tab !== 'music') { setTab(ORDER[+e.key - 1]); return; }
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
    const tip = (k) => App.editors[k].title + '  (' + (ORDER.indexOf(k) + 1) + ')';
    app.replaceChildren(
      h('div', { id: 'top' },
        h('div', { id: 'logo' }, '2', h('span', null, 'plat'), h('small', null, 'v' + (window.PLAT2_VERSION || ''))),
        h('input', { id: 'pname', type: 'text', title: 'Project name', spellcheck: 'false', oninput: (e) => { App.proj.name = e.target.value; App.touch(); } }),
        h('div', { class: 'vsep' }),
        h('button', { class: 'btn ghost', title: 'New project', onclick: () => App.showTemplates() }, ic('filePlus'), 'New'),
        h('button', { class: 'btn ghost', title: 'Open (Ctrl+O)', onclick: openProject }, ic('folder'), 'Open'),
        h('button', { class: 'btn ghost', title: 'Save (Ctrl+S)', onclick: () => saveProject(false) }, ic('save'), 'Save'),
        h('div', { class: 'vsep' }),
        h('button', { class: 'btn ghost', title: 'Export a standalone HTML game', onclick: () => App.exportHtml() }, ic('export'), 'Export'),
        h('button', { class: 'btn ghost', title: 'Choose the color palette for the sprite editor', onclick: () => Plat2Palettes.openMenu(() => App.editors.sprites.paletteChanged()) }, ic('palette'), 'Palettes'),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn ghost', title: 'Quick guide and tour', onclick: showHelp }, ic('help'), 'Help'),
        h('button', { class: 'btn play', id: 'play-btn', title: 'Play the game (F5)', onclick: () => App.play({}) }, ic('play'), 'Play')),
      h('div', { id: 'main' },
        h('div', { id: 'rail' }, ORDER.map((k) => h('button', { class: 'rail-btn', id: 'rail-' + k, title: tip(k), 'data-tab': k, onclick: () => setTab(k) }, h('span', { class: 'ic' }, ic(App.editors[k].iconName || 'dot')), h('span', { class: 'tx' }, App.editors[k].title)))),
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
    if (API && API.onMenu) API.onMenu((a) => {
      if (a === 'new') App.showTemplates(); else if (a === 'open') openProject(); else if (a === 'save') saveProject(false); else if (a === 'saveas') saveProject(true);
      else if (a === 'export') App.exportHtml(); else if (a === 'play') App.play({}); else if (a === 'help') showHelp();
    });
  }
  document.addEventListener('DOMContentLoaded', boot);
})();
