import { io } from 'socket.io-client';

const URL = 'http://localhost:3000';

const log = (...args) => console.log(...args);

function connect() {
  return new Promise(resolve => {
    const s = io(URL);
    s.on('connect', () => resolve(s));
  });
}

function emit(socket, event, data) {
  return new Promise((resolve, reject) => {
    socket.emit(event, data, (res) => {
      if (res?.success === false) reject(new Error(res.error));
      else resolve(res);
    });
  });
}

// Simple sort by suit then rank
const RANK_ORDER = { '6':0,'7':1,'8':2,'9':3,'10':4,'J':5,'Q':6,'K':7,'A':8 };
function rankOf(c) { return RANK_ORDER[c.slice(1)] ?? -1; }

async function main() {
  log('\n🃏  Joker 4-Bot Test Game\n');

  const socket = await connect();

  // ── State ─────────────────────────────────────────────────────────────────
  let players      = [];
  let roundHistory = [];
  let finalScores  = null;
  let myId;
  let roomId;
  let phase        = null;
  let bids         = {};
  let trumpSelectorId = null;
  let currentPlayer   = null;
  let currentTrick    = [];
  let trump           = null;

  // ── Create game ───────────────────────────────────────────────────────────
  const createRes = await emit(socket, 'create_game', { playerName: 'TestRunner' });
  roomId = createRes.roomId;
  myId   = createRes.playerId;
  players = createRes.players;
  log(`Room: ${roomId}`);

  for (let i = 0; i < 3; i++) {
    const res = await emit(socket, 'add_bot', {});
    players = res.players;
  }
  log(`Players: ${players.map(p => p.name).join(', ')}\n`);

  // ── Auto-act helpers ──────────────────────────────────────────────────────
  async function maybeAct() {
    try {
      if (phase === 'trump_selection' && trumpSelectorId === myId) {
        await emit(socket, 'select_trump', { suit: '♠', roomId });
        return;
      }

      if (phase === 'bidding') {
        const myBid = bids[myId];
        if (myBid == null) {
          // Check if it's my turn: I'm the next un-bid player
          const nextBidder = players.find(p => bids[p.id] == null);
          if (nextBidder?.id === myId) {
            const hand = await getHand();
            const placedBids = Object.values(bids).filter(b => b != null);
            const othersTotal = placedBids.reduce((a, b) => a + b, 0);
            let bid = 0;
            // Avoid forbidden bid (last bidder can't make total = hand size)
            if (placedBids.length === players.length - 1) {
              const forbidden = hand.length - othersTotal;
              if (bid === forbidden) bid = Math.min(1, hand.length);
            }
            await emit(socket, 'place_bid', { roomId, playerId: myId, bid });
          }
        }
        return;
      }

      if (phase === 'playing' && currentPlayer === myId) {
        const hand = await getHand();
        if (!hand.length) return;

        const card = pickCard(hand);
        currentTrick = [...currentTrick, { playerId: myId, card }];
        await emit(socket, 'play_card', { roomId, playerId: myId, card, jokerMode: 'NORMAL', takeSuit: null, giveSuit: null });
      }
    } catch (e) {
      // ignore transient errors (e.g. not our turn)
    }
  }

  function pickCard(hand) {
    if (!hand.length) return null;
    // Lead: play lowest non-joker, or joker if only jokers
    if (!currentTrick.length) {
      const nonJokers = hand.filter(c => !c.startsWith('JOKER'));
      if (nonJokers.length) return nonJokers.sort((a,b) => rankOf(a)-rankOf(b))[0];
      return hand[0];
    }
    const lead = currentTrick[0].card;
    if (lead.startsWith('JOKER')) return hand.filter(c => !c.startsWith('JOKER'))[0] ?? hand[0];
    const leadSuit = lead[0];
    const suited = hand.filter(c => !c.startsWith('JOKER') && c[0] === leadSuit);
    if (suited.length) return suited.sort((a,b) => rankOf(a)-rankOf(b))[0];
    return hand.filter(c => !c.startsWith('JOKER'))[0] ?? hand[0];
  }

  async function getHand() {
    const res = await emit(socket, 'get_hand', { roomId, playerId: myId });
    return res.cards ?? [];
  }

  // ── Listeners ─────────────────────────────────────────────────────────────
  socket.on('player_joined', (d) => { players = d.players; });

  socket.on('round_started', (d) => {
    phase           = d.phase;
    trump           = d.trump;
    trumpSelectorId = d.trumpSelectorId ?? null;
    bids            = {};
    currentTrick    = [];
    currentPlayer   = null;
    log(`  ▸ P${d.pulkaNumber} R${d.roundNumber}  trump=${d.trump ?? d.phase}`);
    maybeAct();
  });

  socket.on('trump_selected', (d) => {
    phase = 'bidding';
    trump = d.trump;
    trumpSelectorId = null;
    maybeAct();
  });

  socket.on('bid_placed', (d) => {
    bids = d.allBids;
    maybeAct();
  });

  socket.on('bidding_complete', (d) => {
    phase         = 'playing';
    bids          = d.bids;
    currentPlayer = d.currentPlayer;
    const bidLine = players.map(p =>
      `${players.find(pl=>pl.id===p.id)?.name??'?'}:${d.bids[p.id]??'?'}`
    ).join(' ');
    log(`    Bids → ${bidLine}`);
    maybeAct();
  });

  socket.on('card_played', (d) => {
    currentPlayer = d.currentPlayer;
    if (d.playerId !== myId) {
      currentTrick = [...currentTrick, { playerId: d.playerId, card: d.card }];
    }
    maybeAct();
  });

  socket.on('trick_resolved', (d) => {
    currentPlayer = d.winnerId;
    currentTrick  = [];
    maybeAct();
  });

  socket.on('round_ended', (d) => {
    phase = null;
    roundHistory.push(d);
    const line = players.map(p =>
      `${players.find(pl=>pl.id===p.id)?.name??'?'} ${(d.scores[p.id]??0)>=0?'+':''}${d.scores[p.id]??0}`
    ).join('  ');
    log(`    Scores → ${line}`);
    if (d.pulkaComplete) log(`  ✦ Pulka ${d.pulkaNumber} complete — game totals: ${
      players.map(p=>`${players.find(pl=>pl.id===p.id)?.name??'?'}:${d.gameScores?.[p.id]??'?'}`).join(' ')
    }`);
  });

  // ── Wait for game end ─────────────────────────────────────────────────────
  const done = new Promise(resolve => {
    socket.on('game_ended', (d) => { finalScores = d.finalScores; resolve(); });
  });

  await emit(socket, 'ready_to_play', { roomId, playerId: myId });

  await Promise.race([
    done,
    new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout > 5 min')), 300_000)),
  ]);

  // ── Results ───────────────────────────────────────────────────────────────
  log('\n══════════════════════════════════');
  log('  FINAL SCORES');
  log('══════════════════════════════════');

  const sorted = Object.entries(finalScores)
    .map(([id, score]) => ({ name: players.find(p=>p.id===id)?.name ?? id, score }))
    .sort((a, b) => b.score - a.score);

  sorted.forEach((p, i) => {
    const medal = ['🥇','🥈','🥉','  '][i] ?? '  ';
    log(`  ${medal} ${p.name.padEnd(20)} ${p.score}`);
  });

  log('\n══════════════════════════════════');
  log(`  Rounds played: ${roundHistory.length}`);
  log('══════════════════════════════════\n');

  socket.disconnect();
  process.exit(0);
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
