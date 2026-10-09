/* 2plat: game settings, variables and project overview */
(function () {
  'use strict';
  const RES = [['320x180', '320 × 180 (16:9, chunky pixels)'], ['256x144', '256 × 144 (16:9, very chunky)'], ['400x225', '400 × 225 (16:9)'], ['480x270', '480 × 270 (16:9)'], ['640x360', '640 × 360 (16:9, fine)'],
    ['160x144', '160 × 144 (handheld)'], ['256x224', '256 × 224 (retro console)'], ['320x240', '320 × 240 (4:3)']];
  let root, body;

  function render() {
    const P = App.proj, S = P.settings;
    const resKey = S.width + 'x' + S.height;
    const known = RES.some(([k]) => k === resKey);
    const resSel = h('select', {
      onchange: (e) => { const v = e.target.value; if (v === 'custom') return; const [w, hh] = v.split('x').map(Number); S.width = w; S.height = hh; App.touch(); render(); },
    }, RES.map(([k, l]) => h('option', { value: k, selected: k === resKey }, l)), h('option', { value: 'custom', selected: !known }, 'custom…'));
    const varRows = (S.vars || []).map((v, i) => h('div', { class: 'row', style: { marginBottom: '5px' } },
      fText(v, 'name', () => { App.touch(); }, { style: 'width:130px', onchange: () => render() }), h('span', { class: 'muted' }, 'starts at'), fNum(v, 'value', () => App.touch(), { style: 'width:70px' }),
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: (S.hud || []).includes(v.name), onchange: (e) => { S.hud = (S.hud || []).filter((n) => n !== v.name); if (e.target.checked) S.hud.push(v.name); App.touch(); } }), 'show on screen'),
      h('button', { class: 'btn small danger', onclick: () => { S.vars.splice(i, 1); S.hud = (S.hud || []).filter((n) => n !== v.name); App.touch(); render(); } }, '✕')));
    const counts = { Sprites: P.sprites.length, Objects: P.objects.length, Levels: P.levels.length, Sounds: P.sounds.length, Music: P.music.length, 'Placed objects': P.levels.reduce((n, l) => n + l.instances.length, 0) };
    const size = Math.round(JSON.stringify(P).length / 1024);
    body.replaceChildren(h('div', { class: 'cols', style: { maxWidth: '1100px' } },
      h('div', null,
        h('div', { class: 'section-title' }, 'Game'),
        field('Title', fText(S, 'title', () => App.touch(), { style: 'width:220px' })),
        field('Resolution', resSel),
        !known ? field('Custom size', fNum(S, 'width', () => App.touch(), { min: 64, max: 1920, style: 'width:70px' }), h('span', null, '×'), fNum(S, 'height', () => App.touch(), { min: 64, max: 1080, style: 'width:70px' })) : null,
        field('Tile size', fSelect(S, 'tileSize', [[8, '8 px'], [16, '16 px'], [24, '24 px'], [32, '32 px']], () => { S.tileSize = +S.tileSize; App.touch(); }), h('span', { class: 'muted' }, 'level grid')),
        field('Gravity', fNum(S, 'gravity', () => App.touch()), h('span', { class: 'muted' }, 'px/s²  (platformer ~900)')),
        field('Pixel-perfect', fCheck(S, 'pixelArt', () => App.touch(), 'crisp pixels when scaled up')),
        field('Start level', fSelect(S, 'startLevel', P.levels.map((l, i) => [i, (i + 1) + '. ' + l.name]), () => { S.startLevel = +S.startLevel; App.touch(); })),
        field('Default music', fSelect(S, 'music', [['', '(none)']].concat(P.music.map((m) => [m.id, m.name])), () => App.touch())),
        h('div', { class: 'section-title' }, 'Variables'),
        h('p', { class: 'hint' }, 'Variables hold numbers like score or keys. Use them in rules ("add 10 to score", "only if keys ≥ 1"). ', h('b', null, 'lives'), ' is special: the game ends when it hits 0 (delete it for one-hit-and-done).'),
        ...varRows,
        h('button', { class: 'btn small', onclick: () => { S.vars.push({ name: 'var' + (S.vars.length + 1), value: 0 }); App.touch(); render(); } }, '＋ Add variable')),
      h('div', null,
        h('div', { class: 'section-title' }, 'Project'),
        h('table', { class: 'help' }, ...Object.keys(counts).map((k) => h('tr', null, h('td', { class: 'muted' }, k), h('td', null, counts[k]))), h('tr', null, h('td', { class: 'muted' }, 'Project size'), h('td', null, size + ' KB'))),
        h('div', { class: 'row', style: { marginTop: '10px' } },
          h('button', { class: 'btn', onclick: () => App.showTemplates() }, '📁 New from template…'),
          h('button', { class: 'btn', onclick: () => App.exportHtml() }, '🌐 Export game (HTML)')),
        h('div', { class: 'section-title' }, 'How players control your game'),
        h('table', { class: 'help' },
          [['Move', 'Arrow keys / WASD'], ['Jump', 'Space / ↑ / W / Z'], ['Action (shoot…)', 'X / J / K / Shift'], ['Pause', 'Esc'], ['Mute', 'M'], ['Start / confirm', 'Enter / Space / click or tap']].map(([a, b]) => h('tr', null, h('td', { class: 'muted' }, a), h('td', null, h('kbd', null, b)))))),
    ));
  }
  function mount(r) {
    root = r; body = h('div', { class: 'form-scroll' });
    root.append(h('div', { class: 'workarea', style: { background: 'var(--bg)' } }, body));
  }
  function show() { render(); }
  App.editors.settings = { title: 'Settings', icon: '⚙️', mount, show, reset: () => { }, refresh: () => { } };
})();
