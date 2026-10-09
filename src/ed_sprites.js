/* 2plat: pixel art / sprite editor */
(function () {
  'use strict';
  const SE = {
    id: null, frame: 0, tool: 'pencil', color: '#ffffff', mirror: false, grid: true, onion: false, brush: 1,
    zoom: 16, undo: [], redo: [], cv: [], ready: false, stroke: null, recent: [], timer: null, previewFrame: 0,
  };
  let els = {};
  const sp = () => App.sprite(SE.id);

  /* ---------- canvases ---------- */
  function blankCanvas(w, hh) { const c = document.createElement('canvas'); c.width = w; c.height = hh; return c; }
  async function buildCanvases() {
    const s = sp(); if (!s) { SE.cv = []; return; }
    SE.ready = false;
    const id = s.id;
    const list = await Promise.all(s.frames.map(async (src) => {
      const c = blankCanvas(s.w, s.h);
      try { const im = await loadImage(src); c.getContext('2d').drawImage(im, 0, 0); } catch (e) { /* blank */ }
      return c;
    }));
    if (SE.id !== id) return;
    SE.cv = list; SE.ready = true;
    if (SE.frame >= SE.cv.length) SE.frame = SE.cv.length - 1;
    redraw(); renderFrames(); renderPreview();
  }
  function commit(frameIdx) {
    const s = sp(); if (!s) return;
    const i = frameIdx == null ? SE.frame : frameIdx;
    s.frames[i] = SE.cv[i].toDataURL();
    App.touch();
    renderFrames(); renderList(); renderPreview();
  }
  function snap() { const s = sp(); return { w: s.w, h: s.h, fps: s.fps, frames: s.frames.slice() }; }
  function pushUndo() { SE.undo.push(snap()); if (SE.undo.length > 100) SE.undo.shift(); SE.redo = []; }
  async function restore(st) {
    const s = sp(); s.w = st.w; s.h = st.h; s.fps = st.fps; s.frames = st.frames.slice();
    App.touch(); await buildCanvases(); fitZoom(); redraw(); renderAll();
  }
  async function undo() { if (!SE.undo.length) return; SE.redo.push(snap()); await restore(SE.undo.pop()); }
  async function redo() { if (!SE.redo.length) return; SE.undo.push(snap()); await restore(SE.redo.pop()); }

  /* ---------- drawing ---------- */
  function fitZoom() {
    const s = sp(); if (!s) return;
    SE.zoom = clamp(Math.floor(520 / Math.max(s.w, s.h)), 3, 40);
  }
  function redraw() {
    const s = sp(), cv = els.canvas;
    if (els.empty) els.empty.style.display = s ? 'none' : 'block';
    if (cv) cv.style.display = s ? '' : 'none';
    if (!s || !cv) return;
    const Z = SE.zoom;
    cv.width = s.w * Z; cv.height = s.h * Z;
    cv.style.width = cv.width + 'px'; cv.style.height = cv.height + 'px';
    const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, cv.width, cv.height);
    if (SE.onion && SE.frame > 0 && SE.cv[SE.frame - 1]) { c.globalAlpha = 0.28; c.drawImage(SE.cv[SE.frame - 1], 0, 0, cv.width, cv.height); c.globalAlpha = 1; }
    if (SE.cv[SE.frame]) c.drawImage(SE.cv[SE.frame], 0, 0, cv.width, cv.height);
    if (SE.grid && Z >= 6) {
      c.strokeStyle = 'rgba(255,255,255,0.10)'; c.lineWidth = 1; c.beginPath();
      for (let x = 1; x < s.w; x++) { c.moveTo(x * Z + 0.5, 0); c.lineTo(x * Z + 0.5, cv.height); }
      for (let y = 1; y < s.h; y++) { c.moveTo(0, y * Z + 0.5); c.lineTo(cv.width, y * Z + 0.5); }
      c.stroke();
    }
    if (SE.mirror) { c.strokeStyle = 'rgba(255,205,117,0.8)'; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(cv.width / 2, 0); c.lineTo(cv.width / 2, cv.height); c.stroke(); c.setLineDash([]); }
  }
  function plot(ctx, x, y, erase) {
    const s = sp(), b = SE.brush;
    const put = (px, py) => {
      for (let i = 0; i < b; i++) for (let j = 0; j < b; j++) {
        const xx = px + i - ((b - 1) >> 1), yy = py + j - ((b - 1) >> 1);
        if (xx < 0 || yy < 0 || xx >= s.w || yy >= s.h) continue;
        if (erase) ctx.clearRect(xx, yy, 1, 1); else { ctx.clearRect(xx, yy, 1, 1); ctx.fillStyle = SE.color; ctx.fillRect(xx, yy, 1, 1); }
      }
    };
    put(x, y); if (SE.mirror) put(s.w - 1 - x, y);
  }
  function line(ctx, x0, y0, x1, y1, erase) {
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      plot(ctx, x0, y0, erase);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  function rect(ctx, x0, y0, x1, y1, filled) {
    const ax = Math.min(x0, x1), bx = Math.max(x0, x1), ay = Math.min(y0, y1), by = Math.max(y0, y1);
    for (let x = ax; x <= bx; x++) for (let y = ay; y <= by; y++) if (filled || x === ax || x === bx || y === ay || y === by) plot(ctx, x, y);
  }
  function ellipse(ctx, x0, y0, x1, y1, filled) {
    const ax = Math.min(x0, x1), bx = Math.max(x0, x1), ay = Math.min(y0, y1), by = Math.max(y0, y1);
    const cx = (ax + bx) / 2, cy = (ay + by) / 2, rx = (bx - ax) / 2 + 0.5, ry = (by - ay) / 2 + 0.5;
    const inside = (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
    for (let x = ax; x <= bx; x++) for (let y = ay; y <= by; y++) {
      if (!inside(x, y)) continue;
      if (filled || !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) plot(ctx, x, y);
    }
  }
  function floodFill(ctx, x, y) {
    const s = sp(), img = ctx.getImageData(0, 0, s.w, s.h), d = img.data;
    const idx = (px, py) => (py * s.w + px) * 4;
    const t = d.slice(idx(x, y), idx(x, y) + 4);
    const col = hexRGB(SE.color);
    if (t[0] === col[0] && t[1] === col[1] && t[2] === col[2] && t[3] === 255) return;
    const same = (i) => d[i] === t[0] && d[i + 1] === t[1] && d[i + 2] === t[2] && d[i + 3] === t[3];
    const st = [[x, y]];
    while (st.length) {
      const [px, py] = st.pop();
      if (px < 0 || py < 0 || px >= s.w || py >= s.h) continue;
      const i = idx(px, py); if (!same(i)) continue;
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
      st.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
    }
    ctx.putImageData(img, 0, 0);
  }
  function hexRGB(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  const rgbHex = (r, g, b) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');

  function pixelAt(e) {
    const r = els.canvas.getBoundingClientRect(), s = sp();
    return { x: clamp(Math.floor((e.clientX - r.left) / SE.zoom), 0, s.w - 1), y: clamp(Math.floor((e.clientY - r.top) / SE.zoom), 0, s.h - 1) };
  }
  function addRecent(c) {
    SE.recent = [c].concat(SE.recent.filter((x) => x !== c)).slice(0, 8); renderColors();
  }
  function onDown(e) {
    if (!SE.ready || !sp()) return;
    e.preventDefault(); els.canvas.setPointerCapture(e.pointerId);
    const p = pixelAt(e), right = e.button === 2, ctx = SE.cv[SE.frame].getContext('2d');
    const tool = right ? 'eraser' : SE.tool;
    if (tool === 'picker') {
      const d = ctx.getImageData(p.x, p.y, 1, 1).data;
      if (d[3] > 0) { SE.color = rgbHex(d[0], d[1], d[2]); renderColors(); } return;
    }
    pushUndo();
    SE.stroke = { tool, sx: p.x, sy: p.y, lx: p.x, ly: p.y, base: null };
    if (tool === 'fill') { floodFill(ctx, p.x, p.y); SE.stroke = null; commit(); redraw(); addRecent(SE.color); return; }
    if (tool === 'pencil' || tool === 'eraser') { plot(ctx, p.x, p.y, tool === 'eraser'); }
    else SE.stroke.base = ctx.getImageData(0, 0, sp().w, sp().h);
    redraw();
  }
  function onMove(e) {
    const s = sp(); if (!s) return;
    const p = pixelAt(e);
    els.pos.textContent = p.x + ', ' + p.y;
    if (!SE.stroke) return;
    const st = SE.stroke, ctx = SE.cv[SE.frame].getContext('2d');
    if (st.tool === 'pencil' || st.tool === 'eraser') { line(ctx, st.lx, st.ly, p.x, p.y, st.tool === 'eraser'); st.lx = p.x; st.ly = p.y; }
    else {
      ctx.putImageData(st.base, 0, 0);
      if (st.tool === 'line') line(ctx, st.sx, st.sy, p.x, p.y);
      else if (st.tool === 'rect') rect(ctx, st.sx, st.sy, p.x, p.y, false);
      else if (st.tool === 'rectf') rect(ctx, st.sx, st.sy, p.x, p.y, true);
      else if (st.tool === 'ellipse') ellipse(ctx, st.sx, st.sy, p.x, p.y, false);
      else if (st.tool === 'ellipsef') ellipse(ctx, st.sx, st.sy, p.x, p.y, true);
    }
    redraw();
  }
  function onUp() {
    if (!SE.stroke) return;
    const t = SE.stroke.tool; SE.stroke = null;
    if (t !== 'eraser') addRecent(SE.color);
    commit(); redraw();
  }

  /* ---------- transforms ---------- */
  function transform(fn, label) {
    const s = sp(); if (!s || !SE.ready) return;
    pushUndo();
    const src = SE.cv[SE.frame], dst = blankCanvas(s.w, s.h), dc = dst.getContext('2d');
    fn(dc, src, s);
    SE.cv[SE.frame] = dst; commit(); redraw();
  }
  const tFlipH = () => transform((c, src, s) => { c.translate(s.w, 0); c.scale(-1, 1); c.drawImage(src, 0, 0); });
  const tFlipV = () => transform((c, src, s) => { c.translate(0, s.h); c.scale(1, -1); c.drawImage(src, 0, 0); });
  function tRotate() {
    const s = sp(); if (s.w !== s.h) { toast('Rotate works on square sprites', 'err'); return; }
    transform((c, src) => { c.translate(s.w, 0); c.rotate(Math.PI / 2); c.drawImage(src, 0, 0); });
  }
  const tShift = (dx, dy) => transform((c, src, s) => {
    for (const ox of [-s.w, 0, s.w]) for (const oy of [-s.h, 0, s.h]) c.drawImage(src, ox + dx, oy + dy);
    c.clearRect(-1000, -1000, 0, 0);
  });
  function tClear() { transform(() => { }); }
  async function resizeSprite() {
    const s = sp(); const r = await sizeBox('Resize canvas (crops or pads at top-left)', s.w, s.h); if (!r) return;
    pushUndo();
    SE.cv = SE.cv.map((c) => { const n = blankCanvas(r.w, r.h); n.getContext('2d').drawImage(c, 0, 0); return n; });
    s.w = r.w; s.h = r.h; s.frames = SE.cv.map((c) => c.toDataURL());
    App.touch(); fitZoom(); redraw(); renderAll();
  }

  /* ---------- frames ---------- */
  function addFrame(copy) {
    const s = sp(); pushUndo();
    const c = blankCanvas(s.w, s.h); if (copy) c.getContext('2d').drawImage(SE.cv[SE.frame], 0, 0);
    SE.cv.splice(SE.frame + 1, 0, c); s.frames.splice(SE.frame + 1, 0, c.toDataURL());
    SE.frame++; App.touch(); redraw(); renderAll();
  }
  function delFrame() {
    const s = sp(); if (s.frames.length < 2) { toast('A sprite needs at least one frame', 'err'); return; }
    pushUndo(); SE.cv.splice(SE.frame, 1); s.frames.splice(SE.frame, 1);
    SE.frame = Math.min(SE.frame, s.frames.length - 1); App.touch(); redraw(); renderAll();
  }
  function moveFrame(d) {
    const s = sp(), j = SE.frame + d; if (j < 0 || j >= s.frames.length) return;
    pushUndo();
    [SE.cv[SE.frame], SE.cv[j]] = [SE.cv[j], SE.cv[SE.frame]]; [s.frames[SE.frame], s.frames[j]] = [s.frames[j], s.frames[SE.frame]];
    SE.frame = j; App.touch(); redraw(); renderAll();
  }

  /* ---------- sprite list ops ---------- */
  async function newSprite() {
    const r = await sizeBox('New sprite size', App.proj.settings.tileSize || 16, App.proj.settings.tileSize || 16); if (!r) return;
    const name = await promptBox('New sprite', 'Name', 'sprite_' + (App.proj.sprites.length + 1)); if (!name) return;
    const s = Plat2Templates.newSprite(name.trim(), r.w, r.h);
    App.proj.sprites.push(s); App.touch(); select(s.id);
  }
  function dupSprite() {
    const s = sp(); if (!s) return; const n = clone(s); n.id = uid('sp'); n.name = s.name + '_copy';
    App.proj.sprites.push(n); App.touch(); select(n.id);
  }
  async function delSprite() {
    const s = sp(); if (!s) return;
    const used = App.proj.objects.filter((o) => [o.spriteId, o.runSpriteId, o.jumpSpriteId].includes(s.id));
    const ok = await confirmBox('Delete sprite', 'Delete "' + s.name + '"?' + (used.length ? ' It is used by ' + used.map((o) => o.name).join(', ') + '.' : ''), 'Delete', true);
    if (!ok) return;
    App.proj.objects.forEach((o) => { ['spriteId', 'runSpriteId', 'jumpSpriteId'].forEach((k) => { if (o[k] === s.id) o[k] = ''; }); });
    App.proj.sprites = App.proj.sprites.filter((x) => x !== s);
    App.touch(); select(App.proj.sprites[0] ? App.proj.sprites[0].id : null);
  }
  async function importPng() {
    const files = await pickFile('image/png,image/gif,image/jpeg,image/webp', true);
    for (const f of files) {
      const src = await readAsDataURL(f); let im;
      try { im = await loadImage(src); } catch (e) { toast('Could not read ' + f.name, 'err'); continue; }
      if (im.width > 512 || im.height > 512) { toast(f.name + ' is larger than 512px', 'err'); continue; }
      let n = 1;
      if (im.width >= im.height * 2) {
        const v = await promptBox('Import ' + f.name, 'Frames across (1 = single image; sprite sheets are sliced evenly)', String(Math.round(im.width / im.height) === im.width / im.height ? im.width / im.height : 1));
        n = clamp(parseInt(v, 10) || 1, 1, 64);
      }
      const fw = Math.floor(im.width / n), frames = [];
      for (let i = 0; i < n; i++) { const c = blankCanvas(fw, im.height); c.getContext('2d').drawImage(im, i * fw, 0, fw, im.height, 0, 0, fw, im.height); frames.push(c.toDataURL()); }
      const s = { id: uid('sp'), name: f.name.replace(/\.[^.]+$/, '').replace(/\W+/g, '_'), w: fw, h: im.height, fps: 8, frames };
      App.proj.sprites.push(s); App.touch(); select(s.id);
    }
  }
  function exportPng() {
    const s = sp(); if (!s) return;
    const c = blankCanvas(s.w * s.frames.length, s.h), x = c.getContext('2d');
    SE.cv.forEach((f, i) => x.drawImage(f, i * s.w, 0));
    c.toBlob((b) => App.saveBlob(s.name + '.png', b, 'image/png'));
  }

  /* ---------- UI ---------- */
  function select(id) {
    SE.id = id; SE.frame = 0; SE.undo = []; SE.redo = []; SE.cv = []; SE.ready = false;
    fitZoom(); renderAll(); buildCanvases();
  }
  function renderList() {
    if (!els.list) return;
    els.list.replaceChildren(...App.proj.sprites.map((s) => h('div', { class: 'list-item' + (s.id === SE.id ? ' sel' : ''), onclick: () => { if (s.id !== SE.id) select(s.id); } },
      thumb(s.id, 34), h('div', { class: 'nm' }, s.name, h('div', { class: 'sub' }, s.w + '×' + s.h + ' · ' + s.frames.length + ' frame' + (s.frames.length > 1 ? 's' : ''))))));
  }
  function renderColors() {
    if (!els.colors) return;
    const pal = Plat2Palettes.current();
    if (els.colorsTitle) els.colorsTitle.textContent = 'Colors (' + pal.name + ')';
    els.colors.replaceChildren(
      h('div', { class: 'row', style: { marginBottom: '6px' } }, h('input', { type: 'color', value: SE.color, oninput: (e) => { SE.color = e.target.value; } , onchange: (e) => { SE.color = e.target.value; addRecent(SE.color); } }),
        h('span', { class: 'pill' }, SE.color)),
      h('div', { class: 'swatches' }, pal.colors.map((c) => h('div', { class: 'swatch' + (c === SE.color ? ' sel' : ''), style: { background: c }, title: c, onclick: () => { SE.color = c; if (SE.tool === 'eraser') SE.tool = 'pencil'; renderColors(); renderTools(); } }))),
      SE.recent.length ? h('div', { class: 'lbl' }, 'Recent') : null,
      SE.recent.length ? h('div', { class: 'swatches' }, SE.recent.map((c) => h('div', { class: 'swatch' + (c === SE.color ? ' sel' : ''), style: { background: c }, onclick: () => { SE.color = c; renderColors(); } }))) : null);
  }
  function renderFrames() {
    const s = sp(); if (!els.frames || !s) return;
    els.frames.replaceChildren(...s.frames.map((src, i) => {
      const f = h('div', { class: 'frame' + (i === SE.frame ? ' sel' : ''), onclick: () => { SE.frame = i; redraw(); renderFrames(); } },
        h('div', { class: 'thumb', style: { width: '44px', height: '44px' } }, h('img', { src })), h('div', { class: 'n' }, i + 1));
      return f;
    }));
  }
  function renderPreview() {
    const s = sp(), c = els.preview; if (!s || !c) return;
    const z = Math.max(1, Math.floor(96 / Math.max(s.w, s.h)));
    c.width = s.w * z; c.height = s.h * z; c.style.width = c.width + 'px'; c.style.height = c.height + 'px';
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.clearRect(0, 0, c.width, c.height);
    const f = SE.cv[SE.previewFrame % Math.max(1, SE.cv.length)];
    if (f) x.drawImage(f, 0, 0, c.width, c.height);
  }
  function startAnim() {
    clearInterval(SE.timer);
    SE.timer = setInterval(() => {
      const s = sp(); if (!s || App.tab !== 'sprites' || s.frames.length < 2) { if (s) { SE.previewFrame = SE.frame; renderPreview(); } return; }
      SE.previewFrame = (SE.previewFrame + 1) % s.frames.length; renderPreview();
    }, 1000 / Math.max(1, (sp() && sp().fps) || 6));
  }
  const TOOLS = [['pencil', '✏️', 'Pencil (B)'], ['eraser', '🧽', 'Eraser (E, or right-click)'], ['fill', '🪣', 'Fill (G)'], ['picker', '💧', 'Color picker (I)'],
    ['line', '／', 'Line (L)'], ['rect', '▭', 'Rectangle (R)'], ['rectf', '■', 'Filled rectangle'], ['ellipse', '◯', 'Ellipse (O)'], ['ellipsef', '●', 'Filled ellipse']];
  function renderTools() {
    if (!els.tools) return;
    els.tools.replaceChildren(
      ...TOOLS.map(([k, ic, tt]) => h('button', { class: 'btn tool' + (SE.tool === k ? ' on' : ''), title: tt, onclick: () => { SE.tool = k; renderTools(); } }, ic)),
      h('span', { class: 'sep' }),
      h('button', { class: 'btn small' + (SE.mirror ? ' on' : ''), title: 'Mirror horizontally while drawing', onclick: () => { SE.mirror = !SE.mirror; renderTools(); redraw(); } }, 'Mirror'),
      h('button', { class: 'btn small' + (SE.grid ? ' on' : ''), onclick: () => { SE.grid = !SE.grid; renderTools(); redraw(); } }, 'Grid'),
      h('button', { class: 'btn small' + (SE.onion ? ' on' : ''), title: 'Show previous frame faintly', onclick: () => { SE.onion = !SE.onion; renderTools(); redraw(); } }, 'Onion'),
      h('span', { class: 'sep' }),
      h('label', { class: 'muted' }, 'Brush ', h('select', { onchange: (e) => { SE.brush = +e.target.value; } }, [1, 2, 3, 4].map((n) => h('option', { value: n, selected: n === SE.brush }, n + 'px')))),
      h('span', { class: 'sep' }),
      h('button', { class: 'btn small', title: 'Undo (Ctrl+Z)', onclick: undo }, '↶ Undo'), h('button', { class: 'btn small', title: 'Redo (Ctrl+Y)', onclick: redo }, '↷ Redo'),
      h('span', { class: 'sep' }),
      h('label', { class: 'muted' }, 'Zoom ', h('input', { type: 'range', min: 3, max: 40, value: SE.zoom, style: { width: '90px' }, oninput: (e) => { SE.zoom = +e.target.value; redraw(); } })));
  }
  function renderProps() {
    const s = sp(); if (!els.props) return;
    if (!s) { els.props.replaceChildren(h('p', { class: 'hint' }, 'No sprite selected. Create one with ＋ New.')); return; }
    els.props.replaceChildren(
      h('div', { class: 'panel-box' }, h('h4', null, 'Sprite'),
        field('Name', fText(s, 'name', () => { App.touch(); renderList(); })),
        field('Size', h('span', { class: 'muted' }, s.w + '×' + s.h), h('button', { class: 'btn small', onclick: resizeSprite }, 'Resize…')),
        field('Speed', fRange(s, 'fps', 1, 30, 1, () => { App.touch(); startAnim(); }), h('span', { class: 'muted' }, 'fps'))),
      h('div', { class: 'panel-box' }, h('h4', null, 'Animation preview'), h('div', { class: 'thumb', style: { width: '104px', height: '104px', margin: '0 auto' } }, els.preview = h('canvas')),
      ),
      h('div', { class: 'panel-box' }, h('h4', null, 'Frames'), els.frames = h('div', { class: 'frames' }),
        h('div', { class: 'row', style: { marginTop: '8px' } },
          h('button', { class: 'btn small', onclick: () => addFrame(false) }, '＋ Blank'), h('button', { class: 'btn small', onclick: () => addFrame(true) }, '⧉ Copy'),
          h('button', { class: 'btn small', onclick: () => moveFrame(-1) }, '◀'), h('button', { class: 'btn small', onclick: () => moveFrame(1) }, '▶'),
          h('button', { class: 'btn small danger', onclick: delFrame }, '🗑'))),
      h('div', { class: 'panel-box' }, h('h4', null, 'Transform frame'),
        h('div', { class: 'row' },
          h('button', { class: 'btn small', onclick: tFlipH }, '⇋ Flip H'), h('button', { class: 'btn small', onclick: tFlipV }, '⇅ Flip V'), h('button', { class: 'btn small', onclick: tRotate }, '⟳ Rotate'),
          h('button', { class: 'btn small danger', onclick: tClear }, 'Clear')),
        h('div', { class: 'row', style: { marginTop: '6px' } }, h('span', { class: 'muted' }, 'Shift'),
          h('button', { class: 'btn small', onclick: () => tShift(-1, 0) }, '←'), h('button', { class: 'btn small', onclick: () => tShift(0, -1) }, '↑'),
          h('button', { class: 'btn small', onclick: () => tShift(0, 1) }, '↓'), h('button', { class: 'btn small', onclick: () => tShift(1, 0) }, '→'))),
      h('div', { class: 'panel-box' }, els.colorsTitle = h('h4', { title: 'Colors in the selected palette. Change it with Palettes in the top bar.' }, 'Colors'), els.colors = h('div')));
    els.frames = els.props.querySelector('.frames'); els.colors = els.props.lastChild.lastChild; els.preview = els.props.querySelector('canvas');
    renderFrames(); renderColors(); renderPreview(); startAnim();
  }
  function renderAll() { renderList(); renderTools(); renderProps(); redraw(); }

  function mount(root) {
    els.canvas = h('canvas', { class: 'px', oncontextmenu: (e) => e.preventDefault() });
    els.canvas.addEventListener('pointerdown', onDown); els.canvas.addEventListener('pointermove', onMove); els.canvas.addEventListener('pointerup', onUp); els.canvas.addEventListener('pointercancel', onUp);
    els.list = h('div', { class: 'side-scroll' });
    els.tools = h('div', { class: 'toolbar' });
    els.props = h('div', { class: 'side-scroll' });
    els.pos = h('span', { class: 'lbl', style: { margin: '0 0 0 10px', textTransform: 'none' } }, '');
    root.append(
      h('div', { class: 'sidebar' },
        h('div', { class: 'side-head' }, h('h3', null, 'Sprites'),
          h('button', { class: 'btn small', onclick: newSprite }, '＋ New'), h('button', { class: 'btn small', title: 'Duplicate', onclick: dupSprite }, '⧉'),
          h('button', { class: 'btn small', title: 'Delete', onclick: delSprite }, '🗑')),
        els.list,
        h('div', { class: 'side-head', style: { borderTop: '1px solid var(--border)', borderBottom: 'none' } },
          h('button', { class: 'btn small', onclick: importPng }, '⬆ Import PNG'), h('button', { class: 'btn small', onclick: exportPng }, '⬇ Export PNG'))),
      h('div', { class: 'workarea' }, els.tools, h('div', { class: 'canvas-wrap' }, els.canvas, els.empty = h('div', { class: 'hint', style: { textAlign: 'center', maxWidth: '360px', fontSize: '14px' } }, 'No sprites yet. Click ＋ New (top left) to draw your first one, or Import PNG to bring in your own art. Sprites are the pictures your objects use.')), h('div', { class: 'toolbar', style: { borderTop: '1px solid var(--border)', borderBottom: 'none' } }, h('span', { class: 'muted' }, 'Left-click draw · right-click erase · hold canvas and drag for shapes'), els.pos)),
      h('div', { class: 'sidebar right' }, els.props));
    renderAll();
  }
  function show() {
    if (!sp()) SE.id = App.proj.sprites[0] ? App.proj.sprites[0].id : null;
    if (SE.id && !SE.cv.length) { fitZoom(); buildCanvases(); }
    renderAll();
  }
  function onKey(e) {
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return true; }
    if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); redo(); return true; }
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    const map = { b: 'pencil', e: 'eraser', g: 'fill', i: 'picker', l: 'line', r: 'rect', o: 'ellipse' };
    if (map[k]) { SE.tool = map[k]; renderTools(); return true; }
    if (k === '[') { SE.frame = Math.max(0, SE.frame - 1); redraw(); renderFrames(); return true; }
    if (k === ']') { SE.frame = Math.min(sp().frames.length - 1, SE.frame + 1); redraw(); renderFrames(); return true; }
    return false;
  }
  function reset() { SE.id = null; SE.cv = []; SE.undo = []; SE.redo = []; SE.frame = 0; }
  /* Called after a new palette is chosen in the top bar menu. */
  function paletteChanged() {
    const pal = Plat2Palettes.current();
    if (!pal.colors.includes(SE.color)) { SE.color = pal.colors[0]; if (SE.tool === 'eraser') SE.tool = 'pencil'; }
    renderColors(); if (typeof renderTools === 'function') renderTools();
  }
  App.editors.sprites = { title: 'Sprites', icon: '🎨', mount, show, onKey, reset, select, refresh: () => { renderList(); }, paletteChanged };
})();
