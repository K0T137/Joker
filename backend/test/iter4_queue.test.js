/**
 * Iteration 4: Matchmaking queue unit tests.
 *
 * Tests the queue data-structure logic that lives inside the join_queue /
 * leave_queue / disconnect handlers in server.js, without starting the full
 * server.  The helpers below mirror the server-side logic exactly.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ── Helpers that mirror server.js queue logic ─────────────────────────────────

function makeQueues() {
  return new Map(); // key: '{gameMode}:{isRanked}' -> [{ socketId, playerName, userId, joinedAt }]
}

function joinQueue(queues, socketId, playerName, gameMode = 'normal', isRanked = false) {
  const validatedMode = ['normal', 'only9', 'quick'].includes(gameMode) ? gameMode : 'normal';
  const key = `${validatedMode}:${!!isRanked}`;

  // Remove any existing entry for this socket (idempotent re-queue)
  for (const [k, q] of queues) {
    const idx = q.findIndex(e => e.socketId === socketId);
    if (idx !== -1) {
      q.splice(idx, 1);
      if (q.length === 0) queues.delete(k);
    }
  }

  const queue = queues.get(key) ?? [];
  queue.push({ socketId, playerName, userId: null, joinedAt: Date.now() });
  queues.set(key, queue);
  return { position: queue.length, total: queue.length };
}

function leaveQueue(queues, socketId) {
  for (const [k, q] of queues) {
    const idx = q.findIndex(e => e.socketId === socketId);
    if (idx !== -1) {
      q.splice(idx, 1);
      if (q.length === 0) queues.delete(k);
      return true; // queue_cancelled would be emitted
    }
  }
  return false;
}

function disconnectCleanup(queues, socketId) {
  for (const [k, q] of queues) {
    const idx = q.findIndex(e => e.socketId === socketId);
    if (idx !== -1) {
      q.splice(idx, 1);
      if (q.length === 0) queues.delete(k);
      break;
    }
  }
}

function tryMatch(queues, gameMode, isRanked) {
  const key = `${gameMode}:${!!isRanked}`;
  const queue = queues.get(key);
  if (!queue || queue.length < 4) return null;
  const group = queue.splice(0, 4);
  if (queue.length === 0) queues.delete(key);
  return group;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('matchmaking queue — data structure', () => {
  test('4 clients joining same queue get matched together', () => {
    const queues = makeQueues();
    for (let i = 1; i <= 4; i++) {
      joinQueue(queues, `s${i}`, `Player${i}`, 'normal', false);
    }
    const group = tryMatch(queues, 'normal', false);
    assert.ok(group !== null, 'Should match a group of 4');
    assert.equal(group.length, 4);
    assert.deepEqual(group.map(e => e.socketId), ['s1', 's2', 's3', 's4']);
    // Queue should be empty after match
    assert.equal(queues.has('normal:false'), false);
  });

  test('queues for different modes do not cross-match', () => {
    const queues = makeQueues();
    for (let i = 1; i <= 4; i++) {
      joinQueue(queues, `n${i}`, `NPlayer${i}`, 'normal', false);
    }
    for (let i = 1; i <= 4; i++) {
      joinQueue(queues, `q${i}`, `QPlayer${i}`, 'quick', false);
    }

    const normalGroup = tryMatch(queues, 'normal', false);
    const quickGroup  = tryMatch(queues, 'quick',  false);

    assert.ok(normalGroup !== null);
    assert.ok(quickGroup  !== null);
    assert.ok(normalGroup.every(e => e.socketId.startsWith('n')), 'Normal queue has only normal players');
    assert.ok(quickGroup.every(e => e.socketId.startsWith('q')),  'Quick queue has only quick players');
  });

  test('leave_queue emits queue_cancelled and removes entry', () => {
    const queues = makeQueues();
    joinQueue(queues, 's1', 'Player1', 'normal', false);
    const cancelled = leaveQueue(queues, 's1');
    assert.ok(cancelled, 'Should return true (queue_cancelled would be emitted)');
    assert.equal(queues.has('normal:false'), false, 'Queue should be empty after leave');
  });

  test('second client joining after leave sees position 1', () => {
    const queues = makeQueues();
    joinQueue(queues, 's1', 'Player1', 'normal', false);
    leaveQueue(queues, 's1');
    const pos = joinQueue(queues, 's2', 'Player2', 'normal', false);
    assert.equal(pos.total, 1);
    assert.equal(pos.position, 1);
  });

  test('disconnect removes player from queue silently', () => {
    const queues = makeQueues();
    joinQueue(queues, 's1', 'Player1', 'normal', false);
    disconnectCleanup(queues, 's1');
    assert.equal(queues.has('normal:false'), false);
  });

  test('idempotent re-queue: socket re-joining moves to back', () => {
    const queues = makeQueues();
    joinQueue(queues, 's1', 'Player1', 'normal', false);
    joinQueue(queues, 's2', 'Player2', 'normal', false);
    // s1 re-joins — should go to back
    joinQueue(queues, 's1', 'Player1', 'normal', false);
    const queue = queues.get('normal:false');
    assert.equal(queue.length, 2);
    assert.equal(queue[0].socketId, 's2', 's2 should now be first');
    assert.equal(queue[1].socketId, 's1', 's1 should be at back after re-queue');
  });

  test('ranked and unranked queues are separate', () => {
    const queues = makeQueues();
    joinQueue(queues, 'r1', 'Ranked1', 'normal', true);
    joinQueue(queues, 'u1', 'Unranked1', 'normal', false);
    assert.ok(queues.has('normal:true'));
    assert.ok(queues.has('normal:false'));
    assert.equal(queues.get('normal:true').length, 1);
    assert.equal(queues.get('normal:false').length, 1);
  });
});
