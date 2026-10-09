/* 2plat editor: shared UI helpers and global App object. */
'use strict';

// replaceChildren(null) would insert the text "null"; drop empty entries instead
(function () {
  const orig = Element.prototype.replaceChildren;
  Element.prototype.replaceChildren = function (...kids) { return orig.apply(this, kids.flat(Infinity).filter((k) => k != null && k !== false)); };
})();

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
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
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
  const t = h('div', { class: 'toast ' + (kind || '') }, msg);
  host.append(t);
  setTimeout(() => t.classList.add('out'), 2600);
  setTimeout(() => t.remove(), 3100);
}

/* ---- modal dialogs (Electron has no window.prompt) ---- */
function modal(opts) {
  const back = h('div', { class: 'modal-back' });
  const box = h('div', { class: 'modal', style: opts.width ? { width: opts.width + 'px' } : null });
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey, true); if (opts.onClose) opts.onClose(); };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', onKey, true);
  box.append(h('div', { class: 'modal-title' }, opts.title || ''));
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
