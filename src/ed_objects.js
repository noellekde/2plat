/* 2plat: object editor — properties, behaviors and visual logic rules */
(function () {
  'use strict';

  const BEHAVIORS = [
    ['none', 'None (static)'], ['platformer', 'Player: platformer (side view)'], ['topdown', 'Player: top-down (8-way)'],
    ['patrol', 'Patrol (walks back and forth)'], ['chaser', 'Chaser (follows the player)'], ['bounce', 'Bouncer (ball)'],
    ['turret', 'Turret (shoots bullets)'], ['bullet', 'Bullet / projectile'], ['oscillate', 'Oscillate (moving platform / decor)'],
  ];
  const BDEF = {
    none: { flags: { gravity: false, collideSolids: false, isPlayer: false }, props: {} },
    platformer: { flags: { gravity: true, collideSolids: true, isPlayer: true }, props: { speed: 92, jump: 275, maxJumps: 2, accel: 900 } },
    topdown: { flags: { gravity: false, collideSolids: true, isPlayer: true }, props: { speed: 70 } },
    patrol: { flags: { gravity: true, collideSolids: true, isPlayer: false }, props: { speed: 24, edge: true } },
    chaser: { flags: { gravity: false, collideSolids: false, isPlayer: false }, props: { speed: 34, range: 110 } },
    bounce: { flags: { gravity: false, collideSolids: true, isPlayer: false }, props: { speed: 60 } },
    turret: { flags: { gravity: false, collideSolids: false, isPlayer: false }, props: { interval: 1.7, range: 160, bullet: '' } },
    bullet: { flags: { gravity: false, collideSolids: true, isPlayer: false }, props: { speed: 150, life: 3 } },
    oscillate: { flags: { gravity: false, collideSolids: false, isPlayer: false }, props: { axis: 'x', dist: 40, period: 3 } },
  };
  const BPROPS = {
    platformer: [['speed', 'Run speed', 'num'], ['accel', 'Acceleration', 'num'], ['jump', 'Jump strength', 'num'], ['maxJumps', 'Jumps (2 = double jump)', 'num'], ['gravityScale', 'Gravity scale', 'num']],
    topdown: [['speed', 'Move speed', 'num']],
    patrol: [['speed', 'Walk speed', 'num'], ['edge', 'Turn at ledges', 'check']],
    chaser: [['speed', 'Chase speed', 'num'], ['range', 'Sight range (px)', 'num']],
    bounce: [['speed', 'Speed', 'num']],
    turret: [['interval', 'Seconds between shots', 'num'], ['range', 'Range (px)', 'num'], ['bullet', 'Bullet object', 'obj']],
    bullet: [['speed', 'Speed', 'num'], ['life', 'Lifetime (s)', 'num']],
    oscillate: [['axis', 'Axis', ['x', 'y']], ['dist', 'Distance (px)', 'num'], ['period', 'Seconds per cycle', 'num']],
  };
  const KEYS = [['left', 'Left (←/A)'], ['right', 'Right (→/D)'], ['up', 'Up (↑/W)'], ['down', 'Down (↓/S)'], ['jump', 'Jump (Space/↑/W/Z)'], ['action', 'Action (X/J/K/Shift)']];
  const EVENTS = {
    create: { label: 'When created', fields: [] },
    step: { label: 'Every frame', fields: [] },
    keypress: { label: 'When key pressed', fields: [['key', 'Key', KEYS]] },
    keyhold: { label: 'While key held', fields: [['key', 'Key', KEYS]] },
    timer: { label: 'Every N seconds', fields: [['seconds', 'Seconds', 'num']] },
    collision: { label: 'When touching', fields: [['target', 'Object', 'obj'], ['where', 'From', [['any', 'anywhere'], ['stomp', 'above (stomp)'], ['side', 'side / below']]], ['once', 'only on first contact', 'check']] },
    landed: { label: 'When landing on ground', fields: [] },
    hitwall: { label: 'When hitting a wall/floor', fields: [] },
    outside: { label: 'When leaving the level', fields: [] },
    destroy: { label: 'When destroyed', fields: [] },
  };
  const OPS = [['set', 'set to'], ['add', 'add'], ['sub', 'subtract'], ['mul', 'multiply by'], ['toggle', 'toggle 0/1']];
  const ACTIONS = {
    var: { label: 'Change variable', def: { name: 'score', op: 'add', value: 10 }, fields: [['name', 'var', 'var'], ['op', 'op', OPS], ['value', 'value', 'num']] },
    destroy: { label: 'Destroy', def: { who: 'self' }, fields: [['who', 'who', [['self', 'this object'], ['other', 'the touched object']]]] },
    spawn: { label: 'Create object', def: { obj: '', ox: 8, oy: 0, vx: 0, vy: 0 }, fields: [['obj', 'obj', 'obj'], ['ox', 'at x+', 'num'], ['oy', 'y+', 'num'], ['vx', 'speed x', 'num'], ['vy', 'y', 'num']] },
    sound: { label: 'Play sound', def: { sound: '' }, fields: [['sound', 'sound', 'sound']] },
    music: { label: 'Play music', def: { music: '' }, fields: [['music', 'music', 'music']] },
    level: { label: 'Go to level', def: { to: 'next', index: 0 }, fields: [['to', 'go to', [['next', 'next level'], ['restart', 'restart level'], ['first', 'first level'], ['index', 'level #…']]], ['index', 'number (0 = first)', 'num', (a) => a.to === 'index']] },
    text: { label: 'Show floating text', def: { text: 'Nice!' }, fields: [['text', 'text', 'text']] },
    velocity: { label: 'Set speed', def: { vx: '', vy: -200, mode: 'set' }, fields: [['vx', 'x', 'num'], ['vy', 'y', 'num'], ['mode', 'mode', [['set', 'set (x follows facing)'], ['abs', 'set (absolute)'], ['add', 'add']]]] },
    jump: { label: 'Jump / launch up', def: { power: 300 }, fields: [['power', 'power', 'num']] },
    shake: { label: 'Screen shake', def: { amount: 3, time: 0.25 }, fields: [['amount', 'amount', 'num'], ['time', 'seconds', 'num']] },
    win: { label: 'Win the game', def: { text: 'You did it!' }, fields: [['text', 'message', 'text']] },
    gameover: { label: 'Game over', def: { text: 'Better luck next time' }, fields: [['text', 'message', 'text']] },
    loseLife: { label: 'Lose a life (respawn)', def: {}, fields: [] },
    teleport: { label: 'Teleport to tile', def: { x: 2, y: 2 }, fields: [['x', 'tile x', 'num'], ['y', 'tile y', 'num']] },
    flip: { label: 'Turn around', def: {}, fields: [] },
    checkpoint: { label: 'Set checkpoint here', def: {}, fields: [] },
    particles: { label: 'Particle burst', def: { color: '#ffcd75' }, fields: [['color', 'color', 'color']] },
  };
  const CATS = ['player', 'enemies', 'items', 'hazards', 'terrain', 'projectiles', 'decor', 'misc'];

  const OE = { id: null };
  let els = {};
  const cur = () => App.object(OE.id);

  function varNames() {
    const set = new Set((App.proj.settings.vars || []).map((v) => v.name));
    return Array.from(set);
  }

  /* ---------- object list ops ---------- */
  const NEW_KINDS = [
    ['blank', 'Blank object', {}],
    ['player', 'Player (platformer)', { behavior: 'platformer', category: 'player', layer: 10 }],
    ['topdown', 'Player (top-down)', { behavior: 'topdown', category: 'player', layer: 10 }],
    ['enemy', 'Walking enemy', { behavior: 'patrol', category: 'enemies', layer: 5 }],
    ['flyer', 'Flying chaser', { behavior: 'chaser', category: 'enemies', layer: 6 }],
    ['item', 'Collectible item', { category: 'items', layer: 2 }],
    ['block', 'Solid block', { solid: true, category: 'terrain' }],
    ['platform', 'One-way platform', { solid: true, oneWay: true, category: 'terrain' }],
    ['hazard', 'Hazard (spikes, lava...)', { category: 'hazards', layer: 3 }],
    ['bullet', 'Projectile', { behavior: 'bullet', category: 'projectiles', layer: 7, flip: false }],
    ['decor', 'Decoration (background)', { category: 'decor', layer: -2 }],
  ];
  function applyBehavior(o, b, keepFlags) {
    o.behavior = b;
    const d = BDEF[b];
    if (!keepFlags) Object.assign(o, d.flags);
    o.props = Object.assign({}, d.props, o.props || {});
    Object.keys(d.props).forEach((k) => { if (o.props[k] === undefined) o.props[k] = d.props[k]; });
  }
  function newObject() {
    let kind = 'blank';
    const sel = h('select', { class: 'wide', onchange: (e) => { kind = e.target.value; } }, NEW_KINDS.map(([k, l]) => h('option', { value: k }, l)));
    const nm = h('input', { type: 'text', class: 'wide', value: 'Object ' + (App.proj.objects.length + 1) });
    const create = () => {
      const k = NEW_KINDS.find((x) => x[0] === kind);
      const o = Plat2Templates.defObject(Object.assign({ id: uid('o'), name: nm.value.trim() || 'Object', spriteId: App.proj.sprites[0] ? App.proj.sprites[0].id : '' }, k[2]));
      applyBehavior(o, o.behavior);
      App.proj.objects.push(o); App.touch(); select(o.id);
    };
    modal({
      title: 'New object', body: h('div', null, h('label', { class: 'lbl' }, 'Name'), nm, h('label', { class: 'lbl' }, 'Start from'), sel),
      buttons: [{ label: 'Cancel' }, { label: 'Create', primary: true, onclick: create }],
    });
  }
  function dupObject() {
    const o = cur(); if (!o) return; const n = clone(o); n.id = uid('o'); n.name = o.name + ' copy';
    App.proj.objects.push(n); App.touch(); select(n.id);
  }
  async function delObject() {
    const o = cur(); if (!o) return;
    const count = App.proj.levels.reduce((n, l) => n + l.instances.filter((i) => i.obj === o.id).length, 0);
    if (!(await confirmBox('Delete object', 'Delete "' + o.name + '"?' + (count ? ' ' + count + ' placed instance(s) will be removed from your levels.' : ''), 'Delete', true))) return;
    App.proj.levels.forEach((l) => { l.instances = l.instances.filter((i) => i.obj !== o.id); });
    App.proj.objects.forEach((x) => (x.rules || []).forEach((r) => { if (r.target === o.id) r.target = ''; (r.actions || []).forEach((a) => { if (a.obj === o.id) a.obj = ''; }); if (x.props && x.props.bullet === o.id) x.props.bullet = ''; }));
    App.proj.objects = App.proj.objects.filter((x) => x !== o);
    App.touch(); select(App.proj.objects[0] ? App.proj.objects[0].id : null);
  }

  function select(id) { OE.id = id; renderList(); renderForm(); }
  function renderList() {
    if (!els.list) return;
    const out = [];
    const cats = CATS.concat(Array.from(new Set(App.proj.objects.map((o) => o.category || 'misc'))).filter((c) => !CATS.includes(c)));
    cats.forEach((c) => {
      const items = App.proj.objects.filter((o) => (o.category || 'misc') === c);
      if (!items.length) return;
      out.push(h('div', { class: 'cat-head' }, c));
      items.forEach((o) => out.push(h('div', { class: 'list-item' + (o.id === OE.id ? ' sel' : ''), onclick: () => select(o.id) },
        thumb(o.spriteId, 30), h('div', { class: 'nm' }, o.name, h('div', { class: 'sub' }, (BEHAVIORS.find((b) => b[0] === o.behavior) || [0, 'None'])[1].split(' (')[0] + (o.solid ? ' · solid' : ''))))));
    });
    els.list.replaceChildren(...out);
  }

  /* ---------- field helpers for dropdowns of project things ---------- */
  function objSelect(model, key, onchange) {
    return fSelect(model, key, [['', '— choose —']].concat(App.proj.objects.map((o) => [o.id, o.name])), onchange);
  }
  function spriteSelect(model, key, onchange, allowNone) {
    return fSelect(model, key, [['', allowNone ? '(none)' : '— choose —']].concat(App.proj.sprites.map((s) => [s.id, s.name])), onchange);
  }
  function renderField(spec, model, onchange) {
    const [key, , type] = spec;
    if (Array.isArray(type)) return fSelect(model, key, type, onchange);
    switch (type) {
      case 'num': return fNum(model, key, onchange);
      case 'text': return fText(model, key, onchange, { style: 'width:150px' });
      case 'check': return fCheck(model, key, onchange, '');
      case 'obj': return objSelect(model, key, onchange);
      case 'sound': return fSelect(model, key, [['', '— choose —']].concat(App.proj.sounds.map((s) => [s.id, s.name])), onchange);
      case 'music': return fSelect(model, key, [['', '(stop music)']].concat(App.proj.music.map((s) => [s.id, s.name])), onchange);
      case 'var': return fText(model, key, onchange, { list: 'vars-dl', style: 'width:110px', placeholder: 'variable' });
      case 'color': return fColor(model, key, onchange);
      default: return fText(model, key, onchange);
    }
  }

  /* ---------- rules ---------- */
  function newRule(event) {
    const base = { event, actions: [] };
    if (event === 'keypress' || event === 'keyhold') base.key = 'action';
    if (event === 'timer') base.seconds = 2;
    if (event === 'collision') { base.target = ''; base.where = 'any'; base.once = true; }
    return base;
  }
  const first = (id) => (App.proj.objects.find((o) => o.id !== id) || {}).id || '';
  const PRESETS = [
    ['Collect item (touch → disappear, +score)', (o) => Object.assign(newRule('collision'), { target: first(o.id), actions: [{ type: 'destroy', who: 'other' }, { type: 'var', name: 'score', op: 'add', value: 10 }, { type: 'sound', sound: (App.proj.sounds.find((s) => s.name === 'coin') || {}).id || '' }] })],
    ['Hurt me on touch (lose a life)', (o) => Object.assign(newRule('collision'), { target: first(o.id), actions: [{ type: 'loseLife' }] })],
    ['Stomp enemy (land on top → defeat & bounce)', (o) => Object.assign(newRule('collision'), { target: first(o.id), where: 'stomp', actions: [{ type: 'destroy', who: 'other' }, { type: 'var', name: 'score', op: 'add', value: 100 }, { type: 'velocity', vx: '', vy: -190, mode: 'set' }] })],
    ['Reach goal (touch → next level)', (o) => Object.assign(newRule('collision'), { target: first(o.id), actions: [{ type: 'sound', sound: (App.proj.sounds.find((s) => s.name === 'powerup') || {}).id || '' }, { type: 'level', to: 'next' }] })],
    ['Spring (touch → launch upward)', (o) => Object.assign(newRule('collision'), { target: first(o.id), once: false, actions: [{ type: 'jump', power: 380 }] })],
    ['Shoot (action key → fire projectile)', (o) => Object.assign(newRule('keypress'), { key: 'action', actions: [{ type: 'spawn', obj: first(o.id), ox: 10, oy: 0, vx: 200, vy: 0 }, { type: 'sound', sound: (App.proj.sounds.find((s) => s.name === 'laser') || {}).id || '' }] })],
    ['Fell out of the level (lose a life)', () => Object.assign(newRule('outside'), { actions: [{ type: 'loseLife' }] })],
    ['Spawn something every 2 seconds', (o) => Object.assign(newRule('timer'), { seconds: 2, actions: [{ type: 'spawn', obj: first(o.id), ox: 0, oy: 0, vx: 0, vy: 0 }] })],
    ['Save checkpoint (touch)', (o) => Object.assign(newRule('collision'), { target: first(o.id), actions: [{ type: 'checkpoint' }, { type: 'text', text: 'Checkpoint!' }] })],
    ['Destroy myself when I hit a wall', () => Object.assign(newRule('hitwall'), { actions: [{ type: 'destroy', who: 'self' }] })],
    ['Win when score reaches 100', () => Object.assign(newRule('step'), { cond: { var: 'score', op: '>=', value: 100 }, actions: [{ type: 'win', text: 'You collected everything!' }] })],
  ];

  function renderRules() {
    const o = cur(); if (!els.rules || !o) return;
    o.rules = o.rules || [];
    const touch = () => App.touch();
    const redo = () => { App.touch(); renderRules(); };
    const move = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; redo(); };
    const cards = o.rules.map((r, ri) => {
      const ev = EVENTS[r.event] || EVENTS.step;
      const head = h('div', { class: 'rule-head' },
        fSelect(r, 'event', Object.keys(EVENTS).map((k) => [k, EVENTS[k].label]), () => { Object.assign(r, Object.assign(newRule(r.event), { actions: r.actions, cond: r.cond })); redo(); }, { class: 'ev' }),
        ...ev.fields.map((f) => h('span', { class: 'row', style: { gap: '4px' } }, f[2] === 'check' ? null : h('span', { class: 'muted' }, f[1]), renderField(f, r, touch), f[2] === 'check' ? h('span', { class: 'muted' }, f[1]) : null)),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn small', title: 'Move up', onclick: () => move(o.rules, ri, -1) }, '↑'), h('button', { class: 'btn small', title: 'Move down', onclick: () => move(o.rules, ri, 1) }, '↓'),
        h('button', { class: 'btn small', title: 'Duplicate rule', onclick: () => { o.rules.splice(ri + 1, 0, clone(r)); redo(); } }, '⧉'),
        h('button', { class: 'btn small danger', title: 'Delete rule', onclick: () => { o.rules.splice(ri, 1); redo(); } }, '🗑'));
      const condRow = h('div', { class: 'cond' },
        h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!(r.cond && r.cond.var !== undefined), onchange: (e) => { r.cond = e.target.checked ? { var: 'score', op: '>=', value: 0 } : undefined; redo(); } }), 'only if'),
        r.cond ? [fText(r.cond, 'var', touch, { list: 'vars-dl', style: 'width:110px' }), fSelect(r.cond, 'op', ['==', '!=', '>', '>=', '<', '<='], touch), fNum(r.cond, 'value', touch)] : h('span', { class: 'muted' }, 'condition on a variable (e.g. score ≥ 100, or self.hp > 0)'));
      const acts = h('div', { class: 'actions' },
        ...r.actions.map((a, ai) => {
          const sch = ACTIONS[a.type] || ACTIONS.var;
          return h('div', { class: 'action' },
            fSelect(a, 'type', Object.keys(ACTIONS).map((k) => [k, ACTIONS[k].label]), () => { const t = a.type; Object.keys(a).forEach((k) => delete a[k]); Object.assign(a, clone(ACTIONS[t].def), { type: t }); redo(); }, { class: 'at' }),
            ...sch.fields.filter((f) => !f[3] || f[3](a)).map((f) => h('span', { class: 'row', style: { gap: '4px' } }, h('span', { class: 'muted' }, f[1]), renderField(f, a, touch))),
            h('span', { class: 'spacer' }),
            h('button', { class: 'btn small', onclick: () => move(r.actions, ai, -1) }, '↑'), h('button', { class: 'btn small', onclick: () => move(r.actions, ai, 1) }, '↓'),
            h('button', { class: 'btn small danger', onclick: () => { r.actions.splice(ai, 1); redo(); } }, '✕'));
        }),
        h('select', { onchange: (e) => { const t = e.target.value; if (!t) return; r.actions.push(Object.assign(clone(ACTIONS[t].def), { type: t })); redo(); } },
          h('option', { value: '' }, '＋ add action…'), Object.keys(ACTIONS).map((k) => h('option', { value: k }, ACTIONS[k].label))));
      return h('div', { class: 'rule' }, head, condRow, acts);
    });
    const addSel = h('select', {
      onchange: (e) => {
        const v = e.target.value; if (v === '') return;
        if (v.startsWith('ev:')) o.rules.push(newRule(v.slice(3)));
        else o.rules.push(PRESETS[+v][1](o));
        redo();
      },
    }, h('option', { value: '' }, '＋ Add rule…'),
      h('optgroup', { label: 'Ready-made' }, PRESETS.map((p, i) => h('option', { value: i }, p[0]))),
      h('optgroup', { label: 'Blank rule — when…' }, Object.keys(EVENTS).map((k) => h('option', { value: 'ev:' + k }, EVENTS[k].label))));
    els.rules.replaceChildren(
      o.rules.length ? null : h('p', { class: 'hint' }, 'No rules yet. Rules tell this object what to do: "when touching Coin → destroy it, add 10 score". Pick a ready-made rule or start blank.'),
      ...cards, h('div', { style: { marginTop: '8px' } }, addSel));
    const dl = $('#vars-dl'); if (dl) dl.replaceChildren(...varNames().map((v) => h('option', { value: v })), h('option', { value: 'self.hp' }), h('option', { value: 'self.count' }));
  }

  /* ---------- hitbox preview ---------- */
  function renderHitbox() {
    const o = cur(), c = els.hit; if (!o || !c) return;
    const sp = App.sprite(o.spriteId), w = sp ? sp.w : o.w || 16, hh = sp ? sp.h : o.h || 16;
    const Z = Math.max(2, Math.floor(150 / Math.max(w, hh)));
    c.width = w * Z; c.height = hh * Z; c.style.width = c.width + 'px'; c.style.height = c.height + 'px';
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.clearRect(0, 0, c.width, c.height);
    const draw = () => {
      x.clearRect(0, 0, c.width, c.height);
      if (sp && sp.frames[0]) x.drawImage(ImgCache.get(sp.frames[0], renderHitbox), 0, 0, c.width, c.height);
      else { x.fillStyle = o.color; x.fillRect(0, 0, c.width, c.height); }
      const b = o.hitBox && o.hitBox.w > 0 ? o.hitBox : { x: 0, y: 0, w, h: hh };
      x.fillStyle = 'rgba(239,90,111,0.25)'; x.fillRect(b.x * Z, b.y * Z, b.w * Z, b.h * Z);
      x.strokeStyle = '#ef5a6f'; x.lineWidth = 2; x.strokeRect(b.x * Z + 1, b.y * Z + 1, b.w * Z - 2, b.h * Z - 2);
    };
    draw();
  }
  async function autoTrim() {
    const o = cur(), sp = App.sprite(o.spriteId); if (!sp) return;
    const c = document.createElement('canvas'); c.width = sp.w; c.height = sp.h;
    const x = c.getContext('2d'); let x0 = sp.w, y0 = sp.h, x1 = -1, y1 = -1;
    for (const f of sp.frames) {
      x.clearRect(0, 0, sp.w, sp.h); x.drawImage(await loadImage(f), 0, 0);
      const d = x.getImageData(0, 0, sp.w, sp.h).data;
      for (let yy = 0; yy < sp.h; yy++) for (let xx = 0; xx < sp.w; xx++) if (d[(yy * sp.w + xx) * 4 + 3] > 20) { x0 = Math.min(x0, xx); y0 = Math.min(y0, yy); x1 = Math.max(x1, xx); y1 = Math.max(y1, yy); }
    }
    if (x1 < 0) return;
    o.hitBox = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }; App.touch(); renderForm();
  }

  /* ---------- main form ---------- */
  function renderForm() {
    const o = cur();
    if (!els.form) return;
    if (!o) { els.form.replaceChildren(h('p', { class: 'hint', style: { padding: '20px' } }, 'No objects yet. Click ＋ New to make one (a player, an enemy, a block…). Objects give your sprites behavior and logic. Draw some sprites first in the Sprites tab.')); return; }
    const sp = App.sprite(o.spriteId);
    const hb = o.hitBox || { x: 0, y: 0, w: sp ? sp.w : 16, h: sp ? sp.h : 16 };
    const hbModel = { get x() { return hb.x; }, set x(v) { hb.x = v; }, get y() { return hb.y; }, set y(v) { hb.y = v; }, get w() { return hb.w; }, set w(v) { hb.w = v; }, get h() { return hb.h; }, set h(v) { hb.h = v; } };
    const hbChange = () => { o.hitBox = { x: +hb.x || 0, y: +hb.y || 0, w: +hb.w || 1, h: +hb.h || 1 }; App.touch(); renderHitbox(); };
    const props = BPROPS[o.behavior] || [];
    o.props = o.props || {};
    const behChange = () => { applyBehavior(o, o.behavior); App.touch(); renderList(); renderForm(); };
    const left = h('div', null,
      h('div', { class: 'section-title' }, 'Basics'),
      field('Name', fText(o, 'name', () => { App.touch(); renderList(); }, { style: 'width:180px' })),
      field('Category', fText(o, 'category', () => { App.touch(); }, { list: 'cats-dl', style: 'width:130px' }), h('datalist', { id: 'cats-dl' }, CATS.map((c) => h('option', { value: c })))),
      field('Sprite', spriteSelect(o, 'spriteId', () => { App.touch(); renderList(); renderForm(); }, true), thumb(o.spriteId, 34)),
      (o.behavior === 'platformer' || o.behavior === 'topdown') ? field('Run sprite', spriteSelect(o, 'runSpriteId', () => App.touch(), true)) : null,
      o.behavior === 'platformer' ? field('Jump sprite', spriteSelect(o, 'jumpSpriteId', () => App.touch(), true)) : null,
      !sp ? field('Fallback color', fColor(o, 'color', () => { App.touch(); renderHitbox(); }), h('span', { class: 'muted' }, 'no sprite: draws a box')) : null,
      field('Draw layer', fNum(o, 'layer', () => App.touch(), { style: 'width:64px' }), h('span', { class: 'muted' }, 'higher = in front')),
      h('div', { class: 'section-title' }, 'Behavior'),
      field('Type', fSelect(o, 'behavior', BEHAVIORS, behChange, { style: 'width:220px' })),
      ...props.map((p) => field(p[1], renderField([p[0], p[1], p[2]], o.props, () => App.touch()))),
      h('div', { class: 'row', style: { margin: '6px 0' } },
        fCheck(o, 'solid', () => { App.touch(); renderForm(); renderList(); }, 'Solid (blocks movement)'),
        o.solid ? fCheck(o, 'oneWay', () => App.touch(), 'One-way (jump through from below)') : null),
      h('div', { class: 'row', style: { margin: '6px 0' } },
        fCheck(o, 'gravity', () => App.touch(), 'Affected by gravity'), fCheck(o, 'collideSolids', () => App.touch(), 'Collides with solids')),
      h('div', { class: 'row', style: { margin: '6px 0' } },
        fCheck(o, 'isPlayer', () => App.touch(), 'Camera follows / counts as player'), fCheck(o, 'flip', () => App.touch(), 'Flip sprite when facing left')),
      h('div', { class: 'section-title' }, 'Hitbox'),
      h('div', { class: 'row' }, h('div', { class: 'thumb', style: { background: '#0b0c14' } }, els.hit = h('canvas')),
        h('div', null,
          h('div', { class: 'row' }, h('label', null, 'x ', fNum(hbModel, 'x', hbChange, { style: 'width:56px' })), h('label', null, 'y ', fNum(hbModel, 'y', hbChange, { style: 'width:56px' }))),
          h('div', { class: 'row', style: { marginTop: '4px' } }, h('label', null, 'w ', fNum(hbModel, 'w', hbChange, { style: 'width:56px' })), h('label', null, 'h ', fNum(hbModel, 'h', hbChange, { style: 'width:56px' }))),
          h('div', { class: 'row', style: { marginTop: '6px' } }, h('button', { class: 'btn small', onclick: autoTrim }, '✂ Fit to pixels'), h('button', { class: 'btn small', onclick: () => { o.hitBox = null; App.touch(); renderForm(); } }, 'Full sprite')))),
      h('div', { class: 'section-title' }, 'When destroyed'),
      field('Effect', fSelect(o, 'destroyFx', [['none', 'nothing'], ['puff', 'small puff'], ['burst', 'big burst']], () => App.touch()), fColor(o, 'fxColor', () => App.touch())));
    const right = h('div', null,
      h('div', { class: 'section-title' }, 'Logic — what this object does'),
      h('p', { class: 'hint' }, 'Rules run top to bottom each frame. Actions can change variables, create or destroy objects, play sounds, change levels and more. Variables: ', varNames().map((v) => h('span', { class: 'pill', style: { marginRight: '4px' } }, v)), ' (add more in Settings). Use ', h('span', { class: 'pill' }, 'self.name'), ' for per-object counters.'),
      els.rules = h('div'),
      h('datalist', { id: 'vars-dl' }));
    els.form.replaceChildren(h('div', { class: 'cols' }, left, right));
    renderRules(); renderHitbox();
  }

  function mount(root) {
    els.list = h('div', { class: 'side-scroll' });
    els.form = h('div', { class: 'form-scroll' });
    root.append(
      h('div', { class: 'sidebar' },
        h('div', { class: 'side-head' }, h('h3', null, 'Objects'), h('button', { class: 'btn small', onclick: newObject }, '＋ New'),
          h('button', { class: 'btn small', title: 'Duplicate', onclick: dupObject }, '⧉'), h('button', { class: 'btn small', title: 'Delete', onclick: delObject }, '🗑')),
        els.list),
      h('div', { class: 'workarea', style: { background: 'var(--bg)' } }, els.form));
  }
  function show() {
    if (!cur()) OE.id = App.proj.objects[0] ? App.proj.objects[0].id : null;
    renderList(); renderForm();
  }
  function reset() { OE.id = null; }
  App.editors.objects = { title: 'Objects', icon: '🧩', mount, show, reset, select, refresh: () => { renderList(); } };
})();
