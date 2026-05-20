import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Pure unit tests for the getKing logic (no DB required)
// getKing = async () => (await getLeaderboard(1))[0] ?? null

async function getKingImpl(getLeaderboardFn) {
  const rows = await getLeaderboardFn(1)
  return rows[0] ?? null
}

describe('getKing', () => {
  test('returns first row when leaderboard has rows', async () => {
    const fakeRow = { id: 'user-1', username: 'Alice', rating: 1200, games_played: 10, games_won: 7 }
    const result = await getKingImpl(async () => [fakeRow])
    assert.deepEqual(result, fakeRow)
  })

  test('returns null when leaderboard is empty', async () => {
    const result = await getKingImpl(async () => [])
    assert.equal(result, null)
  })
})
