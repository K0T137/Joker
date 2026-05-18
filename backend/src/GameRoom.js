import { GameState } from './gameEngine/GameState.js';
import { Scorer } from './gameEngine/Scorer.js';
import { Deck } from './gameEngine/Deck.js';
import { MAX_PLAYERS, ROOM_MAX_AGE_MS } from './config.js';
import { PHASES } from './gameEngine/constants.js';

export class GameRoom {
  constructor(roomId, maxPlayers = MAX_PLAYERS, settings = {}) {
    const {
      gameMode             = 'normal',
      hishtPenalty         = '200',
      playInPairs          = false,
      deductions           = true,
      multiPremiaDeduction = false,
      lastBidUntouchable   = true,
      isRanked             = false,
    } = settings;

    this.roomId = roomId;
    this.maxPlayers = maxPlayers;
    this.players = new Map();
    this.spectators = new Set();
    this.kickedSocketIds = new Set();
    this.kickedUserIds   = new Set();
    this.gameState = null;
    this.status = 'waiting';
    this.pulkaHistory = [];
    this.currentPulkaRounds = [];
    this.dealerIndex = 0;
    this.gameMode             = gameMode;
    this.hishtPenalty         = hishtPenalty;   // raw string: '200','500','200/500','×100','300','900'
    this.playInPairs          = playInPairs;
    this.deductions           = deductions;
    this.multiPremiaDeduction = multiPremiaDeduction;
    this.lastBidUntouchable   = lastBidUntouchable;
    this.isRanked             = isRanked;
    // Accumulated round_ended payloads — same shape the client accumulates from events,
    // sent to reconnecting players and late-joining spectators so they see the full scoreboard.
    this.roundHistory = [];
    // DB tracking (set by server.js after DB inserts)
    this.dbGameId  = null;
    this.dbRoundId = null;
    // Buffer of card-plays for the current trick, flushed to DB when trick completes
    this.currentTrickBuffer = [];
  }

  addSpectator(socketId) { this.spectators.add(socketId); }
  removeSpectator(socketId) { this.spectators.delete(socketId); }
  get spectatorCount() { return this.spectators.size; }

  addKickedSocket(socketId) { if (socketId) this.kickedSocketIds.add(socketId); }
  addKickedUser(userId)     { if (userId)   this.kickedUserIds.add(userId); }
  isKickedSocket(socketId) { return this.kickedSocketIds.has(socketId); }
  isKickedUser(userId)     { return userId ? this.kickedUserIds.has(userId) : false; }

  addPlayer(playerId, socketId, name, userId = null) {
    if (this.players.size >= this.maxPlayers) throw new Error('Room is full');
    if (!this.creatorId) this.creatorId = playerId;
    this.players.set(playerId, { name, socketId, ready: false, isBot: false, userId });
    return this.players.size;
  }

  addBot(playerId, name) {
    if (this.players.size >= this.maxPlayers) throw new Error('Room is full');
    this.players.set(playerId, { name, socketId: null, ready: true, isBot: true });
    return this.players.size;
  }

  isBot(playerId) {
    return this.players.get(playerId)?.isBot === true;
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
    return this.players.size === 0;
  }

  // Called on socket disconnect. During a game, keeps the player slot alive for reconnection.
  disconnectPlayer(playerId) {
    const player = this.players.get(playerId);
    if (!player) return this.players.size === 0;
    if (this.status === 'waiting') {
      this.players.delete(playerId);
      return this.players.size === 0 || Array.from(this.players.values()).every(p => p.isBot);
    }
    player.socketId = null;
    player.disconnectedAt = Date.now();
    return false;
  }

  reconnectPlayer(playerId, socketId) {
    const player = this.players.get(playerId);
    if (!player || player.isBot) return false;
    player.socketId = socketId;
    player.disconnectedAt = null;
    player.substituted = false;
    return true;
  }

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
      console.error('[GameRoom] getReconnectPayload failed:', err.message);
      return { gameState: null, hand: [], actionLog: [], roundHistory: this.roundHistory };
    }
  }

  isSubstituted(playerId) {
    return this.players.get(playerId)?.substituted === true;
  }

  setSubstituted(playerId, value) {
    const player = this.players.get(playerId);
    if (player && !player.isBot) player.substituted = !!value;
  }

  // True when all human players have been disconnected for longer than maxAgeMs.
  shouldCleanup(maxAgeMs = ROOM_MAX_AGE_MS) {
    const humans = Array.from(this.players.values()).filter(p => !p.isBot);
    if (humans.length === 0) return true;
    return humans.every(p => p.socketId === null && p.disconnectedAt != null && (Date.now() - p.disconnectedAt) > maxAgeMs);
  }

  setPlayerReady(playerId) {
    const player = this.players.get(playerId);
    if (player) player.ready = true;
    return this.allPlayersReady();
  }

  allPlayersReady() {
    return (
      this.players.size === this.maxPlayers &&
      Array.from(this.players.values()).every((p) => p.ready)
    );
  }

  performAtuzovka() {
    const deck = new Deck();
    deck.reset().shuffle();
    const playerIds = Array.from(this.players.keys());
    const n = playerIds.length;
    let dealerIndex = 0;
    let dealerCard  = null;
    const drawnCards = [];

    for (let i = 0; i < 36; i++) {
      const card = deck.draw(1)[0];
      const pIdx = i % n;
      drawnCards.push({ card: card.toString(), playerIndex: pIdx });
      if (card.rank === 'A') {
        dealerIndex = pIdx;
        dealerCard  = card.toString();
        break;
      }
    }

    this.dealerIndex = dealerIndex;
    return { dealerPlayerId: playerIds[dealerIndex], dealerIndex, card: dealerCard, drawnCards };
  }

  startGame() {
    const playerIds = Array.from(this.players.keys());
    this.gameState  = new GameState(playerIds, this.gameMode);
    this.status     = 'playing';
    this.roundHistory = [];
    this.startPulka();
  }

  startPulka() {
    this.gameState.pulkaNumber++;
    this.gameState.roundNumber = 0;
    this.currentPulkaRounds = [];
    this.startRound();
  }

  startRound() {
    const structure     = this.gameState.getPulkaStructure(this.gameState.pulkaNumber);
    const cardsPerPlayer = structure[this.gameState.roundNumber];
    this.gameState.roundNumber++;

    if (cardsPerPlayer === 9) {
      this.gameState.dealNineCardPhase1();
    } else {
      this.gameState.dealRound(cardsPerPlayer);
    }

    // Player after dealer leads each round
    this.gameState.currentLeaderIndex = (this.dealerIndex + 1) % 4;
  }

  /** Returns the playerId of the trump selector (left of dealer) for 9-card rounds. */
  getTrumpSelectorId() {
    const idx = (this.dealerIndex + 1) % this.gameState.playerIds.length;
    return this.gameState.playerIds[idx];
  }

  /** Called when the trump selector has chosen a suit. Deals phase-2 cards. */
  selectTrump(suit) {
    this.gameState.setTrumpAndDealPhase2(suit);
  }

  recordBid(playerId, bid) {
    return this.gameState.recordBid(playerId, bid);
  }

  playCard(playerId, card, jokerMode, takeSuit, giveSuit) {
    const cardObj         = this.parseCard(playerId, card);
    const isTrickComplete = this.gameState.playCard(playerId, cardObj, jokerMode, takeSuit, giveSuit);
    if (isTrickComplete) {
      const trickResult = this.gameState.resolveTrick();
      return { trickComplete: true, trickResult };
    }
    return { trickComplete: false };
  }

  parseCard(playerId, cardStr) {
    const card = (this.gameState.dealtCards[playerId] ?? []).find(c => c.toString() === cardStr);
    if (!card) throw new Error(`Card "${cardStr}" not in hand of player ${playerId}`);
    return card;
  }

  endRound() {
    const roundTricks = {};
    for (const playerId of this.gameState.playerIds) {
      roundTricks[playerId] = this.gameState.tricksCounts[playerId];
    }

    const cardsInRound = this.gameState.cardsInRound;
    this.currentPulkaRounds.push({
      tricks:       roundTricks,
      bids:         { ...this.gameState.bids },
      cardsInRound,
    });

    // Rotate dealer clockwise after every round
    this.dealerIndex = (this.dealerIndex + 1) % this.gameState.playerIds.length;

    const pulkaLength = this.gameState.getPulkaStructure(this.gameState.pulkaNumber).length;
    if (this.currentPulkaRounds.length >= pulkaLength) {
      return this.endPulka();
    }

    return null;
  }

  resolveHisht(pulkaNumber) {
    switch (this.hishtPenalty) {
      case '×100':    return { hishtMode: 'dynamic', hishtPenalty: 0 };
      case '200/500': return { hishtMode: 'fixed',   hishtPenalty: pulkaNumber % 2 === 1 ? 200 : 500 };
      default:        return { hishtMode: 'fixed',   hishtPenalty: parseInt(this.hishtPenalty, 10) || 200 };
    }
  }

  buildScoringOptions() {
    const opts = {
      deductions:           this.deductions,
      multiPremiaDeduction: this.multiPremiaDeduction,
      lastBidUntouchable:   this.lastBidUntouchable,
    };
    if (this.playInPairs) {
      const ids = this.gameState.playerIds; // [P1, P2, P3, P4]
      opts.partnerOf = {
        [ids[0]]: ids[2], [ids[2]]: ids[0],
        [ids[1]]: ids[3], [ids[3]]: ids[1],
      };
      opts.teamOf = {
        [ids[0]]: 'A', [ids[2]]: 'A',
        [ids[1]]: 'B', [ids[3]]: 'B',
      };
    }
    return opts;
  }

  buildFinalScores() {
    const scores = { ...this.gameState.gameScores };
    if (!this.playInPairs) return scores;
    const ids = this.gameState.playerIds;
    scores[ids[0]] = (scores[ids[0]] ?? 0) + (scores[ids[2]] ?? 0);
    scores[ids[1]] = (scores[ids[1]] ?? 0) + (scores[ids[3]] ?? 0);
    scores[ids[2]] = 0;
    scores[ids[3]] = 0;
    return scores;
  }

  endPulka() {
    const playerBids  = this.currentPulkaRounds.map((r) => r.bids);
    const roundTricks = this.currentPulkaRounds.map((r) => r.tricks);
    const cardCounts  = this.currentPulkaRounds.map((r) => r.cardsInRound);

    const { hishtMode, hishtPenalty } = this.resolveHisht(this.gameState.pulkaNumber);
    const pulkaScores = Scorer.calculatePulkaScores(
      roundTricks, playerBids, cardCounts, hishtMode, hishtPenalty, this.buildScoringOptions()
    );

    for (const playerId in pulkaScores) {
      if (!this.gameState.gameScores[playerId]) this.gameState.gameScores[playerId] = 0;
      this.gameState.gameScores[playerId] += pulkaScores[playerId].total;
    }

    this.pulkaHistory.push({
      pulkaNumber: this.gameState.pulkaNumber,
      scores:      pulkaScores,
      gameScores:  { ...this.gameState.gameScores },
    });

    if (this.gameState.pulkaNumber >= 4) {
      this.status = 'finished';
      return { gameComplete: true, finalScores: this.buildFinalScores() };
    }

    this.startPulka();
    return { pulkaComplete: true, scores: pulkaScores };
  }

  startNextRound() {
    this.startRound();
  }

  getState() {
    return {
      roomId:    this.roomId,
      players:   Array.from(this.players.entries()).map(([id, data]) => ({ id, ...data })),
      status:    this.status,
      gameState: this.gameState ? this.gameState.getState() : null,
    };
  }

  /** Serialize to a plain object suitable for storing in the DB rooms table. */
  toDBRow() {
    return {
      id:     this.roomId,
      status: this.status,
      settings: {
        gameMode:             this.gameMode,
        hishtPenalty:         this.hishtPenalty,
        playInPairs:          this.playInPairs,
        deductions:           this.deductions,
        multiPremiaDeduction: this.multiPremiaDeduction,
        lastBidUntouchable:   this.lastBidUntouchable,
        isRanked:             this.isRanked,
      },
      players: Array.from(this.players.entries()).map(([id, p]) => ({
        id,
        name:   p.name,
        isBot:  p.isBot,
        userId: p.userId ?? null,
      })),
      dealer_index:          this.dealerIndex,
      game_state:            this.gameState ? this.gameState.toJSON() : null,
      pulka_history:         this.pulkaHistory,
      round_history:         this.roundHistory,
      current_pulka_rounds:  this.currentPulkaRounds,
    };
  }

  /** Restore a GameRoom from a DB row (as returned by loadActiveRooms). */
  static fromDB(row) {
    const gr = new GameRoom(row.id, MAX_PLAYERS, row.settings ?? {});
    gr.status      = row.status;
    gr.dealerIndex = row.dealer_index ?? 0;
    gr.pulkaHistory        = row.pulka_history        ?? [];
    gr.roundHistory        = row.round_history        ?? [];
    gr.currentPulkaRounds  = row.current_pulka_rounds ?? [];

    for (const p of (row.players ?? [])) {
      if (p.isBot) {
        gr.players.set(p.id, { name: p.name, socketId: null, ready: true, isBot: true });
      } else {
        gr.players.set(p.id, { name: p.name, socketId: null, ready: true, isBot: false, userId: p.userId ?? null });
      }
    }

    if (row.game_state) {
      try {
        gr.gameState = GameState.fromJSON(row.game_state);
      } catch (e) {
        console.error(`[restore] failed to deserialize game state for room ${row.id}:`, e.message);
        gr.status = 'abandoned';
      }
    }

    return gr;
  }
}
