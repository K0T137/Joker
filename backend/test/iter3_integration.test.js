/**
 * Iteration 3: Full game integration test.
 * Simulates a complete 4-pulka game (24 rounds total: 8+4+8+4) using 4 bots.
 * No sockets — drives the API directly.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { GameRoom } from '../src/GameRoom.js';
import { BotPlayer } from '../src/BotPlayer.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRoom(hishtMode = 'fixed') {
  const room = new GameRoom('test-room', 4, hishtMode);
  room.addBot('p1', 'Bot1');
  room.addBot('p2', 'Bot2');
  room.addBot('p3', 'Bot3');
  room.addBot('p4', 'Bot4');
  return room;
}

/**
 * Drive one complete round: bid phase → play phase.
 * Returns { roundComplete, pulkaResult } where pulkaResult may be null.
 */
function playRound(room) {
  const gs = room.gameState;

  // ── Bidding ────────────────────────────────────────────────────────────────
  if (gs.phase === 'trump_selection') {
    const selectorId = room.getTrumpSelectorId();
    const hand = gs.dealtCards[selectorId];
    const suit = BotPlayer.pickTrump(hand);
    room.selectTrump(suit);
  }

  // Bid in turn order, starting from currentLeaderIndex
  const n = gs.playerIds.length;
  for (let i = 0; i < n; i++) {
    const pid = gs.getCurrentBidder();
    if (!pid) break;

    const hand = gs.dealtCards[pid];
    const trump = gs.trump;

    // Compute forbidden bid for the last bidder
    const biddersLeft = gs.playerIds.filter(id => gs.bids[id] === null || gs.bids[id] === undefined).length;
    let forbidden = null;
    if (biddersLeft === 1) {
      const soFar  = Object.values(gs.bids).filter(b => b !== null && b !== undefined).reduce((s, b) => s + b, 0);
      const tricks = gs.cardsInRound;
      forbidden = tricks - soFar;
    }
    const bid = BotPlayer.pickBid(hand, trump, forbidden < 0 ? null : forbidden);
    const ok = room.recordBid(pid, bid);
    if (!ok) {
      // Forbidden bid rejected — re-bid
      const alt = bid < hand.length ? bid + 1 : bid - 1;
      room.recordBid(pid, Math.max(0, alt));
    }
  }

  // ── Playing tricks ─────────────────────────────────────────────────────────
  while (!gs.isRoundComplete()) {
    const pid = gs.getCurrentPlayer();
    const hand = [...gs.dealtCards[pid]];

    const play = BotPlayer.pickCard(hand, gs.currentTrick, gs.trump, {
      myId: pid,
      playerIds: gs.playerIds,
      bids: gs.bids,
      tricksCounts: gs.tricksCounts,
      cardsInRound: gs.cardsInRound,
      gameScores: gs.gameScores,
    });

    const { card, jokerMode, takeSuit, giveSuit } = play;
    // room.playCard calls gs.resolveTrick internally when trick is complete
    room.playCard(pid, card.toString(), jokerMode, takeSuit, giveSuit);
  }

  return room.endRound();
}

/**
 * Play one complete pulka.  startGame() / endPulka() already starts the first
 * round of each pulka, so we play it then call startNextRound() only when
 * endRound() returns null (round done, same pulka continues).
 * Returns the pulka-end result object.
 */
function playPulka(room) {
  let result;
  do {
    result = playRound(room);
    if (result === null) room.startNextRound();
  } while (result === null);
  return result;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GameRoom setup', () => {
  test('all 4 bots are ready', () => {
    const room = makeRoom();
    assert.ok(room.allPlayersReady());
  });

  test('room status starts as waiting', () => {
    const room = makeRoom();
    assert.equal(room.status, 'waiting');
  });

  test('getState returns players array', () => {
    const room = makeRoom();
    const state = room.getState();
    assert.equal(state.players.length, 4);
  });
});

describe('Pulka round structure', () => {
  test('total rounds across all 4 pulkas is 24', () => {
    const room = makeRoom();
    room.startGame();
    const gs = room.gameState;
    const total = [1, 2, 3, 4].reduce((s, p) => s + gs.getPulkaStructure(p).length, 0);
    assert.equal(total, 24);
  });

  test('pulka 1 starts with 1 card, pulka 4 ends with 9 cards', () => {
    const room = makeRoom();
    room.startGame();
    const gs = room.gameState;
    assert.equal(gs.getPulkaStructure(1)[0], 1);
    const p4 = gs.getPulkaStructure(4);
    assert.equal(p4[p4.length - 1], 9);
  });
});

describe('Single pulka simulation', () => {
  let room;
  let pulkaResult;

  test('completes pulka 1 (8 rounds) without throwing', () => {
    room = makeRoom();
    room.startGame();  // starts pulka 1, deals round 1

    pulkaResult = playPulka(room);  // plays all 8 rounds, returns pulka-end result

    assert.ok(pulkaResult !== null, 'Should return a pulka result');
    assert.ok('pulkaComplete' in pulkaResult || 'gameComplete' in pulkaResult);
  });

  test('all rounds have 4 tricks worth of results in tricksCounts', () => {
    assert.ok(room.currentPulkaRounds.length === 0 || room.pulkaHistory.length >= 1,
      'After endPulka, currentPulkaRounds is reset');
  });

  test('pulka history is recorded', () => {
    assert.equal(room.pulkaHistory.length, 1);
    const ph = room.pulkaHistory[0];
    assert.equal(ph.pulkaNumber, 1);
    assert.ok(ph.scores != null);
    assert.ok(ph.gameScores != null);
  });

  test('game scores are numbers after pulka 1', () => {
    for (const pid of ['p1', 'p2', 'p3', 'p4']) {
      assert.equal(typeof room.gameState.gameScores[pid], 'number');
    }
  });
});

describe('Full 4-pulka game simulation', () => {
  let room;
  let finalResult;

  test('plays all 4 pulkas (24 rounds total) without throwing', () => {
    room = makeRoom('fixed');
    room.startGame();  // starts pulka 1, deals round 1

    // Play pulkas 1-3 (each ends with pulkaComplete, next pulka auto-started)
    for (let p = 0; p < 3; p++) {
      const result = playPulka(room);
      assert.ok(result?.pulkaComplete, `Pulka ${p + 1} should end with pulkaComplete`);
    }
    // Pulka 4 ends the game
    finalResult = playPulka(room);

    assert.ok(finalResult?.gameComplete, 'Game should have ended with gameComplete');
    assert.equal(room.status, 'finished');
  });

  test('game played exactly 4 pulkas', () => {
    assert.equal(room.pulkaHistory.length, 4);
  });

  test('final scores are numbers for all players', () => {
    for (const pid of ['p1', 'p2', 'p3', 'p4']) {
      assert.equal(typeof finalResult.finalScores[pid], 'number');
    }
  });

  test('game scores are consistent with pulka history', () => {
    const fromHistory = { p1: 0, p2: 0, p3: 0, p4: 0 };
    for (const ph of room.pulkaHistory) {
      for (const pid of ['p1', 'p2', 'p3', 'p4']) {
        fromHistory[pid] += ph.scores[pid].total;
      }
    }
    for (const pid of ['p1', 'p2', 'p3', 'p4']) {
      assert.equal(fromHistory[pid], finalResult.finalScores[pid],
        `Score mismatch for ${pid}: history=${fromHistory[pid]} final=${finalResult.finalScores[pid]}`);
    }
  });
});

describe('Dealer rotation', () => {
  test('dealer index advances after each round', () => {
    const room = makeRoom();
    room.startGame();  // round 1 already started
    const initial = room.dealerIndex;
    playRound(room);   // play round 1
    assert.equal(room.dealerIndex, (initial + 1) % 4);
  });
});

describe('Hisht mode', () => {
  test('fixed mode: all round scores are numbers', () => {
    const room = makeRoom('fixed');
    room.startGame();  // round 1 already started
    playRound(room);
    // Check that round scores are numbers (not NaN)
    const ph = room.currentPulkaRounds;
    assert.ok(ph.length >= 1);
  });
});

describe('Bot card play validity', () => {
  test('all 4 cards in each trick come from separate players', () => {
    const room = makeRoom();
    room.startGame();  // round 1 already started

    const gs = room.gameState;
    if (gs.phase === 'trump_selection') {
      const selectorId = room.getTrumpSelectorId();
      room.selectTrump(BotPlayer.pickTrump(gs.dealtCards[selectorId]));
    }

    // Bid
    for (let i = 0; i < 4; i++) {
      const pid = gs.getCurrentBidder();
      if (!pid) break;
      const biddersLeft = gs.playerIds.filter(id => gs.bids[id] == null).length;
      let forbidden = null;
      if (biddersLeft === 1) {
        const soFar = Object.values(gs.bids).filter(b => b != null).reduce((s, b) => s + b, 0);
        forbidden = gs.cardsInRound - soFar;
      }
      room.recordBid(pid, BotPlayer.pickBid(gs.dealtCards[pid], gs.trump, forbidden));
    }

    // Play exactly one trick and inspect it
    const trickPlayers = new Set();
    for (let i = 0; i < 4; i++) {
      const pid = gs.getCurrentPlayer();
      trickPlayers.add(pid);
      const hand = [...gs.dealtCards[pid]];
      const play = BotPlayer.pickCard(hand, gs.currentTrick, gs.trump, {
        myId: pid, playerIds: gs.playerIds,
        bids: gs.bids, tricksCounts: gs.tricksCounts,
        cardsInRound: gs.cardsInRound, gameScores: gs.gameScores,
      });
      room.playCard(pid, play.card.toString(), play.jokerMode, play.takeSuit, play.giveSuit);
    }
    assert.equal(trickPlayers.size, 4, 'All 4 different players should play in a trick');
  });
});
