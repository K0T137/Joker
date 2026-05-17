import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'

const CARD_ANGLES = [-32, -16, 0, 16, 32]

const FEATURES = [
  { label: '36 cards', sub: '+ 2 jokers' },
  { label: '24 deals', sub: '4 stages'   },
  { label: '4 players', sub: 'or bots'   },
  { label: 'All rules', sub: 'faithful'  },
]

function CardFan() {
  return (
    <div className="relative mx-auto" style={{ width: 160, height: 88 }}>
      {CARD_ANGLES.map((angle, i) => (
        <div
          key={i}
          className="absolute bottom-0 left-1/2"
          style={{
            width: 46, height: 64,
            transform: `translateX(-50%) rotate(${angle}deg)`,
            transformOrigin: 'bottom center',
            borderRadius: 7,
            background: 'linear-gradient(145deg, #1b3560 0%, #142545 100%)',
            border: '1.5px solid #2d4f82',
            boxShadow: '0 6px 20px rgba(0,0,0,0.7)',
            backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.035) 0, rgba(255,255,255,0.035) 1px, transparent 0, transparent 50%)',
            backgroundSize: '7px 7px',
            zIndex: i === 2 ? 5 : i < 2 ? i : 4 - i,
          }}
        >
          {i === 2 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span style={{ color: '#c9a84c', fontSize: 22, opacity: 0.7 }}>✦</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function Input({ placeholder, value, onChange, onKeyDown, type = 'text', mono = false, autoFocus = false, readOnly = false }) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      autoFocus={autoFocus}
      readOnly={readOnly}
      onChange={onChange}
      onKeyDown={onKeyDown}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className={`w-full px-4 py-3 rounded-xl text-white text-sm focus:outline-none transition-all duration-150 ${mono ? 'font-mono tracking-widest uppercase' : ''} ${readOnly ? 'cursor-default opacity-70' : ''}`}
      style={{
        background: '#0d0d12',
        border: `1px solid ${focused && !readOnly ? '#c9a84c' : '#252530'}`,
        caretColor: '#c9a84c',
        color: '#e8d5a3',
        boxShadow: focused && !readOnly ? '0 0 0 3px rgba(201,168,76,0.12)' : 'none',
      }}
    />
  )
}

function GoogleButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full py-3.5 rounded-2xl font-bold text-sm tracking-wide transition-all duration-150 hover:brightness-110 active:scale-[0.98] flex items-center justify-center gap-2.5"
      style={{ background: '#fff', color: '#1a1a1a', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}
    >
      <svg width="18" height="18" viewBox="0 0 18 18">
        <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
        <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
        <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
        <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
      </svg>
      Continue with Google
    </button>
  )
}

const PENALTY_OPTIONS = [
  { value: 200,  label: '−200' },
  { value: 300,  label: '−300' },
  { value: 500,  label: '−500' },
  { value: 1000, label: '−1000' },
]

export default function JoinForm({ onCreateGame, onJoinGame }) {
  const { user, logout, API_URL } = useAuth()
  const [name,      setName]      = useState('')
  const [roomId,    setRoomId]    = useState('')
  const [mode,      setMode]      = useState(null)
  const [gameMode,  setGameMode]  = useState('normal')
  const [penalty,   setPenalty]   = useState(200)

  // Pre-fill name when Google user logs in
  useEffect(() => {
    if (user?.username) setName(user.username)
  }, [user])

  const handleGoogleLogin = () => {
    window.location.href = `${API_URL}/api/auth/google`
  }

  const create = () => {
    if (name.trim()) onCreateGame(name.trim(), null, { hishtPenalty: String(penalty), gameMode })
    else alert('Enter your name')
  }
  const join = () => {
    if (name.trim() && roomId.trim()) onJoinGame(roomId.trim(), name.trim())
    else alert('Enter your name and room code')
  }

  // Loading
  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#09090e' }}>
        <div className="w-8 h-8 rounded-full border-2 border-transparent" style={{ borderTopColor: '#c9a84c', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 50% 25%, #1c1406 0%, #09090e 65%)' }}
    >
      {/* Corner suit watermarks */}
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

      {/* Hero */}
      <div className="text-center mb-10 flex flex-col items-center">
        <CardFan />
        <div className="mt-6 mb-1">
          <h1
            className="text-5xl font-black tracking-[0.15em] leading-none"
            style={{ color: '#e8d5a3', fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            JOKER
          </h1>
          <p
            className="text-xl tracking-[0.25em] mt-0.5"
            style={{ color: '#c9a84c', fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700 }}
          >
            ჯოკერი
          </p>
        </div>
        <p className="text-[11px] uppercase tracking-[0.3em] mt-3" style={{ color: '#3e3e50' }}>
          Contract poker · Georgian style
        </p>
      </div>

      {/* Action panel */}
      <div className="w-full max-w-xs">

        {/* ── Auth gate: not signed in, no mode chosen ── */}
        {user === null && mode === null && (
          <div className="flex flex-col gap-3">
            <GoogleButton onClick={handleGoogleLogin} />
            <button
              onClick={() => setMode('create')}
              className="w-full py-3.5 rounded-2xl font-bold text-sm tracking-wide transition-all duration-150 hover:bg-amber-400/10 active:scale-[0.98]"
              style={{ color: '#c9a84c', border: '1.5px solid #c9a84c' }}
            >
              New Game
            </button>
            <button
              onClick={() => setMode('join')}
              className="w-full py-3 rounded-2xl text-sm tracking-wide transition-all duration-150 hover:brightness-110 active:scale-[0.98]"
              style={{ color: '#3e3e50' }}
            >
              Join Game
            </button>
          </div>
        )}

        {/* ── Signed in: show New Game / Join Game ── */}
        {user !== null && mode === null && (
          <div className="flex flex-col gap-3">
            {/* User badge */}
            <div
              className="flex items-center justify-between px-4 py-3 rounded-2xl mb-1"
              style={{ background: '#13131a', border: '1px solid #222230' }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ background: 'linear-gradient(135deg, #c9a84c 0%, #a8893d 100%)', color: '#0a0a0f' }}
                >
                  {user.username?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div>
                  <div className="text-xs font-bold" style={{ color: '#e8d5a3' }}>{user.username}</div>
                  {!user.isGuest && (
                    <div className="text-[10px]" style={{ color: '#3e3e50' }}>Google account</div>
                  )}
                </div>
              </div>
              <button
                onClick={logout}
                className="text-[10px] uppercase tracking-wider transition-colors hover:text-red-400"
                style={{ color: '#3e3e50' }}
              >
                sign out
              </button>
            </div>

            <button
              onClick={() => setMode('create')}
              className="w-full py-3.5 rounded-2xl font-bold text-sm tracking-wide transition-all duration-150 hover:brightness-110 active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, #c9a84c 0%, #a8893d 100%)',
                color: '#0a0a0f',
                boxShadow: '0 4px 24px rgba(201,168,76,0.35)',
              }}
            >
              New Game
            </button>
            <button
              onClick={() => setMode('join')}
              className="w-full py-3.5 rounded-2xl font-bold text-sm tracking-wide transition-all duration-150 hover:bg-amber-400/10 active:scale-[0.98]"
              style={{ color: '#c9a84c', border: '1.5px solid #c9a84c' }}
            >
              Join Game
            </button>
          </div>
        )}

        {/* ── Create / Join form ── */}
        {mode !== null && (
          <div
            className="rounded-2xl p-5 flex flex-col gap-3"
            style={{ background: '#13131a', border: '1px solid #222230' }}
          >
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#c9a84c' }}>
                {mode === 'create' ? 'New Game' : 'Join Game'}
              </span>
              <button
                onClick={() => { setMode(null); setRoomId('') }}
                className="text-xs transition-colors hover:text-white"
                style={{ color: '#3e3e50' }}
              >
                ← back
              </button>
            </div>

            <Input
              placeholder="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (mode === 'create' ? create() : join())}
              autoFocus={!user?.username}
              readOnly={!!user?.username && !user?.isGuest}
            />

            {mode === 'join' && (
              <Input
                placeholder="Room code"
                value={roomId}
                onChange={e => setRoomId(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && join()}
                mono
              />
            )}

            {mode === 'create' && (
              <div className="flex flex-col gap-2">
                {/* Game mode toggle */}
                <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid #252530' }}>
                  {[{v:'normal', label:'Classic'}, {v:'only9', label:'9s Only'}].map(({v, label}) => (
                    <button
                      key={v}
                      onClick={() => setGameMode(v)}
                      className="flex-1 py-2 text-xs font-semibold transition-all"
                      style={{
                        background: gameMode === v ? 'rgba(201,168,76,0.15)' : 'transparent',
                        color: gameMode === v ? '#c9a84c' : '#3e3e50',
                        borderRight: v === 'normal' ? '1px solid #252530' : 'none',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {/* Hisht penalty selector */}
                <div className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: '#0d0d12', border: '1px solid #252530' }}>
                  <span className="text-[10px] uppercase tracking-widest" style={{ color: '#3e3e50' }}>Hisht</span>
                  <div className="flex gap-1">
                    {PENALTY_OPTIONS.map(({value, label}) => (
                      <button
                        key={value}
                        onClick={() => setPenalty(value)}
                        className="px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all"
                        style={{
                          background: penalty === value ? 'rgba(201,168,76,0.18)' : 'transparent',
                          color: penalty === value ? '#c9a84c' : '#3e3e50',
                          border: penalty === value ? '1px solid rgba(201,168,76,0.35)' : '1px solid transparent',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={mode === 'create' ? create : join}
              className="w-full py-3 rounded-xl font-bold text-sm tracking-wide transition-all duration-150 hover:brightness-110 active:scale-[0.98] mt-1"
              style={{
                background: 'linear-gradient(135deg, #c9a84c 0%, #a8893d 100%)',
                color: '#0a0a0f',
                boxShadow: '0 4px 16px rgba(201,168,76,0.28)',
              }}
            >
              {mode === 'create' ? 'Create Game →' : 'Join →'}
            </button>

            {/* Sign in with Google if not authenticated */}
            {user === null && (
              <button
                onClick={handleGoogleLogin}
                className="w-full py-2 rounded-xl text-xs tracking-wide transition-all duration-150 hover:brightness-110 active:scale-[0.98] flex items-center justify-center gap-2"
                style={{ background: '#fff', color: '#444' }}
              >
                <svg width="14" height="14" viewBox="0 0 18 18">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                  <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
                </svg>
                Sign in with Google to save your stats
              </button>
            )}
          </div>
        )}
      </div>

      {/* Feature strip */}
      <div className="mt-10 flex items-center gap-0 w-full max-w-xs">
        {FEATURES.map((f, i) => (
          <div key={i} className="flex-1 text-center relative">
            {i > 0 && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-px h-6" style={{ background: '#1e1e28' }} />
            )}
            <div className="text-[11px] font-bold" style={{ color: '#a89060' }}>{f.label}</div>
            <div className="text-[10px] mt-0.5" style={{ color: '#2e2e3a' }}>{f.sub}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 w-24" style={{ height: 1, background: 'linear-gradient(to right, transparent, #2a2a38, transparent)' }} />
    </div>
  )
}
