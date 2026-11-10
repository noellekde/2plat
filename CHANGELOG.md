# Changelog

Each release section starts with `## <version>`. The release workflow copies the
section matching the tag into the GitHub Release notes, so write it before tagging.

## 0.2.0

**A complete overhaul of how 2plat looks and feels.**

Editor
- New "modern pro tool" look: neutral dark workspace, one gold accent, a crisp icon set instead of emoji, better spacing, smooth transitions, toasts and dialogs.
- Redesigned top bar, side rail (keys 1-6 jump between tabs), status bar and template picker with previews.
- First-run tour, also under Help > Take the tour.
- Palettes: added NITE-16 and POP-16 next to 2PL-32.
- Levels have a Backdrop (hills, city, night sky, cave) and Lighting (vignette, torch light).
- The Halloween Event ended and has been removed (its theme, HLW-5 palette and Settings switch are gone).

Games
- Pixel-font title, pause, win and game-over screens with menus (keyboard or mouse), best score saving and a pause when the window loses focus.
- Level intro banner, iris transitions between levels, hearts and score HUD with a pop on pickup.
- Game feel: squash and stretch, dust, landing and double-jump rings, hit-stop and screen shake on hits, floatier jump peak, camera look-ahead, bobbing pickups, richer particles.
- Sky Hopper and Gem Dungeon: outlined sprites, parallax scenery, torch-lit dungeon.
- Old .2plat projects open as before.

## 0.1.2

**Did you feel that? There's a new palette!**

- **Palettes** button in the top bar: pick the color palette the sprite editor uses. 2PL-32 is the default. **HLW-5** (the five Halloween colors) is only here for a limited time.
- Yet again, this is time sensitive: HLW-5 and the Halloween Event theme both disappear at **12:00 AM on November 1st, 2026** (your computer's local time).

## 0.1.1

- **Halloween Event** (limited time): a purple, orange, neon green and blue look for the editor. Turn it on in Settings under "Halloween Event". It switches off for good after October 31, 2026.

## 0.1.0

First public release.

- Editor: sprite/tile pixel editor, object and visual rule editor, level editor, sound designer, music piano roll, settings and variables.
- Templates: **Blank** (start from scratch), Platformer "Sky Hopper", Top-down "Gem Dungeon".
- Playtest in the editor (F5) and export to a single self-contained HTML game.
- Command line (`2plat-cli.cmd` / `cli/2plat.js`): `new`, `push-png` (PNG only), `push-code`, `sprites`, `export-png`, `rm-sprite`, `export`, and `play` to open a game in the browser without the editor.
