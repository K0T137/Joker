import { PHASES } from './constants.js';
import { PULKA_STRUCTURES, NINE_CARD_PHASE1_DEAL, NINE_CARD_PHASE2_DEAL } from '../config.js';

export class RoundManager {
  constructor(gs) {
    this.gs = gs;
  }

  getPulkaStructure(pulkaNumber) {
    const mode   = this.gs.gameMode === 'only9' ? 'only9'
               : this.gs.gameMode === 'quick'  ? 'quick'
               : 'normal';
    const struct = PULKA_STRUCTURES[mode][pulkaNumber];
    if (!struct) throw new Error(`Invalid pulka number: ${pulkaNumber}`);
    return struct;
  }

  dealRound(cardsPerPlayer) {
    this.gs.deck.reset().shuffle();
    this._resetRoundState(cardsPerPlayer);

    for (let i = 0; i < this.gs.playerCount; i++) {
      const pid = this.gs.playerIds[i];
      this.gs.dealtCards[pid] = this.gs.deck.draw(cardsPerPlayer);
      this.gs.tricksCounts[pid] = 0;
      this.gs.bids[pid] = null;
    }

    const top = this.gs.deck.peek(0);
    if (!top || top.isJoker()) {
      this.gs.trump     = 'NO_TRUMP';
      this.gs.trumpCard = null;
    } else {
      this.gs.trump     = top.suit;
      this.gs.trumpCard = top.toString();
    }

    this.gs.phase = PHASES.BIDDING;
  }

  dealNineCardPhase1() {
    this.gs.deck.reset().shuffle();
    this._resetRoundState(9);

    for (let i = 0; i < this.gs.playerCount; i++) {
      const pid = this.gs.playerIds[i];
      this.gs.dealtCards[pid] = this.gs.deck.draw(NINE_CARD_PHASE1_DEAL);
      this.gs.tricksCounts[pid] = 0;
      this.gs.bids[pid] = null;
    }

    this.gs.trump     = null;
    this.gs.trumpCard = null;
    this.gs.phase     = PHASES.TRUMP_SELECTION;
  }

  setTrumpAndDealPhase2(suit) {
    if (this.gs.phase !== PHASES.TRUMP_SELECTION)
      throw new Error(`setTrumpAndDealPhase2 called in wrong phase: ${this.gs.phase}`);

    this.gs.trump     = suit;
    this.gs.trumpCard = null;

    for (let i = 0; i < this.gs.playerCount; i++) {
      const pid = this.gs.playerIds[i];
      this.gs.dealtCards[pid] = [...this.gs.dealtCards[pid], ...this.gs.deck.draw(NINE_CARD_PHASE2_DEAL)];
    }

    this.gs.phase = PHASES.BIDDING;
  }

  _resetRoundState(cardsPerPlayer) {
    this.gs.dealtCards         = {};
    this.gs.currentTrick       = [];
    this.gs.tricks             = [];
    this.gs.tricksCounts       = {};
    this.gs.bids               = {};
    this.gs.currentLeaderIndex = 0;
    this.gs.cardsInRound       = cardsPerPlayer;
    this.gs.actionLog          = [];
  }

  recordBid(playerId, bid) {
    if (this.gs.phase !== PHASES.BIDDING)
      throw new Error(`recordBid called in wrong phase: ${this.gs.phase}`);
    const expected = this.getCurrentBidder();
    if (expected && expected !== playerId)
      throw new Error(`Not your turn to bid`);
    if (bid < 0 || bid > 9) throw new Error('Bid must be 0-9');
    this.gs.bids[playerId] = bid;

    if (this.allPlayersBid()) {
      const totalBids       = Object.values(this.gs.bids).reduce((a, b) => a + b, 0);
      const tricksAvailable = this.gs.cardsInRound;
      const lastBidderId    = this.gs.playerIds[(this.gs.currentLeaderIndex + 3) % this.gs.playerIds.length];

      if (totalBids === tricksAvailable) {
        delete this.gs.bids[lastBidderId];
        return false;
      }

      this.gs.phase = PHASES.PLAYING;
      return true;
    }

    return true;
  }

  allPlayersBid() {
    return this.gs.playerIds.every((pid) => this.gs.bids[pid] !== null && this.gs.bids[pid] !== undefined);
  }

  getCurrentBidder() {
    const n = this.gs.playerIds.length;
    for (let i = 0; i < n; i++) {
      const pid = this.gs.playerIds[(this.gs.currentLeaderIndex + i) % n];
      if (this.gs.bids[pid] === null || this.gs.bids[pid] === undefined) return pid;
    }
    return null;
  }
}
