# Changelog

Each release section starts with `## <version>`. The release workflow copies the
section matching the tag into the GitHub Release notes, so write it before tagging.

## 0.1.0

First public release.

- Editor: sprite/tile pixel editor, object and visual rule editor, level editor, sound designer, music piano roll, settings and variables.
- Templates: **Blank** (start from scratch), Platformer "Sky Hopper", Top-down "Gem Dungeon".
- Playtest in the editor (F5) and export to a single self-contained HTML game.
- Command line (`2plat-cli.cmd` / `cli/2plat.js`): `new`, `push-png` (PNG only), `push-code`, `sprites`, `export-png`, `rm-sprite`, `export`, and `play` to open a game in the browser without the editor.
