import { useState, useEffect } from 'react'
import { useT } from '../../context/LangContext'

export default function RoundEndOverlay({ data, players }) {
  const t = useT()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const fmt = (v) => {
    if (v == null) return '—'
    if (v === 0) return '0'
    const f    = v / 100
    const sign = v > 0 ? '+' : ''
    return sign + (Number.isInteger(f) ? String(f) : f.toFixed(1))
  }

  const sorted = [...players].sort((a, b) => (data.scores?.[b.id] ?? 0) - (data.scores?.[a.id] ?? 0))

  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ zIndex: 45, pointerEvents: 'none' }}
    >
      <div style={{
        background:     'rgba(8,8,12,0.93)',
        backdropFilter: 'blur(14px)',
        border:         '1px solid rgba(201,168,76,0.3)',
        borderRadius:   '1.25rem',
        padding:        '18px 22px',
        width:          'min(92vw, 320px)',
        opacity:        visible ? 1 : 0,
        transform:      visible ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.96)',
        transition:     'opacity 0.28s ease, transform 0.28s ease',
      }}>

        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <div style={{ color: 'rgba(201,168,76,0.55)', fontSize: 9, letterSpacing: '0.35em', textTransform: 'uppercase', marginBottom: 2 }}>
            {data.pulkaComplete
              ? `${t('pulka_complete')} · P${data.pulkaNumber}`
              : `${t('round_over')} · R${data.roundNumber}`}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7, paddingBottom: 5, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <span style={{ flex: 1, color: '#2a2a3a', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t('col_player')}</span>
          <span style={{ color: '#2a2a3a', fontSize: 9, width: 22, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t('col_bid')}</span>
          <span style={{ color: '#2a2a3a', fontSize: 9, width: 22, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t('col_got')}</span>
          <span style={{ color: '#2a2a3a', fontSize: 9, width: 38, textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t('col_score')}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {sorted.map(p => {
            const score  = data.scores?.[p.id] ?? 0
            const bid    = data.bids?.[p.id]
            const tricks = data.tricks?.[p.id] ?? 0
            const hit    = bid != null && bid === tricks
            const scoreColor = score > 0 ? '#4ade80' : score < 0 ? '#ef4444' : '#4a4a5a'
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ flex: 1, color: '#8a8a9a', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.isBot ? '🤖 ' : ''}{p.name}
                </span>
                <span style={{ color: hit ? '#c9a84c' : '#4a4a5a', fontSize: 11, width: 22, textAlign: 'center', fontWeight: hit ? 700 : 400 }}>
                  {bid ?? '—'}
                </span>
                <span style={{ color: '#6a6a8a', fontSize: 11, width: 22, textAlign: 'center' }}>
                  {tricks}
                </span>
                <span style={{ color: scoreColor, fontSize: 13, fontWeight: 700, width: 38, textAlign: 'right', fontFamily: 'monospace' }}>
                  {fmt(score)}
                </span>
              </div>
            )
          })}
        </div>

        {data.pulkaComplete && data.pulkaScores && (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(201,168,76,0.12)' }}>
            <div style={{ color: 'rgba(201,168,76,0.45)', fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase', textAlign: 'center', marginBottom: 8 }}>
              {t('pulka_total')}
            </div>
            <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
              {sorted.map(p => {
                const ps = data.pulkaScores?.[p.id]?.total ?? 0
                return (
                  <div key={p.id} style={{ textAlign: 'center', minWidth: 44 }}>
                    <div style={{ color: '#3a3a4a', fontSize: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 44 }}>
                      {p.name.slice(0, 5)}
                    </div>
                    <div style={{ color: ps >= 0 ? '#4ade80' : '#ef4444', fontSize: 14, fontWeight: 700, fontFamily: 'monospace' }}>
                      {fmt(ps)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
