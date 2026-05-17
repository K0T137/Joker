/**
 * Trick resolution logic
 * Determines winner of each trick based on Joker mechanics and trump
 */
export class TrickResolver {
  /**
   * Resolve a single trick
   * @param {Array}  playedCards      - [{ card, playerId, playerIndex, jokerMode }]
   * @param {string} trump             - Trump suit or 'NO_TRUMP'
   * @param {number} firstPlayerIndex  - Index of player who played first
   * @returns {Object} { winnerId, winnerIndex, winningCard, explanation }
   */
  static resolveTrick(playedCards, trump, firstPlayerIndex) {
    if (playedCards.length === 0) {
      throw new Error('No cards in trick');
    }

    const firstCard           = playedCards[0].card;
    const firstPlayerJokerMode = playedCards[0].jokerMode;

    // Handle FIRST JOKER cases (TAKE / GIVE only valid when Joker leads)
    if (firstCard.isJoker()) {
      if (firstPlayerJokerMode === 'TAKE') {
        return this.handleTakeMode(playedCards, trump, firstPlayerIndex);
      }
      if (firstPlayerJokerMode === 'GIVE') {
        return this.handleGiveMode(playedCards, trump, firstPlayerIndex);
      }
      // HIGH or LOW fall through to normal resolution below
    }

    return this.resolveNormalTrick(playedCards, trump, firstCard);
  }

  /**
   * MODE A: TAKE — Joker player declares trump or a specific suit
   */
  static handleTakeMode(playedCards, trump, firstPlayerIndex) {
    const jokerCard  = playedCards[0].card;
    const jokerSuit  = playedCards[0].takeSuit;
    const actualSuit = jokerSuit === 'TRUMP' ? trump : jokerSuit;

    // In both TRUMP and non-trump TAKE: a subsequent HIGH or TAKE Joker always wins.
    // HIGH Joker is the absolute highest card and overrides any TAKE Joker lead.
    const subsequent       = playedCards.slice(1);
    const subsequentJokers = subsequent.filter(
      p => p.card.isJoker() && (p.jokerMode === 'HIGH' || p.jokerMode === 'TAKE')
    );
    if (subsequentJokers.length > 0) {
      const last = subsequentJokers[subsequentJokers.length - 1];
      return {
        winnerId:    last.playerId,
        winnerIndex: last.playerIndex,
        winningCard: last.card,
        explanation: 'Subsequent HIGH Joker overrides TAKE Joker',
      };
    }

    // TAKE as TRUMP with no override: TAKE Joker wins
    if (actualSuit === trump || jokerSuit === 'TRUMP') {
      return {
        winnerId:    playedCards[0].playerId,
        winnerIndex: playedCards[0].playerIndex,
        winningCard: jokerCard,
        explanation: 'Joker TAKE as TRUMP wins',
      };
    }

    // Trump overrides TAKE non-trump suit: a player who had none of the declared suit
    // and played trump wins instead.
    if (trump && trump !== 'NO_TRUMP') {
      const trumpPlays = subsequent.filter(p => !p.card.isJoker() && p.card.suit === trump);
      if (trumpPlays.length > 0) {
        const highest = trumpPlays.reduce((max, p) =>
          p.card.rankValue() > max.card.rankValue() ? p : max
        );
        return {
          winnerId:    highest.playerId,
          winnerIndex: highest.playerIndex,
          winningCard: highest.card,
          explanation: `Trump ${highest.card.toString()} beats TAKE Joker`,
        };
      }
    }

    return {
      winnerId:    playedCards[0].playerId,
      winnerIndex: playedCards[0].playerIndex,
      winningCard: jokerCard,
      explanation: `Joker TAKE as ${jokerSuit} wins`,
    };
  }

  /**
   * MODE B: GIVE — Joker player declares a suit and intentionally loses
   */
  static handleGiveMode(playedCards, trump, firstPlayerIndex) {
    const jokerCard = playedCards[0].card;
    const giveSuit  = playedCards[0].giveSuit;

    // Only cards matching the declared suit, trump, or another Joker can win
    const validCards = playedCards.slice(1).filter((play) => {
      const card = play.card;
      return card.suit === giveSuit || (trump && card.suit === trump) || card.isJoker();
    });

    if (validCards.length === 0) {
      // No one can respond: Joker player wins by default
      return {
        winnerId:    playedCards[0].playerId,
        winnerIndex: playedCards[0].playerIndex,
        winningCard: jokerCard,
        explanation: 'First Joker in GIVE mode wins (no valid responses)',
      };
    }

    // Winner is determined among the valid responders
    // Pass giveSuit as forceLeadSuit so the suit hierarchy is correct
    return this.resolveNormalTrick(validCards, trump, null, giveSuit);
  }

  /**
   * Normal trick resolution: follow suit > trump > high card
   * LOW Jokers are excluded from winning (guaranteed to lose).
   *
   * @param {Array}   playedCards   - cards to evaluate
   * @param {string}  trump         - trump suit
   * @param {Card}    leadCard      - card that led the trick (null when forceLeadSuit provided)
   * @param {string}  forceLeadSuit - explicit lead suit override
   */
  static resolveNormalTrick(playedCards, trump, leadCard, forceLeadSuit = null) {
    const leadSuit = forceLeadSuit || (leadCard && leadCard.suit);

    // LOW Jokers are guaranteed to lose — remove from winning candidates
    const pool = playedCards.filter((p) => !(p.card.isJoker() && p.jokerMode === 'LOW'));
    const candidates = pool.length > 0 ? pool : playedCards;

    // Multiple Jokers: LAST HIGH Joker always wins
    const jokerMoves = candidates.filter((p) => p.card.isJoker());
    if (jokerMoves.length >= 2) {
      const validJokers = jokerMoves.filter(
        (p) => p.jokerMode === 'HIGH' || p.jokerMode === 'TAKE'
      );
      if (validJokers.length > 0) {
        const lastHighJoker = validJokers[validJokers.length - 1];
        return {
          winnerId:    lastHighJoker.playerId,
          winnerIndex: lastHighJoker.playerIndex,
          winningCard: lastHighJoker.card,
          explanation: 'Last HIGH Joker always wins',
        };
      }
    }

    // Single HIGH Joker beats all
    const highJoker = candidates.find((p) => p.card.isJoker() && p.jokerMode === 'HIGH');
    if (highJoker) {
      return {
        winnerId:    highJoker.playerId,
        winnerIndex: highJoker.playerIndex,
        winningCard: highJoker.card,
        explanation: 'HIGH Joker wins',
      };
    }

    // Filter cards that can compete: lead suit or trump
    const validCards = candidates.filter((p) => {
      const card = p.card;
      return card.suit === leadSuit || (trump && card.suit === trump);
    });

    // No one played lead suit or trump: first candidate wins
    if (validCards.length === 0) {
      return {
        winnerId:    candidates[0].playerId,
        winnerIndex: candidates[0].playerIndex,
        winningCard: candidates[0].card,
        explanation: 'No valid plays, first player wins',
      };
    }

    // Trump beats non-trump
    const trumpCards = validCards.filter((p) => p.card.suit === trump);
    const nonTrump   = validCards.filter((p) => p.card.suit !== trump);

    if (trumpCards.length > 0) {
      // Highest trump wins regardless of non-trump
      const winner = trumpCards.reduce((max, p) =>
        p.card.rankValue() > max.card.rankValue() ? p : max
      );
      return {
        winnerId:    winner.playerId,
        winnerIndex: winner.playerIndex,
        winningCard: winner.card,
        explanation: nonTrump.length > 0
          ? `Trump ${winner.card.toString()} beats non-trump`
          : `Highest trump (${winner.card.toString()}) wins`,
      };
    }

    // Lead suit only: highest lead suit wins
    const highestLead = validCards.reduce((max, p) =>
      p.card.rankValue() > max.card.rankValue() ? p : max
    );
    return {
      winnerId:    highestLead.playerId,
      winnerIndex: highestLead.playerIndex,
      winningCard: highestLead.card,
      explanation: `Highest lead suit (${highestLead.card.toString()}) wins`,
    };
  }
}
