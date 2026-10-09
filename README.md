# 2plat — make 2D games easily

A desktop game maker: pixel-art sprite editor, tile/level editor, visual logic rules, sound + music tools,
instant playtest, and one-click export of a standalone HTML game.

## Run it (Windows)
Run `build-exe.bat` (downloads Electron and assembles `2plat-win32-x64\2plat.exe`), or `npm install && npm start`.

## What's inside
- **Sprites** — pencil/eraser/fill/line/rect/ellipse/picker, mirror drawing, animation frames + onion skin, flip/rotate/shift, PNG import (sprite sheets) and export, undo/redo.
- **Objects** — behaviors (platformer & top-down player, patrol, chaser, bouncer, turret, projectile, moving platform), hitboxes, solid/one-way blocks, and **logic rules**: *when X happens → do these actions* (change variables, spawn/destroy, sounds, music, level changes, checkpoints, screen shake, floating text, win/game over...).
- **Levels** — paint/rect/line/erase/select/copy-paste, pan + zoom, snap modes, hitbox and game-screen overlays, gradient sky, per-level music, undo/redo, playtest from here.
- **Sounds** — retro synth with pitch slide, vibrato, noise; one-click generators (pickup, laser, explosion, jump, hit, powerup).
- **Music** — 3+ track piano roll with scales, tempo, random melody, live playback.
- **Settings** — resolution, tile size, gravity, variables + HUD, start level.
- **Templates** — **Blank** (completely empty, build everything yourself), Platformer (3 levels), Top-down dungeon (2 floors).
- **Export** — a single self-contained `.html` game (keyboard + touch controls). Projects save as `.2plat` files.

## Shortcuts
Ctrl+S save · Ctrl+O open · F5 playtest · F6 playtest current level · Ctrl+Z/Y undo/redo · B/E/G/I/L/R/O tools · Space+drag pan · wheel zoom.

## Build from source
`npm install` then `npm start` to run, `npm run package:win` to build the Windows folder.
(To build without npm: unzip an official Electron Windows release, put this project in `resources/app`, rename `electron.exe` to `2plat.exe`.)

## Command line (`2plat`) — no editor needed
Works without opening the exe. After `build-exe.bat`, use `2plat-cli.cmd` in the app folder (runs on the bundled
runtime, no Node.js install needed), or `node cli/2plat.js` / `npm link` to get a global `2plat` command.

    2plat new mygame                              create a blank project (mygame.2plat)
    2plat push-png mygame hero.png --frames 4     add a PNG (or a 4-frame sprite sheet) as a sprite
    2plat push-code mygame coin.txt               add a sprite written as pixel code
    2plat sprites mygame                          list sprites
    2plat play mygame                             play the game in your browser
    2plat export mygame out.html                  standalone HTML game
    2plat info | rm-sprite | export-png | help

Only `.png` images are accepted by `push-png`. **Pixel code** is plain text: one row of characters per pixel row,
`.` is transparent, `---` starts the next animation frame, built-in color letters a-s, and `@name`, `@fps`,
`@palette x=#ff8800` lines. Example:

    @name coin
    @fps 6
    ..yy..
    .yeey.
    ---
    ..yy..
    ..ye..

## Halloween Event

Until October 31, 2026, Settings has a "Halloween Event" switch that gives the editor a purple, orange, neon green and blue look. The code is in `src/events.js` and the colors are the `data-theme='halloween'` block at the end of `src/style.css`. After the end date the switch disappears and the theme is off whatever was saved. To retire it early or for good, delete `src/events.js`, its script tag in `index.html`, the `halloween` block in `ed_settings.js`, the `announce` line in `app.js`, and the theme CSS.

## Website

The `web/` folder is the project website (one home page with a playable demo). It is plain HTML and CSS, so you can open `web/index.html` straight from disk.

- **Download button:** the page links to the `2plat-releases` repo.
- **Playable demo:** `web/play/sky-hopper.html` is the Sky Hopper template exported from the editor (New from template, Platformer, then Export game). Export it again after you change the runtime so the demo stays current.
- **Publishing:** `.github/workflows/pages.yml` deploys `web/` to GitHub Pages whenever it changes. One-time setup: Settings, Pages, Source: GitHub Actions. The site is then at `https://<username>.github.io/2plat/`.
