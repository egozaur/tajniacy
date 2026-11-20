# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language

Always respond to the user in Polish (zawsze odpowiadaj po polsku).

## Project

"Tajniacy" is a Polish-language Codenames-style party game. It is two static HTML pages plus the shared `common.css` (theme variables), `common.js` (`fitCards()`) and `net.js` (`TJNET`: connection to the shared PL3Y server), with no build step and no dependencies to install. The server side (Cloudflare Worker `pl3y-server`, Durable Objects `TjRoom` and `TjSaves`, its unit tests) lives in the `egozaur/mafia` repo under `worker/src/tajniacy/`; keep both sides of the protocol in sync. The UI text and code comments are in Polish, so keep new UI strings in Polish.

It is deployed via GitHub Pages at `https://pl3y.pl/tajniacy/`. The domain belongs to the PL3Y game lobby (repo `egozaur/egozaur.github.io`), and the old `egozaur.github.io/tajniacy/` address redirects there. There is no Node or Python on the dev machine: serve the folder with `dev/serve.ps1` (port 8090). `dev/e2e.html` is an end-to-end test against the real server (host + two captains in iframes; needs `ALLOW_LOCALHOST="true"` in the Worker); run it in real-time headless Edge with `--enable-logging=stderr` and read `E2E RESULT`. The captain QR codes always point at the hard-coded production `BASE_URL`, so changes to `captain.html` only show up on phones after they are pushed.

## Architecture

### `index.html`: host app (shown on a shared screen/TV)
- Lines ~10–2300 are a vendored copy of the `qrcode-generator` library (MIT, Kazuhiko Arase). Don't edit it. The app's CSS starts around line 2312 and the app script around line 2469.
- **Password gate**: the game has no password of its own. `<head>` loads `/auth.js` from the lobby repo, which is the shared PL3Y gate with one password for the whole domain (its contract is in that repo's CLAUDE.md). It is a lock for friends, not security. Locally the file doesn't exist (404), so the game runs without a password. `captain.html` deliberately has no gate.
- **Back to lobby**: `LOBBY_BTN` (`data-act="lobby"`) appears on the splash screen, in setup and in the board footer. It asks for confirmation through `ask()` before going to `/`. The game state lives in localStorage, so after returning the splash screen offers „Wróć do gry”.
- **Saved games**: shared for the whole PL3Y on the server (`GET /api/tj/saves`, `PUT|DELETE /api/tj/saves/:id`). `localStorage.tajniacy_saves` is the cache, entries `[{id, name, ts, game, cfg}]` (newest first, max 50); changes that could not be sent wait in `tajniacy_saves_pending` (`{put:[id], del:[id]}`) and go out via `flushSaves()`; `refreshSaves()` merges the server list when the dialog opens. `cfg` holds `SAVE_CFG`: players, names, theme, match, score and assassins. `saveGame()` tags the live game with `saveId`/`saveName`, and from then on `syncSave()` (subscribed to both store documents) keeps that save up to date after every move. `newGame()` produces a game without `saveId`, so it isn't saved until the user saves it. `savesDialog()` lists, loads and deletes saves. Loading pushes the game to the room, so captains keep their codes. `/favicon.svg` also comes from the lobby.
- **Room on the server**: `Net` / `ensureRoom()` / `connectRoom()` / `pushRoom()`. The host is the source of truth: every `store.set` of `game`/`config` also sends `{t:'set', game, cfg}` to the room, which forwards the board to the captains. The room (`localStorage.tajniacy_room` = `{code, hostToken, cap:{r,b}, scanned}`) is reused for later games, so the QR overlay appears only until both captains have connected once (`needQr()`). Without a server the game still works and the QR falls back to the offline payload format. The footer shows the connection (`netBadge()`).
- **Defaults**: theme `noir`, music volume 0.5. A one-time migration (`tj_def_v2`) applied these to existing browsers too.
- **Storage abstraction**: `store` has `sub(name, cb)` / `set(name, obj)` over two documents, `config` and `game`. `init()` uses `makeLocalStore()` (localStorage key `tajniacy_v1`). Always write state through `store.set` rather than mutating and re-rendering alone.
- **State**: `config` holds players, team names, theme, word list text, selected categories, match mode and score. `game` holds the 25 words, the `key` array (`r`/`b`/`n`/`a`), `revealed`, `turn`, `winner` and stats. `ui` holds transient view state.
- **Rendering**: `render()` rebuilds `$app.innerHTML` from string-template view functions (`splashView`, `setupView`, `hostBoard`), then calls `fitCards()` (from `common.js`) to shrink card text until it fits. Clicks go through delegated handlers keyed on `data-act` attributes. Escape user text with `esc()` when interpolating.
- **Cards**: `cardHtml()` builds a 3D card (`.in` holding `.front` and, only for revealed cards, `.back` with an inline-SVG illustration from `illus(k)`). Unrevealed cards never carry key classes, so the key isn't leaked into the DOM. iOS Safari can ignore `backface-visibility` here, so the front face of a revealed card is hidden explicitly (`visibility`, switched at the middle of the flip by the `faceout`/`facein` keyframes). On narrow screens (≤700px) the board gets a fixed aspect ratio and the footer leaves room for the fixed sound buttons. `fitCards(FIT_SEL)` shrinks text on both faces.
- **Effects**: `turnBanner()` (folder + stamp), `assassinScene()` (blackout, shot, skull card, `bulletScar()`), `celebrate()` (falling files/badges), `flapNum()` (split-flap counter), `runCounters()` (count-up stats) and the themed background layer `#fx`. Every animation must be disabled under `prefers-reduced-motion` (CSS media block plus `calm()` checks in JS).
- **Game logic**: `newGame()` deals 9 cards to the starting team, 8 to the other, `8 - N` neutral and N assassins (`config.assassins`, 1–3, set in the setup screen). `reveal(i, actor)` and `endTurn()` hold the turn and win rules.
- **Words**: `DEFAULTS` holds the built-in categories. The user-editable list format is `# Category` lines followed by words (one per line or comma-separated), parsed by `parseWords()`.
- **Sound**: the `Snd` module synthesizes music and SFX with WebAudio (no audio files). Its settings live in `localStorage.tj_snd`.
- **Themes**: `classic`, `noir`, `retro` and `light`, applied via `body[data-theme]` and CSS custom properties defined in `common.css` (shared with `captain.html`).

### `captain.html`: captain's key on a phone (opened from a QR code)
- Live format `#<CODE>.<r|b>.<captain token>`: connects to the room via `net.js`, receives the board, marks revealed cards (✓) and the turn by itself, and switches to the next game automatically (manual ★/⚠ marks are kept per `tjm_<code>_<game id>`).
- Offline format: the host encodes the game into the URL hash as `#<team>.<payload>`, where team is `r` or `b`. `payload()` in `index.html` produces `base64url(UTF-8("<25-char key>|<25 words>|<red name>|<blue name>|<theme>"))`, and `decode()` in `captain.html` parses it. **If you change the payload format, change both files together.**
- In the offline format there is no sync with the host. Captains track cards themselves with local marks, stored in `localStorage` under `tjm_<hash of payload>`.
- It loads the same `common.css` and `common.js` as `index.html`, so theme changes apply to both pages.
