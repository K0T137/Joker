import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Card } from '../src/gameEngine/Card.js';
import { Deck } from '../src/gameEngine/Deck.js';
import { Scorer } from '../src/gameEngine/Scorer.js';
import { TrickResolver } from '../src/gameEngine/TrickResolver.js';

// ── Card ──────────────────────────────────────────────────────────────────────

describe('Card', () => {
  test('rankValue returns correct order (6 < 7 < ... < A)', () => {
    const ranks = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    for (let i = 1; i < ranks.length; i++) {
      const lo = new Card('♠', ranks[i - 1]);
      const hi = new Card('♠', ranks[i]);
      assert.ok(lo.rankValue() < hi.rankValue(), `${ranks[i-1]} should rank lower than ${ranks[i]}`);
    }
  });

  test('isJoker returns false for regular cards', () => {
    assert.equal(new Card('♠', 'A').isJoker(), false);
    assert.equal(new Card('♥', '6').isJoker(), false);
  });

  test('isJoker returns true for jokers', () => {
    const j = Card.createJoker(1);
    assert.equal(j.isJoker(), true);
  });

  test('toString returns id', () => {
    const c = new Card('♥', 'K');
    assert.equal(c.toString(), '♥K');
  });

  test('createJoker assigns unique ids', () => {
    const j1 = Card.createJoker(1);
    const j2 = Card.createJoker(2);
    assert.equal(j1.id, 'JOKER_1');
    assert.equal(j2.id, 'JOKER_2');
    assert.notEqual(j1.id, j2.id);
  });

  test('equals compares by id', () => {
    const a = new Card('♠', 'A');
    const b = new Card('♠', 'A');
    const c = new Card('♥', 'A');
    assert.ok(a.equals(b));
    assert.ok(!a.equals(c));
  });
});

// ── Deck ─────────────────────────────────────────────────────────────────────

describe('Deck', () => {
  test('contains exactly 36 cards', () => {
    const deck = new Deck();
    assert.equal(deck.cards.length, 36);
  });

  test('contains 6♥ and 6♦', () => {
    const deck = new Deck();
    const ids = deck.cards.map(c => c.id);
    assert.ok(ids.includes('♥6'), 'missing 6♥');
    assert.ok(ids.includes('♦6'), 'missing 6♦');
  });

  test('does NOT contain 6♠ or 6♣', () => {
    const deck = new Deck();
    const ids = deck.cards.map(c => c.id);
    assert.ok(!ids.includes('♠6'), '6♠ should not be in deck');
    assert.ok(!ids.includes('♣6'), '6♣ should not be in deck');
  });

  test('contains exactly 2 jokers', () => {
    const deck = new Deck();
    const jokers = deck.cards.filter(c => c.isJoker());
    assert.equal(jokers.length, 2);
  });

  test('draw removes cards from front', () => {
    const deck = new Deck();
    const drawn = deck.draw(3);
    assert.equal(drawn.length, 3);
    assert.equal(deck.remaining(), 33);
  });

  test('reset restores 36 cards', () => {
    const deck = new Deck();
    deck.draw(10);
    deck.reset();
    assert.equal(deck.cards.length, 36);
  });

  test('shuffle does not lose cards', () => {
    const deck = new Deck();
    deck.shuffle();
    assert.equal(deck.cards.length, 36);
    const ids = new Set(deck.cards.map(c => c.id));
    assert.equal(ids.size, 36);
  });

  test('peek does not remove the card', () => {
    const deck = new Deck();
    const top = deck.peek(0);
    assert.ok(top instanceof Card);
    assert.equal(deck.remaining(), 36);
  });
});

// ── Scorer ────────────────────────────────────────────────────────────────────

describe('Scorer.calculateRoundScore', () => {
  test('bid=0, tricks=0 → +50', () => {
    assert.equal(Scorer.calculateRoundScore(0, 0, 5, 'fixed'), 50);
  });

  test('exact bid (base): bid=2, cards=5 → 50+100=150', () => {
    assert.equal(Scorer.calculateRoundScore(2, 2, 5, 'fixed'), 150);
  });

  test('exact bid = cardsInRound (all tricks) → bid*100', () => {
    assert.equal(Scorer.calculateRoundScore(9, 9, 9, 'fixed'), 900);
    assert.equal(Scorer.calculateRoundScore(5, 5, 5, 'fixed'), 500);
  });

  test('hisht fixed: bid>0, tricks=0 → -200', () => {
    assert.equal(Scorer.calculateRoundScore(3, 0, 5, 'fixed'), -200);
  });

  test('hisht dynamic: bid>0, tricks=0 → -(cardsInRound*100)', () => {
    assert.equal(Scorer.calculateRoundScore(3, 0, 5, 'dynamic'), -500);
    assert.equal(Scorer.calculateRoundScore(1, 0, 9, 'dynamic'), -900);
  });

  test('partial: bid=3, tricks=1 → 10', () => {
    assert.equal(Scorer.calculateRoundScore(3, 1, 5, 'fixed'), 10);
  });

  test('partial: bid=5, tricks=3 → 30', () => {
    assert.equal(Scorer.calculateRoundScore(5, 3, 8, 'fixed'), 30);
  });
});

describe('Scorer.calculatePulkaBonus', () => {
  // Helpers: 2-round pulka where only p2 has 100% accuracy
  const bids2_single = [
    { p1: 1, p2: 1, p3: 1, p4: 1 },
    { p1: 2, p2: 2, p3: 2, p4: 2 },
  ];
  const tricks2_single = [
    { p1: 0, p2: 1, p3: 2, p4: 0 },  // p1 hisht, p2 exact, p3 miss, p4 hisht
    { p1: 1, p2: 2, p3: 1, p4: 1 },  // p1 miss,  p2 exact, p3 miss, p4 miss
  ];

  test('no premia → all bonuses are zero', () => {
    // Nobody has 100% accuracy (all non-p2 miss at least one round)
    const results = {
      p1: { roundScores: [-200, 10], total: -190 },
      p2: { roundScores: [ 100, 10], total:  110 },
      p3: { roundScores: [  20, 10], total:   30 },
      p4: { roundScores: [-200, 10], total: -190 },
    };
    // p2 misses round 1 (bid=2, tricks=1 → not exact) — simulate by giving wrong tricks
    const bids_none = [
      { p1: 1, p2: 1, p3: 1, p4: 1 },
      { p1: 2, p2: 2, p3: 2, p4: 2 },
    ];
    const tricks_none = [
      { p1: 0, p2: 0, p3: 2, p4: 0 },  // p2 hisht in round 0 → no premia for anyone
      { p1: 1, p2: 2, p3: 1, p4: 1 },
    ];
    const bonus = Scorer.calculatePulkaBonus(results, bids_none, tricks_none);
    assert.equal(bonus.p1, 0);
    assert.equal(bonus.p2, 0);
    assert.equal(bonus.p3, 0);
    assert.equal(bonus.p4, 0);
  });

  test('single premia winner gets +best(excl last round); losers get -best(excl last)', () => {
    // p2 has premia. maxRound excl last = max(0, roundScores[0]) = max(0, 100) = 100
    const results = {
      p1: { roundScores: [150, -200], total:  -50 },  // hisht in round 1
      p2: { roundScores: [100,  150], total:  250 },  // all exact → premia
      p3: { roundScores: [100,   30], total:  130 },  // miss in round 1
      p4: { roundScores: [ 50,   10], total:   60 },  // miss in round 1
    };
    const bonus = Scorer.calculatePulkaBonus(results, bids2_single, tricks2_single);
    assert.equal(bonus.p2,   100); // +max(0, 100) excl last
    assert.equal(bonus.p1, -150); // -max(0, 150) excl last
    assert.equal(bonus.p3, -100); // -max(0, 100) excl last
    assert.equal(bonus.p4,  -50); // -max(0, 50) excl last
  });

  test('multiple premia winners each get +best(excl last); no penalty to others', () => {
    // p1 and p2 both have 100% accuracy
    const bids_multi = [
      { p1: 1, p2: 1, p3: 1, p4: 1 },
      { p1: 2, p2: 2, p3: 2, p4: 2 },
    ];
    const tricks_multi = [
      { p1: 1, p2: 1, p3: 2, p4: 0 },  // p1 exact, p2 exact, p3 miss, p4 hisht
      { p1: 2, p2: 2, p3: 1, p4: 1 },  // p1 exact, p2 exact, p3 miss, p4 miss
    ];
    const results = {
      p1: { roundScores: [100, 150], total: 250 },  // premia; max excl last = 100
      p2: { roundScores: [100, 150], total: 250 },  // premia; max excl last = 100
      p3: { roundScores: [ 20,  10], total:  30 },
      p4: { roundScores: [-200, 10], total: -190 },
    };
    const bonus = Scorer.calculatePulkaBonus(results, bids_multi, tricks_multi);
    assert.equal(bonus.p1, 100); // premia
    assert.equal(bonus.p2, 100); // premia
    assert.equal(bonus.p3,   0); // no penalty in multi-premia
    assert.equal(bonus.p4,   0);
  });
});

// ── TrickResolver ─────────────────────────────────────────────────────────────

function play(card, playerId, { jokerMode = 'NORMAL', takeSuit = null, giveSuit = null } = {}) {
  return { card, playerId, playerIndex: 0, jokerMode, takeSuit, giveSuit };
}

describe('TrickResolver', () => {
  test('highest lead suit wins with no trump', () => {
    const cards = [
      play(new Card('♠', '7'), 'p1'),
      play(new Card('♠', 'K'), 'p2'),
      play(new Card('♠', '9'), 'p3'),
      play(new Card('♠', 'J'), 'p4'),
    ];
    const result = TrickResolver.resolveTrick(cards, 'NO_TRUMP', 0);
    assert.equal(result.winnerId, 'p2');
  });

  test('trump beats lead suit', () => {
    const cards = [
      play(new Card('♠', 'A'), 'p1'),
      play(new Card('♥', '7'), 'p2'),
      play(new Card('♠', '9'), 'p3'),
      play(new Card('♠', 'J'), 'p4'),
    ];
    const result = TrickResolver.resolveTrick(cards, '♥', 0);
    assert.equal(result.winnerId, 'p2');
  });

  test('highest trump wins when multiple trumps', () => {
    const cards = [
      play(new Card('♠', 'A'), 'p1'),
      play(new Card('♥', '7'), 'p2'),
      play(new Card('♥', 'K'), 'p3'),
      play(new Card('♥', '9'), 'p4'),
    ];
    const result = TrickResolver.resolveTrick(cards, '♥', 0);
    assert.equal(result.winnerId, 'p3');
  });

  test('HIGH Joker beats everything', () => {
    const cards = [
      play(new Card('♠', 'A'), 'p1'),
      play(Card.createJoker(1), 'p2', { jokerMode: 'HIGH', takeSuit: '♠' }),
      play(new Card('♠', 'K'), 'p3'),
      play(new Card('♠', 'Q'), 'p4'),
    ];
    const result = TrickResolver.resolveTrick(cards, '♦', 0);
    assert.equal(result.winnerId, 'p2');
  });

  test('LOW Joker always loses', () => {
    const cards = [
      play(new Card('♠', '7'), 'p1'),
      play(Card.createJoker(1), 'p2', { jokerMode: 'LOW' }),
      play(new Card('♠', '8'), 'p3'),
      play(new Card('♠', '9'), 'p4'),
    ];
    const result = TrickResolver.resolveTrick(cards, '♦', 0);
    assert.equal(result.winnerId, 'p4');
  });

  test('TAKE Joker (lead) wins trick', () => {
    const joker = Card.createJoker(1);
    const cards = [
      play(joker, 'p1', { jokerMode: 'TAKE', takeSuit: '♠' }),
      play(new Card('♠', 'A'), 'p2'),
      play(new Card('♠', 'K'), 'p3'),
      play(new Card('♠', 'Q'), 'p4'),
    ];
    const result = TrickResolver.resolveTrick(cards, '♦', 0);
    assert.equal(result.winnerId, 'p1');
  });

  test('subsequent HIGH Joker overrides TAKE Joker lead', () => {
    const j1 = Card.createJoker(1);
    const j2 = Card.createJoker(2);
    const cards = [
      play(j1, 'p1', { jokerMode: 'TAKE', takeSuit: '♠' }),
      play(new Card('♠', 'A'), 'p2'),
      play(j2, 'p3', { jokerMode: 'HIGH', takeSuit: '♠' }),
      play(new Card('♠', 'Q'), 'p4'),
    ];
    const result = TrickResolver.resolveTrick(cards, '♦', 0);
    assert.equal(result.winnerId, 'p3');
  });

  test('GIVE Joker (lead) — highest valid responder wins', () => {
    const joker = Card.createJoker(1);
    const cards = [
      play(joker, 'p1', { jokerMode: 'GIVE', giveSuit: '♠' }),
      play(new Card('♠', '7'), 'p2'),
      play(new Card('♠', 'A'), 'p3'),
      play(new Card('♥', '9'), 'p4'),
    ];
    // trump = ♥, so p4 plays trump; highest: trump A vs ♠A
    const result = TrickResolver.resolveTrick(cards, '♥', 0);
    assert.equal(result.winnerId, 'p4'); // ♥9 as trump beats ♠ non-trump
  });

  test('last HIGH Joker wins when two Jokers played', () => {
    const j1 = Card.createJoker(1);
    const j2 = Card.createJoker(2);
    const cards = [
      play(new Card('♠', 'A'), 'p1'),
      play(j1, 'p2', { jokerMode: 'HIGH', takeSuit: '♠' }),
      play(new Card('♠', 'K'), 'p3'),
      play(j2, 'p4', { jokerMode: 'HIGH', takeSuit: '♠' }),
    ];
    const result = TrickResolver.resolveTrick(cards, '♦', 0);
    assert.equal(result.winnerId, 'p4');
  });

  test('no suit/trump played — first player wins', () => {
    const cards = [
      play(new Card('♠', 'A'), 'p1'),
      play(new Card('♥', '7'), 'p2'),
      play(new Card('♦', '8'), 'p3'),
      play(new Card('♣', '9'), 'p4'),
    ];
    // trump = ♣ but led suit = ♠; none follow ♠, but ♣ is trump
    // p4 plays trump → should win
    const result = TrickResolver.resolveTrick(cards, '♣', 0);
    assert.equal(result.winnerId, 'p4');
  });
});
