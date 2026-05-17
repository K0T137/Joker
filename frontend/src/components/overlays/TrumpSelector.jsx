import { useT } from '../../context/LangContext'
import { usePrefs } from '../../context/PrefsContext'

export default function TrumpSelector({ onSelect, compact = false }) {
  const t = useT()
  const { suitHex } = usePrefs()
  const suits = [
    { id: '♠',       label: '♠',  color: suitHex('♠') },
    { id: '♥',       label: '♥',  color: suitHex('♥') },
    { id: '♦',       label: '♦',  color: suitHex('♦') },
    { id: '♣',       label: '♣',  color: suitHex('♣') },
    { id: 'NO_TRUMP', label: '🃏', color: '#c9a84c'    },
  ]

  const btnSize  = compact ? 46 : 60
  const fontSize = compact ? 26 : 36

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.72)' }}>
      <div style={{
        background:   'rgba(8,8,12,0.95)',
        border:       '1px solid rgba(201,168,76,0.4)',
        borderRadius: '1.25rem',
        padding:      compact ? '20px 20px' : '28px 36px',
        textAlign:    'center',
      }}>
        <div style={{ color: 'rgba(201,168,76,0.8)', fontSize: 10, letterSpacing: '0.35em', textTransform: 'uppercase', marginBottom: compact ? 14 : 20 }}>
          ატუზი · {t('pick_trump')}
        </div>
        <div style={{ display: 'flex', gap: compact ? 8 : 12 }}>
          {suits.map(s => (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              style={{
                fontSize, lineHeight: 1,
                width: btnSize, height: btnSize,
                borderRadius: '0.75rem',
                background:   '#1a1a24',
                border:       '1px solid #2a2a38',
                color:        s.color,
                cursor:       'pointer',
                transition:   'border-color 0.15s, transform 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#c9a84c'; e.currentTarget.style.transform = 'scale(1.08)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a38'; e.currentTarget.style.transform = 'scale(1)' }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
