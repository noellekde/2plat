#!/usr/bin/env node
/* 2plat CLI — work with 2plat projects without opening the editor.
   No dependencies; needs Node 16+ (or run through 2plat.exe via 2plat-cli.cmd). */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { spawn } = require('child_process');

const VERSION = (() => { try { return require('../package.json').version; } catch (e) { return 'dev'; } })();
const MAX_SPRITE = 512;

/* ------------------------------------------------------------------ errors / output */
class CliError extends Error {}
const fail = (msg) => { throw new CliError(msg); };
const out = (s) => process.stdout.write(s + '\n');
process.stdout.on('error', (e) => { if (e.code === 'EPIPE') process.exit(0); throw e; }); // e.g. `2plat sprites p | head`
const kb = (n) => (n / 1024).toFixed(1) + ' KB';

/* ------------------------------------------------------------------ PNG (decode + encode, no deps) */
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

function readChunks(buf, label) {
  if (buf.length < 33 || !buf.subarray(0, 8).equals(PNG_SIG)) fail(label + ' is not a PNG file (only .png images are supported)');
  const chunks = []; let p = 8;
  while (p + 8 <= buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('latin1', p + 4, p + 8);
    if (p + 12 + len > buf.length) fail(label + ' is truncated or corrupt');
    chunks.push({ type, data: buf.subarray(p + 8, p + 8 + len) });
    p += 12 + len;
    if (type === 'IEND') break;
  }
  if (!chunks.length || chunks[0].type !== 'IHDR') fail(label + ' is missing its PNG header');
  return chunks;
}
function pngInfo(buf, label) {
  const ih = readChunks(buf, label)[0].data;
  return { width: ih.readUInt32BE(0), height: ih.readUInt32BE(4), depth: ih[8], colorType: ih[9], interlace: ih[12] };
}
function decodePng(buf, label) {
  const chunks = readChunks(buf, label);
  const ih = chunks[0].data;
  const w = ih.readUInt32BE(0), h = ih.readUInt32BE(4), depth = ih[8], ct = ih[9], interlace = ih[12];
  if (interlace) fail(label + ' is interlaced; re-save it as a non-interlaced PNG to slice it into frames');
  const chan = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ct];
  if (!chan || ![1, 2, 4, 8, 16].includes(depth)) fail(label + ' uses an unsupported PNG format');
  const plte = chunks.find((c) => c.type === 'PLTE'), trns = chunks.find((c) => c.type === 'tRNS');
  const idat = Buffer.concat(chunks.filter((c) => c.type === 'IDAT').map((c) => c.data));
  let raw;
  try { raw = zlib.inflateSync(idat); } catch (e) { fail(label + ' has corrupt image data'); }
  const bpp = Math.max(1, (chan * depth) >> 3), stride = Math.ceil((w * chan * depth) / 8);
  if (raw.length < (stride + 1) * h) fail(label + ' has too little image data');
  const px = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[dst + x - bpp] : 0, b = y ? px[dst - stride + x] : 0, c = x >= bpp && y ? px[dst - stride + x - bpp] : 0;
      let v = raw[src + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      else if (f !== 0) fail(label + ' has a bad filter byte');
      px[dst + x] = v & 255;
    }
  }
  const rgba = Buffer.alloc(w * h * 4);
  const sample = (row, i) => { // i-th sample in a row, scaled to raw depth value
    if (depth === 8) return px[row + i];
    if (depth === 16) return (px[row + i * 2] << 8) | px[row + i * 2 + 1];
    const per = 8 / depth, byte = px[row + Math.floor(i / per)], shift = 8 - depth * ((i % per) + 1);
    return (byte >> shift) & ((1 << depth) - 1);
  };
  const to8 = (v) => (depth === 16 ? v >> 8 : depth === 8 ? v : Math.round((v * 255) / ((1 << depth) - 1)));
  const key = trns && (ct === 0 || ct === 2) ? (ct === 0 ? [trns.data.readUInt16BE(0)] : [trns.data.readUInt16BE(0), trns.data.readUInt16BE(2), trns.data.readUInt16BE(4)]) : null;
  for (let y = 0; y < h; y++) {
    const row = y * stride;
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4; let r, g, b, a = 255;
      if (ct === 0) { const s = sample(row, x); r = g = b = to8(s); if (key && s === key[0]) a = 0; }
      else if (ct === 2) { const s0 = sample(row, x * 3), s1 = sample(row, x * 3 + 1), s2 = sample(row, x * 3 + 2); r = to8(s0); g = to8(s1); b = to8(s2); if (key && s0 === key[0] && s1 === key[1] && s2 === key[2]) a = 0; }
      else if (ct === 3) {
        const i = sample(row, x); if (!plte || i * 3 + 2 >= plte.data.length) fail(label + ' has a bad palette');
        r = plte.data[i * 3]; g = plte.data[i * 3 + 1]; b = plte.data[i * 3 + 2]; if (trns && i < trns.data.length) a = trns.data[i];
      } else if (ct === 4) { r = g = b = to8(sample(row, x * 2)); a = to8(sample(row, x * 2 + 1)); }
      else { r = to8(sample(row, x * 4)); g = to8(sample(row, x * 4 + 1)); b = to8(sample(row, x * 4 + 2)); a = to8(sample(row, x * 4 + 3)); }
      rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b; rgba[o + 3] = a;
    }
  }
  return { width: w, height: h, rgba };
}
function encodePng(width, height, rgba) {
  const stride = width * 4, raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) { raw[y * (stride + 1)] = 0; rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride); }
  const chunk = (type, data) => {
    const t = Buffer.from(type, 'latin1'), len = Buffer.alloc(4), crc = Buffer.alloc(4);
    len.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([PNG_SIG, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
const toDataUrl = (png) => 'data:image/png;base64,' + png.toString('base64');
function fromDataUrl(url, label) {
  const m = /^data:image\/png;base64,(.+)$/.exec(url || '');
  if (!m) fail(label + ' is not stored as a PNG');
  return Buffer.from(m[1], 'base64');
}
function sliceFrames(img, n, label) {
  if (img.width % n) fail(label + ' is ' + img.width + 'px wide, which does not divide evenly into ' + n + ' frames');
  const fw = img.width / n, frames = [];
  for (let i = 0; i < n; i++) {
    const buf = Buffer.alloc(fw * img.height * 4);
    for (let y = 0; y < img.height; y++) img.rgba.copy(buf, y * fw * 4, (y * img.width + i * fw) * 4, (y * img.width + (i + 1) * fw) * 4);
    frames.push(encodePng(fw, img.height, buf));
  }
  return { fw, frames };
}

/* ------------------------------------------------------------------ pixel-code sprites */
const DEFAULT_PALETTE = {
  a: '#1a1c2c', b: '#5d275d', c: '#b13e53', d: '#ef7d57', e: '#ffcd75', f: '#a7f070', g: '#38b764', h: '#257179', i: '#29366f',
  j: '#3b5dc9', k: '#41a6f6', l: '#73eff7', m: '#f4f4f4', n: '#94b0c2', o: '#566c86', p: '#333c57', q: '#8b5a2b', r: '#a5703b', s: '#5c3a1e',
};
function hexToRgba(hex, where) {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{8}|[0-9a-f]{3})$/i.exec(hex);
  if (!m) fail(where + ': "' + hex + '" is not a color (use #rrggbb)');
  let h = m[1]; if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length === 8 ? parseInt(h.slice(6, 8), 16) : 255];
}
/* Format:
     @name hero          (optional)   @fps 8 (optional)
     @palette x=#ff0000 y=#00ff00     (optional; letters a-s are predefined)
     rows of characters; '.' or space = transparent
     a line with --- (or a blank line) starts the next animation frame
     lines starting with # or // are comments */
function parsePixelCode(text) {
  const meta = {}, palette = Object.assign({}, DEFAULT_PALETTE), frames = [[]];
  text.replace(/^﻿/, '').split(/\r?\n/).forEach((line, idx) => {
    const ln = idx + 1, t = line.trim();
    if (t.startsWith('#') || t.startsWith('//')) return;
    if (t.startsWith('@')) {
      const [key, ...rest] = t.slice(1).split(/\s+/);
      if (key === 'name') meta.name = rest.join(' ');
      else if (key === 'fps') { meta.fps = Number(rest[0]); if (!(meta.fps >= 1 && meta.fps <= 60)) fail('line ' + ln + ': @fps must be 1-60'); }
      else if (key === 'palette') rest.forEach((pair) => { const m = /^(.)=(.+)$/.exec(pair); if (!m) fail('line ' + ln + ': bad palette entry "' + pair + '" (use x=#rrggbb)'); palette[m[1]] = m[2]; });
      else fail('line ' + ln + ': unknown directive @' + key);
      return;
    }
    if (t === '---' || t === '') { if (frames[frames.length - 1].length) frames.push([]); return; }
    frames[frames.length - 1].push({ text: line.replace(/\s+$/, ''), ln });
  });
  while (frames.length && !frames[frames.length - 1].length) frames.pop();
  if (!frames.length) fail('no pixel rows found in the sprite code');
  const width = Math.max(...frames.flat().map((r) => r.text.length)), height = frames[0].length;
  if (width > MAX_SPRITE || height > MAX_SPRITE) fail('sprite is larger than ' + MAX_SPRITE + 'px');
  const cols = {};
  const colorOf = (ch, ln) => {
    if (ch === '.' || ch === ' ') return null;
    if (!(ch in palette)) fail('line ' + ln + ': character "' + ch + '" is not in the palette (define it with @palette ' + ch + '=#rrggbb)');
    return cols[ch] || (cols[ch] = hexToRgba(palette[ch], 'palette ' + ch));
  };
  const pngs = frames.map((rows, fi) => {
    if (rows.length !== height) fail('frame ' + (fi + 1) + ' has ' + rows.length + ' rows but frame 1 has ' + height);
    const buf = Buffer.alloc(width * height * 4);
    rows.forEach((r, y) => { for (let x = 0; x < width; x++) { const c = colorOf(r.text[x] || '.', r.ln); if (c) { const o = (y * width + x) * 4; buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2]; buf[o + 3] = c[3]; } } });
    return encodePng(width, height, buf);
  });
  return { meta, width, height, pngs };
}

/* ------------------------------------------------------------------ project files */
function resolveProject(p) {
  if (!p) fail('missing project file (try: 2plat help)');
  if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  if (fs.existsSync(p + '.2plat')) return p + '.2plat';
  fail('project file not found: ' + p);
}
function loadProject(file) {
  let p;
  try { p = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { fail(path.basename(file) + ' is not a valid 2plat project (' + e.message + ')'); }
  if (!p || typeof p !== 'object' || !Array.isArray(p.levels) || !p.settings) fail(path.basename(file) + ' is not a 2plat project');
  ['sprites', 'objects', 'sounds', 'music'].forEach((k) => { if (!Array.isArray(p[k])) p[k] = []; });
  return p;
}
function saveProject(file, p) {
  const tmp = file + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(p), 'utf8');
  fs.renameSync(tmp, file);
}
const uid = (pre) => pre + '_' + crypto.randomBytes(4).toString('hex').slice(0, 6);
function newProject(name, opts) {
  const w = opts.w || 320, h = opts.h || 180;
  return {
    format: '2plat', version: 1, name,
    settings: { title: name, width: w, height: h, tileSize: opts.tile || 16, gravity: 900, bg: '#1a1c2c', pixelArt: true, startLevel: 0, music: '', hud: [], vars: [] },
    sprites: [], objects: [], sounds: [], music: [],
    levels: [{ id: 'lv1', name: 'Level 1', w: 50, h: 12, bg: '#41a6f6', bg2: '#a7f070', music: '', instances: [] }],
  };
}
function cleanName(s) { return String(s).replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '') || 'sprite'; }
function addSprite(proj, name, w, h, fps, framePngs, replace) {
  const existing = proj.sprites.find((s) => s.name === name);
  if (existing && !replace) fail('a sprite named "' + name + '" already exists (use --replace to overwrite it)');
  const sprite = { id: existing ? existing.id : uid('sp'), name, w, h, fps, frames: framePngs.map(toDataUrl) };
  if (existing) Object.assign(existing, sprite); else proj.sprites.push(sprite);
  return { sprite, replaced: !!existing };
}

/* ------------------------------------------------------------------ playing / exporting */
function buildHtml(proj) {
  const src = path.join(__dirname, '..', 'src');
  const runtime = fs.readFileSync(path.join(src, 'runtime.js'), 'utf8');
  return require(path.join(src, 'exporter.js')).buildHtml(proj, runtime);
}
function openInBrowser(target) {
  let cmd, args;
  if (process.platform === 'win32') { cmd = 'cmd'; args = ['/c', 'start', '""', target]; }
  else if (process.platform === 'darwin') { cmd = 'open'; args = [target]; }
  else { cmd = 'xdg-open'; args = [target]; }
  return new Promise((resolve) => {
    let done = false; const finish = (ok) => { if (!done) { done = true; resolve(ok); } };
    try {
      const c = spawn(cmd, args, { detached: true, stdio: 'ignore', windowsVerbatimArguments: process.platform === 'win32' });
      c.on('error', () => finish(false)); c.on('spawn', () => { c.unref(); setTimeout(() => finish(true), 150); });
    } catch (e) { finish(false); }
  });
}

/* ------------------------------------------------------------------ argument parsing */
function parseArgs(argv, spec) {
  const flags = {}, pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') { pos.push(...argv.slice(i + 1)); break; }
    if (a.startsWith('--')) {
      const eq = a.indexOf('='), key = a.slice(2, eq < 0 ? undefined : eq);
      if (!(key in spec)) fail('unknown option --' + key);
      if (spec[key] === 'bool') flags[key] = true;
      else { const v = eq >= 0 ? a.slice(eq + 1) : argv[++i]; if (v === undefined) fail('--' + key + ' needs a value'); flags[key] = v; }
    } else pos.push(a);
  }
  return { flags, pos };
}
function intFlag(flags, key, min, max) {
  if (flags[key] === undefined) return undefined;
  const n = Number(flags[key]);
  if (!Number.isInteger(n) || n < min || n > max) fail('--' + key + ' must be a whole number from ' + min + ' to ' + max);
  return n;
}

/* ------------------------------------------------------------------ commands */
const HELP = `2plat ${VERSION} — command-line tool for 2plat game projects

USAGE
  2plat <command> [options]

COMMANDS
  new <name|file> [--size WxH] [--tile N]     Create a blank project (<name>.2plat)
  info <project>                              Show what's in a project
  sprites <project>                           List sprites
  push-png <project> <file.png...>            Add PNG images as sprites
        [--name N] [--frames N] [--fps N] [--replace]
        --frames N slices a horizontal sprite sheet into N animation frames.
  push-code <project> <file|->                Add a sprite written as pixel code
        [--code "rows"] [--name N] [--fps N] [--replace]
        Reads a text file (or stdin with "-", or --code). See PIXEL CODE.
  rm-sprite <project> <name>                  Remove a sprite
  export-png <project> <sprite> [out.png]     Save a sprite's frames as a PNG strip
  play <project|game.html> [--no-open]        Open the game in your browser (no editor needed)
        [--out file.html]                     Aliases: open, run
  export <project> [out.html]                 Write a standalone HTML game
  version | help

PIXEL CODE (for push-code)
  @name hero            optional sprite name (otherwise the file name)
  @fps 8                optional animation speed
  @palette x=#ff8800    optional extra colors; letters a-s are built in
  ..aabbaa..            one text row per pixel row; "." is transparent
  ---                   starts the next animation frame
  Built-in colors: a=#1a1c2c b=#5d275d c=#b13e53 d=#ef7d57 e=#ffcd75 f=#a7f070 g=#38b764
                   h=#257179 i=#29366f j=#3b5dc9 k=#41a6f6 l=#73eff7 m=#f4f4f4 n=#94b0c2
                   o=#566c86 p=#333c57 q=#8b5a2b r=#a5703b s=#5c3a1e

EXAMPLES
  2plat new mygame
  2plat push-png mygame.2plat hero.png --frames 4 --fps 10
  2plat push-code mygame.2plat coin.txt
  2plat play mygame.2plat
`;

async function main(argv) {
  const cmd = (argv[0] || 'help').toLowerCase(), rest = argv.slice(1);
  switch (cmd) {
    case 'help': case '--help': case '-h': out(HELP); return;
    case 'version': case '--version': case '-v': out(VERSION); return;

    case 'new': {
      const { flags, pos } = parseArgs(rest, { size: 'val', tile: 'val', force: 'bool' });
      if (!pos[0]) fail('usage: 2plat new <name|file> [--size WxH] [--tile N]');
      const file = /\.2plat$/i.test(pos[0]) ? pos[0] : pos[0] + '.2plat';
      let w, h;
      if (flags.size) { const m = /^(\d+)x(\d+)$/i.exec(flags.size); if (!m) fail('--size must look like 320x180'); w = +m[1]; h = +m[2]; if (w < 64 || h < 64 || w > 1920 || h > 1080) fail('--size must be between 64x64 and 1920x1080'); }
      const tile = intFlag(flags, 'tile', 4, 64);
      if (fs.existsSync(file) && !flags.force) fail(file + ' already exists (use --force to overwrite)');
      saveProject(file, newProject(cleanName(path.basename(file)), { w, h, tile }));
      out('Created ' + file + ' (blank project)');
      return;
    }

    case 'info': case 'sprites': {
      const { pos } = parseArgs(rest, {});
      const file = resolveProject(pos[0]), p = loadProject(file);
      if (cmd === 'sprites') {
        if (!p.sprites.length) { out('(no sprites)'); return; }
        const w = Math.max(4, ...p.sprites.map((s) => s.name.length));
        out('NAME'.padEnd(w + 2) + 'SIZE'.padEnd(10) + 'FRAMES  FPS  BYTES');
        p.sprites.forEach((s) => out(s.name.padEnd(w + 2) + (s.w + 'x' + s.h).padEnd(10) + String(s.frames.length).padEnd(8) + String(s.fps).padEnd(5) + s.frames.reduce((n, f) => n + f.length, 0)));
        return;
      }
      const S = p.settings;
      out(p.name + '  (' + file + ')');
      out('  screen     ' + S.width + 'x' + S.height + '  tile ' + S.tileSize + 'px  gravity ' + S.gravity);
      out('  sprites    ' + p.sprites.length); out('  objects    ' + p.objects.length);
      out('  levels     ' + p.levels.length + (p.levels.length ? '  (' + p.levels.map((l) => l.name).join(', ') + ')' : ''));
      out('  sounds     ' + p.sounds.length); out('  music      ' + p.music.length);
      out('  file size  ' + kb(fs.statSync(file).size));
      return;
    }

    case 'push-png': {
      const { flags, pos } = parseArgs(rest, { name: 'val', frames: 'val', fps: 'val', replace: 'bool' });
      if (pos.length < 2) fail('usage: 2plat push-png <project> <file.png...> [--name N] [--frames N] [--fps N] [--replace]');
      const file = resolveProject(pos[0]), p = loadProject(file), files = pos.slice(1);
      if (flags.name && files.length > 1) fail('--name only works with a single PNG');
      const frames = intFlag(flags, 'frames', 1, 64) || 1, fps = intFlag(flags, 'fps', 1, 60) || (frames > 1 ? 8 : 6);
      const results = [];
      for (const f of files) {
        if (!fs.existsSync(f)) fail('file not found: ' + f);
        if (path.extname(f).toLowerCase() !== '.png') fail(path.basename(f) + ' is not a .png (only PNG images can be pushed)');
        const buf = fs.readFileSync(f), label = path.basename(f), info = pngInfo(buf, label);
        if (info.width > MAX_SPRITE * frames || info.height > MAX_SPRITE) fail(label + ' is too large (max ' + MAX_SPRITE + 'px per frame)');
        let w, h, pngs;
        if (frames === 1) { w = info.width; h = info.height; pngs = [buf]; }
        else { const sl = sliceFrames(decodePng(buf, label), frames, label); w = sl.fw; h = info.height; pngs = sl.frames; }
        results.push(addSprite(p, flags.name || cleanName(f), w, h, fps, pngs, !!flags.replace));
      }
      saveProject(file, p);
      results.forEach((r) => out((r.replaced ? 'Replaced ' : 'Added ') + 'sprite "' + r.sprite.name + '" (' + r.sprite.w + 'x' + r.sprite.h + ', ' + r.sprite.frames.length + ' frame' + (r.sprite.frames.length > 1 ? 's' : '') + ')'));
      return;
    }

    case 'push-code': {
      const { flags, pos } = parseArgs(rest, { code: 'val', name: 'val', fps: 'val', replace: 'bool' });
      if (!pos[0]) fail('usage: 2plat push-code <project> <file|-> [--code "rows"] [--name N] [--fps N] [--replace]');
      const file = resolveProject(pos[0]), p = loadProject(file);
      let text, defName = 'sprite';
      if (flags.code !== undefined) text = flags.code.replace(/\\n/g, '\n');
      else if (pos[1] === '-') text = fs.readFileSync(0, 'utf8');
      else if (pos[1]) { if (!fs.existsSync(pos[1])) fail('file not found: ' + pos[1]); text = fs.readFileSync(pos[1], 'utf8'); defName = cleanName(pos[1]); }
      else fail('give a sprite code file, "-" for stdin, or --code "rows"');
      const code = parsePixelCode(text);
      const name = flags.name || code.meta.name || defName, fps = intFlag(flags, 'fps', 1, 60) || code.meta.fps || (code.pngs.length > 1 ? 8 : 6);
      const r = addSprite(p, cleanName(name), code.width, code.height, fps, code.pngs, !!flags.replace);
      saveProject(file, p);
      out((r.replaced ? 'Replaced ' : 'Added ') + 'sprite "' + r.sprite.name + '" (' + code.width + 'x' + code.height + ', ' + code.pngs.length + ' frame' + (code.pngs.length > 1 ? 's' : '') + ')');
      return;
    }

    case 'rm-sprite': {
      const { pos } = parseArgs(rest, {});
      if (pos.length < 2) fail('usage: 2plat rm-sprite <project> <name>');
      const file = resolveProject(pos[0]), p = loadProject(file), s = p.sprites.find((x) => x.name === pos[1]);
      if (!s) fail('no sprite named "' + pos[1] + '" (see: 2plat sprites ' + pos[0] + ')');
      p.sprites = p.sprites.filter((x) => x !== s);
      p.objects.forEach((o) => ['spriteId', 'runSpriteId', 'jumpSpriteId'].forEach((k) => { if (o[k] === s.id) o[k] = ''; }));
      saveProject(file, p); out('Removed sprite "' + s.name + '"');
      return;
    }

    case 'export-png': {
      const { pos } = parseArgs(rest, {});
      if (pos.length < 2) fail('usage: 2plat export-png <project> <sprite> [out.png]');
      const p = loadProject(resolveProject(pos[0])), s = p.sprites.find((x) => x.name === pos[1]);
      if (!s) fail('no sprite named "' + pos[1] + '"');
      const dest = pos[2] || s.name + '.png';
      let png;
      if (s.frames.length === 1) png = fromDataUrl(s.frames[0], s.name);
      else {
        const strip = Buffer.alloc(s.w * s.frames.length * s.h * 4);
        s.frames.forEach((f, i) => {
          const im = decodePng(fromDataUrl(f, s.name), s.name);
          for (let y = 0; y < s.h; y++) im.rgba.copy(strip, (y * s.w * s.frames.length + i * s.w) * 4, y * im.width * 4, y * im.width * 4 + s.w * 4);
        });
        png = encodePng(s.w * s.frames.length, s.h, strip);
      }
      fs.writeFileSync(dest, png); out('Wrote ' + dest + ' (' + s.frames.length + ' frame' + (s.frames.length > 1 ? 's' : '') + ')');
      return;
    }

    case 'export': {
      const { pos } = parseArgs(rest, {});
      const file = resolveProject(pos[0]), p = loadProject(file);
      const dest = pos[1] || cleanName(path.basename(file)) + '.html';
      fs.writeFileSync(dest, buildHtml(p)); out('Wrote ' + dest + ' — a standalone game, open it in any browser (' + kb(fs.statSync(dest).size) + ')');
      return;
    }

    case 'play': case 'open': case 'run': {
      const { flags, pos } = parseArgs(rest, { 'no-open': 'bool', out: 'val' });
      if (!pos[0]) fail('usage: 2plat play <project|game.html> [--no-open] [--out file.html]');
      let target;
      if (/\.html?$/i.test(pos[0]) && fs.existsSync(pos[0])) target = path.resolve(pos[0]);
      else {
        const file = resolveProject(pos[0]), p = loadProject(file);
        if (!p.levels.length) fail('this project has no levels');
        const html = buildHtml(p);
        if (flags.out) target = path.resolve(flags.out);
        else {
          const dir = path.join(os.tmpdir(), '2plat'); fs.mkdirSync(dir, { recursive: true });
          target = path.join(dir, cleanName(path.basename(file)) + '-' + crypto.createHash('sha1').update(html).digest('hex').slice(0, 8) + '.html');
        }
        fs.writeFileSync(target, html);
      }
      if (flags['no-open']) { out(target); return; }
      const ok = await openInBrowser(target);
      out(ok ? 'Opened ' + target + ' in your browser' : 'Could not launch a browser automatically. Open this file yourself:\n  ' + target);
      return;
    }

    default: fail('unknown command "' + cmd + '". Run "2plat help" for the list of commands.');
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((e) => {
    if (e instanceof CliError) { process.stderr.write('2plat: ' + e.message + '\n'); process.exit(1); }
    process.stderr.write('2plat: unexpected error: ' + (e && e.stack || e) + '\n'); process.exit(2);
  });
}
module.exports = { decodePng, encodePng, parsePixelCode, pngInfo };
