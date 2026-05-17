import { useState, useEffect } from 'react'
import { useT } from '../../context/LangContext'

const TIMEOUT = 30

export default function RematchToast({ invite, onAccept, onDismiss }) {
  const t = useT()
  const [secondsLeft, setSecondsLeft] = useState(TIMEOUT)

  useEffect(() => {
    const iv = setInterval(() => setSecondsLeft(s => {
      if (s <= 1) { onDismiss(); return 0 }
      return s - 1
    }), 1000)
    return () => clearInterval(iv)
  }, [onDismiss])

  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, display: 'flex', alignItems: 'center', gap: 12,
      background: 'rgba(8,8,18,0.97)', border: '1px solid #1a3a6e',
      borderRadius: 14, padding: '12px 16px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      minWidth: 280, maxWidth: 'min(92vw, 360px)',
    }}>
      <div style={{ fontSize: 22 }}>📨</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#4a9fe8', marginBottom: 2 }}>
          {invite.inviterName} {t('rematch_invite_from') || 'invites you to rematch'}
        </div>
        <div style={{ fontSize: 11, color: '#4a5570' }}>{secondsLeft}s</div>
      </div>
      <button onClick={onAccept}
        style={{ padding: '7px 14px', borderRadius: 9, background: '#4a9fe8', color: '#fff', fontWeight: 700, fontSize: 12, border: 'none', cursor: 'pointer' }}>
        {t('rematch_accept') || 'Join'}
      </button>
      <button onClick={onDismiss}
        style={{ padding: '7px 10px', borderRadius: 9, background: '#0a1422', color: '#4a5570', fontSize: 12, border: '1px solid #1a2840', cursor: 'pointer' }}>
        ✕
      </button>
    </div>
  )
}
