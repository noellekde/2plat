# Changelog

Each release section starts with `## <version>`. The release workflow copies the
section matching the tag into the GitHub Release notes, so write it before tagging.

## 0.1.2

- **Palettes** button in the top bar: pick the color palette the sprite editor uses. 2PL-32 is the default. **HLW-5** (the five Halloween colors) is there until October 31, 2026, then it disappears and the editor goes back to 2PL-32.

## 0.1.1

- **Halloween Event** (limited time): a purple, orange, neon green and blue look for the editor. Turn it on in Settings under "Halloween Event". It switches off for good after October 31, 2026.

## 0.1.0

First public release.

- Editor: sprite/tile pixel editor, object and visual rule editor, level editor, sound designer, music piano roll, settings and variables.
- Templates: **Blank** (start from scratch), Platformer "Sky Hopper", Top-down "Gem Dungeon".
- Playtest in the editor (F5) and export to a single self-contained HTML game.
- Command line (`2plat-cli.cmd` / `cli/2plat.js`): `new`, `push-png` (PNG only), `push-code`, `sprites`, `export-png`, `rm-sprite`, `export`, and `play` to open a game in the browser without the editor.
