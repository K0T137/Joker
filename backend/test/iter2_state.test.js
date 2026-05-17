import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Card } from '../src/gameEngine/Card.js';
import { GameState } from '../src/gameEngine/GameState.js';
import { BotPlayer } from '../src/BotPlayer.js';
import { PHASES } from '../src/gameEngine/constants.js';

const PLAYERS = ['p1', 'p2', 'p3', 'p4'];

function freshState() {
  return new GameState([...PLAYERS]);
}

// ── GameState ─────────────────────────────────────────────────────────────────

describe('GameState constructor', () => {
  test('rejects fewer than 4 players', () => {
    assert.throws(() => new GameState(['a', 'b', 'c']), /4 players/);
  });

  test('initial phase is waiting', () => {
    const gs = freshState();
    assert.equal(gs.phase, 'waiting');
  });

  test('all scores start at 0', () => {
    const gs = freshState();
    for (const id of PLAYERS) {
      assert.equal(gs.gameScores[id], 0);
    }
  });
});

describe('GameState.getPulkaStructure', () => {
  test('pulka 1: 8 rounds ascending 1–8', () => {
    const gs = freshState();
    assert.deepEqual(gs.getPulkaStructure(1), [1, 2, 3, 4, 5, 6, 7, 8]);
  });

  test('pulka 2: 4 rounds all 9', () => {
    const gs = freshState();
    assert.deepEqual(gs.getPulkaStructure(2), [9, 9, 9, 9]);
  });

  test('pulka 3: 8 rounds descending 8–1', () => {
    const gs = freshState();
    assert.deepEqual(gs.getPulkaStructure(3), [8, 7, 6, 5, 4, 3, 2, 1]);
  });

  test('pulka 4: 4 rounds all 9', () => {
    const gs = freshState();
    assert.deepEqual(gs.getPulkaStructure(4), [9, 9, 9, 9]);
  });

  test('total rounds across all 4 pulkas is 24', () => {
    const gs = freshState();
    const total = [1, 2, 3, 4].reduce((s, p) => s + gs.getPulkaStructure(p).length, 0);
    assert.equal(total, 24);
  });
});

describe('GameState dealRound', () => {
  test('each player receives correct card count', () => {
    const gs = freshState();
    gs.dealRound(5);
    for (const id of PLAYERS) {
      assert.equal(gs.dealtCards[id].length, 5);
    }
  });

  test('phase becomes bidding after deal', () => {
    const gs = freshState();
    gs.dealRound(3);
    assert.equal(gs.phase, 'bidding');
  });

  test('trump is set after deal', () => {
    const gs = freshState();
    gs.dealRound(3);
    assert.ok(gs.trump !== null);
  });

  test('all cards across players are distinct', () => {
    const gs = freshState();
    gs.dealRound(7);
    const allIds = PLAYERS.flatMap(id => gs.dealtCards[id].map(c => c.id));
    const unique = new Set(allIds);
    assert.equal(unique.size, 28);
  });
});

describe('GameState 9-card phases', () => {
  test('phase 1 deals 3 cards each, phase is trump_selection', () => {
    const gs = freshState();
    gs.dealNineCardPhase1();
    for (const id of PLAYERS) assert.equal(gs.dealtCards[id].length, 3);
    assert.equal(gs.phase, 'trump_selection');
  });

  test('phase 2 tops up to 9 cards each, phase becomes bidding', () => {
    const gs = freshState();
    gs.dealNineCardPhase1();
    gs.setTrumpAndDealPhase2('♠');
    for (const id of PLAYERS) assert.equal(gs.dealtCards[id].length, 9);
    assert.equal(gs.phase, 'bidding');
    assert.equal(gs.trump, '♠');
  });

  test('NO_TRUMP is accepted in phase 2', () => {
    const gs = freshState();
    gs.dealNineCardPhase1();
    gs.setTrumpAndDealPhase2('NO_TRUMP');
    assert.equal(gs.trump, 'NO_TRUMP');
  });
});

describe('GameState bidding', () => {
  test('bids are recorded', () => {
    const gs = freshState();
    gs.dealRound(2);
    gs.currentLeaderIndex = 0;
    gs.recordBid('p1', 1);
    assert.equal(gs.bids['p1'], 1);
  });

  test('forbidden bid rule: dealer cannot make total = tricks available', () => {
    const gs = freshState();
    gs.dealRound(2);
    gs.currentLeaderIndex = 0;
    // p1,p2,p3 bid 0 each = total 0, tricks = 2; dealer (p4) cannot bid 2
    gs.recordBid('p1', 0);
    gs.recordBid('p2', 0);
    gs.recordBid('p3', 0);
    // dealer bids 2 → total would be 2 = cardsInRound (2) → forbidden
    const ok = gs.recordBid('p4', 2);
    // dealer bid should be cleared (returns false)
    assert.equal(ok, false);
    assert.equal(gs.bids['p4'], undefined);
  });

  test('valid bid round completes and sets phase to playing', () => {
    const gs = freshState();
    gs.dealRound(3);
    gs.currentLeaderIndex = 0;
    gs.recordBid('p1', 1);
    gs.recordBid('p2', 1);
    gs.recordBid('p3', 1);
    const done = gs.recordBid('p4', 0); // total=3 = tricks(3) → forbidden... use 1 instead
    // actually 1+1+1+0=3 = cardsInRound(3) → forbidden
    // try again after p4 bid is cleared
    gs.bids['p4'] = null; // reset
    const done2 = gs.recordBid('p4', 1); // total = 4 ≠ 3 → OK
    assert.equal(done2, true);
    assert.equal(gs.phase, 'playing');
  });
});

describe('GameState follow-suit enforcement', () => {
  test('throws when player does not follow suit', () => {
    const gs = freshState();
    gs.dealRound(3);
    // Manually set up hands to test follow-suit
    const spade7  = new Card('♠', '7');
    const spadeK  = new Card('♠', 'K');
    const heart9  = new Card('♥', '9');
    const heartA  = new Card('♥', 'A');
    const club8   = new Card('♣', '8');
    const clubQ   = new Card('♣', 'Q');
    const diamond9 = new Card('♦', '9');
    const diamondJ = new Card('♦', 'J');
    gs.dealtCards['p1'] = [spade7, heart9, club8];
    gs.dealtCards['p2'] = [spadeK, heartA, clubQ];
    gs.dealtCards['p3'] = [spadeK, heartA, clubQ].map(c => new Card(c.suit, c.rank)); // re-create
    gs.dealtCards['p4'] = [diamond9, diamondJ, new Card('♠', '8')];
    gs.trump = '♦';
    gs.bids = { p1: 1, p2: 1, p3: 1, p4: 0 };
    gs.phase = 'playing';
    gs.currentLeaderIndex = 0;

    // p1 leads ♠7
    gs.playCard('p1', spade7);
    // p2 has ♠K so must follow ♠ — trying to play ♣Q should throw
    assert.throws(() => gs.playCard('p2', new Card('♣', 'Q')), /follow suit/);
  });
});

describe('GameState TAKE Joker enforcement', () => {
  test('TAKE Joker lead forces highest card of declared suit', () => {
    const gs = freshState();
    gs.trump = '♦';
    gs.phase = 'playing';
    gs.currentLeaderIndex = 0;

    const joker  = Card.createJoker(1);
    const spadeK = new Card('♠', 'K');
    const spade9 = new Card('♠', '9');

    gs.dealtCards = {
      p1: [joker],
      p2: [new Card('♥', '8'), new Card('♥', '9')],
      p3: [spadeK, spade9],
      p4: [new Card('♦', '7')],
    };
    gs.bids = { p1: 1, p2: 0, p3: 1, p4: 0 };
    gs.tricksCounts = { p1: 0, p2: 0, p3: 0, p4: 0 };

    // p1 leads TAKE Joker declaring ♠
    gs.playCard('p1', joker, 'TAKE', '♠');
    // p2 has no ♠ — can play freely
    gs.playCard('p2', gs.dealtCards['p2'][0]);
    // p3 has ♠K and ♠9 — must play ♠K (highest ♠)
    assert.throws(() => gs.playCard('p3', spade9), /highest card/);
  });

  test('HIGH Joker (non-leading) does NOT force highest card on others', () => {
    const gs = freshState();
    gs.trump = '♦';
    gs.phase = 'playing';
    gs.currentLeaderIndex = 0;

    const spadeA = new Card('♠', 'A');
    const joker  = Card.createJoker(1);
    const spadeK = new Card('♠', 'K');
    const spade9 = new Card('♠', '9');

    gs.dealtCards = {
      p1: [spadeA],
      p2: [joker],
      p3: [spadeK, spade9],
      p4: [new Card('♦', '7')],
    };
    gs.bids = { p1: 1, p2: 1, p3: 1, p4: 0 };
    gs.tricksCounts = { p1: 0, p2: 0, p3: 0, p4: 0 };

    gs.playCard('p1', spadeA);
    // p2 plays HIGH Joker — no suit declaration, just wins the trick
    gs.playCard('p2', joker, 'HIGH');
    // p3 can play ♠9 without restriction (follow suit still applies, but no "highest" rule)
    assert.doesNotThrow(() => gs.playCard('p3', spade9));
  });
});

describe('GameState resolveTrick', () => {
  test('winner gains trick count', () => {
    const gs = freshState();
    gs.trump = '♦';
    gs.phase = 'playing';
    gs.currentLeaderIndex = 0;
    gs.dealtCards = {
      p1: [new Card('♠', '7')],
      p2: [new Card('♠', 'A')],
      p3: [new Card('♠', 'K')],
      p4: [new Card('♠', '9')],
    };
    gs.bids = { p1: 0, p2: 1, p3: 0, p4: 0 };
    gs.tricksCounts = { p1: 0, p2: 0, p3: 0, p4: 0 };

    gs.playCard('p1', gs.dealtCards['p1'][0]);
    gs.playCard('p2', gs.dealtCards['p2'][0]);
    gs.playCard('p3', gs.dealtCards['p3'][0]);
    gs.playCard('p4', gs.dealtCards['p4'][0]);

    const result = gs.resolveTrick();
    assert.equal(result.winnerId, 'p2');
    assert.equal(gs.tricksCounts['p2'], 1);
  });
});

// ── BotPlayer ─────────────────────────────────────────────────────────────────

describe('BotPlayer.pickTrump', () => {
  test('picks suit with most cards', () => {
    const hand = [
      new Card('♠', '7'), new Card('♠', '8'), new Card('♠', '9'),
      new Card('♥', 'A'),
    ];
    assert.equal(BotPlayer.pickTrump(hand), '♠');
  });

  test('returns NO_TRUMP if no suit has ≥2 cards', () => {
    const hand = [
      new Card('♠', '7'), new Card('♥', '8'), new Card('♦', '9'),
    ];
    assert.equal(BotPlayer.pickTrump(hand), 'NO_TRUMP');
  });
});

describe('BotPlayer.pickBid', () => {
  test('bids 0 for weak hand', () => {
    const hand = [new Card('♠', '7'), new Card('♥', '8')];
    assert.equal(BotPlayer.pickBid(hand, 'NO_TRUMP'), 0);
  });

  test('bids for Aces', () => {
    const hand = [new Card('♠', 'A'), new Card('♥', 'A'), new Card('♦', 'A')];
    const bid = BotPlayer.pickBid(hand, '♣');
    assert.ok(bid >= 2, `expected bid >= 2, got ${bid}`);
  });

  test('Joker counts as ~1 toward bid', () => {
    const hand = [Card.createJoker(1), new Card('♠', '7')];
    const bid = BotPlayer.pickBid(hand, 'NO_TRUMP');
    assert.ok(bid >= 1, 'Joker should push bid to 1');
  });

  test('avoids forbidden bid', () => {
    const hand = [new Card('♠', 'A'), new Card('♥', 'A')];
    const bid = BotPlayer.pickBid(hand, '♣', 2); // natural bid is 2, which is forbidden
    assert.notEqual(bid, 2);
  });
});

describe('BotPlayer.pickCard', () => {
  const ctx = {
    myId: 'p1',
    playerIds: PLAYERS,
    bids: { p1: 2, p2: 1, p3: 1, p4: 0 },
    tricksCounts: { p1: 0, p2: 0, p3: 0, p4: 0 },
    cardsInRound: 3,
    gameScores: { p1: 0, p2: 0, p3: 0, p4: 0 },
  };

  test('returns an object with card, jokerMode, takeSuit, giveSuit', () => {
    const hand = [new Card('♠', 'A'), new Card('♥', '7')];
    const result = BotPlayer.pickCard(hand, [], '♦', ctx);
    assert.ok(result.card instanceof Card);
    assert.ok(typeof result.jokerMode === 'string');
    assert.ok('takeSuit' in result);
    assert.ok('giveSuit' in result);
  });

  test('plays HIGH Joker to win when needed and cannot beat normally', () => {
    const joker = Card.createJoker(1);
    const hand = [joker, new Card('♠', '7')];
    const trick = [
      { card: new Card('♠', 'A'), playerId: 'p2', jokerMode: 'NORMAL', takeSuit: null },
      { card: new Card('♠', 'K'), playerId: 'p3', jokerMode: 'NORMAL', takeSuit: null },
    ];
    const result = BotPlayer.pickCard(hand, trick, '♦', { ...ctx, myId: 'p1' });
    // Bot needs tricks (bid 2, taken 0), has Joker, cannot beat with ♠7
    assert.equal(result.jokerMode, 'HIGH');
  });

  test('plays LOW Joker to lose when no tricks needed', () => {
    const joker = Card.createJoker(1);
    const hand = [joker, new Card('♠', 'A'), new Card('♠', 'K')];
    const ctxDone = {
      ...ctx,
      myId: 'p1',
      bids: { p1: 0, p2: 1, p3: 1, p4: 1 },
      tricksCounts: { p1: 0, p2: 0, p3: 0, p4: 0 },
    };
    const result = BotPlayer.pickCard(hand, [], '♦', ctxDone);
    // Bot bid 0 and doesn't want to win — lead lowest; all regulars are high so uses LOW Joker
    assert.equal(result.jokerMode, 'LOW');
  });

  test('follows TAKE Joker lead by playing highest of declared suit', () => {
    const spadeK = new Card('♠', 'K');
    const spade9 = new Card('♠', '9');
    const hand = [spadeK, spade9];
    const trick = [
      { card: Card.createJoker(1), playerId: 'p2', jokerMode: 'TAKE', takeSuit: '♠' },
    ];
    const result = BotPlayer.pickCard(hand, trick, '♦', { ...ctx, myId: 'p3' });
    assert.equal(result.card.id, spadeK.id);
  });

  test('uses TAKE Joker on lead when urgent', () => {
    const joker = Card.createJoker(1);
    const hand = [joker, new Card('♠', '8')]; // no strong lead
    const urgentCtx = {
      ...ctx,
      myId: 'p1',
      bids: { p1: 2, p2: 0, p3: 0, p4: 0 },
      tricksCounts: { p1: 0, p2: 0, p3: 0, p4: 0 },
      cardsInRound: 2, // tricksLeft ≤ myNeeded+1 → urgent
    };
    const result = BotPlayer.pickCard(hand, [], '♦', urgentCtx);
    assert.equal(result.jokerMode, 'TAKE');
  });
});

// ── PHASES constants ──────────────────────────────────────────────────────────

describe('PHASES constants', () => {
  test('all four phases are defined', () => {
    assert.equal(PHASES.WAITING,         'waiting');
    assert.equal(PHASES.TRUMP_SELECTION, 'trump_selection');
    assert.equal(PHASES.BIDDING,         'bidding');
    assert.equal(PHASES.PLAYING,         'playing');
  });

  test('initial GameState phase matches PHASES.WAITING', () => {
    const gs = new GameState([...PLAYERS]);
    assert.equal(gs.phase, PHASES.WAITING);
  });

  test('phase after dealRound matches PHASES.BIDDING', () => {
    const gs = new GameState([...PLAYERS]);
    gs.dealRound(3);
    assert.equal(gs.phase, PHASES.BIDDING);
  });

  test('phase after dealNineCardPhase1 matches PHASES.TRUMP_SELECTION', () => {
    const gs = new GameState([...PLAYERS]);
    gs.dealNineCardPhase1();
    assert.equal(gs.phase, PHASES.TRUMP_SELECTION);
  });
});

// ── Phase guards ──────────────────────────────────────────────────────────────

describe('GameState phase guards', () => {
  test('setTrumpAndDealPhase2 throws if not in trump_selection', () => {
    const gs = new GameState([...PLAYERS]);
    gs.dealRound(3); // phase → bidding
    assert.throws(() => gs.setTrumpAndDealPhase2('♠'), /wrong phase/);
  });

  test('recordBid throws if not in bidding', () => {
    const gs = new GameState([...PLAYERS]);
    // phase is waiting — never dealt
    assert.throws(() => gs.recordBid('p1', 1), /wrong phase/);
  });

  test('playCard throws if not in playing', () => {
    const gs = new GameState([...PLAYERS]);
    gs.dealRound(3);
    // phase is bidding — bids not placed yet
    assert.throws(
      () => gs.playCard('p1', gs.dealtCards['p1'][0]),
      /wrong phase/
    );
  });

  test('resolveTrick throws if not in playing', () => {
    const gs = new GameState([...PLAYERS]);
    gs.dealRound(3);
    assert.throws(() => gs.resolveTrick(), /wrong phase/);
  });
});

// ── Action log ────────────────────────────────────────────────────────────────

function playableState() {
  const gs = new GameState([...PLAYERS]);
  gs.trump = '♦';
  gs.phase = PHASES.PLAYING;
  gs.currentLeaderIndex = 0;
  gs.dealtCards = {
    p1: [new Card('♠', '7')],
    p2: [new Card('♠', 'A')],
    p3: [new Card('♠', 'K')],
    p4: [new Card('♠', '9')],
  };
  gs.bids         = { p1: 0, p2: 1, p3: 0, p4: 0 };
  gs.tricksCounts = { p1: 0, p2: 0, p3: 0, p4: 0 };
  gs.cardsInRound = 1;
  return gs;
}

describe('GameState action log', () => {
  test('starts empty', () => {
    const gs = new GameState([...PLAYERS]);
    assert.deepEqual(gs.getActionLog(), []);
  });

  test('records CARD_PLAYED entry after playCard', () => {
    const gs = playableState();
    const card = gs.dealtCards['p1'][0];
    gs.playCard('p1', card);
    const log = gs.getActionLog();
    assert.equal(log.length, 1);
    assert.equal(log[0].type,     'CARD_PLAYED');
    assert.equal(log[0].playerId, 'p1');
    assert.equal(log[0].card,     card.toString());
    assert.ok(typeof log[0].timestamp === 'number');
  });

  test('records TRICK_RESOLVED entry after resolveTrick', () => {
    const gs = playableState();
    gs.playCard('p1', gs.dealtCards['p1'][0]);
    gs.playCard('p2', gs.dealtCards['p2'][0]);
    gs.playCard('p3', gs.dealtCards['p3'][0]);
    gs.playCard('p4', gs.dealtCards['p4'][0]);
    gs.resolveTrick();
    const log = gs.getActionLog();
    const resolved = log.find(e => e.type === 'TRICK_RESOLVED');
    assert.ok(resolved, 'expected a TRICK_RESOLVED entry');
    assert.equal(resolved.winnerId, 'p2');
    assert.ok(typeof resolved.explanation === 'string');
  });

  test('getActionLog returns a copy, not the internal array', () => {
    const gs = playableState();
    const log = gs.getActionLog();
    log.push({ type: 'FAKE' });
    assert.equal(gs.getActionLog().length, 0);
  });

  test('log resets when a new round is dealt', () => {
    const gs = playableState();
    gs.playCard('p1', gs.dealtCards['p1'][0]);
    assert.equal(gs.getActionLog().length, 1);
    gs.dealRound(3);
    assert.equal(gs.getActionLog().length, 0);
  });
});
