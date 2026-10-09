/* 2plat starter content: procedural pixel art, objects, levels, sounds, music. */
(function (root) {
  'use strict';

  const PAL = {
    a: '#1a1c2c', b: '#5d275d', c: '#b13e53', d: '#ef7d57', e: '#ffcd75', f: '#a7f070', g: '#38b764',
    h: '#257179', i: '#29366f', j: '#3b5dc9', k: '#41a6f6', l: '#73eff7', m: '#f4f4f4', n: '#94b0c2',
    o: '#566c86', p: '#333c57', q: '#8b5a2b', r: '#a5703b', s: '#5c3a1e',
  };
  const hash = (x, y) => (((x * 73856093) ^ (y * 19349663)) >>> 0) % 100;

  function canvasURL(w, h, paint) {
    if (typeof document === 'undefined') return 'data:image/png;base64,iVBORw0KGgo=';
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    paint(c.getContext('2d'));
    return c.toDataURL();
  }
  function art(rows, w, h) {
    w = w || 16; h = h || 16;
    return canvasURL(w, h, (x) => {
      for (let y = 0; y < h; y++) {
        const r = (rows[y] || '').padEnd(w, '.');
        for (let px = 0; px < w; px++) { const ch = r[px]; if (ch !== '.' && PAL[ch]) { x.fillStyle = PAL[ch]; x.fillRect(px, y, 1, 1); } }
      }
    });
  }
  function gen(w, h, fn) {
    return canvasURL(w, h, (x) => {
      for (let y = 0; y < h; y++) for (let px = 0; px < w; px++) {
        const k = fn(px, y); if (k) { x.fillStyle = PAL[k] || k; x.fillRect(px, y, 1, 1); }
      }
    });
  }
  const bob = (rows) => ['................'].concat(rows.slice(0, 12), rows.slice(13)).slice(0, 16).map((r, i) => (i === 0 ? r : r));

  /* ---------------------------------------------------------------- sprites */
  const body = [
    '................', '.....cccccc.....', '....cccccccc....', '....cccccccc....', '....eeeeeeee....',
    '....eaeeeeae....', '....eeeeeeee....', '.....eeeeee.....', '....jjjjjjjj....', '...jjjjjjjjjj...',
    '...ejjjjjjjje...', '...ejjjjjjjje...', '....jjjjjjjj....',
  ];
  const legs = {
    idle: ['....jjj..jjj....', '....aaa..aaa....', '...aaaa..aaaa...'],
    runA: ['....jjjj.jjj....', '....aaaa..aa....', '...aaaa...aaa...'],
    runB: ['....jjj.jjjj....', '....aa..aaaa....', '...aaa...aaaa...'],
    jump: ['....jjjjjjjj....', '.....aaaaaa.....', '.....aaaaaa.....'],
  };
  const pl = (l) => body.concat(l);

  function spriteLibrary() {
    const S = (id, name, w, h, fps, frames) => ({ id, name, w, h, fps, frames });
    const ell = (rx) => gen(16, 16, (x, y) => {
      const dx = (x - 7.5) / Math.max(rx, 0.6), dy = (y - 7.5) / 5.2, d = dx * dx + dy * dy;
      if (d > 1) return null; if (d > 0.62) return 'd'; return (x < 7 && y < 8 && d < 0.3) ? 'm' : 'e';
    });
    return [
      S('sp_player', 'player_idle', 16, 16, 2, [art(pl(legs.idle)), art(bob(pl(legs.idle)))]),
      S('sp_player_run', 'player_run', 16, 16, 10, [art(pl(legs.runA)), art(pl(legs.runB))]),
      S('sp_player_jump', 'player_jump', 16, 16, 1, [art(pl(legs.jump))]),
      S('sp_grass', 'grass', 16, 16, 1, [gen(16, 16, (x, y) => {
        if (y === 0) return 'f'; if (y === 1) return hash(x, y) < 40 ? 'f' : 'g'; if (y === 2) return hash(x, y) < 25 ? 'g' : 'q';
        const h = hash(x, y); return h < 10 ? 's' : h < 22 ? 'r' : 'q';
      })]),
      S('sp_dirt', 'dirt', 16, 16, 1, [gen(16, 16, (x, y) => { const h = hash(x, y); return h < 10 ? 's' : h < 22 ? 'r' : 'q'; })]),
      S('sp_brick', 'brick', 16, 16, 1, [gen(16, 16, (x, y) => {
        if (y % 8 === 7 || (x + ((y >> 3) % 2) * 8) % 16 === 15) return 'n'; return y % 8 === 0 ? 'd' : 'c';
      })]),
      S('sp_stone', 'stone', 16, 16, 1, [gen(16, 16, (x, y) => {
        if (x === 0 || y === 0) return 'n'; if (x === 15 || y === 15) return 'p'; return hash(x, y) < 12 ? 'p' : 'o';
      })]),
      S('sp_platform', 'platform', 16, 6, 1, [gen(16, 6, (x, y) => (y === 0 ? 'r' : y === 5 ? 's' : 'q'))]),
      S('sp_movplat', 'moving_platform', 32, 8, 1, [gen(32, 8, (x, y) => (y === 0 ? 'n' : y === 7 ? 'p' : (x % 8 === 0 ? 'p' : 'o')))]),
      S('sp_coin', 'coin', 16, 16, 8, [ell(5), ell(3), ell(1), ell(3)]),
      S('sp_slime', 'slime', 16, 16, 4, [
        art(['', '', '', '', '', '', '', '.....bbbbbb.....', '...bbbbbbbbbb...', '..bbmmbbbbmmbb..', '.bbbmabbbbmabbb.', '.bbbbbbbbbbbbbb.', '.bbbbbbbbbbbbbb.', '.bbbbbbbbbbbbbb.', '..bbbbbbbbbbbb..']),
        art(['', '', '', '', '', '', '', '', '......bbbb......', '....bbbbbbbb....', '..bbbmmbbmmbbb..', '.bbbbmabbmabbbb.', '.bbbbbbbbbbbbbb.', '.bbbbbbbbbbbbbb.', '.bbbbbbbbbbbbbb.', '..bbbbbbbbbbbb..'])]),
      S('sp_bat', 'bat', 16, 16, 8, [
        art(['', '', '.b..........b...', '.bb........bb...', '.bbb..bb..bbb...', '.bbbbbbbbbbbb...', '..bbbbbbbbbb....', '...bbcbbcbb.....', '....bbbbbb......', '.....b..b.......']),
        art(['', '', '', '......bbbb......', '.....bbbbbb.....', '..b.bbcbbcbb.b..', '.bbbbbbbbbbbbbb.', '.bb..bbbbbb..bb.', '.b....b..b....b.'])]),
      S('sp_spike', 'spike', 16, 16, 1, [gen(16, 16, (x, y) => {
        const t = 8 - Math.abs((x % 8) - 3.5) * 2.3; if (y < 16 - t) return null; return y < 16 - t + 1.2 ? 'm' : 'n';
      })]),
      S('sp_flag', 'goal_flag', 16, 16, 4, [
        art(['..nn............', '..nnccccc.......', '..nnccccccc.....', '..nncccccccc....', '..nnccccccc.....', '..nnccccc.......', '..nn............', '..nn............', '..nn............', '..nn............', '..nn............', '..nn............', '..nn............', '..nn............', '..nn............', '.nnnn...........']),
        art(['..nn............', '..nn.ccccc......', '..nnccccccc.....', '..nn.cccccccc...', '..nnccccccc.....', '..nn.ccccc......', '..nn............', '..nn............', '..nn............', '..nn............', '..nn............', '..nn............', '..nn............', '..nn............', '..nn............', '.nnnn...........'])]),
      S('sp_checkpoint', 'checkpoint', 16, 16, 1, [
        art(['', '', '', '', '', '', '', '', '...nnee.........', '...nneeee.......', '...nnee.........', '...nn...........', '...nn...........', '...nn...........', '...nn...........', '..nnnn..........'])]),
      S('sp_turret', 'turret', 16, 16, 1, [
        art(['', '', '', '', '', '', '', '', '..oooooooo......', '.onnnnnnnno.aaa.', '.onooooooonaaaaa', '.onooooooonaaaaa', '.onooooooo.aaa..', '.onooooooo......', '.oppppppppo.....', '.oooooooooo.....'])]),
      S('sp_fireball', 'fireball', 8, 8, 8, [
        gen(8, 8, (x, y) => { const d = Math.hypot(x - 3.5, y - 3.5); return d > 3.6 ? null : d > 2.4 ? 'd' : d > 1.2 ? 'e' : 'm'; }),
        gen(8, 8, (x, y) => { const d = Math.hypot(x - 3.5, y - 3.5); return d > 3.2 ? null : d > 2.0 ? 'c' : d > 1.0 ? 'd' : 'e'; })]),
      S('sp_ebullet', 'enemy_bullet', 8, 8, 8, [
        gen(8, 8, (x, y) => { const d = Math.hypot(x - 3.5, y - 3.5); return d > 3.4 ? null : d > 2.0 ? 'b' : d > 1.0 ? 'c' : 'm'; })]),
      S('sp_cloud', 'cloud', 32, 16, 1, [gen(32, 16, (x, y) => {
        const c = (cx, cy, r) => Math.hypot(x - cx, (y - cy) * 1.3) < r;
        return (c(9, 10, 6) || c(16, 7, 7) || c(23, 10, 6) || (y >= 9 && y <= 13 && x >= 8 && x <= 24)) ? 'm' : null;
      })]),
      S('sp_bush', 'bush', 16, 16, 1, [gen(16, 16, (x, y) => {
        const c = (cx, cy, r) => Math.hypot(x - cx, y - cy) < r;
        if (c(4, 12, 4.5) || c(10, 10, 5.5) || c(13, 13, 3.5) || (y > 12 && x > 1 && x < 15)) return hash(x, y) < 25 ? 'g' : 'h'; return null;
      })]),
      /* top-down set */
      S('sp_wall', 'dungeon_wall', 16, 16, 1, [gen(16, 16, (x, y) => {
        if (x === 0 || y === 0) return 'o'; if (x === 15 || y === 15) return 'a'; return hash(x, y) < 14 ? 'a' : 'p';
      })]),
      S('sp_floor', 'dungeon_floor', 16, 16, 1, [gen(16, 16, (x, y) => (((x >> 3) + (y >> 3)) % 2 ? 'a' : (hash(x, y) < 6 ? 'p' : '#20233a')))]),
      S('sp_ghost', 'ghost', 16, 16, 4, [
        art(['', '.....mmmmmm.....', '...mmmmmmmmmm...', '..mmmmmmmmmmmm..', '..mmammmmmmamm..', '..mmammmmmmamm..', '..mmmmmmmmmmmm..', '..mmmmmaammmmm..', '..mmmmmmmmmmmm..', '..mmmmmmmmmmmm..', '..mmmmmmmmmmmm..', '..mm.mmmm.mmmm..', '..m...mm...mm...']),
        art(['', '', '.....mmmmmm.....', '...mmmmmmmmmm...', '..mmmmmmmmmmmm..', '..mmammmmmmamm..', '..mmammmmmmamm..', '..mmmmmmmmmmmm..', '..mmmmmaammmmm..', '..mmmmmmmmmmmm..', '..mmmmmmmmmmmm..', '..mmmmmmmmmmmm..', '..mmm.mmmm.mmm..'])]),
      S('sp_gem', 'gem', 16, 16, 6, [
        gen(16, 16, (x, y) => { const d = Math.abs(x - 7.5) / 5 + Math.abs(y - 7.5) / 6; return d > 1 ? null : d > 0.8 ? 'k' : (x < 7 && y < 7 ? 'm' : 'l'); }),
        gen(16, 16, (x, y) => { const d = Math.abs(x - 7.5) / 5 + Math.abs(y - 7.5) / 6; return d > 1 ? null : d > 0.8 ? 'j' : (x > 8 && y < 7 ? 'm' : 'k'); })]),
      S('sp_door', 'exit_door', 16, 16, 1, [gen(16, 16, (x, y) => {
        if (y < 2 || x < 2 || x > 13) return 'n'; if (x === 11 && y === 9) return 'e'; return y < 4 ? 'q' : (x % 4 === 2 ? 's' : 'r');
      })]),
    ];
  }

  /* ---------------------------------------------------------------- sounds / music */
  function soundLibrary() {
    const P = root.Plat2 && root.Plat2.SFX_PRESETS ? root.Plat2.SFX_PRESETS : {};
    const fallback = { jump: { wave: 'square', freq: 260, endFreq: 620, dur: 0.18, vol: 0.35 } };
    return Object.keys(Object.keys(P).length ? P : fallback).map((k) => Object.assign({ id: 's_' + k, name: k }, (P[k] || fallback[k])));
  }
  function musicLibrary() {
    return [{
      id: 'm_main', name: 'adventure', bpm: 132, steps: 32,
      tracks: [
        { wave: 'square', vol: 0.12, len: 1.6, notes: [72, 0, 0, 67, 0, 69, 0, 67, 64, 0, 0, 67, 0, 62, 0, 64, 65, 0, 0, 69, 0, 72, 0, 69, 67, 0, 0, 64, 0, 62, 0, 60] },
        { wave: 'triangle', vol: 0.3, len: 3, notes: [48, 0, 0, 0, 48, 0, 0, 0, 55, 0, 0, 0, 55, 0, 0, 0, 53, 0, 0, 0, 53, 0, 0, 0, 55, 0, 0, 0, 55, 0, 0, 0] },
        { wave: 'noise', vol: 0.05, len: 0.5, notes: [0, 0, 60, 0, 0, 0, 60, 0, 0, 0, 60, 0, 0, 0, 60, 60, 0, 0, 60, 0, 0, 0, 60, 0, 0, 0, 60, 0, 0, 0, 60, 60] },
      ],
    }, {
      id: 'm_dark', name: 'fortress', bpm: 104, steps: 32,
      tracks: [
        { wave: 'saw', vol: 0.07, len: 2, notes: [57, 0, 0, 0, 60, 0, 0, 0, 64, 0, 0, 0, 60, 0, 0, 0, 55, 0, 0, 0, 59, 0, 0, 0, 62, 0, 0, 0, 59, 0, 0, 0] },
        { wave: 'triangle', vol: 0.32, len: 2, notes: [45, 0, 45, 0, 0, 0, 45, 0, 43, 0, 43, 0, 0, 0, 43, 0, 41, 0, 41, 0, 0, 0, 41, 0, 43, 0, 43, 0, 0, 0, 43, 0] },
        { wave: 'noise', vol: 0.05, len: 0.5, notes: [60, 0, 0, 0, 60, 0, 0, 0, 60, 0, 0, 0, 60, 0, 0, 0, 60, 0, 0, 0, 60, 0, 0, 0, 60, 0, 0, 0, 60, 0, 60, 0] },
      ],
    }];
  }

  /* ---------------------------------------------------------------- objects */
  function defObject(o) {
    return Object.assign({
      id: '', name: 'Object', spriteId: '', runSpriteId: '', jumpSpriteId: '', color: '#ff00ff', w: 16, h: 16,
      solid: false, oneWay: false, layer: 0, behavior: 'none', gravity: false, collideSolids: false, isPlayer: false,
      flip: true, hitBox: null, props: {}, rules: [], destroyFx: 'none', fxColor: '', category: 'misc',
    }, o);
  }
  const rule = (event, extra, actions) => Object.assign({ event, actions }, extra);
  const A = {
    score: (n) => ({ type: 'var', name: 'score', op: 'add', value: n }),
    snd: (s) => ({ type: 'sound', sound: s }),
    kill: (who) => ({ type: 'destroy', who }),
  };

  function platformerObjects() {
    return [
      defObject({
        id: 'o_player', name: 'Player', spriteId: 'sp_player', runSpriteId: 'sp_player_run', jumpSpriteId: 'sp_player_jump',
        behavior: 'platformer', gravity: true, collideSolids: true, isPlayer: true, layer: 10, category: 'player',
        hitBox: { x: 4, y: 2, w: 8, h: 14 }, props: { speed: 92, jump: 275, maxJumps: 2, accel: 900 },
        rules: [
          rule('collision', { target: 'o_coin' }, [A.kill('other'), A.score(10), A.snd('s_coin')]),
          rule('collision', { target: 'o_slime', where: 'stomp' }, [A.kill('other'), A.score(100), { type: 'velocity', vy: -190, mode: 'set' }, A.snd('s_hit'), { type: 'text', text: '+100' }]),
          rule('collision', { target: 'o_slime', where: 'side' }, [{ type: 'loseLife' }]),
          rule('collision', { target: 'o_bat', where: 'stomp' }, [A.kill('other'), A.score(150), { type: 'velocity', vy: -190, mode: 'set' }, A.snd('s_hit'), { type: 'text', text: '+150' }]),
          rule('collision', { target: 'o_bat', where: 'side' }, [{ type: 'loseLife' }]),
          rule('collision', { target: 'o_spike' }, [{ type: 'loseLife' }]),
          rule('collision', { target: 'o_ebullet' }, [A.kill('other'), { type: 'loseLife' }]),
          rule('collision', { target: 'o_checkpoint' }, [{ type: 'checkpoint' }, { type: 'text', text: 'Checkpoint!' }, A.snd('s_powerup')]),
          rule('collision', { target: 'o_flag' }, [A.snd('s_powerup'), { type: 'level', to: 'next' }]),
          rule('keypress', { key: 'action' }, [{ type: 'spawn', obj: 'o_fireball', ox: 10, oy: 0, vx: 200, vy: 0 }, A.snd('s_laser')]),
          rule('outside', {}, [{ type: 'loseLife' }]),
        ],
      }),
      defObject({ id: 'o_grass', name: 'Grass Block', spriteId: 'sp_grass', solid: true, collideSolids: false, category: 'terrain' }),
      defObject({ id: 'o_dirt', name: 'Dirt Block', spriteId: 'sp_dirt', solid: true, category: 'terrain' }),
      defObject({ id: 'o_brick', name: 'Brick', spriteId: 'sp_brick', solid: true, category: 'terrain' }),
      defObject({ id: 'o_stone', name: 'Stone', spriteId: 'sp_stone', solid: true, category: 'terrain' }),
      defObject({ id: 'o_platform', name: 'Wood Platform', spriteId: 'sp_platform', solid: true, oneWay: true, category: 'terrain' }),
      defObject({
        id: 'o_movplat', name: 'Moving Platform', spriteId: 'sp_movplat', solid: true, behavior: 'oscillate', layer: 1, category: 'terrain',
        props: { axis: 'x', dist: 44, period: 3.2 },
      }),
      defObject({
        id: 'o_coin', name: 'Coin', spriteId: 'sp_coin', layer: 2, hitBox: { x: 3, y: 3, w: 10, h: 10 }, destroyFx: 'puff', fxColor: '#ffcd75', category: 'items',
      }),
      defObject({
        id: 'o_slime', name: 'Slime', spriteId: 'sp_slime', behavior: 'patrol', gravity: true, collideSolids: true, layer: 5, category: 'enemies',
        hitBox: { x: 2, y: 7, w: 12, h: 9 }, props: { speed: 24, edge: true }, destroyFx: 'burst', fxColor: '#b13e53',
      }),
      defObject({
        id: 'o_bat', name: 'Bat', spriteId: 'sp_bat', behavior: 'chaser', gravity: false, collideSolids: false, layer: 6, category: 'enemies',
        hitBox: { x: 2, y: 3, w: 12, h: 8 }, props: { speed: 34, range: 110 }, destroyFx: 'burst', fxColor: '#5d275d',
      }),
      defObject({ id: 'o_spike', name: 'Spikes', spriteId: 'sp_spike', hitBox: { x: 2, y: 9, w: 12, h: 7 }, layer: 3, category: 'hazards' }),
      defObject({ id: 'o_flag', name: 'Goal Flag', spriteId: 'sp_flag', hitBox: { x: 2, y: 0, w: 8, h: 16 }, layer: 2, category: 'items' }),
      defObject({ id: 'o_checkpoint', name: 'Checkpoint', spriteId: 'sp_checkpoint', hitBox: { x: 2, y: 4, w: 8, h: 12 }, layer: 2, category: 'items' }),
      defObject({
        id: 'o_turret', name: 'Turret', spriteId: 'sp_turret', solid: true, behavior: 'turret', layer: 4, category: 'enemies',
        props: { interval: 1.7, range: 160, bullet: 'o_ebullet' },
      }),
      defObject({
        id: 'o_ebullet', name: 'Enemy Bullet', spriteId: 'sp_ebullet', behavior: 'bullet', collideSolids: true, layer: 7, flip: false,
        hitBox: { x: 1, y: 1, w: 6, h: 6 }, props: { speed: 90, life: 4 }, category: 'projectiles', destroyFx: 'puff', fxColor: '#b13e53',
      }),
      defObject({
        id: 'o_fireball', name: 'Fireball', spriteId: 'sp_fireball', behavior: 'bullet', collideSolids: true, layer: 8, flip: false,
        hitBox: { x: 1, y: 1, w: 6, h: 6 }, props: { speed: 200, life: 1.2 }, category: 'projectiles', destroyFx: 'puff', fxColor: '#ef7d57',
        rules: [
          rule('collision', { target: 'o_slime' }, [A.kill('other'), A.kill('self'), A.score(50), A.snd('s_hit')]),
          rule('collision', { target: 'o_bat' }, [A.kill('other'), A.kill('self'), A.score(75), A.snd('s_hit')]),
        ],
      }),
      defObject({
        id: 'o_cloud', name: 'Cloud', spriteId: 'sp_cloud', behavior: 'oscillate', layer: -3, category: 'decor',
        props: { axis: 'x', dist: 18, period: 14 },
      }),
      defObject({ id: 'o_bush', name: 'Bush', spriteId: 'sp_bush', layer: -1, category: 'decor' }),
    ];
  }

  function topdownObjects() {
    return [
      defObject({
        id: 'o_hero', name: 'Hero', spriteId: 'sp_player', runSpriteId: 'sp_player_run', behavior: 'topdown', collideSolids: true, isPlayer: true,
        layer: 10, category: 'player', hitBox: { x: 4, y: 8, w: 8, h: 7 }, props: { speed: 70 },
        rules: [
          rule('collision', { target: 'o_gem' }, [A.kill('other'), A.score(25), A.snd('s_coin')]),
          rule('collision', { target: 'o_ghost' }, [{ type: 'loseLife' }]),
          rule('collision', { target: 'o_exit' }, [{ type: 'var', name: 'gems', op: 'add', value: 0 }, A.snd('s_powerup'), { type: 'level', to: 'next' }]),
          rule('keypress', { key: 'action' }, [{ type: 'text', text: 'Find the door!' }]),
        ],
      }),
      defObject({ id: 'o_dwall', name: 'Wall', spriteId: 'sp_wall', solid: true, category: 'terrain' }),
      defObject({ id: 'o_dfloor', name: 'Floor', spriteId: 'sp_floor', layer: -5, category: 'decor' }),
      defObject({ id: 'o_gem', name: 'Gem', spriteId: 'sp_gem', layer: 2, hitBox: { x: 3, y: 2, w: 10, h: 12 }, destroyFx: 'puff', fxColor: '#73eff7', category: 'items' }),
      defObject({
        id: 'o_ghost', name: 'Ghost', spriteId: 'sp_ghost', behavior: 'chaser', layer: 6, category: 'enemies',
        hitBox: { x: 3, y: 3, w: 10, h: 11 }, props: { speed: 28, range: 90 }, destroyFx: 'burst', fxColor: '#f4f4f4',
      }),
      defObject({ id: 'o_exit', name: 'Exit Door', spriteId: 'sp_door', layer: 2, hitBox: { x: 2, y: 2, w: 12, h: 14 }, category: 'items' }),
    ];
  }

  /* ---------------------------------------------------------------- level builder */
  function LB(w, h, tile) {
    const inst = []; let n = 0;
    const api = {
      put(o, x, y) { inst.push({ id: 'i' + (++n), obj: o, x: x * tile, y: y * tile }); return api; },
      row(o, x1, x2, y) { for (let x = x1; x <= x2; x++) api.put(o, x, y); return api; },
      col(o, x, y1, y2) { for (let y = y1; y <= y2; y++) api.put(o, x, y); return api; },
      ground(x1, x2, top, kind) {
        for (let x = x1; x <= x2; x++) for (let y = top; y < h; y++) {
          api.put(kind === 'stone' ? 'o_stone' : (y === top ? 'o_grass' : 'o_dirt'), x, y);
        }
        return api;
      },
      pillar(o, x, top, bottom) { return api.col(o, x, top, bottom == null ? h - 1 : bottom); },
      build(id, name, bg, bg2, music) { return { id, name, w, h, bg, bg2, music: music || '', instances: inst }; },
    };
    return api;
  }

  function platformerLevels() {
    const clouds = (b, xs) => xs.forEach((x, i) => b.put('o_cloud', x, 1 + (i % 3)));
    const bushes = (b, xs, y) => xs.forEach((x) => b.put('o_bush', x, y));

    // Level 1 — Green Hills
    let b = LB(72, 12, 16);
    [[0, 17], [21, 33], [38, 51], [54, 71]].forEach(([a, z]) => b.ground(a, z, 10));
    b.put('o_player', 2, 9);
    clouds(b, [4, 16, 30, 44, 58, 66]);
    bushes(b, [5, 12, 24, 40, 49, 60], 9);
    b.row('o_brick', 9, 11, 7).put('o_coin', 9, 6).put('o_coin', 10, 6).put('o_coin', 11, 6);
    b.row('o_coin', 14, 16, 8);
    b.put('o_slime', 14, 9).put('o_slime', 27, 9).put('o_slime', 44, 9);
    b.row('o_platform', 18, 20, 8).put('o_coin', 19, 7);
    b.row('o_platform', 34, 36, 7).put('o_coin', 35, 6);
    b.put('o_checkpoint', 30, 9);
    b.row('o_spike', 40, 41, 9);
    b.put('o_bat', 47, 5);
    b.row('o_coin', 24, 26, 8);
    b.row('o_stone', 60, 60, 9).row('o_stone', 61, 61, 8).row('o_stone', 62, 62, 7).row('o_stone', 60, 60, 8).row('o_stone', 60, 60, 7).row('o_stone', 61, 61, 7);
    b.put('o_coin', 56, 8).put('o_coin', 57, 8).put('o_coin', 58, 8);
    b.put('o_flag', 69, 9);
    const l1 = b.build('lv1', 'Level 1 - Green Hills', '#41a6f6', '#a7f070', 'm_main');

    // Level 2 — Sky Bridge
    b = LB(84, 12, 16);
    [[0, 13], [24, 36], [56, 83]].forEach(([a, z]) => b.ground(a, z, 10));
    b.put('o_player', 2, 9);
    clouds(b, [6, 20, 34, 50, 66, 78]);
    bushes(b, [4, 9, 27, 33, 58, 70], 9);
    b.put('o_movplat', 15, 9).put('o_movplat', 40, 8);
    b.row('o_platform', 46, 48, 6).row('o_platform', 51, 52, 8);
    b.row('o_coin', 16, 18, 7).row('o_coin', 44, 46, 5);
    b.put('o_slime', 28, 9).put('o_slime', 32, 9);
    b.put('o_checkpoint', 34, 9);
    b.put('o_turret', 62, 9).put('o_turret', 74, 9);
    b.row('o_brick', 66, 68, 7).row('o_coin', 66, 68, 6);
    b.put('o_bat', 42, 3).put('o_bat', 70, 4);
    b.row('o_spike', 58, 59, 9);
    b.put('o_flag', 81, 9);
    const l2 = b.build('lv2', 'Level 2 - Sky Bridge', '#3b5dc9', '#73eff7', 'm_main');

    // Level 3 — Fortress
    b = LB(90, 12, 16);
    [[0, 12], [18, 30], [38, 50], [60, 89]].forEach(([a, z]) => b.ground(a, z, 10, 'stone'));
    [[13, 17], [31, 37], [51, 59]].forEach(([a, z]) => b.row('o_spike', a, z, 11));
    b.put('o_player', 2, 9);
    b.row('o_platform', 14, 16, 8).row('o_platform', 32, 36, 7).row('o_platform', 52, 54, 8).row('o_platform', 56, 58, 6);
    b.row('o_coin', 14, 16, 7).row('o_coin', 32, 36, 6).row('o_coin', 52, 54, 7);
    b.put('o_turret', 20, 9).put('o_turret', 28, 9).put('o_turret', 44, 9).put('o_turret', 64, 9);
    b.put('o_slime', 24, 9).put('o_slime', 42, 9).put('o_slime', 70, 9).put('o_slime', 76, 9);
    b.put('o_bat', 34, 3).put('o_bat', 55, 3).put('o_bat', 80, 4);
    b.put('o_checkpoint', 40, 9);
    b.col('o_stone', 82, 5, 9).col('o_stone', 83, 7, 9);
    b.row('o_spike', 72, 73, 9);
    b.row('o_brick', 66, 68, 7).row('o_coin', 66, 68, 6);
    b.put('o_flag', 87, 9);
    const l3 = b.build('lv3', 'Level 3 - Fortress', '#1a1c2c', '#5d275d', 'm_dark');
    return [l1, l2, l3];
  }

  function dungeonLevels() {
    const mk = (id, name, w, h, build) => {
      const b = LB(w, h, 16);
      for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) b.put('o_dfloor', x, y);
      b.row('o_dwall', 0, w - 1, 0).row('o_dwall', 0, w - 1, h - 1).col('o_dwall', 0, 0, h - 1).col('o_dwall', w - 1, 0, h - 1);
      build(b);
      return b.build(id, name, '#1a1c2c', '', 'm_dark');
    };
    const d1 = mk('lv1', 'Floor 1', 28, 18, (b) => {
      b.col('o_dwall', 8, 1, 11).col('o_dwall', 16, 6, 16).row('o_dwall', 17, 22, 8).col('o_dwall', 22, 3, 8);
      b.put('o_hero', 2, 2);
      [[4, 14], [12, 3], [12, 15], [20, 12], [25, 15], [25, 2], [19, 5]].forEach(([x, y]) => b.put('o_gem', x, y));
      b.put('o_ghost', 13, 9).put('o_ghost', 24, 6);
      b.put('o_exit', 26, 16);
    });
    const d2 = mk('lv2', 'Floor 2', 32, 20, (b) => {
      b.row('o_dwall', 4, 22, 5).row('o_dwall', 9, 31, 12).col('o_dwall', 14, 13, 18).col('o_dwall', 26, 6, 11);
      b.put('o_hero', 2, 2);
      [[28, 2], [7, 8], [20, 9], [30, 9], [3, 17], [10, 16], [22, 16], [29, 17]].forEach(([x, y]) => b.put('o_gem', x, y));
      b.put('o_ghost', 12, 3).put('o_ghost', 18, 14).put('o_ghost', 6, 10).put('o_ghost', 28, 15);
      b.put('o_exit', 30, 18);
    });
    return [d1, d2];
  }

  /* ---------------------------------------------------------------- projects */
  function baseSettings(extra) {
    return Object.assign({
      title: 'My Game', width: 320, height: 180, tileSize: 16, gravity: 900, bg: '#1a1c2c', pixelArt: true,
      startLevel: 0, music: '', hud: ['score', 'lives'], vars: [{ name: 'score', value: 0 }, { name: 'lives', value: 3 }],
    }, extra || {});
  }
  function pickSprites(ids) { return spriteLibrary().filter((s) => ids === 'all' || ids.includes(s.id)); }

  const TEMPLATES = [
    {
      id: 'blank', name: 'Blank', desc: 'Completely empty: no sprites, objects, sounds or music. Draw, build and write everything yourself.',
      build() {
        const lv = Templates.newLevel('Level 1', 50, 12);
        lv.id = 'lv1';
        return {
          format: '2plat', version: 1, name: 'My Game',
          settings: baseSettings({ title: 'My Game', vars: [], hud: [], music: '' }),
          sprites: [], objects: [], sounds: [], music: [], levels: [lv],
        };
      },
    },
    {
      id: 'platformer', name: 'Platformer: Sky Hopper', desc: '3 levels, double jump, fireballs, enemies, turrets, moving platforms, checkpoints, music.',
      build() {
        return {
          format: '2plat', version: 1, name: 'Sky Hopper',
          settings: baseSettings({ title: 'Sky Hopper', music: 'm_main' }),
          sprites: pickSprites(['sp_player', 'sp_player_run', 'sp_player_jump', 'sp_grass', 'sp_dirt', 'sp_brick', 'sp_stone', 'sp_platform', 'sp_movplat', 'sp_coin', 'sp_slime', 'sp_bat', 'sp_spike', 'sp_flag', 'sp_checkpoint', 'sp_turret', 'sp_fireball', 'sp_ebullet', 'sp_cloud', 'sp_bush']),
          objects: platformerObjects(), sounds: soundLibrary(), music: musicLibrary(), levels: platformerLevels(),
        };
      },
    },
    {
      id: 'topdown', name: 'Top-down: Gem Dungeon', desc: '8-way movement, chasing ghosts, gems and exits across 2 floors.',
      build() {
        return {
          format: '2plat', version: 1, name: 'Gem Dungeon',
          settings: baseSettings({ title: 'Gem Dungeon', gravity: 0, music: 'm_dark', bg: '#1a1c2c' }),
          sprites: pickSprites(['sp_player', 'sp_player_run', 'sp_wall', 'sp_floor', 'sp_ghost', 'sp_gem', 'sp_door']),
          objects: topdownObjects(), sounds: soundLibrary(), music: musicLibrary(), levels: dungeonLevels(),
        };
      },
    },
  ];

  const uid = (p) => (p || 'id') + '_' + Math.random().toString(36).slice(2, 8);
  const Templates = {
    list: TEMPLATES, defObject, uid, LB,
    make(id) { const t = TEMPLATES.find((x) => x.id === id) || TEMPLATES[0]; return t.build(); },
    newSprite(name, w, h) {
      return { id: uid('sp'), name: name || 'sprite', w: w || 16, h: h || 16, fps: 6, frames: [canvasURL(w || 16, h || 16, () => {})] };
    },
    newLevel(name, w, h) { return { id: uid('lv'), name: name || 'New Level', w: w || 50, h: h || 12, bg: '#41a6f6', bg2: '#a7f070', music: '', instances: [] }; },
    newSound() { return { id: uid('s'), name: 'sound', wave: 'square', freq: 440, endFreq: 440, dur: 0.2, vol: 0.4, vibrato: 0, vibSpeed: 12 }; },
    newMusic() {
      const t = (wave, vol) => ({ wave, vol, len: 1, notes: new Array(32).fill(0) });
      return { id: uid('m'), name: 'new music', bpm: 120, steps: 32, tracks: [t('square', 0.12), t('triangle', 0.3), t('noise', 0.05)] };
    },
  };
  root.Plat2Templates = Templates;
  if (typeof module !== 'undefined' && module.exports) module.exports = Templates;
})(typeof window !== 'undefined' ? window : globalThis);
