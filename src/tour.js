/* 2plat: first-run tour. A short guided walk through the editor.
   Runs once after the first project is chosen, and again from Help > Take the tour. */
(function (root) {
  'use strict';
  const KEY = '2plat.tour';
  const STEPS = [
    { target: '#rail-sprites', tab: 'sprites', icon: 'sprites', title: 'Draw your sprites', text: 'Start here. Pixel art for your hero, enemies and tiles, with animation frames. You can also import PNGs.', side: 'right' },
    { target: '#rail-objects', tab: 'objects', icon: 'objects', title: 'Give them behavior', text: 'Objects turn sprites into things that act: players, patrolling enemies, coins. Logic rules say what happens on touch.', side: 'right' },
    { target: '#rail-levels', tab: 'levels', icon: 'levels', title: 'Build your levels', text: 'Paint objects onto the grid. Right-click erases, Space and drag pans, the wheel zooms.', side: 'right' },
    { target: '#play-btn', tab: 'levels', icon: 'play', title: 'Press Play any time', text: 'F5 plays from the start, F6 plays the level you are editing. Test early and often.', side: 'below' },
    { target: '#rail-sounds', tab: 'sounds', icon: 'sounds', title: 'Add sound and music', text: 'Design retro sound effects in one click, then write a tune on the piano roll.', side: 'right' },
    { target: '#top .btn.ghost[title^="Export"]', tab: 'settings', icon: 'export', title: 'Share it with the world', text: 'Export turns your game into a single HTML file. Send it to anyone, or put it on a website.', side: 'below' },
  ];
  let host = null, idx = 0, onKey = null;

  function seen() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
  function mark() { try { localStorage.setItem(KEY, '1'); } catch (e) { /* ignore */ } }

  function end() {
    if (host) host.remove(); host = null;
    if (onKey) { document.removeEventListener('keydown', onKey, true); onKey = null; }
    mark();
  }
  function place(shade, card, step) {
    const el = document.querySelector(step.target);
    if (!el) { card.style.left = '50%'; card.style.top = '30%'; card.style.transform = 'translateX(-50%)'; return; }
    const r = el.getBoundingClientRect(), pad = 4;
    Object.assign(shade.style, { left: (r.left - pad) + 'px', top: (r.top - pad) + 'px', width: (r.width + pad * 2) + 'px', height: (r.height + pad * 2) + 'px' });
    card.style.transform = '';
    const cw = 330, ch = card.offsetHeight || 170;
    let x, y;
    if (step.side === 'right') { x = r.right + 18; y = r.top - 6; } else { x = r.right - cw; y = r.bottom + 16; }
    x = Math.max(12, Math.min(innerWidth - cw - 12, x)); y = Math.max(12, Math.min(innerHeight - ch - 12, y));
    card.style.left = x + 'px'; card.style.top = y + 'px';
  }
  function render() {
    const step = STEPS[idx];
    if (step.tab && root.App) App.setTab(step.tab);
    host.replaceChildren();
    const shade = h('div', { class: 'shade' });
    const last = idx === STEPS.length - 1;
    const card = h('div', { class: 'card' },
      h('h3', null, ic(step.icon), step.title), h('p', null, step.text),
      h('div', { class: 'foot' },
        h('div', { class: 'dots' }, STEPS.map((_, i) => h('i', { class: i === idx ? 'on' : '' }))),
        h('button', { class: 'btn small ghost', onclick: end }, last ? '' : 'Skip'),
        idx > 0 ? h('button', { class: 'btn small', onclick: () => { idx--; render(); } }, 'Back') : null,
        h('button', { class: 'btn small primary', onclick: () => { if (last) end(); else { idx++; render(); } } }, last ? 'Start making' : 'Next')));
    host.append(shade, card);
    requestAnimationFrame(() => place(shade, card, step));
  }
  const Tour = {
    seen,
    /** Start the tour. `force` runs it even if it was seen before. */
    start(force) {
      if (host || (!force && seen())) return;
      document.querySelectorAll('.modal-back').forEach((m) => m.remove());
      idx = 0; host = h('div', { id: 'tour' }); document.body.append(host);
      onKey = (e) => {
        if (e.key === 'Escape') { e.stopPropagation(); end(); } else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.stopPropagation(); e.preventDefault(); if (idx < STEPS.length - 1) { idx++; render(); } else end(); } else if (e.key === 'ArrowLeft' && idx > 0) { e.stopPropagation(); idx--; render(); }
      };
      document.addEventListener('keydown', onKey, true);
      window.addEventListener('resize', () => { if (host) render(); });
      render();
    },
  };
  root.Plat2Tour = Tour;
})(window);
