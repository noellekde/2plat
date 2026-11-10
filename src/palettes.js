/* 2plat: color palettes for the sprite editor.
   2PL-32   the default palette.
   NITE-16  deep, moody colors for dungeons and night scenes.
   POP-16   bright, saturated colors for cheerful games.
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

  const NITE16 = ['#07060d', '#161127', '#2b1d44', '#4a2a63', '#7a3b7a', '#b0507a', '#e07a80', '#f5b49a',
    '#0f2a3a', '#14485a', '#1f7a7a', '#43b09a', '#9be0b4', '#31345c', '#5a6199', '#aab4e6'];
  const POP16 = ['#1d1a2f', '#ffffff', '#ff4d6d', '#ff8a3d', '#ffd23f', '#b6e04a', '#2ec27e', '#18c4c4',
    '#3aa0ff', '#4b5bff', '#8e5bff', '#ff6bd6', '#7a4a2b', '#d6a56a', '#5b6075', '#c9cde0'];

  const ALL = [
    { id: 'pl32', name: '2PL-32', note: 'Default palette', colors: PL32 },
    { id: 'nite16', name: 'NITE-16', note: 'Moody night and dungeon colors', colors: NITE16 },
    { id: 'pop16', name: 'POP-16', note: 'Bright and cheerful', colors: POP16 },
  ];

  const Palettes = {
    list() { return ALL.slice(); },
    /** The selected palette, or the default if the saved one is gone. */
    current() { const list = Palettes.list(); return list.find((p) => p.id === read()) || list[0]; },
    set(id) { const p = Palettes.list().find((x) => x.id === id); if (p) write(p.id); return Palettes.current(); },

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
      const m = modal({ title: 'Palettes', width: 480, body: h('div', { class: 'pal-cards' }, ...cards), buttons: [{ label: 'Close' }] });
    },
  };

  root.Plat2Palettes = Palettes;
})(window);
