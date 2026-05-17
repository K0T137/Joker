import { useState, useEffect } from 'react'
import PlayerSeat from './PlayerSeat'
import TrickArea from './TrickArea'
import GameBoard from './GameBoard'
import BiddingPhase from './BiddingPhase'
import ScorePanel from './ScorePanel'
import Card from './Card'
import AdminPanel from './AdminPanel'
import { PRESET_AVATARS } from './Cabinet'
import { useT } from '../context/LangContext'
import { useAuth } from '../context/AuthContext'
import { usePrefs } from '../context/PrefsContext'
import LangToggle from './LangToggle'
import ThemeToggle from './ThemeToggle'
import AtuzovkaOverlay from './overlays/AtuzovkaOverlay'
import TrumpSelector from './overlays/TrumpSelector'
import JokerAnnouncementOverlay from './overlays/JokerAnnouncementOverlay'
import GameAnnouncementOverlay from './overlays/GameAnnouncementOverlay'
import RoundEndOverlay from './overlays/RoundEndOverlay'
import GameEndModal from './overlays/GameEndModal'

export default function GameRoom({ socket, gameState, playerId, isSpectator = false, onLeaveGame, onPlayAgain = null, onRematch = null, onSpectateGame, roundHistory = [], lastTrick = null, atuzovka = null, trickWinnerId = null, isCollecting = false, dealerPlayerId = null, initialDealerPlayerId = null, gameAnnouncement = null, jokerAnnouncement = null, firstPlayerId = null, gameLog = [], chatMessages = [], onSendChat = null, isMuted = false, onToggleMute = null, theme = 'dark', onToggleTheme = null, gameEndStats = null, myPlayerId = null, hishtPenalty = '200', gameMode = 'normal', playInPairs = false, isRanked = false, onKickPlayer = null, autoStartAt = null, turnTimer = null, countdown = null, onOpenCabinet = null, roundEndData = null }) {
  const t = useT()
  const { API_URL, user } = useAuth()
  const { suitHex, fourColor, toggleFourColor, deckTheme, deckThemeIdx, cycleDeckTheme, tableTheme, cycleTableTheme } = usePrefs()
  const [hand, setHand] = useState([])
  const [iAmSubstituted, setIAmSubstituted] = useState(false)
  const [statsPopup,  setStatsPopup]  = useState(null)  // { player, data, loading }
  const [blockDone,   setBlockDone]   = useState({})
  const [spectateCode, setSpectateCode] = useState('')
  const [spectateError, setSpectateError] = useState('')
  const [scorePanelOpen, setScorePanelOpen] = useState(false)
  const [autoStartSecs, setAutoStartSecs] = useState(null)
  const isPortraitNow = () => window.innerWidth < window.innerHeight && window.innerWidth < 600
  const getZoom = () => {
    if (isPortraitNow()) return 1
    return Math.min(window.innerWidth / 1280, window.innerHeight / 832)
  }
  const [portrait, setPortrait] = useState(isPortraitNow)
  const [zoom, setZoom] = useState(getZoom)
  const [compact, setCompact] = useState(() => window.innerWidth < 640)
  const [botErrorMsg, setBotErrorMsg] = useState(null)
  const [leaveConfirm, setLeaveConfirm] = useState(false)

  useEffect(() => {
    const handler = () => {
      const p = isPortraitNow()
      setPortrait(p)
      setZoom(p ? 1 : Math.min(window.innerWidth / 1280, window.innerHeight / 832))
      setCompact(window.innerWidth < 640)
    }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  const handlePlayerClick = (player) => {
    if (!player?.userId) return
    if (statsPopup?.player?.id === player.id) { setStatsPopup(null); return }
    setStatsPopup({ player, data: null, loading: true })
    fetch(`${API_URL}/api/stats/${player.userId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => setStatsPopup(prev => prev?.player?.id === player.id ? { ...prev, data, loading: false } : prev))
      .catch(() => setStatsPopup(prev => prev?.player?.id === player.id ? { ...prev, loading: false } : prev))
  }

  const handleWatchByCode = () => {
    const code = spectateCode.trim().toUpperCase()
    if (!code) { setSpectateError('Enter a room code'); return }
    setSpectateError('')
    onSpectateGame?.(code, (err) => setSpectateError(err ?? 'Room not found'))
  }

  // Auto-start countdown tick
  useEffect(() => {
    if (!autoStartAt) { setAutoStartSecs(null); return }
    const tick = () => {
      const rem = Math.ceil((autoStartAt - Date.now()) / 1000)
      setAutoStartSecs(Math.max(0, rem))
    }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [autoStartAt])

  // Fetch hand at the start of bidding OR trump_selection — spectators never have a hand
  useEffect(() => {
    if (isSpectator) return
    const phase = gameState?.gameState?.phase
    if (!socket || (phase !== 'bidding' && phase !== 'trump_selection')) return
    socket.emit('get_hand', { roomId: gameState.roomId, playerId }, (res) => {
      if (res.success) setHand(res.cards)
    })
  }, [gameState?.gameState?.phase, gameState?.gameState?.roundNumber])

  // Track bot-substitution state and keep hand in sync
  useEffect(() => {
    if (!socket || isSpectator) return
    const onSubstituted = (data) => {
      if (data.playerId === playerId) setIAmSubstituted(true)
    }
    const onResumed = (data) => {
      if (data.playerId === playerId) setIAmSubstituted(false)
    }
    const onHandUpdate = (data) => {
      if (Array.isArray(data.cards)) setHand(data.cards)
    }
    const onBotError = (data) => setBotErrorMsg(data.message)
    socket.on('player_substituted', onSubstituted)
    socket.on('player_resumed',     onResumed)
    socket.on('hand_update',        onHandUpdate)
    socket.on('bot_error',          onBotError)
    return () => {
      socket.off('player_substituted', onSubstituted)
      socket.off('player_resumed',     onResumed)
      socket.off('hand_update',        onHandUpdate)
      socket.off('bot_error',          onBotError)
    }
  }, [socket, isSpectator, playerId])

  // ── Actions ──────────────────────────────────────────────────────────────────

  const playCard = (card, jokerMode, takeSuit, giveSuit) => {
    socket?.emit('play_card', {
      roomId: gameState.roomId, playerId, card,
      jokerMode: jokerMode || 'NORMAL', takeSuit, giveSuit,
    }, (res) => {
      if (res.success) setHand(prev => prev.filter(c => c !== card))
      else alert(res.error)
    })
  }

  const placeBid = (bid) => {
    socket?.emit('place_bid', { roomId: gameState.roomId, playerId, bid }, (res) => {
      if (!res.success) alert(res.error)
    })
  }

  const onSelectTrump = (suit) => {
    socket?.emit('select_trump', { suit }, (res) => {
      if (!res.success) alert(res.error)
    })
  }

  const setReady = () => socket?.emit('ready_to_play', { roomId: gameState.roomId, playerId })
  const addBot   = () => socket?.emit('add_bot', {}, (res) => { if (!res?.success) alert(res?.error) })

  // ── Guards ───────────────────────────────────────────────────────────────────

  if (!gameState) {
    return <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-400">{t('connecting')}</div>
  }

  const gs      = gameState.gameState
  const players = gameState.players ?? []

  // ── LOBBY ────────────────────────────────────────────────────────────────────

  if (!gs || gs.phase === 'waiting') {
    const copyRoomId = () => {
      navigator.clipboard?.writeText(gameState.roomId).catch(() => {})
    }

    const myPlayer   = players.find(p => p.id === playerId)
    const iAmReady   = myPlayer?.ready
    const iAmCreator = myPlayer?.isCreator

    return (
      <div
        className="flex h-screen items-center justify-center px-4"
        style={{
          backgroundImage: `url('${theme === 'dark' ? tableTheme.darkSrc : tableTheme.brightSrc}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: '#09090e',
        }}
      >
        {/* Corner watermarks */}
        {['♠','♥','♦','♣'].map((s, i) => (
          <span key={i} className="absolute text-7xl select-none pointer-events-none"
            style={{
              color: '#c9a84c', opacity: 0.04,
              top:    i < 2 ? 24 : undefined,
              bottom: i >= 2 ? 24 : undefined,
              left:   i % 2 === 0 ? 24 : undefined,
              right:  i % 2 === 1 ? 24 : undefined,
            }}>
            {s}
          </span>
        ))}

        <div className="w-full max-w-sm flex flex-col gap-5">

          {/* ── Header ── */}
          <div className="text-center">
            <h1
              className="text-4xl font-black tracking-[0.15em]"
              style={{ color: '#e8d5a3', fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              JOKER
            </h1>
            <p className="text-base tracking-[0.2em]" style={{ color: '#c9a84c', fontFamily: "'Playfair Display', Georgia, serif" }}>
              ჯოკერი
            </p>
          </div>

          {/* ── Room code ── */}
          <div
            className="flex items-center justify-between rounded-2xl px-5 py-3"
            style={{ background: '#13131a', border: '1px solid #222230' }}
          >
            <div>
              <div className="text-[10px] uppercase tracking-widest font-semibold mb-0.5" style={{ color: '#3e3e50' }}>
                {t('room_code_label')}
              </div>
              <span className="font-mono font-black text-2xl tracking-[0.3em]" style={{ color: '#c9a84c' }}>
                {gameState.roomId}
              </span>
            </div>
            {/* Ranked badge — only shown when ranked and no bots in room */}
            {isRanked && !players.some(p => p.isBot) && (
              <span className="text-[9px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded-full"
                style={{ background: 'rgba(201,168,76,0.15)', color: '#c9a84c', border: '1px solid rgba(201,168,76,0.3)' }}>
                {t('ranked_badge')}
              </span>
            )}
            <button
              onClick={copyRoomId}
              className="text-xs px-3 py-1.5 rounded-lg transition-all hover:brightness-110 active:scale-95 font-semibold"
              style={{ background: '#1e1e2a', color: '#6b6b80', border: '1px solid #2a2a38' }}
            >
              {t('copy_btn')}
            </button>
          </div>

          {/* ── Player seats ── */}
          <div className="flex flex-col gap-2">
            {players.map(p => (
              <div
                key={p.id}
                onClick={p.id === playerId && onOpenCabinet ? onOpenCabinet : undefined}
                className="flex items-center gap-3 rounded-2xl px-4 py-3 transition-all"
                style={{
                  background: '#13131a',
                  border: p.ready ? '1px solid #c9a84c' : '1px solid #1e1e2a',
                  boxShadow: p.ready ? '0 0 12px rgba(201,168,76,0.15)' : 'none',
                  cursor: p.id === playerId && onOpenCabinet ? 'pointer' : 'default',
                }}
              >
                {/* Avatar */}
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center font-bold flex-shrink-0"
                  style={{
                    fontSize: !p.isBot && PRESET_AVATARS[p.avatarId] ? 18 : 14,
                    ...(p.ready
                      ? { background: '#c9a84c', color: '#0a0a0f' }
                      : { background: '#1e1e2a', color: '#6b6b80' })
                  }}
                >
                  {p.isBot ? '🤖' : (PRESET_AVATARS[p.avatarId] || p.name?.[0]?.toUpperCase())}
                </div>

                {/* Name + badges */}
                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold truncate" style={{ color: '#e8d5a3' }}>
                      {p.name}
                      {p.isBot && <span className="ml-1.5 text-[10px] font-normal" style={{ color: '#3e3e50' }}>{t('bot_label')}</span>}
                    </span>
                    {/* Honour badge */}
                    {!p.isBot && p.honorRate != null && (
                      <span title={`Honour: ${p.honorRate}`} style={{
                        fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 5,
                        background: p.honorRate >= 90 ? 'rgba(201,168,76,0.15)' : p.honorRate >= 60 ? 'rgba(74,159,232,0.12)' : 'rgba(239,68,68,0.12)',
                        color:      p.honorRate >= 90 ? '#c9a84c'              : p.honorRate >= 60 ? '#4a9fe8'              : '#ef4444',
                        border:     `1px solid ${p.honorRate >= 90 ? 'rgba(201,168,76,0.3)' : p.honorRate >= 60 ? 'rgba(74,159,232,0.2)' : 'rgba(239,68,68,0.2)'}`,
                      }}>
                        {p.honorRate >= 90 ? '🏅' : p.honorRate >= 60 ? '⚡' : '💀'} {p.honorRate}
                      </span>
                    )}
                    {/* Low-honour warning */}
                    {!p.isBot && p.honorRate != null && p.honorRate < 60 && p.id !== playerId && (
                      <span title="Low honour — may disconnect" style={{ fontSize: 9, color: '#ef4444', opacity: 0.7 }}>⚠</span>
                    )}
                  </div>
                  {/* Achievement icons */}
                  {!p.isBot && p.achievements > 0 && (
                    <div className="flex gap-1 mt-0.5">
                      {(p.achievements & 1) > 0 && <span title="First Win"     style={{ fontSize: 11 }}>🏆</span>}
                      {(p.achievements & 2) > 0 && <span title="First Hisht"   style={{ fontSize: 11 }}>💀</span>}
                      {(p.achievements & 4) > 0 && <span title="Bid Master"    style={{ fontSize: 11 }}>🎯</span>}
                      {(p.achievements & 8) > 0 && <span title="Joker Master"  style={{ fontSize: 11 }}>🃏</span>}
                    </div>
                  )}
                </div>

                {/* Status */}
                {p.ready ? (
                  <span className="text-xs font-bold" style={{ color: '#c9a84c' }}>{t('ready_check')}</span>
                ) : (
                  <span className="text-xs" style={{ color: '#2e2e3a' }}>{t('waiting_dots')}</span>
                )}

                {/* Kick button — visible to creator only, not for self */}
                {iAmCreator && !isSpectator && p.id !== playerId && (
                  <button
                    onClick={() => onKickPlayer?.(p.id)}
                    title="Kick player"
                    className="ml-1 text-[11px] px-2 py-0.5 rounded-lg transition-all hover:brightness-125"
                    style={{ background: '#1e1a1a', border: '1px solid #3a1a1a', color: '#6a3333' }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}

            {/* Empty slots */}
            {Array.from({ length: 4 - players.length }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-2xl px-4 py-3"
                style={{ border: '1px dashed #1e1e2a' }}
              >
                <div className="w-9 h-9 rounded-full flex-shrink-0" style={{ background: '#0f0f14', border: '1px dashed #2a2a38' }} />
                <span className="text-sm" style={{ color: '#2a2a38' }}>{t('empty_seat')}</span>
              </div>
            ))}
          </div>

          {/* ── Actions ── */}
          {isSpectator ? (
            <div className="flex items-center justify-center py-3 rounded-2xl" style={{ background: '#13131a', border: '1px solid #1e1e2a' }}>
              <span className="text-xs tracking-widest uppercase" style={{ color: '#3e3e50' }}>{t('spectating')}</span>
            </div>
          ) : (
            <div className="flex gap-2">
              {players.length < 4 && (
                <button
                  onClick={addBot}
                  className="flex-1 py-3 rounded-2xl font-semibold text-sm transition-all hover:brightness-110 active:scale-[0.98]"
                  style={{ background: '#1a1a22', color: '#6b6b80', border: '1px solid #252530' }}
                >
                  {t('add_bot_btn')}
                </button>
              )}
              <button
                onClick={setReady}
                className="flex-1 py-3 rounded-2xl font-bold text-sm transition-all active:scale-[0.98]"
                style={iAmReady
                  ? { background: '#1a1a22', color: '#c9a84c', border: '1px solid #c9a84c' }
                  : { background: 'linear-gradient(135deg, #c9a84c 0%, #a8893d 100%)', color: '#0a0a0f', boxShadow: '0 4px 16px rgba(201,168,76,0.3)' }
                }
              >
                {iAmReady ? t('ready_check') : t('ready_btn')}
              </button>
            </div>
          )}

          {/* Auto-start countdown */}
          {autoStartSecs !== null && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[10px]" style={{ color: '#6b6b80' }}>
                <span>{t('auto_start_label')}</span>
                <span className="font-mono font-bold" style={{ color: autoStartSecs <= 3 ? '#ef4444' : '#c9a84c' }}>
                  {autoStartSecs}s
                </span>
              </div>
              <div className="w-full rounded-full overflow-hidden" style={{ height: 3, background: '#1e1e2a' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (autoStartSecs / 10) * 100)}%`,
                    background: autoStartSecs <= 3 ? '#ef4444' : '#c9a84c',
                    transition: 'width 0.25s linear',
                  }}
                />
              </div>
            </div>
          )}

          {/* Hint */}
          <p className="text-center text-[11px]" style={{ color: '#252530' }}>
            {isSpectator ? t('watch_hint') : t('share_hint')}
          </p>

          {/* Watch another game by code (accessible even when already in a game) */}
          <div className="mt-1 flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={t('watch_code_ph')}
                value={spectateCode}
                onChange={e => setSpectateCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleWatchByCode()}
                className="flex-1 px-3 py-2 rounded-xl text-xs focus:outline-none font-mono tracking-widest uppercase"
                style={{ background: '#0d0d12', border: '1px solid #1e1e2a', color: '#e8d5a3', caretColor: '#c9a84c' }}
              />
              <button
                onClick={handleWatchByCode}
                className="px-3 py-2 rounded-xl text-xs font-bold transition-all hover:brightness-125 active:scale-[0.97]"
                style={{ background: '#1e1e2c', border: '1px solid #3e3e58', color: '#9b9bc0' }}
              >
                {t('watch_short')}
              </button>
            </div>
            {spectateError && <p className="text-[10px] text-center" style={{ color: '#e05252' }}>{spectateError}</p>}
          </div>

          {/* Leave / back to lobby */}
          {!isSpectator && (
            <button
              onClick={onLeaveGame}
              className="text-[10px] text-center mt-1 hover:underline"
              style={{ color: '#252530' }}
            >
              {t('leave_game')}
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Seat assignment ──────────────────────────────────────────────────────────

  // Spectators have no seat — anchor the view to player[0] as bottom
  const myIndex = isSpectator ? 0 : players.findIndex(p => p.id === playerId)
  const get     = (offset) => players[(myIndex + offset) % 4]
  const seats   = { bottom: get(0), left: get(1), top: get(2), right: get(3) }
  const seatOrder = [seats.bottom?.id, seats.left?.id, seats.top?.id, seats.right?.id]

  // Current actor
  const currentActor =
    gs.phase === 'bidding'           ? gs.currentBidder
    : gs.phase === 'trump_selection' ? gs.trumpSelectorId
    : gs.currentPlayer

  const isMyBidTurn      = currentActor === playerId && gs.phase === 'bidding'
  const isMyPlayTurn     = currentActor === playerId && gs.phase === 'playing'
  const isMyTrumpTurn    = currentActor === playerId && gs.phase === 'trump_selection'
  const currentActorName = players.find(p => p.id === currentActor)?.name ?? '…'

  // Prohibition rule: last bidder can't pick a value that makes total bids = cardCount
  const allOthersHaveBid = players.every(p => p.id === playerId || gs.bids?.[p.id] != null)
  const otherBidsTotal   = players.reduce((sum, p) => {
    if (p.id === playerId) return sum
    const b = gs.bids?.[p.id]
    return b != null ? sum + b : sum
  }, 0)
  const forbiddenBid = (isMyBidTurn && allOthersHaveBid) ? hand.length - otherBidsTotal : null

  // Equalise-bid advice for 2nd and 3rd bidder (soft suggestion, not a restriction)
  const bidsPlaced   = Object.values(gs.bids ?? {}).filter(b => b != null).length
  const bidsSum      = Object.values(gs.bids ?? {}).reduce((s, b) => s + (b ?? 0), 0)
  const equalizeBid  = (isMyBidTurn && bidsPlaced > 0 && bidsPlaced < 3)
    ? Math.max(0, hand.length - bidsSum)
    : null

  // "Goes first" = player immediately left of dealer (clockwise)
  const dealerIdx          = players.findIndex(p => p.id === dealerPlayerId)
  const goesFirstPlayerId  = dealerIdx >= 0 ? players[(dealerIdx + 1) % players.length]?.id : null

  const totalTricksPlayed = Object.values(gs.tricksCounts ?? {}).reduce((s, t) => s + (t ?? 0), 0)

  const runningScores = (() => {
    const acc = Object.fromEntries(players.map(p => [p.id, 0]))
    for (const round of roundHistory) {
      if (round.pulkaComplete || round.gameComplete) {
        // Pulka/game end: authoritative cumulative total (already includes bonuses)
        if (round.gameScores) players.forEach(p => { acc[p.id] = round.gameScores[p.id] ?? acc[p.id] })
      } else {
        // Mid-pulka: accumulate per-round raw score onto current baseline
        if (round.scores) players.forEach(p => { acc[p.id] += round.scores[p.id] ?? 0 })
      }
    }
    return acc
  })()

  const seatProps = (pos) => ({
    player:             seats[pos],
    position:           pos,
    isCurrentTurn:      currentActor === seats[pos]?.id,
    bid:                gs.bids?.[seats[pos]?.id],
    trickCount:         gs.tricksCounts?.[seats[pos]?.id],
    cardCount:          hand.length,
    isDealer:           seats[pos]?.id === dealerPlayerId,
    isFirstPlayer:      seats[pos]?.id === goesFirstPlayerId,
    cardsInRound:       gs.cardsInRound,
    totalTricksPlayed,
    onClickPlayer:      handlePlayerClick,
    gameScore:          roundHistory.length > 0 ? (runningScores[seats[pos]?.id] ?? null) : null,
    timerCountdown:     turnTimer?.playerId === seats[pos]?.id ? (countdown ?? null) : null,
  })

  const inGame = gs.phase === 'bidding' || gs.phase === 'playing' || gs.phase === 'trump_selection'

  // ── GAME TABLE ───────────────────────────────────────────────────────────────

  const trumpColor  = gs.trump && gs.trump !== 'NO_TRUMP' ? suitHex(gs.trump) : '#f0f0f0'
  const trumpLabel  = gs.trump === 'NO_TRUMP' ? 'NO TRUMP' : gs.trump

  // ── PORTRAIT MOBILE LAYOUT ──────────────────────────────────────────────────
  if (portrait) {
    const tableBg = { backgroundImage: `url('${theme === 'dark' ? tableTheme.darkSrc : tableTheme.brightSrc}')`, backgroundSize: 'cover', backgroundPosition: 'center' }
    const btnBase = { borderRadius: '0.625rem', border: '1px solid #2a2a38', background: 'rgba(8,8,12,0.85)', cursor: 'pointer', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }

    return (
      <div key={deckThemeIdx} style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', ...tableBg }}>

        {botErrorMsg && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, background: '#b91c1c', padding: '8px 16px', color: '#fff', fontSize: 13 }}>
            <span>⚠ {botErrorMsg}</span>
            <button style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setBotErrorMsg(null)}>Dismiss</button>
          </div>
        )}

        {/* ── Opponent bar ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '6px 8px', height: 70, flexShrink: 0, background: 'rgba(0,0,0,0.35)' }}>
          <PlayerSeat {...seatProps('left')}  mini />
          <PlayerSeat {...seatProps('top')}   mini />
          <PlayerSeat {...seatProps('right')} mini />
        </div>

        {/* ── Info strip: trump + round ── */}
        {inGame && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, height: 28, flexShrink: 0, background: 'rgba(0,0,0,0.22)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            {gs.trump && (
              <span style={{ fontSize: 13, fontWeight: 800, color: trumpColor }}>{trumpLabel}</span>
            )}
            {gs.roundNumber != null && (
              <span style={{ fontSize: 10, color: '#6b6b80', fontFamily: 'monospace' }}>R{gs.roundNumber} · {gs.cardsInRound}c</span>
            )}
          </div>
        )}

        {/* ── Trick / play area ── */}
        <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
          <TrickArea
            currentTrick={gs.currentTrick ?? []}
            seatOrder={seatOrder}
            trickWinnerId={trickWinnerId}
            isCollecting={isCollecting}
            portrait
          />

          {/* Trump card — small, anchored bottom-right of trick area */}
          {inGame && gs.trump && (
            <div style={{ position: 'absolute', bottom: 8, right: 8, zIndex: 15, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, pointerEvents: 'none' }}>
              {gs.trumpCard
                ? <div style={{ zoom: 0.55 }}><Card cardId={gs.trumpCard} /></div>
                : gs.trump === 'NO_TRUMP'
                  ? <span style={{ fontSize: 28, lineHeight: 1 }}>🃏</span>
                  : <span style={{ fontSize: 32, lineHeight: 1, fontWeight: 900, color: trumpColor }}>{trumpLabel}</span>
              }
              {gs.trumpCard && <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>{t('trump_label')}</span>}
            </div>
          )}

          {gs.phase === 'trump_selection' && isMyTrumpTurn && !isSpectator && (
            <TrumpSelector onSelect={onSelectTrump} compact />
          )}
          {gs.phase === 'trump_selection' && (!isMyTrumpTurn || isSpectator) && (
            <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
              <div style={{ background: 'rgba(8,8,12,0.75)', borderRadius: '0.75rem', padding: '12px 24px' }}>
                <span style={{ color: 'rgba(201,168,76,0.7)', fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                  {players.find(p => p.id === gs.trumpSelectorId)?.name ?? '…'} {t('choosing_trump')}
                </span>
              </div>
            </div>
          )}

          {atuzovka          && <AtuzovkaOverlay data={atuzovka} players={players} myIndex={myIndex} />}
          {jokerAnnouncement && <JokerAnnouncementOverlay data={jokerAnnouncement} />}
          {gameAnnouncement  && <GameAnnouncementOverlay data={gameAnnouncement} />}
          {roundEndData      && <RoundEndOverlay data={roundEndData} players={players} />}

          {gs.phase === 'game_end' && gameEndStats && (() => {
            const finalScores = gameEndStats.finalScores ?? {}
            const tokenDeltas = gameEndStats.tokenDeltas ?? {}
            const computedStats = players.map(p => {
              const rounds = roundHistory.filter(r => r.bids?.[p.id] != null)
              const exactBids = rounds.filter(r => r.bids[p.id] === (r.tricks?.[p.id] ?? -1)).length
              const hishts    = rounds.filter(r => (r.scores?.[p.id] ?? 0) < 0).length
              return { ...p, score: finalScores[p.id] ?? 0, exactBids, hishts, totalBids: rounds.length, tokenDelta: tokenDeltas[p.id] ?? null }
            })
            return (
              <GameEndModal
                stats={computedStats}
                players={players}
                myPlayerId={myPlayerId ?? playerId}
                roomId={gameState?.roomId}
                onPlayAgain={!isSpectator ? onPlayAgain : null}
                onRematch={!isSpectator ? onRematch : null}
                onLeaveGame={onLeaveGame}
                playInPairs={gameEndStats?.playInPairs ?? playInPairs}
                isRanked={gameEndStats?.isRanked ?? false}
              />
            )
          })()}

          {statsPopup && (
            <div className="absolute inset-0 z-40 flex items-center justify-center" onClick={() => setStatsPopup(null)}>
              <div onClick={e => e.stopPropagation()} style={{ background: 'rgba(8,8,12,0.97)', border: '1px solid rgba(201,168,76,0.35)', borderRadius: '1rem', padding: '20px 28px', minWidth: 220, textAlign: 'center' }}>
                <div style={{ color: '#c9a84c', fontSize: 15, fontWeight: 900, marginBottom: 4 }}>{statsPopup.player.name}</div>
                {statsPopup.loading ? (
                  <div style={{ color: '#3a3a4a', fontSize: 12, padding: '12px 0' }}>…</div>
                ) : statsPopup.data ? (
                  <div style={{ marginTop: 10 }}>
                    {[[t('stats_games'), statsPopup.data.games_played], [t('stats_win_rate'), `${statsPopup.data.win_rate}%`], [t('stats_bid_acc'), `${statsPopup.data.bid_accuracy}%`], [t('stats_score'), (statsPopup.data.total_score / 100).toFixed(1)]].map(([label, val]) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginBottom: 5 }}>
                        <span style={{ color: '#4a4a5a', fontSize: 11 }}>{label}</span>
                        <span style={{ color: '#e8d5a3', fontSize: 11, fontWeight: 700 }}>{val}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: '#3a3a4a', fontSize: 11, padding: '10px 0' }}>{t('stats_no_games')}</div>
                )}
                <button onClick={() => setStatsPopup(null)} style={{ marginTop: 14, color: '#3a3a4a', background: 'none', border: 'none', fontSize: 11, cursor: 'pointer' }}>{t('joker_cancel')}</button>
              </div>
            </div>
          )}
        </div>

        {/* ── Bidding buttons ── */}
        {!isSpectator && gs.phase === 'bidding' && (
          <div style={{ flexShrink: 0, background: 'rgba(0,0,0,0.45)', borderTop: '1px solid #1e1e2a', paddingBottom: 2 }}>
            <BiddingPhase
              onBidSubmit={placeBid}
              myBid={gs.bids?.[playerId]}
              cardCount={hand.length}
              isMyTurn={isMyBidTurn}
              forbiddenBid={forbiddenBid}
              equalizeBid={equalizeBid}
              mobile
              currentBidderName={currentActorName}
            />
          </div>
        )}

        {/* ── My badge ── */}
        <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'center', padding: '3px 0', background: 'rgba(0,0,0,0.2)' }}>
          <PlayerSeat {...seatProps('bottom')} compact />
        </div>

        {/* ── Hand ── */}
        {!isSpectator && inGame ? (
          <div style={{ flexShrink: 0, background: 'rgba(0,0,0,0.25)', paddingTop: 4, paddingBottom: 2 }}>
            <GameBoard
              hand={hand}
              onPlayCard={playCard}
              currentTrick={gs.currentTrick ?? []}
              trump={gs.trump}
              isMyTurn={isMyPlayTurn}
              isBidding={gs.phase === 'bidding'}
              compact
              portrait
              currentPlayerName={currentActorName}
            />
          </div>
        ) : null}

        {/* ── Controls bar ── */}
        {(() => {
          const btn40 = { ...btnBase, width: 40, height: 40, padding: 0, fontSize: 18, flexShrink: 0 }
          return (
            <div style={{ flexShrink: 0, display: 'flex', gap: 6, padding: '6px 10px', background: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
              <button onClick={isSpectator ? onLeaveGame : () => setLeaveConfirm(true)} style={{ ...btn40, fontSize: 16, color: '#8888a8' }}>✕</button>
              {!isSpectator && <button onClick={onToggleMute} style={{ ...btn40, color: isMuted ? '#ef4444' : '#6a6a8a' }}>{isMuted ? '🔇' : '🔔'}</button>}
              {!isSpectator && <button onClick={cycleTableTheme} style={{ ...btn40 }}>🎴</button>}
              {!isSpectator && <button onClick={toggleFourColor} style={{ ...btn40, color: fourColor ? '#3b82f6' : '#4a4a5a', border: `1px solid ${fourColor ? '#3b82f6' : '#2a2a38'}` }}>♦</button>}
              {!isSpectator && <button onClick={() => setScorePanelOpen(o => !o)} style={{ ...btn40, color: '#c9a84c' }}>📊</button>}
              <LangToggle compact />
              <ThemeToggle theme={theme} onToggle={onToggleTheme} style={{ width: 40, height: 40, padding: 0 }} />
            </div>
          )
        })()}

        {/* Score panel (slide-in) */}
        {scorePanelOpen && (
          <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setScorePanelOpen(false)} />
        )}
        <ScorePanel
          players={players} roundHistory={roundHistory} pulkaNumber={gs.pulkaNumber}
          roundNumber={gs.roundNumber} roomId={gameState.roomId} trump={gs.trump}
          lastTrick={lastTrick} gameScores={gs.gameScores} currentBids={gs.bids}
          gameLog={gameLog} dealerPlayerId={dealerPlayerId} initialDealerPlayerId={initialDealerPlayerId}
          chatMessages={chatMessages} onSendChat={onSendChat} theme={theme} onToggleTheme={onToggleTheme}
          myPlayerId={myPlayerId ?? playerId} hishtPenalty={hishtPenalty} gameMode={gameMode}
          mobileOpen={scorePanelOpen} onMobileClose={() => setScorePanelOpen(false)} trickWinnerId={trickWinnerId}
        />

        {/* Bot-substitution overlay */}
        {iAmSubstituted && !isSpectator && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)' }}>
            <div style={{ background: 'rgba(8,8,12,0.98)', border: '2px solid rgba(201,168,76,0.6)', borderRadius: '1.5rem', padding: '36px 40px', textAlign: 'center', boxShadow: '0 12px 60px rgba(0,0,0,0.8)', maxWidth: 320, width: '90%' }}>
              <div style={{ fontSize: 44, marginBottom: 14 }}>🤖</div>
              <div style={{ color: 'rgba(201,168,76,0.9)', fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{t('bot_substituting')}</div>
              <div style={{ color: '#4a4a5a', fontSize: 12, marginBottom: 28 }}>{t('reclaim_hint')}</div>
              <button onClick={() => { setIAmSubstituted(false); socket?.emit('reclaim_control', {}, (res) => { if (Array.isArray(res?.cards)) setHand(res.cards) }); socket?.emit('get_hand', { roomId: gameState?.roomId, playerId }, (res) => { if (res?.success && Array.isArray(res.cards)) setHand(res.cards) }) }}
                style={{ padding: '16px 0', borderRadius: '0.875rem', background: 'linear-gradient(135deg,#c9a84c,#a8893d)', color: '#0a0a0f', fontWeight: 800, fontSize: 16, border: 'none', cursor: 'pointer', width: '100%', boxShadow: '0 4px 20px rgba(201,168,76,0.45)' }}>
                {t('reclaim_control')}
              </button>
            </div>
          </div>
        )}

        {/* Leave confirmation */}
        {leaveConfirm && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setLeaveConfirm(false)}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#10141f', border: '1px solid #2a3450', borderRadius: '1.25rem', padding: '32px 28px', maxWidth: 340, width: '90%', textAlign: 'center', boxShadow: '0 16px 64px rgba(0,0,0,0.8)' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🚪</div>
              <div style={{ color: '#e8e0cc', fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{t('leave_confirm_title')}</div>
              <div style={{ color: '#5a6480', fontSize: 13, marginBottom: 28 }}>{t('leave_confirm_body')}</div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => setLeaveConfirm(false)} style={{ flex: 1, padding: '12px 0', borderRadius: '0.75rem', border: '1px solid #2a3450', background: 'transparent', color: '#8888a8', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{t('cancel')}</button>
                <button onClick={() => { setLeaveConfirm(false); onLeaveGame?.() }} style={{ flex: 1, padding: '12px 0', borderRadius: '0.75rem', border: 'none', background: '#c0392b', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>{t('leave_confirm_yes')}</button>
              </div>
            </div>
          </div>
        )}

        {import.meta.env.DEV && (
          <div style={{ position: 'fixed', top: 8, right: 8, zIndex: 50 }}>
            <AdminPanel socket={socket} roomId={gameState?.roomId} />
          </div>
        )}
      </div>
    )
  }

  // ── LANDSCAPE / DESKTOP LAYOUT ───────────────────────────────────────────────

  return (
    <div className="flex overflow-hidden" style={{ zoom, width: `${window.innerWidth / zoom}px`, height: `${window.innerHeight / zoom}px` }}>

      {botErrorMsg && (
        <div className="fixed top-0 inset-x-0 z-50 flex items-center justify-between gap-4 bg-red-700 px-4 py-2 text-white text-sm shadow-lg">
          <span>⚠ {botErrorMsg}</span>
          <button className="shrink-0 underline opacity-80 hover:opacity-100" onClick={() => setBotErrorMsg(null)}>Dismiss</button>
        </div>
      )}

      <div
        key={deckThemeIdx}
        className="relative flex-1 flex flex-col min-w-0 overflow-hidden"
        style={{
          background: `url('${theme === 'dark' ? tableTheme.darkSrc : tableTheme.brightSrc}') center/cover no-repeat, #09090e`,
        }}
      >

        <div className="flex-1 flex flex-col pt-2 px-2 pb-2 gap-1 min-w-0 overflow-hidden">

          {/* Top seat */}
          <div className="flex justify-center flex-shrink-0">
            <PlayerSeat {...seatProps('top')} compact={compact} />
          </div>

          {/* Middle row: left | TABLE | right — compact overlays sides */}
          <div className="flex-1 flex items-stretch gap-0 min-h-0 relative">

            {/* Left seat */}
            {compact ? (
              <div className="absolute left-1 top-1/2 -translate-y-1/2 z-10">
                <PlayerSeat {...seatProps('left')} compact />
              </div>
            ) : (
              <div className="flex-shrink-0 flex items-center z-10">
                <PlayerSeat {...seatProps('left')} />
              </div>
            )}

            {/* ── Play area ── */}
            <div className="flex-1 relative min-h-0">

              <TrickArea
                currentTrick={gs.currentTrick ?? []}
                seatOrder={seatOrder}
                trickWinnerId={trickWinnerId}
                isCollecting={isCollecting}
                compact={compact}
              />

              {/* Trump selection overlay for 9-card rounds */}
              {gs.phase === 'trump_selection' && isMyTrumpTurn && !isSpectator && (
                <TrumpSelector onSelect={onSelectTrump} compact={compact} />
              )}
              {gs.phase === 'trump_selection' && (!isMyTrumpTurn || isSpectator) && (
                <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                  <div style={{ background: 'rgba(8,8,12,0.75)', borderRadius: '0.75rem', padding: '12px 24px' }}>
                    <span style={{ color: 'rgba(201,168,76,0.7)', fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                      {players.find(p => p.id === gs.trumpSelectorId)?.name ?? '…'} {t('choosing_trump')}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Right seat */}
            {compact ? (
              <div className="absolute right-1 top-1/2 -translate-y-1/2 z-10">
                <PlayerSeat {...seatProps('right')} compact />
              </div>
            ) : (
              <div className="flex-shrink-0 flex items-center z-10">
                <PlayerSeat {...seatProps('right')} />
              </div>
            )}
          </div>

          {/* Bottom: bid bar + hand + my badge */}
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            {!isSpectator && gs.phase === 'bidding' && (
              <BiddingPhase
                onBidSubmit={placeBid}
                myBid={gs.bids?.[playerId]}
                cardCount={hand.length}
                isMyTurn={isMyBidTurn}
                forbiddenBid={forbiddenBid}
                equalizeBid={equalizeBid}
                compact={compact}
                currentBidderName={currentActorName}
              />
            )}
            {!isSpectator && inGame && (
              <GameBoard
                hand={hand}
                onPlayCard={playCard}
                currentTrick={gs.currentTrick ?? []}
                trump={gs.trump}
                isMyTurn={isMyPlayTurn}
                isBidding={gs.phase === 'bidding'}
                compact={compact}
                currentPlayerName={currentActorName}
              />
            )}
            {isSpectator && (
              <div
                className="flex items-center gap-2 px-4 py-2 rounded-xl mb-1"
                style={{ background: 'rgba(10,10,15,0.7)', border: '1px solid #1e1e2a' }}
              >
                <span style={{ fontSize: 12, color: '#3e3e50' }}>👁</span>
                <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#3e3e50' }}>{t('spectating')}</span>
              </div>
            )}
            <PlayerSeat {...seatProps('bottom')} compact={compact} />
          </div>
        </div>


        {/* Controls — bottom-left */}
        <div className="absolute bottom-4 left-4 z-20 flex flex-col items-start gap-1">
          {!isSpectator && (
            <div className="flex gap-1.5 items-center">
              {/* shared button base */}
              <button
                onClick={() => setLeaveConfirm(true)}
                className="hover:brightness-125 transition-all font-semibold tracking-wide"
                style={{ background: 'rgba(10,8,14,0.92)', border: '1px solid #44424e', color: '#8888a8',
                  borderRadius: '0.75rem', padding: '8px 14px', fontSize: 12, cursor: 'pointer' }}
              >
                {t('leave')}
              </button>
              <button
                onClick={onToggleMute}
                title={isMuted ? 'Unmute sounds' : 'Mute sounds'}
                className="hover:brightness-125 transition-all"
                style={{ background: 'rgba(8,8,12,0.85)', border: '1px solid #2a2a38', color: isMuted ? '#ef4444' : '#6a6a8a',
                  borderRadius: '0.75rem', padding: '8px 12px', fontSize: 18, lineHeight: 1, cursor: 'pointer' }}
              >
                {isMuted ? '🔇' : '🔔'}
              </button>
              <button
                onClick={cycleTableTheme}
                title={`Table: ${tableTheme?.label} — click to cycle`}
                className="hover:brightness-125 transition-all"
                style={{ background: 'rgba(8,8,12,0.85)', border: '1px solid rgba(201,168,76,0.25)',
                  borderRadius: '0.75rem', cursor: 'pointer', padding: '8px 14px',
                  display: 'flex', alignItems: 'center', gap: 7 }}
              >
                <span style={{ fontSize: 18, lineHeight: 1 }}>🎴</span>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#c9a84c' }}>
                  {tableTheme?.label}
                </span>
              </button>
              <button
                onClick={toggleFourColor}
                title={fourColor ? 'Four-color suits: ON' : 'Four-color suits: OFF'}
                className="hover:brightness-125 transition-all font-bold"
                style={{ background: 'rgba(8,8,12,0.85)', border: `1px solid ${fourColor ? '#3b82f6' : '#2a2a38'}`,
                  color: fourColor ? '#3b82f6' : '#4a4a5a',
                  borderRadius: '0.75rem', padding: '8px 12px', fontSize: 18, lineHeight: 1, cursor: 'pointer' }}
              >
                ♦
              </button>
              {/* Mobile-only: score panel toggle */}
              <button
                onClick={() => setScorePanelOpen(o => !o)}
                title="Score & Chat"
                className="hover:brightness-125 transition-all md:hidden"
                style={{ background: 'rgba(8,8,12,0.85)', border: '1px solid #2a2a38', color: '#c9a84c',
                  borderRadius: '0.75rem', padding: '8px 12px', fontSize: 18, lineHeight: 1, cursor: 'pointer' }}
              >
                📊
              </button>
            </div>
          )}
        </div>

        {/* Trump card — anchored to outer div corner so it's always bottom-right of full play area */}
        {inGame && gs.trump && (
          <div className="absolute bottom-4 right-4 z-20 select-none flex flex-col items-center gap-1 pointer-events-none">
            {gs.trumpCard
              ? <Card cardId={gs.trumpCard} />
              : gs.trump === 'NO_TRUMP'
                ? <span style={{ fontSize: '64px', lineHeight: 1 }}>🃏</span>
                : <span className="font-black" style={{ fontSize: '64px', lineHeight: 1, color: trumpColor }}>{trumpLabel}</span>
            }
            {gs.trumpCard && (
              <span className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>{t('trump_label')}</span>
            )}
          </div>
        )}

        {/* Dev debug panel */}
        {import.meta.env.DEV && (
          <div className="absolute top-4 right-4 z-50">
            <AdminPanel socket={socket} roomId={gameState?.roomId} />
          </div>
        )}

        {/* Player stats popup */}
        {statsPopup && (
          <div
            className="absolute inset-0 z-40 flex items-center justify-center"
            onClick={() => setStatsPopup(null)}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background:   'rgba(8,8,12,0.97)',
                border:       '1px solid rgba(201,168,76,0.35)',
                borderRadius: '1rem',
                padding:      '20px 28px',
                minWidth:     220,
                textAlign:    'center',
              }}
            >
              <div style={{ color: '#c9a84c', fontSize: 15, fontWeight: 900, marginBottom: 4 }}>
                {statsPopup.player.name}
              </div>
              {statsPopup.loading ? (
                <div style={{ color: '#3a3a4a', fontSize: 12, padding: '12px 0' }}>…</div>
              ) : statsPopup.data ? (
                <div style={{ marginTop: 10 }}>
                  {[
                    [t('stats_games'),    statsPopup.data.games_played],
                    [t('stats_win_rate'), `${statsPopup.data.win_rate}%`],
                    [t('stats_bid_acc'),  `${statsPopup.data.bid_accuracy}%`],
                    [t('stats_score'),    (statsPopup.data.total_score / 100).toFixed(1)],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 20, marginBottom: 5 }}>
                      <span style={{ color: '#4a4a5a', fontSize: 11 }}>{label}</span>
                      <span style={{ color: '#e8d5a3', fontSize: 11, fontWeight: 700 }}>{val}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#3a3a4a', fontSize: 11, padding: '10px 0' }}>{t('stats_no_games')}</div>
              )}
              {user && statsPopup.player.userId && statsPopup.player.userId !== user.id && (
                <button
                  onClick={() => {
                    const uid = statsPopup.player.userId
                    if (blockDone[uid]) return
                    fetch(`${API_URL}/api/blocked`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('joker_token')}` },
                      body: JSON.stringify({ blockedId: uid }),
                    }).then(() => setBlockDone(b => ({ ...b, [uid]: true }))).catch(() => {})
                  }}
                  style={{
                    marginTop: 8, width: '100%', padding: '6px 0',
                    background: blockDone[statsPopup.player.userId] ? '#1a1a2a' : '#2a1a1a',
                    color: blockDone[statsPopup.player.userId] ? '#3a3a4a' : '#e05252',
                    border: 'none', borderRadius: '0.5rem', fontSize: 11, cursor: 'pointer', fontWeight: 700,
                  }}
                >
                  {blockDone[statsPopup.player.userId] ? t('friends_block') + ' ✓' : t('friends_block')}
                </button>
              )}
              <button
                onClick={() => setStatsPopup(null)}
                style={{ marginTop: 8, color: '#3a3a4a', background: 'none', border: 'none', fontSize: 11, cursor: 'pointer' }}
              >
                {t('joker_cancel')}
              </button>
            </div>
          </div>
        )}

        {/* Overlays — absolute inset-0 inside the relative play area, so they never cover the scoreboard */}
        {atuzovka          && <AtuzovkaOverlay data={atuzovka} players={players} myIndex={myIndex} />}
        {jokerAnnouncement && <JokerAnnouncementOverlay data={jokerAnnouncement} />}
        {gameAnnouncement  && <GameAnnouncementOverlay data={gameAnnouncement} />}
        {roundEndData      && <RoundEndOverlay data={roundEndData} players={players} />}

        {/* Game-end stats modal */}
        {gs.phase === 'game_end' && gameEndStats && (() => {
          const finalScores = gameEndStats.finalScores ?? {}
          const tokenDeltas = gameEndStats.tokenDeltas ?? {}
          const computedStats = players.map(p => {
            const rounds = roundHistory.filter(r => r.bids?.[p.id] != null)
            const exactBids = rounds.filter(r => r.bids[p.id] === (r.tricks?.[p.id] ?? -1)).length
            const hishts    = rounds.filter(r => (r.scores?.[p.id] ?? 0) < 0).length
            return { ...p, score: finalScores[p.id] ?? 0, exactBids, hishts, totalBids: rounds.length, tokenDelta: tokenDeltas[p.id] ?? null }
          })
          return (
            <GameEndModal
              stats={computedStats}
              players={players}
              myPlayerId={myPlayerId ?? playerId}
              roomId={gameState?.roomId}
              onPlayAgain={!isSpectator ? onPlayAgain : null}
              onLeaveGame={onLeaveGame}
              playInPairs={gameEndStats?.playInPairs ?? playInPairs}
              isRanked={gameEndStats?.isRanked ?? false}
            />
          )
        })()}
      </div>

      {/* Mobile score-panel backdrop */}
      {scorePanelOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setScorePanelOpen(false)}
        />
      )}

      {/* Score panel */}
      <ScorePanel
        players={players}
        roundHistory={roundHistory}
        pulkaNumber={gs.pulkaNumber}
        roundNumber={gs.roundNumber}
        roomId={gameState.roomId}
        trump={gs.trump}
        lastTrick={lastTrick}
        gameScores={gs.gameScores}
        currentBids={gs.bids}
        gameLog={gameLog}
        dealerPlayerId={dealerPlayerId}
        initialDealerPlayerId={initialDealerPlayerId}
        chatMessages={chatMessages}
        onSendChat={onSendChat}
        theme={theme}
        onToggleTheme={onToggleTheme}
        myPlayerId={myPlayerId ?? playerId}
        hishtPenalty={hishtPenalty}
        gameMode={gameMode}
        mobileOpen={scorePanelOpen}
        onMobileClose={() => setScorePanelOpen(false)}
        trickWinnerId={trickWinnerId}
      />

      {/* Bot-substitution overlay — fixed to viewport so nothing can cover it */}
      {iAmSubstituted && !isSpectator && (
        <div
          style={{
            position:       'fixed',
            inset:          0,
            zIndex:         9999,
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            justifyContent: 'center',
            background:     'rgba(0,0,0,0.78)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <div
            style={{
              background:   'rgba(8,8,12,0.98)',
              border:       '2px solid rgba(201,168,76,0.6)',
              borderRadius: '1.5rem',
              padding:      '36px 52px',
              textAlign:    'center',
              boxShadow:    '0 12px 60px rgba(0,0,0,0.8)',
              maxWidth:     340,
            }}
          >
            <div style={{ fontSize: 44, marginBottom: 14 }}>🤖</div>
            <div style={{ color: 'rgba(201,168,76,0.9)', fontSize: 16, fontWeight: 700, letterSpacing: '0.05em', marginBottom: 8 }}>
              {t('bot_substituting')}
            </div>
            <div style={{ color: '#4a4a5a', fontSize: 12, marginBottom: 28 }}>
              {t('reclaim_hint')}
            </div>
            <button
              onClick={() => {
                // Optimistic: clear overlay immediately so the player isn't stuck
                setIAmSubstituted(false)
                // Tell the server — unsubstitutes + cancels pending bot turn + returns fresh hand
                socket?.emit('reclaim_control', {}, (res) => {
                  if (Array.isArray(res?.cards)) setHand(res.cards)
                })
                // Fallback: also fetch hand in case callback is slow
                socket?.emit('get_hand', { roomId: gameState?.roomId, playerId }, (res) => {
                  if (res?.success && Array.isArray(res.cards)) setHand(res.cards)
                })
              }}
              style={{
                padding:       '16px 44px',
                borderRadius:  '0.875rem',
                background:    'linear-gradient(135deg,#c9a84c,#a8893d)',
                color:         '#0a0a0f',
                fontWeight:    800,
                fontSize:      16,
                border:        'none',
                cursor:        'pointer',
                letterSpacing: '0.04em',
                boxShadow:     '0 4px 20px rgba(201,168,76,0.45)',
                width:         '100%',
              }}
            >
              {t('reclaim_control')}
            </button>
          </div>
        </div>
      )}

      {/* Leave confirmation modal */}
      {leaveConfirm && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 9999,
                   display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setLeaveConfirm(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#10141f', border: '1px solid #2a3450', borderRadius: '1.25rem',
                     padding: '32px 28px', maxWidth: 340, width: '90%', textAlign: 'center',
                     boxShadow: '0 16px 64px rgba(0,0,0,0.8)' }}
          >
            <div style={{ fontSize: 36, marginBottom: 12 }}>🚪</div>
            <div style={{ color: '#e8e0cc', fontSize: 17, fontWeight: 700, marginBottom: 8 }}>
              {t('leave_confirm_title')}
            </div>
            <div style={{ color: '#5a6480', fontSize: 13, marginBottom: 28 }}>
              {t('leave_confirm_body')}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setLeaveConfirm(false)}
                style={{ flex: 1, padding: '12px 0', borderRadius: '0.75rem', border: '1px solid #2a3450',
                         background: 'transparent', color: '#8888a8', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                {t('cancel')}
              </button>
              <button
                onClick={() => { setLeaveConfirm(false); onLeaveGame?.() }}
                style={{ flex: 1, padding: '12px 0', borderRadius: '0.75rem', border: 'none',
                         background: '#c0392b', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
              >
                {t('leave_confirm_yes')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
