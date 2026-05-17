import { useT } from '../../context/LangContext'
import { usePrefs } from '../../context/PrefsContext'

export default function JokerAnnouncementOverlay({ data }) {
  const t = useT()
  const { suitHex, fourColor } = usePrefs()
  const suitColor = suitHex(data.suit)

  const GLOW_FOUR = { '♥': 'rgba(239,68,68,0.45)', '♦': 'rgba(59,130,246,0.45)', '♣': 'rgba(34,197,94,0.45)', '♠': 'rgba(232,213,163,0.25)' }
  const GLOW_NORM = { '♥': 'rgba(239,68,68,0.45)', '♦': 'rgba(239,68,68,0.45)', '♣': 'rgba(232,213,163,0.25)',  '♠': 'rgba(232,213,163,0.25)' }
  const glowRgba  = (fourColor ? GLOW_FOUR : GLOW_NORM)[data.suit] ?? 'rgba(232,213,163,0.25)'

  const modeKey = { TAKE: 'joker_mode_take', GIVE: 'joker_mode_give', HIGH: 'joker_mode_high', LOW: 'joker_mode_low' }[data.mode] ?? 'joker_mode_take'
  const descKey = { TAKE: 'joker_take_desc', GIVE: 'joker_give_desc', HIGH: 'joker_high_desc', LOW: 'joker_low_desc' }[data.mode] ?? 'joker_take_desc'

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 42 }}>
      <div style={{
        background:     'rgba(6,6,10,0.92)',
        backdropFilter: 'blur(10px)',
        border:         '1px solid rgba(201,168,76,0.35)',
        borderRadius:   '1.5rem',
        padding:        'clamp(14px, 2.5vw, 24px) clamp(20px, 5vw, 44px)',
        textAlign:      'center',
        boxShadow:      '0 0 60px rgba(0,0,0,0.6), 0 0 30px rgba(201,168,76,0.08)',
        width:          'min(92vw, 360px)',
      }}>
        <div style={{ color: '#5a5a6a', fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 6 }}>
          {data.playerName}
        </div>
        <div style={{ fontSize: 34, lineHeight: 1, marginBottom: 10 }}>🃏</div>
        <div style={{ color: '#c9a84c', fontSize: 24, fontWeight: 900, letterSpacing: '0.3em', textTransform: 'uppercase' }}>
          {t(modeKey)}
        </div>
        {data.suit && (
          <div style={{
            fontSize:   'clamp(44px, 14vw, 86px)',
            lineHeight: 1,
            color:      suitColor,
            marginTop:  8,
            textShadow: `0 0 40px ${glowRgba}`,
          }}>
            {data.suit}
          </div>
        )}
        <div style={{ color: '#3a3a4a', fontSize: 10, marginTop: 10, letterSpacing: '0.12em' }}>
          {t(descKey)}
        </div>
      </div>
    </div>
  )
}
