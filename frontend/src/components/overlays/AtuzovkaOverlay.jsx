import { useState, useEffect } from 'react'
import Card from '../Card'
import { useT } from '../../context/LangContext'

function DealtCard({ cardId, targetPos, stackIndex, isAce }) {
  const [arrived, setArrived] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setArrived(true), 30)
    return () => clearTimeout(t)
  }, [])

  const xOff = stackIndex * 4
  const yOff = stackIndex * 2

  return (
    <div style={{
      position:   'absolute',
      left:       arrived ? `calc(${targetPos.left} + ${xOff}px)` : '50%',
      top:        arrived ? `calc(${targetPos.top} + ${yOff}px)`  : '50%',
      transform:  'translate(-50%, -50%)',
      transition: arrived ? 'left 0.32s ease-out, top 0.32s ease-out' : 'none',
      zIndex:     isAce ? 15 : 10 + stackIndex,
    }}>
      {isAce
        ? <div style={{ filter: 'drop-shadow(0 0 14px rgba(201,168,76,0.9))' }}><Card cardId={cardId} /></div>
        : <Card cardId={cardId} />
      }
    </div>
  )
}

export default function AtuzovkaOverlay({ data, players, myIndex }) {
  const t = useT()
  const [visibleCount, setVisibleCount] = useState(0)
  const [showDealer,   setShowDealer]   = useState(false)

  const drawnCards = data.drawnCards ?? []
  const total      = drawnCards.length

  useEffect(() => {
    if (visibleCount >= total && total > 0) {
      const id = setTimeout(() => setShowDealer(true), 900)
      return () => clearTimeout(id)
    }
    if (visibleCount < total) {
      const id = setTimeout(() => setVisibleCount(v => v + 1), 380)
      return () => clearTimeout(id)
    }
  }, [visibleCount, total])

  const SEAT_POS = {
    bottom: { top: '82%', left: '50%' },
    left:   { top: '50%', left: '12%' },
    top:    { top: '18%', left: '50%' },
    right:  { top: '50%', left: '88%' },
  }

  const getPos = (playerIndex) => {
    const offset   = (playerIndex - myIndex + 4) % 4
    const seatName = ['bottom', 'left', 'top', 'right'][offset]
    return SEAT_POS[seatName]
  }

  const seatCounts = {}
  const annotated  = drawnCards.slice(0, visibleCount).map((dc, i) => {
    const count = seatCounts[dc.playerIndex] ?? 0
    seatCounts[dc.playerIndex] = count + 1
    return { ...dc, stackIndex: count, isAce: i === total - 1 }
  })

  if (!total) {
    return (
      <div className="absolute inset-0 z-50 flex flex-col items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.90)', backdropFilter: 'blur(10px)' }}>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, letterSpacing: '0.35em', textTransform: 'uppercase', marginBottom: 32 }}>
          ატუზვა · {t('drawing_dealer')}
        </p>
        <div style={{ fontFamily: "'Playfair Display', Georgia, serif", color: '#e8d5a3', fontSize: 28, fontWeight: 900 }}>
          {data.dealerName}
        </div>
        <div style={{ color: '#c9a84c', fontSize: 12, letterSpacing: '0.25em', textTransform: 'uppercase', marginTop: 8 }}>
          {t('is_dealer')}
        </div>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 z-50">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.87)', backdropFilter: 'blur(8px)' }} />

      <div style={{ position: 'absolute', top: '6%', left: '50%', transform: 'translateX(-50%)', textAlign: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.30)', fontSize: 10, letterSpacing: '0.35em', textTransform: 'uppercase' }}>
          ატუზვა · {t('drawing_dealer')}
        </p>
      </div>

      {visibleCount < total && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 5 }}>
          <Card faceDown />
        </div>
      )}

      {annotated.map((dc, i) => (
        <DealtCard
          key={i}
          cardId={dc.card}
          targetPos={getPos(dc.playerIndex)}
          stackIndex={dc.stackIndex}
          isAce={dc.isAce}
        />
      ))}

      <div style={{
        position:      'absolute',
        top:           '50%',
        left:          '50%',
        transform:     'translate(-50%, -50%)',
        textAlign:     'center',
        zIndex:        20,
        opacity:       showDealer ? 1 : 0,
        transition:    'opacity 0.6s ease',
        pointerEvents: 'none',
      }}>
        <div style={{
          background:   'rgba(8,8,12,0.88)',
          border:       '1px solid rgba(201,168,76,0.4)',
          borderRadius: '1rem',
          padding:      '22px 48px',
        }}>
          <div style={{ color: '#e8d5a3', fontSize: 28, fontWeight: 900, fontFamily: "'Playfair Display', Georgia, serif" }}>
            {data.dealerName}
          </div>
          <div style={{ color: '#c9a84c', fontSize: 11, letterSpacing: '0.25em', textTransform: 'uppercase', marginTop: 8 }}>
            {t('is_dealer')}
          </div>
        </div>
      </div>
    </div>
  )
}
