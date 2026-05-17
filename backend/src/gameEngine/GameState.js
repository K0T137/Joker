import { Deck } from './Deck.js';
import { Card } from './Card.js';
import { TrickResolver } from './TrickResolver.js';
import { PHASES } from './constants.js';
import { RoundManager } from './RoundManager.js';

export class GameState {
  constructor(playerIds, gameMode = 'normal') {
    if (playerIds.length !== 4) {
      throw new Error('Game requires exactly 4 players');
    }

    this.playerIds = playerIds;
    this.playerCount = 4;
    this.gameMode = gameMode;
    this.deck = new Deck();

    this.phase = PHASES.WAITING;
    this.pulkaNumber = 0;
    this.roundNumber = 0;
    this.trickNumber = 0;

    this.dealtCards = {};
    this.trump = null;
    this.trumpCard = null; // full card string of the revealed trump indicator (non-9 rounds)
    this.bids = {};
    this.tricks = [];
    this.currentTrick = [];

    this.tricksCounts = {};
    this.pulkaScores = {};
    this.gameScores = {};

    this.currentLeaderIndex = 0;
    this.cardsInRound = 0;
    this.actionLog = [];

    this.initializePlayerState();
    this.roundManager = new RoundManager(this);
  }

  initializePlayerState() {
    for (const playerId of this.playerIds) {
      this.dealtCards[playerId] = [];
      this.tricksCounts[playerId] = 0;
      this.bids[playerId] = null;
      if (!this.pulkaScores[playerId]) this.pulkaScores[playerId] = 0;
      if (!this.gameScores[playerId])  this.gameScores[playerId]  = 0;
    }
  }

  getPulkaStructure(pulkaNumber)       { return this.roundManager.getPulkaStructure(pulkaNumber); }
  dealRound(cardsPerPlayer)            { this.roundManager.dealRound(cardsPerPlayer); }
  dealNineCardPhase1()                 { this.roundManager.dealNineCardPhase1(); }
  setTrumpAndDealPhase2(suit)          { this.roundManager.setTrumpAndDealPhase2(suit); }
  _resetRoundState(cardsPerPlayer)     { this.roundManager._resetRoundState(cardsPerPlayer); }
  recordBid(playerId, bid)             { return this.roundManager.recordBid(playerId, bid); }
  allPlayersBid()                      { return this.roundManager.allPlayersBid(); }

  playCard(playerId, card, jokerMode = null, takeSuit = null, giveSuit = null) {
    if (this.phase !== PHASES.PLAYING)
      throw new Error(`playCard called in wrong phase: ${this.phase}`);

    const expected = this.getCurrentPlayer();
    if (expected && playerId !== expected)
      throw new Error(`Not your turn — expected ${expected}`);

    const hand        = this.dealtCards[playerId];
    const cardInHand  = hand.find((c) => c.id === card.id);
    if (!cardInHand) throw new Error('Card not in hand');

    this.validateLegalPlay(playerId, card);

    this.currentTrick.push({
      card: cardInHand,
      playerId,
      playerIndex: this.playerIds.indexOf(playerId),
      jokerMode:   jokerMode || 'NORMAL',
      takeSuit,
      giveSuit,
    });

    hand.splice(hand.indexOf(cardInHand), 1);

    this.actionLog.push({
      type:      'CARD_PLAYED',
      playerId,
      card:      cardInHand.toString(),
      jokerMode: jokerMode || 'NORMAL',
      takeSuit:  takeSuit  || null,
      giveSuit:  giveSuit  || null,
      timestamp: Date.now(),
    });

    return this.currentTrick.length === 4;
  }

  validateLegalPlay(playerId, card) {
    const hand      = this.dealtCards[playerId];
    const firstPlay = this.currentTrick.length > 0 ? this.currentTrick[0] : null;
    if (!firstPlay) return true;

    // TAKE Joker lead: every player must play their highest card of the declared suit.
    // If they have none of it, they must play trump. Only TAKE-as-lead triggers this —
    // HIGH Joker (non-leading) places no special obligation on other players.
    if (firstPlay.card.isJoker() && firstPlay.jokerMode === 'TAKE' && firstPlay.takeSuit) {
      if (card.isJoker()) return true; // Joker is always playable
      const declaredSuit = firstPlay.takeSuit === 'TRUMP' ? this.trump : firstPlay.takeSuit;
      const suitCards    = hand.filter(c => !c.isJoker() && c.suit === declaredSuit);
      if (suitCards.length > 0) {
        const highest = suitCards.reduce((max, c) => c.rankValue() > max.rankValue() ? c : max);
        if (card.id !== highest.id) throw new Error('Must play highest card of declared suit');
        return true;
      }
      // No declared-suit cards — must play trump if available
      if (this.trump && this.trump !== 'NO_TRUMP') {
        const trumpCards = hand.filter(c => c.suit === this.trump);
        if (trumpCards.length > 0 && card.suit !== this.trump) {
          throw new Error('Must play trump');
        }
      }
      return true;
    }

    const leadCard = firstPlay.card;
    let leadSuit;
    if (leadCard.isJoker() && firstPlay.jokerMode === 'GIVE' && firstPlay.giveSuit) {
      // GIVE Joker lead: Joker is the "lowest" of the declared suit; players must follow that suit.
      leadSuit = firstPlay.giveSuit === 'TRUMP' ? this.trump : firstPlay.giveSuit;
    } else {
      // HIGH / LOW Joker lead, or regular card lead
      leadSuit = leadCard.suit; // 'JOKER' for HIGH/LOW leads → no suit constraint
    }

    const suitCards = hand.filter((c) => c.suit === leadSuit);
    if (suitCards.length > 0 && card.suit !== leadSuit && !card.isJoker()) {
      throw new Error('Must follow suit');
    }

    if (this.trump && this.trump !== 'NO_TRUMP') {
      const trumpCards = hand.filter((c) => c.suit === this.trump);
      if (suitCards.length === 0 && trumpCards.length > 0 && !(card.suit === this.trump || card.isJoker())) {
        throw new Error('Must play trump');
      }
    }

    return true;
  }

  resolveTrick() {
    if (this.phase !== PHASES.PLAYING)
      throw new Error(`resolveTrick called in wrong phase: ${this.phase}`);
    if (this.currentTrick.length !== 4) throw new Error('Trick not complete');

    const result = TrickResolver.resolveTrick(this.currentTrick, this.trump, this.currentLeaderIndex);

    this.tricks.push({ cards: this.currentTrick, winner: result.winnerId, winnerIndex: result.winnerIndex });
    this.tricksCounts[result.winnerId]++;
    this.currentLeaderIndex = result.winnerIndex;
    this.currentTrick = [];
    this.trickNumber++;

    this.actionLog.push({
      type:        'TRICK_RESOLVED',
      trickNumber: this.trickNumber,
      winnerId:    result.winnerId,
      explanation: result.explanation,
      timestamp:   Date.now(),
    });

    return result;
  }

  isRoundComplete() {
    return Object.values(this.dealtCards).every((hand) => hand.length === 0);
  }

  getCurrentBidder()                   { return this.roundManager.getCurrentBidder(); }

  getCurrentPlayer() {
    const offset = this.currentTrick.length;
    return this.playerIds[(this.currentLeaderIndex + offset) % this.playerIds.length];
  }

  getActionLog() {
    return [...this.actionLog];
  }

  getState() {
    return {
      phase:         this.phase,
      pulkaNumber:   this.pulkaNumber,
      roundNumber:   this.roundNumber,
      trickNumber:   this.trickNumber,
      trump:         this.trump,
      trumpCard:     this.trumpCard,
      bids:          { ...this.bids },
      tricksCounts:  { ...this.tricksCounts },
      currentTrick:  this.currentTrick.map((p) => ({
        playerId:  p.playerId,
        card:      p.card.toString(),
        jokerMode: p.jokerMode || null,
        takeSuit:  p.takeSuit  || null,
        giveSuit:  p.giveSuit  || null,
      })),
      tricks:        this.tricks.length,
      pulkaScores:   { ...this.pulkaScores },
      gameScores:    { ...this.gameScores },
      currentPlayer:  this.getCurrentPlayer(),
      currentBidder:  this.phase === PHASES.BIDDING ? this.roundManager.getCurrentBidder() : null,
      cardsInRound:   this.cardsInRound,
    };
  }

  toJSON() {
    return {
      playerIds:          this.playerIds,
      gameMode:           this.gameMode,
      phase:              this.phase,
      pulkaNumber:        this.pulkaNumber,
      roundNumber:        this.roundNumber,
      trickNumber:        this.trickNumber,
      trump:              this.trump,
      trumpCard:          this.trumpCard,
      bids:               { ...this.bids },
      tricksCounts:       { ...this.tricksCounts },
      pulkaScores:        { ...this.pulkaScores },
      gameScores:         { ...this.gameScores },
      currentLeaderIndex: this.currentLeaderIndex,
      cardsInRound:       this.cardsInRound,
      actionLog:          [...this.actionLog],
      dealtCards: Object.fromEntries(
        Object.entries(this.dealtCards).map(([pid, cards]) => [pid, cards.map(c => c.toString())])
      ),
      // remaining deck cards needed for 9-card phase-2 deal
      deckCards: this.deck.cards.map(c => c.toString()),
      currentTrick: this.currentTrick.map(e => ({
        playerId:    e.playerId,
        playerIndex: e.playerIndex,
        card:        e.card.toString(),
        jokerMode:   e.jokerMode,
        takeSuit:    e.takeSuit,
        giveSuit:    e.giveSuit,
      })),
      tricks: this.tricks.map(t => ({
        winner:      t.winner,
        winnerIndex: t.winnerIndex,
        cards:       t.cards.map(e => ({
          playerId:    e.playerId,
          playerIndex: e.playerIndex,
          card:        e.card.toString(),
          jokerMode:   e.jokerMode,
          takeSuit:    e.takeSuit,
          giveSuit:    e.giveSuit,
        })),
      })),
    };
  }

  static fromJSON(json) {
    const gs = new GameState(json.playerIds, json.gameMode);
    gs.phase              = json.phase;
    gs.pulkaNumber        = json.pulkaNumber;
    gs.roundNumber        = json.roundNumber;
    gs.trickNumber        = json.trickNumber;
    gs.trump              = json.trump;
    gs.trumpCard          = json.trumpCard;
    gs.bids               = { ...json.bids };
    gs.tricksCounts       = { ...json.tricksCounts };
    gs.pulkaScores        = { ...json.pulkaScores };
    gs.gameScores         = { ...json.gameScores };
    gs.currentLeaderIndex = json.currentLeaderIndex;
    gs.cardsInRound       = json.cardsInRound;
    gs.actionLog          = [...(json.actionLog ?? [])];
    gs.dealtCards = Object.fromEntries(
      Object.entries(json.dealtCards).map(([pid, cards]) => [pid, cards.map(Card.fromString)])
    );
    gs.deck.cards = (json.deckCards ?? []).map(Card.fromString);
    gs.currentTrick = json.currentTrick.map(e => ({
      ...e, card: Card.fromString(e.card),
    }));
    gs.tricks = json.tricks.map(t => ({
      ...t,
      cards: t.cards.map(e => ({ ...e, card: Card.fromString(e.card) })),
    }));
    return gs;
  }

  getPlayerHand(playerId) {
    const SUIT_ORDER = ['♠', '♥', '♦', '♣'];
    const RANK_ORDER = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    return [...(this.dealtCards[playerId] ?? [])]
      .sort((a, b) => {
        if (a.isJoker() && b.isJoker()) return 0;
        if (a.isJoker()) return 1;
        if (b.isJoker()) return -1;
        const sd = SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit);
        return sd !== 0 ? sd : RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank);
      })
      .map(c => c.toString());
  }
}
