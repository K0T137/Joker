import { useState } from 'react'
import { useT } from '../context/LangContext'
import { usePrefs } from '../context/PrefsContext'

const SUITS = ['♠', '♥', '♦', '♣']

export default function JokerActionPopup({ isFirst, onConfirm, onCancel }) {
  const t = useT()
  const { suitHex } = usePrefs()
  const [mode, setMode] = useState(null)
  const [suit, setSuit] = useState(null)

  const modes      = isFirst ? ['TAKE', 'GIVE'] : ['HIGH', 'LOW']
  const modeLabels = { TAKE: t('joker_mode_take'), GIVE: t('joker_mode_give'), HIGH: t('joker_mode_high'), LOW: t('joker_mode_low') }
  const modeDesc   = { TAKE: t('joker_take_desc'), GIVE: t('joker_give_desc'), HIGH: t('joker_high_desc'), LOW: t('joker_low_desc') }

  const needsSuit  = mode === 'TAKE' || mode === 'GIVE'
  const canConfirm = mode && (!needsSuit || suit)

  const handleMode = (m) => { setMode(m); setSuit(null) }

  return (
    <div
      style={{
        background:     'rgba(8,8,12,0.97)',
        border:         '1px solid rgba(201,168,76,0.4)',
        borderRadius:   '1rem',
        padding:        '16px',
        boxShadow:      '0 8px 40px rgba(0,0,0,0.7)',
        width:          240,
        maxWidth:       '92vw',
      }}
    >
      {/* Title */}
      <div style={{ color: 'rgba(201,168,76,0.7)', fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', textAlign: 'center', marginBottom: 12 }}>
        🃏 {t('joker_mode_title')}
      </div>

      {/* Description */}
      {mode && (
        <div style={{ color: '#4a4a5a', fontSize: 10, textAlign: 'center', marginBottom: 12, letterSpacing: '0.05em' }}>
          {modeDesc[mode]}
        </div>
      )}

      {/* Mode buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {modes.map(m => (
          <button
            key={m}
            onClick={() => handleMode(m)}
            style={{
              flex:          1,
              padding:       '10px 0',
              borderRadius:  '0.625rem',
              fontSize:      12,
              fontWeight:    700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor:        'pointer',
              transition:    'all 0.12s',
              border:        mode === m ? '1px solid #c9a84c' : '1px solid #2a2a38',
              background:    mode === m ? '#c9a84c' : '#1a1a24',
              color:         mode === m ? '#0a0a0f' : '#6a6a8a',
            }}
          >
            {modeLabels[m]}
          </button>
        ))}
      </div>

      {/* Suit picker */}
      {needsSuit && (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 12 }}>
          {SUITS.map(s => {
            const col        = suitHex(s)
            const isSelected = suit === s
            return (
              <button
                key={s}
                onClick={() => setSuit(s)}
                style={{
                  width:          52,
                  height:         52,
                  borderRadius:   '0.75rem',
                  cursor:         'pointer',
                  transition:     'all 0.15s',
                  border:         isSelected ? `2px solid ${col}` : '1px solid #2a2a38',
                  background:     isSelected ? `${col}28` : '#141420',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  boxShadow:      isSelected ? `0 0 12px ${col}55` : 'none',
                }}
              >
                <span style={{
                  fontSize:   28,
                  lineHeight: 1,
                  color:      isSelected ? col : col + '60',
                  filter:     isSelected ? `drop-shadow(0 0 4px ${col}88)` : 'none',
                  transition: 'all 0.15s',
                }}>
                  {s}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Action row */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onCancel}
          style={{
            flex: 1, padding: '9px 0', borderRadius: '0.625rem',
            background: '#1a1a24', border: '1px solid #2a2a38',
            color: '#4a4a5a', fontSize: 12, cursor: 'pointer',
          }}
        >
          {t('joker_cancel')}
        </button>
        <button
          onClick={() => canConfirm && onConfirm(mode, suit)}
          disabled={!canConfirm}
          style={{
            flex: 1, padding: '9px 0', borderRadius: '0.625rem',
            fontSize: 12, fontWeight: 700, cursor: canConfirm ? 'pointer' : 'not-allowed',
            transition: 'all 0.12s',
            background: canConfirm ? 'linear-gradient(135deg,#c9a84c,#a8893d)' : '#1a1a24',
            border:     canConfirm ? 'none' : '1px solid #2a2a38',
            color:      canConfirm ? '#0a0a0f' : '#2a2a3a',
            boxShadow:  canConfirm ? '0 2px 10px rgba(201,168,76,0.3)' : 'none',
          }}
        >
          {t('joker_play')}
        </button>
      </div>
    </div>
  )
}
