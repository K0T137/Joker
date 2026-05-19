# Joker — Development Roadmap

Last updated: 2026-05-19

---

## ✅ Done

### v1.0–1.2 — Core engine, multiplayer, lobby
- Full 4-player real-time multiplayer (Socket.io)
- Complete game engine: 36-card deck, 4 pulkas, 24 rounds, all Joker modes (TAKE/GIVE/HIGH/LOW)
- Bidding, trick play, hisht, pulka bonus/premia scoring
- Atuzovka animation, bid advisor, animated trick collection
- Lobby: live room list, Quick Match, Create/Join/Watch, password-protected rooms, invite links
- Spectator mode, reconnect on refresh, bot substitution, turn timer
- Per-room JSONL game logs, 30 s state_sync, periodic room cleanup
- Auto-start countdown, bot opponents (Pallach, SupermanTEUSU, Grendizer)

### v1.3 — Auth & config
- Register/login (username + password, JWT), guest play, Google OAuth
- Leaderboard, player stats, game results persisted to PostgreSQL
- In-game chat (rate-limited), configurable room options (hisht penalty, game mode)

### v1.4 — Profiles & themes
- Cabinet modal: username/email/password, emoji avatar
- 5 table background themes × dark/light, multiple card deck themes
- In-game opponent stats popup, Play Again button, named turn indicator

### v1.5 — Settings & scoring overhaul
- Play in Pairs (P1+P3 vs P2+P4), deductions toggle, last-bid-untouchable
- Revamped hisht penalty options (Classic + Only9 modes)
- Scorer rewrite, RoundManager extracted, constants centralised
- 96 automated tests across 26 suites

### v1.6 — Social layer & gamification
- Friends list (search, add/accept/decline/remove, online presence)
- Player blocking (Friends tab + in-game popup)
- Lobby chat (global floating panel, rate-limited, last 50 msgs)
- Achievement badges: First Win · First Hisht · Bid Master · Joker Master
- Honour system: honor_rate, gold/blue/red tier badges
- Rematch invite ("Invite Same" → new room + 30 s toast)
- Tutorial modal (7 slides, real card sprites, auto-shown on first visit)
- 8-bit pixel card deck (8BitDeck.png sprite sheet)

### v1.7 — Landing UX, trust & hardening
- About section (personal creator note, EN/KA/RU)
- Landing pitch tagline, "How to Play" as primary button
- Footer: Made by K0T137 (GitHub) + Privacy link
- Token tooltip in Profile modal
- Privacy policy page (/privacy.html)
- Bug fix: cards invisible on old Android WebView
- Bug fix: hand blank after mid-game page reload
- Translation typo fix (tab_account.ru)
- Backend: try/catch on lobby socket handlers, gameStartedAt map leak fixed

---

## 🚧 In Progress / To Verify

- [ ] **Google OAuth live testing** — backend complete; needs Railway deploy with correct redirect URIs in Google Cloud Console
- [ ] **Spectator reconnect edge case** — late spectators joining mid-trick may miss a card_played event; state_sync covers it in practice but needs explicit live testing

---

## 📋 Backlog

Items are grouped by area. Effort: S = < 1 day · M = 1–3 days · L = week+

### Engine Resilience

| # | Item | Effort | Notes |
|---|------|--------|-------|
| E1 | Reconnect jitter — spread client reconnects on server restart | S | Pass `reconnectionDelay/Max/randomizationFactor` to `io()` in frontend; prevents thundering herd |
| E2 | Reconnect payload try/catch in `GameRoom.getReconnectPayload()` | S | Guards against crash if gameState partially initialized on rejoin |
| E3 | State guard audit — ensure every socket handler rejects wrong-phase events | S | Partial guards exist; audit for gaps across all handlers |
| E4 | Bot timer leak on rapid disconnect/reconnect | S | `unsubstitute()` should cancel `botTurnTimers` before re-assigning control |
| E5 | Kicked-player memory — `kickedPlayerIds` Set on GameRoom; reject rejoin | S | Kicked players can currently rejoin immediately |
| E6 | UNRECOVERABLE_STATE detector in sync interval | M | Check for stuck bidding/playing phase; force-advance or end game |
| E7 | Room cleanup when all humans gone during play | S | `shouldCleanup()` leaves zombie 'playing' rooms in /api/rooms |
| E8 | AFK rate — persist lifetime afk count to DB on each substitution event | M | `afk_count` column exists; surface in stats and factor into matchmaking |
| E9 | Heartbeat layer (server→client every 15 s, client echoes) | M | Socket.IO covers most cases; low priority |

### Code Structure

| # | Item | Effort | Notes |
|---|------|--------|-------|
| C1 | Split `server.js` (~1 700 lines) → `routes/social.js` + `sockets/game.js` + `sockets/social.js` | M | Extract when next major feature touches server.js |
| C2 | Split `Lobby.jsx` (~1 200 lines) — extract auth modal, collection modal, leaderboard modal | M | Extract when next modal is added |

### Social

| # | Item | Effort | Notes |
|---|------|--------|-------|
| S1 | Invite friend to current room directly from Friends tab | S | Emit socket event to friend's socketId |
| S2 | Incognito mode — hide online status | S | Toggle on socket `authenticate`; skip `friend_online` broadcast |
| S3 | Report player (abuse report → admin queue) | M | |

### Game Variants

| # | Item | Effort | Notes |
|---|------|--------|-------|
| G1 | Quick Mode — 1 pulka instead of 4 (~10 min game) | S | Same rules, shorter session; good for mobile/casual |
| G2 | Old School mode — 38-card deck (all four 6s added back) | S | Config flag on Deck; no trump selection in 9-card rounds per their rules |
| G3 | Lucky Mode — 1 card per player × 4 rounds (pure luck) | S | Different round structure, minimal engine change |
| G4 | Emoji reactions mid-game | S | 6–8 reaction buttons during play (👏 😤 🤔 😂); separate from chat |

### Gamification & Economy

| # | Item | Effort | Notes |
|---|------|--------|-------|
| G5 | "Joker" title/crown — #1 leaderboard player holds it until dethroned | S | Badge next to username everywhere; drives competitive engagement |
| G6 | Richer stat tracking — perfect9Count, perfect8Count, place1/2/3Count, eliminatedTopCount | M | Surface on profile page |
| G7 | Insurance / ragequit penalty — token stake on join, forfeited on quit, split to winners | M | Directly solves ragequit problem; requires ranked mode |
| G8 | Activity reward sharing — 90%+ activity earns share of AFK forfeits | M | Depends on G7 |

### Tournaments

| # | Item | Effort | Notes |
|---|------|--------|-------|
| T1 | Tournament bracket / group system | L | Create/join tournaments, schedule rounds, auto-advance |
| T2 | Tournament leaderboard | M | Depends on T1 |

### Monetisation

| # | Item | Effort | Notes |
|---|------|--------|-------|
| M1 | Shop — purchasable card themes, avatars, table themes | L | Requires Stripe or equivalent |
| M2 | VIP tier — cosmetics + ranked queue access | L | Depends on M1 |
| M3 | Rewarded ads → token grants | M | |
| M4 | Gifting system — send cosmetics/tokens to friends | M | |
| M5 | Referral system — invite code earns tokens | S | |

### Cosmetics

| # | Item | Effort | Notes |
|---|------|--------|-------|
| X1 | Layered avatar builder (skin, hair, clothes, accessories) | L | Full character customisation |
| X2 | Special status / equippable title next to username | S | Crown / flair system |
| X3 | More card deck themes | S | Additional sprite sheets or vector sets |

### Quality of Life

| # | Item | Effort | Notes |
|---|------|--------|-------|
| Q1 | Email verification + password reset via email | M | SMTP or SendGrid |
| Q2 | Push notifications (OneSignal) — friend request, game invite, your turn | M | |
| Q3 | Multi-device session management — see and disconnect old devices | S | |
| Q4 | In-game protest / flag illegal move | M | |
| Q5 | Background music / soundtrack channel selector | M | |

### Mobile Apps

| # | Item | Effort | Notes |
|---|------|--------|-------|
| P1 | React Native project setup (Expo or bare RN) | M | Target: feature parity with web v1.3 at launch |
| P2 | Touch-optimised card fan (swipe-to-select, tap-to-play) | M | |
| P3 | iOS — Apple Developer account, TestFlight, App Store | L | Sign in with Apple required if Google login offered |
| P4 | Android — Play Console account, AAB build/signing, Play Store | L | |

---

## ⏸ Postponed

| Feature | Reason |
|---------|--------|
| Replay viewer | Needs DB event-log table before UI work makes sense |
| Elo / ranked matchmaking | Needs ranked mode + player volume first |
| In-app purchases | Decide monetisation model before building shop |

---

## ❌ Won't Do

| Feature | Reason |
|---------|--------|
| Strip Mode | Game variant from jok.ge; not relevant to our audience |
| GraphQL | REST + Socket.io is simpler and sufficient at this scale |
