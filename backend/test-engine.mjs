import assert from 'node:assert/strict';
import { Card } from './src/gameEngine/Card.js';
import { Deck } from './src/gameEngine/Deck.js';
import { TrickResolver } from './src/gameEngine/TrickResolver.js';
import { Scorer } from './src/gameEngine/Scorer.js';
import { GameState } from './src/gameEngine/GameState.js';
import { GameRoom } from './src/GameRoom.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
    failed++;
  }
}

// ── DECK ──────────────────────────────────────────────────────────────────────
console.log('\nDeck');

test('has exactly 36 cards', () => {
  const deck = new Deck();
  assert.equal(deck.cards.length, 36);
});

test('contains 6♥ and 6♦ but not 6♠ or 6♣', () => {
  const deck = new Deck();
  const ids = deck.cards.map(c => c.id);
  assert.ok(ids.includes('♥6'), 'missing 6♥');
  assert.ok(ids.includes('♦6'), 'missing 6♦');
  assert.ok(!ids.includes('♠6'), 'unexpected 6♠');
  assert.ok(!ids.includes('♣6'), 'unexpected 6♣');
});

test('contains exactly 2 Jokers', () => {
  const deck = new Deck();
  const jokers = deck.cards.filter(c => c.isJoker());
  assert.equal(jokers.length, 2);
});

test('all card IDs are unique', () => {
  const deck = new Deck();
  const ids = deck.cards.map(c => c.id);
  const unique = new Set(ids);
  assert.equal(unique.size, 36);
});

test('reset restores 36 cards', () => {
  const deck = new Deck();
  deck.draw(10);
  deck.reset();
  assert.equal(deck.cards.length, 36);
});

// ── CARD RANK VALUES ─────────────────────────────────────────────────────────
console.log('\nCard rankValue');

test('6 < 7 < ... < A', () => {
  const ranks = ['6','7','8','9','10','J','Q','K','A'];
  for (let i = 1; i < ranks.length; i++) {
    const lo = new Card('♠', ranks[i-1]);
    const hi = new Card('♠', ranks[i]);
    assert.ok(lo.rankValue() < hi.rankValue(), `${ranks[i-1]} should be < ${ranks[i]}`);
  }
});

// ── TRICK RESOLVER ───────────────────────────────────────────────────────────
console.log('\nTrickResolver');

function makePlays(cards) {
  return cards.map((c, i) => ({
    card: c,
    playerId: `p${i}`,
    playerIndex: i,
    jokerMode: 'NORMAL',
    takeSuit: null,
    giveSuit: null,
  }));
}

test('highest lead suit wins when no trump played', () => {
  const plays = makePlays([
    new Card('♠','7'), new Card('♠','K'), new Card('♠','9'), new Card('♥','A')
  ]);
  // trump='♦', nobody plays a diamond — p1 K♠ should win
  const result = TrickResolver.resolveTrick(plays, '♦', 0);
  assert.equal(result.winnerId, 'p1', 'K♠ should beat 7♠, 9♠, and A♥ with no trump played');
});

test('trump beats lead suit', () => {
  const plays = makePlays([
    new Card('♠','A'), new Card('♥','7'), new Card('♠','K'), new Card('♠','Q')
  ]);
  const result = TrickResolver.resolveTrick(plays, '♥', 0);
  assert.equal(result.winnerId, 'p1', '7♥ (trump) should beat A♠');
});

test('HIGH Joker beats everything', () => {
  const joker = Card.createJoker(1);
  const plays = makePlays([new Card('♠','A'), new Card('♥','A'), new Card('♦','A'), joker]);
  plays[3].jokerMode = 'HIGH';
  const result = TrickResolver.resolveTrick(plays, '♠', 0);
  assert.equal(result.winnerId, 'p3', 'HIGH Joker should win');
});

test('LOW Joker loses to all normal cards', () => {
  const joker = Card.createJoker(1);
  const plays = makePlays([new Card('♠','7'), joker, new Card('♠','K'), new Card('♠','Q')]);
  plays[1].jokerMode = 'LOW';
  const result = TrickResolver.resolveTrick(plays, '♦', 0);
  assert.equal(result.winnerId, 'p2', 'K♠ should win; LOW Joker must lose');
});

test('LOW Joker loses to HIGH Joker', () => {
  const joker1 = Card.createJoker(1);
  const joker2 = Card.createJoker(2);
  const plays = makePlays([new Card('♠','A'), joker1, joker2, new Card('♠','K')]);
  plays[1].jokerMode = 'LOW';
  plays[2].jokerMode = 'HIGH';
  const result = TrickResolver.resolveTrick(plays, '♦', 0);
  assert.equal(result.winnerId, 'p2', 'HIGH Joker beats LOW Joker');
});

test('winnerIndex matches the winning card position', () => {
  const plays = makePlays([
    new Card('♠','7'), new Card('♠','A'), new Card('♠','K'), new Card('♦','5')
  ]);
  const result = TrickResolver.resolveTrick(plays, '♥', 0);
  assert.equal(result.winnerIndex, 1, 'A♠ is at index 1');
  assert.equal(result.winnerId, 'p1');
});

// ── SCORER ───────────────────────────────────────────────────────────────────
console.log('\nScorer');

test('exact bid=0 tricks=0 scores 50 (always)', () => {
  assert.equal(Scorer.calculateRoundScore(0, 0, 5), 50);
});

test('exact bid=1 base score is 100', () => {
  assert.equal(Scorer.calculateRoundScore(1, 1, 9), 100); // 1 bid in 9-card round → base
});

test('exact bid=2 base score is 150', () => {
  assert.equal(Scorer.calculateRoundScore(2, 2, 9), 150);
});

test('exact bid=5 base score is 300', () => {
  assert.equal(Scorer.calculateRoundScore(5, 5, 9), 300);
});

test('exact bid=8 base score is 450', () => {
  assert.equal(Scorer.calculateRoundScore(8, 8, 9), 450);
});

test('exact bid=9 in 9-card round scores 900 (enhanced)', () => {
  assert.equal(Scorer.calculateRoundScore(9, 9, 9), 900);
});

test('enhanced: bid=5 in 5-card round scores 500', () => {
  assert.equal(Scorer.calculateRoundScore(5, 5, 5), 500);
});

test('enhanced: bid=3 in 3-card round scores 300', () => {
  assert.equal(Scorer.calculateRoundScore(3, 3, 3), 300);
});

test('miss with tricks > 0 scores tricks*10', () => {
  assert.equal(Scorer.calculateRoundScore(3, 5, 9), 50);
  assert.equal(Scorer.calculateRoundScore(5, 2, 9), 20);
  assert.equal(Scorer.calculateRoundScore(0, 3, 9), 30); // 0 bid, took 3
});

test('hisht dynamic: 3-card round → -300', () => {
  assert.equal(Scorer.calculateRoundScore(2, 0, 3, 'dynamic'), -300);
});

test('hisht dynamic: 1-card round → -100', () => {
  assert.equal(Scorer.calculateRoundScore(1, 0, 1, 'dynamic'), -100);
});

test('hisht fixed: 1-card round → -200 (always)', () => {
  assert.equal(Scorer.calculateRoundScore(1, 0, 1, 'fixed'), -200);
});

test('hisht dynamic: 9-card round → -900', () => {
  assert.equal(Scorer.calculateRoundScore(5, 0, 9, 'dynamic'), -900);
});

test('pulka bonus: single winner gets own max round, losers lose own max round', () => {
  const results = {
    p0: { roundScores: [200, 100], total: 300 },
    p1: { roundScores: [150, 50],  total: 200 },
    p2: { roundScores: [100, 80],  total: 180 },
    p3: { roundScores: [50, 30],   total: 80  },
  };
  const bonus = Scorer.calculatePulkaBonus(results);
  assert.equal(bonus.p0,  200);  // winner: +own max
  assert.equal(bonus.p1, -150);  // loser:  -own max
  assert.equal(bonus.p2, -100);  // loser:  -own max
  assert.equal(bonus.p3,  -50);  // loser:  -own max
});

test('pulka bonus: tied winners each get own max, no penalty to others', () => {
  const results = {
    p0: { roundScores: [200, 100], total: 300 },
    p1: { roundScores: [150, 150], total: 300 },
    p2: { roundScores: [100, 80],  total: 180 },
    p3: { roundScores: [50, 30],   total: 80  },
  };
  const bonus = Scorer.calculatePulkaBonus(results);
  assert.equal(bonus.p0, 200);       // winner: +own max
  assert.equal(bonus.p1, 150);       // winner: +own max
  assert.equal(bonus.p2, undefined); // no penalty
  assert.equal(bonus.p3, undefined); // no penalty
});

test('calculatePulkaScores iterates player IDs correctly', () => {
  const rounds = [
    { p0: 1, p1: 2, p2: 0, p3: 3 },
    { p0: 2, p1: 1, p2: 3, p3: 0 },
  ];
  const playerBids = [
    { p0: 1, p1: 2, p2: 0, p3: 3 },
    { p0: 2, p1: 1, p2: 3, p3: 0 },
  ];
  const result = Scorer.calculatePulkaScores(rounds, playerBids, [9, 9]);
  assert.ok('p0' in result, 'result should have player IDs not numeric indices');
  assert.ok(!('0' in result), 'result should not have numeric index "0"');
  assert.ok('roundScores' in result.p0);
  assert.equal(result.p0.roundScores.length, 2);
});

// ── GAME STATE ───────────────────────────────────────────────────────────────
console.log('\nGameState');

const playerIds = ['p0','p1','p2','p3'];

test('deals correct number of cards per player', () => {
  const gs = new GameState(playerIds);
  gs.dealRound(3);
  for (const pid of playerIds) {
    assert.equal(gs.dealtCards[pid].length, 3);
  }
});

test('dealRound resets currentLeaderIndex to 0', () => {
  const gs = new GameState(playerIds);
  gs.currentLeaderIndex = 2;
  gs.dealRound(3);
  assert.equal(gs.currentLeaderIndex, 0);
});

test('dealRound sets phase to bidding', () => {
  const gs = new GameState(playerIds);
  gs.dealRound(3);
  assert.equal(gs.phase, 'bidding');
});

test('recordBid records bids in order', () => {
  const gs = new GameState(playerIds);
  gs.dealRound(5);
  gs.recordBid('p0', 1);
  gs.recordBid('p1', 2);
  assert.equal(gs.bids.p0, 1);
  assert.equal(gs.bids.p1, 2);
});

test('allPlayersBid returns true only when all 4 have bid', () => {
  const gs = new GameState(playerIds);
  gs.dealRound(5);
  gs.recordBid('p0', 1);
  assert.equal(gs.allPlayersBid(), false);
  gs.recordBid('p1', 1);
  gs.recordBid('p2', 1);
  gs.recordBid('p3', 1);
  assert.equal(gs.allPlayersBid(), true);
});

test('last bidder blocked from making total = tricks available', () => {
  const gs = new GameState(playerIds);
  gs.dealRound(5); // 5 tricks available
  gs.recordBid('p0', 1);
  gs.recordBid('p1', 2);
  gs.recordBid('p2', 1);
  // p3 bidding 1 would make total = 5 = tricks available — should be rejected
  const result = gs.recordBid('p3', 1);
  assert.equal(result, false, 'bid should be rejected');
  assert.equal(gs.bids.p3, undefined, 'bid should be deleted');
});

test('last bidder can bid if total would not equal tricks', () => {
  const gs = new GameState(playerIds);
  gs.dealRound(5);
  gs.recordBid('p0', 1);
  gs.recordBid('p1', 2);
  gs.recordBid('p2', 1);
  const result = gs.recordBid('p3', 2); // total = 6, not 5
  assert.notEqual(result, false);
  assert.equal(gs.bids.p3, 2);
});

test('getCurrentBidder returns first player with null bid', () => {
  const gs = new GameState(playerIds);
  gs.dealRound(3);
  assert.equal(gs.getCurrentBidder(), 'p0');
  gs.recordBid('p0', 1);
  assert.equal(gs.getCurrentBidder(), 'p1');
});

test('getCurrentPlayer tracks trick leader correctly', () => {
  const gs = new GameState(playerIds);
  gs.dealRound(3);
  gs.currentLeaderIndex = 0;
  assert.equal(gs.getCurrentPlayer(), 'p0');
  // After first card played, currentTrick.length = 1
  gs.currentTrick.push({ card: {}, playerId: 'p0', playerIndex: 0, jokerMode: 'NORMAL' });
  assert.equal(gs.getCurrentPlayer(), 'p1');
});

test('validateLegalPlay enforces follow-suit', () => {
  const gs = new GameState(playerIds);
  gs.dealRound(5);
  // Manually set up: p0 has spades, trick led with spade
  gs.dealtCards.p0 = [new Card('♠','7'), new Card('♠','A'), new Card('♥','K')];
  gs.currentTrick = [{
    card: new Card('♠','K'), playerId: 'p1', playerIndex: 1, jokerMode: 'NORMAL'
  }];
  // Playing ♥K when holding ♠ cards should fail
  assert.throws(() => gs.validateLegalPlay('p0', new Card('♥','K')), /follow suit/);
  // Playing ♠7 should succeed
  assert.doesNotThrow(() => gs.validateLegalPlay('p0', new Card('♠','7')));
});

// ── PULKA STRUCTURE ──────────────────────────────────────────────────────────
console.log('\nPulka structure');

test('getPulkaRoundStructure has exactly 24 rounds', () => {
  const gs = new GameState(playerIds);
  const structure = gs.getPulkaRoundStructure();
  assert.equal(structure.length, 24);
});

test('structure starts at 1 card and peaks at 9', () => {
  const gs = new GameState(playerIds);
  const structure = gs.getPulkaRoundStructure();
  assert.equal(structure[0], 1);
  assert.equal(Math.max(...structure), 9);
});

test('endRound triggers pulka end at 24 rounds', () => {
  const room = new GameRoom('TEST', 4);
  ['p0','p1','p2','p3'].forEach(id => room.addPlayer(id, `sock_${id}`, `Player ${id}`));
  room.startGame();

  const pids = room.gameState.playerIds;
  const fakeBids   = Object.fromEntries(pids.map(id => [id, 1]));
  const fakeTricks = Object.fromEntries(pids.map(id => [id, 1]));

  // Push 23 rounds with real player data (endRound will push the 24th)
  for (let i = 0; i < 23; i++) {
    room.currentPulkaRounds.push({ tricks: { ...fakeTricks }, bids: { ...fakeBids } });
  }

  const result = room.endRound(); // pushes 24th, length becomes 24 → triggers endPulka
  assert.ok(result !== null, 'pulka should have ended after 24 rounds');
});

// ── FULL TRICK FLOW ──────────────────────────────────────────────────────────
console.log('\nFull trick flow');

test('playing 4 cards resolves trick and updates tricksCounts', () => {
  const gs = new GameState(playerIds);
  gs.dealRound(3);
  gs.recordBid('p0', 1);
  gs.recordBid('p1', 1);
  gs.recordBid('p2', 1);
  // p3 bid must not make total = 3
  gs.recordBid('p3', 0); // total = 3 = tricks, so this would be blocked — use a different value
  // Actually with 3 tricks: p0=1,p1=1,p2=1 → sum=3. p3 bidding 0 → total=3 = tricks → blocked.
  // Let's use a different spread: p0=0,p1=1,p2=0,p3=?
  const gs2 = new GameState(playerIds);
  gs2.dealRound(3);
  gs2.recordBid('p0', 0);
  gs2.recordBid('p1', 1);
  gs2.recordBid('p2', 0);
  gs2.recordBid('p3', 0); // total=1, not 3 → ok

  // Manually give each player a specific card
  gs2.dealtCards.p0 = [new Card('♠','A'), new Card('♠','K'), new Card('♠','Q')];
  gs2.dealtCards.p1 = [new Card('♠','7'), new Card('♥','K'), new Card('♦','K')];
  gs2.dealtCards.p2 = [new Card('♠','8'), new Card('♥','Q'), new Card('♦','Q')];
  gs2.dealtCards.p3 = [new Card('♠','9'), new Card('♥','J'), new Card('♦','J')];
  gs2.phase = 'playing';
  gs2.trump = '♥';

  // Play trick: all spades, A♠ should win
  const t1 = gs2.playCard('p0', gs2.dealtCards.p0[0]);
  const t2 = gs2.playCard('p1', gs2.dealtCards.p1[0]);
  const t3 = gs2.playCard('p2', gs2.dealtCards.p2[0]);
  const t4 = gs2.playCard('p3', gs2.dealtCards.p3[0]);

  assert.equal(t4, true, 'trick should be complete after 4th card');

  const result = gs2.resolveTrick();
  assert.equal(result.winnerId, 'p0', 'A♠ should win against 7♠, 8♠, 9♠');
  assert.equal(gs2.tricksCounts.p0, 1);
  assert.equal(gs2.currentLeaderIndex, 0, 'winner (p0=index 0) leads next trick');
});

// ── SUMMARY ──────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
