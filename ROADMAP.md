# Joker — Development Roadmap

Last updated: 2026-05-19

---

## ✅ Done

### Core Game Engine
- [x] Card, Deck, TrickResolver, Scorer, GameState classes
- [x] Full 4-pulka × 24-round structure
- [x] Bidding phase with prohibition rule (last bidder restriction)
- [x] Trick play: follow-suit, must-trump enforcement
- [x] All four Joker modes: TAKE / GIVE (led) · HIGH / LOW (non-led)
- [x] Joker rule engine: TAKE-as-lead forces highest; HIGH non-lead no suit obligation; trump overrides non-trump TAKE
- [x] 9-card rounds: trump selection by player left of dealer
- [x] Scoring: exact bid, partial, hisht (configurable per mode), zero bid
- [x] Pulka bonus (premia): winner earns best round score; non-premia lose theirs
- [x] Configurable deductions — toggle penalty for non-premia players; multi-premia deduction sub-option; last-bid-untouchable sub-option
- [x] Play in Pairs — P1+P3 vs P2+P4; partner exempts you from deduction; opposite-team premia cancel; final scores merged

### Multiplayer & Server
- [x] Real-time 4-player WebSocket gameplay (Socket.io)
- [x] Room lifecycle: create, join by code, password protection, cleanup
- [x] Reconnect on page refresh (localStorage session token)
- [x] Disconnect/inactivity substitution: bot takes over after 2 minutes, player can resume
- [x] Turn timer with 10-second countdown overlay
- [x] Bot opponents (Pallach, SupermanTEUSU, Grendizer) — adaptive timing, strategic bidding, Joker-aware
- [x] Per-room JSONL game logs (logs/ directory, async append, git-ignored)
- [x] Periodic state_sync broadcast (every 30 s) for late-joiners and spectators
- [x] kick_player — host can remove a player from the waiting room

### Auth & Accounts
- [x] Register / login with username + password (bcrypt + JWT, 30-day tokens)
- [x] Guest play always available (name only, no account required)
- [x] DATABASE_URL guard — auth routes return 503 with clear message when DB not configured
- [x] PostgreSQL schema + auto-migration on first boot
- [x] Game results persisted to DB (winner, scores, rounds played)
- [x] Player stats API: games played, win rate, bid accuracy, total score
- [x] Leaderboard API: top 20 players by score / win rate
- [x] Google OAuth backend (passport-google-oauth20 + JWT) — awaiting redirect URI config
- [x] Player profile — Cabinet modal: change username, email, password; avatar selection (emoji set)
- [x] Avatar persisted server-side; shown in lobby badge and in-game seat

### Lobby & Social
- [x] Main lobby: live room list (polls every 5 s), Quick Match, Create Room, Join by Code
- [x] Password-protected rooms with lock icon
- [x] Spectator mode: Watch button in Lobby + Watch-by-code panel in-game
- [x] Invite links — Copy URL button per room; link auto-fills join panel with code
- [x] Auto-start countdown (10 s) when room fills; bar display with red flash at ≤ 3 s
- [x] Leaderboard tab in lobby: top players by score, win rate, bid accuracy
- [x] Personal stats panel — click your badge in lobby to see own stats popup
- [x] Real-time in-game chat for players and spectators (rate-limited 15 msg/min)

### In-game UI
- [x] Atuzovka (dealing-for-dealer) animation at game start
- [x] Animated trick collection with winner highlight (1.5 s display → 0.7 s collect)
- [x] Live scoreboard: per-round bids, scores, pulka bonus rows, running totals
- [x] Game log (events) merged with chat in score panel — auto-scrolls to latest entry
- [x] Bid/trick colour coding, dealer badge, goes-first indicator
- [x] Bid advisor (equalize suggestion for 2nd/3rd bidder)
- [x] Joker action popup for mode selection (TAKE/GIVE/HIGH/LOW)
- [x] Configurable room options — hisht penalty (Classic: 200/500/200-500/×100; Only9: 200/300/500/900), game mode, Play in Pairs, Deductions
- [x] Multiple card deck themes (cycle with 🎨 button)
- [x] Multiple table background themes — 5 options: green, blue, black, burgundy, purple
- [x] Sound effects: card play, bid, trick won, hisht, game over (toggle with 🔔)
- [x] Dark/light theme toggle (ThemeToggle)
- [x] Game-end stats modal with player summary table (score, exact bids, hishts, accuracy); pairs-aware team rows
- [x] Play Again button — creates new room with all same settings (including pairs/deductions)
- [x] Player stats popup in-game — click any opponent's badge to see their public stats
- [x] Lobby redesign — content-driven modals, centered titles, fixed-height buttons, rich settings UI with toggles

### Responsive & i18n
- [x] Mobile-responsive layout — game table adapts at < 640 px; compact player badges, overlay seats, wrapped bid buttons
- [x] i18n — English / Georgian / Russian with live toggle (EN|KA|RU button, persisted in localStorage)
- [x] Settings bar moved to top-right; compact icon-only on mobile; LangToggle `dropdownRight` prop prevents overflow

### Landing & Trust
- [x] Privacy policy page (`/privacy.html`)
- [x] Landing pitch tagline + How to Play as prominent button
- [x] Personal About section on lobby (EN/KA/RU)
- [x] Footer with creator credit (GitHub) and privacy link
- [x] Token tooltip in Profile modal
- [x] Bug fix — `aspect-ratio` CSS replaced with `paddingBottom` hack for old Android WebView
- [x] Bug fix — hand invisible after mid-game page reload (phase guard + immediate `hand_update` on rejoin)

### Infrastructure
- [x] Railway deployment (single-server: backend serves built frontend)
- [x] 96 automated tests across 26 suites (engine primitives, phase guards, action log, state/bot, full integration)
- [x] RULES.md — complete game rules + configurable mode notes
- [x] Reconnect sync — rejoining player and late spectators receive full roundHistory + current trick
- [x] All constants centralised in `config.js`; `PHASES` in `constants.js`; phase guards on all `GameState` methods
- [x] `RoundManager` extracted — dealing/bidding/trick orchestration split from `GameState`
- [x] `bot_error` event — dismissible red banner in UI when bot fails 3× consecutively

---

## 🚧 In Progress / To Verify

- [ ] **Google OAuth live testing** — backend complete; needs Railway deploy with correct redirect URIs in Google Cloud Console
- [ ] **Spectator reconnect edge case** — late spectators joining mid-trick may miss a card_played event; state_sync covers it but needs live testing

---

## 📋 Planned — Web App

### Near Term
- [ ] **Rematch with invite** — Play Again currently creates a solo new room; extend to share an invite link to same opponents automatically
- [ ] **"Achievements" badges** — First Win, First Hisht, 10 Exact Bids in a Row, Joker Master; badge shown on lobby badge
- [ ] **Honour / leave-penalty system** — track mid-game disconnects; display rating badge; warn when low-honour player joins

### Medium Term
- [ ] **Replay viewer** — watch any completed game move-by-move (requires event-log table in DB)
- [ ] **Private tournament mode** — bracket of N players, rooms auto-created per matchup
- [ ] **Ranked vs casual modes** — separate lobby queue; Elo system
- [ ] **Follow / friends system** — see online status in lobby, watch friends' games directly
- [ ] **Ranked matchmaking queue** — auto-match by Elo rating

---

## 📱 Planned — Mobile Apps

React Native app wrapping the existing game logic and Socket.io connection. Target: feature parity with web v1.3 at launch.

### Shared Mobile Work
- [ ] React Native project setup (Expo or bare RN)
- [ ] Touch-optimised card fan — swipe-to-select, tap-to-play
- [ ] Portrait & landscape layouts
- [ ] Push notifications ("It's your turn", "Friend is playing")
- [ ] Haptic feedback on card play / trick win

### iOS
- [ ] Apple Developer account + App Store listing
- [ ] TestFlight beta
- [ ] Sign in with Apple (required if Google login offered)

### Android
- [ ] Google Play Console account + Play Store listing
- [ ] Internal testing track before public release
- [ ] App Bundle (AAB) build and signing

---

## ⏸ Postponed

| Feature | Reason |
|---------|--------|
| Google OAuth local testing | Safari IPv6/localhost issue; test on Railway deploy |
| Replay viewer UI | Needs DB event-log table first |
| Elo matchmaking | Needs DB + auth + ranked mode first |
| Tournament bracket | Needs DB + player accounts first |
| In-app purchases | Decide monetisation model first |
