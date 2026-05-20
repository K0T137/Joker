// Central game configuration — all tunable constants live here.

// ── Server / room ─────────────────────────────────────────────────────────────
export const MAX_PLAYERS            = 4;
export const SUBSTITUTION_DELAY_MS  = 2 * 60 * 1000; // inactivity before bot takes over
export const ROOM_AUTO_START_DELAY  = 10_000;         // ms after room fills before game starts
export const STATE_SYNC_INTERVAL    = 10_000;         // ms between periodic state broadcasts
export const ROOM_MAX_AGE_MS        = 5 * 60 * 1000; // idle room lifetime after all humans leave
export const ROOM_CLEANUP_INTERVAL  = 60 * 1000;     // how often the cleanup loop runs

// ── Chat ──────────────────────────────────────────────────────────────────────
export const CHAT_RATE_LIMIT        = 15;             // max messages per window
export const CHAT_RATE_WINDOW_MS    = 60_000;         // rate-limit window (ms)
export const CHAT_HISTORY_SIZE      = 50;             // messages kept per room
export const CHAT_MAX_LENGTH        = 200;            // characters per message

// ── Bot behaviour ─────────────────────────────────────────────────────────────
export const BOT_NAMES              = ['Pallach', 'SupermanTEUSU', 'Grendizer'];
export const BOT_MAX_FAILURES       = 3;              // consecutive errors before giving up
export const BOT_DELAYS = {
  normal:           700,   // ms — standard card play
  afterTrick:       3000,  // ms — pause after collecting a trick
  afterLastBid:     3500,  // ms — pause after all bids are in
  bidRetry:         1000,  // ms — retry wait after failed bid
  playRetry:        1000,  // ms — retry wait after failed play
  trumpSelect:      700,   // ms — bot picks trump in 9-card round
  atuzovkaBase:     4000,  // ms — base delay after atuzovka animation
  atuzovkaPerCard:  400,   // ms — additional delay per drawn atuzovka card
  betweenPlays:     1200,  // ms — between plays within the same trick
};

// ── Scoring ───────────────────────────────────────────────────────────────────
export const SCORE = {
  zeroBid:          50,    // bid=0, tricks=0
  exactBase:        50,    // base for exact bid (+ 50×bid)
  exactPerBid:      50,    // multiplier for exact bid
  allTricksPerBid:  100,   // multiplier when bid = cardsInRound
  missPerTrick:     10,    // points per unwanted trick when bid > 0
};
export const HISHT_PENALTY_DEFAULT       = '200';
export const HISHT_PENALTY_OPTIONS_CLASSIC = ['200', '500', '200/500', '×100'];
export const HISHT_PENALTY_OPTIONS_ONLY9   = ['200', '300', '500', '900'];
export const HISHT_PENALTY_OPTIONS_QUICK   = ['200', '500', '200/500', 'x100'];

// ── Round / pulka structure ───────────────────────────────────────────────────
export const PULKA_STRUCTURES = {
  normal: {
    1: [1, 2, 3, 4, 5, 6, 7, 8],
    2: [9, 9, 9, 9],
    3: [8, 7, 6, 5, 4, 3, 2, 1],
    4: [9, 9, 9, 9],
  },
  only9: {
    1: [9, 9, 9, 9],
    2: [9, 9, 9, 9],
    3: [9, 9, 9, 9],
    4: [9, 9, 9, 9],
  },
  quick: {
    1: [1, 2, 3, 4, 5, 6, 7, 8],
    2: [9, 9, 9, 9],
  },
};
export const NINE_CARD_PHASE1_DEAL  = 3;  // cards dealt before trump selection
export const NINE_CARD_PHASE2_DEAL  = 6;  // cards dealt after trump selection
