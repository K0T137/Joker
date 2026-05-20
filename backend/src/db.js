import pg from 'pg'

const { Pool } = pg

const dbUrl = process.env.DATABASE_URL ?? ''
const pool = new Pool({
  connectionString: dbUrl || undefined,
  // Enable SSL for remote hosts (Railway, Supabase, etc.) but not for localhost
  ssl: dbUrl && !dbUrl.includes('localhost') && !dbUrl.includes('sslmode=disable')
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

export async function runMigrations() {
  // ── Core user / auth tables ───────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      email         VARCHAR(255) UNIQUE,
      username      VARCHAR(50)  NOT NULL,
      password_hash VARCHAR(255),
      google_id     VARCHAR(255) UNIQUE,
      avatar_id     INTEGER      NOT NULL DEFAULT 1,
      created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS player_stats (
      user_id      UUID    PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      games_played INTEGER NOT NULL DEFAULT 0,
      games_won    INTEGER NOT NULL DEFAULT 0,
      total_score  BIGINT  NOT NULL DEFAULT 0,
      exact_bids   INTEGER NOT NULL DEFAULT 0,
      total_bids   INTEGER NOT NULL DEFAULT 0,
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token      VARCHAR(64) NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used       BOOLEAN     NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;
  `)

  // ── Persistent rooms (Phase 2 — survives server restarts) ────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rooms (
      id                   VARCHAR(20)  PRIMARY KEY,
      status               VARCHAR(20)  NOT NULL DEFAULT 'waiting',
      settings             JSONB        NOT NULL DEFAULT '{}',
      players              JSONB        NOT NULL DEFAULT '[]',
      dealer_index         INTEGER      NOT NULL DEFAULT 0,
      game_state           JSONB,
      pulka_history        JSONB        NOT NULL DEFAULT '[]',
      round_history        JSONB        NOT NULL DEFAULT '[]',
      current_pulka_rounds JSONB        NOT NULL DEFAULT '[]',
      current_game_id      UUID,
      created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    );
  `)

  // ── Game-level tables ─────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS games (
      id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      room_id              VARCHAR(20) NOT NULL,
      status               VARCHAR(20) NOT NULL DEFAULT 'in_progress',
      game_mode            VARCHAR(20) NOT NULL DEFAULT 'normal',
      hisht_penalty        VARCHAR(10) NOT NULL DEFAULT '200',
      play_in_pairs        BOOLEAN     NOT NULL DEFAULT false,
      deductions           BOOLEAN     NOT NULL DEFAULT true,
      multi_premia_deduct  BOOLEAN     NOT NULL DEFAULT false,
      last_bid_untouchable BOOLEAN     NOT NULL DEFAULT true,
      started_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ended_at             TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS game_results (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      game_id     UUID        NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      user_id     UUID        REFERENCES users(id),
      player_name VARCHAR(50) NOT NULL,
      final_score INTEGER     NOT NULL,
      is_winner   BOOLEAN     NOT NULL DEFAULT false,
      is_bot      BOOLEAN     NOT NULL DEFAULT false,
      exact_bids  INTEGER     NOT NULL DEFAULT 0,
      total_bids  INTEGER     NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS pulka_scores (
      id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      game_id      UUID        NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      pulka_number INTEGER     NOT NULL,
      player_id    VARCHAR(50) NOT NULL,
      player_name  VARCHAR(50),
      user_id      UUID        REFERENCES users(id),
      score        INTEGER     NOT NULL,
      hisht_penalty INTEGER    NOT NULL DEFAULT 0
    );
  `)

  // ── Round / trick detail tables ───────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rounds (
      id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      game_id          UUID        NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      round_number     INTEGER     NOT NULL,
      pulka_number     INTEGER     NOT NULL,
      cards_per_player INTEGER     NOT NULL,
      trump_suit       VARCHAR(10),
      trump_card       VARCHAR(10),
      dealer_id        VARCHAR(50),
      started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ended_at         TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS round_deals (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      round_id    UUID        NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
      player_id   VARCHAR(50) NOT NULL,
      player_name VARCHAR(50),
      user_id     UUID        REFERENCES users(id),
      cards       JSONB       NOT NULL
    );

    CREATE TABLE IF NOT EXISTS round_bids (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      round_id    UUID        NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
      player_id   VARCHAR(50) NOT NULL,
      player_name VARCHAR(50),
      user_id     UUID        REFERENCES users(id),
      bid_order   INTEGER     NOT NULL DEFAULT 0,
      bid         INTEGER     NOT NULL,
      tricks_won  INTEGER
    );

    CREATE TABLE IF NOT EXISTS tricks_log (
      id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      round_id     UUID        NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
      trick_number INTEGER     NOT NULL,
      winner_id    VARCHAR(50),
      winner_name  VARCHAR(50),
      lead_suit    VARCHAR(10)
    );

    CREATE TABLE IF NOT EXISTS trick_plays (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      trick_id    UUID        NOT NULL REFERENCES tricks_log(id) ON DELETE CASCADE,
      player_id   VARCHAR(50) NOT NULL,
      player_name VARCHAR(50),
      user_id     UUID        REFERENCES users(id),
      play_order  INTEGER     NOT NULL,
      card        VARCHAR(10) NOT NULL,
      joker_mode  VARCHAR(10),
      take_suit   VARCHAR(10),
      give_suit   VARCHAR(10)
    );
  `)

  // ── Player game history ───────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS player_game_log (
      id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      game_id          UUID        NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      room_id          VARCHAR(20),
      score            INTEGER     NOT NULL,
      placement        INTEGER     NOT NULL,
      game_mode        VARCHAR(20) NOT NULL DEFAULT 'normal',
      is_ranked        BOOLEAN     NOT NULL DEFAULT false,
      duration_minutes INTEGER,
      rating_change    INTEGER,
      new_rating       INTEGER,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)

  // ── Non-destructive additions for existing deployments ────────────────────
  await pool.query(`
    ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS exact_bids          INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS total_bids          INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS rating              INTEGER NOT NULL DEFAULT 1000;
    ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS place1_count        INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS place2_count        INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS place3_count        INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS place4_count        INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS time_played_minutes INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS highest_score       INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS afk_count              INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS full_take_count        INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS zero_bid_success_count INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS honor_rate             INTEGER NOT NULL DEFAULT 100;
    ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS last_login_date        DATE;
    ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS login_streak           INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS streak_restore_value   INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE games        ADD COLUMN IF NOT EXISTS is_ranked              BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE player_game_log ADD COLUMN IF NOT EXISTS rating_change INTEGER;
    ALTER TABLE player_game_log ADD COLUMN IF NOT EXISTS new_rating    INTEGER;
    ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS hisht_count           INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS max_exact_bid_streak  INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS achievements          INTEGER NOT NULL DEFAULT 0;
  `).catch(() => {})
  // tokens default 0 (was 1000 when this was ELO — safe to re-run)
  await pool.query(`ALTER TABLE player_stats ALTER COLUMN rating SET DEFAULT 0`).catch(() => {})
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_data TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS has_password BOOLEAN GENERATED ALWAYS AS (password_hash IS NOT NULL) STORED;
  `).catch(() => {})
  // Migrate old games table (added settings columns)
  for (const stmt of [
    `ALTER TABLE games ADD COLUMN IF NOT EXISTS status               VARCHAR(20) NOT NULL DEFAULT 'completed'`,
    `ALTER TABLE games ADD COLUMN IF NOT EXISTS game_mode            VARCHAR(20) NOT NULL DEFAULT 'normal'`,
    `ALTER TABLE games ADD COLUMN IF NOT EXISTS hisht_penalty        VARCHAR(10) NOT NULL DEFAULT '200'`,
    `ALTER TABLE games ADD COLUMN IF NOT EXISTS play_in_pairs        BOOLEAN     NOT NULL DEFAULT false`,
    `ALTER TABLE games ADD COLUMN IF NOT EXISTS deductions           BOOLEAN     NOT NULL DEFAULT true`,
    `ALTER TABLE games ADD COLUMN IF NOT EXISTS multi_premia_deduct  BOOLEAN     NOT NULL DEFAULT false`,
    `ALTER TABLE games ADD COLUMN IF NOT EXISTS last_bid_untouchable BOOLEAN     NOT NULL DEFAULT true`,
    `ALTER TABLE games ALTER COLUMN ended_at DROP NOT NULL`,
  ]) { await pool.query(stmt).catch(() => {}) }

  // ── Social tables (friends + blocking) ───────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS friendships (
      id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      requester_id UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      addressee_id UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status       VARCHAR(10) NOT NULL DEFAULT 'pending',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(requester_id, addressee_id),
      CHECK(requester_id <> addressee_id)
    );

    CREATE TABLE IF NOT EXISTS blocked_users (
      blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY(blocker_id, blocked_id),
      CHECK(blocker_id <> blocked_id)
    );
  `).catch(() => {})

  // ── Performance indexes (idempotent) ─────────────────────────────────────
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_rooms_status          ON rooms(status);
    CREATE INDEX IF NOT EXISTS idx_rounds_game_id        ON rounds(game_id);
    CREATE INDEX IF NOT EXISTS idx_round_deals_round_id  ON round_deals(round_id);
    CREATE INDEX IF NOT EXISTS idx_round_bids_round_id   ON round_bids(round_id);
    CREATE INDEX IF NOT EXISTS idx_tricks_log_round_id   ON tricks_log(round_id);
    CREATE INDEX IF NOT EXISTS idx_trick_plays_trick_id  ON trick_plays(trick_id);
    CREATE INDEX IF NOT EXISTS idx_pulka_scores_game_id  ON pulka_scores(game_id);
    CREATE INDEX IF NOT EXISTS idx_game_results_game_id  ON game_results(game_id);
    CREATE INDEX IF NOT EXISTS idx_game_results_is_bot        ON game_results(is_bot);
    CREATE INDEX IF NOT EXISTS idx_player_game_log_user_id    ON player_game_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_player_game_log_game_id    ON player_game_log(game_id);
    CREATE INDEX IF NOT EXISTS idx_player_game_log_created_at ON player_game_log(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships(requester_id);
    CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships(addressee_id);
    CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker  ON blocked_users(blocker_id);
  `).catch(() => {})

  console.log('DB migrations complete')
}

// ── Room persistence ──────────────────────────────────────────────────────────

export async function createRoomRecord(roomId, settings, players) {
  await pool.query(
    `INSERT INTO rooms (id, status, settings, players) VALUES ($1, 'waiting', $2, $3)
     ON CONFLICT (id) DO NOTHING`,
    [roomId, JSON.stringify(settings), JSON.stringify(players)]
  )
}

export async function saveRoomState(roomId, row) {
  await pool.query(
    `UPDATE rooms SET
       status               = $2,
       settings             = $3,
       players              = $4,
       dealer_index         = $5,
       game_state           = $6,
       pulka_history        = $7,
       round_history        = $8,
       current_pulka_rounds = $9,
       current_game_id      = $10,
       updated_at           = NOW()
     WHERE id = $1`,
    [
      roomId,
      row.status,
      JSON.stringify(row.settings),
      JSON.stringify(row.players),
      row.dealer_index,
      row.game_state ? JSON.stringify(row.game_state) : null,
      JSON.stringify(row.pulka_history),
      JSON.stringify(row.round_history),
      JSON.stringify(row.current_pulka_rounds),
      row.current_game_id ?? null,
    ]
  )
}

export async function loadActiveRooms() {
  const { rows } = await pool.query(
    `SELECT id, status, settings, players, dealer_index, game_state,
            pulka_history, round_history, current_pulka_rounds, current_game_id
     FROM rooms WHERE status IN ('waiting','playing')`
  )
  return rows
}

export async function markRoomAbandoned(roomId) {
  await pool.query(`UPDATE rooms SET status = 'abandoned', updated_at = NOW() WHERE id = $1`, [roomId])
}

// ── Game-level logging ────────────────────────────────────────────────────────

export async function createGameRecord(roomId, settings) {
  const { rows: [game] } = await pool.query(
    `INSERT INTO games (room_id, status, game_mode, hisht_penalty, play_in_pairs,
                        deductions, multi_premia_deduct, last_bid_untouchable, is_ranked)
     VALUES ($1, 'in_progress', $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [
      roomId,
      settings.gameMode             ?? 'normal',
      settings.hishtPenalty         ?? '200',
      settings.playInPairs          ?? false,
      settings.deductions           ?? true,
      settings.multiPremiaDeduction ?? false,
      settings.lastBidUntouchable   ?? true,
      settings.isRanked             ?? false,
    ]
  )
  return game.id
}

export async function completeGameRecord(gameId) {
  await pool.query(
    `UPDATE games SET status = 'completed', ended_at = NOW() WHERE id = $1`,
    [gameId]
  )
}

// ── Round logging ─────────────────────────────────────────────────────────────

export async function insertRound(gameId, { roundNumber, pulkaNumber, cardsPerPlayer, trump, trumpCard, dealerId }) {
  const { rows: [row] } = await pool.query(
    `INSERT INTO rounds (game_id, round_number, pulka_number, cards_per_player, trump_suit, trump_card, dealer_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [gameId, roundNumber, pulkaNumber, cardsPerPlayer, trump ?? null, trumpCard ?? null, dealerId ?? null]
  )
  return row.id
}

export async function completeRound(roundId, trump) {
  await pool.query(
    `UPDATE rounds SET ended_at = NOW(), trump_suit = COALESCE(trump_suit, $2) WHERE id = $1`,
    [roundId, trump ?? null]
  )
}

export async function insertRoundDeals(roundId, deals) {
  // deals: Array<{ playerId, playerName, userId, cards: string[] }>
  if (!deals.length) return
  const values = deals.map((d, i) => `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`).join(', ')
  const params = deals.flatMap(d => [roundId, d.playerId, d.playerName ?? null, d.userId ?? null, JSON.stringify(d.cards)])
  await pool.query(
    `INSERT INTO round_deals (round_id, player_id, player_name, user_id, cards) VALUES ${values}`,
    params
  )
}

export async function insertBid(roundId, { playerId, playerName, userId, bid, bidOrder }) {
  await pool.query(
    `INSERT INTO round_bids (round_id, player_id, player_name, user_id, bid, bid_order)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [roundId, playerId, playerName ?? null, userId ?? null, bid, bidOrder ?? 0]
  )
}

export async function updateBidTricksWon(roundId, tricksPerPlayer) {
  const entries = Object.entries(tricksPerPlayer)
  if (!entries.length) return
  await pool.query(
    `UPDATE round_bids AS rb
     SET tricks_won = v.tricks
     FROM unnest($1::text[], $2::int[]) AS v(player_id, tricks)
     WHERE rb.round_id = $3 AND rb.player_id = v.player_id`,
    [entries.map(([pid]) => pid), entries.map(([, t]) => t), roundId]
  )
}

// ── Trick logging ─────────────────────────────────────────────────────────────

export async function insertTrick(roundId, { trickNumber, winnerId, winnerName, leadSuit }) {
  const { rows: [row] } = await pool.query(
    `INSERT INTO tricks_log (round_id, trick_number, winner_id, winner_name, lead_suit)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [roundId, trickNumber, winnerId ?? null, winnerName ?? null, leadSuit ?? null]
  )
  return row.id
}

export async function insertTrickPlays(trickId, plays) {
  // plays: Array<{ playerId, playerName, userId, playOrder, card, jokerMode, takeSuit, giveSuit }>
  if (!plays.length) return
  const cols = 9
  const values = plays.map((_, i) =>
    `(${Array.from({ length: cols }, (_, j) => `$${i * cols + j + 1}`).join(', ')})`
  ).join(', ')
  const params = plays.flatMap(p => [
    trickId, p.playerId, p.playerName ?? null, p.userId ?? null,
    p.playOrder, p.card, p.jokerMode ?? null, p.takeSuit ?? null, p.giveSuit ?? null,
  ])
  await pool.query(
    `INSERT INTO trick_plays (trick_id, player_id, player_name, user_id, play_order, card, joker_mode, take_suit, give_suit)
     VALUES ${values}`,
    params
  )
}

// ── Pulka scoring ─────────────────────────────────────────────────────────────

export async function insertPulkaScores(gameId, pulkaNumber, scores, players, hishtPenalty = 0) {
  // scores: { playerId: { total } }; players: Map<id, { name, userId }>
  const entries = Object.entries(scores)
  if (!entries.length) return
  const values = entries.map((_, i) => `($${i * 7 + 1}, $${i * 7 + 2}, $${i * 7 + 3}, $${i * 7 + 4}, $${i * 7 + 5}, $${i * 7 + 6}, $${i * 7 + 7})`).join(', ')
  await pool.query(
    `INSERT INTO pulka_scores (game_id, pulka_number, player_id, player_name, user_id, score, hisht_penalty)
     VALUES ${values}`,
    entries.flatMap(([pid, s]) => {
      const p = players.get(pid)
      return [gameId, pulkaNumber, pid, p?.name ?? null, p?.userId ?? null, s.total ?? 0, hishtPenalty]
    })
  )
}

// Token delta per game:
//   +10 participation
//   +2/+1/-1/-2 placement bonus
//   ±spread÷100 (1st/4th pair ×2, 2nd/3rd pair ×1)
//   +round(accuracy × 10) bid accuracy bonus
function computeTokenDelta(placement, spread14, spread23, exactBids, totalBids) {
  const PLACEMENT_BONUS = [2, 1, -1, -2]
  const placementBonus  = PLACEMENT_BONUS[placement - 1] ?? 0

  let spreadBonus = 0
  if      (placement === 1) spreadBonus =  Math.round(spread14 * 2 / 100)
  else if (placement === 2) spreadBonus =  Math.round(spread23     / 100)
  else if (placement === 3) spreadBonus = -Math.round(spread23     / 100)
  else                      spreadBonus = -Math.round(spread14 * 2 / 100)

  const accuracy      = totalBids > 0 ? exactBids / totalBids : 0
  const accuracyBonus = Math.round(accuracy * 10)

  return 10 + placementBonus + spreadBonus + accuracyBonus
}

// Pure helper — no DB calls. Used by saveGameResult AND the game_ended emit.
// players: Array<{ id, isBot }>   finalScores: { id: score }
// roundHistory: Array<{ bids: {id: bid}, tricks: {id: tricks} }>
// Returns { playerId: tokenDelta } for every non-bot player.
export function computeGameTokenDeltas(players, finalScores, roundHistory) {
  const sorted = [...players].sort((a, b) => (finalScores[b.id] ?? 0) - (finalScores[a.id] ?? 0))
  const spread14 = Math.max(0, (finalScores[sorted[0]?.id] ?? 0) - (finalScores[sorted[3]?.id] ?? 0))
  const spread23 = Math.max(0, (finalScores[sorted[1]?.id] ?? 0) - (finalScores[sorted[2]?.id] ?? 0))
  const placementMap = Object.fromEntries(sorted.map((p, i) => [p.id, i + 1]))

  const deltas = {}
  for (const player of players) {
    if (player.isBot) continue
    const placement = placementMap[player.id] ?? 4
    let exactBids = 0, totalBids = 0
    for (const r of roundHistory) {
      const pBid = r.bids?.[player.id]
      if (pBid != null) {
        totalBids++
        if (pBid === (r.tricks?.[player.id] ?? 0)) exactBids++
      }
    }
    deltas[player.id] = computeTokenDelta(placement, spread14, spread23, exactBids, totalBids)
  }
  return deltas
}

/**
 * Persist a completed game and update stats for any registered players.
 * players: Array<{ id, name, isBot, userId? }>
 * finalScores: { playerId: rawScore }
 * roundHistory: Array<{ bids, tricks }> — for bid accuracy
 */
export async function saveGameResult({ gameId, roomId, players, finalScores, roundHistory = [], startedAt, gameMode = 'normal', isRanked = false }) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    let resolvedGameId = gameId
    if (!resolvedGameId) {
      // Legacy path: no pre-created game record — create one now
      const { rows: [game] } = await client.query(
        `INSERT INTO games (room_id, started_at, ended_at, status, is_ranked) VALUES ($1, $2, NOW(), 'completed', $3) RETURNING id`,
        [roomId, startedAt ?? new Date(), isRanked]
      )
      resolvedGameId = game.id
    } else {
      await client.query(
        `UPDATE games SET status = 'completed', ended_at = NOW(), is_ranked = $2 WHERE id = $1`,
        [resolvedGameId, isRanked]
      )
    }
    const gameId_ = resolvedGameId

    const scores   = players.map(p => finalScores[p.id] ?? 0)
    const maxScore = Math.max(...scores.filter((_, i) => !players[i].isBot))
    const hasHuman = players.some(p => !p.isBot)

    // 1–4 placement ranked by final score descending
    const placementMap = Object.fromEntries(
      [...players]
        .map(p => ({ id: p.id, score: finalScores[p.id] ?? 0 }))
        .sort((a, b) => b.score - a.score)
        .map((p, i) => [p.id, i + 1])
    )

    const durationMinutes = startedAt
      ? Math.max(1, Math.round((Date.now() - new Date(startedAt).getTime()) / 60_000))
      : null

    // Token deltas — pure computation, no DB needed
    const tokenDeltas = computeGameTokenDeltas(players, finalScores, roundHistory)

    // Fetch current token balances for registered humans
    const humans = players.filter(p => p.userId && !p.isBot)
    const tokenByPlayerId = {}
    if (humans.length > 0) {
      const { rows: tokenRows } = await client.query(
        `SELECT user_id, COALESCE(rating, 0) AS tokens FROM player_stats WHERE user_id = ANY($1)`,
        [humans.map(p => p.userId)]
      )
      const tokenByUserId = Object.fromEntries(tokenRows.map(r => [r.user_id, r.tokens]))
      for (const p of humans) tokenByPlayerId[p.id] = tokenByUserId[p.userId] ?? 0
    }

    for (const player of players) {
      const score     = finalScores[player.id] ?? 0
      const isWinner  = !player.isBot && hasHuman && score === maxScore
      const placement = placementMap[player.id] ?? 4

      // Count bid accuracy and joker-style stats from round history
      let exactBids = 0, totalBids = 0, fullTakes = 0, zeroBidSuccesses = 0, hishts = 0
      let curStreak = 0, maxStreak = 0
      for (const r of roundHistory) {
        const pBid    = r.bids?.[player.id]
        const pTricks = r.tricks?.[player.id] ?? 0
        if (pBid != null) {
          totalBids++
          if (pBid === pTricks) { exactBids++; curStreak++; maxStreak = Math.max(maxStreak, curStreak) }
          else curStreak = 0
          if (pBid === 0 && pTricks === 0) zeroBidSuccesses++
          if (pBid > 0 && pTricks === 0)   hishts++
        }
        if (r.cardsInRound > 0 && pTricks === r.cardsInRound) fullTakes++
      }

      await client.query(
        `INSERT INTO game_results (game_id, user_id, player_name, final_score, is_winner, is_bot, exact_bids, total_bids)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [gameId_, player.userId ?? null, player.name, score, isWinner, player.isBot ?? false, exactBids, totalBids]
      )

      if (player.userId && !player.isBot) {
        const tokenDelta   = tokenDeltas[player.id] ?? 0
        const currentTokens = tokenByPlayerId[player.id] ?? 0
        const newTokens    = currentTokens + tokenDelta

        // Compute achievement bitmask after updating stats (use incremented values)
        // Fetch current stats first to know updated totals
        const { rows: [cur] } = await client.query(
          `SELECT games_won, hisht_count, max_exact_bid_streak, full_take_count, achievements
           FROM player_stats WHERE user_id = $1`,
          [player.userId]
        )
        const newGamesWon     = (cur?.games_won          ?? 0) + (isWinner ? 1 : 0)
        const newHishtCount   = (cur?.hisht_count        ?? 0) + hishts
        const newMaxStreak    = Math.max(cur?.max_exact_bid_streak ?? 0, maxStreak)
        const newFullTakes    = (cur?.full_take_count    ?? 0) + fullTakes
        let   newAchievements =  cur?.achievements       ?? 0
        if (newGamesWon   >= 1)  newAchievements |= 1   // First Win
        if (newHishtCount >= 1)  newAchievements |= 2   // First Hisht
        if (newMaxStreak  >= 10) newAchievements |= 4   // Bid Master
        if (newFullTakes  >= 5)  newAchievements |= 8   // Joker Master

        await client.query(
          `INSERT INTO player_stats (
             user_id, games_played, games_won, total_score, exact_bids, total_bids,
             place1_count, place2_count, place3_count, place4_count,
             time_played_minutes, highest_score, rating,
             full_take_count, zero_bid_success_count, hisht_count, max_exact_bid_streak,
             achievements, honor_rate, updated_at
           ) VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 100, NOW())
           ON CONFLICT (user_id) DO UPDATE SET
             games_played           = player_stats.games_played + 1,
             games_won              = player_stats.games_won    + $2,
             total_score            = player_stats.total_score  + $3,
             exact_bids             = player_stats.exact_bids   + $4,
             total_bids             = player_stats.total_bids   + $5,
             place1_count           = player_stats.place1_count + $6,
             place2_count           = player_stats.place2_count + $7,
             place3_count           = player_stats.place3_count + $8,
             place4_count           = player_stats.place4_count + $9,
             time_played_minutes    = player_stats.time_played_minutes + $10,
             highest_score          = GREATEST(player_stats.highest_score, $11),
             rating                 = COALESCE(player_stats.rating, 0) + $12,
             full_take_count        = player_stats.full_take_count + $13,
             zero_bid_success_count = player_stats.zero_bid_success_count + $14,
             hisht_count            = player_stats.hisht_count + $15,
             max_exact_bid_streak   = GREATEST(player_stats.max_exact_bid_streak, $16),
             achievements           = $17,
             honor_rate             = LEAST(100, COALESCE(player_stats.honor_rate, 100) + 1),
             updated_at             = NOW()`,
          [
            player.userId,
            isWinner ? 1 : 0,
            score,
            exactBids,
            totalBids,
            placement === 1 ? 1 : 0,
            placement === 2 ? 1 : 0,
            placement === 3 ? 1 : 0,
            placement === 4 ? 1 : 0,
            durationMinutes ?? 0,
            score,
            tokenDelta,
            fullTakes,
            zeroBidSuccesses,
            hishts,
            maxStreak,
            newAchievements,
          ]
        )

        await client.query(
          `INSERT INTO player_game_log
             (user_id, game_id, room_id, score, placement, game_mode, is_ranked, duration_minutes, rating_change, new_rating)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [player.userId, gameId_, roomId ?? null, score, placement, gameMode, isRanked, durationMinutes, tokenDelta, newTokens]
        )
      }
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('saveGameResult failed:', err.message)
  } finally {
    client.release()
  }
}

export async function getLeaderboard(limit = 20) {
  const { rows } = await pool.query(`
    SELECT u.id::text AS id,
           u.username,
           ps.games_played,
           ps.games_won,
           ps.total_score,
           ps.exact_bids,
           ps.total_bids,
           COALESCE(ps.rating, 0) AS rating,
           CASE WHEN ps.games_played > 0
                THEN ROUND(ps.games_won::numeric / ps.games_played * 100)
                ELSE 0 END AS win_rate,
           CASE WHEN ps.total_bids > 0
                THEN ROUND(ps.exact_bids::numeric / ps.total_bids * 100)
                ELSE 0 END AS bid_accuracy
    FROM player_stats ps
    JOIN users u ON u.id = ps.user_id
    WHERE ps.games_played > 0
    ORDER BY COALESCE(ps.rating, 0) DESC
    LIMIT $1
  `, [limit])
  return rows
}

export async function getKing() {
  const rows = await getLeaderboard(1)
  return rows[0] ?? null
}

export async function getUserAvatarId(userId) {
  const { rows } = await pool.query(
    'SELECT avatar_id FROM users WHERE id = $1',
    [userId]
  )
  return rows[0]?.avatar_id ?? 1
}

export async function getPlayerStats(userId) {
  await pool.query(
    `INSERT INTO player_stats (user_id) VALUES ($1) ON CONFLICT DO NOTHING`,
    [userId]
  )
  const { rows } = await pool.query(`
    SELECT u.id, u.username, u.created_at,
           ps.games_played, ps.games_won, ps.total_score,
           ps.exact_bids, ps.total_bids,
           ps.rating, ps.afk_count, ps.honor_rate,
           ps.place1_count, ps.place2_count, ps.place3_count, ps.place4_count,
           ps.time_played_minutes, ps.highest_score,
           ps.full_take_count, ps.zero_bid_success_count,
           ps.hisht_count, ps.max_exact_bid_streak, ps.achievements,
           CASE WHEN ps.games_played > 0
                THEN ROUND(ps.games_won::numeric / ps.games_played * 100)
                ELSE 0 END AS win_rate,
           CASE WHEN ps.total_bids > 0
                THEN ROUND(ps.exact_bids::numeric / ps.total_bids * 100)
                ELSE 0 END AS bid_accuracy
    FROM player_stats ps
    JOIN users u ON u.id = ps.user_id
    WHERE u.id = $1
  `, [userId])
  return rows[0] ?? null
}

export async function getPlayerMeta(userId) {
  if (!userId) return null
  const { rows } = await pool.query(
    `SELECT u.avatar_id, COALESCE(ps.honor_rate, 100) AS honor_rate, COALESCE(ps.achievements, 0) AS achievements
     FROM users u LEFT JOIN player_stats ps ON ps.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  )
  return rows[0] ?? null
}

export async function incrementAfkCount(userId) {
  if (!userId) return
  await pool.query(
    `INSERT INTO player_stats (user_id, afk_count, honor_rate, updated_at) VALUES ($1, 1, 95, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       afk_count  = player_stats.afk_count + 1,
       honor_rate = GREATEST(0, COALESCE(player_stats.honor_rate, 100) - 5),
       updated_at = NOW()`,
    [userId]
  )
}

export async function decrementHonorRate(userId, amount = 10) {
  if (!userId) return
  await pool.query(
    `INSERT INTO player_stats (user_id, honor_rate, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       honor_rate = GREATEST(0, COALESCE(player_stats.honor_rate, 100) - $2),
       updated_at = NOW()`,
    [userId, amount]
  )
}

export async function getPlayerGameLog(userId, limit = 20) {
  const { rows } = await pool.query(`
    SELECT id, game_id, room_id, score, placement, game_mode, is_ranked,
           duration_minutes, rating_change, new_rating, created_at
    FROM player_game_log
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  `, [userId, limit])
  return rows
}

// Grant +100 tokens once per calendar day, track login streak.
// Returns { claimed, daily, streak, weeklyBonus, restoreEligible, restoreStreakValue }
export async function claimDailyBonus(userId) {
  if (!userId) return { claimed: false }
  const today = new Date().toISOString().slice(0, 10)

  await pool.query(`INSERT INTO player_stats (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [userId])

  const { rows } = await pool.query(
    `SELECT login_streak, streak_restore_value, last_login_date FROM player_stats WHERE user_id = $1`,
    [userId]
  )
  const { login_streak = 0, streak_restore_value = 0, last_login_date } = rows[0] ?? {}

  if (last_login_date) {
    const gap = Math.round((new Date(today) - new Date(last_login_date)) / 86400000)
    if (gap === 0) return { claimed: false }

    let newStreak       = 1
    let newRestoreValue = 0
    let restoreEligible = false

    if (gap === 1) {
      newStreak = login_streak + 1
    } else if (gap === 2) {
      newRestoreValue = login_streak
      restoreEligible = login_streak > 1
    }

    const weeklyBonus  = newStreak === 7 ? 1000 : 0
    const bonusTokens  = 100 + weeklyBonus
    const storedStreak = newStreak === 7 ? 0 : newStreak

    await pool.query(
      `UPDATE player_stats
       SET rating               = COALESCE(rating, 0) + $2,
           login_streak         = $3,
           streak_restore_value = $4,
           last_login_date      = $5::date,
           updated_at           = NOW()
       WHERE user_id = $1`,
      [userId, bonusTokens, storedStreak, newRestoreValue, today]
    )
    return { claimed: true, daily: 100, streak: newStreak, weeklyBonus, restoreEligible, restoreStreakValue: newRestoreValue }
  }

  // First login or no date on record
  await pool.query(
    `UPDATE player_stats
     SET rating               = COALESCE(rating, 0) + 100,
         login_streak         = 1,
         streak_restore_value = 0,
         last_login_date      = $2::date,
         updated_at           = NOW()
     WHERE user_id = $1`,
    [userId, today]
  )
  return { claimed: true, daily: 100, streak: 1, weeklyBonus: 0, restoreEligible: false, restoreStreakValue: 0 }
}

// Spend 300 tokens to restore a broken streak (only when streak_restore_value > 0)
export async function restoreLoginStreak(userId) {
  if (!userId) return { ok: false, reason: 'invalid' }
  const { rows } = await pool.query(
    `SELECT login_streak, streak_restore_value, rating FROM player_stats WHERE user_id = $1`,
    [userId]
  )
  if (!rows[0]) return { ok: false, reason: 'not_found' }
  const { streak_restore_value, rating } = rows[0]
  if (!streak_restore_value) return { ok: false, reason: 'not_eligible' }
  if ((rating ?? 0) < 300)   return { ok: false, reason: 'insufficient_tokens' }

  const restoredStreak = streak_restore_value + 1
  await pool.query(
    `UPDATE player_stats
     SET rating               = rating - 300,
         login_streak         = $2,
         streak_restore_value = 0,
         updated_at           = NOW()
     WHERE user_id = $1`,
    [userId, restoredStreak]
  )
  return { ok: true, newStreak: restoredStreak, cost: 300 }
}

// ── Social: search, friends, blocking ─────────────────────────────────────────

export async function searchUsers(query, excludeId) {
  if (!query || query.trim().length < 2) return []
  const { rows } = await pool.query(
    `SELECT id::text, username, avatar_id FROM users
     WHERE username ILIKE $1 AND id != $2 ORDER BY username LIMIT 10`,
    [`${query.trim()}%`, excludeId]
  )
  return rows
}

export async function sendFriendRequest(requesterId, addresseeId) {
  await pool.query(
    `INSERT INTO friendships (requester_id, addressee_id, status)
     VALUES ($1, $2, 'pending') ON CONFLICT (requester_id, addressee_id) DO NOTHING`,
    [requesterId, addresseeId]
  )
}

export async function acceptFriendRequest(requesterId, addresseeId) {
  await pool.query(
    `UPDATE friendships SET status = 'accepted'
     WHERE requester_id = $1 AND addressee_id = $2 AND status = 'pending'`,
    [requesterId, addresseeId]
  )
}

export async function declineFriendRequest(requesterId, addresseeId) {
  await pool.query(
    `DELETE FROM friendships
     WHERE requester_id = $1 AND addressee_id = $2 AND status = 'pending'`,
    [requesterId, addresseeId]
  )
}

export async function removeFriend(userId, friendId) {
  await pool.query(
    `DELETE FROM friendships
     WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)`,
    [userId, friendId]
  )
}

export async function getFriends(userId) {
  const { rows } = await pool.query(
    `SELECT CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END AS id,
            u.username, u.avatar_id
     FROM friendships f
     JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
     WHERE (f.requester_id = $1 OR f.addressee_id = $1) AND f.status = 'accepted'
     ORDER BY u.username`,
    [userId]
  )
  return rows.map(r => ({ ...r, id: r.id.toString() }))
}

export async function getPendingRequests(userId) {
  const { rows } = await pool.query(
    `SELECT f.requester_id::text AS requester_id, f.addressee_id::text AS addressee_id,
            u_req.username  AS requester_name,  u_req.avatar_id  AS requester_avatar,
            u_addr.username AS addressee_name, u_addr.avatar_id AS addressee_avatar
     FROM friendships f
     JOIN users u_req  ON u_req.id  = f.requester_id
     JOIN users u_addr ON u_addr.id = f.addressee_id
     WHERE (f.requester_id = $1 OR f.addressee_id = $1) AND f.status = 'pending'`,
    [userId]
  )
  return {
    incoming: rows.filter(r => r.addressee_id === userId)
      .map(r => ({ id: r.requester_id, username: r.requester_name, avatar_id: r.requester_avatar })),
    outgoing: rows.filter(r => r.requester_id === userId)
      .map(r => ({ id: r.addressee_id, username: r.addressee_name, avatar_id: r.addressee_avatar })),
  }
}

export async function blockUser(blockerId, blockedId) {
  await pool.query(
    `INSERT INTO blocked_users (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [blockerId, blockedId]
  )
  await pool.query(
    `DELETE FROM friendships
     WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)`,
    [blockerId, blockedId]
  )
}

export async function unblockUser(blockerId, blockedId) {
  await pool.query(`DELETE FROM blocked_users WHERE blocker_id = $1 AND blocked_id = $2`, [blockerId, blockedId])
}

export async function getBlockedUsers(userId) {
  const { rows } = await pool.query(
    `SELECT u.id::text, u.username FROM blocked_users b
     JOIN users u ON u.id = b.blocked_id
     WHERE b.blocker_id = $1 ORDER BY u.username`,
    [userId]
  )
  return rows
}

// ── Password reset ────────────────────────────────────────────────────────────

export async function createPasswordResetToken(userId) {
  const { randomBytes } = await import('crypto')
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
  await pool.query(
    `DELETE FROM password_reset_tokens WHERE user_id = $1`,
    [userId]
  )
  await pool.query(
    `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
    [userId, token, expiresAt]
  )
  return token
}

export async function consumePasswordResetToken(token) {
  const { rows } = await pool.query(
    `DELETE FROM password_reset_tokens
     WHERE token = $1 AND expires_at > NOW() AND used = false
     RETURNING user_id`,
    [token]
  )
  return rows[0]?.user_id ?? null
}

export async function getUserByEmail(email) {
  const { rows } = await pool.query(
    `SELECT * FROM users WHERE email = $1`,
    [email.toLowerCase().trim()]
  )
  return rows[0] ?? null
}

export async function setEmailVerified(userId) {
  await pool.query(`UPDATE users SET email_verified = true WHERE id = $1`, [userId])
}

export default pool
