/* 2plat: level editor */
(function () {
  'use strict';

  const LE = {
    id: null, tool: 'brush', sel: null, cam: { x: 0, y: 0, z: 2 }, grid: true, snap: 'grid', showHit: false, showView: true,
    picked: new Set(), undo: [], redo: [], drag: null, mouse: { x: 0, y: 0, tx: 0, ty: 0 }, search: '', space: false, clip: [],
    order: null, scheduled: false, fitted: false,
  };
  let els = {};
  const lvl = () => App.level(LE.id);
  const TS = () => App.proj.settings.tileSize || 16;

  /* ---------- helpers ---------- */
  function sprOf(o) { return o && App.sprite(o.spriteId); }
  function sizeOf(o) { const s = sprOf(o); return s ? { w: s.w, h: s.h } : { w: (o && o.w) || 16, h: (o && o.h) || 16 }; }
  const grp = (o) => (o.solid ? 'S' : (o.layer || 0) < 0 ? 'B' : 'M');
  function invalidate(resort) {
    if (resort) LE.order = null;
    if (LE.scheduled) return; LE.scheduled = true;
    requestAnimationFrame(() => { LE.scheduled = false; draw(); });
  }
  function ordered() {
    if (!LE.order) {
      const L = lvl();
      LE.order = L.instances.map((i, n) => ({ i, n })).sort((a, b) => ((App.object(a.i.obj) || {}).layer || 0) - ((App.object(b.i.obj) || {}).layer || 0) || a.n - b.n).map((e) => e.i);
    }
    return LE.order;
  }
  function snapPos(wx, wy) {
    const t = TS();
    if (LE.snap === 'free') return { x: Math.round(wx), y: Math.round(wy) };
    const g = LE.snap === 'half' ? t / 2 : t;
    return { x: Math.floor(wx / g) * g, y: Math.floor(wy / g) * g };
  }
  function toWorld(e) {
    const r = els.cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) / LE.cam.z + LE.cam.x, y: (e.clientY - r.top) / LE.cam.z + LE.cam.y };
  }
  function snapshot() { const L = lvl(); return { w: L.w, h: L.h, instances: L.instances.map((i) => Object.assign({}, i)) }; }
  function pushUndo() { LE.undo.push(snapshot()); if (LE.undo.length > 80) LE.undo.shift(); LE.redo = []; }
  function restore(st) { const L = lvl(); L.w = st.w; L.h = st.h; L.instances = st.instances.map((i) => Object.assign({}, i)); LE.picked.clear(); App.touch(); invalidate(true); renderProps(); }
  function undo() { if (!LE.undo.length) return; LE.redo.push(snapshot()); restore(LE.undo.pop()); }
  function redo() { if (!LE.redo.length) return; LE.undo.push(snapshot()); restore(LE.redo.pop()); }

  function instBox(i) { const o = App.object(i.obj), s = sizeOf(o); return { x: i.x, y: i.y, w: s.w, h: s.h }; }
  function hit(wx, wy) {
    const list = ordered();
    for (let k = list.length - 1; k >= 0; k--) { const b = instBox(list[k]); if (wx >= b.x && wy >= b.y && wx < b.x + b.w && wy < b.y + b.h) return list[k]; }
    return null;
  }

  /* ---------- editing ops ---------- */
  function place(oid, x, y) {
    const o = App.object(oid), L = lvl(); if (!o) return false;
    const t = TS();
    if (x < 0 || y < 0 || x >= L.w * t || y >= L.h * t) return false;
    const g = grp(o);
    L.instances = L.instances.filter((i) => {
      if (i.x === x && i.y === y) { const q = App.object(i.obj); if (!q) return false; if (i.obj === oid) return false; if (LE.snap !== 'free' && grp(q) === g) return false; }
      if (o.isPlayer && i.obj === oid) return false;
      return true;
    });
    L.instances.push({ id: uid('i'), obj: oid, x, y });
    return true;
  }
  function eraseAt(wx, wy) {
    const h1 = hit(wx, wy); if (!h1) return false;
    const L = lvl(); L.instances = L.instances.filter((i) => i !== h1); LE.picked.delete(h1.id); return true;
  }
  function cellsLine(x0, y0, x1, y1) {
    const t = LE.snap === 'free' ? TS() : (LE.snap === 'half' ? TS() / 2 : TS());
    let cx0 = Math.round(x0 / t), cy0 = Math.round(y0 / t); const cx1 = Math.round(x1 / t), cy1 = Math.round(y1 / t);
    const out = []; const dx = Math.abs(cx1 - cx0), dy = -Math.abs(cy1 - cy0), sx = cx0 < cx1 ? 1 : -1, sy = cy0 < cy1 ? 1 : -1; let err = dx + dy;
    for (;;) { out.push([cx0 * t, cy0 * t]); if (cx0 === cx1 && cy0 === cy1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; cx0 += sx; } if (e2 <= dx) { err += dx; cy0 += sy; } }
    return out;
  }
  function rectCells(a, b, hollow) {
    const t = LE.snap === 'half' ? TS() / 2 : TS();
    const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y), out = [];
    for (let x = x0; x <= x1; x += t) for (let y = y0; y <= y1; y += t) if (!hollow || x === x0 || y === y0 || x + t > x1 || y + t > y1) out.push([x, y]);
    return out;
  }

  /* ---------- pointer ---------- */
  function onDown(e) {
    if (!lvl()) return;
    els.cv.setPointerCapture(e.pointerId); els.cv.focus();
    const w = toWorld(e);
    if (e.button === 1 || LE.space || e.button === 2 && LE.tool === 'select') { LE.drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, cx: LE.cam.x, cy: LE.cam.y }; els.cv.style.cursor = 'grabbing'; return; }
    const erase = e.button === 2 || LE.tool === 'erase';
    const sp = snapPos(w.x, w.y);
    if (e.altKey || LE.tool === 'pick') { const i = hit(w.x, w.y); if (i) { LE.sel = i.obj; if (LE.tool === 'pick') LE.tool = 'brush'; renderPalette(); renderTools(); } return; }
    if (LE.tool === 'select' && !erase) {
      const i = hit(w.x, w.y);
      if (i && LE.picked.has(i.id)) { pushUndo(); LE.drag = { kind: 'move', start: sp, moved: false, orig: new Map(lvl().instances.filter((q) => LE.picked.has(q.id)).map((q) => [q.id, { x: q.x, y: q.y }])) }; }
      else {
        if (!e.shiftKey) LE.picked.clear();
        if (i) { LE.picked.add(i.id); LE.drag = { kind: 'move', start: sp, moved: false, pushed: false, orig: new Map([[i.id, { x: i.x, y: i.y }]]), lazyUndo: true }; }
        else LE.drag = { kind: 'box', a: w, b: w };
      }
      invalidate(); return;
    }
    if (!erase && !LE.sel) { toast('Pick an object from the palette first', 'err'); return; }
    pushUndo();
    if (LE.tool === 'brush' || erase && (LE.tool === 'brush' || LE.tool === 'erase')) {
      LE.drag = { kind: erase ? 'erase' : 'paint', last: sp, lastW: w, changed: false };
      if (erase) LE.drag.changed = eraseAt(w.x, w.y); else LE.drag.changed = place(LE.sel, sp.x, sp.y);
      App.touch(); invalidate(true);
    } else if (LE.tool === 'rect' || LE.tool === 'line') {
      LE.drag = { kind: LE.tool, a: sp, b: sp, erase, hollow: e.shiftKey };
      invalidate();
    }
  }
  function onMove(e) {
    const w = toWorld(e), sp = snapPos(w.x, w.y), t = TS();
    LE.mouse = { x: w.x, y: w.y, tx: Math.floor(w.x / t), ty: Math.floor(w.y / t), sx: sp.x, sy: sp.y };
    const d = LE.drag;
    if (d) {
      if (d.kind === 'pan') { LE.cam.x = d.cx - (e.clientX - d.sx) / LE.cam.z; LE.cam.y = d.cy - (e.clientY - d.sy) / LE.cam.z; }
      else if (d.kind === 'paint' || d.kind === 'erase') {
        if (d.kind === 'paint') { if (sp.x !== d.last.x || sp.y !== d.last.y) { cellsLine(d.last.x, d.last.y, sp.x, sp.y).forEach(([x, y]) => place(LE.sel, x, y)); d.last = sp; App.touch(); LE.order = null; } }
        else { const steps = Math.max(1, Math.ceil(Math.hypot(w.x - d.lastW.x, w.y - d.lastW.y) / (t / 2))); for (let k = 1; k <= steps; k++) eraseAt(d.lastW.x + (w.x - d.lastW.x) * k / steps, d.lastW.y + (w.y - d.lastW.y) * k / steps); d.lastW = w; App.touch(); LE.order = null; }
      } else if (d.kind === 'rect' || d.kind === 'line') d.b = sp;
      else if (d.kind === 'box') d.b = w;
      else if (d.kind === 'move') {
        const dx = sp.x - d.start.x, dy = sp.y - d.start.y;
        if ((dx || dy) && d.lazyUndo && !d.pushed) { pushUndo(); d.pushed = true; }
        if (dx || dy) d.moved = true;
        lvl().instances.forEach((q) => { const o = d.orig.get(q.id); if (o) { q.x = o.x + dx; q.y = o.y + dy; } });
        LE.order = null; App.touch();
      }
    }
    updateHud(); invalidate();
  }
  function onUp(e) {
    const d = LE.drag; LE.drag = null; els.cv.style.cursor = LE.space ? 'grab' : 'crosshair';
    if (!d) return;
    if (d.kind === 'rect' || d.kind === 'line') {
      const cells = d.kind === 'rect' ? rectCells(d.a, d.b, d.hollow) : cellsLine(d.a.x, d.a.y, d.b.x, d.b.y);
      if (d.erase) cells.forEach(([x, y]) => eraseAt(x + 1, y + 1)); else cells.forEach(([x, y]) => place(LE.sel, x, y));
      App.touch(); invalidate(true);
    } else if (d.kind === 'box') {
      const x0 = Math.min(d.a.x, d.b.x), x1 = Math.max(d.a.x, d.b.x), y0 = Math.min(d.a.y, d.b.y), y1 = Math.max(d.a.y, d.b.y);
      lvl().instances.forEach((i) => { const b = instBox(i); if (b.x < x1 && b.x + b.w > x0 && b.y < y1 && b.y + b.h > y0) LE.picked.add(i.id); });
      invalidate();
    } else if (d.kind === 'move' || d.kind === 'paint' || d.kind === 'erase') { LE.order = null; renderProps(); invalidate(true); }
    updateHud();
  }
  function onWheel(e) {
    e.preventDefault();
    if (e.shiftKey) { LE.cam.x += e.deltaY / LE.cam.z; invalidate(); return; }
    const w = toWorld(e), f = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    LE.cam.z = clamp(LE.cam.z * f, 0.4, 10);
    const r = els.cv.getBoundingClientRect();
    LE.cam.x = w.x - (e.clientX - r.left) / LE.cam.z; LE.cam.y = w.y - (e.clientY - r.top) / LE.cam.z;
    updateHud(); invalidate();
  }
  function fit() {
    const L = lvl(), c = els.cv; if (!L || !c.clientWidth) return;
    const t = TS(), z = clamp(Math.min(c.clientWidth / (L.w * t + 40), c.clientHeight / (L.h * t + 40)), 0.4, 8);
    LE.cam.z = Math.round(z * 4) / 4 || z;
    LE.cam.x = -(c.clientWidth / LE.cam.z - L.w * t) / 2; LE.cam.y = -(c.clientHeight / LE.cam.z - L.h * t) / 2;
    updateHud(); invalidate();
  }

  /* ---------- drawing ---------- */
  function draw() {
    const L = lvl(), c = els.cv; if (!c) return;
    const W = c.clientWidth, H = c.clientHeight; if (!W || !H) return;
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.imageSmoothingEnabled = false;
    x.fillStyle = '#0b0c14'; x.fillRect(0, 0, W, H);
    if (!L) { x.fillStyle = '#8b90b8'; x.font = '14px sans-serif'; x.fillText('No level — create one with ＋ New', 20, 30); return; }
    const z = LE.cam.z, t = TS(), cam = LE.cam;
    const sx = (wx) => Math.round((wx - cam.x) * z), sy = (wy) => Math.round((wy - cam.y) * z);
    const lw = L.w * t, lh = L.h * t;
    // level background
    if (L.bg2) { const g = x.createLinearGradient(0, sy(0), 0, sy(lh)); g.addColorStop(0, L.bg || '#000'); g.addColorStop(1, L.bg2); x.fillStyle = g; } else x.fillStyle = L.bg || '#1a1c2c';
    x.fillRect(sx(0), sy(0), lw * z, lh * z);
    // instances
    for (const i of ordered()) {
      const o = App.object(i.obj); if (!o) continue;
      const s = sizeOf(o), px = sx(i.x), py = sy(i.y), pw = Math.round(s.w * z), ph = Math.round(s.h * z);
      if (px > W || py > H || px + pw < 0 || py + ph < 0) continue;
      const sp = sprOf(o);
      if (sp && sp.frames[0]) { const im = ImgCache.get(sp.frames[0], () => invalidate()); if (im.complete && im.naturalWidth) x.drawImage(im, px, py, pw, ph); }
      else { x.fillStyle = o.color || '#f0f'; x.fillRect(px, py, pw, ph); }
      if (LE.showHit) {
        const b = o.hitBox && o.hitBox.w > 0 ? o.hitBox : { x: 0, y: 0, w: s.w, h: s.h };
        x.strokeStyle = 'rgba(239,90,111,0.9)'; x.lineWidth = 1; x.strokeRect(px + b.x * z + 0.5, py + b.y * z + 0.5, b.w * z - 1, b.h * z - 1);
      }
    }
    // grid
    if (LE.grid && t * z >= 5) {
      x.strokeStyle = 'rgba(255,255,255,0.09)'; x.lineWidth = 1; x.beginPath();
      for (let gx = 0; gx <= L.w; gx++) { const px = sx(gx * t) + 0.5; x.moveTo(px, sy(0)); x.lineTo(px, sy(lh)); }
      for (let gy = 0; gy <= L.h; gy++) { const py = sy(gy * t) + 0.5; x.moveTo(sx(0), py); x.lineTo(sx(lw), py); }
      x.stroke();
    }
    x.strokeStyle = 'rgba(255,205,117,0.8)'; x.lineWidth = 2; x.strokeRect(sx(0) - 1, sy(0) - 1, lw * z + 2, lh * z + 2);
    // camera view box at the player start
    if (LE.showView) {
      const p = L.instances.find((i) => { const o = App.object(i.obj); return o && o.isPlayer; });
      if (p) {
        const S = App.proj.settings, o = App.object(p.obj), s = sizeOf(o);
        const vx = clamp(p.x + s.w / 2 - S.width / 2, Math.min(0, lw - S.width), Math.max(0, lw - S.width)), vy = clamp(p.y + s.h / 2 - S.height / 2, Math.min(0, lh - S.height), Math.max(0, lh - S.height));
        x.setLineDash([6, 4]); x.strokeStyle = 'rgba(65,166,246,0.9)'; x.lineWidth = 1.5; x.strokeRect(sx(vx), sy(vy), S.width * z, S.height * z); x.setLineDash([]);
        x.fillStyle = 'rgba(65,166,246,0.9)'; x.font = '10px sans-serif'; x.fillText('game screen at start', sx(vx) + 4, sy(vy) + 12);
      }
    }
    // selection
    x.strokeStyle = '#a7f070'; x.lineWidth = 2;
    for (const i of lvl().instances) if (LE.picked.has(i.id)) { const b = instBox(i); x.strokeRect(sx(b.x) - 1, sy(b.y) - 1, b.w * z + 2, b.h * z + 2); }
    // tool previews
    const d = LE.drag, o = App.object(LE.sel), m = LE.mouse;
    const ghost = (gx, gy, a) => {
      if (!o) return; const s = sizeOf(o), sp = sprOf(o); x.globalAlpha = a;
      if (sp && sp.frames[0]) { const im = ImgCache.get(sp.frames[0], () => invalidate()); if (im.complete && im.naturalWidth) x.drawImage(im, sx(gx), sy(gy), s.w * z, s.h * z); } else { x.fillStyle = o.color; x.fillRect(sx(gx), sy(gy), s.w * z, s.h * z); }
      x.globalAlpha = 1;
    };
    if (d && d.kind === 'box') { x.strokeStyle = '#a7f070'; x.setLineDash([4, 3]); x.lineWidth = 1; x.strokeRect(sx(Math.min(d.a.x, d.b.x)), sy(Math.min(d.a.y, d.b.y)), Math.abs(d.b.x - d.a.x) * z, Math.abs(d.b.y - d.a.y) * z); x.setLineDash([]); }
    else if (d && (d.kind === 'rect' || d.kind === 'line')) {
      const cells = d.kind === 'rect' ? rectCells(d.a, d.b, d.hollow) : cellsLine(d.a.x, d.a.y, d.b.x, d.b.y);
      if (d.erase) { x.fillStyle = 'rgba(239,90,111,0.35)'; cells.forEach(([cx, cy]) => x.fillRect(sx(cx), sy(cy), t * z, t * z)); } else cells.forEach(([cx, cy]) => ghost(cx, cy, 0.6));
    } else if (!d && m.sx != null && (LE.tool === 'brush' || LE.tool === 'rect' || LE.tool === 'line') && o) ghost(m.sx, m.sy, 0.55);
    else if (!d && m.sx != null && LE.tool === 'erase') { x.strokeStyle = '#ef5a6f'; x.lineWidth = 2; x.strokeRect(sx(m.sx), sy(m.sy), t * z, t * z); }
  }
  function updateHud() {
    if (!els.hud) return; const L = lvl();
    els.hud.textContent = L ? 'tile ' + LE.mouse.tx + ', ' + LE.mouse.ty + '  ·  ' + L.instances.length + ' objects  ·  ' + Math.round(LE.cam.z * 100) + '%  ·  wheel: zoom · space/middle-drag: pan' : '';
  }

  /* ---------- level list ---------- */
  async function newLevel() {
    const name = await promptBox('New level', 'Name', 'Level ' + (App.proj.levels.length + 1)); if (!name) return;
    const L = Plat2Templates.newLevel(name.trim(), 50, 12);
    const f = App.proj.levels[0]; if (f) { L.bg = f.bg; L.bg2 = f.bg2; }
    App.proj.levels.push(L); App.touch(); select(L.id);
  }
  function dupLevel() { const L = lvl(); if (!L) return; const n = clone(L); n.id = uid('lv'); n.name = L.name + ' copy'; n.instances.forEach((i) => { i.id = uid('i'); }); App.proj.levels.push(n); App.touch(); select(n.id); }
  async function delLevel() {
    const L = lvl(); if (!L) return;
    if (App.proj.levels.length < 2) { toast('A game needs at least one level', 'err'); return; }
    if (!(await confirmBox('Delete level', 'Delete "' + L.name + '" and everything in it?', 'Delete', true))) return;
    App.proj.levels = App.proj.levels.filter((x) => x !== L); App.touch(); select(App.proj.levels[0].id);
  }
  function moveLevel(d) { const a = App.proj.levels, i = a.indexOf(lvl()), j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; App.touch(); renderList(); }
  function select(id) { LE.id = id; LE.undo = []; LE.redo = []; LE.picked.clear(); LE.order = null; renderList(); renderProps(); renderPalette(); setTimeout(fit, 0); }
  function renderList() {
    if (!els.list) return;
    els.list.replaceChildren(...App.proj.levels.map((L, n) => h('div', { class: 'list-item' + (L.id === LE.id ? ' sel' : ''), onclick: () => { if (L.id !== LE.id) select(L.id); } },
      h('div', { class: 'nm' }, (n + 1) + '. ' + L.name, h('div', { class: 'sub' }, L.w + '×' + L.h + ' tiles · ' + L.instances.length + ' objects')))));
  }

  /* ---------- palette & properties ---------- */
  function renderPalette() {
    if (!els.pal) return;
    const q = LE.search.toLowerCase(), out = [];
    const cats = Array.from(new Set(App.proj.objects.map((o) => o.category || 'misc')));
    const order = ['player', 'terrain', 'items', 'enemies', 'hazards', 'projectiles', 'decor', 'misc'];
    cats.sort((a, b) => (order.indexOf(a) < 0 ? 99 : order.indexOf(a)) - (order.indexOf(b) < 0 ? 99 : order.indexOf(b)));
    cats.forEach((c) => {
      const items = App.proj.objects.filter((o) => (o.category || 'misc') === c && (!q || o.name.toLowerCase().includes(q)));
      if (!items.length) return;
      out.push(h('div', { class: 'cat-head' }, c), h('div', { class: 'palette-grid' }, items.map((o) => h('div', {
        class: 'pal-item' + (o.id === LE.sel ? ' sel' : ''), title: o.name,
        onclick: () => { LE.sel = o.id; if (LE.tool === 'erase' || LE.tool === 'pick' || LE.tool === 'select') LE.tool = 'brush'; renderPalette(); renderTools(); invalidate(); },
      }, thumb(o.spriteId, 34), h('span', null, o.name)))));
    });
    els.pal.replaceChildren(...out, App.proj.objects.length ? null : h('p', { class: 'hint' }, 'Create objects in the Objects tab first.'));
  }
  function renderProps() {
    const L = lvl(); if (!els.props) return;
    if (!L) { els.props.replaceChildren(); return; }
    const w = h('input', { type: 'number', class: 'num', value: L.w, min: 4, max: 400 }), hh = h('input', { type: 'number', class: 'num', value: L.h, min: 4, max: 200 });
    els.props.replaceChildren(
      h('div', { class: 'panel-box' }, h('h4', null, 'Level'),
        field('Name', fText(L, 'name', () => { App.touch(); renderList(); }, { style: 'width:150px' })),
        field('Size (tiles)', w, h('span', null, '×'), hh, h('button', { class: 'btn small', onclick: () => resize(+w.value, +hh.value) }, 'Apply')),
        field('Sky top', fColor(L, 'bg', () => { App.touch(); invalidate(); })),
        field('Sky bottom', fColor(L, 'bg2', () => { App.touch(); invalidate(); }), h('button', { class: 'btn small', title: 'Use a flat color', onclick: () => { L.bg2 = ''; App.touch(); renderProps(); invalidate(); } }, 'flat')),
        field('Music', fSelect(L, 'music', [['', '(game default)']].concat(App.proj.music.map((m) => [m.id, m.name])), () => App.touch()))));
  }
  async function resize(nw, nh) {
    const L = lvl(); nw = clamp(nw | 0, 4, 400); nh = clamp(nh | 0, 4, 200);
    const t = TS(), out = L.instances.filter((i) => i.x >= nw * t || i.y >= nh * t).length;
    if (out && !(await confirmBox('Resize level', out + ' object(s) fall outside the new size and will be removed.', 'Resize', true))) return;
    pushUndo(); L.w = nw; L.h = nh; L.instances = L.instances.filter((i) => i.x < nw * t && i.y < nh * t);
    App.touch(); LE.order = null; renderList(); renderProps(); fit();
  }

  /* ---------- tools ---------- */
  const TOOLS = [['brush', '🖌️', 'Brush (B) — drag to paint, right-click erases'], ['rect', '▭', 'Rectangle (R) — fill area; hold Shift for outline'], ['line', '／', 'Line (L)'],
    ['erase', '🧽', 'Eraser (E)'], ['select', '⬚', 'Select / move (S)'], ['pick', '💧', 'Pick object (I, or Alt+click)']];
  function renderTools() {
    if (!els.tools) return;
    els.tools.replaceChildren(
      ...TOOLS.map(([k, ic, tt]) => h('button', { class: 'btn tool' + (LE.tool === k ? ' on' : ''), title: tt, onclick: () => { LE.tool = k; renderTools(); invalidate(); } }, ic)),
      h('span', { class: 'sep' }),
      h('button', { class: 'btn small', onclick: undo, title: 'Ctrl+Z' }, '↶'), h('button', { class: 'btn small', onclick: redo, title: 'Ctrl+Y' }, '↷'),
      h('span', { class: 'sep' }),
      h('button', { class: 'btn small' + (LE.grid ? ' on' : ''), onclick: () => { LE.grid = !LE.grid; renderTools(); invalidate(); } }, 'Grid'),
      h('label', { class: 'muted' }, 'Snap ', h('select', { onchange: (e) => { LE.snap = e.target.value; } }, [['grid', 'tile'], ['half', 'half tile'], ['free', 'free (1px)']].map(([v, l]) => h('option', { value: v, selected: LE.snap === v }, l)))),
      h('button', { class: 'btn small' + (LE.showHit ? ' on' : ''), onclick: () => { LE.showHit = !LE.showHit; renderTools(); invalidate(); } }, 'Hitboxes'),
      h('button', { class: 'btn small' + (LE.showView ? ' on' : ''), title: 'Show the game screen at player start', onclick: () => { LE.showView = !LE.showView; renderTools(); invalidate(); } }, 'Screen'),
      h('button', { class: 'btn small', onclick: fit }, 'Fit'),
      h('span', { class: 'spacer' }),
      h('button', { class: 'btn play', title: 'Playtest this level (F6)', onclick: () => App.play({ startLevel: App.proj.levels.indexOf(lvl()) }) }, '▶ Play level'));
  }

  /* ---------- keyboard ---------- */
  function copy() {
    const L = lvl(); const sel = L.instances.filter((i) => LE.picked.has(i.id)); if (!sel.length) return;
    const minx = Math.min(...sel.map((i) => i.x)), miny = Math.min(...sel.map((i) => i.y));
    LE.clip = sel.map((i) => ({ obj: i.obj, x: i.x - minx, y: i.y - miny }));
    toast('Copied ' + sel.length + ' object(s)');
  }
  function paste() {
    if (!LE.clip.length) return; pushUndo();
    const base = LE.mouse.sx != null ? { x: LE.mouse.sx, y: LE.mouse.sy } : { x: 0, y: 0 }, L = lvl(); LE.picked.clear();
    LE.clip.forEach((c) => { if (place(c.obj, base.x + c.x, base.y + c.y)) LE.picked.add(L.instances[L.instances.length - 1].id); });
    App.touch(); invalidate(true); renderProps();
  }
  function onKey(e) {
    const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
    if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return true; }
    if (mod && k === 'y') { e.preventDefault(); redo(); return true; }
    if (mod && k === 'c') { copy(); return true; }
    if (mod && k === 'v') { paste(); return true; }
    if (mod && k === 'a') { e.preventDefault(); lvl().instances.forEach((i) => LE.picked.add(i.id)); invalidate(); return true; }
    if (mod) return false;
    if (k === ' ') { LE.space = true; els.cv.style.cursor = 'grab'; e.preventDefault(); return true; }
    const tmap = { b: 'brush', r: 'rect', l: 'line', e: 'erase', s: 'select', i: 'pick' };
    if (tmap[k]) { LE.tool = tmap[k]; renderTools(); invalidate(); return true; }
    if (k === 'g') { LE.grid = !LE.grid; renderTools(); invalidate(); return true; }
    if (k === 'f') { fit(); return true; }
    if (k === 'delete' || k === 'backspace') {
      if (LE.picked.size) { pushUndo(); const L = lvl(); L.instances = L.instances.filter((i) => !LE.picked.has(i.id)); LE.picked.clear(); App.touch(); invalidate(true); renderProps(); e.preventDefault(); return true; }
    }
    if (k === 'escape') { LE.picked.clear(); invalidate(); return true; }
    if (k.startsWith('arrow') && LE.picked.size) {
      e.preventDefault(); pushUndo(); const t = e.shiftKey ? 1 : (LE.snap === 'half' ? TS() / 2 : TS()), dx = k === 'arrowleft' ? -t : k === 'arrowright' ? t : 0, dy = k === 'arrowup' ? -t : k === 'arrowdown' ? t : 0;
      lvl().instances.forEach((i) => { if (LE.picked.has(i.id)) { i.x += dx; i.y += dy; } }); App.touch(); invalidate(true); return true;
    }
    return false;
  }
  function onKeyUp(e) { if (e.key === ' ' && LE.space) { LE.space = false; if (els.cv) els.cv.style.cursor = 'crosshair'; } }

  function mount(root) {
    els.cv = h('canvas', { id: 'lvl-canvas', tabindex: '0', oncontextmenu: (e) => e.preventDefault() });
    els.cv.addEventListener('pointerdown', onDown); els.cv.addEventListener('pointermove', onMove); els.cv.addEventListener('pointerup', onUp); els.cv.addEventListener('pointercancel', onUp);
    els.cv.addEventListener('wheel', onWheel, { passive: false });
    els.hud = h('div', { class: 'lvl-hud' });
    els.view = h('div', { class: 'lvl-view' }, els.cv, els.hud);
    new ResizeObserver(() => { if (App.tab === 'levels') { if (!LE.fitted) { LE.fitted = true; fit(); } else invalidate(); } }).observe(els.view);
    els.list = h('div', { class: 'side-scroll' }); els.tools = h('div', { class: 'toolbar' });
    els.pal = h('div', { class: 'side-scroll' }); els.props = h('div', { style: { padding: '0 8px' } });
    els.search = h('input', { type: 'text', placeholder: 'search objects…', class: 'wide', oninput: (e) => { LE.search = e.target.value; renderPalette(); } });
    root.append(
      h('div', { class: 'sidebar' },
        h('div', { class: 'side-head' }, h('h3', null, 'Levels'), h('button', { class: 'btn small', onclick: newLevel }, '＋ New'), h('button', { class: 'btn small', title: 'Duplicate', onclick: dupLevel }, '⧉'), h('button', { class: 'btn small', title: 'Delete', onclick: delLevel }, '🗑')),
        els.list,
        h('div', { class: 'side-head', style: { borderTop: '1px solid var(--border)', borderBottom: 'none' } }, h('button', { class: 'btn small', onclick: () => moveLevel(-1) }, '↑ Earlier'), h('button', { class: 'btn small', onclick: () => moveLevel(1) }, '↓ Later'))),
      h('div', { class: 'workarea' }, els.tools, els.view),
      h('div', { class: 'sidebar right' }, els.props, h('div', { class: 'side-head', style: { borderTop: '1px solid var(--border)' } }, h('h3', null, 'Palette'), h('button', { class: 'btn small', title: 'Edit the selected object', onclick: () => { if (LE.sel) { App.editors.objects.select(LE.sel); App.setTab('objects'); } } }, 'Edit')), h('div', { style: { padding: '6px 8px 0' } }, els.search), els.pal));
    renderTools();
  }
  function show() {
    if (!lvl()) LE.id = App.proj.levels[0] ? App.proj.levels[0].id : null;
    if (!LE.sel || !App.object(LE.sel)) { const p = App.proj.objects.find((o) => o.isPlayer) || App.proj.objects[0]; LE.sel = (App.proj.objects.find((o) => o.category === 'terrain') || p || {}).id || null; }
    LE.order = null; renderList(); renderProps(); renderPalette(); renderTools(); updateHud();
    setTimeout(() => { if (!LE.fitted || !LE.fittedFor || LE.fittedFor !== LE.id) { LE.fitted = true; LE.fittedFor = LE.id; fit(); } else invalidate(true); }, 0);
  }
  function reset() { LE.id = null; LE.sel = null; LE.undo = []; LE.redo = []; LE.picked.clear(); LE.order = null; LE.fittedFor = null; }
  App.editors.levels = { title: 'Levels', icon: '🗺️', mount, show, onKey, onKeyUp, reset, select, refresh: () => { LE.order = null; renderList(); } };
})();
