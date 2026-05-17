import Card from './Card'

const SLOT_POS = {
  bottom: { bottom: '30%', left: '50%' },
  top:    { top: '30%',    left: '50%' },
  left:   { left: '30%',   top: '50%'  },
  right:  { right: '30%',  top: '50%'  },
}

const SLOT_POS_COMPACT = {
  bottom: { bottom: '28%', left: '50%' },
  top:    { top: '28%',    left: '50%' },
  left:   { left: '18%',   top: '50%'  },
  right:  { right: '18%',  top: '50%'  },
}

const SLOT_POS_PORTRAIT = {
  bottom: { bottom: '16%', left: '50%' },
  top:    { top: '16%',    left: '50%' },
  left:   { left: '18%',   top: '44%'  },
  right:  { right: '18%',  top: '44%'  },
}

const BASE_T = {
  bottom: 'translateX(-50%)',
  top:    'translateX(-50%)',
  left:   'translateY(-50%)',
  right:  'translateY(-50%)',
}

const SEAT_ROTATE = { bottom: 3, top: -3, left: -6, right: 6 }

const COLLECT_EXTRA_DX = { bottom: 0,    top: 0,    left: -200, right: 200 }
const COLLECT_EXTRA_DY = { bottom: 200,  top: -200, left: 0,    right: 0   }

const SEATS = ['bottom', 'left', 'top', 'right']

function JokerBadge({ jokerMode, takeSuit, giveSuit, seat }) {
  const suit = takeSuit ?? giveSuit ?? ''
  const label = `🃏 ${jokerMode}${suit ? ' ' + suit : ''}`

  // Position the badge above (for bottom) or below (for top) or beside (for sides) the card
  const isTop    = seat === 'top'
  const isBottom = seat === 'bottom'
  const isLeft   = seat === 'left'

  const style = {
    position:   'absolute',
    zIndex:     30,
    whiteSpace: 'nowrap',
    background: 'rgba(8,8,12,0.92)',
    border:     '1px solid rgba(201,168,76,0.6)',
    borderRadius: '0.4rem',
    padding:    '2px 7px',
    fontSize:   10,
    fontWeight: 700,
    color:      '#c9a84c',
    letterSpacing: '0.05em',
    pointerEvents: 'none',
  }

  if (isBottom) {
    style.bottom = '106%'
    style.left   = '50%'
    style.transform = 'translateX(-50%)'
  } else if (isTop) {
    style.top  = '106%'
    style.left = '50%'
    style.transform = 'translateX(-50%)'
  } else if (isLeft) {
    style.left = '106%'
    style.top  = '50%'
    style.transform = 'translateY(-50%)'
  } else {
    style.right = '106%'
    style.top   = '50%'
    style.transform = 'translateY(-50%)'
  }

  return <div style={style}>{label}</div>
}

export default function TrickArea({
  currentTrick  = [],
  seatOrder,
  trickWinnerId = null,
  isCollecting  = false,
  compact       = false,
  portrait      = false,
}) {
  const slotPos = portrait ? SLOT_POS_PORTRAIT : compact ? SLOT_POS_COMPACT : SLOT_POS
  const seatMap = {
    [seatOrder?.[0]]: 'bottom',
    [seatOrder?.[1]]: 'left',
    [seatOrder?.[2]]: 'top',
    [seatOrder?.[3]]: 'right',
  }

  const winnerSeat = trickWinnerId ? seatMap[trickWinnerId] : null

  return (
    <div className="absolute inset-0">
      {SEATS.map(seat => {
        const play      = currentTrick.find(p => seatMap[p.playerId] === seat)
        const playOrder = play ? currentTrick.indexOf(play) : -1
        const isWinner  = !!(play && trickWinnerId && play.playerId === trickWinnerId)

        const collectDx = winnerSeat ? COLLECT_EXTRA_DX[winnerSeat] : 0
        const collectDy = winnerSeat ? COLLECT_EXTRA_DY[winnerSeat] : 0
        const tf = isCollecting && winnerSeat
          ? `${BASE_T[seat]} translate(${collectDx}px, ${collectDy}px)`
          : BASE_T[seat]

        const hasJokerAnnotation = play?.jokerMode && play.jokerMode !== 'NORMAL'

        return (
          <div
            key={seat}
            className="absolute"
            style={{
              ...slotPos[seat],
              zIndex:     playOrder >= 0 ? playOrder + 1 : 0,
              transform:  tf,
              opacity:    isCollecting ? 0 : 1,
              transition: 'transform 300ms ease-in, opacity 280ms ease-in',
            }}
          >
            {play ? (
              <div style={{ position: 'relative' }}>
                {hasJokerAnnotation && (
                  <JokerBadge
                    jokerMode={play.jokerMode}
                    takeSuit={play.takeSuit}
                    giveSuit={play.giveSuit}
                    seat={seat}
                  />
                )}
                {/* key forces remount → animation replays each time a new card lands */}
                <div
                  key={play.card}
                  style={{ animation: `card-fly-in-${seat} 0.26s cubic-bezier(0.22,0.8,0.32,1) both` }}
                >
                  <div
                    style={{
                      transform:  `rotate(${SEAT_ROTATE[seat]}deg) scale(${isWinner ? 1.12 : 1})`,
                      transition: 'transform 220ms ease-out, filter 220ms ease-out',
                      filter: isWinner
                        ? 'drop-shadow(0 0 10px rgba(250,204,21,0.8)) drop-shadow(0 4px 8px rgba(0,0,0,0.6))'
                        : 'drop-shadow(0 4px 10px rgba(0,0,0,0.7))',
                    }}
                  >
                    <Card cardId={play.card} medium />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
