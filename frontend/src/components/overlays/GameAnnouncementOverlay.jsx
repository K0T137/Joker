import { useT } from '../../context/LangContext'

export default function GameAnnouncementOverlay({ data }) {
  const t = useT()
  const isShetenva  = data.type === 'shetenva'
  const georgianName = isShetenva ? 'შეთენვა' : 'წაგლეჯვა'
  const latinName    = isShetenva ? 'Shetenva' : 'Tsaglejva'

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
      <div style={{
        background:     'rgba(8,8,12,0.92)',
        backdropFilter: 'blur(16px)',
        border:         '1px solid rgba(201,168,76,0.35)',
        borderRadius:   '1.5rem',
        padding:        'clamp(20px, 3.5vw, 36px) clamp(24px, 7vw, 64px)',
        textAlign:      'center',
        boxShadow:      '0 0 80px rgba(201,168,76,0.12), 0 24px 48px rgba(0,0,0,0.6)',
        width:          'min(92vw, 400px)',
      }}>
        <div style={{ color: 'rgba(201,168,76,0.5)', fontSize: 10, letterSpacing: '0.35em', textTransform: 'uppercase', marginBottom: 16 }}>
          {georgianName} · {latinName}
        </div>
        <div style={{
          color:      '#c9a84c',
          fontSize:   'clamp(48px, 16vw, 88px)',
          fontWeight: 900,
          fontFamily: "'Playfair Display', Georgia, serif",
          lineHeight: 1,
        }}>
          {data.diff}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, marginTop: 12, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
          {isShetenva ? t('cards_minus_bids') : t('bids_minus_cards')}
        </div>
      </div>
    </div>
  )
}
