# CLAUDE.md

## Project Overview

**Joker** is a Georgian multiplayer card game (4 players) implemented as a real-time web application.

- **Backend**: Node.js (ESM), Express, Socket.io, PostgreSQL (`pg`), JWT auth, Google OAuth
- **Frontend**: React + Vite, Tailwind CSS, Socket.io-client
- **Deployment**: Railway (backend + PostgreSQL service)

### Key source layout

```
backend/
  server.js                  # Entry point — Express + Socket.io setup
  src/
    config.js                # All tunable constants (bot delays, scoring, pulka structures, hisht options)
    gameEngine/
      GameState.js           # Core state machine — phase guards, action log, hand management
      RoundManager.js        # Dealing, bidding, trick orchestration (split from GameState)
      TrickResolver.js       # Trick winner logic (Joker rules)
      Scorer.js              # Round + pulka scoring; configurable deductions, pairs, premia options
      Card.js / Deck.js      # Card primitives
      constants.js           # PHASES, suit/rank constants
    GameRoom.js              # Room lifecycle, settings, resolveHisht(), buildScoringOptions(), buildFinalScores()
    BotPlayer.js             # CPU opponent logic
    GameLogger.js            # Action log for reconnection
    db.js                    # pg pool
    routes/auth.js           # Google OAuth + JWT
    routes/profile.js        # User profile endpoints
    utils/auth.js            # JWT helpers
  test/
    iter1_engine.test.js     # Card/Deck/TrickResolver/Scorer unit tests (33 tests)
    iter2_state.test.js      # GameState/BotPlayer + phase guards + action log (46 tests)
    iter3_integration.test.js# Full room integration — 4-bot game, hisht modes (17 tests)
frontend/
  src/
    components/              # React components (GameBoard, BiddingPhase, etc.)
    styles/                  # Per-component CSS
railway.toml                 # build: npm run build, start: npm start
```

---

## Local Dev Setup

### Prerequisites

- Node.js 20+
- PostgreSQL running locally (or a Railway DATABASE_URL)

### First-time install

```bash
cd backend && npm install
cd ../frontend && npm install
```

Or run `bash SETUP.sh` (Linux/Mac/Git Bash).

### Environment variables

Copy `backend/.env.example` to `backend/.env` and fill in:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Random hex secret (see .env.example for generation command) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud Console OAuth credentials |
| `FRONTEND_URL` | `http://localhost:5173` for dev |
| `CORS_ORIGIN` | `http://localhost:5173` for dev |

### Run locally

Terminal 1 (backend):
```bash
cd backend
npm run dev        # NODE_ENV=development node server.js — port 3001
```

Terminal 2 (frontend):
```bash
cd frontend
npm run dev        # Vite dev server — http://localhost:5173
```

Open four browser tabs at `http://localhost:5173` to simulate a full 4-player game.

---

## Testing

Tests use Node's built-in test runner (`node --test`). All tests live in `backend/test/`.

```bash
cd backend

npm test                   # run all test files
npm run test:iter1         # Card / Deck / TrickResolver unit tests
npm run test:iter2         # GameState unit tests
npm run test:iter3         # Full integration tests (Socket.io client)
```

Tests are pure Node — no database required except iter3 integration tests.

---

## Aider (Code Execution)

Aider is available as a local OpenAI-compatible API for code execution tasks:

- **Base URL**: `http://localhost:1234/v1`
- **Model**: `openai/qwen2.5-coder-14b`

Use this endpoint when delegating code generation or refactoring subtasks programmatically.

## Delegating Code Execution Tasks

For any task that involves writing or modifying code, do **not** write the code directly. Instead, output a ready-to-run `delegate.ps1` command that delegates the work to local Aider. This saves tokens by offloading code generation to the local model.

**Format:**

```powershell
.\delegate.ps1 -files "backend/src/gameEngine/GameState.js" `
               -message "Your precise instruction here"
```

- `-files` — comma-separated list of files Aider should read/edit
- `-message` — a clear, self-contained instruction (no vague references to "the above")

Output the command, then stop. Do not also write the code yourself.

---

## Deployment (Railway)

Build command: `npm run build`  
Start command: `npm start`  
Health check: `GET /health`  
Restart policy: on failure

Environment variables are set in the Railway dashboard. `DATABASE_URL` is injected automatically by the Railway PostgreSQL service.
