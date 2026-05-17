export class Scorer {
  /**
   * Calculate score for a single round.
   * hishtMode: 'fixed' → always -200; 'dynamic' → -(cardsInRound×100)
   *
   * Priority:
   *   1. bid=0 AND tricks=0  → +50
   *   2. bid=tricks (exact)  → base 50+bid*50, or enhanced bid*100 when bid=cardsInRound
   *   3. bid>0 AND tricks=0  → hisht penalty (fixed or dynamic)
   *   4. miss with tricks>0  → tricks * 10
   */
  static calculateRoundScore(bid, tricksTaken, cardsInRound, hishtMode = 'dynamic', hishtPenalty = 200) {
    // 1. Zero bid, zero tricks
    if (bid === 0 && tricksTaken === 0) return 50;

    // 2. Exact match
    if (bid === tricksTaken) {
      // Enhanced: bid equals the round's card count (all tricks taken)
      if (bid === cardsInRound) return bid * 100;
      // Base table: 50 + 50*bid for bids 1–8; bid 9 always hits enhanced above
      return 50 + bid * 50;
    }

    // 3. Hisht: bid > 0 but took 0 tricks
    if (bid > 0 && tricksTaken === 0) {
      return hishtMode === 'fixed' ? -hishtPenalty : -(cardsInRound * 100);
    }

    // 4. Miss with tricks taken
    return tricksTaken * 10;
  }

  /**
   * Pulka premia (bonus) applied at end of pulka.
   *
   * Premia is earned only by players with 100% bid accuracy (every round exact).
   * - Nobody on premia → no bonuses or penalties for anyone.
   * - One player on premia → they get +maxRound; each other player loses -maxRound.
   * - Multiple players on premia → each gets +maxRound; no penalty to others.
   *
   * "maxRound" is calculated excluding the last round of the pulka
   * (the last round score is not doubled / not erased).
   *
   * @param {Object}  results      - { pid: { roundScores, total } }
   * @param {Array}   playerBids   - [{ pid: bid }, …] one per round
   * @param {Array}   roundTricks  - [{ pid: tricks }, …] one per round
   */
  /**
   * @param {Object} options
   *   deductions           {boolean} — non-premia players lose their max round (default true)
   *   multiPremiaDeduction {boolean} — in non-pairs mode, deduct others even when 2+ on premia (default false)
   *   lastBidUntouchable   {boolean} — exclude last round when computing maxRound (default true)
   *   partnerOf            {Object}  — { pid: partnerPid } for pairs mode; empty otherwise
   *   teamOf               {Object}  — { pid: 'A'|'B' } for pairs mode; empty otherwise
   */
  static calculatePulkaBonus(results, playerBids, roundTricks, options = {}) {
    const {
      deductions           = true,
      multiPremiaDeduction = false,
      lastBidUntouchable   = true,
      partnerOf            = {},
      teamOf               = {},
    } = options;

    const pairsEnabled = Object.keys(partnerOf).length > 0;
    const bonusModifiers = {};
    for (const pid in results) bonusModifiers[pid] = 0;

    const premiaIds = Object.keys(results).filter(pid =>
      playerBids.every((bids, i) => {
        const bid    = bids[pid] ?? null;
        const tricks = roundTricks[i]?.[pid] ?? 0;
        return bid !== null && bid === tricks;
      })
    );

    if (premiaIds.length === 0) return bonusModifiers;

    const maxRound = (pid) => {
      const scores = lastBidUntouchable
        ? results[pid].roundScores.slice(0, -1)
        : results[pid].roundScores;
      return scores.length > 0 ? Math.max(0, ...scores) : 0;
    };

    // Premia winners always earn their bonus
    for (const pid of premiaIds) bonusModifiers[pid] = maxRound(pid);

    if (!deductions) return bonusModifiers;

    // Pairs: if players from DIFFERENT teams are simultaneously on premia → no deductions
    if (pairsEnabled && premiaIds.length >= 2) {
      const teamsOnPremia = new Set(premiaIds.map(pid => teamOf[pid]));
      if (teamsOnPremia.size > 1) return bonusModifiers;
    }

    for (const pid in results) {
      if (premiaIds.includes(pid)) continue;

      // Pairs: your partner being on premia exempts you from deduction
      if (pairsEnabled && premiaIds.includes(partnerOf[pid])) continue;

      // Non-pairs: multiple premia with deduction turned off → no penalty
      if (!pairsEnabled && premiaIds.length > 1 && !multiPremiaDeduction) continue;

      bonusModifiers[pid] = -maxRound(pid);
    }

    return bonusModifiers;
  }

  /**
   * @param {Array}  rounds      - [{playerId: tricksTaken}, ...]
   * @param {Array}  playerBids  - [{playerId: bid}, ...]
   * @param {Array}  cardCounts  - [cardsInRound, ...]
   * @param {string} hishtMode   - 'fixed' | 'dynamic'
   * @param {number} hishtPenalty
   * @param {Object} options     - passed through to calculatePulkaBonus
   * @returns {Object} { playerId: { roundScores, total, pulkaBonus } }
   */
  static calculatePulkaScores(rounds, playerBids, cardCounts, hishtMode = 'dynamic', hishtPenalty = 200, options = {}) {
    const results = {};

    const playerIds = Object.keys(playerBids[0] || {});
    for (const pid of playerIds) results[pid] = { roundScores: [], total: 0 };

    rounds.forEach((round, i) => {
      const cardsInRound = cardCounts[i] ?? 0;
      for (const pid in playerBids[i]) {
        const bid    = playerBids[i][pid];
        const tricks = round[pid] || 0;
        const score  = this.calculateRoundScore(bid, tricks, cardsInRound, hishtMode, hishtPenalty);
        results[pid].roundScores.push(score);
        results[pid].total += score;
      }
    });

    const bonusModifiers = this.calculatePulkaBonus(results, playerBids, rounds, options);
    for (const pid in bonusModifiers) {
      results[pid].pulkaBonus = bonusModifiers[pid];
      results[pid].total += bonusModifiers[pid];
    }

    return results;
  }
}
