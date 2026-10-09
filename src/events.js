/* 2plat: limited-time events.
   Halloween Event: a purple / orange / neon green / blue editor theme.
   It can be switched on in Settings until the end of October 31, 2026. After that it is
   hidden and switched off for good, whatever was saved. The check uses the computer's
   clock, which is as strong as an offline app can make it. */
(function (root) {
  'use strict';
  const END = new Date(2026, 10, 1, 0, 0, 0); // local midnight starting Nov 1 = end of Oct 31
  const KEY = '2plat.halloween';        // 'on' | 'off'
  const SEEN = '2plat.halloween.seen';  // the one-time "event is live" note was shown
  const PALETTE = [['Purple', '#a134eb'], ['Orange', '#eb6e34'], ['White', '#ffffff'], ['Neon green', '#00ff8c'], ['Blue', '#0015ff']];

  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function write(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked: the switch just won't persist */ } }

  const Events = {
    palette: PALETTE,
    endsOn: END,
    /** Is the event still running? */
    available(now) { return (now || new Date()) < END; },
    /** Is the theme switched on (and the event still running)? */
    enabled(now) { return Events.available(now) && read(KEY) === 'on'; },
    /** Whole days left, counting today. */
    daysLeft(now) { return Math.max(0, Math.ceil((END - (now || new Date())) / 86400000)); },
    daysLabel(now) { const d = Events.daysLeft(now); return d <= 1 ? 'last day' : d + ' days left'; },
    set(on) { write(KEY, on ? 'on' : 'off'); Events.apply(); },
    /** Put the theme on, or take it off, according to the saved switch and the date. */
    apply(now) {
      const el = document.documentElement;
      if (Events.enabled(now)) el.setAttribute('data-theme', 'halloween'); else el.removeAttribute('data-theme');
    },
    /** Show a one-time note that the event is live. */
    announce(toast, now) {
      if (!Events.available(now) || read(SEEN)) return;
      write(SEEN, '1');
      toast('Halloween Event is live until Oct 31. Turn it on in Settings.', 'ok');
    },
  };

  root.Plat2Events = Events;
  Events.apply(); // runs before the editor is built, so there is no flash of the normal colors
})(window);
