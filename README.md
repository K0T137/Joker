# Joker — ჯოკერი

Online multiplayer implementation of the Georgian trick-taking card game Joker. 4 players, real-time WebSocket gameplay, bot opponents included.

**Live:** [jokr.online](https://jokr.online)

---

## Version History

### v1.7 — Landing UX, Trust & Bug Fixes (current)
- **About section** — personal creator note on the lobby landing (Konstantine's story); EN/KA/RU translated
- **Privacy policy page** — standalone `/privacy.html`; linked in lobby footer
- **Landing pitch** — "Free-to-play · 4 players · Skill-based" tagline below the hero
- **How to Play** promoted — full-weight button on both mobile and desktop lobby layouts
- **Settings bar** moved to top-right; lower contrast; compact icon-only version on mobile (no 4-colour toggle cluttering small screens)
- **LangToggle `dropdownRight` prop** — dropdown aligns to right edge when bar is top-right; prevents overflow on small screens
- **Footer** — "Made by K0T137" (links to GitHub) · "Privacy" link; always visible above content
- **Token tooltip** — hover on token balance in Profile modal explains what tokens are for
- **Bug fix — cards invisible on old Android** — `aspect-ratio` CSS replaced with universal `paddingBottom: '133.33%'` hack in card collection thumbnails; fixes WebView on old Chinese/Android devices
- **Bug fix — hand blank after mid-game page reload** — `get_hand` phase guard extended to include `'playing'` phase; backend now pushes `hand_update` immediately on `rejoin_game`
- **Translation typo** — fixed mixed Georgian/Cyrillic characters in `tab_account.ru` (`Аккაунт` → `Аккаунт`)

### v1.6 — Social Layer, Achievements & Polish
- **Friends list** — search players, send/accept/decline requests, remove friends, real-time online status via socket presence
- **Lobby chat** — global floating chat panel (bottom-right), last 50 messages in memory, login required to send, 4 msg / 5 s rate limit
- **Player blocking** — block from Friends tab or in-game stats popup; blocked users silently filtered in all social contexts
- **Achievement badges** — First Win 🏆 · First Hisht 💀 · Bid Master 🎯 (10 exact bids in a row) · Joker Master 🃏 (5 full-take rounds); shown in waiting room
- **Honour system** — `honor_rate` starts at 100, +1 per completed game, −5 per AFK substitution; gold 🏅 / blue ⚡ / red 💀 tiers shown in waiting room
- **Rematch invite** — "Invite Same" in game-end modal creates a new room and broadcasts a 30 s toast invite to all previous opponents
- **Tutorial modal** — 7-slide interactive tutorial with real card sprites; auto-shown on first visit
- **8-bit card sprites** — pixel-art deck using `8BitDeck.png` sprite sheet (13 × 4 grid, 142 × 190 px per cell)
- **Mobile lobby fix** — compact 2 × 2 button grid and scaled card fan for 360 × 740 screens; everything fits without scrolling
- **UI cleanup** — removed redundant Preferences tab (moved to Collection); moved four-colour toggle to top bar

### v1.5 — Game Settings, Pairs Mode & Scorer Overhaul
- **Revamped hisht penalty options** — mode-aware selection at room creation: Classic (200 · 500 · 200/500 alternating · ×100 dynamic); Only9 (200 · 300 · 500 · 900)
- **Play in Pairs** — P1+P3 vs P2+P4 team mode; final scores merged under P1/P2 in the game-end table
- **Deductions toggle** — disable pulka-bonus penalties for non-premia players; sub-options: *Multi-premia deduction* (penalise others even when 2+ players are on premia) and *Last bid untouchable* (exclude last round from maxRound calculation)
- **Scorer rewrite** — `calculatePulkaBonus` now accepts full options object: `deductions`, `multiPremiaDeduction`, `lastBidUntouchable`, `partnerOf`, `teamOf`; pairs premia exemption (partner on premia → you are exempt); opposite-team premia cancel each other out
- **Lobby redesign** — all three modals (Create, Leaderboard, Play) resized to content-driven height; centered titles; fixed-height buttons; rich settings UI with toggles and option-button rows
- **Game-end modal** — pairs-aware display: when Play in Pairs is active, results shown as "P1 & P3" / "P2 & P4" team rows
- **`RoundManager` extracted** — dealing, bidding, and trick orchestration split out of `GameState` into its own class
- **All constants centralised** in `config.js`; `PHASES` in `constants.js`; phase guards on all `GameState` state-machine methods
- **96 automated tests** — up from 83; new suites cover phase guards, action log, reconnect payload, and full-game scoring variants

### v1.4 — Profiles, Themes & Polish
- **Player profile / Cabinet** — change username, email, password; choose avatar from emoji set; avatar persisted server-side and shown on lobby badge and in-game seat
- **Table background themes** — 5 colour options (Green, Blue, Black, Burgundy, Purple); separate dark and bright variants that switch automatically with the day/night toggle
- **In-game player stats popup** — click any opponent's seat badge to see their public stats (games played, win rate, bid accuracy, total score)
- **Play Again** — game-end modal button creates a new room with the same hisht/mode settings
- **Named turn indicator** — "Waiting" messages now show whose turn it actually is (e.g. "Tamara is playing…" / "Tamara is bidding…") in all three languages
- **Chat/log auto-scroll** — the game log + chat panel now always scrolls to the latest entry automatically
- **Bug fixes** — TAKE Joker card-highlight constraint; round-end stuck-game fix when bot played last card; `parseCard` now scoped to the acting player's hand; `RoundEndOverlay` pulka totals no longer show NaN; stale room reference in round-end setTimeout

### v1.3 — Auth, Chat, Room Config & Mobile
- **Login / Register** — username + password accounts; JWT auth (30-day tokens); guest play (just enter a name) remains fully supported
- **Leaderboard** — "🏆 Leaders" tab in lobby shows top players by total score, win rate, and bid accuracy; requires `DATABASE_URL`
- **Player stats** — click your badge in-game/lobby to see personal stats: games played, win rate, bid accuracy, total score
- **Game results persistence** — every completed game is saved to PostgreSQL, stats attributed to logged-in players
- **In-game chat** — real-time chat for players and spectators; rate-limited to 15 messages per minute per user
- **Configurable room options** — host can set hisht penalty (−100 / −200 / −300 / −500 / −1000) and game mode (Classic 24 rounds or Only 9-card rounds) at room creation
- **Auto-start countdown** — 10-second countdown when a room fills up; bar display with red flash in the final 3 seconds
- **Invite links** — Copy invite URL button on room rows; link auto-opens the join panel with the code pre-filled
- **Mobile-responsive layout** — game table adapts at < 640 px: side players become compact overlay badges, play area takes full width, bid buttons and trump selector resize to fit phone screens, card hand uses tighter fan, Joker popup clamped to viewport

### v1.2 — Lobby, Spectator & Robustness
- **Main lobby** — live room list, Quick Match, Create Room with optional password, Join by code
- **Spectator mode** — watch any live game from the lobby or by code; spectator count shown on room cards
- **Reconnect on refresh** — localStorage session keeps you in your room after page reload; full scoreboard and current trick restored
- **Bot substitution** — if a player disconnects or goes inactive for 2 minutes, a bot seamlessly takes over; player can resume on reconnect
- **Turn timer** — 10-second countdown overlay when your turn is about to time out
- **Bot AI** — tracks opponent scores, steals tricks from the leader, dumps on others strategically; correctly handles all four Joker modes (TAKE/GIVE/HIGH/LOW)
- **Joker rule engine** — TAKE Joker (lead) forces all players to play their highest of the declared suit; HIGH Joker (non-lead) simply wins without suit obligations; trump overrides non-trump TAKE Joker
- **Correct 24-round game structure** — 4 pulkas: ascending 8 rounds, 4×9, descending 8 rounds, 4×9
- **Scoreboard ordering** — columns ordered left-of-dealer → clockwise → dealer, matching table seat order
- **Per-room game logs** — every action appended to a JSONL log file for debugging and future replay
- **83 automated tests** — engine primitives, game state, and full 4-bot integration suites

### v1.1 — Online Deployment
- Railway single-server deployment (backend serves built frontend)
- Atuzovka (dealing-for-dealer) animation
- Animated trick collection, Joker action popup, bid advisor

### v1.0 — Core Game
- Full 4-player real-time multiplayer via WebSockets
- Complete game engine: bidding, trick play, all Joker modes, scoring, pulka bonus
- Bot opponents

---

## The Game

Joker is a 4-player trick-taking card game popular in Georgia. Players bid on how many tricks they'll take each round, then play to hit their bid exactly. The game runs for 4 pulkas, 24 rounds total.

**Deck:** 36 cards — ranks 7–A in all four suits, plus 6♥/6♦ (but not 6♠/6♣), plus 2 Jokers.

**Full game round structure (24 rounds):**

| Pulka | Rounds | Cards |
|-------|--------|-------|
| 1 | 8 | 1 2 3 4 5 6 7 8 (ascending) |
| 2 | 4 | 9 9 9 9 |
| 3 | 8 | 8 7 6 5 4 3 2 1 (descending) |
| 4 | 4 | 9 9 9 9 |

Full rules: see [RULES.md](RULES.md)

---

## Features

- Real-time 4-player multiplayer via WebSockets
- **Auth** — register/login (username + password) or Google OAuth; guest play always available
- **Player profile / Cabinet** — change username, email, password; emoji or custom photo avatar
- **Friends list** — search, add/remove, online presence, block
- **Lobby chat** — global floating chat panel, real-time, login-gated
- **Player blocking** — block from Friends tab or in-game stats popup
- **Achievement badges** — First Win · First Hisht · Bid Master · Joker Master; shown in waiting room
- **Honour system** — reputation score shown as gold/blue/red tier badge in waiting room
- **Leaderboard** — top players by score, win rate, bid accuracy
- **Player stats** — personal stats panel + in-game opponent popup (click any seat badge)
- Main lobby with live room list, Quick Match, password-protected rooms, invite links
- Spectator mode — watch any game live without playing
- **In-game chat** — real-time, rate-limited, for players and spectators
- **Rematch invite** — "Invite Same" sends a 30 s toast invite to previous opponents
- **Tutorial modal** — 7-slide interactive tutorial with real card sprites; auto-shown on first visit
- Reconnect on page refresh (session preserved in localStorage)
- Bot substitution after 2-minute inactivity + turn timer countdown
- Bot opponents with adaptive strategy (Pallach, SupermanTEUSU, Grendizer)
- **Configurable room options** — hisht penalty, game mode, Play in Pairs, Deductions toggle
- **Auto-start countdown** — room starts 10 s after filling; Play Again reuses settings
- Full 9-card round trump selection: player left of dealer picks trump after seeing 3 cards
- Atuzovka (dealing-for-dealer) animation at game start; bid advisor for 2nd/3rd bidders
- Joker modes: TAKE / GIVE (led) / HIGH / LOW (non-led); animated trick collection
- **Card themes** — Classic · Hybrid · 8-bit pixel sprite (8BitDeck.png)
- **Table themes** — 5 colour options × dark/light variants
- **Four-colour suits** toggle in top bar
- Sound effects: card play, bid, trick won, hisht, game over (🔔 mute toggle)
- Live scoreboard with per-round bids, pulka bonus rows, and running totals
- **i18n** — English / Georgian / Russian with live toggle
- **Mobile-responsive** — lobby fits 360 × 740; game table adapts to phones ≥ 375 px

---

## Scoring

| Bid | Tricks | Result |
|-----|--------|--------|
| 0 | 0 | +50 |
| n | n (did not take all tricks) | +50 + n×50 |
| n | n (took every trick in the round) | +n×100 |
| n > 0 | 0 | −hisht (default −200; configurable per room) |
| n | k, 0 < k < n | +k×10 (partial) |

**Pulka bonus (premia):** At the end of each pulka, players who hit their bid exactly in every round are *on premia*. Each earns a bonus equal to their own best single-round score. Non-premia players lose their own best round score — unless the *Deductions* setting is off, or their partner (pairs mode) is on premia, or players from different teams cancel each other's premia out.

---

## Local Development

Requires Node 20+.

**Backend**
```bash
cd Joker/backend
cp .env.example .env   # set JWT_SECRET; add DATABASE_URL for auth/stats
npm install
node server.js
# runs on http://127.0.0.1:3000
```

**Frontend**
```bash
cd Joker/frontend
npm install
npm run dev
# runs on http://localhost:5173
```

Open `http://localhost:5173`, create a room, add bots, click Ready.

> **Safari note:** use `http://127.0.0.1:5173` instead of `localhost` — Safari routes `localhost` to IPv6 which Node doesn't bind by default.

**Auth/stats (optional):** set `DATABASE_URL` in `.env` pointing to a PostgreSQL instance (local or [Neon](https://neon.tech) free tier). Tables are created automatically on first boot. Without it, the game works fully but accounts and stats are disabled.

---

## Running Tests

```bash
cd Joker/backend
npm test
# 96 tests across 26 suites — should all pass
```

---

## Deployment (Railway)

The backend serves the built frontend as static files — one server, one URL.

**1. Build**
```bash
# from repo root
npm run build
```

**2. Push to GitHub, then connect to Railway**

Railway picks up `railway.toml` automatically:
- Build command: `npm run build`
- Start command: `npm start`

**3. Set environment variables in Railway**
```
NODE_ENV=production
JWT_SECRET=<random 32-byte hex string>
DATABASE_URL=<Railway PostgreSQL URL>     # add PostgreSQL service in Railway
FRONTEND_URL=https://your-app.up.railway.app
```

To enable accounts and stats: add a **PostgreSQL** service to your Railway project — `DATABASE_URL` is injected automatically. Tables migrate on first boot.

---

## Project Structure

```
Joker/
├── backend/
│   ├── server.js              — Express + Socket.io, serves frontend in prod
│   ├── .env.example           — environment variable template
│   └── src/
│       ├── gameEngine/
│       │   ├── Card.js        — Card class
│       │   ├── Deck.js        — Deck, shuffle
│       │   ├── GameState.js   — Core state machine (phase guards, action log, hand management)
│       │   ├── RoundManager.js — Dealing, bidding, trick orchestration (split from GameState)
│       │   ├── TrickResolver.js — Trick winner resolution (Joker rules)
│       │   ├── Scorer.js      — Round and pulka scoring (pairs, deductions, premia options)
│       │   └── constants.js   — PHASES, suit/rank constants
│       ├── config.js          — All tunable game constants (bot delays, scoring, pulka structures)
│       ├── GameRoom.js        — Room lifecycle, player management, dealer rotation, settings
│       ├── BotPlayer.js       — Bot bid and card selection (TAKE/GIVE/HIGH/LOW Joker aware)
│       ├── GameLogger.js      — Append-only JSONL log per room (logs/ directory)
│       ├── db.js              — PostgreSQL pool, schema migrations, saveGameResult, leaderboard
│       └── routes/
│           ├── auth.js        — Register/login (bcrypt + JWT) + Google OAuth skeleton
│           └── profile.js     — Update username/email/password/avatar
├── frontend/
│   └── src/
│       ├── App.jsx            — Socket connection, global event handlers, game log
│       ├── translations.js    — EN/KA/RU string table
│       ├── context/
│       │   ├── AuthContext.jsx  — Auth state, JWT storage, /me validation
│       │   ├── LangContext.jsx  — Language selection (EN/KA/RU), t() helper
│       │   └── PrefsContext.jsx — Table/deck themes, four-colour mode, suit helpers
│       └── components/
│           ├── Lobby.jsx          — Room list, Quick Match, Create/Join/Watch, Leaderboard, Auth modal
│           ├── Cabinet.jsx        — Player profile modal: avatar, username, email, password
│           ├── GameRoom.jsx       — Table layout, compact/mobile detection, overlays, trump display
│           ├── PlayerSeat.jsx     — Player badge (full + compact), dealer/first-player indicators
│           ├── TrickArea.jsx      — Trick card slots, collect animation, Joker badge
│           ├── GameBoard.jsx      — Player hand fan, card selection, compact mode
│           ├── BiddingPhase.jsx   — Bid buttons, equalize advisor, compact mode
│           ├── ScorePanel.jsx     — Sidebar with score table, last trick, chat, game log
│           ├── ScoreTable.jsx     — Round rows, pulka summary rows, totals footer
│           ├── Card.jsx           — Card face/back rendering, multiple deck themes
│           ├── JokerActionPopup.jsx — Joker mode selector (TAKE/GIVE/HIGH/LOW)
│           ├── LangToggle.jsx     — EN/KA/RU language switcher
│           ├── ThemeToggle.jsx    — Light/dark theme toggle
│           ├── AdminPanel.jsx     — Dev-only debug panel
│           └── overlays/
│               ├── AtuzovkaOverlay.jsx       — Dealer draw animation
│               ├── TrumpSelector.jsx         — Trump suit picker for 9-card rounds
│               ├── JokerAnnouncementOverlay.jsx — Joker mode broadcast
│               ├── GameAnnouncementOverlay.jsx  — Round/game announcements
│               ├── RoundEndOverlay.jsx       — Round/pulka score summary
│               └── GameEndModal.jsx          — Final scores, Play Again, invite link
├── test/
│   ├── iter1_engine.test.js   — Card, Deck, Scorer, TrickResolver (33 tests)
│   ├── iter2_state.test.js    — GameState, BotPlayer, phase guards, action log (46 tests)
│   └── iter3_integration.test.js — Full 4-bot game, dealer rotation, hisht modes (17 tests)
├── RULES.md                   — Complete game rules
├── ROADMAP.md                 — Feature backlog and status
├── package.json               — Root build/start scripts for deployment
└── railway.toml               — Railway deployment config
```

---

## REST API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Server health check |
| `GET` | `/api/rooms` | List open/active rooms |
| `GET` | `/api/leaderboard` | Top 20 players (requires `DATABASE_URL`) |
| `GET` | `/api/stats/:userId` | Individual player stats (requires `DATABASE_URL`) |
| `POST` | `/api/auth/register` | Register `{ username, email?, password }` → `{ token }` |
| `POST` | `/api/auth/login` | Login `{ username, password }` → `{ token }` |
| `GET` | `/api/auth/me` | Validate Bearer token → user payload |
| `GET` | `/api/profile` | Get own profile (requires auth) |
| `PUT` | `/api/profile` | Update username/email/password (requires auth) |
| `PUT` | `/api/profile/avatar` | Update avatar (requires auth) |
| `GET` | `/api/users/search?q=` | Search users by username prefix (requires auth) |
| `GET` | `/api/friends` | Friends list with online status (requires auth) |
| `GET` | `/api/friends/pending` | Pending requests `{ incoming, outgoing }` (requires auth) |
| `POST` | `/api/friends/request` | Send friend request `{ addresseeId }` (requires auth) |
| `PUT` | `/api/friends/accept` | Accept request `{ requesterId }` (requires auth) |
| `DELETE` | `/api/friends/decline` | Decline request `{ requesterId }` (requires auth) |
| `DELETE` | `/api/friends/:id` | Remove friend (requires auth) |
| `GET` | `/api/blocked` | Blocked users list (requires auth) |
| `POST` | `/api/blocked` | Block user `{ blockedId }` (requires auth) |
| `DELETE` | `/api/blocked/:id` | Unblock user (requires auth) |

## Socket Events

| Direction | Event | Purpose |
|-----------|-------|---------|
| client → server | `create_game` | Create a new room (name, password, settings: hishtPenalty/gameMode/playInPairs/deductions/…, userId) |
| client → server | `join_game` | Join existing room by code |
| client → server | `rejoin_game` | Reconnect to room after refresh |
| client → server | `spectate_game` | Join room as spectator |
| client → server | `add_bot` | Add a bot to the lobby |
| client → server | `ready_to_play` | Mark self ready |
| client → server | `get_hand` | Fetch current hand |
| client → server | `select_trump` | Pick trump in 9-card round |
| client → server | `place_bid` | Submit bid |
| client → server | `play_card` | Play a card (includes Joker mode) |
| client → server | `send_chat` | Send chat message (rate-limited) |
| client → server | `kick_player` | Host removes a player from the waiting room |
| server → client | `player_joined` | Lobby player list update |
| server → client | `player_ready` | Player ready state changed |
| server → client | `room_full` | All seats filled, auto-start countdown begins |
| server → client | `atuzovka_result` | Dealer draw animation data |
| server → client | `game_started` | Game begins |
| server → client | `round_started` | New round, trump, phase |
| server → client | `trump_selected` | Trump chosen in 9-card round |
| server → client | `bid_placed` | Bid recorded, all bids state |
| server → client | `bidding_complete` | All bids in, play begins |
| server → client | `card_played` | Card played, Joker mode if applicable |
| server → client | `trick_resolved` | Trick winner, updated trick counts |
| server → client | `round_ended` | Scores, pulka bonus if applicable |
| server → client | `game_ended` | Final scores |
| server → client | `turn_timer_started` | Inactivity countdown started |
| server → client | `turn_timer_cancelled` | Player acted, timer cleared |
| server → client | `player_substituted` | Bot took over for inactive player |
| server → client | `player_resumed` | Player reconnected and resumed |
| server → client | `chat_message` | Incoming chat message |
| server → client | `state_sync` | Periodic full state broadcast (every 30 s) |
| client → server | `authenticate` | Send JWT to bind socket to user identity (social features) |
| client → server | `lobby_join` | Join global lobby room; server replies with `lobby_history` |
| client → server | `lobby_chat_send` | Send lobby chat message (rate-limited, requires auth) |
| client → server | `request_rematch` | Create new room and invite previous opponents |
| server → client | `lobby_history` | Last 50 lobby chat messages on join |
| server → client | `lobby_message` | New lobby chat message |
| server → client | `rematch_invite` | Rematch invitation `{ inviterName, newRoomId }` |
| server → client | `friend_online` | Friend came online `{ userId, username }` |
| server → client | `friend_offline` | Friend went offline `{ userId }` |
| server → client | `friend_request_received` | Incoming friend request notification |
| server → client | `friend_request_accepted` | Your request was accepted |
