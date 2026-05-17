/**
 * Bot AI for the Joker card game.
 *
 * Joker philosophy:
 *  The Joker is the highest card and wins almost any trick (99%).
 *  - TAKE (lead): forces every player to contribute their highest card of the
 *    declared suit, stripping Ace/King from opponents and promoting lower
 *    cards (e.g. Queen → top trump).  Prefer declaring trump to maximise
 *    stripping value.  Use proactively — the earlier the better.
 *  - HIGH (follow): steal a trick you cannot win with a regular card.
 *  - LOW: ONLY when you have already met your bid and one more trick would
 *    bust it, OR (advanced) to sabotage an opponent's premia bid in the
 *    last rounds of a pulka.  Wasting Joker LOW for any other reason is
 *    strictly wrong.
 */
export class BotPlayer {

  // ── Trump selection (9-card round phase 1) ────────────────────────────────
  static pickTrump(hand) {
    const counts = {};
    for (const c of hand) {
      if (!c.isJoker()) counts[c.suit] = (counts[c.suit] ?? 0) + 1;
    }
    const suits = ['♠', '♥', '♦', '♣'];
    const best  = suits.reduce((a, b) => (counts[a] ?? 0) >= (counts[b] ?? 0) ? a : b);
    return (counts[best] ?? 0) >= 2 ? best : 'NO_TRUMP';
  }

  // ── Bidding ───────────────────────────────────────────────────────────────
  static pickBid(hand, trump, forbiddenBid = null) {
    let estimate = 0;
    for (const card of hand) {
      if (card.isJoker()) { estimate += 0.9; continue; }   // Joker = near-guaranteed trick
      if (card.rank === 'A') estimate += 1;
      else if (card.rank === 'K') estimate += 0.6;
      else if (card.rank === 'Q') estimate += 0.3;
      if (trump && trump !== 'NO_TRUMP' && card.suit === trump) estimate += 0.2;
    }
    let bid = Math.min(Math.round(estimate), hand.length);

    if (forbiddenBid !== null && bid === forbiddenBid) {
      if (bid < hand.length) bid++;
      else if (bid > 0)      bid--;
    }
    return bid;
  }

  // ── Card selection ────────────────────────────────────────────────────────
  /**
   * @returns {{ card: Card, jokerMode: string, takeSuit: string|null, giveSuit: string|null }}
   */
  static pickCard(hand, currentTrick, trump, context = {}) {
    const joker     = hand.find(c => c.isJoker()) ?? null;
    const nonJokers = hand.filter(c => !c.isJoker());
    const pool      = nonJokers.length > 0 ? nonJokers : hand;

    const {
      myId         = null,
      playerIds    = [],
      bids         = {},
      tricksCounts = {},
      cardsInRound = 0,
      gameScores   = {},
    } = context;

    // ── Situational awareness ─────────────────────────────────────────────
    const totalTaken  = Object.values(tricksCounts).reduce((s, v) => s + v, 0);
    const tricksLeft  = Math.max(0, cardsInRound - totalTaken);
    const myNeeded    = (bids[myId] ?? 0) - (tricksCounts[myId] ?? 0);

    const opps = playerIds
      .filter(id => id !== myId)
      .map(id => ({
        id,
        needed: (bids[id] ?? 0) - (tricksCounts[id] ?? 0),
        score:  gameScores[id] ?? 0,
      }));

    const maxScore  = Math.max(0, ...Object.values(gameScores));
    const leaderIds = new Set(
      Object.entries(gameScores)
        .filter(([, s]) => s === maxScore && maxScore > 0)
        .map(([id]) => id)
    );

    if (currentTrick.length === 0) {
      return this._lead(pool, joker, trump, myNeeded, tricksLeft, opps, leaderIds);
    }
    return this._follow(pool, joker, currentTrick, trump, myNeeded, tricksLeft, opps, leaderIds);
  }

  // ── Lead ─────────────────────────────────────────────────────────────────
  static _lead(pool, joker, trump, myNeeded, tricksLeft, _opps, _leaderIds) {
    const highest = [...pool].sort((a, b) => b.rankValue() - a.rankValue())[0];
    const lowest  = [...pool].sort((a, b) => a.rankValue() - b.rankValue())[0];

    if (myNeeded > 0) {
      if (joker) {
        // TAKE Joker is the premier proactive play:
        //   • Guarantees one trick immediately
        //   • Declaring trump strips opponents of Ace/King trump, promoting
        //     the bot's remaining trumps (Q → top, J → second, etc.)
        //   • Better used early than late — more stripping value available
        //
        // Only hold the Joker back when we already have enough guaranteed
        // winners in hand to cover the remaining needed tricks without it
        // (e.g. 2 Aces in trump when needing 2 more tricks with 4+ left).
        const trumpCards   = trump && trump !== 'NO_TRUMP'
          ? pool.filter(c => c.suit === trump) : [];
        const guaranteedWins = pool.filter(c => c.rankValue() === 8).length  // Aces always win
          + (trumpCards.filter(c => c.rankValue() >= 6).length);              // K/A in trump
        const canCoverWithout = guaranteedWins >= myNeeded && tricksLeft > myNeeded + 2;

        if (!canCoverWithout) {
          const takeSuit = this._bestTakeSuit(pool, trump);
          return this._play(joker, 'TAKE', takeSuit);
        }
      }
      return this._play(highest);
    }

    // Bid already met — avoid winning more tricks.
    // LOW Joker only when every regular card is K or A (too dangerous to lead).
    if (joker && lowest && lowest.rankValue() >= 7) {
      return this._play(joker, 'LOW');
    }
    return this._play(lowest);
  }

  // ── Follow ────────────────────────────────────────────────────────────────
  static _follow(pool, joker, currentTrick, trump, myNeeded, _tricksLeft, opps, leaderIds) {
    const lead = currentTrick[0];

    // ── TAKE Joker lead: must play highest card of declared suit ──────────
    if (lead.card.isJoker() && lead.jokerMode === 'TAKE' && lead.takeSuit) {
      const suit    = lead.takeSuit === 'TRUMP' ? trump : lead.takeSuit;
      const suited  = pool.filter(c => c.suit === suit);
      if (suited.length > 0) {
        // Must play the highest — engine enforces this, bot complies
        return this._play(suited.sort((a, b) => b.rankValue() - a.rankValue())[0]);
      }
      // No declared-suit cards — must play trump if available
      const trumpCards = pool.filter(c => c.suit === trump && trump !== 'NO_TRUMP');
      if (trumpCards.length > 0) {
        return this._play(trumpCards.sort((a, b) => a.rankValue() - b.rankValue())[0]);
      }
      // Can't beat TAKE Joker — discard a low regular card rather than burning our Joker
      const cheapDiscard = [...pool].filter(c => !c.isJoker()).sort((a, b) => a.rankValue() - b.rankValue())[0];
      if (cheapDiscard) return this._play(cheapDiscard);
      if (joker) return this._play(joker, 'LOW'); // only Joker left — must play it
      return this._play([...pool].sort((a, b) => a.rankValue() - b.rankValue())[0]);
    }

    // ── Determine lead suit ───────────────────────────────────────────────
    let leadSuit;
    if (lead.card.isJoker() && lead.jokerMode === 'GIVE' && lead.giveSuit) {
      // GIVE Joker: Joker is "lowest of declared suit" — follow that suit normally
      leadSuit = lead.giveSuit === 'TRUMP' ? trump : lead.giveSuit;
    } else {
      // HIGH / LOW Joker lead, or regular card — use card's suit
      // HIGH/LOW leads have suit='JOKER' so suitCards will be empty; no follow required
      leadSuit = lead.card.suit;
    }

    const winnerEntry    = this._currentWinner(currentTrick, trump, leadSuit);
    const winnerOpp      = opps.find(o => o.id === winnerEntry?.playerId);
    const winnerNeeded   = winnerOpp?.needed ?? 0;
    const winnerIsLeader = leaderIds.has(winnerEntry?.playerId);

    const wantWin = myNeeded > 0
      || (winnerOpp !== undefined && winnerNeeded <= 0)
      || winnerIsLeader;

    const suitCards  = pool.filter(c => c.suit === leadSuit);
    const trumpCards = pool.filter(c => c.suit === trump && trump !== 'NO_TRUMP');

    // ── Must follow suit ──────────────────────────────────────────────────
    if (suitCards.length > 0) {
      if (wantWin) {
        const winning = this._beating(suitCards, winnerEntry, trump, leadSuit);
        if (winning.length > 0) {
          return this._play(winning.sort((a, b) => a.rankValue() - b.rankValue())[0]);
        }
        // Can't beat with suit cards → HIGH Joker steals the trick
        if (joker && myNeeded > 0) {
          return this._play(joker, 'HIGH');
        }
      }
      return this._play(suitCards.sort((a, b) => a.rankValue() - b.rankValue())[0]);
    }

    // ── No suit cards — may play trump ────────────────────────────────────
    if (trump && trump !== 'NO_TRUMP' && trumpCards.length > 0) {
      if (wantWin) {
        const winning = this._beating(trumpCards, winnerEntry, trump, leadSuit);
        if (winning.length > 0) {
          return this._play(winning.sort((a, b) => a.rankValue() - b.rankValue())[0]);
        }
        // Can't beat with trump either → HIGH Joker steals the trick
        if (joker && myNeeded > 0) {
          return this._play(joker, 'HIGH');
        }
      }
      // Don't want to win but must play trump (game rule) — use lowest trump.
      // LOW Joker is better here when bid is already met and playing trump would win.
      if (joker && myNeeded <= 0) {
        const lowestTrump = trumpCards.sort((a, b) => a.rankValue() - b.rankValue())[0];
        const lowestWins  = this._beats(lowestTrump, winnerEntry?.card, trump, leadSuit,
                                        'NORMAL', winnerEntry?.jokerMode ?? 'NORMAL');
        if (lowestWins) return this._play(joker, 'LOW'); // avoid accidental over-trick
      }
      return this._play(trumpCards.sort((a, b) => a.rankValue() - b.rankValue())[0]);
    }

    // ── Discard (no suit, no trump) ───────────────────────────────────────
    if (joker && myNeeded > 0) {
      // HIGH Joker is the only guaranteed win in a discard — use it
      return this._play(joker, 'HIGH');
    }
    if (joker && myNeeded <= 0) {
      // Bid met — LOW Joker avoids the unwanted trick (Joker would otherwise win)
      return this._play(joker, 'LOW');
    }
    return this._play([...pool].sort((a, b) => a.rankValue() - b.rankValue())[0]);
  }

  // ── Utilities ─────────────────────────────────────────────────────────────
  static _play(card, jokerMode = 'NORMAL', takeSuit = null, giveSuit = null) {
    return { card, jokerMode, takeSuit, giveSuit };
  }

  /** Choose the suit to declare when playing TAKE/HIGH Joker: trump first, else most-held. */
  static _bestTakeSuit(pool, trump) {
    if (trump && trump !== 'NO_TRUMP') return trump;
    return this._mostHeldSuit(pool);
  }

  static _mostHeldSuit(cards) {
    const counts = {};
    for (const c of cards) {
      if (!c.isJoker()) counts[c.suit] = (counts[c.suit] ?? 0) + 1;
    }
    const suits = Object.keys(counts);
    if (!suits.length) return '♠';
    return suits.reduce((a, b) => (counts[a] ?? 0) >= (counts[b] ?? 0) ? a : b);
  }

  static _beating(cards, winnerEntry, trump, leadSuit) {
    if (!winnerEntry) return cards;
    return cards.filter(c =>
      this._beats(c, winnerEntry.card, trump, leadSuit, 'NORMAL', winnerEntry.jokerMode ?? 'NORMAL')
    );
  }

  static _beats(card, against, trump, leadSuit, cardMode = 'NORMAL', againstMode = 'NORMAL') {
    if (card.isJoker()    && cardMode    === 'HIGH') return true;
    if (against.isJoker() && againstMode === 'HIGH') return false;
    if (card.isJoker()    && cardMode    === 'LOW')  return false;
    if (against.isJoker() && againstMode === 'LOW')  return true;

    const t      = trump && trump !== 'NO_TRUMP';
    const cTrump = t && card.suit    === trump;
    const aTrump = t && against.suit === trump;

    if (cTrump  && !aTrump) return true;
    if (!cTrump && aTrump)  return false;
    if (cTrump  && aTrump)  return card.rankValue() > against.rankValue();

    if (card.suit !== leadSuit)    return false;
    if (against.suit !== leadSuit) return true;
    return card.rankValue() > against.rankValue();
  }

  static _currentWinner(trick, trump, leadSuit) {
    if (!trick.length) return null;
    let best = trick[0];
    for (let i = 1; i < trick.length; i++) {
      const e = trick[i];
      if (this._beats(e.card, best.card, trump, leadSuit, e.jokerMode ?? 'NORMAL', best.jokerMode ?? 'NORMAL')) {
        best = e;
      }
    }
    return best;
  }
}
