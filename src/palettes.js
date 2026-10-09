/* 2plat: color palettes for the sprite editor.
   2PL-32  the default palette (always there).
   HLW-5   Halloween Event palette. Limited time: it disappears at the end of October 31, 2026
           (the end date lives in events.js), and the editor goes back to 2PL-32.
   The chosen palette is an editor preference (saved on this computer), not part of a project. */
(function (root) {
  'use strict';
  const KEY = '2plat.palette';

  const PL32 = ['#000000', '#1a1c2c', '#5d275d', '#b13e53', '#ef7d57', '#ffcd75', '#a7f070', '#38b764',
    '#257179', '#29366f', '#3b5dc9', '#41a6f6', '#73eff7', '#f4f4f4', '#94b0c2', '#566c86',
    '#333c57', '#8b5a2b', '#a5703b', '#5c3a1e', '#ffffff', '#ff0044', '#ff8800', '#ffee00',
    '#00cc44', '#00bbff', '#8844ff', '#ff44cc', '#aa7744', '#445566', '#99aabb', '#ddeeff'];

  function read() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function write(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* not saved: still works this session */ } }

  const ALL = [
    { id: 'pl32', name: '2PL-32', note: 'Default palette', colors: PL32 },
    {
      id: 'hlw5', name: 'HLW-5', note: 'Halloween Event, until October 31',
      colors: root.Plat2Events ? root.Plat2Events.palette.map((p) => p[1]) : ['#a134eb', '#eb6e34', '#ffffff', '#00ff8c', '#0015ff'],
      limited: true,
    },
  ];

  const Palettes = {
    /** Palettes that can be used right now (limited ones drop out after their end date). */
    list(now) { return ALL.filter((p) => !p.limited || (root.Plat2Events ? root.Plat2Events.available(now) : false)); },
    /** The selected palette, or the default if the saved one is gone. */
    current(now) { const list = Palettes.list(now); return list.find((p) => p.id === read()) || list[0]; },
    set(id, now) { const p = Palettes.list(now).find((x) => x.id === id); if (p) write(p.id); return Palettes.current(now); },

    /** The "Palettes" menu: one card per palette, name on top, its colors along the bottom. */
    openMenu(onChange) {
      const cur = Palettes.current();
      const cards = Palettes.list().map((p) => h('button', {
        class: 'pal-card' + (p.id === cur.id ? ' sel' : ''), type: 'button', title: 'Use ' + p.name,
        onclick: () => { Palettes.set(p.id); m.close(); if (onChange) onChange(Palettes.current()); toast('Palette: ' + p.name, 'ok'); },
      },
        h('div', { class: 'pal-top' }, h('b', null, p.name), p.id === cur.id ? h('span', { class: 'pal-use' }, 'in use') : null),
        h('div', { class: 'pal-note' }, p.colors.length + ' colors. ' + p.note),
        h('div', { class: 'pal-strip' }, p.colors.map((c) => h('i', { style: { background: c }, title: c })))));
      const m = modal({ title: 'Palettes', width: 460, body: h('div', { class: 'pal-cards' }, ...cards), buttons: [{ label: 'Close' }] });
    },
  };

  root.Plat2Palettes = Palettes;
})(window);
