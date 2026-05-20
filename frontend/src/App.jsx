import React, { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import GameRoom from './components/GameRoom'
import Lobby from './components/Lobby'
import RematchToast from './components/overlays/RematchToast'
import RoomInviteToast from './components/overlays/RoomInviteToast'
import DailyBonusModal from './components/overlays/DailyBonusModal'
import Cabinet from './components/Cabinet'
import CardPreview from './components/CardPreview'
import './index.css'
import { playCardPlayed, playBidPlaced, playTrickWon, playHisht, playGameOver } from './sounds'
import ThemeToggle, { useTheme } from './components/ThemeToggle'
import LangToggle from './components/LangToggle'
import { usePrefs } from './context/PrefsContext'
import { useAuth } from './context/AuthContext'
import { useT } from './context/LangContext'

function saveSession(playerId, roomId, playerName) {
  localStorage.setItem('joker_session', JSON.stringify({ playerId, roomId, playerName }))
}
function clearSession() {
  localStorage.removeItem('joker_session')
}

export default function App() {
  const { user } = useAuth()
  const t = useT()
  const [theme, setTheme] = useTheme()
  const { fourColor, toggleFourColor } = usePrefs()
  const [dailyBonus,   setDailyBonus]   = useState(null)
  const [cabinetOpen,     setCabinetOpen]     = useState(false)
  const [devPreviewOpen,  setDevPreviewOpen]  = useState(false)
  const [socket,       setSocket]       = useState(null)
  const [gameState,    setGameState]    = useState(null)
  const [playerId,     setPlayerId]     = useState(null)
  const [isSpectator,  setIsSpectator]  = useState(false)
  const [roundHistory,   setRoundHistory]   = useState([])
  const [lastTrick,      setLastTrick]      = useState(null)
  const [atuzovka,       setAtuzovka]       = useState(null)
  const [trickWinnerId,  setTrickWinnerId]  = useState(null)
  const [isCollecting,   setIsCollecting]   = useState(false)
  const [dealerPlayerId,    setDealerPlayerId]    = useState(null)
  const [gameAnnouncement,  setGameAnnouncement]  = useState(null)
  const [firstPlayerId,     setFirstPlayerId]     = useState(null)
  const [gameLog,           setGameLog]           = useState([])
  const [turnTimer,            setTurnTimer]            = useState(null)  // { playerId, endsAt }
  const [countdown,            setCountdown]            = useState(null)  // seconds, only when ≤ 10
  const [initialDealerPlayerId, setInitialDealerPlayerId] = useState(null)
  const [chatMessages,         setChatMessages]         = useState([])
  const [isMuted,              setIsMuted]              = useState(() => localStorage.getItem('joker_muted') === '1')
  const [gameEndStats,         setGameEndStats]         = useState(null)  // { finalScores, players, roundHistory }
  const [rematchInvite,        setRematchInvite]        = useState(null)  // { inviterName, newRoomId }
  const [roomInvite,           setRoomInvite]           = useState(null)  // { roomId, inviterName }
  const [inQueue,    setInQueue]    = useState(false)
  const [queueMode,  setQueueMode]  = useState('normal')
  const [resetToken,           setResetToken]           = useState(() => new URLSearchParams(window.location.search).get('reset_token'))
  const [resetPassword,        setResetPassword]        = useState('')
  const [resetError,           setResetError]           = useState('')
  const [resetDone,            setResetDone]            = useState(false)
  const [resetBusy,            setResetBusy]            = useState(false)
  const [onlineMap,            setOnlineMap]            = useState({})     // userId → true
  const [lobbyMessages,        setLobbyMessages]        = useState([])
  const [lobbyChatOpen,        setLobbyChatOpen]        = useState(false)
  const [autoStartAt,          setAutoStartAt]          = useState(null)  // Date.now() + ms when room auto-starts
  const [jokerAnnouncement,    setJokerAnnouncement]    = useState(null)  // { playerName, mode, suit }
  const [roundEndData,         setRoundEndData]         = useState(null)  // round_ended payload
  const currentTrickRef        = useRef([])
  const isCollectingRef        = useRef(false)
  const trickTimer1            = useRef(null)
  const trickTimer2            = useRef(null)
  const trickSeqRef            = useRef(0)
  const playersRef             = useRef([])
  const jokerAnnouncementTimer = useRef(null)
  const roundEndTimer          = useRef(null)
  const isMutedRef             = useRef(localStorage.getItem('joker_muted') === '1')

  useEffect(() => {
    isMutedRef.current = isMuted
    localStorage.setItem('joker_muted', isMuted ? '1' : '0')
  }, [isMuted])

  const sound = (fn) => { if (!isMutedRef.current) fn() }

  const addLog = (text) => {
    setGameLog(prev => [...prev, { id: Date.now() + Math.random(), text }].slice(-10))
  }

  const playerName = (id) => playersRef.current.find(p => p.id === id)?.name ?? '?'

  // Claim daily bonus once per session when user is authenticated
  useEffect(() => {
    if (!user?.id) return
    const token = localStorage.getItem('joker_token')
    if (!token) return
    fetch('/api/auth/daily-bonus', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.claimed) setDailyBonus(data) })
      .catch(() => {})
  }, [user?.id])

  useEffect(() => {
    const socketUrl = import.meta.env.VITE_SOCKET_URL ?? ''
    const s = io(socketUrl, {
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
    })

    s.on('heartbeat', () => s.emit('heartbeat_ack'))

    s.on('connect', () => {
      // Re-authenticate social identity on (re)connect
      const token = localStorage.getItem('joker_token')
      if (token) s.emit('authenticate', token)

      const session = JSON.parse(localStorage.getItem('joker_session') || 'null')
      if (!session) return
      s.emit('rejoin_game', { playerId: session.playerId, roomId: session.roomId }, (res) => {
        if (res.success) {
          playersRef.current = res.players
          setPlayerId(res.playerId)
          setGameState({
            roomId:              res.roomId,
            players:             res.players,
            hishtPenalty:        res.hishtPenalty        ?? '200',
            gameMode:            res.gameMode            ?? 'normal',
            playInPairs:         res.playInPairs         ?? false,
            deductions:          res.deductions          ?? true,
            multiPremiaDeduction:res.multiPremiaDeduction ?? false,
            lastBidUntouchable:  res.lastBidUntouchable  ?? true,
            ...(res.gameState ? { gameState: res.gameState } : {}),
          })
          setRoundHistory(res.roundHistory ?? [])
          setChatMessages(res.chatHistory ?? [])
          if (res.gameState?.dealerPlayerId) setDealerPlayerId(res.gameState.dealerPlayerId)
          // Seed the trick ref so the next card_played appends to the correct base
          currentTrickRef.current = res.gameState?.currentTrick ?? []
        } else {
          clearSession()
          if (res.error === 'Room not found') {
            alert('Your game session was lost — the server may have restarted. Please start a new game.')
          }
        }
      })
    })

    s.on('atuzovka_result', (data) => {
      setAtuzovka(data)
      setInitialDealerPlayerId(data.dealerPlayerId)
      const dismissAfter = (data.drawnCards?.length ?? 4) * 400 + 3500
      setTimeout(() => setAtuzovka(null), dismissAfter)
    })

    s.on('game_started', (data) => {
      clearTimeout(trickTimer1.current); clearTimeout(trickTimer2.current)
      trickSeqRef.current++
      setAutoStartAt(null)
      setGameState(prev => prev ? { ...prev, gameState: data.gameState } : prev)
      setRoundHistory([])
      setLastTrick(null)
      setTrickWinnerId(null)
      setIsCollecting(false)
      isCollectingRef.current = false
      setDealerPlayerId(null)
      setFirstPlayerId(null)
      setGameLog([])
      currentTrickRef.current = []
    })

    s.on('round_started', (data) => {
      clearTimeout(trickTimer1.current); clearTimeout(trickTimer2.current)
      trickSeqRef.current++
      setTrickWinnerId(null)
      setIsCollecting(false)
      isCollectingRef.current = false
      currentTrickRef.current = []
      if (data.dealerPlayerId) setDealerPlayerId(data.dealerPlayerId)
      addLog(`── Round ${data.roundNumber} (P${data.pulkaNumber}) ──`)
      setGameState(prev => prev ? ({
        ...prev,
        gameState: {
          ...prev.gameState,
          phase:           data.phase ?? 'bidding',
          trump:           data.trump  ?? null,
          trumpCard:       data.trumpCard ?? null,
          trumpSelectorId: data.trumpSelectorId ?? null,
          roundNumber:     data.roundNumber,
          pulkaNumber:     data.pulkaNumber ?? prev.gameState?.pulkaNumber,
          currentTrick:    [],
          bids:            {},
          tricksCounts:    {},
          currentBidder:   data.currentBidder ?? null,
        },
      }) : prev)
    })

    s.on('trump_selected', (data) => {
      setGameState(prev => prev ? ({
        ...prev,
        gameState: {
          ...prev.gameState,
          phase:           'bidding',
          trump:           data.trump,
          trumpCard:       data.trumpCard ?? null,
          trumpSelectorId: null,
          currentBidder:   data.currentBidder ?? null,
        },
      }) : prev)
    })

    s.on('bid_placed', (data) => {
      addLog(`${playerName(data.playerId)} bid ${data.bid}`)
      sound(playBidPlaced)
      setGameState(prev => prev ? ({
        ...prev,
        gameState: { ...prev.gameState, bids: data.allBids, currentBidder: data.currentBidder ?? null },
      }) : prev)
    })

    s.on('bidding_complete', (data) => {
      setFirstPlayerId(data.currentPlayer)
      setGameState(prev => prev ? ({
        ...prev,
        gameState: {
          ...prev.gameState,
          phase:         'playing',
          currentPlayer: data.currentPlayer,
          bids:          data.bids,
          cardsInRound:  data.cardsInRound,
        },
      }) : prev)

      if (data.cardsInRound != null) {
        const totalBids = Object.values(data.bids).reduce((s, b) => s + (b ?? 0), 0)
        const diff = data.cardsInRound - totalBids
        setGameAnnouncement({ type: diff > 0 ? 'shetenva' : 'tsaglejva', diff: Math.abs(diff) })
        setTimeout(() => setGameAnnouncement(null), 3000)
      }
    })

    s.on('player_joined', (data) => {
      playersRef.current = data.players
      setGameState(prev => prev ? { ...prev, players: data.players } : prev)
    })

    s.on('player_ready', (data) => {
      playersRef.current = data.players
      setGameState(prev => prev ? { ...prev, players: data.players } : prev)
    })

    s.on('room_full', (data) => {
      setAutoStartAt(Date.now() + (data.autoStartIn ?? 10) * 1000)
    })

    s.on('card_played', (data) => {
      // Server sends authoritative trick snapshot for in-progress tricks (null when trick just completed)
      const serverTrick = data.currentTrick ?? null

      // Detect first card of a new trick:
      //   - server says length=1 (fresh start), OR
      //   - no server snapshot but ref is empty (old path) or has stale 4-card trick
      const isFirstCard = serverTrick
        ? serverTrick.length === 1
        : currentTrickRef.current.length === 0 || currentTrickRef.current.length >= 4

      // Abort previous animation if collecting was active OR new trick detected while ref had stale data
      if (isCollectingRef.current || (!serverTrick && currentTrickRef.current.length >= 4)) {
        trickSeqRef.current++
        clearTimeout(trickTimer1.current)
        clearTimeout(trickTimer2.current)
        isCollectingRef.current = false
        setIsCollecting(false)
        setTrickWinnerId(null)
        currentTrickRef.current = []
      } else if (isFirstCard) {
        // Cancel any stale timers from the previous trick
        trickSeqRef.current++
        clearTimeout(trickTimer1.current)
        clearTimeout(trickTimer2.current)
        setTrickWinnerId(null)
        setIsCollecting(false)
        isCollectingRef.current = false
      }

      // Log the play
      if (data.jokerMode && data.jokerMode !== 'NORMAL') {
        const suit = data.takeSuit ?? data.giveSuit ?? ''
        addLog(`${playerName(data.playerId)} 🃏 ${data.jokerMode}${suit ? ' ' + suit : ''}`)
        clearTimeout(jokerAnnouncementTimer.current)
        setJokerAnnouncement({
          playerName: playerName(data.playerId),
          mode:       data.jokerMode,
          suit:       data.takeSuit ?? data.giveSuit ?? null,
        })
        jokerAnnouncementTimer.current = setTimeout(() => setJokerAnnouncement(null), 2000)
      } else {
        addLog(`${playerName(data.playerId)} played ${data.card}`)
      }
      sound(playCardPlayed)

      // Use server's authoritative trick if available; otherwise accumulate locally
      if (serverTrick) {
        currentTrickRef.current = serverTrick
      } else {
        const entry = { playerId: data.playerId, card: data.card, jokerMode: data.jokerMode || null, takeSuit: data.takeSuit || null, giveSuit: data.giveSuit || null }
        currentTrickRef.current = [...currentTrickRef.current, entry]
      }
      const snapshot = currentTrickRef.current

      setGameState(prev => prev ? ({
        ...prev,
        gameState: {
          ...prev.gameState,
          currentPlayer: data.currentPlayer,
          currentTrick:  snapshot,
        },
      }) : prev)
    })

    s.on('trick_resolved', (data) => {
      clearTimeout(trickTimer1.current)
      clearTimeout(trickTimer2.current)

      addLog(`${playerName(data.winnerId)} ← trick`)
      // Use authoritative server cards so a missed card_played still shows correctly
      const trickCards = (data.trickCards?.length === 4) ? data.trickCards : currentTrickRef.current
      currentTrickRef.current = trickCards
      setLastTrick({ cards: trickCards, winnerId: data.winnerId })
      setTrickWinnerId(data.winnerId)
      isCollectingRef.current = false
      setIsCollecting(false)
      setGameState(prev => prev ? ({
        ...prev,
        gameState: {
          ...prev.gameState,
          tricksCounts:  data.tricksCounts,
          currentPlayer: data.currentPlayer,
          currentTrick:  trickCards,
        },
      }) : prev)

      const seq = ++trickSeqRef.current

      sound(playTrickWon)

      // Phase 1 (1500ms): all 4 cards visible, winner highlighted → begin collect animation
      trickTimer1.current = setTimeout(() => {
        if (trickSeqRef.current !== seq) return
        isCollectingRef.current = true
        setIsCollecting(true)
      }, 1500)

      // Phase 2 (2200ms): clear everything
      trickTimer2.current = setTimeout(() => {
        if (trickSeqRef.current !== seq) return
        currentTrickRef.current = []
        isCollectingRef.current = false
        setTrickWinnerId(null)
        setIsCollecting(false)
        setGameState(prev => prev ? ({
          ...prev,
          gameState: { ...prev.gameState, currentTrick: [] },
        }) : prev)
      }, 2200)
    })

    s.on('round_ended', (data) => {
      setRoundHistory(prev => [...prev, data])
      if (data.gameScores) {
        setGameState(prev => prev ? ({
          ...prev,
          gameState: { ...prev.gameState, gameScores: data.gameScores },
        }) : prev)
      }
      if (data.scores && Object.values(data.scores).some(v => v < 0)) {
        sound(playHisht)
      }
      // Show round-end overlay
      clearTimeout(roundEndTimer.current)
      setRoundEndData(data)
      roundEndTimer.current = setTimeout(() => setRoundEndData(null), 3500)
    })

    s.on('turn_timer_started', (data) => {
      setTurnTimer(data)
    })

    s.on('turn_timer_cancelled', () => {
      setTurnTimer(null)
      setCountdown(null)
    })

    s.on('player_substituted', (data) => {
      setTurnTimer(null)
      setCountdown(null)
      const reason = data.reason === 'disconnected' ? 'disconnected' : 'inactive'
      addLog(`🤖 Bot filling in for ${playerName(data.playerId)} (${reason})`)
    })

    s.on('player_resumed', (data) => {
      addLog(`${playerName(data.playerId)} is back`)
    })


    s.on('rematch_invite', (data) => {
      setRematchInvite(data)
    })

    s.on('room_invite', (data) => {
      setRoomInvite(data)
    })

    s.on('queue_matched', (data) => {
      setInQueue(false)
      if (!data?.success) return
      const name = data.players?.find(p => p.id === data.playerId)?.name ?? ''
      saveSession(data.playerId, data.roomId, name)
      playersRef.current = data.players
      setPlayerId(data.playerId)
      setIsSpectator(false)
      setGameState({
        roomId: data.roomId, players: data.players,
        hishtPenalty: data.hishtPenalty ?? '200', gameMode: data.gameMode ?? 'normal',
        playInPairs: data.playInPairs ?? false, deductions: data.deductions ?? true,
        multiPremiaDeduction: data.multiPremiaDeduction ?? false,
        lastBidUntouchable: data.lastBidUntouchable ?? true,
        isRanked: data.isRanked ?? false,
      })
      setRoundHistory([])
    })
    s.on('queue_cancelled', () => { setInQueue(false) })

    // ── Social listeners ───────────────────────────────────────────────────────
    s.on('friend_online',  ({ userId })           => setOnlineMap(m => ({ ...m, [userId]: true })))
    s.on('friend_offline', ({ userId })           => setOnlineMap(m => { const n = { ...m }; delete n[userId]; return n }))
    s.on('friend_request_received', () => { /* future: show notification badge */ })
    s.on('lobby_history', (msgs) => setLobbyMessages(msgs))
    s.on('lobby_message', (msg)  => setLobbyMessages(prev => [...prev, msg].slice(-50)))

    s.on('game_ended', (data) => {
      clearSession()
      sound(playGameOver)
      setGameState(prev => {
        if (!prev) return prev
        setGameEndStats({
          finalScores:  data.finalScores,
          players:      prev.players ?? [],
          playInPairs:  data.playInPairs ?? false,
          tokenDeltas:  data.tokenDeltas ?? {},
          isRanked:     data.isRanked ?? false,
        })
        return { ...prev, gameState: { ...prev.gameState, phase: 'game_end', gameScores: data.finalScores } }
      })
    })

    s.on('state_sync', (data) => {
      if (data.gameState) {
        if (Array.isArray(data.gameState.currentTrick)) {
          currentTrickRef.current = data.gameState.currentTrick
        }
        setGameState(prev => prev ? ({
          ...prev,
          players:   data.players ?? prev.players,
          gameState: { ...prev.gameState, ...data.gameState },
        }) : prev)
      }
    })

    s.on('chat_message', (entry) => {
      setChatMessages(prev => [...prev, entry].slice(-100))
    })

    s.on('kicked', () => {
      clearSession()
      setPlayerId(null)
      setIsSpectator(false)
      setGameState(null)
      setRoundHistory([])
      setLastTrick(null)
      setGameLog([])
      setChatMessages([])
      setGameEndStats(null)
      // t() not captured in closure — show fixed EN string
      alert('You were kicked from the room by the host.')
    })

    setSocket(s)
    return () => s.close()
  }, [])

  // Re-authenticate and join lobby socket room on login or reconnect
  useEffect(() => {
    if (!socket) return
    const token = localStorage.getItem('joker_token')
    if (token) socket.emit('authenticate', token)
    socket.emit('lobby_join')
  }, [user?.id, socket])

  useEffect(() => {
    if (!turnTimer) { setCountdown(null); return }
    const tick = () => {
      const rem = Math.ceil((turnTimer.endsAt - Date.now()) / 1000)
      setCountdown(rem <= 10 ? Math.max(0, rem) : null)
    }
    tick()
    const id = setInterval(tick, 300)
    return () => clearInterval(id)
  }, [turnTimer])

  const handleCreateGame = (name, password = null, settings = {}) => {
    if (!socket) return
    const {
      hishtPenalty         = '200',
      gameMode             = 'normal',
      playInPairs          = false,
      deductions           = true,
      multiPremiaDeduction = false,
      lastBidUntouchable   = true,
      isRanked             = false,
    } = settings
    socket.emit('create_game', {
      playerName: name, password, userId: user?.id ?? null,
      hishtPenalty, gameMode, playInPairs, deductions, multiPremiaDeduction, lastBidUntouchable, isRanked,
    }, (res) => {
      if (res.success) {
        saveSession(res.playerId, res.roomId, name)
        playersRef.current = res.players
        setPlayerId(res.playerId)
        setGameState({
          roomId: res.roomId, players: res.players,
          hishtPenalty: res.hishtPenalty ?? '200', gameMode: res.gameMode ?? 'normal',
          playInPairs: res.playInPairs ?? false, deductions: res.deductions ?? true,
          multiPremiaDeduction: res.multiPremiaDeduction ?? false, lastBidUntouchable: res.lastBidUntouchable ?? true,
          isRanked: res.isRanked ?? false,
        })
        setRoundHistory([])
      } else {
        alert(res.error)
      }
    })
  }

  const handleJoinGame = (roomId, name, password = null) => {
    if (!socket) return
    socket.emit('join_game', { roomId, playerName: name, password, userId: user?.id ?? null }, (res) => {
      if (res.success) {
        saveSession(res.playerId, res.roomId, name)
        playersRef.current = res.players
        setPlayerId(res.playerId)
        setIsSpectator(false)
        setGameState({ roomId, players: res.players, hishtPenalty: res.hishtPenalty ?? '200', gameMode: res.gameMode ?? 'normal', playInPairs: res.playInPairs ?? false, deductions: res.deductions ?? true, multiPremiaDeduction: res.multiPremiaDeduction ?? false, lastBidUntouchable: res.lastBidUntouchable ?? true, isRanked: res.isRanked ?? false })
        setRoundHistory([])
      } else {
        alert(res.error)
      }
    })
  }

  const handleJoinCallback = (res) => {
    if (!res?.success) return
    const name = res.players?.find(p => p.id === res.playerId)?.name ?? ''
    saveSession(res.playerId, res.roomId, name)
    playersRef.current = res.players
    setPlayerId(res.playerId)
    setIsSpectator(false)
    setGameState({
      roomId: res.roomId, players: res.players,
      hishtPenalty: res.hishtPenalty ?? '200', gameMode: res.gameMode ?? 'normal',
      playInPairs: res.playInPairs ?? false, deductions: res.deductions ?? true,
      multiPremiaDeduction: res.multiPremiaDeduction ?? false, lastBidUntouchable: res.lastBidUntouchable ?? true,
      isRanked: res.isRanked ?? false,
    })
    setRoundHistory([])
    setGameEndStats(null)
  }

  const handleQuickStartWithBots = (name, gameMode = 'normal') => {
    if (!socket) return
    socket.emit('create_game', {
      playerName: name, password: null, userId: user?.id ?? null,
      hishtPenalty: '200', gameMode, playInPairs: false,
      deductions: true, multiPremiaDeduction: false, lastBidUntouchable: true, isRanked: false,
    }, (res) => {
      if (!res.success) { alert(res.error); return }
      saveSession(res.playerId, res.roomId, name)
      playersRef.current = res.players
      setPlayerId(res.playerId)
      setGameState({
        roomId: res.roomId, players: res.players,
        hishtPenalty: res.hishtPenalty ?? '200', gameMode: res.gameMode ?? 'normal',
        playInPairs: res.playInPairs ?? false, deductions: res.deductions ?? true,
        multiPremiaDeduction: res.multiPremiaDeduction ?? false,
        lastBidUntouchable: res.lastBidUntouchable ?? true,
        isRanked: false,
      })
      setRoundHistory([])
      socket.emit('add_bot', {})
      socket.emit('add_bot', {})
      socket.emit('add_bot', {})
      socket.emit('ready_to_play', {})
    })
  }

  const handleJoinQueue = (name, gameMode, isRanked) => {
    if (!socket) return
    setInQueue(true)
    setQueueMode(gameMode)
    socket.emit('join_queue', { playerName: name, userId: user?.id ?? null, gameMode, isRanked })
  }

  const handleLeaveQueue = () => {
    socket?.emit('leave_queue')
    setInQueue(false)
  }

  const handleSpectateGame = (roomId, onError) => {
    if (!socket) { onError?.('Not connected yet — try again in a moment'); return }
    socket.emit('spectate_game', { roomId }, (res) => {
      if (res.success) {
        playersRef.current = res.players
        setPlayerId(null)
        setIsSpectator(true)
        if (res.gameState?.dealerPlayerId) setDealerPlayerId(res.gameState.dealerPlayerId)
        setGameState({
          roomId:              res.roomId,
          players:             res.players,
          hishtPenalty:        res.hishtPenalty        ?? '200',
          gameMode:            res.gameMode            ?? 'normal',
          playInPairs:         res.playInPairs         ?? false,
          deductions:          res.deductions          ?? true,
          multiPremiaDeduction:res.multiPremiaDeduction ?? false,
          lastBidUntouchable:  res.lastBidUntouchable  ?? true,
          ...(res.gameState ? { gameState: res.gameState } : {}),
        })
        setRoundHistory(res.roundHistory ?? [])
        setChatMessages(res.chatHistory ?? [])
        // Seed the trick ref so the next card_played appends to the correct base
        currentTrickRef.current = res.gameState?.currentTrick ?? []
      } else {
        onError?.(res.error)
      }
    })
  }

  // Handle ?room=CODE invite links — auto-open join panel in Lobby
  const inviteRoomCode = (() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('room')?.toUpperCase() ?? null
  })()

  const handleLeaveGame = () => {
    // Tell server to leave the room and stop broadcasts before clearing local state
    socket?.emit('leave_game')
    clearSession()
    setPlayerId(null)
    setIsSpectator(false)
    setGameState(null)
    setRoundHistory([])
    setLastTrick(null)
    setGameLog([])
    setChatMessages([])
    setGameEndStats(null)
  }

  const handlePlayAgain = () => {
    const settings = {
      hishtPenalty:         gameState?.hishtPenalty         ?? '200',
      gameMode:             gameState?.gameMode             ?? 'normal',
      playInPairs:          gameState?.playInPairs          ?? false,
      deductions:           gameState?.deductions           ?? true,
      multiPremiaDeduction: gameState?.multiPremiaDeduction ?? false,
      lastBidUntouchable:   gameState?.lastBidUntouchable   ?? true,
    }
    const myName = playersRef.current.find(p => p.id === playerId)?.name
    handleLeaveGame()
    if (myName && socket) {
      setTimeout(() => handleCreateGame(myName, null, settings), 30)
    }
  }

  const handleRematch = () => {
    const prevRoomId = gameState?.roomId
    const settings = {
      hishtPenalty:         gameState?.hishtPenalty         ?? '200',
      gameMode:             gameState?.gameMode             ?? 'normal',
      playInPairs:          gameState?.playInPairs          ?? false,
      deductions:           gameState?.deductions           ?? true,
      multiPremiaDeduction: gameState?.multiPremiaDeduction ?? false,
      lastBidUntouchable:   gameState?.lastBidUntouchable   ?? true,
    }
    const myName = playersRef.current.find(p => p.id === playerId)?.name
    if (!myName || !socket) return
    socket.emit('request_rematch', { playerName: myName, userId: user?.id ?? null, settings, prevRoomId }, (res) => {
      if (!res?.success) return
      handleLeaveGame()
      handleJoinCallback(res)
    })
  }

  const handleAcceptRematch = (newRoomId) => {
    setRematchInvite(null)
    const myName = playersRef.current.find(p => p.id === playerId)?.name
      || localStorage.getItem('joker_last_name')
      || 'Player'
    if (!socket) return
    socket.emit('join_game', { roomId: newRoomId, playerName: myName, userId: user?.id ?? null }, (res) => {
      if (!res?.success) return
      handleJoinCallback(res)
    })
  }

  const handleKickPlayer = (targetId) => {
    if (!socket || !gameState) return
    socket.emit('kick_player', { targetId }, (res) => {
      if (!res?.success) alert(res?.error ?? 'Could not kick player')
    })
  }

  const handleSendChat = (message) => {
    if (!socket || !gameState) return
    socket.emit('send_chat', {
      roomId:   gameState.roomId,
      playerId: playerId ?? null,
      message,
    })
  }

  const handleToggleMute = () => setIsMuted(m => !m)


  const [isPortraitMobile, setIsPortraitMobile] = useState(
    () => window.innerWidth < window.innerHeight && window.innerWidth < 600
  )
  useEffect(() => {
    const handler = () => setIsPortraitMobile(window.innerWidth < window.innerHeight && window.innerWidth < 600)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // Hide topBar when portrait+in-game (lang/theme live inside portrait controls bar instead)
  const inGame = !!(gameState && (playerId || isSpectator))
  const topBar = isPortraitMobile && inGame ? null : isPortraitMobile ? (
    /* Mobile lobby — minimal, icon-only, no background container */
    <div className="fixed top-2 right-3 z-50" style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      <LangToggle dropdownRight triggerStyle={{ background: 'rgba(8,8,12,0.45)', border: '1px solid rgba(37,37,48,0.3)', width: 42, height: 30, color: '#6a7a9a', borderRadius: '0.5rem' }} />
      <ThemeToggle theme={theme} onToggle={() => setTheme(th => th === 'dark' ? 'light' : 'dark')} style={{ background: 'rgba(8,8,12,0.45)', border: '1px solid rgba(37,37,48,0.3)', width: 30, height: 30, fontSize: 15, borderRadius: '0.5rem' }} />
    </div>
  ) : (
    /* Desktop — top-right, lower visual weight */
    <div className="fixed top-3 right-4 z-50" style={{ display: 'flex', alignItems: 'center', background: 'rgba(8,8,12,0.5)', border: '1px solid rgba(37,37,48,0.4)', borderRadius: '0.875rem', padding: '3px', gap: '2px' }}>
      <LangToggle dropdownRight triggerStyle={{ background: 'transparent', border: 'none', color: '#6a7a9a', width: 50, height: 34 }} />
      <ThemeToggle theme={theme} onToggle={() => setTheme(th => th === 'dark' ? 'light' : 'dark')} style={{ background: 'transparent', border: 'none', width: 34, height: 34, fontSize: 17 }} />
      <button
        onClick={toggleFourColor}
        title="Four-color suits"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 46, height: 34, padding: 0,
          borderRadius: '0.5rem',
          background: fourColor ? 'rgba(59,130,246,0.15)' : 'transparent',
          border: fourColor ? '1px solid rgba(59,130,246,0.35)' : 'none',
          cursor: 'pointer', color: fourColor ? '#3b82f6' : '#5a6a8a',
          fontSize: 14, lineHeight: 1,
        }}
      >
        <span>
          <span style={{ color: '#3a3a5a' }}>♠</span>
          <span style={{ color: '#b82020' }}>♥</span>
          <span style={{ color: fourColor ? '#3b82f6' : '#b82020' }}>♦</span>
          <span style={{ color: fourColor ? '#22c55e' : '#4a4a6a' }}>♣</span>
        </span>
      </button>
    </div>
  )

  if (!gameState || (!playerId && !isSpectator)) {
    return (
      <>
        <Lobby
          onCreateGame={handleCreateGame}
          onJoinGame={handleJoinGame}
          onSpectateGame={handleSpectateGame}
          onQuickStartWithBots={handleQuickStartWithBots}
          inQueue={inQueue}
          queueMode={queueMode}
          onJoinQueue={handleJoinQueue}
          onLeaveQueue={handleLeaveQueue}
          inviteRoomCode={inviteRoomCode}
          theme={theme}
          onOpenCabinet={() => setCabinetOpen(true)}
          onlineMap={onlineMap}
          socket={socket}
          lobbyMessages={lobbyMessages}
          lobbyChatOpen={lobbyChatOpen}
          setLobbyChatOpen={setLobbyChatOpen}
          onOpenCardPreview={() => setDevPreviewOpen(true)}
        />
        {topBar}
        {cabinetOpen && <Cabinet onClose={() => setCabinetOpen(false)} onlineMap={onlineMap} />}
        {devPreviewOpen && <CardPreview onClose={() => setDevPreviewOpen(false)} />}
        {dailyBonus && <DailyBonusModal bonus={dailyBonus} onClose={() => setDailyBonus(null)} />}
      </>
    )
  }

  const isMyTimer = turnTimer?.playerId === playerId

  const handleResetSubmit = async () => {
    if (!resetPassword.trim() || resetPassword.length < 4) { setResetError('Password must be at least 4 characters'); return }
    setResetBusy(true); setResetError('')
    try {
      const res  = await fetch('/api/auth/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, password: resetPassword }),
      })
      const data = await res.json()
      if (!res.ok) { setResetError(data.error ?? 'Invalid or expired link'); setResetBusy(false); return }
      localStorage.setItem('joker_token', data.token)
      window.history.replaceState({}, '', window.location.pathname)
      setResetDone(true)
      setTimeout(() => { setResetToken(null); setResetDone(false) }, 2500)
    } catch { setResetError('Network error') }
    setResetBusy(false)
  }

  return (
    <>
      {resetToken && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'rgba(8,8,12,0.98)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 20, padding: '40px 32px', width: 'min(92vw,400px)', textAlign: 'center' }}>
            {resetDone ? (
              <p style={{ color: '#4ade80', fontSize: 16, fontWeight: 700 }}>✓ Password updated — logging you in…</p>
            ) : (
              <>
                <h2 style={{ color: '#c9a84c', fontFamily: 'Georgia,serif', marginBottom: 24 }}>Set new password</h2>
                <input type="password" placeholder="New password" value={resetPassword} autoFocus
                  onChange={e => setResetPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleResetSubmit()}
                  style={{ width: '100%', padding: '14px 16px', borderRadius: 10, background: '#0e1420', border: '1px solid #1e2b40', color: '#ccc', fontSize: 15, boxSizing: 'border-box', marginBottom: 12 }} />
                {resetError && <p style={{ color: '#e05252', fontSize: 12, marginBottom: 12 }}>{resetError}</p>}
                <button onClick={handleResetSubmit} disabled={resetBusy}
                  style={{ width: '100%', padding: '14px 0', borderRadius: 12, background: '#c9a84c', color: '#07090e', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer', opacity: resetBusy ? 0.5 : 1 }}>
                  {resetBusy ? '…' : 'Reset password'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {topBar}

      {cabinetOpen && <Cabinet onClose={() => setCabinetOpen(false)} onlineMap={onlineMap} currentRoomId={gameState?.roomId ?? null} socket={socket} />}
      {devPreviewOpen && <CardPreview onClose={() => setDevPreviewOpen(false)} />}
      <GameRoom
        socket={socket}
        gameState={gameState}
        playerId={playerId}
        isSpectator={isSpectator}
        onLeaveGame={handleLeaveGame}
        onPlayAgain={handlePlayAgain}
        onRematch={handleRematch}
        onSpectateGame={handleSpectateGame}
        roundHistory={roundHistory}
        lastTrick={lastTrick}
        atuzovka={atuzovka}
        trickWinnerId={trickWinnerId}
        isCollecting={isCollecting}
        dealerPlayerId={dealerPlayerId}
        initialDealerPlayerId={initialDealerPlayerId}
        gameAnnouncement={gameAnnouncement}
        jokerAnnouncement={jokerAnnouncement}
        firstPlayerId={firstPlayerId}
        gameLog={gameLog}
        chatMessages={chatMessages}
        onSendChat={handleSendChat}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        theme={theme}
        onToggleTheme={() => setTheme(th => th === 'dark' ? 'light' : 'dark')}
        turnTimer={turnTimer}
        countdown={countdown}
        gameEndStats={gameEndStats}
        myPlayerId={playerId}
        hishtPenalty={gameState?.hishtPenalty ?? '200'}
        gameMode={gameState?.gameMode ?? 'normal'}
        playInPairs={gameState?.playInPairs ?? false}
        isRanked={gameState?.isRanked ?? false}
        onKickPlayer={handleKickPlayer}
        autoStartAt={autoStartAt}
        onOpenCabinet={() => setCabinetOpen(true)}
        onOpenCardPreview={() => setDevPreviewOpen(true)}
        roundEndData={roundEndData}
        onlineMap={onlineMap}
      />

      {countdown !== null && turnTimer && (
        <div
          className="fixed left-1/2 z-50 pointer-events-none"
          style={{ bottom: '7rem', transform: 'translateX(-50%)' }}
        >
          <div
            className="flex flex-col items-center gap-1 px-5 py-3 rounded-2xl"
            style={{
              background: countdown <= 5
                ? 'rgba(180,30,30,0.92)'
                : isMyTimer ? 'rgba(201,168,76,0.92)' : 'rgba(30,30,42,0.88)',
              border: `1.5px solid ${countdown <= 5 ? '#ef4444' : isMyTimer ? '#c9a84c' : '#3e3e50'}`,
              boxShadow: isMyTimer ? '0 0 24px rgba(201,168,76,0.25)' : 'none',
              minWidth: 140,
              textAlign: 'center',
            }}
          >
            {isMyTimer ? (
              <>
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: countdown <= 5 ? '#fca5a5' : '#0a0a0f' }}>
                  {t('play_card_prompt')}
                </span>
                <span
                  className="font-black tabular-nums leading-none"
                  style={{
                    fontSize: 42,
                    color: countdown <= 5 ? '#fff' : '#0a0a0f',
                    textShadow: countdown <= 5 ? '0 0 12px rgba(255,100,100,0.6)' : 'none',
                  }}
                >
                  {countdown}
                </span>
              </>
            ) : (
              <>
                <span className="text-[10px] uppercase tracking-wider" style={{ color: '#3e3e50' }}>
                  {playerName(turnTimer.playerId)}
                </span>
                <span className="text-xl font-bold tabular-nums" style={{ color: '#c9a84c' }}>
                  {countdown}s
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {rematchInvite && !gameState && (
        <RematchToast
          invite={rematchInvite}
          onAccept={() => handleAcceptRematch(rematchInvite.newRoomId)}
          onDismiss={() => setRematchInvite(null)}
        />
      )}

      {roomInvite && (
        <RoomInviteToast
          invite={roomInvite}
          onAccept={() => {
            const myName = playersRef.current.find(p => p.id === playerId)?.name
              || user?.username
              || 'Player'
            setRoomInvite(null)
            handleJoinGame(roomInvite.roomId, myName, null)
          }}
          onDismiss={() => setRoomInvite(null)}
        />
      )}
    </>
  )
}
