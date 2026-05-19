import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useT } from '../context/LangContext'

// Preset avatars: index 1-8
export const PRESET_AVATARS = ['', '🃏', '♠', '♥', '♦', '♣', '👑', '🎭', '⚡']

export function avatarDisplay(avatarId, avatarData, name) {
  if (avatarData) return { type: 'image', src: avatarData }
  const emoji = PRESET_AVATARS[avatarId] ?? null
  if (emoji) return { type: 'emoji', emoji }
  return { type: 'initial', initial: (name ?? '?')[0]?.toUpperCase() ?? '?' }
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#3a3a4a' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function TextInput({ value, onChange, type = 'text', placeholder, disabled }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      style={{
        width: '100%', boxSizing: 'border-box',
        padding: '10px 14px',
        background: '#0d0d12',
        border: '1px solid #252530',
        borderRadius: '0.625rem',
        color: disabled ? '#3a3a4a' : '#e8d5a3',
        fontSize: 13,
        caretColor: '#c9a84c',
        outline: 'none',
      }}
    />
  )
}

function Msg({ msg }) {
  if (!msg) return null
  return (
    <p style={{ fontSize: 12, textAlign: 'center', color: msg.ok ? '#4ade80' : '#e05252', margin: 0 }}>
      {msg.text}
    </p>
  )
}

function SaveBtn({ onClick, busy, label = 'Save Changes' }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      style={{
        width: '100%', padding: '12px 0',
        background: busy ? '#1e1e2a' : '#c9a84c',
        color: busy ? '#4a4a5a' : '#0a0a0f',
        fontWeight: 800, fontSize: 13, letterSpacing: '0.05em',
        border: 'none', borderRadius: '0.75rem', cursor: busy ? 'default' : 'pointer',
      }}
    >
      {busy ? '…' : label}
    </button>
  )
}

// ── Profile tab ────────────────────────────────────────────────────────────────
function ProfileTab({ profile }) {
  const { API_URL, updateUser } = useAuth()
  const [username,     setUsername]     = useState(profile?.username ?? '')
  const [email,        setEmail]        = useState(profile?.email ?? '')
  const [currentPass,  setCurrentPass]  = useState('')
  const [newPass,      setNewPass]      = useState('')
  const [confirmPass,  setConfirmPass]  = useState('')
  const [msg,          setMsg]          = useState(null)
  const [busy,         setBusy]         = useState(false)

  useEffect(() => {
    if (profile) { setUsername(profile.username ?? ''); setEmail(profile.email ?? '') }
  }, [profile])

  const save = async () => {
    setMsg(null)
    const body = {}
    if (username.trim() !== (profile?.username ?? '')) body.username = username.trim()
    if (email.trim() !== (profile?.email ?? ''))       body.email    = email.trim()
    if (newPass) {
      if (newPass !== confirmPass)  { setMsg({ ok: false, text: 'New passwords do not match' }); return }
      if (newPass.length < 4)       { setMsg({ ok: false, text: 'Password must be at least 4 characters' }); return }
      if (!currentPass)             { setMsg({ ok: false, text: 'Enter current password to change it' }); return }
      body.currentPassword = currentPass
      body.newPassword     = newPass
    }
    if (!Object.keys(body).length) { setMsg({ ok: false, text: 'Nothing changed' }); return }

    setBusy(true)
    try {
      const token = localStorage.getItem('joker_token')
      const res   = await fetch(`${API_URL}/api/profile`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setMsg({ ok: false, text: data.error ?? 'Error' }); return }
      updateUser(data.token)
      setCurrentPass(''); setNewPass(''); setConfirmPass('')
      setMsg({ ok: true, text: 'Saved!' })
    } catch {
      setMsg({ ok: false, text: 'Network error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Field label="Nickname">
        <TextInput value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" />
      </Field>
      <Field label="Email">
        <TextInput value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="email@example.com" />
      </Field>

      {profile?.has_password && (
        <>
          <div style={{ height: 1, background: '#1e1e2a' }} />
          <p style={{ fontSize: 10, color: '#3a3a4a', textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0 }}>Change Password</p>
          <Field label="Current Password">
            <TextInput value={currentPass} onChange={e => setCurrentPass(e.target.value)} type="password" placeholder="••••••" />
          </Field>
          <Field label="New Password">
            <TextInput value={newPass} onChange={e => setNewPass(e.target.value)} type="password" placeholder="••••••" />
          </Field>
          <Field label="Confirm New Password">
            <TextInput value={confirmPass} onChange={e => setConfirmPass(e.target.value)} type="password" placeholder="••••••" />
          </Field>
        </>
      )}

      <Msg msg={msg} />
      <SaveBtn onClick={save} busy={busy} />
    </div>
  )
}

// ── Avatar tab ─────────────────────────────────────────────────────────────────
function AvatarTab({ profile }) {
  const { API_URL, updateUser } = useAuth()
  const [selectedId,   setSelectedId]   = useState(profile?.avatar_id ?? 1)
  const [previewData,  setPreviewData]  = useState(profile?.avatar_data ?? null)
  const [useCustom,    setUseCustom]    = useState(!!profile?.avatar_data)
  const [msg,          setMsg]          = useState(null)
  const [busy,         setBusy]         = useState(false)
  const fileRef = useRef(null)

  const resizeImage = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const size   = 120
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = size
        const ctx    = canvas.getContext('2d')
        const scale  = Math.max(size / img.width, size / img.height)
        const w      = img.width  * scale
        const h      = img.height * scale
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      img.onerror = reject
      img.src = e.target.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setMsg({ ok: false, text: 'Please pick an image file' }); return }
    try {
      const data = await resizeImage(file)
      setPreviewData(data)
      setUseCustom(true)
      setMsg(null)
    } catch {
      setMsg({ ok: false, text: 'Could not load image' })
    }
  }

  const save = async () => {
    setMsg(null)
    setBusy(true)
    try {
      const token = localStorage.getItem('joker_token')
      const body  = useCustom && previewData
        ? { avatarData: previewData }
        : { avatarId: selectedId }

      const res  = await fetch(`${API_URL}/api/profile/avatar`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setMsg({ ok: false, text: data.error ?? 'Error' }); return }
      updateUser(data.token)
      setMsg({ ok: true, text: 'Avatar saved!' })
    } catch {
      setMsg({ ok: false, text: 'Network error' })
    } finally {
      setBusy(false)
    }
  }

  const currentEmoji = useCustom ? null : (PRESET_AVATARS[selectedId] ?? '🃏')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center' }}>
      {/* Preview */}
      <div style={{
        width: 88, height: 88, borderRadius: '50%',
        background: '#1a1a24', border: '2px solid #c9a84c',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', flexShrink: 0,
      }}>
        {useCustom && previewData
          ? <img src={previewData} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: 42 }}>{currentEmoji}</span>
        }
      </div>

      {/* Preset grid */}
      <div style={{ width: '100%' }}>
        <p style={{ fontSize: 10, color: '#3a3a4a', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 10px' }}>Preset Avatars</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {PRESET_AVATARS.slice(1).map((emoji, i) => {
            const id       = i + 1
            const selected = !useCustom && selectedId === id
            return (
              <button
                key={id}
                onClick={() => { setSelectedId(id); setUseCustom(false) }}
                style={{
                  height: 54, borderRadius: '0.75rem', fontSize: 28,
                  background: selected ? 'rgba(201,168,76,0.15)' : '#1a1a24',
                  border:     `2px solid ${selected ? '#c9a84c' : '#252530'}`,
                  cursor: 'pointer', transition: 'all 0.12s',
                }}
              >
                {emoji}
              </button>
            )
          })}
        </div>
      </div>

      {/* Custom upload */}
      <div style={{ width: '100%' }}>
        <p style={{ fontSize: 10, color: '#3a3a4a', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 8px' }}>Custom Photo</p>
        <button
          onClick={() => fileRef.current?.click()}
          style={{
            width: '100%', padding: '11px 0',
            background: '#1a1a24', border: `1px dashed ${useCustom ? '#c9a84c' : '#252530'}`,
            borderRadius: '0.75rem', color: useCustom ? '#c9a84c' : '#4a4a5a',
            fontSize: 12, cursor: 'pointer',
          }}
        >
          {useCustom ? '📷 Change photo' : '📷 Upload photo'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
        <p style={{ fontSize: 10, color: '#2a2a38', marginTop: 5, textAlign: 'center' }}>
          Resized to 120×120 in browser — no file stored on server
        </p>
      </div>

      <Msg msg={msg} />
      <SaveBtn onClick={save} busy={busy} label="Save Avatar" />
    </div>
  )
}

// ── Friends tab ────────────────────────────────────────────────────────────────
export function FriendsTab({ onlineMap }) {
  const { user, API_URL } = useAuth()
  const t = useT()
  const [section,    setSection]    = useState('friends')  // 'friends'|'pending'|'blocked'
  const [friends,    setFriends]    = useState([])
  const [pending,    setPending]    = useState({ incoming: [], outgoing: [] })
  const [blocked,    setBlocked]    = useState([])
  const [search,     setSearch]     = useState('')
  const [results,    setResults]    = useState(null)  // null = not searched yet
  const [busy,       setBusy]       = useState({})
  const [msg,        setMsg]        = useState(null)

  const token = () => localStorage.getItem('joker_token')

  const load = async () => {
    if (!user?.id || !API_URL) return
    try {
      const [fr, pe, bl] = await Promise.all([
        fetch(`${API_URL}/api/friends`,         { headers: { Authorization: `Bearer ${token()}` } }).then(r => r.json()),
        fetch(`${API_URL}/api/friends/pending`,  { headers: { Authorization: `Bearer ${token()}` } }).then(r => r.json()),
        fetch(`${API_URL}/api/blocked`,          { headers: { Authorization: `Bearer ${token()}` } }).then(r => r.json()),
      ])
      setFriends(Array.isArray(fr) ? fr : [])
      setPending(pe?.incoming ? pe : { incoming: [], outgoing: [] })
      setBlocked(Array.isArray(bl) ? bl : [])
    } catch {}
  }

  useEffect(() => { load() }, [user?.id])

  const doSearch = async () => {
    if (!search.trim()) return
    try {
      const r = await fetch(`${API_URL}/api/users/search?q=${encodeURIComponent(search)}`,
        { headers: { Authorization: `Bearer ${token()}` } })
      setResults(await r.json())
    } catch {}
  }

  const act = async (action, id, extra = {}) => {
    setBusy(b => ({ ...b, [id]: true }))
    setMsg(null)
    try {
      let r
      if (action === 'add') {
        r = await fetch(`${API_URL}/api/friends/request`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
          body: JSON.stringify({ addresseeId: id }),
        })
      } else if (action === 'accept') {
        r = await fetch(`${API_URL}/api/friends/accept`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
          body: JSON.stringify({ requesterId: id }),
        })
      } else if (action === 'decline') {
        r = await fetch(`${API_URL}/api/friends/decline`, {
          method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
          body: JSON.stringify({ requesterId: id }),
        })
      } else if (action === 'remove') {
        r = await fetch(`${API_URL}/api/friends/${id}`, {
          method: 'DELETE', headers: { Authorization: `Bearer ${token()}` },
        })
      } else if (action === 'block') {
        r = await fetch(`${API_URL}/api/blocked`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
          body: JSON.stringify({ blockedId: id }),
        })
      } else if (action === 'unblock') {
        r = await fetch(`${API_URL}/api/blocked/${id}`, {
          method: 'DELETE', headers: { Authorization: `Bearer ${token()}` },
        })
      }
      if (r?.ok) {
        if (action === 'add') setMsg({ ok: true, text: t('friends_sent') })
        await load()
        if (action === 'add' && results) {
          // Refresh search results
          const r2 = await fetch(`${API_URL}/api/users/search?q=${encodeURIComponent(search)}`,
            { headers: { Authorization: `Bearer ${token()}` } })
          setResults(await r2.json())
        }
      }
    } catch {} finally {
      setBusy(b => ({ ...b, [id]: false }))
    }
  }

  const pendingCount = pending.incoming.length

  const friendIds   = new Set(friends.map(f => f.id))
  const outgoingIds = new Set(pending.outgoing.map(f => f.id))
  const blockedIds  = new Set(blocked.map(b => b.id))

  const btnStyle = (color = '#c9a84c') => ({
    padding: '4px 10px', fontSize: 11, fontWeight: 700, border: 'none',
    borderRadius: '0.5rem', cursor: 'pointer', background: color === 'red' ? '#3a1a1a' : color === 'blue' ? '#1a2a3a' : '#1e1e2a',
    color: color === 'red' ? '#e05252' : color === 'blue' ? '#4a9fe8' : '#c9a84c',
  })

  const PersonRow = ({ person, showStatus = false, children }) => {
    const isOnline = onlineMap && onlineMap[person.id]
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #1a1a26' }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%', background: '#1a1a2a',
          border: '1px solid #252535', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, flexShrink: 0,
        }}>
          {String.fromCodePoint(0x1F3B4)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#e8d5a3', fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {person.username}
          </div>
          {showStatus && (
            <div style={{ fontSize: 10, color: isOnline ? '#4ade80' : '#3a3a4a' }}>
              {isOnline ? t('friends_online') : t('friends_offline')}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>{children}</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 4 }}>
        {[
          { id: 'friends', label: t('friends') },
          { id: 'pending', label: `${t('friends_pending')}${pendingCount ? ` (${pendingCount})` : ''}` },
          { id: 'blocked', label: t('friends_blocked') },
        ].map(({ id, label }) => (
          <button key={id} onClick={() => setSection(id)} style={{
            padding: '5px 10px', fontSize: 11, fontWeight: 700, border: 'none',
            borderRadius: '0.5rem', cursor: 'pointer',
            background: section === id ? '#1e1e2a' : 'transparent',
            color: section === id ? '#c9a84c' : '#3a3a4a',
          }}>{label}</button>
        ))}
      </div>

      {/* Search bar (always visible) */}
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && doSearch()}
          placeholder={t('friends_search_ph')}
          style={{
            flex: 1, padding: '8px 12px', background: '#0d0d12',
            border: '1px solid #252530', borderRadius: '0.625rem',
            color: '#e8d5a3', fontSize: 12, outline: 'none', caretColor: '#c9a84c',
          }}
        />
        <button onClick={doSearch} style={{
          padding: '8px 14px', background: '#1e1e2a', border: '1px solid #252530',
          borderRadius: '0.625rem', color: '#c9a84c', fontSize: 12, fontWeight: 700, cursor: 'pointer',
        }}>{t('friends_search_btn')}</button>
      </div>

      {/* Search results */}
      {results !== null && (
        <div>
          {results.length === 0 ? (
            <p style={{ fontSize: 12, color: '#3a3a4a', textAlign: 'center', margin: 0 }}>—</p>
          ) : results.map(u => (
            <PersonRow key={u.id} person={u}>
              {blockedIds.has(u.id) ? (
                <button style={btnStyle('red')} disabled={busy[u.id]} onClick={() => act('unblock', u.id)}>
                  {t('friends_unblock')}
                </button>
              ) : friendIds.has(u.id) ? (
                <span style={{ fontSize: 11, color: '#4ade80' }}>✓</span>
              ) : outgoingIds.has(u.id) ? (
                <span style={{ fontSize: 11, color: '#3a3a4a' }}>{t('friends_sent')}</span>
              ) : (
                <button style={btnStyle()} disabled={busy[u.id]} onClick={() => act('add', u.id)}>
                  {t('friends_add')}
                </button>
              )}
            </PersonRow>
          ))}
        </div>
      )}

      {msg && <p style={{ fontSize: 12, color: msg.ok ? '#4ade80' : '#e05252', textAlign: 'center', margin: 0 }}>{msg.text}</p>}

      {/* Friends section */}
      {section === 'friends' && (
        <div>
          {friends.length === 0 ? (
            <p style={{ fontSize: 12, color: '#3a3a4a', textAlign: 'center', margin: '12px 0' }}>{t('friends_none')}</p>
          ) : friends.map(f => (
            <PersonRow key={f.id} person={f} showStatus>
              <button style={btnStyle('red')} disabled={busy[f.id]} onClick={() => act('block', f.id)}>
                {t('friends_block')}
              </button>
              <button style={btnStyle()} disabled={busy[f.id]} onClick={() => act('remove', f.id)}>
                {t('friends_remove')}
              </button>
            </PersonRow>
          ))}
        </div>
      )}

      {/* Pending section */}
      {section === 'pending' && (
        <div>
          {pending.incoming.length > 0 && (
            <>
              <p style={{ fontSize: 10, color: '#3a3a4a', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '8px 0 4px' }}>
                {t('friends_req_in')}
              </p>
              {pending.incoming.map(u => (
                <PersonRow key={u.id} person={u}>
                  <button style={btnStyle('blue')} disabled={busy[u.id]} onClick={() => act('accept', u.id)}>{t('friends_accept')}</button>
                  <button style={btnStyle('red')} disabled={busy[u.id]} onClick={() => act('decline', u.id)}>{t('friends_decline')}</button>
                </PersonRow>
              ))}
            </>
          )}
          {pending.outgoing.length > 0 && (
            <>
              <p style={{ fontSize: 10, color: '#3a3a4a', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '8px 0 4px' }}>
                {t('friends_sent')}
              </p>
              {pending.outgoing.map(u => (
                <PersonRow key={u.id} person={u}>
                  <span style={{ fontSize: 11, color: '#3a3a4a' }}>…</span>
                </PersonRow>
              ))}
            </>
          )}
          {pending.incoming.length === 0 && pending.outgoing.length === 0 && (
            <p style={{ fontSize: 12, color: '#3a3a4a', textAlign: 'center', margin: '12px 0' }}>—</p>
          )}
        </div>
      )}

      {/* Blocked section */}
      {section === 'blocked' && (
        <div>
          {blocked.length === 0 ? (
            <p style={{ fontSize: 12, color: '#3a3a4a', textAlign: 'center', margin: '12px 0' }}>—</p>
          ) : blocked.map(u => (
            <PersonRow key={u.id} person={u}>
              <button style={btnStyle('blue')} disabled={busy[u.id]} onClick={() => act('unblock', u.id)}>
                {t('friends_unblock')}
              </button>
            </PersonRow>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Cabinet modal ─────────────────────────────────────────────────────────
const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'avatar',  label: 'Avatar'  },
  { id: 'friends', label: 'Friends' },
]

export default function Cabinet({ onClose, onlineMap = {} }) {
  const { user, API_URL } = useAuth()
  const [tab,     setTab]     = useState('profile')
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    setLoading(true)
    const token = localStorage.getItem('joker_token')
    fetch(`${API_URL}/api/profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => setProfile(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user?.id, API_URL])

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 8000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: '#13131a', border: '1px solid #2a2a38',
        borderRadius: '1.5rem', width: '100%', maxWidth: 440,
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        margin: '0 16px', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 22px 14px',
          borderBottom: '1px solid #1e1e2a',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ color: '#e8d5a3', fontWeight: 900, fontSize: 14, letterSpacing: '0.12em' }}>
              MY CABINET
            </div>
            {user && (
              <div style={{ color: '#3a3a4a', fontSize: 11, marginTop: 2 }}>{user.username}</div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ color: '#3a3a4a', background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: '2px 6px' }}
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 4, padding: '10px 16px 0',
          borderBottom: '1px solid #1e1e2a', flexShrink: 0,
        }}>
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                padding: '7px 16px', border: 'none', cursor: 'pointer',
                borderRadius: '0.5rem 0.5rem 0 0', fontSize: 12, fontWeight: 700,
                background: tab === id ? '#1e1e2a' : 'transparent',
                color:      tab === id ? '#c9a84c' : '#3a3a4a',
                letterSpacing: '0.05em',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px 24px' }}>
          {!user ? (
            <p style={{ textAlign: 'center', color: '#3a3a4a', fontSize: 12, marginTop: 24 }}>
              Log in to manage your profile
            </p>
          ) : loading ? (
            <p style={{ textAlign: 'center', color: '#3a3a4a', fontSize: 12, marginTop: 24 }}>…</p>
          ) : (
            <>
              {tab === 'profile' && <ProfileTab profile={profile} />}
              {tab === 'avatar'  && <AvatarTab  profile={profile} />}
              {tab === 'friends' && <FriendsTab onlineMap={onlineMap} />}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
