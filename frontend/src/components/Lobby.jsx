import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useT, useLang } from '../context/LangContext'
import { pickGuestName } from '../guestNames'
import { usePrefs, TABLE_THEMES } from '../context/PrefsContext'
import { DECK_THEMES } from './Card'
import { PRESET_AVATARS } from './Cabinet'
import { useTheme } from './ThemeToggle'
import TutorialModal from './overlays/TutorialModal'

// ── Card fan ──────────────────────────────────────────────────────────────────
const CARD_ANGLES = [-38, -19, 0, 19, 38]

function CardFan({ scale = 1 }) {
  const W = 300 * scale, H = 180 * scale
  const cw = 76 * scale, ch = 108 * scale
  return (
    <div className="relative mx-auto" style={{ width: W, height: H }}>
      {CARD_ANGLES.map((angle, i) => (
        <div
          key={i}
          className="absolute bottom-0 left-1/2"
          style={{
            width: cw, height: ch,
            transform: `translateX(-50%) rotate(${angle}deg)`,
            transformOrigin: 'bottom center',
            borderRadius: 11 * scale,
            background: 'linear-gradient(145deg, #1e4080 0%, #122a58 100%)',
            border: `1.5px solid ${i === 2 ? '#c9a84c' : '#2d5896'}`,
            boxShadow: i === 2
              ? '0 20px 50px rgba(0,0,0,0.85), 0 0 28px rgba(201,168,76,0.3)'
              : '0 14px 35px rgba(0,0,0,0.75)',
            backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.045) 0, rgba(255,255,255,0.045) 1px, transparent 0, transparent 50%)',
            backgroundSize: `${9 * scale}px ${9 * scale}px`,
            zIndex: i === 2 ? 5 : i < 2 ? i : 4 - i,
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <span style={{
              color: '#c9a84c',
              fontSize: (i === 2 ? 36 : 16) * scale,
              opacity: i === 2 ? 0.92 : 0.18,
              filter: i === 2 ? 'drop-shadow(0 0 12px rgba(201,168,76,0.8))' : 'none',
            }}>✦</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, size = 'md', fitContent = false }) {
  useEffect(() => {
    const handle = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [onClose])

  const SIZE = {
    sm:  { w: 'min(92vw, 460px)',  h: 'clamp(260px, 80dvh, 440px)' },
    md:  { w: 'min(92vw, 560px)',  h: 'clamp(280px, 85dvh, 520px)' },
    lg:  { w: 'min(92vw, 660px)',  h: 'clamp(300px, 85dvh, 560px)' },
  }
  const s = SIZE[size] ?? SIZE.md

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-3"
      style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="relative flex flex-col rounded-2xl overflow-hidden w-full"
        style={{ maxWidth: s.w, minHeight: fitContent ? 'auto' : s.h, maxHeight: '92dvh', background: '#0c1422', border: '1px solid #1e2b40', boxShadow: '0 40px 100px rgba(0,0,0,0.9)' }}
      >
        <div className="flex items-center px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid #1a2535' }}>
          <div className="flex-1" />
          <span className="text-base uppercase tracking-[0.22em] font-bold" style={{ color: '#c9a84c' }}>{title}</span>
          <div className="flex-1 flex justify-end">
            <button onClick={onClose} style={{ color: '#4a5570', background: 'none', border: 'none', cursor: 'pointer', fontSize: 32, lineHeight: 1 }}>×</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  )
}

// ── Text input ────────────────────────────────────────────────────────────────
function TextInput({ placeholder, value, onChange, onKeyDown, type = 'text', autoFocus = false, mono = false }) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      autoFocus={autoFocus}
      onChange={onChange}
      onKeyDown={onKeyDown}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className={`w-full px-5 rounded-xl text-lg focus:outline-none transition-all duration-150 ${mono ? 'font-mono tracking-widest uppercase' : ''}`}
      style={{
        height: 72,
        background: '#070e1a',
        border: `1px solid ${focused ? '#c9a84c' : '#1e2b40'}`,
        caretColor: '#c9a84c',
        color: '#e8d5a3',
        boxShadow: focused ? '0 0 0 3px rgba(201,168,76,0.1)' : 'none',
      }}
    />
  )
}

// ── Room row ──────────────────────────────────────────────────────────────────
function RoomRow({ room, onJoin, onSpectate }) {
  const t = useT()
  const [showPass, setShowPass] = useState(false)
  const [password, setPassword] = useState('')
  const [copied,   setCopied]   = useState(false)
  const isFull    = room.playerCount >= room.maxPlayers
  const isPlaying = room.status === 'playing'

  const attempt = () => {
    if (room.hasPassword && !showPass) { setShowPass(true); return }
    onJoin(room.id, room.hasPassword ? password : null)
  }
  const copyInvite = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${room.id}`
    navigator.clipboard?.writeText(url).catch(() => {})
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: '#0d1828', border: '1px solid #1a2840' }}>
      <span className="font-mono text-sm font-bold tracking-widest flex-shrink-0" style={{ color: '#c9a84c', minWidth: 76 }}>{room.id}</span>
      <div className="flex items-center gap-1">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="w-2 h-2 rounded-full" style={{ background: i < room.playerCount ? '#c9a84c' : '#1e2b40' }} />
        ))}
        <span className="text-[11px] ml-1" style={{ color: '#4a5570' }}>{room.playerCount}/4</span>
      </div>
      <div className="flex-1 flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full" style={{
          background: isPlaying ? 'rgba(201,168,76,0.12)' : 'rgba(59,130,246,0.1)',
          color: isPlaying ? '#c9a84c' : '#6b8fc9',
        }}>{isPlaying ? t('status_playing') : t('status_waiting')}</span>
        {room.hasPassword && <span style={{ color: '#4a5570', fontSize: 12 }}>🔒</span>}
        {room.spectatorCount > 0 && <span className="text-[10px]" style={{ color: '#4a5570' }}>👁 {room.spectatorCount}</span>}
      </div>
      <div className="flex gap-1.5">
        <button onClick={copyInvite} title="Copy invite link"
          className="text-xs px-2 py-1.5 rounded-lg transition-all hover:brightness-125"
          style={{ background: '#0d1828', border: '1px solid #1a2840', color: copied ? '#c9a84c' : '#364060' }}>
          {copied ? '✓' : '🔗'}
        </button>
        {isPlaying && (
          <button onClick={() => onSpectate(room.id)}
            className="text-xs px-3 py-1.5 rounded-lg font-bold transition-all hover:brightness-125"
            style={{ background: '#151e30', border: '1px solid #253850', color: '#8090b0' }}>
            {t('watch_btn')}
          </button>
        )}
        {showPass ? (
          <>
            <input type="password" placeholder="password" value={password}
              onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && attempt()} autoFocus
              className="px-3 py-1.5 rounded-lg text-xs focus:outline-none"
              style={{ background: '#070e1a', border: '1px solid #c9a84c', color: '#e8d5a3', width: 88 }} />
            <button onClick={attempt} className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: '#c9a84c', color: '#0a0a0f' }}>→</button>
          </>
        ) : (
          <button onClick={attempt} disabled={isFull || isPlaying}
            className="text-xs px-3 py-1.5 rounded-lg font-bold transition-all disabled:opacity-30"
            style={{ background: (isFull || isPlaying) ? '#151e30' : '#c9a84c', color: (isFull || isPlaying) ? '#364060' : '#0a0a0f' }}>
            {isFull || isPlaying ? t('full_btn') : t('join_btn')}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Lobby button ──────────────────────────────────────────────────────────────
const BTN_STYLES = {
  gold:    { bg: 'linear-gradient(135deg, #c9a84c 0%, #e2c96a 100%)', color: '#07090e', border: 'none',                   shadow: '0 6px 32px rgba(201,168,76,0.45)' },
  blue:    { bg: '#0e2244',                                            color: '#6aa4e0', border: '1px solid #1e3a68',      shadow: '0 6px 24px rgba(14,34,68,0.6)'   },
  slate:   { bg: '#0e1e30',                                            color: '#8090aa', border: '1px solid #1a2e44',      shadow: '0 6px 24px rgba(14,30,48,0.6)'   },
  dim:     { bg: '#0c1828',                                            color: '#6070a0', border: '1px solid #182438',      shadow: '0 6px 24px rgba(12,24,40,0.6)'   },
}

const LIGHT_BTN_STYLES = {
  gold:  { bg: 'linear-gradient(135deg, #c9a84c 0%, #e2c96a 100%)', color: '#07090e', border: 'none',                  shadow: '0 6px 32px rgba(201,168,76,0.4)'  },
  blue:  { bg: '#dce8f8',                                             color: '#1a4a8a', border: '1px solid #a8c8e8',   shadow: '0 6px 24px rgba(168,200,232,0.4)' },
  slate: { bg: '#e4e0d4',                                             color: '#4a4030', border: '1px solid #c4bca8',   shadow: '0 6px 24px rgba(196,188,168,0.4)' },
  dim:   { bg: '#e0dcd0',                                             color: '#6a6050', border: '1px solid #c0b8a0',   shadow: '0 6px 24px rgba(192,184,160,0.4)' },
}

function LobbyBtn({ children, onClick, color = 'slate', badge = null, theme = 'dark', fluid = false }) {
  const s = (theme === 'light' ? LIGHT_BTN_STYLES : BTN_STYLES)[color]
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center transition-all hover:brightness-110 active:scale-[0.97]"
      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', gap: 8, width: fluid ? '100%' : 'auto' }}
    >
      <div
        className="font-black uppercase tracking-[0.14em] rounded-2xl flex items-center justify-center text-sm"
        style={{ background: s.bg, color: s.color, border: s.border, boxShadow: s.shadow, width: fluid ? '100%' : 176, height: 56 }}
      >
        {children}
      </div>
      <span
        className="font-bold tracking-wider rounded-full normal-case"
        style={{
          fontSize: 10, padding: '2px 10px',
          background: badge ? 'rgba(201,168,76,0.18)' : 'transparent',
          color: badge ? '#c9a84c' : 'transparent',
          visibility: badge ? 'visible' : 'hidden',
        }}
      >
        {badge ?? ' '}
      </span>
    </button>
  )
}

// ── Create-panel primitives ───────────────────────────────────────────────────
function SettingRow({ label, children, sub = false }) {
  return (
    <div className="flex items-center justify-between" style={{ minHeight: 48, padding: sub ? '6px 0' : '8px 0', borderBottom: '1px solid rgba(30,43,64,0.6)' }}>
      <span style={{ fontSize: sub ? 12 : 13, fontWeight: 600, color: sub ? '#6a7a9a' : '#8090aa' }}>{label}</span>
      {children}
    </div>
  )
}

function Toggle({ value, onChange }) {
  return (
    <button onClick={onChange} className="relative flex-shrink-0 rounded-full transition-colors" style={{ width: 44, height: 24, background: value ? '#c9a84c' : '#1e2b40', border: 'none', cursor: 'pointer', padding: 0 }}>
      <div className="absolute top-[3px] rounded-full bg-white transition-all" style={{ width: 18, height: 18, left: value ? '23px' : '3px' }} />
    </button>
  )
}

function OptionBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className="rounded-lg text-sm font-bold transition-all flex items-center justify-center"
      style={{ height: 40, minWidth: 56, paddingLeft: 14, paddingRight: 14, background: active ? '#c9a84c' : 'rgba(255,255,255,0.06)', color: active ? '#07090e' : '#6a7a9a', border: `1px solid ${active ? '#c9a84c' : '#1e2b40'}` }}>
      {children}
    </button>
  )
}

// ── Lobby Chat Panel ──────────────────────────────────────────────────────────
function LobbyChatPanel({ socket, messages, open, setOpen }) {
  const t    = useT()
  const { user } = useAuth()
  const [text, setText] = useState('')
  const bottomRef = React.useRef(null)

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  const send = () => {
    const clean = text.trim()
    if (!clean || !socket || !user) return
    socket.emit('lobby_chat_send', clean)
    setText('')
  }

  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20, zIndex: 9000,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8,
    }}>
      {open && (
        <div style={{
          width: 300, height: 380, background: '#13131a', border: '1px solid #2a2a38',
          borderRadius: '1rem', display: 'flex', flexDirection: 'column', overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
        }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #1e1e2a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <span style={{ color: '#c9a84c', fontWeight: 900, fontSize: 12, letterSpacing: '0.1em' }}>{t('lobby_chat')}</span>
            <button onClick={() => setOpen(false)} style={{ color: '#3a3a4a', background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#c9a84c', flexShrink: 0 }}>{m.username}</span>
                <span style={{ fontSize: 11, color: '#b0a080', wordBreak: 'break-word', flex: 1 }}>{m.text}</span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <div style={{ padding: '8px', borderTop: '1px solid #1e1e2a', flexShrink: 0 }}>
            {user ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  value={text}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && send()}
                  placeholder={t('chat_placeholder')}
                  maxLength={200}
                  style={{
                    flex: 1, padding: '7px 10px', background: '#0d0d12',
                    border: '1px solid #252530', borderRadius: '0.5rem',
                    color: '#e8d5a3', fontSize: 12, outline: 'none', caretColor: '#c9a84c',
                  }}
                />
                <button onClick={send} style={{
                  padding: '7px 12px', background: '#c9a84c', border: 'none',
                  borderRadius: '0.5rem', color: '#0a0a0f', fontWeight: 800, fontSize: 12, cursor: 'pointer',
                }}>›</button>
              </div>
            ) : (
              <p style={{ textAlign: 'center', fontSize: 11, color: '#3a3a4a', margin: 0 }}>{t('chat_login_prompt')}</p>
            )}
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: 48, height: 48, borderRadius: '50%',
          background: open ? '#1a1a2a' : '#c9a84c',
          border: open ? '2px solid #c9a84c' : 'none',
          color: open ? '#c9a84c' : '#0a0a0f',
          fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
        }}
        title={t('lobby_chat')}
      >
        💬
      </button>
    </div>
  )
}

// ── Main Lobby ────────────────────────────────────────────────────────────────
export default function Lobby({ onCreateGame, onJoinGame, onSpectateGame, onQuickStartWithBots, inviteRoomCode = null, onOpenCabinet = null, socket = null, lobbyMessages = [], lobbyChatOpen = false, setLobbyChatOpen = null }) {
  const t = useT()
  const { lang } = useLang()
  const { user, setUser, logout, API_URL } = useAuth()
  const { fourColor, toggleFourColor, deckTheme, setDeckThemeId, tableThemeId, setTableThemeId, cardStyle, setCardStyle } = usePrefs()
  const [theme, setTheme] = useTheme()

  // ── modal state ──
  const [modal, setModal] = useState(() => inviteRoomCode ? 'play' : null)

  // ── play modal state ──
  const [name,         setName]         = useState('')
  const [rooms,        setRooms]        = useState([])
  const [loading,      setLoading]      = useState(true)
  const [joining,      setJoining]      = useState(false)
  const [playPanel,    setPlayPanel]    = useState(() => inviteRoomCode ? 'join' : null)
  const [roomCode,     setRoomCode]     = useState(inviteRoomCode ?? '')
  const [password,     setPassword]     = useState('')
  const [hasPassword,          setHasPassword]          = useState(false)
  const [hishtPenalty,         setHishtPenalty]         = useState('200')
  const [gameMode,             setGameMode]             = useState('normal')
  const [playInPairs,          setPlayInPairs]          = useState(false)
  const [deductions,           setDeductions]           = useState(true)
  const [multiPremiaDeduction, setMultiPremiaDeduction] = useState(false)
  const [lastBidUntouchable,   setLastBidUntouchable]   = useState(true)
  const [isRanked,             setIsRanked]             = useState(false)
  const [error,                setError]                = useState('')

  // ── leaderboard state ──
  const [leaderboard, setLeaderboard] = useState([])
  const [lbPeriod,    setLbPeriod]    = useState('all')  // 'day'|'week'|'month'|'all'

  // ── profile tab state ──
  const [profileTab, setProfileTab] = useState('stats')  // 'stats'|'history'|'account'
  const [gameHistory, setGameHistory] = useState(null)

  // ── collection tab state ──
  const [collectionTab, setCollectionTab] = useState('table')

  // ── tutorial state ──
  const [showTutorial, setShowTutorial] = useState(false)

  // Auto-show tutorial on first ever visit
  useEffect(() => {
    if (!localStorage.getItem('joker_tutorial_seen')) {
      setShowTutorial(true)
      localStorage.setItem('joker_tutorial_seen', '1')
    }
  }, [])

  // ── profile / auth state ──
  const [authMode,     setAuthMode]     = useState('login')
  const [authUsername, setAuthUsername] = useState('')
  const [authEmail,    setAuthEmail]    = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authErr,      setAuthErr]      = useState('')
  const [authBusy,     setAuthBusy]     = useState(false)
  const [userStats,    setUserStats]    = useState(null)

  // ── prefill name when user logs in ──
  useEffect(() => { if (user?.username) setName(user.username) }, [user])

  // ── fetch rooms periodically ──
  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/rooms`)
      if (res.ok) setRooms(await res.json())
    } catch { /* server not up yet */ } finally { setLoading(false) }
  }, [API_URL])

  useEffect(() => {
    fetchRooms()
    const id = setInterval(fetchRooms, 5000)
    return () => clearInterval(id)
  }, [fetchRooms])

  // ── fetch leaderboard when leaderboard opens ──
  useEffect(() => {
    if (modal !== 'leaderboard') return
    fetch(`${API_URL}/api/leaderboard`)
      .then(r => r.ok ? r.json() : [])
      .then(setLeaderboard)
      .catch(() => {})
  }, [modal, API_URL])

  // ── reset profile tab when modal opens ──
  useEffect(() => {
    if (modal === 'profile') { setProfileTab('stats'); setGameHistory(null) }
  }, [modal])

  // ── fetch user stats when profile opens ──
  useEffect(() => {
    if (modal !== 'profile' || !user?.id) return
    fetch(`${API_URL}/api/stats/${user.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(setUserStats)
      .catch(() => {})
  }, [modal, user, API_URL])

  // ── fetch game history when history tab selected ──
  useEffect(() => {
    if (modal !== 'profile' || profileTab !== 'history' || !user?.id) return
    if (gameHistory !== null) return // already loaded
    fetch(`${API_URL}/api/stats/${user.id}/games?limit=20`)
      .then(r => r.ok ? r.json() : [])
      .then(setGameHistory)
      .catch(() => setGameHistory([]))
  }, [modal, profileTab, user, API_URL, gameHistory])

  const guard = () => {
    if (!name.trim()) { setError(t('enter_name')); return false }
    setError(''); return true
  }

  const handleCreate = () => {
    if (!guard()) return
    onCreateGame(name.trim(), hasPassword ? password : null, {
      hishtPenalty,
      gameMode,
      playInPairs,
      deductions,
      multiPremiaDeduction: deductions ? multiPremiaDeduction : false,
      lastBidUntouchable:   deductions ? lastBidUntouchable   : false,
      isRanked,
    })
  }

  const handleJoinByCode = () => {
    if (!guard()) return
    if (!roomCode.trim()) { setError(t('enter_code')); return }
    onJoinGame(roomCode.trim().toUpperCase(), name.trim(), null)
  }

  const handleJoinRoom = (roomId, pw) => {
    if (!guard()) return
    onJoinGame(roomId, name.trim(), pw)
  }

  const handleSpectateRoom = (roomId) => {
    onSpectateGame(roomId, (err) => setError(err ?? 'Could not watch that game'))
  }

  const handleQuickMatch = () => {
    if (!guard()) return
    const open = rooms.filter(r => r.status === 'waiting' && !r.hasPassword && r.playerCount < r.maxPlayers)
    if (!open.length) { setError(t('no_open_rooms')); return }
    onJoinGame(open[0].id, name.trim(), null)
  }

  const handleQuickStartWithBots = () => {
    if (!guard() || joining) return
    setJoining(true)
    onQuickStartWithBots(name.trim())
  }

  const closeModal = () => { setModal(null); setError(''); setPlayPanel(null) }
  const openModal  = (m) => {
    setModal(m); setError(''); setPlayPanel(null)
    if (m === 'play' && !user) setName(pickGuestName(lang))
  }

  const handleAuthSubmit = async () => {
    setAuthErr('')
    if (!authUsername.trim() || !authPassword.trim()) { setAuthErr(t('auth_required')); return }
    setAuthBusy(true)
    try {
      const body = authMode === 'register'
        ? { username: authUsername.trim(), email: authEmail.trim() || undefined, password: authPassword }
        : { username: authUsername.trim(), password: authPassword }
      const res  = await fetch(`${API_URL}/api/auth/${authMode}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setAuthErr(data.error ?? 'Error'); setAuthBusy(false); return }
      localStorage.setItem('joker_token', data.token)
      const meRes  = await fetch(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${data.token}` } })
      const meData = meRes.ok ? await meRes.json() : null
      if (meData) { setUser(meData); setName(meData.username) }
    } catch { setAuthErr(t('network_error')) }
    setAuthBusy(false)
  }

  const isSmall = window.innerWidth < 430

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#07090f' }}>
        <div className="w-8 h-8 rounded-full border-2 border-transparent" style={{ borderTopColor: '#c9a84c', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: 'var(--lobby-gradient)' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Corner suit watermarks */}
      {[
        { s: '♠', top: 28,    left: 36,    color: '#c9a84c' },
        { s: '♥', top: 28,    right: 36,   color: '#b83030' },
        { s: '♦', bottom: 28, right: 36,   color: '#b83030' },
        { s: '♣', bottom: 28, left: 36,    color: '#c9a84c' },
      ].map(({ s, color, ...pos }, i) => (
        <span key={i} className="absolute select-none pointer-events-none"
          style={{ color, opacity: theme === 'light' ? 0.14 : 0.09, fontSize: 100, lineHeight: 1, ...pos }}>{s}</span>
      ))}
      {/* Scattered mid suits */}
      {['♠','♥','♦','♣','♥','♠','♦'].map((s, i) => (
        <span key={`m${i}`} className="absolute select-none pointer-events-none" style={{
          left: `${[8,84,4,92,50,24,68][i]}%`, top: `${[38,30,68,58,82,52,18][i]}%`,
          fontSize: [32,28,40,24,36,22,30][i], opacity: theme === 'light' ? 0.07 : 0.03,
          color: [0,3,5].includes(i) ? '#c9a84c' : '#b83030',
        }}>{s}</span>
      ))}

      {/* ── Hero ── */}
      <div className="flex flex-col items-center text-center" style={{ marginBottom: isSmall ? 20 : 128 }}>
        <CardFan scale={isSmall ? 0.65 : 1} />
        <div style={{ marginTop: isSmall ? 12 : 32 }}>
          <h1 className="font-black tracking-[0.16em] leading-none"
            style={{ fontSize: isSmall ? '2.6rem' : 'clamp(4rem, 10vw, 7rem)', color: 'var(--lobby-title-color)', fontFamily: "'Playfair Display', Georgia, serif", textShadow: 'var(--lobby-title-shadow)' }}>
            JOKER
          </h1>
          <p className="font-bold tracking-[0.26em] mt-1"
            style={{ fontSize: isSmall ? '0.9rem' : 'clamp(1rem, 2.8vw, 1.6rem)', color: '#c9a84c', fontFamily: "'Playfair Display', Georgia, serif" }}>
            ჯოკერი
          </p>
        </div>
        {!isSmall && (
          <p className="text-xs uppercase tracking-[0.32em] mt-3" style={{ color: 'var(--lobby-sub-color)' }}>
            {t('tagline')}
          </p>
        )}
      </div>

      {/* ── 4 Buttons ── */}
      {isSmall ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, width: '100%', padding: '0 16px' }}>
          <LobbyBtn color="gold"  theme={theme} fluid onClick={() => openModal('play')}>{t('nav_play')}</LobbyBtn>
          <LobbyBtn color="blue"  theme={theme} fluid onClick={() => openModal('collection')}>{t('nav_collection')}</LobbyBtn>
          <LobbyBtn color="blue"  theme={theme} fluid onClick={() => openModal('leaderboard')}>{t('nav_leaderboard')}</LobbyBtn>
          <LobbyBtn color="slate" theme={theme} fluid badge={user?.username ?? t('guest_badge')} onClick={() => openModal('profile')}>{t('nav_profile')}</LobbyBtn>
        </div>
      ) : (
        <div className="flex items-center flex-wrap justify-center px-6" style={{ gap: 48 }}>
          <LobbyBtn color="gold"  theme={theme} onClick={() => openModal('play')}>{t('nav_play')}</LobbyBtn>
          <LobbyBtn color="blue"  theme={theme} onClick={() => openModal('collection')}>{t('nav_collection')}</LobbyBtn>
          <LobbyBtn color="blue"  theme={theme} onClick={() => openModal('leaderboard')}>{t('nav_leaderboard')}</LobbyBtn>
          <LobbyBtn color="slate" theme={theme} badge={user?.username ?? t('guest_badge')} onClick={() => openModal('profile')}>{t('nav_profile')}</LobbyBtn>
        </div>
      )}

      {/* ── How to Play link ── */}
      <button onClick={() => setShowTutorial(true)}
        className="text-xs uppercase tracking-widest font-semibold transition-all hover:opacity-80"
        style={{ color: 'rgba(201,168,76,0.4)', background: 'none', border: 'none', cursor: 'pointer', marginTop: isSmall ? 6 : 8 }}>
        ? {t('nav_how_to_play')}
      </button>

      {/* ════════════════ PLAY MODAL ════════════════ */}
      {modal === 'play' && (
        <Modal title={t('modal_find_game')} onClose={closeModal} size="md" fitContent>
          <div className="p-8 flex flex-col gap-5">
            {/* Name */}
            {user ? (
              <div className="flex items-center gap-3 px-5 py-8 rounded-xl" style={{ background: '#0a1422', border: '1px solid #1a2840' }}>
                <span className="text-lg font-bold flex-1" style={{ color: '#e8d5a3' }}>{user.username}</span>
              </div>
            ) : (
              <div className="flex items-center gap-3 px-5 py-8 rounded-xl" style={{ background: '#0a1422', border: '1px solid #1a2840' }}>
                <div className="flex-1 min-w-0">
                  <div className="text-xs uppercase tracking-wider mb-1" style={{ color: '#4a5570' }}>{t('playing_as')}</div>
                  <div className="text-lg font-bold truncate" style={{ color: '#e8d5a3' }}>{name}</div>
                </div>
                <button
                  onClick={() => setName(pickGuestName(lang))}
                  title={t('reroll_name')}
                  className="text-2xl hover:scale-125 transition-transform flex-shrink-0"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}
                >🎲</button>
                <button onClick={() => openModal('profile')}
                  className="text-sm font-bold px-4 py-3 rounded-lg transition-all hover:brightness-110 flex-shrink-0"
                  style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)', color: '#c9a84c' }}>
                  {t('login')}
                </button>
              </div>
            )}

            {/* Primary actions */}
            <button onClick={handleQuickStartWithBots} disabled={joining}
              className="w-full rounded-2xl font-bold text-xl tracking-wide transition-all hover:brightness-110 active:scale-[0.98] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ height: 96, background: 'linear-gradient(135deg, #3a7a4c 0%, #4ade80 100%)', color: '#07090e', boxShadow: '0 4px 24px rgba(74,222,128,0.25)' }}>
              🤖 {joining ? '…' : t('quick_match_bots')}
            </button>

            <button onClick={handleQuickMatch} disabled={joining}
              className="w-full rounded-2xl font-bold text-xl tracking-wide transition-all hover:brightness-110 active:scale-[0.98] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ height: 96, background: 'linear-gradient(135deg, #c9a84c 0%, #e2c96a 100%)', color: '#07090e', boxShadow: '0 4px 24px rgba(201,168,76,0.35)' }}>
              ⚡ {t('quick_match')}
            </button>

            <div className="flex gap-2">
              <button onClick={() => setPlayPanel(p => p === 'create' ? null : 'create')}
                className="flex-1 rounded-xl font-bold text-base transition-all active:scale-[0.98] flex items-center justify-center"
                style={{ height: 96, background: playPanel === 'create' ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.04)', border: `1.5px solid ${playPanel === 'create' ? '#c9a84c' : '#1e2b40'}`, color: playPanel === 'create' ? '#c9a84c' : '#6a7a9a' }}>
                + {t('create_room')}
              </button>
              <button onClick={() => setPlayPanel(p => p === 'join' ? null : 'join')}
                className="flex-1 rounded-xl text-base font-semibold transition-all active:scale-[0.98] flex items-center justify-center"
                style={{ height: 96, background: playPanel === 'join' ? 'rgba(201,168,76,0.12)' : 'rgba(255,255,255,0.04)', border: `1.5px solid ${playPanel === 'join' ? '#c9a84c' : '#1e2b40'}`, color: playPanel === 'join' ? '#c9a84c' : '#6a7a9a' }}>
                {t('code_btn')}
              </button>
            </div>

            {/* Create panel */}
            {playPanel === 'create' && (
              <div className="rounded-2xl p-5 flex flex-col gap-1" style={{ background: '#0a1422', border: '1px solid #1a2840' }}>
                <span className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: '#c9a84c' }}>{t('new_room')}</span>

                {/* Password */}
                <SettingRow label={t('pw_protect')}>
                  <Toggle value={hasPassword} onChange={() => setHasPassword(p => !p)} />
                </SettingRow>
                {hasPassword && (
                  <div className="pb-1">
                    <TextInput placeholder={t('room_pw_ph')} type="password" value={password} onChange={e => setPassword(e.target.value)} />
                  </div>
                )}

                {/* Game mode */}
                <SettingRow label={t('game_mode')}>
                  <div className="flex gap-2">
                    {[{ id: 'normal', label: t('mode_classic') }, { id: 'only9', label: t('mode_only9') }].map(m => (
                      <OptionBtn key={m.id} active={gameMode === m.id}
                        onClick={() => { setGameMode(m.id); setHishtPenalty('200') }}>
                        {m.label}
                      </OptionBtn>
                    ))}
                  </div>
                </SettingRow>

                {/* Play in Pairs */}
                <SettingRow label={t('play_in_pairs')}>
                  <Toggle value={playInPairs} onChange={() => setPlayInPairs(p => !p)} />
                </SettingRow>

                {/* Hisht penalty — options depend on game mode */}
                <SettingRow label={t('hisht_penalty')}>
                  <div className="flex gap-2 flex-wrap justify-end">
                    {(gameMode === 'only9'
                      ? ['200', '300', '500', '900']
                      : ['200', '500', '200/500', '×100']
                    ).map(v => (
                      <OptionBtn key={v} active={hishtPenalty === v} onClick={() => setHishtPenalty(v)}>
                        {v}
                      </OptionBtn>
                    ))}
                  </div>
                </SettingRow>

                {/* Deductions */}
                <SettingRow label={t('deductions')}>
                  <Toggle value={deductions} onChange={() => setDeductions(p => !p)} />
                </SettingRow>
                {deductions && (
                  <div className="ml-4 pl-4 flex flex-col gap-1 mb-1" style={{ borderLeft: '2px solid #1e2b40' }}>
                    <SettingRow label={t('multi_premia_deduct')} sub>
                      <Toggle value={multiPremiaDeduction} onChange={() => setMultiPremiaDeduction(p => !p)} />
                    </SettingRow>
                    <SettingRow label={t('last_bid_untouchable')} sub>
                      <Toggle value={lastBidUntouchable} onChange={() => setLastBidUntouchable(p => !p)} />
                    </SettingRow>
                  </div>
                )}

                {/* Ranked */}
                <SettingRow label={t('ranked_mode')}>
                  <Toggle value={isRanked} onChange={() => setIsRanked(p => !p)} />
                </SettingRow>
                {isRanked && (
                  <p className="text-[10px] text-right" style={{ color: '#6a7a9a', marginTop: -4 }}>
                    {t('ranked_no_bots')}
                  </p>
                )}

                <button onClick={handleCreate}
                  className="w-full rounded-xl font-bold text-base tracking-wide transition-all hover:brightness-110 active:scale-[0.98] flex items-center justify-center mt-2"
                  style={{ height: 72, background: '#c9a84c', color: '#07090e' }}>
                  {t('create_game_btn')}
                </button>
              </div>
            )}

            {/* Join by code panel */}
            {playPanel === 'join' && (
              <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: '#0a1422', border: '1px solid #1a2840' }}>
                <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: '#c9a84c' }}>{t('join_watch_title')}</span>
                <TextInput placeholder={t('room_code_ph')} value={roomCode}
                  onChange={e => setRoomCode(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && handleJoinByCode()} mono autoFocus />
                <div className="flex gap-2">
                  <button onClick={handleJoinByCode}
                    className="flex-1 rounded-xl font-bold text-base transition-all hover:brightness-110 active:scale-[0.98] flex items-center justify-center"
                    style={{ height: 72, background: '#c9a84c', color: '#07090e' }}>
                    {t('join_btn')}
                  </button>
                  <button onClick={() => { if (!roomCode.trim()) { setError(t('enter_code')); return } handleSpectateRoom(roomCode.trim().toUpperCase()) }}
                    className="flex-1 rounded-xl font-bold text-base transition-all active:scale-[0.98] flex items-center justify-center"
                    style={{ height: 72, background: 'rgba(255,255,255,0.04)', border: '1px solid #1e2b40', color: '#6a7a9a' }}>
                    {t('watch_btn')}
                  </button>
                </div>
              </div>
            )}

            {error && <p className="text-xs text-center" style={{ color: '#e05252' }}>{error}</p>}

            {/* Live rooms divider + list (hidden when create panel is open) */}
            {playPanel !== 'create' && <>
              <div className="flex items-center gap-3 mt-1">
                <div className="flex-1" style={{ height: 1, background: '#1a2535' }} />
                <span className="text-[10px] uppercase tracking-widest" style={{ color: '#364060' }}>{t('live_rooms')}</span>
                <button onClick={fetchRooms} className="text-[10px] transition-colors hover:text-amber-400" style={{ color: '#364060' }}>↻</button>
                <div className="flex-1" style={{ height: 1, background: '#1a2535' }} />
              </div>

              {loading ? (
                <div className="flex justify-center py-6">
                  <div className="w-5 h-5 rounded-full border-2 border-transparent" style={{ borderTopColor: '#c9a84c', animation: 'spin 0.8s linear infinite' }} />
                </div>
              ) : rooms.length === 0 ? (
                <div className="text-center py-8 flex flex-col items-center gap-2" style={{ color: '#4a5570' }}>
                  <span style={{ fontSize: 36 }}>🃏</span>
                  <span className="text-xs uppercase tracking-widest font-semibold">{t('no_rooms')}</span>
                  <span className="text-[10px]" style={{ color: '#2e4060' }}>{t('no_rooms_hint')}</span>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {rooms.map(room => <RoomRow key={room.id} room={room} onJoin={handleJoinRoom} onSpectate={handleSpectateRoom} />)}
                </div>
              )}
            </>}
          </div>
        </Modal>
      )}

      {/* ════════════════ COLLECTION MODAL ════════════════ */}
      {modal === 'collection' && (() => {
        // Percentage-based sprite clip — works at any container size.
        // Sheet is 13 cols × 4 rows; bgSize 1300%/400% makes each cell = 1 container.
        const spriteStyle = (col, row) => ({
          backgroundImage: 'url(/8BitDeck.png)',
          backgroundSize: '1300% 400%',
          backgroundPosition: `${(col / 12) * 100}% ${(row / 3) * 100}%`,
          backgroundRepeat: 'no-repeat',
        })
        // Reusable thumbnail wrapper — handles border/glow/label overlay
        const Thumb = ({ active, onClick, children, label }) => (
          <button onClick={onClick} className="relative overflow-hidden transition-all"
            style={{ aspectRatio: '3/4', borderRadius: 16, border: `2px solid ${active ? '#c9a84c' : 'rgba(255,255,255,0.06)'}`, boxShadow: active ? '0 0 18px rgba(201,168,76,0.45)' : 'none', background: '#0a1422' }}>
            {children}
            {/* label bar */}
            <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-2 py-1.5"
              style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}>
              <span className="text-[11px] font-bold truncate" style={{ color: active ? '#c9a84c' : 'rgba(255,255,255,0.5)' }}>{label}</span>
              {active && <span style={{ color: '#c9a84c', fontSize: 11, flexShrink: 0 }}>✓</span>}
            </div>
          </button>
        )
        return (
          <Modal title={t('nav_collection')} onClose={closeModal} size="lg" fitContent>
            <div className="flex flex-col">
              {/* Sub-category tabs */}
              <div className="flex" style={{ borderBottom: '1px solid #1a2535' }}>
                {[
                  { id: 'table', label: t('col_table') },
                  { id: 'deck',  label: t('col_deck')  },
                  { id: 'cards', label: t('col_cards') },
                  { id: 'joker', label: t('col_joker') },
                ].map(({ id, label }) => (
                  <button key={id} onClick={() => setCollectionTab(id)}
                    className="flex-1 flex items-center justify-center font-bold transition-all"
                    style={{ height: 56, background: collectionTab === id ? 'rgba(201,168,76,0.1)' : 'transparent', color: collectionTab === id ? '#c9a84c' : '#364060', borderBottom: collectionTab === id ? '2px solid #c9a84c' : '2px solid transparent', fontSize: 13 }}>
                    {label}
                  </button>
                ))}
              </div>

              {/* ── Table colours ── */}
              {collectionTab === 'table' && (
                <div className="p-5">
                  <div className="grid grid-cols-5 gap-3">
                    {TABLE_THEMES.map(tt => (
                      <Thumb key={tt.id} active={tableThemeId === tt.id} onClick={() => setTableThemeId(tt.id)} label={t('table_' + tt.id)}>
                        <img src={tt.darkSrc} alt={tt.label}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }} />
                      </Thumb>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Deck designs ── */}
              {collectionTab === 'deck' && (
                <div className="p-5">
                  <div className="grid grid-cols-4 gap-3">
                    {DECK_THEMES.map(dt => (
                      <Thumb key={dt.id} active={deckTheme.id === dt.id} onClick={() => setDeckThemeId(dt.id)} label={dt.label}>
                        {/* card back photo tinted with deck colour */}
                        <img src="/card-back.jpg" alt={dt.label}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }} />
                        <div style={{ position: 'absolute', inset: 0, background: dt.bg, mixBlendMode: 'color', opacity: 0.72 }} />
                      </Thumb>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Card face designs ── */}
              {collectionTab === 'cards' && (
                <div className="p-5">
                  <div className="grid grid-cols-3 gap-3">
                    {/* Classic — text pip card (K♥), left-aligned corners */}
                    <Thumb active={cardStyle === 'classic'} onClick={() => setCardStyle('classic')} label={t('card_classic')}>
                      <div style={{ position: 'absolute', inset: 2, background: '#fff', borderRadius: 12, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 9px' }}>
                        <div style={{ fontWeight: 900, fontSize: 26, lineHeight: 1, color: '#dc2626' }}>K<br /><span style={{ fontSize: 22 }}>♥</span></div>
                        <div style={{ width: '100%', textAlign: 'center', fontSize: 90, color: '#dc2626', lineHeight: 1 }}>♥</div>
                        <div style={{ fontWeight: 900, fontSize: 26, lineHeight: 1, color: '#dc2626', alignSelf: 'flex-end', transform: 'rotate(180deg)' }}>K<br /><span style={{ fontSize: 22 }}>♥</span></div>
                      </div>
                    </Thumb>

                    {/* Hybrid — diagonal split: K♥ sprite (top-left) / 10♥ real pip layout (bottom-right) */}
                    <Thumb active={cardStyle === 'hybrid'} onClick={() => setCardStyle('hybrid')} label={t('card_hybrid')}>
                      <div style={{ position: 'absolute', inset: 2, borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
                        {/* top-left triangle: K♥ sprite on white */}
                        <div style={{ position: 'absolute', inset: 0, ...spriteStyle(11, 0), clipPath: 'polygon(0 0, 100% 0, 0 100%)' }} />
                        {/* bottom-right triangle: 10♥ real card pip layout */}
                        <div style={{ position: 'absolute', inset: 0, background: '#fff', clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}>
                          {/* bottom-right corner label */}
                          <div style={{ position: 'absolute', bottom: 7, right: 8, transform: 'rotate(180deg)', fontWeight: 900, fontSize: 18, lineHeight: 1.1, color: '#dc2626' }}>
                            10<br /><span style={{ fontSize: 15 }}>♥</span>
                          </div>
                          {/* 10 pips: 2 cols × 5 rows — top 3 rows normal, bottom 2 inverted */}
                          {[
                            [32, 12, false], [68, 12, false],
                            [32, 28, false], [68, 28, false],
                            [32, 47, false], [68, 47, false],
                            [32, 67, true],  [68, 67, true],
                            [32, 84, true],  [68, 84, true],
                          ].map(([x, y, inv], i) => (
                            <span key={i} style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, transform: `translate(-50%,-50%)${inv ? ' rotate(180deg)' : ''}`, fontSize: 28, color: '#dc2626', lineHeight: 1, userSelect: 'none' }}>♥</span>
                          ))}
                        </div>
                        {/* diagonal divider line */}
                        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                          <line x1="0%" y1="100%" x2="100%" y2="0%" stroke="rgba(0,0,0,0.15)" strokeWidth="1.5" />
                        </svg>
                      </div>
                    </Thumb>

                    {/* Sprite — K♥ pixel art on white background */}
                    <Thumb active={cardStyle === 'sprite'} onClick={() => setCardStyle('sprite')} label={t('card_pixel')}>
                      <div style={{ position: 'absolute', inset: 2, background: '#fff', borderRadius: 12, overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', inset: 6, ...spriteStyle(11, 0) }} />
                      </div>
                    </Thumb>
                  </div>
                </div>
              )}

              {/* ── Joker designs ── */}
              {collectionTab === 'joker' && (
                <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ color: '#4a5570' }}>
                  <span style={{ fontSize: 48 }}>🃏</span>
                  <span className="text-sm uppercase tracking-widest font-semibold">{t('col_coming_soon')}</span>
                </div>
              )}
            </div>
          </Modal>
        )
      })()}

      {/* ════════════════ LEADERBOARD MODAL ════════════════ */}
      {modal === 'leaderboard' && (
        <Modal title={t('nav_leaderboard')} onClose={closeModal} size="lg" fitContent>
          <div className="flex flex-col h-full">
            {/* Period tabs */}
            <div className="flex flex-shrink-0" style={{ borderBottom: '1px solid #1a2535' }}>
              {[
                { id: 'day',   label: t('period_today')  },
                { id: 'week',  label: t('period_week')   },
                { id: 'month', label: t('period_month')  },
                { id: 'all',   label: t('period_all')    },
              ].map(({ id, label }) => (
                <button key={id} onClick={() => setLbPeriod(id)}
                  className="flex-1 text-base font-bold transition-all flex items-center justify-center"
                  style={{ height: 72, background: lbPeriod === id ? 'rgba(201,168,76,0.1)' : 'transparent', color: lbPeriod === id ? '#c9a84c' : '#364060', borderBottom: lbPeriod === id ? '2px solid #c9a84c' : '2px solid transparent' }}>
                  {label}
                </button>
              ))}
            </div>

            {leaderboard.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-14" style={{ color: '#4a5570' }}>
                <div className="text-4xl mb-3">🏆</div>
                <div className="text-sm">{t('no_ranked')}</div>
                <div className="text-xs mt-1" style={{ color: '#2e4060' }}>{t('no_ranked_hint')}</div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 px-5 py-2" style={{ borderBottom: '1px solid #1a2535' }}>
                  <span style={{ width: 32, flexShrink: 0 }} />
                  <span className="flex-1 text-[9px] uppercase tracking-[0.18em] font-bold" style={{ color: '#2e4060' }}>{t('col_player')}</span>
                  <span className="text-[9px] uppercase tracking-[0.18em] font-bold text-right" style={{ color: 'rgba(201,168,76,0.5)', width: 50 }}>🪙</span>
                  <span className="text-[9px] uppercase tracking-[0.18em] font-bold text-right" style={{ color: '#2e4060', width: 36 }}>{t('col_winpct')}</span>
                  <span className="text-[9px] uppercase tracking-[0.18em] font-bold text-right" style={{ color: '#2e4060', width: 36 }}>{t('col_bidpct')}</span>
                </div>
                {leaderboard.slice(0, 20).map((p, i) => {
                  const isMe = user?.id === p.id
                  const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null
                  const rankColor = i === 0 ? '#c9a84c' : i === 1 ? '#9a9aa8' : i === 2 ? '#a06840' : '#2e4060'
                  return (
                    <div key={p.id} className="flex items-center gap-2 px-5 py-3"
                      style={{ background: isMe ? 'rgba(201,168,76,0.07)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)', borderBottom: '1px solid rgba(26,37,53,0.6)', borderLeft: isMe ? '2px solid rgba(201,168,76,0.5)' : '2px solid transparent' }}>
                      <div style={{ width: 32, flexShrink: 0, textAlign: 'center' }}>
                        {medal ? <span style={{ fontSize: 16 }}>{medal}</span>
                          : <span className="font-mono text-xs font-bold" style={{ color: rankColor }}>{i + 1}</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold truncate block" style={{ color: isMe ? '#c9a84c' : p.is_bot ? '#6a7a9a' : '#d4c89a' }}>
                          {p.is_bot ? '🤖 ' : ''}{p.username}
                        </span>
                        <span className="text-[9px] tabular-nums" style={{ color: '#2e4060' }}>{p.games_played}g · {p.games_won}W</span>
                      </div>
                      <span className="tabular-nums text-sm font-bold text-right" style={{ color: p.rating >= 0 ? '#c9a84c' : '#ef4444', width: 50 }}>{p.rating >= 0 ? '+' : ''}{p.rating}</span>
                      <span className="tabular-nums text-xs text-right" style={{ color: '#4a5570', width: 36 }}>{p.win_rate}</span>
                      <span className="tabular-nums text-xs text-right" style={{ color: '#4a5570', width: 36 }}>{p.bid_accuracy}</span>
                    </div>
                  )
                })}
                {user && !leaderboard.some(p => p.id === user.id) && (
                  <div className="text-center py-3 text-[10px]" style={{ color: '#2e4060' }}>{t('no_ranked_hint')}</div>
                )}
              </>
            )}
          </div>
        </Modal>
      )}

      {/* ════════════════ PROFILE MODAL ════════════════ */}
      {modal === 'profile' && (
        <Modal title={t('nav_profile')} onClose={closeModal} size="md" fitContent={!user}>
          {user ? (
            <>
              {/* ── Tab bar ── */}
              <div className="flex" style={{ borderBottom: '1px solid #1a2535' }}>
                {[
                  { id: 'stats',   label: t('tab_stats')   },
                  { id: 'history', label: t('tab_history') },
                  { id: 'account', label: t('tab_account') },
                ].map(({ id, label }) => (
                  <button key={id} onClick={() => setProfileTab(id)}
                    className="flex-1 text-base font-bold transition-all flex items-center justify-center"
                    style={{ height: 72, background: profileTab === id ? 'rgba(201,168,76,0.1)' : 'transparent', color: profileTab === id ? '#c9a84c' : '#364060', borderBottom: profileTab === id ? '2px solid #c9a84c' : '2px solid transparent' }}>
                    {label}
                  </button>
                ))}
              </div>

              {/* ── Stats tab ── */}
              {profileTab === 'stats' && (
                <div className="p-5 flex flex-col gap-3">

                  {/* Profile header */}
                  <div className="flex items-center gap-4 p-4 rounded-2xl" style={{ background: '#0a1422', border: '1px solid #1a2840' }}>
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl font-black flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg,#c9a84c,#a8893d)', color: '#07090e' }}>
                      {PRESET_AVATARS[user.avatarId] || user.username?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold truncate" style={{ color: '#e8d5a3' }}>{user.username}</div>
                      <div className="text-[10px] mt-0.5" style={{ color: '#4a5570' }}>{user.email ?? (user.isGuest ? t('guest_account') : t('registered'))}</div>
                    </div>
                    {userStats && (
                      <div className="flex flex-col items-center flex-shrink-0 px-2">
                        <div className="text-xl font-black tabular-nums" style={{ color: (userStats.honor_rate ?? 100) >= 80 ? '#4ade80' : (userStats.honor_rate ?? 100) >= 50 ? '#c9a84c' : '#ef4444' }}>
                          {userStats.honor_rate ?? 100}
                        </div>
                        <div className="text-[9px] uppercase tracking-wider" style={{ color: '#4a5570' }}>{t('stat_honor')}</div>
                      </div>
                    )}
                  </div>

                  {userStats ? (<>
                    {/* Token balance — hero */}
                    <div className="rounded-2xl p-4 text-center" style={{ background: 'linear-gradient(135deg, rgba(201,168,76,0.1), rgba(201,168,76,0.04))', border: '1px solid rgba(201,168,76,0.25)' }}>
                      <div className="text-[9px] uppercase tracking-[0.22em] mb-1" style={{ color: '#c9a84c' }}>{t('stat_tokens')}</div>
                      <div className="text-5xl font-black tabular-nums" style={{ color: (userStats.rating ?? 0) >= 0 ? '#c9a84c' : '#ef4444' }}>
                        {(userStats.rating ?? 0) >= 0 ? '+' : ''}{userStats.rating ?? 0}
                      </div>
                    </div>

                    {/* Core stats 2×3 grid */}
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: t('stat_games_played'), value: userStats.games_played ?? 0 },
                        { label: t('stat_winrate'),      value: `${userStats.win_rate ?? 0}%` },
                        { label: t('stat_bidacc'),       value: `${userStats.bid_accuracy ?? 0}%` },
                        { label: t('stat_highest'),      value: userStats.highest_score ?? 0, gold: true },
                        { label: t('stat_total_score'),  value: userStats.total_score ?? 0 },
                        { label: t('stat_time'),         value: (userStats.time_played_minutes ?? 0) < 60 ? `${userStats.time_played_minutes ?? 0}m` : `${Math.round((userStats.time_played_minutes ?? 0) / 60)}h` },
                      ].map(({ label, value, gold }) => (
                        <div key={label} className="rounded-xl p-3" style={{ background: '#0a1422', border: '1px solid #1a2840' }}>
                          <div className="text-[9px] uppercase tracking-wider mb-1" style={{ color: '#364060' }}>{label}</div>
                          <div className="text-2xl font-bold tabular-nums" style={{ color: gold ? '#c9a84c' : '#e8d5a3' }}>{value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Placement breakdown */}
                    <div className="rounded-xl p-4" style={{ background: '#0a1422', border: '1px solid #1a2840' }}>
                      <div className="text-[9px] uppercase tracking-wider mb-3" style={{ color: '#364060' }}>{t('stat_placements')}</div>
                      <div className="flex gap-1">
                        {[
                          { label: '1st', count: userStats.place1_count ?? 0, color: '#c9a84c' },
                          { label: '2nd', count: userStats.place2_count ?? 0, color: '#9a9aa8' },
                          { label: '3rd', count: userStats.place3_count ?? 0, color: '#a06840' },
                          { label: '4th', count: userStats.place4_count ?? 0, color: '#364060' },
                        ].map(({ label, count, color }) => (
                          <div key={label} className="flex-1 flex flex-col items-center gap-1 py-1">
                            <div className="text-xl font-black tabular-nums" style={{ color }}>{count}</div>
                            <div className="text-[9px] font-bold uppercase" style={{ color: '#2e4060' }}>{label}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Special stats */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl p-3" style={{ background: '#0a1422', border: '1px solid #1a2840' }}>
                        <div className="text-[9px] uppercase tracking-wider mb-1" style={{ color: '#364060' }}>{t('stat_full_takes')}</div>
                        <div className="text-2xl font-bold tabular-nums" style={{ color: '#e8d5a3' }}>{userStats.full_take_count ?? 0}</div>
                      </div>
                      <div className="rounded-xl p-3" style={{ background: '#0a1422', border: '1px solid #1a2840' }}>
                        <div className="text-[9px] uppercase tracking-wider mb-1" style={{ color: '#364060' }}>{t('stat_zero_bids')}</div>
                        <div className="text-2xl font-bold tabular-nums" style={{ color: '#e8d5a3' }}>{userStats.zero_bid_success_count ?? 0}</div>
                      </div>
                    </div>
                  </>) : (
                    <p className="text-xs text-center py-6" style={{ color: '#364060' }}>{t('stat_no_games')}</p>
                  )}

                  <button onClick={logout}
                    className="w-full rounded-xl font-semibold text-base transition-all hover:text-red-400 flex items-center justify-center"
                    style={{ height: 56, background: 'rgba(255,255,255,0.04)', border: '1px solid #1e2b40', color: '#4a5570' }}>
                    {t('signout')}
                  </button>
                </div>
              )}

              {/* ── History tab ── */}
              {profileTab === 'history' && (
                <div className="flex flex-col" style={{ minHeight: 300 }}>
                  {gameHistory === null ? (
                    <div className="flex-1 flex items-center justify-center py-12" style={{ color: '#364060', fontSize: 13 }}>…</div>
                  ) : gameHistory.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-12 gap-2" style={{ color: '#4a5570' }}>
                      <span style={{ fontSize: 32 }}>🃏</span>
                      <span className="text-xs uppercase tracking-widest">{t('history_no_games')}</span>
                    </div>
                  ) : (
                    <>
                      {/* header row */}
                      <div className="flex items-center px-4 py-2" style={{ borderBottom: '1px solid #1a2535' }}>
                        <span className="text-[9px] uppercase tracking-[0.18em] font-bold flex-1" style={{ color: '#2e4060' }}>{t('col_player')}</span>
                        <span className="text-[9px] uppercase tracking-[0.18em] font-bold text-right" style={{ color: '#2e4060', width: 36 }}>{t('col_score')}</span>
                        <span className="text-[9px] uppercase tracking-[0.18em] font-bold text-right" style={{ color: 'rgba(201,168,76,0.5)', width: 40 }}>🪙</span>
                      </div>
                      {gameHistory.map((g, i) => {
                        const placeMedal = g.placement === 1 ? '🥇' : g.placement === 2 ? '🥈' : g.placement === 3 ? '🥉' : '4th'
                        const placeColor = g.placement === 1 ? '#c9a84c' : g.placement === 2 ? '#9a9aa8' : g.placement === 3 ? '#a06840' : '#364060'
                        const delta = g.rating_change
                        const score = g.score != null ? (g.score / 100).toFixed(1) : '—'
                        const date = new Date(g.created_at)
                        const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`
                        return (
                          <div key={g.id} className="flex items-center px-4 py-3"
                            style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)', borderBottom: '1px solid rgba(26,37,53,0.5)' }}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span style={{ fontSize: g.placement <= 3 ? 16 : 11, color: placeColor, fontWeight: 700, minWidth: 24 }}>
                                  {placeMedal}
                                </span>
                                {g.is_ranked && (
                                  <span className="text-[8px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded"
                                    style={{ background: 'rgba(201,168,76,0.15)', color: '#c9a84c', border: '1px solid rgba(201,168,76,0.3)' }}>
                                    {t('history_ranked')}
                                  </span>
                                )}
                              </div>
                              <div className="text-[9px] mt-0.5 tabular-nums" style={{ color: '#2e4060' }}>{dateStr}</div>
                            </div>
                            <span className="tabular-nums text-sm font-bold text-right" style={{ color: '#8a8a9a', width: 36 }}>{score}</span>
                            <span className="tabular-nums text-sm font-bold text-right" style={{ color: delta == null ? '#2e4060' : delta >= 0 ? '#4ade80' : '#ef4444', width: 40 }}>
                              {delta == null ? '—' : `${delta >= 0 ? '+' : ''}${delta}`}
                            </span>
                          </div>
                        )
                      })}
                    </>
                  )}
                </div>
              )}

              {/* ── Account tab ── */}
              {profileTab === 'account' && (
                <div className="p-8 flex flex-col gap-5">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wider font-bold" style={{ color: '#364060' }}>{t('acct_username')}</span>
                    <TextInput placeholder={user.username} value={''} onChange={() => {}} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wider font-bold" style={{ color: '#364060' }}>{t('acct_email')}</span>
                    <TextInput placeholder={user.email ?? t('acct_not_set')} value={''} onChange={() => {}} type="email" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wider font-bold" style={{ color: '#364060' }}>{t('acct_new_pw')}</span>
                    <TextInput placeholder="••••••••" value={''} onChange={() => {}} type="password" />
                  </div>
                  {onOpenCabinet && (
                    <button onClick={() => { closeModal(); onOpenCabinet() }}
                      className="w-full rounded-xl font-bold text-base transition-all hover:brightness-110 mt-1 flex items-center justify-center"
                      style={{ height: 72, background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.25)', color: '#c9a84c' }}>
                      {t('acct_change_avatar')}
                    </button>
                  )}
                  <button disabled
                    className="w-full rounded-xl font-bold text-base opacity-40 cursor-not-allowed mt-1 flex items-center justify-center"
                    style={{ height: 72, background: '#c9a84c', color: '#07090e' }}>
                    {t('acct_save_soon')}
                  </button>
                </div>
              )}
            </>
          ) : (
            /* ── Guest: login / register ── */
            <div className="p-8 flex flex-col gap-6">
              <a href={`${API_URL}/api/auth/google`}
                className="w-full flex items-center justify-center gap-3 rounded-xl text-lg font-semibold transition-all hover:brightness-110"
                style={{ height: 80, background: '#fff', color: '#1a1a1a', textDecoration: 'none' }}>
                <svg width="16" height="16" viewBox="0 0 18 18">
                  <path fill="#4285F4" d="M17.64 9.2a10.34 10.34 0 0 0-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91a8.78 8.78 0 0 0 2.69-6.62z"/>
                  <path fill="#34A853" d="M9 18a8.59 8.59 0 0 0 5.96-2.18l-2.91-2.26a5.43 5.43 0 0 1-8.07-2.85H.96v2.34A9 9 0 0 0 9 18z"/>
                  <path fill="#FBBC05" d="M3.98 10.71a5.54 5.54 0 0 1 0-3.42V4.95H.96a9 9 0 0 0 0 8.1l3.02-2.34z"/>
                  <path fill="#EA4335" d="M9 3.58a4.86 4.86 0 0 1 3.44 1.35l2.58-2.58A8.64 8.64 0 0 0 9 0 9 9 0 0 0 .96 4.95l3.02 2.34A5.36 5.36 0 0 1 9 3.58z"/>
                </svg>
                {t('google_signin')}
              </a>
              <div className="flex items-center gap-2">
                <div className="flex-1" style={{ height: 1, background: '#1a2535' }} />
                <span className="text-[10px] uppercase tracking-wider" style={{ color: '#2e4060' }}>{t('or_divider')}</span>
                <div className="flex-1" style={{ height: 1, background: '#1a2535' }} />
              </div>
              <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid #1e2b40' }}>
                {['login', 'register'].map(m => (
                  <button key={m} onClick={() => { setAuthMode(m); setAuthErr('') }}
                    className="flex-1 text-sm font-bold uppercase tracking-widest transition-all flex items-center justify-center"
                    style={{ height: 64, background: authMode === m ? 'rgba(201,168,76,0.12)' : 'transparent', color: authMode === m ? '#c9a84c' : '#364060', borderRight: m === 'login' ? '1px solid #1e2b40' : 'none' }}>
                    {m === 'login' ? t('login') : t('register')}
                  </button>
                ))}
              </div>
              <TextInput placeholder={t('username_ph')} value={authUsername} autoFocus
                onChange={e => setAuthUsername(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAuthSubmit()} />
              {authMode === 'register' && (
                <TextInput placeholder={t('email_ph')} value={authEmail} type="email"
                  onChange={e => setAuthEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAuthSubmit()} />
              )}
              <TextInput placeholder={t('password_ph')} value={authPassword} type="password"
                onChange={e => setAuthPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAuthSubmit()} />
              {authErr && <p className="text-xs text-center" style={{ color: '#e05252' }}>{authErr}</p>}
              <button onClick={handleAuthSubmit} disabled={authBusy}
                className="w-full rounded-xl font-bold text-lg tracking-wide transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40 flex items-center justify-center"
                style={{ height: 80, background: '#c9a84c', color: '#07090e' }}>
                {authBusy ? '…' : authMode === 'login' ? t('login_btn') : t('register_btn')}
              </button>
              <p className="text-[10px] text-center" style={{ color: '#2e4060' }}>
                {t('play_as_guest')}
              </p>
            </div>
          )}
        </Modal>
      )}

      {/* ════════════════ TUTORIAL ════════════════ */}
      {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}

      {/* ════════════════ LOBBY CHAT ════════════════ */}
      {setLobbyChatOpen && (
        <LobbyChatPanel
          socket={socket}
          messages={lobbyMessages}
          open={lobbyChatOpen}
          setOpen={setLobbyChatOpen}
        />
      )}
    </div>
  )
}
