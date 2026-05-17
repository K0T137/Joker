# Game Engine — Resilience Fixes

From jok.ge bundle analysis vs our current `server.js` + `GameRoom.js`.  
Reference bundle: `Joker/competitor/jok-ge/main-GILHXYUZ.js`

---

## What they have that we don't (stress/crash hardening)

### 1. AFK Rate — cumulative per player, not just per session
**Them:** `afkRate` is a numeric field on the player *profile* (persisted to DB). Every time a player is substituted for inactivity it increments their lifetime AFK rate. This is shown on their profile and affects matchmaking.  
**Us:** We substitute (`player_substituted`) and nothing is saved. Griefers can repeatedly AFK with zero consequence.  
**Fix:** On each `player_substituted` event, write an `afk_event` to DB. Surface `afkRate` from player stats.  
**Files:** `server.js` (substitution handler ~L1463–1471), `db.js`, `profile` route

---

### 2. Kicked-player memory — prevent immediate re-join
**Them:** `kickedUserIds` tracked on the room object.  
**Us:** Kick removes socket from room but we don't store who was kicked, so they can immediately rejoin.  
**Fix:** Add `this.kickedPlayerIds = new Set()` to `GameRoom`. In `kick_player` handler, add target to set. In `join_game` handler, reject if playerId is in `kickedPlayerIds`.  
**Files:** `GameRoom.js` (constructor + kick logic), `server.js` join handler

---

### 3. Heartbeat monitoring (separate from Socket.IO ping)
**Them:** `heartbeats` / `heartbeats_missed` counters tracked per-connection. If heartbeats are missed past a threshold, client triggers reconnect. Separate from Socket.IO's built-in ping/pong.  
**Us:** We rely entirely on Socket.IO's built-in ping/pong. If Socket.IO stays connected but the game layer freezes (e.g. event loop block), we have no fallback.  
**Fix:** Every 15s server sends `heartbeat` to each player in an active game. Client echoes back. If 2+ missed: server logs it and starts substitution timer early.  
**Files:** New `heartbeatIntervals` Map in `server.js`, send on `game_started`, clear on `disconnect`/`game_over`

---

### 4. Reconnect jitter — avoid thundering herd on server restart
**Them:** `reconnectJitter: 100`, `reconnectJitterTLS: 1000`, `reconnectDelayHandler` (custom exponential function).  
**Us:** Socket.IO default reconnect — all clients hammer the server simultaneously on restart.  
**Fix (frontend):** In `socket.js` or wherever `io()` is initialized, pass:
```js
{ reconnectionDelay: 500, reconnectionDelayMax: 5000, randomizationFactor: 0.5 }
```
This spreads reconnects over 0–5s window instead of all-at-once.  
**Files:** `Joker/frontend/src/socket.js` (or equivalent)

---

### 5. UNRECOVERABLE_STATE — explicit stuck-game detection
**Them:** `UNRECOVERABLE_STATE` is an explicit constant with its own handling path.  
**Us:** If `gameState` gets into a phase mismatch (e.g. PHASE is `BIDDING` but all bids are placed and nobody advanced), the game silently hangs. No detection, no recovery.  
**Fix:** In the 30s `syncInterval`, check:
- If `status === 'playing'` and `gameState.phase === PHASES.BIDDING` but `gameState.allPlayersBid()` is true → force-advance
- If all human players are `socketId === null` for >5 min → call `endGame('abandoned')`
- If `currentTrick` has cards from all players but `trickWinnerId` was never set → re-emit `trick_complete`  
**Files:** `server.js` sync interval handler (~L81)

---

### 6. State guard on every action — reject stale events
**Them:** GraphQL mutations naturally validate phase server-side (phase mismatch = mutation error).  
**Us:** Each `socket.on('play_card')`, `socket.on('submit_bid')` etc. checks `gameState.phase` but only at the start. A delayed/buffered socket event can slip through if the phase just changed.  
**Fix:** Add an atomic check-and-act pattern:
```js
const expectedPhase = PHASES.PLAYING;
if (gameRoom.gameState.phase !== expectedPhase) {
  callback?.({ success: false, error: 'Wrong phase' }); return;
}
```
This already exists partially — audit every handler to make sure none are missing the guard.  
**Files:** `server.js` all socket.on handlers

---

### 7. Reconnect payload — wrap in try/catch
**Them:** Resilient reconnect state delivery with fallback  
**Us:** `getReconnectPayload()` calls `gs.getState()` — if `gameState` is partially initialized this throws and crashes the reconnect handler.  
**Fix:**
```js
getReconnectPayload(playerId) {
  try {
    const gs = this.gameState;
    return {
      gameState:    gs ? gs.getState() : null,
      hand:         gs ? gs.getPlayerHand(playerId) : [],
      actionLog:    gs ? gs.getActionLog() : [],
      roundHistory: this.roundHistory,
    };
  } catch (err) {
    console.error('[reconnect] payload error:', err);
    return { gameState: null, hand: [], actionLog: [], roundHistory: this.roundHistory };
  }
}
```
**Files:** `GameRoom.js:91`

---

### 8. Room state at game end — don't leave 'playing' rooms as zombies
**Them:** `finishGame` mutation + explicit `STOPPED` status.  
**Us:** When last human disconnects during a game, `shouldCleanup()` returns true after `ROOM_MAX_AGE_MS` (probably 10min). But the room stays `status: 'playing'` and appears in `/api/rooms` as an active game.  
**Fix:** In `shouldCleanup()`, also check: if `status === 'playing'` and all humans are disconnected → immediately return true (or set `status: 'abandoned'`).  
**Files:** `GameRoom.js:111-115`

---

### 9. Bot turn timer leak on rapid disconnect/reconnect
**Them:** Clean state machine transitions prevent double-timers  
**Us:** `botTurnTimers` (Map) keyed by roomId. If a bot's turn timer fires while a substituted human simultaneously reconnects and acts, the bot timer is already queued. It will try to act for a player who just played → likely a `Wrong turn` error but still noisy.  
**Fix:** In `unsubstitute()`, also cancel `botTurnTimers.get(roomId)` before re-assigning control.  
**Files:** `server.js:329` `unsubstitute()` function

---

## Priority order for implementation

| # | Fix | Effort | Impact |
|---|-----|--------|--------|
| 1 | Reconnect jitter (frontend) | 5 min | High — prevents server DoS on restart |
| 2 | Reconnect payload try/catch | 5 min | High — prevents crash on reconnect |
| 3 | State guard audit | 30 min | High — prevents wrong-phase hangs |
| 4 | Bot timer leak fix | 15 min | Medium — reduces error log noise |
| 5 | Kicked-player memory | 20 min | Medium — UX improvement |
| 6 | UNRECOVERABLE_STATE detector in sync interval | 45 min | Medium — catches rare stuck games |
| 7 | AFK rate to DB | 1 hr | Low-medium — nice long term |
| 8 | Room cleanup on all-humans-disconnected | 15 min | Medium — cleans /api/rooms |
| 9 | Heartbeat layer | 1 hr | Low — Socket.IO covers most cases already |
