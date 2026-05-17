import Card from './Card'
import { useT } from '../context/LangContext'
import { PRESET_AVATARS } from './Cabinet'

const TURN_ARROW = { bottom: '▲', top: '▼', left: '▶', right: '◀' }

const FAN_STEP  = 20
const FAN_ANGLE = 4

const BADGE_WIDTH         = 172
const BADGE_WIDTH_COMPACT = 92

const fmtScore = (v) => {
  if (v == null) return null
  if (v === 0) return '0'
  const f = v / 100
  return (Number.isInteger(f) ? String(f) : f.toFixed(1))
}

function FaceDownFan({ count, rotation = 0 }) {
  const n    = Math.min(Math.max(count, 0), 9)
  const mid  = (n - 1) / 2
  const fanW = n > 0 ? (n - 1) * FAN_STEP + 48 : 60
  const fanH = 88

  const isVertical = rotation === 90 || rotation === -90
  const wrapperW   = isVertical ? fanH : fanW
  const wrapperH   = isVertical ? fanW : fanH

  const cardEls = Array.from({ length: n }).map((_, i) => (
    <div key={i} style={{
      position:        'absolute',
      bottom:          0,
      left:            '50%',
      transform:       `translateX(calc(-50% + ${(i - mid) * FAN_STEP}px)) rotate(${(i - mid) * FAN_ANGLE}deg)`,
      transformOrigin: 'bottom center',
      zIndex:          i + 1,
    }}>
      <Card faceDown small />
    </div>
  ))

  return (
    <div style={{ position: 'relative', width: wrapperW, height: wrapperH, flexShrink: 0, overflow: 'visible' }}>
      {rotation === 0 ? cardEls : (
        <div style={{
          position:  'absolute',
          width:     fanW,
          height:    fanH,
          top:       '50%',
          left:      '50%',
          transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
        }}>
          {cardEls}
        </div>
      )}
    </div>
  )
}

function bidTrickColor(bid, trickCount, cardsInRound, totalTricksPlayed) {
  if (bid == null || trickCount == null || totalTricksPlayed === 0) return '#9ca3af'
  if (trickCount > bid) return '#ef4444'
  if (trickCount === bid) return '#4ade80'
  const remaining = (cardsInRound ?? 0) - totalTricksPlayed
  const needed    = bid - trickCount
  if (needed > remaining) return '#ef4444'
  return '#9ca3af'
}

function TrickDots({ bid, taken, statColor }) {
  const bidVal   = bid   ?? 0
  const takenVal = taken ?? 0
  const total    = Math.max(bidVal, takenVal)
  if (total === 0) return null
  return (
    <div style={{ display: 'flex', gap: 2, marginTop: 3, flexWrap: 'nowrap' }}>
      {Array.from({ length: total }, (_, i) => {
        const filled  = i < takenVal
        const overBid = filled && i >= bidVal
        const color   = overBid ? '#ef4444' : filled ? statColor : 'transparent'
        const border  = overBid ? '#ef4444' : filled ? statColor : '#2a2a3a'
        return (
          <div key={i} style={{
            width:        5,
            height:       5,
            borderRadius: '50%',
            background:   color,
            border:       `1px solid ${border}`,
            flexShrink:   0,
            transition:   'background 0.2s, border-color 0.2s',
          }} />
        )
      })}
    </div>
  )
}

export default function PlayerSeat({ player, position, isCurrentTurn, bid, trickCount, cardCount = 0, isDealer = false, isFirstPlayer = false, cardsInRound, totalTricksPlayed = 0, compact = false, mini = false, onClickPlayer = null, gameScore = null, timerCountdown = null }) {
  const t = useT()
  const isLeft = position === 'left'
  const count  = Math.min(Math.max(cardCount, 0), 9)

  const presetEmoji = !player?.isBot && player?.avatarId ? (PRESET_AVATARS[player.avatarId] ?? null) : null
  const initials    = player?.isBot ? '🤖' : (presetEmoji ?? (player?.name?.[0]?.toUpperCase() ?? '?'))
  const statColor = bidTrickColor(bid, trickCount, cardsInRound, totalTricksPlayed)
  const statStr   = `${bid ?? '–'}/${trickCount != null ? trickCount : '–'}`

  const timerUrgent  = isCurrentTurn && timerCountdown !== null && timerCountdown <= 5
  const activeColor  = timerUrgent ? '#ef4444' : '#c9a84c'
  const activeGlow   = timerUrgent ? 'rgba(239,68,68,0.25)' : 'rgba(201,168,76,0.2)'

  if (mini) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        padding: '4px 6px', borderRadius: '0.5rem', minWidth: 60, maxWidth: 80,
        background: isCurrentTurn ? 'rgba(20,20,26,0.95)' : 'rgba(20,20,26,0.80)',
        border: `1px solid ${isCurrentTurn ? activeColor : '#374151'}`,
        boxShadow: isCurrentTurn ? `0 4px 12px ${activeGlow}` : 'none',
      }}>
        <div style={{
          width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
          background: isCurrentTurn ? activeColor : '#374151',
          color: isCurrentTurn ? '#0a0a0f' : '#d1d5db',
          fontSize: presetEmoji ? 11 : 9, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {initials}
        </div>
        <span style={{ fontSize: 8, color: '#9ca3af', maxWidth: 68, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
          {player?.name ?? '–'}
        </span>
        <span style={{ fontSize: 9, fontWeight: 700, fontFamily: 'monospace', color: statColor }}>{statStr}</span>
      </div>
    )
  }

  const badgeW = compact ? BADGE_WIDTH_COMPACT : BADGE_WIDTH

  const canClick = !!(onClickPlayer && player && !player.isBot && player.userId)

  const badge = (
    <div
      onClick={canClick ? () => onClickPlayer(player) : undefined}
      className="rounded-xl backdrop-blur-sm transition-all flex-shrink-0"
      style={{
        width:   badgeW,
        padding: compact ? '5px 8px' : '10px 12px',
        cursor:  canClick ? 'pointer' : 'default',
        ...(isCurrentTurn
          ? { background: 'rgba(20,20,26,0.95)', outline: `2px solid ${activeColor}`, boxShadow: `0 8px 24px ${activeGlow}` }
          : { background: 'rgba(20,20,26,0.85)', outline: '1px solid #374151' })
      }}
    >
      <div className="flex items-center gap-1.5">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          {isDealer && !compact && (
            <div
              className="absolute -top-1 -right-1 z-10 w-4 h-4 rounded-full flex items-center justify-center font-black leading-none"
              style={{ background: '#c9a84c', color: '#0a0a0f', fontSize: 8 }}
            >
              D
            </div>
          )}
          <div
            className="rounded-full flex items-center justify-center font-bold"
            style={{
              width:      compact ? 28 : 36,
              height:     compact ? 28 : 36,
              fontSize:   presetEmoji ? (compact ? 14 : 18) : (compact ? 12 : 14),
              background: isCurrentTurn ? activeColor : '#374151',
              color:      isCurrentTurn ? '#0a0a0f' : '#d1d5db',
              transition: 'background 0.3s',
            }}
          >
            {initials}
          </div>
        </div>

        {compact ? (
          // Compact: avatar + stat only (no name)
          <div className="flex flex-col leading-none min-w-0">
            <span className="font-mono text-[10px] font-bold" style={{ color: statColor }}>{statStr}</span>
            {isCurrentTurn && <span className="text-[9px]" style={{ color: activeColor }}>{TURN_ARROW[position]}</span>}
          </div>
        ) : (
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="flex items-center gap-1">
              {isCurrentTurn && (
                <span className="text-xs font-black leading-none flex-shrink-0" style={{ color: activeColor }}>{TURN_ARROW[position]}</span>
              )}
              <span className="text-white font-semibold truncate" style={{ fontSize: 13 }}>
                {player?.name ?? '–'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-mono tracking-wide font-semibold" style={{ color: statColor }}>{statStr}</span>
              {isFirstPlayer && (
                <span className="text-[9px] font-semibold flex-shrink-0" style={{ color: '#c9a84c' }}>{t('goes_first')}</span>
              )}
              {gameScore != null && fmtScore(gameScore) !== null && (
                <span className="text-[10px] font-mono font-bold flex-shrink-0" style={{ color: gameScore < 0 ? '#ef4444' : '#c9a84c', marginLeft: 2 }}>
                  Σ{fmtScore(gameScore)}
                </span>
              )}
            </div>
            {/* Trick pips — only during playing phase (totalTricksPlayed > 0) */}
            {bid != null && totalTricksPlayed > 0 && (
              <TrickDots bid={bid} taken={trickCount ?? 0} statColor={statColor} />
            )}
          </div>
        )}
      </div>
    </div>
  )

  if (position === 'bottom') return badge

  if (position === 'top') {
    return (
      <div className="flex flex-col items-center gap-1">
        {badge}
        {!compact && <FaceDownFan count={count} rotation={180} />}
      </div>
    )
  }

  // Left/right: compact shows badge only (no fan); used as overlaid element
  if (compact) return badge

  return (
    <div className={`flex items-center gap-2 ${isLeft ? 'flex-row-reverse' : ''}`}>
      <FaceDownFan count={count} rotation={isLeft ? 90 : -90} />
      {badge}
    </div>
  )
}
