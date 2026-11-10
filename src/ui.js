/* 2plat editor: shared UI helpers and global App object. */
'use strict';
window.PLAT2_VERSION = '0.2.0';

// replaceChildren(null) would insert the text "null"; drop empty entries instead
(function () {
  const orig = Element.prototype.replaceChildren;
  Element.prototype.replaceChildren = function (...kids) { return orig.apply(this, kids.flat(Infinity).filter((k) => k != null && k !== false)); };
})();


/* ---- icons: one consistent stroke icon set (inline SVG, inherits text color) ---- */
const ICONS = {
  play: '<polygon points="7 4 20 12 7 20 7 4" fill="currentColor"/>', stop: '<rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>', plus: '<path d="M12 5v14M5 12h14"/>', check: '<path d="m5 12 5 5 9-10"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>', redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
  fit: '<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>',
  upload: '<path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/>',
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/>',
  flipH: '<path d="M12 3v18"/><path d="M8 7 3 12l5 5V7z"/><path d="m16 7 5 5-5 5V7z"/>', flipV: '<path d="M3 12h18"/><path d="M7 8 12 3l5 5H7z"/><path d="m7 16 5 5 5-5H7z"/>',
  rotate: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>', restart: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
  left: '<path d="M19 12H5"/><path d="m11 18-6-6 6-6"/>', right: '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  up: '<path d="M12 19V5"/><path d="m6 11 6-6 6 6"/>', down: '<path d="M12 5v14"/><path d="m18 13-6 6-6-6"/>',
  chevUp: '<path d="m6 15 6-6 6 6"/>', chevDown: '<path d="m6 9 6 6 6-6"/>',
  pencil: '<path d="M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  eraser: '<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/>',
  bucket: '<path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/><path d="m5 2 5 5"/><path d="M2 13h15"/><path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z"/>',
  picker: '<path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/>',
  line: '<path d="M5 19 19 5"/>', rect: '<rect x="4" y="5" width="16" height="14" rx="1"/>', rectf: '<rect x="4" y="5" width="16" height="14" rx="1" fill="currentColor"/>',
  ellipse: '<ellipse cx="12" cy="12" rx="9" ry="7"/>', ellipsef: '<ellipse cx="12" cy="12" rx="9" ry="7" fill="currentColor"/>',
  brush: '<path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08"/><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z"/>',
  select: '<rect x="4" y="4" width="16" height="16" rx="1" stroke-dasharray="3 3"/>',
  dice: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>',
  filePlus: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5"/><path d="M12 12v6M9 15h6"/>',
  save: '<path d="M5 3h11l4 4v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M8 3v5h7V3"/><rect x="7" y="13" width="10" height="8"/>',
  export: '<path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/>',
  palette: '<circle cx="13.5" cy="6.5" r="1" fill="currentColor"/><circle cx="17.5" cy="10.5" r="1" fill="currentColor"/><circle cx="8.5" cy="7.5" r="1" fill="currentColor"/><circle cx="6.5" cy="12.5" r="1" fill="currentColor"/><path d="M12 2a10 10 0 0 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4a4.7 4.7 0 0 0 4.7-4.7C22 6 17.5 2 12 2Z"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  sprites: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  objects: '<path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="m3 8 9 5 9-5"/><path d="M12 13v8"/>',
  levels: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15"/>',
  sounds: '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  settings: '<path d="M4 6h9M19 6h1M4 12h3M13 12h7M4 18h11M21 18h-1"/><circle cx="16" cy="6" r="2.2"/><circle cx="10" cy="12" r="2.2"/><circle cx="18" cy="18" r="2.2"/>',
  sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/>',
  heart: '<path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11Z"/>',
  gamepad: '<path d="M6 11h4M8 9v4"/><circle cx="15" cy="12" r="1" fill="currentColor"/><circle cx="18" cy="10" r="1" fill="currentColor"/><path d="M17.3 5H6.7a4 4 0 0 0-3.9 3.2L1.5 15a3 3 0 0 0 5.2 2.4L8 16h8l1.3 1.4a3 3 0 0 0 5.2-2.4l-1.3-6.8A4 4 0 0 0 17.3 5Z"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7l10-5Z"/><path d="m2 12 10 5 10-5"/><path d="m2 17 10 5 10-5"/>',
  dot: '<circle cx="12" cy="12" r="4" fill="currentColor"/>',
};
function ic(name, size) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'ico'); s.setAttribute('aria-hidden', 'true');
  if (size) { s.style.width = s.style.height = size + 'px'; }
  s.innerHTML = ICONS[name] || ICONS.dot;
  return s;
}
// A button label may start with a plain symbol (e.g. "▶ Play"); it is swapped for the matching icon.
const GLYPH_ICON = {
  '▶': 'play', '■': 'stop', '✕': 'x', '＋': 'plus', '↶': 'undo', '↷': 'redo', '🗑': 'trash', '⧉': 'copy', '✂': 'fit', '⬆': 'upload', '⬇': 'download',
  '⇋': 'flipH', '⇅': 'flipV', '⟳': 'rotate', '↻': 'restart', '←': 'left', '→': 'right', '↑': 'up', '↓': 'down', '▲': 'chevUp', '▼': 'chevDown', '◀': 'left',
  '✏': 'pencil', '🧽': 'eraser', '🪣': 'bucket', '💧': 'picker', '／': 'line', '▭': 'rect', '▣': 'rectf', '◯': 'ellipse', '◉': 'ellipsef', '🖌': 'brush', '⬚': 'select',
  '🎲': 'dice', '📁': 'folder', '📂': 'folder', '📄': 'filePlus', '💾': 'save', '🌐': 'export', '🎨': 'palette', '✓': 'check',
};
const GLYPH_RX = new RegExp('^(' + Object.keys(GLYPH_ICON).join('|') + ')\\uFE0F?\\s*');

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  let late = null;
  if (props) {
    for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'style') el.setAttribute('style', v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'value' || k === 'selected') (late = late || {})[k] = v;
      else if (k === 'checked' || k === 'disabled' || k === 'indeterminate') el[k] = v;
      else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  const isBtn = tag === 'button';
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    if (isBtn && typeof c === 'string') {
      const m = GLYPH_RX.exec(c);
      if (m) { el.append(ic(GLYPH_ICON[m[1]])); const rest = c.slice(m[0].length); if (rest) el.append(h('span', { class: 'bt' }, rest)); else el.classList.add('icon-only'); continue; }
    }
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  if (late) for (const k in late) el[k] = late[k];
  return el;
}
const $ = (sel, root) => (root || document).querySelector(sel);
const clone = (o) => JSON.parse(JSON.stringify(o));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const uid = (p) => Plat2Templates.uid(p);

const App = {
  proj: null, tab: 'sprites', editors: {}, dirty: false, file: null, playing: false,
  audio: null,
  sharedAudio() { return this.audio || (this.audio = Plat2.createAudio()); },
  sprite(id) { return this.proj.sprites.find((s) => s.id === id); },
  object(id) { return this.proj.objects.find((o) => o.id === id); },
  sound(id) { return this.proj.sounds.find((s) => s.id === id); },
  level(id) { return this.proj.levels.find((l) => l.id === id); },
  musicOf(id) { return this.proj.music.find((m) => m.id === id); },
  touch() { App.markDirty(); },
  markDirty() { /* replaced in app.js */ },
};

/* ---- images: cache of decoded sprite frames ---- */
const ImgCache = {
  map: new Map(),
  get(src, onload) {
    let im = this.map.get(src);
    if (!im) {
      im = new Image();
      im.src = src;
      this.map.set(src, im);
      if (this.map.size > 600) this.map.delete(this.map.keys().next().value);
    }
    if (!im.complete && onload) im.addEventListener('load', onload, { once: true });
    return im;
  },
};

function thumb(spriteId, size, frame) {
  const sp = App.sprite(spriteId);
  size = size || 32;
  const el = h('div', { class: 'thumb', style: { width: size + 'px', height: size + 'px' } });
  if (sp && sp.frames[frame || 0]) {
    const im = h('img', { src: sp.frames[frame || 0], draggable: 'false' });
    el.append(im);
  } else el.classList.add('empty');
  return el;
}

/* ---- toast ---- */
function toast(msg, kind) {
  let host = $('#toasts');
  if (!host) { host = h('div', { id: 'toasts' }); document.body.append(host); }
  const t = h('div', { class: 'toast ' + (kind || '') }, kind === 'ok' ? ic('check') : kind === 'err' ? ic('x') : ic('dot'), h('span', null, msg));
  host.append(t);
  setTimeout(() => t.classList.add('out'), 2800);
  setTimeout(() => t.remove(), 3300);
}

/* ---- modal dialogs (Electron has no window.prompt) ---- */
function modal(opts) {
  const back = h('div', { class: 'modal-back' });
  const box = h('div', { class: 'modal', style: opts.width ? { width: opts.width + 'px' } : null });
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey, true); if (opts.onClose) opts.onClose(); };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', onKey, true);
  box.append(h('div', { class: 'modal-title' }, h('span', null, opts.title || ''), opts.dismiss === false ? null : h('button', { class: 'modal-x', title: 'Close (Esc)', onclick: close }, ic('x'))));
  const body = h('div', { class: 'modal-body' }, opts.body);
  box.append(body);
  const bar = h('div', { class: 'modal-buttons' });
  (opts.buttons || [{ label: 'Close' }]).forEach((b) => {
    bar.append(h('button', {
      class: 'btn ' + (b.primary ? 'primary' : '') + (b.danger ? ' danger' : ''),
      onclick: () => { const r = b.onclick ? b.onclick() : undefined; if (r !== false) close(); },
    }, b.label));
  });
  box.append(bar);
  back.append(box);
  back.addEventListener('mousedown', (e) => { if (e.target === back && opts.dismiss !== false) close(); });
  document.body.append(back);
  const first = box.querySelector('input,select,textarea');
  if (first) { first.focus(); if (first.select) first.select(); }
  return { close, box, body };
}
function promptBox(title, label, def, extra) {
  return new Promise((res) => {
    const inp = h('input', { type: 'text', value: def == null ? '' : def, class: 'wide' });
    let done = false;
    const m = modal({
      title, body: h('div', null, h('label', { class: 'lbl' }, label), inp, extra || null),
      buttons: [{ label: 'Cancel', onclick: () => { done = true; res(null); } }, { label: 'OK', primary: true, onclick: () => { done = true; res(inp.value); } }],
      onClose: () => { if (!done) res(null); },
    });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { done = true; res(inp.value); m.close(); } });
  });
}
function confirmBox(title, msg, okLabel, danger) {
  return new Promise((res) => {
    let done = false;
    modal({
      title, body: h('p', null, msg),
      buttons: [{ label: 'Cancel', onclick: () => { done = true; res(false); } }, { label: okLabel || 'OK', primary: !danger, danger, onclick: () => { done = true; res(true); } }],
      onClose: () => { if (!done) res(false); },
    });
  });
}
function sizeBox(title, w, hh) {
  return new Promise((res) => {
    const iw = h('input', { type: 'number', value: w, min: 1, max: 256 }), ih = h('input', { type: 'number', value: hh, min: 1, max: 256 });
    let done = false;
    modal({
      title, body: h('div', { class: 'row' }, h('label', null, 'Width ', iw), h('label', null, 'Height ', ih)),
      buttons: [{ label: 'Cancel', onclick: () => { done = true; res(null); } }, { label: 'OK', primary: true, onclick: () => { done = true; res({ w: clamp(+iw.value | 0, 1, 256), h: clamp(+ih.value | 0, 1, 256) }); } }],
      onClose: () => { if (!done) res(null); },
    });
  });
}

/* ---- form field helpers ---- */
function fNum(model, key, onchange, attrs) {
  return h('input', Object.assign({
    type: 'number', value: model[key] == null ? '' : model[key], step: 'any', class: 'num',
    oninput: (e) => { const v = e.target.value; model[key] = v === '' ? '' : Number(v); if (onchange) onchange(); },
  }, attrs || {}));
}
function fText(model, key, onchange, attrs) {
  return h('input', Object.assign({
    type: 'text', value: model[key] || '', oninput: (e) => { model[key] = e.target.value; if (onchange) onchange(); },
  }, attrs || {}));
}
function fCheck(model, key, onchange, label) {
  return h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !!model[key], onchange: (e) => { model[key] = e.target.checked; if (onchange) onchange(); } }), label || '');
}
function fSelect(model, key, options, onchange, attrs) {
  const sel = h('select', Object.assign({
    onchange: (e) => { model[key] = e.target.value; if (onchange) onchange(); },
  }, attrs || {}), options.map((o) => {
    const v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o;
    return h('option', { value: v, selected: String(model[key]) === String(v) }, l);
  }));
  sel.value = model[key] == null ? '' : model[key];
  return sel;
}
function fColor(model, key, onchange) {
  return h('input', { type: 'color', value: model[key] || '#000000', oninput: (e) => { model[key] = e.target.value; if (onchange) onchange(); } });
}
function fRange(model, key, min, max, step, onchange) {
  const out = h('span', { class: 'muted' }, String(model[key]));
  const r = h('input', { type: 'range', min, max, step, value: model[key], oninput: (e) => { model[key] = Number(e.target.value); out.textContent = e.target.value; if (onchange) onchange(); } });
  return h('span', { class: 'range' }, r, out);
}
function field(label, ...ctrl) { return h('div', { class: 'field' }, h('label', { class: 'lbl' }, label), h('div', { class: 'ctrl' }, ctrl)); }

/* ---- file helpers ---- */
function download(name, data, mime) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'application/octet-stream' });
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function pickFile(accept, multiple) {
  return new Promise((res) => {
    const inp = h('input', { type: 'file', accept: accept || '', multiple: !!multiple, style: { display: 'none' } });
    inp.addEventListener('change', () => res(Array.from(inp.files)));
    document.body.append(inp); inp.click(); setTimeout(() => inp.remove(), 60000);
  });
}
const readAsDataURL = (f) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
const readAsText = (f) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsText(f); });
const loadImage = (src) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
