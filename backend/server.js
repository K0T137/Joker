import 'dotenv/config'
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import crypto from 'crypto';
import passport from 'passport';
import { GameRoom } from './src/GameRoom.js';
import { BotPlayer } from './src/BotPlayer.js';
import { Scorer } from './src/gameEngine/Scorer.js';
import { PHASES } from './src/gameEngine/constants.js';
import { GameLogger } from './src/GameLogger.js';
import {
  MAX_PLAYERS, SUBSTITUTION_DELAY_MS, ROOM_AUTO_START_DELAY, STATE_SYNC_INTERVAL, ROOM_CLEANUP_INTERVAL,
  CHAT_RATE_LIMIT, CHAT_RATE_WINDOW_MS, CHAT_HISTORY_SIZE, CHAT_MAX_LENGTH,
  BOT_NAMES, BOT_MAX_FAILURES, BOT_DELAYS,
  HISHT_PENALTY_DEFAULT, HISHT_PENALTY_OPTIONS_CLASSIC, HISHT_PENALTY_OPTIONS_ONLY9, HISHT_PENALTY_OPTIONS_QUICK,
} from './src/config.js';
import jwt           from 'jsonwebtoken';
import authRouter    from './src/routes/auth.js';
import profileRouter from './src/routes/profile.js';
import { requireAuth, JWT_SECRET } from './src/utils/auth.js';
import {
  runMigrations,
  saveGameResult,
  getLeaderboard,
  getKing,
  getPlayerStats,
  getPlayerGameLog,
  incrementAfkCount,
  decrementHonorRate,
  getPlayerMeta,
  createRoomRecord,
  saveRoomState,
  loadActiveRooms,
  markRoomAbandoned,
  createGameRecord,
  insertRound,
  completeRound,
  insertRoundDeals,
  insertBid,
  updateBidTricksWon,
  insertTrick,
  insertTrickPlays,
  insertPulkaScores,
  computeGameTokenDeltas,
  searchUsers,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  getFriends,
  getPendingRequests,
  blockUser,
  unblockUser,
  getBlockedUsers,
} from './src/db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use(passport.initialize());

const httpServer = createServer(app);

// In production the frontend is served from the same origin — no CORS needed.
// In development reflect the request origin so any localhost port works.
const isProd = !!process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production';

app.use((req, res, next) => {
  if (!isProd) {
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Vary', 'Origin');
    if (req.method === 'OPTIONS') { res.sendStatus(200); return; }
  }
  next();
});

const io = new Server(httpServer, {
  cors: isProd ? false : { origin: true, methods: ['GET', 'POST'] },
});

const gameRooms          = new Map();
const playerSockets      = new Map();
const substitutionTimers = new Map(); // playerId  → disconnect-substitution timeout
const turnTimers         = new Map(); // roomId    → { timer, playerId } inactivity timeout
const botFailCounts      = new Map(); // roomId    → consecutive error count
const botTurnTimers      = new Map(); // roomId    → pending bot-turn setTimeout handle
const loggers            = new Map(); // roomId    → GameLogger
const syncIntervals      = new Map(); // roomId    → setInterval handle (30s state broadcast)
const chatHistories      = new Map(); // roomId    → last 50 chat messages
const gameStartedAt      = new Map(); // roomId    → Date when game began (for DB)
const roomStartTimers    = new Map(); // roomId    → auto-start timer handle
const dbGameIds          = new Map(); // roomId    → UUID of current games row
const dbRoundIds         = new Map(); // roomId    → UUID of current rounds row
const dbBidOrders        = new Map(); // roomId    → running bid order counter
const chatRateLimits     = new Map(); // socketId  → { count, windowStart }
const onlineUsers        = new Map(); // userId    → socketId
const heartbeatIntervals = new Map(); // roomId    → setInterval handle (15s liveness ping)
const heartbeatMissed    = new Map(); // socketId  → consecutive missed heartbeat count
const lobbyMessages      = [];        // last 50 lobby chat messages
const lobbyChatRates     = new Map(); // socketId  → { count, windowStart }
const matchmakingQueues  = new Map(); // key: '{gameMode}:{isRanked}' -> [{ socketId, playerName, userId, joinedAt }]


// ── Password helpers ──────────────────────────────────────────────────────────

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256').update(pw + salt).digest('hex');
  return `${salt}:${hash}`;
}

function checkPassword(pw, stored) {
  const [salt, hash] = stored.split(':');
  return crypto.createHash('sha256').update(pw + salt).digest('hex') === hash;
}

// ── HTTP API ──────────────────────────────────────────────────────────────────

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth',    authRouter);
app.use('/api/profile', profileRouter);

app.get('/api/leaderboard', async (req, res) => {
  if (!process.env.DATABASE_URL) return res.json([]);
  try {
    res.json(await getLeaderboard(20));
  } catch (err) {
    console.error('leaderboard error:', err.message);
    res.json([]);
  }
});

app.get('/api/leaderboard/king', async (req, res) => {
  if (!process.env.DATABASE_URL) return res.json({});
  try {
    const king = await getKing();
    res.json(king ? { userId: king.id, username: king.username } : {});
  } catch (err) {
    console.error('king error:', err.message);
    res.json({});
  }
});

app.get('/api/stats/:userId', async (req, res) => {
  if (!process.env.DATABASE_URL) return res.status(404).json({ error: 'DB not configured' });
  try {
    const data = await getPlayerStats(req.params.userId);
    if (!data) return res.status(404).json({ error: 'Not found' });
    res.json(data);
  } catch (err) {
    console.error('stats error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stats/:userId/games', async (req, res) => {
  if (!process.env.DATABASE_URL) return res.json([]);
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const data = await getPlayerGameLog(req.params.userId, limit);
    res.json(data);
  } catch (err) {
    console.error('game-log error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Social REST endpoints ─────────────────────────────────────────────────────

app.get('/api/users/search', requireAuth, async (req, res) => {
  if (!process.env.DATABASE_URL) return res.json([]);
  try {
    const results = await searchUsers(req.query.q ?? '', req.user.id);
    res.json(results);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/friends', requireAuth, async (req, res) => {
  if (!process.env.DATABASE_URL) return res.json([]);
  try {
    const friends = await getFriends(req.user.id);
    res.json(friends.map(f => ({ ...f, online: onlineUsers.has(f.id) })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/friends/pending', requireAuth, async (req, res) => {
  if (!process.env.DATABASE_URL) return res.json({ incoming: [], outgoing: [] });
  try {
    res.json(await getPendingRequests(req.user.id));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/friends/request', requireAuth, async (req, res) => {
  if (!process.env.DATABASE_URL) return res.status(503).json({ error: 'DB not configured' });
  try {
    const { addresseeId } = req.body;
    if (!addresseeId || addresseeId === req.user.id) return res.status(400).json({ error: 'Invalid' });
    await sendFriendRequest(req.user.id, addresseeId);
    // Notify the target if online
    const targetSocketId = onlineUsers.get(addresseeId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('friend_request_received', {
        from: { id: req.user.id, username: req.user.username },
      });
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/friends/accept', requireAuth, async (req, res) => {
  if (!process.env.DATABASE_URL) return res.status(503).json({ error: 'DB not configured' });
  try {
    const { requesterId } = req.body;
    await acceptFriendRequest(requesterId, req.user.id);
    const targetSocketId = onlineUsers.get(requesterId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('friend_request_accepted', {
        by: { id: req.user.id, username: req.user.username },
      });
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/friends/decline', requireAuth, async (req, res) => {
  if (!process.env.DATABASE_URL) return res.status(503).json({ error: 'DB not configured' });
  try {
    const { requesterId } = req.body;
    await declineFriendRequest(requesterId, req.user.id);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/friends/:friendId', requireAuth, async (req, res) => {
  if (!process.env.DATABASE_URL) return res.status(503).json({ error: 'DB not configured' });
  try {
    await removeFriend(req.user.id, req.params.friendId);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/blocked', requireAuth, async (req, res) => {
  if (!process.env.DATABASE_URL) return res.json([]);
  try {
    res.json(await getBlockedUsers(req.user.id));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/blocked', requireAuth, async (req, res) => {
  if (!process.env.DATABASE_URL) return res.status(503).json({ error: 'DB not configured' });
  try {
    const { blockedId } = req.body;
    if (!blockedId || blockedId === req.user.id) return res.status(400).json({ error: 'Invalid' });
    await blockUser(req.user.id, blockedId);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/blocked/:blockedId', requireAuth, async (req, res) => {
  if (!process.env.DATABASE_URL) return res.status(503).json({ error: 'DB not configured' });
  try {
    await unblockUser(req.user.id, req.params.blockedId);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/rooms', (req, res) => {
  const rooms = [];
  for (const [roomId, room] of gameRooms) {
    if (room.status === 'finished') continue;
    const humanPlayers = Array.from(room.players.values()).filter(p => !p.isBot);
    // Skip zombie playing rooms — all humans gone, nothing to join or watch
    if (room.status === 'playing' && humanPlayers.every(p => !p.socketId)) continue;
    rooms.push({
      id:             roomId,
      playerCount:    room.players.size,
      humanCount:     humanPlayers.length,
      maxPlayers:     room.maxPlayers,
      status:         room.status,
      hasPassword:    !!room.passwordHash,
      spectatorCount: room.spectatorCount,
      gameMode:       room.gameMode    ?? 'normal',
      isRanked:       !!room.isRanked,
      playInPairs:    !!room.playInPairs,
    });
  }
  res.json(rooms);
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function attachAvatar(gameRoom, playerId, userId) {
  if (!userId || !process.env.DATABASE_URL) return;
  try {
    const meta = await getPlayerMeta(userId);
    const p = gameRoom.players.get(playerId);
    if (p && meta) {
      p.avatarId     = meta.avatar_id;
      p.honorRate    = meta.honor_rate;
      p.achievements = meta.achievements;
    }
  } catch {}
}

function formatPlayers(gameRoom) {
  return Array.from(gameRoom.players.entries()).map(([id, p]) => ({
    id,
    ...p,
    isCreator: id === gameRoom.creatorId,
  }));
}

/** Snapshot the current dealt hands as { playerId: ['A♠', …] } for logging. */
function snapshotHands(gs) {
  const hands = {};
  gs.playerIds.forEach(pid => {
    hands[pid] = (gs.dealtCards[pid] ?? []).map(c => c.toString());
  });
  return hands;
}

/** Serialize the last completed trick from GameState for transmission. */
function serializeLastTrick(gs) {
  const t = gs.tricks[gs.tricks.length - 1];
  if (!t) return [];
  return t.cards.map(e => ({
    playerId: e.playerId,
    card:     e.card.toString(),
    jokerMode: e.jokerMode || null,
    takeSuit:  e.takeSuit  || null,
    giveSuit:  e.giveSuit  || null,
  }));
}

/** Record a card play to the current-trick buffer on the game room. */
function bufferCardPlay(gameRoom, playerId, card, jokerMode, takeSuit, giveSuit) {
  const p = gameRoom.players.get(playerId);
  gameRoom.currentTrickBuffer.push({
    playerId,
    playerName: p?.name ?? null,
    userId:     p?.userId ?? null,
    playOrder:  gameRoom.currentTrickBuffer.length,
    card:       typeof card === 'string' ? card : card.toString(),
    jokerMode:  jokerMode ?? null,
    takeSuit:   takeSuit  ?? null,
    giveSuit:   giveSuit  ?? null,
  });
}

/** Flush the trick buffer to DB when a trick completes. */
function persistTrick(roomId, gameRoom) {
  if (!process.env.DATABASE_URL) return;
  const roundId = dbRoundIds.get(roomId) ?? gameRoom.dbRoundId;
  if (!roundId) return;
  const gs = gameRoom.gameState;
  const lastTrick = gs.tricks[gs.tricks.length - 1];
  if (!lastTrick) return;

  const leadCard  = lastTrick.cards[0];
  const leadSuit  = leadCard?.card.isJoker() ? null : leadCard?.card.suit ?? null;
  const winner    = gameRoom.players.get(lastTrick.winner);
  const plays     = [...gameRoom.currentTrickBuffer];
  gameRoom.currentTrickBuffer = [];

  insertTrick(roundId, {
    trickNumber: gs.trickNumber,
    winnerId:    lastTrick.winner,
    winnerName:  winner?.name ?? null,
    leadSuit,
  }).then(trickId => {
    insertTrickPlays(trickId, plays).catch(e => console.error('[db] insertTrickPlays:', e.message));
    persistRoom(roomId);
  }).catch(e => console.error('[db] insertTrick:', e.message));
}

/** Persist current room state to DB — fire-and-forget, never blocks game flow. */
function persistRoom(roomId) {
  if (!process.env.DATABASE_URL) return;
  const gr = gameRooms.get(roomId);
  if (!gr) return;
  const row = gr.toDBRow();
  row.current_game_id = dbGameIds.get(roomId) ?? null;
  saveRoomState(roomId, row).catch(e => console.error('[db] saveRoomState:', e.message));
}

// ── Background sync ───────────────────────────────────────────────────────────

function startSyncInterval(roomId) {
  clearSyncInterval(roomId);
  const id = setInterval(() => {
    const gr = gameRooms.get(roomId);
    if (!gr?.gameState) return;
    io.to(roomId).emit('state_sync', {
      gameState: gr.gameState.getState(),
      players:   formatPlayers(gr),
    });
    // Push authoritative hand to each connected human to correct any client-side drift
    for (const [pid, p] of gr.players) {
      if (!p.isBot && p.socketId) {
        io.to(p.socketId).emit('hand_update', { cards: gr.gameState.getPlayerHand(pid) });
      }
    }
    // Stuck-player recovery: if the current actor has been disconnected longer than
    // the substitution window and is still not substituted, the disconnect timer
    // must have silently failed — force-substitute them now.
    if (gr.status === 'playing') {
      const gs = gr.gameState;
      const now = Date.now();
      for (const [pid, p] of gr.players) {
        if (p.isBot || p.socketId || gr.isSubstituted(pid)) continue;
        const gone = p.disconnectedAt ? now - p.disconnectedAt : 0;
        if (gone > SUBSTITUTION_DELAY_MS && !substitutionTimers.has(pid)) {
          console.warn(`[sync] force-substituting stuck player ${pid} in ${roomId} (gone ${Math.round(gone/1000)}s)`);
          gr.setSubstituted(pid, true);
          loggers.get(roomId)?.log('player_substituted', { playerId: pid, reason: 'stuck' });
          io.to(roomId).emit('player_substituted', { playerId: pid, reason: 'disconnected' });
          if (process.env.DATABASE_URL && !roomHasBots(gr)) incrementAfkCount(p.userId).catch(() => {});
          scheduleBotTurn(roomId);
        }
      }

      // UNRECOVERABLE_STATE: phase-mismatch detection. Catches games that get
      // stuck because a state-transition event was dropped (e.g. a bot timer that
      // fired while the event loop was saturated).
      const gs2 = gr.gameState;
      if (gs2.phase === PHASES.BIDDING && gs2.allPlayersBid()) {
        console.warn(`[sync] UNRECOVERABLE: all bids placed but phase stuck in BIDDING — forcing advance in ${roomId}`);
        gs2.phase = PHASES.PLAYING;
        loggers.get(roomId)?.log('unrecoverable_state', { phase: 'BIDDING', action: 'force_advance' });
        scheduleBotTurn(roomId);
      } else if (gs2.phase === PHASES.PLAYING && gs2.isRoundComplete()) {
        console.warn(`[sync] UNRECOVERABLE: round complete but stuck in PLAYING — forcing round end in ${roomId}`);
        loggers.get(roomId)?.log('unrecoverable_state', { phase: 'PLAYING', action: 'force_round_end' });
        const continues = handleRoundEnd(roomId, gr);
        if (continues) scheduleBotTurn(roomId);
      }
    }
  }, STATE_SYNC_INTERVAL);
  syncIntervals.set(roomId, id);
}

function clearSyncInterval(roomId) {
  const id = syncIntervals.get(roomId);
  if (id != null) { clearInterval(id); syncIntervals.delete(roomId); }
}

function startHeartbeat(roomId) {
  clearHeartbeat(roomId);
  const id = setInterval(() => {
    const gr = gameRooms.get(roomId);
    if (!gr || gr.status !== 'playing') return;
    for (const [pid, p] of gr.players) {
      if (p.isBot || !p.socketId || gr.isSubstituted(pid)) continue;
      const missed = (heartbeatMissed.get(p.socketId) ?? 0) + 1;
      heartbeatMissed.set(p.socketId, missed);
      io.to(p.socketId).emit('heartbeat');
      // After 2 missed beats push a full state refresh to try to unstick the client.
      // Substitution is left entirely to the existing disconnect / turn-timer path.
      if (missed >= 2) {
        console.warn(`[heartbeat] ${pid} missed ${missed} beats in ${roomId} — pushing state refresh`);
        io.to(p.socketId).emit('state_sync', {
          gameState: gr.gameState?.getState() ?? null,
          players:   formatPlayers(gr),
        });
        if (gr.gameState) {
          io.to(p.socketId).emit('hand_update', { cards: gr.gameState.getPlayerHand(pid) });
        }
      }
    }
  }, 15_000);
  heartbeatIntervals.set(roomId, id);
}

function clearHeartbeat(roomId) {
  const id = heartbeatIntervals.get(roomId);
  if (id != null) { clearInterval(id); heartbeatIntervals.delete(roomId); }
}

// ── Substitution helpers ──────────────────────────────────────────────────────

/** Atomically clear all per-player timers: substitution timeout + turn timer. */
function cleanupPlayerTimers(roomId, playerId) {
  const subTimer = substitutionTimers.get(playerId);
  if (subTimer) { clearTimeout(subTimer); substitutionTimers.delete(playerId); }
  clearTurnTimer(roomId);
}

/** Clear any inactivity turn-timer for a room and notify clients. */
function clearTurnTimer(roomId) {
  const entry = turnTimers.get(roomId);
  if (entry) {
    clearTimeout(entry.timer);
    turnTimers.delete(roomId);
    io.to(roomId).emit('turn_timer_cancelled', { playerId: entry.playerId });
  }
}

// Returns true when at least one seat was originally a bot — honor/AFK penalties
// only apply to all-human games.
function roomHasBots(gr) {
  for (const [, p] of gr.players) { if (p.isBot) return true }
  return false
}

/**
 * Start (or restart) a 2-minute inactivity timer for the player whose turn it
 * currently is.  When it fires the player is marked as substituted and the bot
 * engine takes over their turns until they act again.
 */
function resetTurnTimer(roomId) {
  clearTurnTimer(roomId);
  const gameRoom = gameRooms.get(roomId);
  if (!gameRoom?.gameState) return;
  const gs = gameRoom.gameState;

  let actorId = null;
  if (gs.phase === PHASES.TRUMP_SELECTION) actorId = gameRoom.getTrumpSelectorId();
  else if (gs.phase === PHASES.BIDDING)    actorId = gs.getCurrentBidder();
  else if (gs.phase === PHASES.PLAYING)    actorId = gs.getCurrentPlayer();

  if (!actorId) return;
  const player = gameRoom.players.get(actorId);
  // Only time-out connected, non-bot, non-already-substituted humans
  if (!player || player.isBot || gameRoom.isSubstituted(actorId) || !player.socketId) return;

  const timer = setTimeout(() => {
    turnTimers.delete(roomId);
    const gr = gameRooms.get(roomId);
    if (!gr) return;
    const p = gr.players.get(actorId);
    if (!p || !p.socketId) return; // disconnected — disconnect timer handles it
    gr.setSubstituted(actorId, true);
    loggers.get(roomId)?.log('player_substituted', { playerId: actorId, reason: 'inactive' });
    io.to(roomId).emit('player_substituted', { playerId: actorId, reason: 'inactive' });
    console.log(`[sub] ${actorId} substituted (inactive) in ${roomId}`);
    if (process.env.DATABASE_URL && !roomHasBots(gr)) incrementAfkCount(p.userId).catch(() => {});
    scheduleBotTurn(roomId);
  }, SUBSTITUTION_DELAY_MS);

  turnTimers.set(roomId, { timer, playerId: actorId });
  io.to(roomId).emit('turn_timer_started', {
    playerId: actorId,
    endsAt:   Date.now() + SUBSTITUTION_DELAY_MS,
  });
}

/**
 * Un-substitute a player after they act (inactivity case) or reconnect
 * (disconnect case).  Clears the disconnect timer and the turn timer.
 */
function unsubstitute(roomId, playerId) {
  cleanupPlayerTimers(roomId, playerId);
  cancelBotTurn(roomId); // stale bot timer must not fire after player resumes

  const gameRoom = gameRooms.get(roomId);
  if (!gameRoom) return;
  const wasSubstituted = gameRoom.isSubstituted(playerId);
  gameRoom.setSubstituted(playerId, false);
  if (wasSubstituted) {
    loggers.get(roomId)?.log('player_resumed', { playerId });
    io.to(roomId).emit('player_resumed', { playerId });
    console.log(`[sub] ${playerId} resumed in ${roomId}`);
  }
}

/**
 * Push the player's current authoritative hand to their specific socket.
 * Called after bot acts on behalf of a substituted player so their client
 * stays in sync and can reclaim control without stale cards.
 */
function emitHandUpdate(roomId, playerId) {
  const gameRoom = gameRooms.get(roomId);
  if (!gameRoom?.gameState) return;
  const playerEntry = gameRoom.players.get(playerId);
  if (!playerEntry?.socketId) return;
  const cards = gameRoom.gameState.getPlayerHand(playerId);
  io.to(playerEntry.socketId).emit('hand_update', { cards });
}

/**
 * Build and emit a `round_started` event that works for both normal rounds
 * (phase='bidding') and 9-card rounds (phase='trump_selection').
 */
function emitRoundStarted(roomId, gameRoom) {
  const gs = gameRoom.gameState;
  const dealerPlayerId = gs.playerIds[gameRoom.dealerIndex];

  if (gs.phase === PHASES.TRUMP_SELECTION) {
    io.to(roomId).emit('round_started', {
      phase:           'trump_selection',
      trump:           null,
      trumpCard:       null,
      trumpSelectorId: gameRoom.getTrumpSelectorId(),
      roundNumber:     gs.roundNumber,
      pulkaNumber:     gs.pulkaNumber,
      dealerPlayerId,
    });
  } else {
    io.to(roomId).emit('round_started', {
      phase:          'bidding',
      trump:          gs.trump,
      trumpCard:      gs.trumpCard,
      roundNumber:    gs.roundNumber,
      pulkaNumber:    gs.pulkaNumber,
      dealerPlayerId,
      currentBidder:  gs.getCurrentBidder(),
    });
  }

  loggers.get(roomId)?.log('round_started', {
    roundNumber:     gs.roundNumber,
    pulkaNumber:     gs.pulkaNumber,
    cardsInRound:    gs.cardsInRound,
    phase:           gs.phase,
    trump:           gs.trump ?? null,
    dealerPlayerId,
    trumpSelectorId: gs.phase === PHASES.TRUMP_SELECTION ? gameRoom.getTrumpSelectorId() : null,
    hands:           snapshotHands(gs),
  });

  // DB: log round + dealt hands (fire-and-forget)
  if (process.env.DATABASE_URL) {
    const gameId = dbGameIds.get(roomId) ?? gameRoom.dbGameId;
    if (gameId) {
      dbBidOrders.set(roomId, 0);
      insertRound(gameId, {
        roundNumber:    gs.roundNumber,
        pulkaNumber:    gs.pulkaNumber,
        cardsPerPlayer: gs.cardsInRound,
        trump:          gs.phase !== PHASES.TRUMP_SELECTION ? gs.trump : null,
        trumpCard:      gs.trumpCard ?? null,
        dealerId:       dealerPlayerId,
      }).then(roundId => {
        dbRoundIds.set(roomId, roundId);
        gameRoom.dbRoundId = roundId;
        const deals = gs.playerIds.map(pid => {
          const p = gameRoom.players.get(pid);
          return { playerId: pid, playerName: p?.name ?? null, userId: p?.userId ?? null,
                   cards: (gs.dealtCards[pid] ?? []).map(c => c.toString()) };
        });
        insertRoundDeals(roundId, deals).catch(e => console.error('[db] insertRoundDeals:', e.message));
        persistRoom(roomId);
      }).catch(e => console.error('[db] insertRound:', e.message));
    }
  }
}

// ── Bot turn engine ────────────────────────────────────────────────────────────

function cancelBotTurn(roomId) {
  const handle = botTurnTimers.get(roomId);
  if (handle != null) { clearTimeout(handle); botTurnTimers.delete(roomId); }
}

function cancelRoomStart(roomId) {
  const handle = roomStartTimers.get(roomId);
  if (handle != null) { clearTimeout(handle); roomStartTimers.delete(roomId); }
}

function scheduleRoomStart(roomId, gameRoom) {
  cancelRoomStart(roomId);
  io.to(roomId).emit('room_full', { autoStartIn: ROOM_AUTO_START_DELAY / 1000 });
  const handle = setTimeout(() => {
    roomStartTimers.delete(roomId);
    const gr = gameRooms.get(roomId);
    if (!gr || gr.status !== 'waiting' || gr.players.size < gr.maxPlayers) return;
    // Mark any non-ready human as ready, then start
    for (const [, p] of gr.players) { if (!p.ready) p.ready = true; }
    startGameInRoom(roomId, gr);
  }, ROOM_AUTO_START_DELAY);
  roomStartTimers.set(roomId, handle);
}

function scheduleBotTurn(roomId, delayMs = BOT_DELAYS.normal) {
  // Cancel any pending bot-turn timer for this room — prevents stale timers
  // (e.g. from a mid-trick 1200ms schedule) from firing after a trick completes early.
  cancelBotTurn(roomId);
  const handle = setTimeout(() => {
    botTurnTimers.delete(roomId);
    const gr = gameRooms.get(roomId);
    if (gr) processBotTurn(roomId, gr);
  }, delayMs);
  botTurnTimers.set(roomId, handle);
}

function processBotTurn(roomId, gameRoom) {
  const gs = gameRoom.gameState;
  if (!gs) return;

  // ── Trump selection (9-card rounds) ─────────────────────────────────────────
  if (gs.phase === PHASES.TRUMP_SELECTION) {
    const selectorId = gameRoom.getTrumpSelectorId();
    if (!selectorId) return;
    if (!gameRoom.isBot(selectorId) && !gameRoom.isSubstituted(selectorId)) {
      resetTurnTimer(roomId); return;
    }

    const hand  = gs.dealtCards[selectorId];
    if (!hand || hand.length === 0) return;
    const trump = BotPlayer.pickTrump(hand);
    gameRoom.selectTrump(trump);

    loggers.get(roomId)?.log('trump_selected', {
      playerId: selectorId,
      trump:    gs.trump,
      hands:    snapshotHands(gs),
    });

    io.to(roomId).emit('trump_selected', {
      trump:          gs.trump,
      trumpCard:      null,
      phase:          'bidding',
      currentBidder:  gs.getCurrentBidder(),
    });
    scheduleBotTurn(roomId, BOT_DELAYS.trumpSelect);
    return;
  }

  // ── Bidding ──────────────────────────────────────────────────────────────────
  if (gs.phase === PHASES.BIDDING) {
    const nextBidder = gs.getCurrentBidder();
    if (!nextBidder) return;
    if (!gameRoom.isBot(nextBidder) && !gameRoom.isSubstituted(nextBidder)) {
      resetTurnTimer(roomId); return;
    }

    const hand = gs.dealtCards[nextBidder];
    if (!hand || hand.length === 0) return;
    const placedBids = Object.values(gs.bids).filter(b => b !== null && b !== undefined);
    let forbiddenBid = null;
    if (placedBids.length === gs.playerIds.length - 1) {
      const othersTotal = placedBids.reduce((a, b) => a + b, 0);
      const candidate = hand.length - othersTotal;
      if (candidate >= 0 && candidate <= hand.length) forbiddenBid = candidate;
    }

    const bid = BotPlayer.pickBid(hand, gs.trump, forbiddenBid);

    try {
      const ok = gs.recordBid(nextBidder, bid);
      if (!ok) {
        const safeBid = forbiddenBid !== 0 ? forbiddenBid - 1 : Math.min(1, hand.length);
        gs.recordBid(nextBidder, safeBid);
      }
      loggers.get(roomId)?.log('bid_placed', {
        playerId: nextBidder,
        bid:      gs.bids[nextBidder],
        allBids:  { ...gs.bids },
      });
      io.to(roomId).emit('bid_placed', { playerId: nextBidder, bid: gs.bids[nextBidder], allBids: gs.bids, currentBidder: gs.getCurrentBidder() });

      if (process.env.DATABASE_URL) {
        const roundId = dbRoundIds.get(roomId) ?? gameRoom.dbRoundId;
        if (roundId) {
          const order = (dbBidOrders.get(roomId) ?? 0);
          dbBidOrders.set(roomId, order + 1);
          const p = gameRoom.players.get(nextBidder);
          insertBid(roundId, { playerId: nextBidder, playerName: p?.name ?? null, userId: p?.userId ?? null,
                               bid: gs.bids[nextBidder], bidOrder: order })
            .catch(e => console.error('[db] insertBid(bot):', e.message));
        }
      }

      const isLastBid = gs.allPlayersBid();
      if (isLastBid) {
        io.to(roomId).emit('bidding_complete', {
          bids:         gs.bids,
          currentPlayer: gs.getCurrentPlayer(),
          cardsInRound: gs.cardsInRound,
        });
      }
      if (gameRoom.isSubstituted(nextBidder)) emitHandUpdate(roomId, nextBidder);
      scheduleBotTurn(roomId, isLastBid ? BOT_DELAYS.afterLastBid : BOT_DELAYS.normal);
    } catch (e) {
      console.error('Bot bid error:', e.message);
      scheduleBotTurn(roomId, BOT_DELAYS.bidRetry);
    }
    return;
  }

  // ── Playing ──────────────────────────────────────────────────────────────────
  if (gs.phase === PHASES.PLAYING) {
    const nextPlayer = gs.getCurrentPlayer();
    if (!nextPlayer) return;

    // Round-complete check must come BEFORE the human-player guard.
    // After a bot plays the last card of a round, scheduleBotTurn fires with
    // nextPlayer = the trick winner (who would lead the next trick). That winner
    // may be a non-substituted human — if we returned early there, handleRoundEnd
    // would never be called and the game would get stuck.
    const hand = gs.dealtCards[nextPlayer];
    if (!hand || hand.length === 0) {
      if (gs.isRoundComplete()) {
        const continues = handleRoundEnd(roomId, gameRoom);
        if (continues) scheduleBotTurn(roomId);
      }
      return;
    }

    if (!gameRoom.isBot(nextPlayer) && !gameRoom.isSubstituted(nextPlayer)) {
      resetTurnTimer(roomId); return;
    }

    const play = BotPlayer.pickCard(hand, gs.currentTrick, gs.trump, {
      myId:         nextPlayer,
      playerIds:    gs.playerIds,
      bids:         gs.bids,
      tricksCounts: gs.tricksCounts,
      cardsInRound: gs.cardsInRound,
      gameScores:   gs.gameScores,
    });

    if (!play || !play.card) {
      console.error(`Bot ${nextPlayer} could not select a card in room ${roomId}`, {
        phase: gs.phase, trick: gs.currentTrick.length, hand: hand.map(c => c.toString()),
      });
      return;
    }

    const { card, jokerMode, takeSuit, giveSuit } = play;

    try {
      const result = gameRoom.playCard(nextPlayer, card.toString(), jokerMode, takeSuit, giveSuit);
      botFailCounts.delete(roomId);

      bufferCardPlay(gameRoom, nextPlayer, card, jokerMode, takeSuit, giveSuit);
      loggers.get(roomId)?.log('card_played', {
        playerId:    nextPlayer,
        card:        card.toString(),
        jokerMode:   jokerMode || null,
        takeSuit:    takeSuit  || null,
        giveSuit:    giveSuit  || null,
        trickNumber: gs.trickNumber,
      });

      io.to(roomId).emit('card_played', {
        playerId:      nextPlayer,
        card:          card.toString(),
        currentPlayer: gs.getCurrentPlayer(),
        jokerMode:     jokerMode || null,
        takeSuit:      takeSuit  || null,
        giveSuit:      giveSuit  || null,
        // Authoritative trick state (null when trick just completed — trick_resolved carries trickCards)
        currentTrick:  result.trickComplete ? null : gs.currentTrick.map(e => ({
          playerId: e.playerId, card: e.card.toString(),
          jokerMode: e.jokerMode || null, takeSuit: e.takeSuit || null, giveSuit: e.giveSuit || null,
        })),
      });

      // Keep substituted player's hand in sync so they can reclaim control cleanly
      if (gameRoom.isSubstituted(nextPlayer)) emitHandUpdate(roomId, nextPlayer);

      if (result.trickComplete) {
        persistTrick(roomId, gameRoom);
        loggers.get(roomId)?.log('trick_resolved', {
          trickNumber:  gs.trickNumber,
          winnerId:     result.trickResult.winnerId,
          tricksCounts: { ...gs.tricksCounts },
          cards:        serializeLastTrick(gs),
        });
        io.to(roomId).emit('trick_resolved', {
          winnerId:      result.trickResult.winnerId,
          tricksCounts:  { ...gs.tricksCounts },
          currentPlayer: result.trickResult.winnerId,
          trickCards:    serializeLastTrick(gs),
        });

        // scheduleBotTurn keeps this cancellable by reclaim_control.
        // If round is complete, the next processBotTurn call will find empty hands
        // and call handleRoundEnd directly.
        scheduleBotTurn(roomId, BOT_DELAYS.afterTrick);
        return;
      }
      scheduleBotTurn(roomId, BOT_DELAYS.betweenPlays);
    } catch (e) {
      console.error('Bot play error:', e.message);
      const fails = (botFailCounts.get(roomId) ?? 0) + 1;
      botFailCounts.set(roomId, fails);
      if (fails >= BOT_MAX_FAILURES) {
        console.error(`Bot in room ${roomId} failed ${fails}× in a row — stopping retry`);
        botFailCounts.delete(roomId);
        io.to(roomId).emit('bot_error', {
          message: 'Bot failed to play after 3 attempts — game may be stuck. Please refresh.',
        });
        return;
      }
      scheduleBotTurn(roomId, BOT_DELAYS.playRetry);
    }
  }
}

function handleRoundEnd(roomId, gameRoom) {
  const gs = gameRoom.gameState;

  // Sanity check: if bids or tricksCounts look wrong, a stale timer has fired for a
  // round that already ended. Log and bail out rather than emit corrupt scores.
  const totalTricks = Object.values(gs.tricksCounts).reduce((a, b) => a + (b || 0), 0);
  const anyNullBid  = gs.playerIds.some(pid => gs.bids[pid] == null);
  if (gs.phase !== PHASES.PLAYING || anyNullBid || totalTricks !== gs.cardsInRound) {
    console.error(
      `handleRoundEnd called in invalid state for room ${roomId}: ` +
      `phase=${gs.phase} totalTricks=${totalTricks} cardsInRound=${gs.cardsInRound} anyNullBid=${anyNullBid}`
    );
    return false;
  }

  const snap = {
    roundNumber:  gs.roundNumber,
    pulkaNumber:  gs.pulkaNumber,
    bids:         { ...gs.bids },
    tricks:       { ...gs.tricksCounts },
    cardsInRound: gs.cardsInRound,
  };

  const roundResult = gameRoom.endRound();

  const { hishtMode, hishtPenalty } = gameRoom.resolveHisht(snap.pulkaNumber);
  const scores = {};
  gs.playerIds.forEach(pid => {
    scores[pid] = Scorer.calculateRoundScore(
      snap.bids[pid], snap.tricks[pid], snap.cardsInRound, hishtMode, hishtPenalty
    );
  });

  const pulkaComplete = !!roundResult?.pulkaComplete;
  const gameComplete  = !!roundResult?.gameComplete;
  const pulkaScores   = roundResult?.scores ?? null;
  const gameScores    = gameComplete ? roundResult.finalScores : { ...gameRoom.gameState.gameScores };

  loggers.get(roomId)?.log('round_ended', {
    roundNumber:  snap.roundNumber,
    pulkaNumber:  snap.pulkaNumber,
    cardsInRound: snap.cardsInRound,
    bids:         snap.bids,
    tricks:       snap.tricks,
    scores,
    pulkaComplete,
  });

  if (pulkaComplete || gameComplete) {
    loggers.get(roomId)?.log('pulka_ended', {
      pulkaNumber: snap.pulkaNumber,
      pulkaScores,
      gameScores,
    });
  }

  // DB: close round, update bid tricks_won, record pulka scores if pulka ended
  if (process.env.DATABASE_URL) {
    const roundId = dbRoundIds.get(roomId) ?? gameRoom.dbRoundId;
    const gameId  = dbGameIds.get(roomId)  ?? gameRoom.dbGameId;
    if (roundId) {
      completeRound(roundId, snap.trump ?? gs.trump).catch(e => console.error('[db] completeRound:', e.message));
      updateBidTricksWon(roundId, snap.tricks).catch(e => console.error('[db] updateBidTricksWon:', e.message));
    }
    if ((pulkaComplete || gameComplete) && gameId && pulkaScores) {
      const { hishtPenalty: hp } = gameRoom.resolveHisht(snap.pulkaNumber);
      insertPulkaScores(gameId, snap.pulkaNumber, pulkaScores, gameRoom.players, hp)
        .catch(e => console.error('[db] insertPulkaScores:', e.message));
    }
  }

  const roundEndPayload = { ...snap, scores, pulkaComplete, pulkaScores, gameScores, gameComplete };
  gameRoom.roundHistory.push(roundEndPayload);
  io.to(roomId).emit('round_ended', roundEndPayload);

  if (gameComplete) {
    const players = Array.from(gameRoom.players.entries()).map(([id, p]) => ({ id, ...p }));
    const tokenDeltas = computeGameTokenDeltas(players, roundResult.finalScores, gameRoom.roundHistory);
    loggers.get(roomId)?.log('game_ended', { finalScores: roundResult.finalScores });
    io.to(roomId).emit('game_ended', {
      finalScores:  roundResult.finalScores,
      playInPairs:  gameRoom.playInPairs,
      tokenDeltas,
      isRanked:     gameRoom.isRanked,
    });

    // Persist to DB (fire-and-forget — don't block the game flow)
    if (process.env.DATABASE_URL) {
      saveGameResult({
        gameId:       dbGameIds.get(roomId) ?? gameRoom.dbGameId,
        roomId,
        players,
        finalScores:  roundResult.finalScores,
        roundHistory: gameRoom.roundHistory,
        startedAt:    gameStartedAt.get(roomId),
        gameMode:     gameRoom.gameMode,
        isRanked:     gameRoom.isRanked,
      }).catch(err => console.error('DB save failed:', err.message));
      gameStartedAt.delete(roomId);
      markRoomAbandoned(roomId).catch(() => {});  // mark room finished
      dbGameIds.delete(roomId);
      dbRoundIds.delete(roomId);
    }

    clearSyncInterval(roomId);
    clearHeartbeat(roomId);
    return false;
  }

  if (roundResult === null) gameRoom.startNextRound();

  emitRoundStarted(roomId, gameRoom);

  // If the new round is a trump_selection, the bot may need to pick trump
  if (gameRoom.gameState.phase === PHASES.TRUMP_SELECTION) {
    scheduleBotTurn(roomId, BOT_DELAYS.trumpSelect);
  }

  return true;
}

function startGameInRoom(roomId, gameRoom) {
  const atuzovka = gameRoom.performAtuzovka();
  gameRoom.startGame();
  const gs = gameRoom.gameState;

  loggers.get(roomId)?.log('game_started', {
    playerOrder: gs.playerIds,
    players: Array.from(gameRoom.players.entries()).map(([id, p]) => ({
      id, name: p.name, isBot: p.isBot,
    })),
    dealerPlayerId: atuzovka.dealerPlayerId,
    atuzovkaCard:   atuzovka.card,
    atuzovkaDraws:  atuzovka.drawnCards,
  });

  io.to(roomId).emit('atuzovka_result', {
    dealerPlayerId: atuzovka.dealerPlayerId,
    dealerName:     gameRoom.players.get(atuzovka.dealerPlayerId)?.name,
    card:           atuzovka.card,
    drawnCards:     atuzovka.drawnCards,
  });
  io.to(roomId).emit('game_started', { gameState: gs.getState() });
  startHeartbeat(roomId);

  // First round is always 1-card (never trump_selection), but use helper for consistency
  emitRoundStarted(roomId, gameRoom);

  const animDelay = (atuzovka.drawnCards?.length ?? 5) * BOT_DELAYS.atuzovkaPerCard + BOT_DELAYS.atuzovkaBase;
  scheduleBotTurn(roomId, animDelay);
  startSyncInterval(roomId);
  chatHistories.set(roomId, []);
  const startedAt = new Date();
  gameStartedAt.set(roomId, startedAt);

  if (process.env.DATABASE_URL) {
    createGameRecord(roomId, {
      gameMode:             gameRoom.gameMode,
      hishtPenalty:         gameRoom.hishtPenalty,
      playInPairs:          gameRoom.playInPairs,
      deductions:           gameRoom.deductions,
      multiPremiaDeduction: gameRoom.multiPremiaDeduction,
      lastBidUntouchable:   gameRoom.lastBidUntouchable,
      isRanked:             gameRoom.isRanked,
    }).then(gid => {
      dbGameIds.set(roomId, gid);
      gameRoom.dbGameId = gid;
      persistRoom(roomId);
    }).catch(e => console.error('[db] createGameRecord:', e.message));
  }
}

// ── Socket handlers ───────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // ── Socket identity ────────────────────────────────────────────────────────
  socket.on('authenticate', (token) => {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      socket.authUserId = payload.id;
      socket.authUsername = payload.username;
      onlineUsers.set(payload.id, socket.id);
      // Notify friends this user came online
      if (process.env.DATABASE_URL) {
        getFriends(payload.id).then(friends => {
          for (const f of friends) {
            const sid = onlineUsers.get(f.id);
            if (sid) io.to(sid).emit('friend_online', { userId: payload.id, username: payload.username });
          }
        }).catch(() => {});
      }
    } catch { /* invalid token — ignore */ }
  });

  // ── Lobby chat ─────────────────────────────────────────────────────────────
  socket.on('lobby_join', () => {
    try {
      socket.join('lobby');
      socket.emit('lobby_history', lobbyMessages.slice(-50));
    } catch (err) {
      console.error('lobby_join error:', err);
    }
  });

  socket.on('lobby_chat_send', (text) => {
    try {
      if (!socket.authUserId || typeof text !== 'string') return;
      const clean = text.trim().slice(0, 200);
      if (!clean) return;

      // Rate limit: 4 messages per 5 seconds
      const now = Date.now();
      const rl = lobbyChatRates.get(socket.id) ?? { count: 0, windowStart: now };
      if (now - rl.windowStart > 5000) { rl.count = 0; rl.windowStart = now; }
      rl.count++;
      lobbyChatRates.set(socket.id, rl);
      if (rl.count > 4) return;

      const msg = { userId: socket.authUserId, username: socket.authUsername, text: clean, ts: now };
      lobbyMessages.push(msg);
      if (lobbyMessages.length > 50) lobbyMessages.shift();
      io.to('lobby').emit('lobby_message', msg);
    } catch (err) {
      console.error('lobby_chat_send error:', err);
    }
  });

  socket.on('create_game', async (data, callback) => {
    try {
      const {
        playerName,
        password,
        userId               = null,
        hishtPenalty         = HISHT_PENALTY_DEFAULT,
        gameMode             = 'normal',
        playInPairs          = false,
        deductions           = true,
        multiPremiaDeduction = false,
        lastBidUntouchable   = true,
        isRanked             = false,
      } = data;

      const validatedMode    = ['normal', 'only9', 'quick'].includes(gameMode) ? gameMode : 'normal';
      const validOptions     = validatedMode === 'only9' ? HISHT_PENALTY_OPTIONS_ONLY9
                             : validatedMode === 'quick'  ? HISHT_PENALTY_OPTIONS_QUICK
                             : HISHT_PENALTY_OPTIONS_CLASSIC;
      const validatedPenalty = validOptions.includes(hishtPenalty) ? hishtPenalty : HISHT_PENALTY_DEFAULT;

      const roomId   = uuidv4().substring(0, 8).toUpperCase();
      const playerId = uuidv4();

      const gameRoom = new GameRoom(roomId, MAX_PLAYERS, {
        gameMode:             validatedMode,
        hishtPenalty:         validatedPenalty,
        playInPairs:          !!playInPairs,
        deductions:           !!deductions,
        multiPremiaDeduction: !!multiPremiaDeduction,
        lastBidUntouchable:   !!lastBidUntouchable,
        isRanked:             !!isRanked,
      });

      if (password) gameRoom.passwordHash = hashPassword(password);
      gameRoom.addPlayer(playerId, socket.id, playerName, userId);
      await attachAvatar(gameRoom, playerId, userId);
      gameRooms.set(roomId, gameRoom);
      playerSockets.set(playerId, { roomId, socketId: socket.id });

      // Leave any previously joined room so no stale broadcasts reach this socket
      if (socket.roomId && socket.roomId !== roomId) socket.leave(socket.roomId);

      const logger = new GameLogger(roomId);
      loggers.set(roomId, logger);
      logger.log('room_created', { playerId, playerName, hasPassword: !!password, settings: { gameMode: validatedMode, hishtPenalty: validatedPenalty, playInPairs, deductions, multiPremiaDeduction, lastBidUntouchable } });

      if (process.env.DATABASE_URL) {
        createRoomRecord(roomId, gameRoom.toDBRow().settings, gameRoom.toDBRow().players)
          .catch(e => console.error('[db] createRoomRecord:', e.message));
      }

      socket.join(roomId);
      socket.playerId = playerId;
      socket.roomId   = roomId;

      console.log(`Created room ${roomId} for ${playerName} [${validatedMode}, hisht=${validatedPenalty}]`);
      const players = formatPlayers(gameRoom);
      callback({
        success: true, roomId, playerId, players,
        hishtPenalty: gameRoom.hishtPenalty, gameMode: gameRoom.gameMode,
        playInPairs: gameRoom.playInPairs, deductions: gameRoom.deductions,
        multiPremiaDeduction: gameRoom.multiPremiaDeduction, lastBidUntouchable: gameRoom.lastBidUntouchable,
        isRanked: gameRoom.isRanked,
      });
      io.to(roomId).emit('player_joined', { players, playerCount: gameRoom.players.size });
    } catch (error) {
      console.error('Error creating game:', error);
      callback({ success: false, error: error.message });
    }
  });

  socket.on('rejoin_game', (data, callback) => {
    try {
      const { playerId, roomId } = data;
      const gameRoom = gameRooms.get(roomId);
      if (!gameRoom) { callback({ success: false, error: 'Room not found' }); return; }

      const ok = gameRoom.reconnectPlayer(playerId, socket.id);
      if (!ok) { callback({ success: false, error: 'Player not in room' }); return; }

      loggers.get(roomId)?.log('player_reconnected', { playerId });
      // Cancel any pending substitution timer and mark player as active again
      unsubstitute(roomId, playerId);

      playerSockets.set(playerId, { roomId, socketId: socket.id });
      socket.join(roomId);
      socket.playerId = playerId;
      socket.roomId   = roomId;

      const players = formatPlayers(gameRoom);
      let restoredState = null;
      try {
        if (gameRoom.status === 'playing' && gameRoom.gameState) {
          const gs = gameRoom.gameState;
          restoredState = {
            ...gs.getState(),
            cardsInRound:    gs.cardsInRound,
            currentPlayer:   gs.getCurrentPlayer(),
            dealerPlayerId:  gs.playerIds[gameRoom.dealerIndex],
            trumpSelectorId: gs.phase === PHASES.TRUMP_SELECTION ? gameRoom.getTrumpSelectorId() : null,
          };
        }
      } catch (e) {
        console.error('[rejoin] getState failed:', e.message);
      }
      console.log(`[rejoin] room ${roomId} status=${gameRoom.status} stateOk=${!!restoredState}`);
      const reconnectPayload = gameRoom.getReconnectPayload(playerId);
      callback({
        success:      true,
        roomId,
        playerId,
        players,
        status:       gameRoom.status,
        gameState:    restoredState,
        hand:         reconnectPayload.hand,
        actionLog:    reconnectPayload.actionLog,
        roundHistory: gameRoom.roundHistory,
        chatHistory:  chatHistories.get(roomId) ?? [],
        hishtPenalty:         gameRoom.hishtPenalty,
        gameMode:             gameRoom.gameMode,
        playInPairs:          gameRoom.playInPairs,
        deductions:           gameRoom.deductions,
        multiPremiaDeduction: gameRoom.multiPremiaDeduction,
        lastBidUntouchable:   gameRoom.lastBidUntouchable,
      });
      io.to(roomId).emit('player_joined', { players, playerCount: gameRoom.players.size });
      // Push hand immediately so the player doesn't have to wait for the next sync interval
      if (gameRoom.status === 'playing') emitHandUpdate(roomId, playerId);
      console.log(`Player ${playerId} rejoined room ${roomId}`);
    } catch (error) {
      console.error('Error rejoining game:', error);
      callback({ success: false, error: error.message });
    }
  });

  socket.on('join_game', async (data, callback) => {
    try {
      const { roomId, playerName, password, userId = null } = data;
      const gameRoom = gameRooms.get(roomId);

      if (!gameRoom) { callback({ success: false, error: 'Room not found' }); return; }
      if (gameRoom.status !== 'waiting') { callback({ success: false, error: 'Game already in progress' }); return; }
      if (gameRoom.isKickedSocket(socket.id) || gameRoom.isKickedUser(userId)) {
        callback({ success: false, error: 'You were kicked from this room' }); return;
      }
      if (gameRoom.passwordHash && !checkPassword(password || '', gameRoom.passwordHash)) {
        callback({ success: false, error: 'Wrong password' }); return;
      }

      const playerId = uuidv4();
      gameRoom.addPlayer(playerId, socket.id, playerName, userId);
      await attachAvatar(gameRoom, playerId, userId);
      playerSockets.set(playerId, { roomId, socketId: socket.id });
      loggers.get(roomId)?.log('player_joined', { playerId, playerName });

      if (socket.roomId && socket.roomId !== roomId) socket.leave(socket.roomId);
      socket.join(roomId);
      socket.playerId = playerId;
      socket.roomId   = roomId;

      console.log(`${playerName} joined room ${roomId}`);
      const players = formatPlayers(gameRoom);
      callback({ success: true, roomId, playerId, players, hishtPenalty: gameRoom.hishtPenalty, gameMode: gameRoom.gameMode, playInPairs: gameRoom.playInPairs, deductions: gameRoom.deductions, multiPremiaDeduction: gameRoom.multiPremiaDeduction, lastBidUntouchable: gameRoom.lastBidUntouchable, isRanked: gameRoom.isRanked });
      io.to(roomId).emit('player_joined', { players, playerCount: gameRoom.players.size });
      if (gameRoom.players.size >= gameRoom.maxPlayers) scheduleRoomStart(roomId, gameRoom);
    } catch (error) {
      console.error('Error joining game:', error);
      callback({ success: false, error: error.message });
    }
  });

  socket.on('spectate_game', (data, callback) => {
    try {
      const { roomId } = data;
      const gameRoom = gameRooms.get(roomId);
      if (!gameRoom) { callback({ success: false, error: 'Room not found' }); return; }

      gameRoom.addSpectator(socket.id);
      socket.join(roomId);
      socket.spectatorRoomId = roomId;

      const players = formatPlayers(gameRoom);
      let gameState = null;
      if (gameRoom.status === 'playing' && gameRoom.gameState) {
        const gs = gameRoom.gameState;
        gameState = {
          ...gs.getState(),
          cardsInRound:   gs.cardsInRound,
          currentPlayer:  gs.getCurrentPlayer(),
          dealerPlayerId: gs.playerIds[gameRoom.dealerIndex],
          trumpSelectorId: gs.phase === PHASES.TRUMP_SELECTION ? gameRoom.getTrumpSelectorId() : null,
        };
      }

      console.log(`Spectator ${socket.id} watching room ${roomId}`);
      callback({ success: true, roomId, players, status: gameRoom.status, gameState, roundHistory: gameRoom.roundHistory, chatHistory: chatHistories.get(roomId) ?? [], hishtPenalty: gameRoom.hishtPenalty, gameMode: gameRoom.gameMode, playInPairs: gameRoom.playInPairs, deductions: gameRoom.deductions, multiPremiaDeduction: gameRoom.multiPremiaDeduction, lastBidUntouchable: gameRoom.lastBidUntouchable });
    } catch (error) {
      console.error('Error spectating game:', error);
      callback({ success: false, error: error.message });
    }
  });

  socket.on('add_bot', (_data, callback) => {
    try {
      const roomId   = socket.roomId;
      const gameRoom = gameRooms.get(roomId);

      if (!gameRoom) { callback?.({ success: false, error: 'Room not found' }); return; }
      if (gameRoom.status !== 'waiting') { callback?.({ success: false, error: 'Game already started' }); return; }

      const botCount  = Array.from(gameRoom.players.values()).filter(p => p.isBot).length;
      const botId     = `bot_${uuidv4().substring(0, 6)}`;
      const botName   = BOT_NAMES[botCount] ?? `Bot ${botCount + 1}`;
      gameRoom.addBot(botId, botName);
      gameRoom.isRanked = false; // bots disqualify ranked mode
      loggers.get(roomId)?.log('bot_added', { botId, name: botName });

      const players = formatPlayers(gameRoom);
      io.to(roomId).emit('player_joined', { players, playerCount: gameRoom.players.size });
      callback?.({ success: true, players });

      if (gameRoom.allPlayersReady()) {
        cancelRoomStart(roomId);
        startGameInRoom(roomId, gameRoom);
      } else if (gameRoom.players.size >= gameRoom.maxPlayers) {
        scheduleRoomStart(roomId, gameRoom);
      }
    } catch (error) {
      console.error('Error adding bot:', error);
      callback?.({ success: false, error: error.message });
    }
  });

  socket.on('kick_player', (data, callback) => {
    try {
      const roomId      = socket.roomId;
      const gameRoom    = gameRooms.get(roomId);
      if (!gameRoom) { callback?.({ success: false, error: 'Room not found' }); return; }
      if (gameRoom.status !== 'waiting') { callback?.({ success: false, error: 'Cannot kick during a game' }); return; }
      if (gameRoom.creatorId !== socket.playerId) { callback?.({ success: false, error: 'Only the host can kick' }); return; }

      const { targetId } = data ?? {};
      if (!targetId || targetId === socket.playerId) { callback?.({ success: false, error: 'Invalid target' }); return; }

      const target = gameRoom.players.get(targetId);
      if (!target) { callback?.({ success: false, error: 'Player not in room' }); return; }

      // Remember this socket and userId so they can't rejoin (new socket after refresh)
      gameRoom.addKickedSocket(target.socketId);
      gameRoom.addKickedUser(target.userId);

      // Notify and disconnect target socket if connected
      if (target.socketId) {
        const targetSocket = io.sockets.sockets.get(target.socketId);
        if (targetSocket) {
          targetSocket.emit('kicked', { reason: 'You were kicked by the host' });
          targetSocket.leave(roomId);
          targetSocket.roomId   = null;
          targetSocket.playerId = null;
        }
      }

      if (process.env.DATABASE_URL && target.userId && !roomHasBots(gameRoom)) decrementHonorRate(target.userId).catch(() => {});
      gameRoom.removePlayer(targetId);
      playerSockets.delete(targetId);
      cancelRoomStart(roomId);
      loggers.get(roomId)?.log('player_kicked', { targetId, by: socket.playerId });

      const players = formatPlayers(gameRoom);
      io.to(roomId).emit('player_joined', { players, playerCount: gameRoom.players.size });
      callback?.({ success: true, players });
    } catch (error) {
      console.error('Error kicking player:', error);
      callback?.({ success: false, error: error.message });
    }
  });

  socket.on('request_rematch', async (data, callback) => {
    try {
      const { playerName, userId = null, settings = {}, prevRoomId } = data;
      const {
        hishtPenalty         = HISHT_PENALTY_DEFAULT,
        gameMode             = 'normal',
        playInPairs          = false,
        deductions           = true,
        multiPremiaDeduction = false,
        lastBidUntouchable   = true,
        isRanked             = false,
      } = settings;

      const validatedMode    = ['normal', 'only9', 'quick'].includes(gameMode) ? gameMode : 'normal';
      const validOptions     = validatedMode === 'only9' ? HISHT_PENALTY_OPTIONS_ONLY9
                             : validatedMode === 'quick'  ? HISHT_PENALTY_OPTIONS_QUICK
                             : HISHT_PENALTY_OPTIONS_CLASSIC;
      const validatedPenalty = validOptions.includes(hishtPenalty) ? hishtPenalty : HISHT_PENALTY_DEFAULT;

      const roomId   = uuidv4().substring(0, 8).toUpperCase();
      const playerId = uuidv4();

      const gameRoom = new GameRoom(roomId, MAX_PLAYERS, {
        gameMode: validatedMode, hishtPenalty: validatedPenalty,
        playInPairs: !!playInPairs, deductions: !!deductions,
        multiPremiaDeduction: !!multiPremiaDeduction, lastBidUntouchable: !!lastBidUntouchable,
        isRanked: !!isRanked,
      });

      gameRoom.addPlayer(playerId, socket.id, playerName, userId);
      await attachAvatar(gameRoom, playerId, userId);
      gameRooms.set(roomId, gameRoom);
      playerSockets.set(playerId, { roomId, socketId: socket.id });

      if (socket.roomId && socket.roomId !== roomId) socket.leave(socket.roomId);
      socket.join(roomId);
      socket.playerId = playerId;
      socket.roomId   = roomId;

      const logger = new GameLogger(roomId);
      loggers.set(roomId, logger);
      logger.log('room_created', { playerId, playerName, rematchFrom: prevRoomId });

      if (process.env.DATABASE_URL) {
        createRoomRecord(roomId, gameRoom.toDBRow().settings, gameRoom.toDBRow().players)
          .catch(e => console.error('[db] createRoomRecord:', e.message));
      }

      // Invite other humans still in the old room
      if (prevRoomId) {
        const oldRoom = gameRooms.get(prevRoomId);
        if (oldRoom) {
          for (const [pid, p] of oldRoom.players.entries()) {
            if (!p.isBot && p.socketId && pid !== socket.playerId) {
              io.to(p.socketId).emit('rematch_invite', {
                inviterName: playerName,
                newRoomId:   roomId,
              });
            }
          }
        }
        // Also broadcast to anyone still connected to the old socket room
        socket.to(prevRoomId).emit('rematch_invite', {
          inviterName: playerName,
          newRoomId:   roomId,
        });
      }

      const players = formatPlayers(gameRoom);
      callback({ success: true, roomId, playerId, players,
        hishtPenalty: gameRoom.hishtPenalty, gameMode: gameRoom.gameMode,
        playInPairs: gameRoom.playInPairs, deductions: gameRoom.deductions,
        multiPremiaDeduction: gameRoom.multiPremiaDeduction, lastBidUntouchable: gameRoom.lastBidUntouchable,
        isRanked: gameRoom.isRanked,
      });
      io.to(roomId).emit('player_joined', { players, playerCount: gameRoom.players.size });
    } catch (error) {
      console.error('Error requesting rematch:', error);
      callback({ success: false, error: error.message });
    }
  });

  socket.on('ready_to_play', (_data, callback) => {
    try {
      const playerId = socket.playerId;
      const roomId   = socket.roomId;
      const gameRoom = gameRooms.get(roomId);

      if (!gameRoom) { callback && callback({ success: false, error: 'Room not found' }); return; }

      gameRoom.setPlayerReady(playerId);
      io.to(roomId).emit('player_ready', { players: formatPlayers(gameRoom) });

      if (gameRoom.allPlayersReady()) {
        cancelRoomStart(roomId);
        startGameInRoom(roomId, gameRoom);
      }

      callback && callback({ success: true });
    } catch (error) {
      console.error('Error marking ready:', error);
      callback && callback({ success: false, error: error.message });
    }
  });

  // ── Trump selection (9-card rounds) ─────────────────────────────────────────
  socket.on('select_trump', (data, callback) => {
    try {
      const { suit } = data;
      const playerId = socket.playerId;
      const roomId   = socket.roomId;
      const gameRoom = gameRooms.get(roomId);
      clearTurnTimer(roomId);
      unsubstitute(roomId, playerId);

      if (!gameRoom) { callback({ success: false, error: 'Room not found' }); return; }

      const VALID_SUITS = ['♠', '♥', '♦', '♣', 'NO_TRUMP'];
      if (!VALID_SUITS.includes(suit)) { callback({ success: false, error: 'Invalid suit' }); return; }

      const gs = gameRoom.gameState;
      if (gs.phase !== PHASES.TRUMP_SELECTION) {
        callback({ success: false, error: 'Not in trump selection phase' });
        return;
      }
      if (playerId !== gameRoom.getTrumpSelectorId()) {
        callback({ success: false, error: 'Not your turn to select trump' });
        return;
      }

      gameRoom.selectTrump(suit);

      loggers.get(roomId)?.log('trump_selected', {
        playerId: socket.playerId,
        trump:    gs.trump,
        hands:    snapshotHands(gs),
      });

      io.to(roomId).emit('trump_selected', {
        trump:     gs.trump,
        trumpCard: null,
        phase:     'bidding',
      });

      callback({ success: true });
      scheduleBotTurn(roomId, BOT_DELAYS.trumpSelect);
    } catch (error) {
      console.error('Error selecting trump:', error);
      callback({ success: false, error: error.message });
    }
  });

  socket.on('place_bid', (data, callback) => {
    try {
      const { bid } = data;
      const playerId = socket.playerId;
      const roomId   = socket.roomId;
      const gameRoom = gameRooms.get(roomId);
      clearTurnTimer(roomId);
      unsubstitute(roomId, playerId);

      if (!gameRoom?.gameState) { callback({ success: false, error: 'Game not started' }); return; }

      const gs = gameRoom.gameState;
      if (gs.phase !== PHASES.BIDDING) {
        callback({ success: false, error: 'Not in bidding phase' }); return;
      }
      const ok = gs.recordBid(playerId, bid);

      if (!ok) {
        callback({ success: false, error: 'That bid is not allowed — total bids cannot equal tricks available' });
        return;
      }

      loggers.get(roomId)?.log('bid_placed', { playerId, bid, allBids: { ...gs.bids } });
      io.to(roomId).emit('bid_placed', { playerId, bid, allBids: gs.bids, currentBidder: gs.getCurrentBidder() });

      if (process.env.DATABASE_URL) {
        const roundId = dbRoundIds.get(roomId) ?? gameRoom.dbRoundId;
        if (roundId) {
          const order = (dbBidOrders.get(roomId) ?? 0);
          dbBidOrders.set(roomId, order + 1);
          const p = gameRoom.players.get(playerId);
          insertBid(roundId, { playerId, playerName: p?.name ?? null, userId: p?.userId ?? null,
                               bid, bidOrder: order })
            .catch(e => console.error('[db] insertBid(human):', e.message));
        }
      }

      const lastBid = gs.allPlayersBid();
      if (lastBid) {
        io.to(roomId).emit('bidding_complete', {
          bids:          gs.bids,
          currentPlayer: gs.getCurrentPlayer(),
          cardsInRound:  gs.cardsInRound,
        });
      }

      callback({ success: true });
      scheduleBotTurn(roomId, lastBid ? BOT_DELAYS.afterLastBid : BOT_DELAYS.normal);
    } catch (error) {
      console.error('Error placing bid:', error);
      callback({ success: false, error: error.message });
    }
  });

  socket.on('get_hand', (_data, callback) => {
    try {
      const playerId = socket.playerId;
      const roomId   = socket.roomId;
      const gameRoom = gameRooms.get(roomId);

      if (!gameRoom || !gameRoom.gameState) { callback({ success: false, error: 'Game not started' }); return; }

      callback({ success: true, cards: gameRoom.gameState.getPlayerHand(playerId) });
    } catch (error) {
      console.error('Error getting hand:', error);
      callback({ success: false, error: error.message });
    }
  });

  // Player reclaims control from bot substitution — unsubstitutes and returns fresh hand
  socket.on('reclaim_control', (_data, callback) => {
    try {
      const playerId = socket.playerId;
      const roomId   = socket.roomId;
      const gameRoom = gameRooms.get(roomId);

      if (!gameRoom || !gameRoom.gameState) { callback?.({ success: false, error: 'Game not started' }); return; }

      unsubstitute(roomId, playerId);
      clearTurnTimer(roomId);
      cancelBotTurn(roomId);  // stop any queued bot action immediately

      const gs    = gameRoom.gameState;
      const cards = gs.getPlayerHand(playerId);
      callback?.({ success: true, cards });

      // Push authoritative game state directly to this player's socket so
      // their frontend is fully in sync (currentPlayer, phase, trick, etc.)
      socket.emit('state_sync', {
        gameState: gs.getState(),
        players:   formatPlayers(gameRoom),
      });
      // Also push their hand via the direct channel
      socket.emit('hand_update', { cards });

      // Drive the game engine forward: processBotTurn will resetTurnTimer if
      // it's still the player's own turn, or will act if the bot already
      // advanced the game to another bot/substituted player's turn.
      scheduleBotTurn(roomId, 150);
    } catch (error) {
      console.error('Error reclaiming control:', error);
      callback?.({ success: false, error: error.message });
    }
  });

  socket.on('play_card', (data, callback) => {
    try {
      const { card, jokerMode, takeSuit, giveSuit } = data;
      const playerId = socket.playerId;
      const roomId   = socket.roomId;
      const gameRoom = gameRooms.get(roomId);
      clearTurnTimer(roomId);
      unsubstitute(roomId, playerId);

      if (!gameRoom?.gameState) { callback({ success: false, error: 'Game not started' }); return; }

      const gs = gameRoom.gameState;
      if (gs.phase !== PHASES.PLAYING) {
        callback({ success: false, error: 'Not in playing phase' }); return;
      }
      const result  = gameRoom.playCard(playerId, card, jokerMode, takeSuit, giveSuit);

      bufferCardPlay(gameRoom, playerId, card, jokerMode, takeSuit, giveSuit);
      loggers.get(roomId)?.log('card_played', {
        playerId,
        card,
        jokerMode:   jokerMode || null,
        takeSuit:    takeSuit  || null,
        giveSuit:    giveSuit  || null,
        trickNumber: gs.trickNumber,
      });

      io.to(roomId).emit('card_played', {
        playerId,
        card,
        currentPlayer: gs.getCurrentPlayer(),
        jokerMode: jokerMode || null,
        takeSuit:  takeSuit  || null,
        giveSuit:  giveSuit  || null,
        currentTrick: result.trickComplete ? null : gs.currentTrick.map(e => ({
          playerId: e.playerId, card: e.card.toString(),
          jokerMode: e.jokerMode || null, takeSuit: e.takeSuit || null, giveSuit: e.giveSuit || null,
        })),
      });

      if (result.trickComplete) {
        persistTrick(roomId, gameRoom);
        loggers.get(roomId)?.log('trick_resolved', {
          trickNumber:  gs.trickNumber,
          winnerId:     result.trickResult.winnerId,
          tricksCounts: { ...gs.tricksCounts },
          cards:        serializeLastTrick(gs),
        });
        io.to(roomId).emit('trick_resolved', {
          winnerId:      result.trickResult.winnerId,
          tricksCounts:  { ...gs.tricksCounts },
          currentPlayer: result.trickResult.winnerId,
          trickCards:    serializeLastTrick(gs),
        });

        // scheduleBotTurn (not a raw setTimeout) so any pending bot-turn timer is cancelled
        // first — prevents handleRoundEnd firing twice with stale tricksCounts.
        callback({ success: true });
        scheduleBotTurn(roomId, BOT_DELAYS.afterTrick);
        return;
      }

      callback({ success: true });
      scheduleBotTurn(roomId, BOT_DELAYS.betweenPlays);
    } catch (error) {
      console.error('Error playing card:', error);
      callback({ success: false, error: error.message });
    }
  });

  // ── Chat ────────────────────────────────────────────────────────────────────

  socket.on('send_chat', (data, callback) => {
    try {
      const { roomId, message } = data;
      const playerId = socket.playerId ?? null; // always use server-authoritative id
      if (!message?.trim()) { callback?.({ success: false }); return; }

      // Rate limit per socket
      const now = Date.now();
      const rl  = chatRateLimits.get(socket.id) ?? { count: 0, windowStart: now };
      if (now - rl.windowStart > CHAT_RATE_WINDOW_MS) { rl.count = 0; rl.windowStart = now; }
      if (rl.count >= CHAT_RATE_LIMIT) { callback?.({ success: false, error: 'Too many messages — slow down' }); return; }
      rl.count++;
      chatRateLimits.set(socket.id, rl);

      const gameRoom = gameRooms.get(roomId);
      if (!gameRoom) { callback?.({ success: false, error: 'Room not found' }); return; }
      const sender = playerId ? gameRoom.players.get(playerId) : null;
      const name   = sender?.name ?? (socket.spectatorRoomId ? 'Spectator' : 'Unknown');
      const entry  = { id: Date.now() + Math.random(), playerId, name, message: message.trim().slice(0, CHAT_MAX_LENGTH) };
      const hist   = chatHistories.get(roomId) ?? [];
      hist.push(entry);
      if (hist.length > CHAT_HISTORY_SIZE) hist.shift();
      chatHistories.set(roomId, hist);
      io.to(roomId).emit('chat_message', entry);
      callback?.({ success: true });
    } catch (err) {
      console.error('send_chat error:', err);
      callback?.({ success: false, error: err.message });
    }
  });

  // ── Debug (dev only) ─────────────────────────────────────────────────────────

  socket.on('debug_get_state', (data, callback) => {
    if (isProd) { callback?.({ success: false }); return; }
    const gr = gameRooms.get(data?.roomId);
    if (!gr) { callback?.({ success: false, error: 'Room not found' }); return; }
    callback?.({ success: true, state: gr.gameState?.getState() ?? null, players: formatPlayers(gr) });
  });

  socket.on('heartbeat_ack', () => {
    heartbeatMissed.set(socket.id, 0);
  });

  // Intentional leave — player chose to go back to lobby.
  // We mark them disconnected immediately (no substitution delay) and leave the socket.io room
  // so they stop receiving broadcasts from the old room.
  socket.on('leave_game', () => {
    try {
      const playerId = socket.playerId;
      const roomId   = socket.roomId;
      if (!roomId || !playerId) return;

      const gameRoom = gameRooms.get(roomId);
      if (gameRoom) {
        loggers.get(roomId)?.log('player_left_voluntarily', { playerId });
        const shouldDestroy = gameRoom.disconnectPlayer(playerId);
        cleanupPlayerTimers(roomId, playerId);

        if (shouldDestroy) {
          clearSyncInterval(roomId);
          clearHeartbeat(roomId);
          cancelBotTurn(roomId);
          cancelRoomStart(roomId);
          chatHistories.delete(roomId);
          loggers.delete(roomId);
          gameRooms.delete(roomId);
          console.log(`Room ${roomId} destroyed (voluntary leave)`);
        } else {
          if (gameRoom.status === 'waiting') cancelRoomStart(roomId);
          io.to(roomId).emit('player_left', { players: formatPlayers(gameRoom) });
          // Immediately substitute — they chose to leave, not just disconnected
          if (gameRoom.status === 'playing') {
            gameRoom.setSubstituted(playerId, true);
            io.to(roomId).emit('player_substituted', { playerId, reason: 'left' });
            scheduleBotTurn(roomId);
          }
        }
      }

      socket.leave(roomId);
      socket.playerId = null;
      socket.roomId   = null;
      playerSockets.delete(playerId);
      console.log(`Player ${playerId} left room ${roomId} voluntarily`);
    } catch (err) {
      console.error('Error in leave_game:', err);
    }
  });

  socket.on('join_queue', async (data) => {
    try {
      const { playerName, userId = null, gameMode = 'normal', isRanked = false } = data ?? {};
      if (!playerName?.trim()) return;

      const validatedMode = ['normal', 'only9', 'quick'].includes(gameMode) ? gameMode : 'normal';
      const key = `${validatedMode}:${!!isRanked}`;

      // Remove any existing queue entry for this socket (idempotent re-queue)
      for (const [k, q] of matchmakingQueues) {
        const idx = q.findIndex(e => e.socketId === socket.id);
        if (idx !== -1) {
          q.splice(idx, 1);
          if (q.length === 0) matchmakingQueues.delete(k);
        }
      }

      const queue = matchmakingQueues.get(key) ?? [];
      queue.push({ socketId: socket.id, playerName: playerName.trim(), userId, joinedAt: Date.now() });
      matchmakingQueues.set(key, queue);
      socket.emit('queue_position', { position: queue.length, total: queue.length });

      if (queue.length >= 4) {
        const group = queue.splice(0, 4);
        if (queue.length === 0) matchmakingQueues.delete(key);

        const roomId   = uuidv4().substring(0, 8).toUpperCase();
        const gameRoom = new GameRoom(roomId, MAX_PLAYERS, {
          gameMode: validatedMode, hishtPenalty: '200', isRanked: !!isRanked,
          deductions: true, multiPremiaDeduction: false, lastBidUntouchable: true, playInPairs: false,
        });
        const logger = new GameLogger(roomId);
        loggers.set(roomId, logger);
        gameRooms.set(roomId, gameRoom);

        // Attach all players in parallel
        await Promise.all(group.map(async (entry) => {
          const s = io.sockets.sockets.get(entry.socketId);
          if (!s) return; // disconnected between join and match
          const playerId = uuidv4();
          gameRoom.addPlayer(playerId, entry.socketId, entry.playerName, entry.userId);
          await attachAvatar(gameRoom, playerId, entry.userId);
          playerSockets.set(playerId, { roomId, socketId: entry.socketId });
          if (s.roomId && s.roomId !== roomId) s.leave(s.roomId);
          s.join(roomId);
          s.playerId = playerId;
          s.roomId   = roomId;
          const players = formatPlayers(gameRoom);
          s.emit('queue_matched', {
            success: true, roomId, playerId, players,
            hishtPenalty: gameRoom.hishtPenalty, gameMode: gameRoom.gameMode,
            playInPairs: false, deductions: true,
            multiPremiaDeduction: false, lastBidUntouchable: true,
            isRanked: !!isRanked,
          });
        }));

        if (process.env.DATABASE_URL) {
          createRoomRecord(roomId, gameRoom.toDBRow().settings, gameRoom.toDBRow().players)
            .catch(e => console.error('[db] createRoomRecord (queue):', e.message));
        }
        logger.log('room_created_from_queue', { roomId, gameMode: validatedMode, isRanked });
        scheduleRoomStart(roomId, gameRoom);
      }
    } catch (err) {
      console.error('join_queue error:', err);
    }
  });

  socket.on('leave_queue', () => {
    for (const [k, q] of matchmakingQueues) {
      const idx = q.findIndex(e => e.socketId === socket.id);
      if (idx !== -1) {
        q.splice(idx, 1);
        if (q.length === 0) matchmakingQueues.delete(k);
        socket.emit('queue_cancelled');
        break;
      }
    }
  });

  socket.on('disconnect', () => {
    try {
      const playerId = socket.playerId;
      const roomId   = socket.roomId;

      chatRateLimits.delete(socket.id);
      lobbyChatRates.delete(socket.id);
      heartbeatMissed.delete(socket.id);

      // Remove from matchmaking queue on disconnect (no emit — socket is gone)
      for (const [k, q] of matchmakingQueues) {
        const idx = q.findIndex(e => e.socketId === socket.id);
        if (idx !== -1) {
          q.splice(idx, 1);
          if (q.length === 0) matchmakingQueues.delete(k);
          break;
        }
      }

      // Remove from online tracking and notify friends
      if (socket.authUserId && onlineUsers.get(socket.authUserId) === socket.id) {
        onlineUsers.delete(socket.authUserId);
        if (process.env.DATABASE_URL) {
          getFriends(socket.authUserId).then(friends => {
            for (const f of friends) {
              const sid = onlineUsers.get(f.id);
              if (sid) io.to(sid).emit('friend_offline', { userId: socket.authUserId });
            }
          }).catch(() => {});
        }
      }

      // Spectator cleanup
      if (socket.spectatorRoomId) {
        const specRoom = gameRooms.get(socket.spectatorRoomId);
        if (specRoom) specRoom.removeSpectator(socket.id);
      }

      if (roomId && gameRooms.has(roomId)) {
        const gameRoom      = gameRooms.get(roomId);
        loggers.get(roomId)?.log('player_disconnected', { playerId });
        const shouldDestroy = gameRoom.disconnectPlayer(playerId);
        if (shouldDestroy) {
          // Clean up any timers for this room/player before deleting
          cleanupPlayerTimers(roomId, playerId);
          clearSyncInterval(roomId);
          clearHeartbeat(roomId);
          cancelBotTurn(roomId);
          cancelRoomStart(roomId);
          chatHistories.delete(roomId);
          loggers.get(roomId)?.log('room_destroyed', { reason: 'all_players_gone' });
          loggers.delete(roomId);
          gameRooms.delete(roomId);
          console.log(`Room ${roomId} destroyed`);
        } else {
          // If room is no longer full, cancel any pending auto-start
          if (gameRoom.status === 'waiting') cancelRoomStart(roomId);
          io.to(roomId).emit('player_left', { players: formatPlayers(gameRoom) });
          // During a game: schedule bot takeover after 2 minutes if no reconnect
          if (gameRoom.status === 'playing' && playerId) {
            const timer = setTimeout(() => {
              substitutionTimers.delete(playerId);
              const gr = gameRooms.get(roomId);
              if (!gr) return;
              const p = gr.players.get(playerId);
              if (!p || p.socketId) return; // already reconnected
              if (gr.isSubstituted(playerId)) return; // sync interval already handled it
              gr.setSubstituted(playerId, true);
              loggers.get(roomId)?.log('player_substituted', { playerId, reason: 'disconnected' });
              io.to(roomId).emit('player_substituted', { playerId, reason: 'disconnected' });
              console.log(`[sub] ${playerId} substituted (disconnected) in ${roomId}`);
              if (process.env.DATABASE_URL && !roomHasBots(gr)) incrementAfkCount(p.userId).catch(() => {});
              scheduleBotTurn(roomId);
            }, SUBSTITUTION_DELAY_MS);
            substitutionTimers.set(playerId, timer);
          }
        }
      }

      if (playerId) playerSockets.delete(playerId);
      console.log(`Player disconnected: ${socket.id}`);
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  });
});

// Serve the built React frontend (production)
const distPath = join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(distPath)) {
  // Cache hashed assets forever; never cache index.html so deploys take effect immediately
  app.use(express.static(distPath, { index: false, immutable: true, maxAge: '1y' }));
  app.get('*', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(join(distPath, 'index.html'));
  });
  console.log('Serving frontend from', distPath);
}

// Remove rooms where all humans have been gone for 5+ minutes
setInterval(() => {
  for (const [roomId, room] of gameRooms) {
    if (room.shouldCleanup()) {
      clearSyncInterval(roomId);
      clearHeartbeat(roomId);
      cancelBotTurn(roomId);
      cancelRoomStart(roomId);
      chatHistories.delete(roomId);
      loggers.get(roomId)?.log('room_cleaned', { reason: 'inactivity' });
      loggers.delete(roomId);
      gameRooms.delete(roomId);
      gameStartedAt.delete(roomId);
      dbGameIds.delete(roomId);
      dbRoundIds.delete(roomId);
      if (process.env.DATABASE_URL) markRoomAbandoned(roomId).catch(() => {});
      console.log(`Room ${roomId} auto-cleaned`);
    }
  }
}, ROOM_CLEANUP_INTERVAL);

const PORT = process.env.PORT || 3000;

async function startup() {
  if (!process.env.DATABASE_URL) {
    httpServer.listen(PORT, () => console.log(`Joker server on http://localhost:${PORT}`));
    return;
  }

  try {
    await runMigrations();
  } catch (err) {
    console.error('Migration failed:', err);
  }

  // Restore in-progress rooms from DB so players can rejoin after a server restart
  try {
    const rows = await loadActiveRooms();
    for (const row of rows) {
      if (gameRooms.has(row.id)) continue;
      const gr = GameRoom.fromDB(row);
      if (gr.status === 'abandoned') continue;
      if (gr.status === 'waiting') {
        markRoomAbandoned(row.id).catch(() => {});
        continue; // waiting rooms are useless after restart — players are gone
      }
      gameRooms.set(row.id, gr);
      if (row.current_game_id) {
        dbGameIds.set(row.id, row.current_game_id);
        gr.dbGameId = row.current_game_id;
      }
      // Restore logger
      loggers.set(row.id, new GameLogger(row.id));
      console.log(`[restore] room ${row.id} (${gr.status}) loaded from DB`);
    }
    console.log(`[restore] ${rows.length} rooms restored`);
  } catch (err) {
    console.error('[restore] failed to load rooms:', err.message);
  }

  httpServer.listen(PORT, () => console.log(`Joker server on http://localhost:${PORT}`));
}

startup();
