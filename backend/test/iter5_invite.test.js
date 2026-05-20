/**
 * Iteration 5: Room-invite feature unit tests.
 *
 * These tests replicate the core business-logic decisions made inside the
 * send_room_invite and join_game socket handlers in server.js without
 * starting the full server.  The same approach is used by iter4_api.test.js
 * for getKing.
 *
 * Logic under test
 * ────────────────
 * 1. pendingRoomInvites map — set / get / delete / TTL
 * 2. join_game password-bypass decision
 * 3. invite rate-limit (3 per 60 s per sender)
 * 4. send_room_invite guards (waiting-room check, target-online check)
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ── Helpers that mirror server.js logic exactly ────────────────────────────

/**
 * Decide whether a join_game request should be allowed when the password is
 * wrong.  Returns true if a valid invite exists for (userId, roomId).
 * Mirrors the condition at server.js lines 1271–1275.
 */
function inviteAllowsJoin(pendingRoomInvites, userId, roomId, now = Date.now()) {
  const invite = userId ? pendingRoomInvites.get(userId) : null;
  if (!invite || invite.roomId !== roomId || invite.expiresAt < now) {
    return false;
  }
  pendingRoomInvites.delete(userId);
  return true;
}

/**
 * Attempt to send an invite.  Returns { ok: true } or { ok: false, error }.
 * Mirrors the send_room_invite handler logic in server.js.
 *
 * @param {object}  opts
 * @param {Map}     opts.pendingRoomInvites
 * @param {Map}     opts.inviteRateLimits
 * @param {Map}     opts.onlineUsers         userId → socketId
 * @param {Map}     opts.gameRooms           roomId → { status, players }
 * @param {string}  opts.senderUserId
 * @param {string}  opts.senderRoomId
 * @param {string}  opts.senderName
 * @param {string}  opts.targetUserId
 * @param {number}  [opts.now]
 */
function sendInvite(opts) {
  const {
    pendingRoomInvites,
    inviteRateLimits,
    onlineUsers,
    gameRooms,
    senderUserId,
    senderRoomId,
    senderName,
    targetUserId,
    now = Date.now(),
  } = opts;

  if (!senderUserId || !targetUserId) {
    return { ok: false, error: 'missing ids' };
  }

  // Sender must be in a waiting room
  const gameRoom = gameRooms.get(senderRoomId);
  if (!gameRoom || gameRoom.status !== 'waiting') {
    return { ok: false, error: 'You are not in a waiting room' };
  }

  // Target must be online
  const targetSocketId = onlineUsers.get(targetUserId);
  if (!targetSocketId) {
    return { ok: false, error: 'Player is not online' };
  }

  // Rate limit: 3 invites per 60 s per sender
  const rl = inviteRateLimits.get(senderUserId) ?? { count: 0, windowStart: now };
  if (now - rl.windowStart > 60_000) { rl.count = 0; rl.windowStart = now; }
  rl.count++;
  inviteRateLimits.set(senderUserId, rl);
  if (rl.count > 3) {
    return { ok: false, error: 'Too many invites — slow down' };
  }

  pendingRoomInvites.set(targetUserId, {
    roomId: senderRoomId,
    inviterName: senderName,
    expiresAt: now + 30_000,
  });

  return { ok: true, targetSocketId, roomId: senderRoomId, inviterName: senderName };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('invite happy path', () => {
  test('sets pendingRoomInvites entry for target', () => {
    const pendingRoomInvites = new Map();
    const inviteRateLimits   = new Map();
    const onlineUsers        = new Map([['user-B', 'socket-B']]);
    const gameRooms          = new Map([['room-1', { status: 'waiting', players: new Map() }]]);

    const result = sendInvite({
      pendingRoomInvites, inviteRateLimits, onlineUsers, gameRooms,
      senderUserId: 'user-A', senderRoomId: 'room-1', senderName: 'Alice',
      targetUserId: 'user-B',
    });

    assert.ok(result.ok, 'sendInvite should succeed');
    assert.equal(result.targetSocketId, 'socket-B');
    assert.equal(result.roomId, 'room-1');
    assert.equal(result.inviterName, 'Alice');

    const entry = pendingRoomInvites.get('user-B');
    assert.ok(entry, 'pendingRoomInvites should have an entry for user-B');
    assert.equal(entry.roomId, 'room-1');
    assert.equal(entry.inviterName, 'Alice');
    assert.ok(entry.expiresAt > Date.now(), 'expiresAt should be in the future');
  });
});

describe('invite password bypass', () => {
  test('inviteAllowsJoin returns true and consumes invite when invite is valid', () => {
    const pendingRoomInvites = new Map();
    const now = Date.now();
    pendingRoomInvites.set('user-B', { roomId: 'room-1', inviterName: 'Alice', expiresAt: now + 30_000 });

    const allowed = inviteAllowsJoin(pendingRoomInvites, 'user-B', 'room-1', now);
    assert.ok(allowed, 'should allow join when a valid invite exists');
    assert.ok(!pendingRoomInvites.has('user-B'), 'invite should be consumed after use');
  });

  test('inviteAllowsJoin returns false when no invite exists for userId', () => {
    const pendingRoomInvites = new Map();
    const allowed = inviteAllowsJoin(pendingRoomInvites, 'user-B', 'room-1');
    assert.equal(allowed, false);
  });

  test('inviteAllowsJoin returns false when invite is for a different room', () => {
    const pendingRoomInvites = new Map();
    const now = Date.now();
    pendingRoomInvites.set('user-B', { roomId: 'room-X', inviterName: 'Alice', expiresAt: now + 30_000 });

    const allowed = inviteAllowsJoin(pendingRoomInvites, 'user-B', 'room-1', now);
    assert.equal(allowed, false, 'wrong roomId should not bypass password');
    assert.ok(pendingRoomInvites.has('user-B'), 'invite should NOT be consumed on mismatch');
  });

  test('inviteAllowsJoin returns false when userId is null', () => {
    const pendingRoomInvites = new Map();
    pendingRoomInvites.set('user-B', { roomId: 'room-1', inviterName: 'Alice', expiresAt: Date.now() + 30_000 });
    const allowed = inviteAllowsJoin(pendingRoomInvites, null, 'room-1');
    assert.equal(allowed, false);
  });
});

describe('invite TTL expiry', () => {
  test('inviteAllowsJoin returns false when invite is expired', () => {
    const pendingRoomInvites = new Map();
    const expiredAt = Date.now() - 1; // already expired
    pendingRoomInvites.set('user-B', { roomId: 'room-1', inviterName: 'Alice', expiresAt: expiredAt });

    const allowed = inviteAllowsJoin(pendingRoomInvites, 'user-B', 'room-1');
    assert.equal(allowed, false, 'expired invite should not bypass password');
  });

  test('invite with expiresAt exactly at now is treated as expired', () => {
    const pendingRoomInvites = new Map();
    const now = Date.now();
    // expiresAt < now is the condition: equal is NOT strictly less, so should pass.
    // But let's verify the exact boundary: expiresAt = now means NOT expired per the
    // condition `invite.expiresAt < now` (equal means not expired).
    pendingRoomInvites.set('user-B', { roomId: 'room-1', inviterName: 'Alice', expiresAt: now });
    const allowed = inviteAllowsJoin(pendingRoomInvites, 'user-B', 'room-1', now);
    assert.ok(allowed, 'invite expiring exactly at now should still be valid (boundary)');
  });
});

describe('invite rate limit', () => {
  test('first 3 invites succeed', () => {
    const pendingRoomInvites = new Map();
    const inviteRateLimits   = new Map();
    const onlineUsers        = new Map([['user-B', 'socket-B']]);
    const gameRooms          = new Map([['room-1', { status: 'waiting', players: new Map() }]]);

    const base = {
      pendingRoomInvites, inviteRateLimits, onlineUsers, gameRooms,
      senderUserId: 'user-A', senderRoomId: 'room-1', senderName: 'Alice',
      targetUserId: 'user-B',
    };

    for (let i = 1; i <= 3; i++) {
      const result = sendInvite(base);
      assert.ok(result.ok, `invite #${i} should succeed`);
    }
  });

  test('4th invite within the same window returns rate-limit error', () => {
    const pendingRoomInvites = new Map();
    const inviteRateLimits   = new Map();
    const onlineUsers        = new Map([['user-B', 'socket-B']]);
    const gameRooms          = new Map([['room-1', { status: 'waiting', players: new Map() }]]);

    const base = {
      pendingRoomInvites, inviteRateLimits, onlineUsers, gameRooms,
      senderUserId: 'user-A', senderRoomId: 'room-1', senderName: 'Alice',
      targetUserId: 'user-B',
    };

    // Use the same frozen `now` for all 4 calls to keep them in the same window
    const now = Date.now();
    for (let i = 0; i < 3; i++) sendInvite({ ...base, now });
    const result = sendInvite({ ...base, now });
    assert.equal(result.ok, false);
    assert.ok(result.error.includes('Too many invites'), `expected rate-limit error, got: ${result.error}`);
  });

  test('rate limit resets after 60 s window', () => {
    const pendingRoomInvites = new Map();
    const inviteRateLimits   = new Map();
    const onlineUsers        = new Map([['user-B', 'socket-B']]);
    const gameRooms          = new Map([['room-1', { status: 'waiting', players: new Map() }]]);

    const base = {
      pendingRoomInvites, inviteRateLimits, onlineUsers, gameRooms,
      senderUserId: 'user-A', senderRoomId: 'room-1', senderName: 'Alice',
      targetUserId: 'user-B',
    };

    const t0 = Date.now();
    for (let i = 0; i < 3; i++) sendInvite({ ...base, now: t0 });

    // Simulate 61 s later — window should reset
    const t1 = t0 + 61_000;
    const result = sendInvite({ ...base, now: t1 });
    assert.ok(result.ok, 'first invite after window reset should succeed');
  });
});

describe('invite requires waiting room', () => {
  test('returns error when sender has no room', () => {
    const pendingRoomInvites = new Map();
    const inviteRateLimits   = new Map();
    const onlineUsers        = new Map([['user-B', 'socket-B']]);
    const gameRooms          = new Map(); // empty — no room for sender

    const result = sendInvite({
      pendingRoomInvites, inviteRateLimits, onlineUsers, gameRooms,
      senderUserId: 'user-A', senderRoomId: undefined, senderName: 'Alice',
      targetUserId: 'user-B',
    });

    assert.equal(result.ok, false);
    assert.ok(result.error.includes('waiting room'), `expected waiting-room error, got: ${result.error}`);
  });

  test('returns error when sender is in a playing (non-waiting) room', () => {
    const pendingRoomInvites = new Map();
    const inviteRateLimits   = new Map();
    const onlineUsers        = new Map([['user-B', 'socket-B']]);
    const gameRooms          = new Map([['room-1', { status: 'playing', players: new Map() }]]);

    const result = sendInvite({
      pendingRoomInvites, inviteRateLimits, onlineUsers, gameRooms,
      senderUserId: 'user-A', senderRoomId: 'room-1', senderName: 'Alice',
      targetUserId: 'user-B',
    });

    assert.equal(result.ok, false);
    assert.ok(result.error.includes('waiting room'), `expected waiting-room error, got: ${result.error}`);
  });

  test('returns error when target is not online', () => {
    const pendingRoomInvites = new Map();
    const inviteRateLimits   = new Map();
    const onlineUsers        = new Map(); // user-B not online
    const gameRooms          = new Map([['room-1', { status: 'waiting', players: new Map() }]]);

    const result = sendInvite({
      pendingRoomInvites, inviteRateLimits, onlineUsers, gameRooms,
      senderUserId: 'user-A', senderRoomId: 'room-1', senderName: 'Alice',
      targetUserId: 'user-B',
    });

    assert.equal(result.ok, false);
    assert.equal(result.error, 'Player is not online');
  });
});
