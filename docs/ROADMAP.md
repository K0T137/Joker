# Joker — Roadmap

## Shipped

### Core game
- [x] Full 4-player real-time multiplayer (Socket.io)
- [x] Complete game engine: 36-card deck, 4 pulkas, 24 rounds, all Joker modes (TAKE/GIVE/HIGH/LOW)
- [x] Bidding, trick play, hisht detection, pulka bonus / premia scoring
- [x] Play in Pairs mode (P1+P3 vs P2+P4)
- [x] Configurable room options: hisht penalty, game mode (classic/only9), deductions, last-bid-untouchable
- [x] Prohibition rule (last bidder can't equalise total bids)
- [x] 9-card round trump selection by player left of dealer
- [x] Atuzovka (dealing-for-dealer) animation
- [x] Bot opponents with adaptive strategy (TAKE/GIVE/HIGH/LOW Joker-aware)
- [x] Bot substitution after 2-minute inactivity; player can reclaim on reconnect
- [x] Reconnect on page refresh (localStorage session)
- [x] Turn timer with 10-second countdown overlay
- [x] Ranked games with token delta system

### Multiplayer infrastructure
- [x] Lobby with live room list, Quick Match, Create / Join / Watch
- [x] Password-protected rooms
- [x] Spectator mode
- [x] In-game chat (rate-limited, players + spectators)
- [x] Rematch invite ("Invite Same" → new room + 30 s toast for previous opponents)
- [x] Auto-start countdown (10 s when room fills)
- [x] Room persistence across server restarts (PostgreSQL)

### Auth & profiles
- [x] Register / login (username + password, JWT)
- [x] Google OAuth
- [x] Guest play (name only)
- [x] Cabinet modal: username, email, password change; emoji + custom photo avatar
- [x] Player stats: games played, win rate, bid accuracy, score, placements, game history
- [x] Leaderboard (top 20 by token score)
- [x] Daily login bonus (+100 tokens)
- [x] In-game opponent stats popup (click any seat badge)

### Social
- [x] Friends list (search, send/accept/decline, remove)
- [x] Real-time online presence (socket `authenticate` → `friend_online` / `friend_offline`)
- [x] Lobby chat (global floating panel, last 50 msgs in memory, rate-limited)
- [x] Player blocking (from Friends tab and in-game stats popup)

### Gamification
- [x] Achievement badges — First Win · First Hisht · Bid Master (10-streak) · Joker Master (5× full take)
- [x] Honour system — `honor_rate` starts 100, +1/game, −5/AFK; gold 🏅 · blue ⚡ · red 💀 tiers

### UI / UX
- [x] Interactive tutorial (7-slide modal, real card sprites, auto-shown on first visit)
- [x] Card themes: Classic · Hybrid · 8-bit pixel (8BitDeck.png sprite sheet)
- [x] Table themes: 5 colours × dark/light variants
- [x] Four-colour suits toggle in top bar
- [x] i18n: English / Georgian / Russian with live toggle
- [x] Mobile-responsive lobby (360 × 740) and game table (≥ 375 px)
- [x] Sound effects with mute toggle
- [x] 96 automated tests (engine + integration)

---

## Backlog

Items are grouped by area. Effort estimates are rough (S = < 1 day, M = 1–3 days, L = week+).

### Engine resilience  *(from `engine-fixes.md`)*

| # | Item | Effort | Notes |
|---|------|--------|-------|
| E1 | State guard audit — ensure every socket handler rejects wrong-phase events | S | Partial guards exist; audit for gaps |
| E2 | Kicked-player memory — `kickedPlayerIds` set on GameRoom; reject rejoin | S | Kicked players can currently rejoin immediately |
| E3 | Bot timer leak on rapid disconnect/reconnect | S | `unsubstitute()` should cancel `botTurnTimers` |
| E4 | Room cleanup when all humans gone during play | S | `shouldCleanup()` leaves zombie 'playing' rooms in `/api/rooms` |
| E5 | AFK rate — persist lifetime afk count to profile (already started) | S | `afk_count` column exists; just need to surface it clearly |
| E6 | Heartbeat layer — server sends `heartbeat` every 15 s; client echoes | M | Socket.IO covers most cases; adds extra safety net |

### Code structure  *(flag raised after size audit, May 2026)*

| # | Item | Effort | Notes |
|---|------|--------|-------|
| C1 | Split `server.js` (1 650 lines) into `routes/social.js` + `sockets/game.js` + `sockets/social.js` | M | Extract when next major feature touches server.js |
| C2 | Split `Lobby.jsx` (1 170 lines) — extract auth modal, collection modal, leaderboard modal | M | Extract when next modal is added |

### Social features

| # | Item | Effort | Notes |
|---|------|--------|-------|
| S1 | Report player (abuse report → admin queue) | M | |
| S2 | Incognito mode — hide online status | S | Toggle on socket `authenticate`; skip `friend_online` broadcast |
| S3 | Invite friend to current room directly from Friends tab | S | Emit socket event to friend's socketId |

### Tournaments

| # | Item | Effort | Notes |
|---|------|--------|-------|
| T1 | Tournament bracket / group system | L | Create/join tournaments, schedule rounds, auto-advance |
| T2 | Tournament leaderboard | M | Depends on T1 |

### Monetisation / economy

| # | Item | Effort | Notes |
|---|------|--------|-------|
| M1 | Shop — purchasable card themes, avatars, table themes | L | Requires Stripe or equivalent |
| M2 | VIP tier — cosmetics + ranked queue access | L | Depends on M1 |
| M3 | Rewarded ads → token grants | M | |
| M4 | Gifting system | M | Send cosmetics/tokens to friends |

### Cosmetics

| # | Item | Effort | Notes |
|---|------|--------|-------|
| X1 | Layered avatar builder (skin, hair, clothes, accessories) | L | Full character customisation |
| X2 | Special status / title equippable on profile | S | Crown / flair next to username |
| X3 | More card deck themes | S | Additional sprite sheets or vector sets |

### Quality of life

| # | Item | Effort | Notes |
|---|------|--------|-------|
| Q1 | Email verification + account recovery (password reset via email) | M | SMTP or SendGrid |
| Q2 | Push notifications (OneSignal) — friend request, game invite | M | |
| Q3 | Multi-device session management — see and disconnect old devices | S | |
| Q4 | In-game protest / flag illegal move | M | |
| Q5 | Background music / soundtrack | M | Channel selector per user preference |

---

## Won't do (conscious decisions)

- **Strip Mode** — game variant from jok.ge; not relevant to our audience
- **GraphQL** — REST + Socket.io is simpler and sufficient at this scale
