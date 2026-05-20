import { useState } from 'react'
import Card from './Card'
import JokerActionPopup from './JokerActionPopup'
import { useT } from '../context/LangContext'

const CARD_W = 96
const STEP   = 34
const ANGLE  = 3

const STEP_C  = 24
const ANGLE_C = 2

const RANK_ORDER = { '6': 0, '7': 1, '8': 2, '9': 3, '10': 4, 'J': 5, 'Q': 6, 'K': 7, 'A': 8 }
const SUIT_ORDER = { '♠': 0, '♣': 1, '♦': 2, '♥': 3 }

function sortHand(cards) {
  return [...cards].sort((a, b) => {
    const aJoker = a.startsWith('JOKER')
    const bJoker = b.startsWith('JOKER')
    if (aJoker && bJoker) return 0
    if (aJoker) return 1   // Joker goes to the far right
    if (bJoker) return -1
    const suitDiff = (SUIT_ORDER[a[0]] ?? 99) - (SUIT_ORDER[b[0]] ?? 99)
    if (suitDiff !== 0) return suitDiff
    return (RANK_ORDER[b.slice(1)] ?? 0) - (RANK_ORDER[a.slice(1)] ?? 0)  // descending rank
  })
}

function getPlayable(hand, currentTrick, trump) {
  if (!hand.length || currentTrick.length === 0) return new Set(hand)

  const lead   = currentTrick[0]
  const leadId = lead.card

  if (leadId.startsWith('JOKER')) {
    // TAKE Joker: must play highest card of declared suit, else trump, else anything
    if (lead.jokerMode === 'TAKE' && lead.takeSuit) {
      const suit = lead.takeSuit === 'TRUMP' ? trump : lead.takeSuit
      if (suit && suit !== 'NO_TRUMP') {
        const suited = hand.filter(c => !c.startsWith('JOKER') && c[0] === suit)
        if (suited.length > 0) {
          const highest = [...suited].sort((a, b) => (RANK_ORDER[b.slice(1)] ?? 0) - (RANK_ORDER[a.slice(1)] ?? 0))[0]
          return new Set([highest, ...hand.filter(c => c.startsWith('JOKER'))])
        }
        if (trump && trump !== 'NO_TRUMP') {
          const trumpCards = hand.filter(c => !c.startsWith('JOKER') && c[0] === trump)
          if (trumpCards.length > 0) return new Set([...trumpCards, ...hand.filter(c => c.startsWith('JOKER'))])
        }
      }
      return new Set(hand)
    }

    // GIVE Joker: must follow giveSuit, else trump, else anything
    if (lead.jokerMode === 'GIVE' && lead.giveSuit) {
      const effectiveSuit = lead.giveSuit === 'TRUMP' ? trump : lead.giveSuit
      if (effectiveSuit && effectiveSuit !== 'NO_TRUMP') {
        const suitCards = hand.filter(c => !c.startsWith('JOKER') && c[0] === effectiveSuit)
        if (suitCards.length > 0) return new Set([...suitCards, ...hand.filter(c => c.startsWith('JOKER'))])
        if (trump && trump !== 'NO_TRUMP') {
          const trumpCards = hand.filter(c => !c.startsWith('JOKER') && c[0] === trump)
          if (trumpCards.length > 0) return new Set([...trumpCards, ...hand.filter(c => c.startsWith('JOKER'))])
        }
      }
    }

    // HIGH / LOW Joker lead, or GIVE with no suit constraint: anything goes
    return new Set(hand)
  }

  const leadSuit = leadId[0]
  const suitCards = hand.filter(c => !c.startsWith('JOKER') && c[0] === leadSuit)
  if (suitCards.length > 0) {
    return new Set([...suitCards, ...hand.filter(c => c.startsWith('JOKER'))])
  }

  if (trump && trump !== 'NO_TRUMP') {
    const trumpCards = hand.filter(c => !c.startsWith('JOKER') && c[0] === trump)
    if (trumpCards.length > 0) {
      return new Set([...trumpCards, ...hand.filter(c => c.startsWith('JOKER'))])
    }
  }

  return new Set(hand)
}

export default function GameBoard({ hand = [], onPlayCard, currentTrick = [], trump, isMyTurn, isBidding = false, compact = false, portrait = false, currentPlayerName = '' }) {
  const t = useT()
  const [pendingJoker, setPendingJoker] = useState(null)

  const cw   = CARD_W
  const step = compact ? STEP_C : STEP
  const tilt = compact ? ANGLE_C  : ANGLE

  const isJokerFirst = currentTrick.length === 0
  const playable     = isMyTurn ? getPlayable(hand, currentTrick, trump) : new Set()

  const handleClick = (card) => {
    if (!isMyTurn) return
    if (!playable.has(card)) return
    if (card.startsWith('JOKER')) {
      setPendingJoker(card)
    } else {
      onPlayCard(card, 'NORMAL', null, null)
    }
  }

  const playJoker = (mode, suit) => {
    onPlayCard(
      pendingJoker,
      mode,
      mode === 'TAKE' ? suit : null,
      mode === 'GIVE' ? suit : null,
    )
    setPendingJoker(null)
  }

  const sortedHand = sortHand(hand)
  const n   = sortedHand.length
  const mid = (n - 1) / 2
  const containerW = n > 0 ? (n - 1) * step + cw + 48 : 120

  const pendingJokerIndex = pendingJoker ? sortedHand.indexOf(pendingJoker) : -1
  const pendingJokerXOff  = pendingJokerIndex >= 0 ? (pendingJokerIndex - mid) * step : 0

  return (
    <div className="flex flex-col items-center gap-3">

      {/* ── Card fan ── */}
      <div className="relative" style={{ width: containerW, height: 170 }}>
        {sortedHand.map((card, i) => {
          const angle  = (i - mid) * tilt
          const xOff   = (i - mid) * step
          const legal  = playable.has(card)
          const dimmed = isMyTurn && !legal

          const shouldDim    = !isBidding && (!isMyTurn || dimmed)
          const overlayAlpha = dimmed ? 0.68 : 0.55

          return (
            <div
              key={card}
              onClick={() => handleClick(card)}
              className={`absolute bottom-0 ${isMyTurn && legal ? 'cursor-pointer' : 'cursor-default'}`}
              style={{
                left:            '50%',
                transform:       `translateX(calc(-50% + ${xOff}px)) rotate(${angle}deg)`,
                transformOrigin: 'bottom center',
                zIndex:          i + 1,
              }}
            >
              <div style={{ position: 'relative' }}>
                <Card cardId={card} />
                {shouldDim && (
                  <div style={{
                    position:      'absolute',
                    inset:         0,
                    borderRadius:  '0.5rem',
                    background:    `rgba(0,0,0,${overlayAlpha})`,
                    pointerEvents: 'none',
                  }} />
                )}
              </div>
            </div>
          )
        })}

        {/* Joker popup above the pending joker card */}
        {pendingJoker && (
          <div
            className="absolute z-50"
            style={{
              bottom:    '145px',
              left:      '50%',
              transform: `translateX(calc(-50% + ${pendingJokerXOff}px))`,
            }}
          >
            <JokerActionPopup
              isFirst={isJokerFirst}
              onConfirm={playJoker}
              onCancel={() => setPendingJoker(null)}
            />
          </div>
        )}
      </div>

      {/* Status hints — hidden in portrait (space is precious) */}
      {!portrait && !isMyTurn && sortedHand.length > 0 && (
        <p className="text-slate-500 text-sm">{t('wait_turn', { name: currentPlayerName })}</p>
      )}
      {!portrait && isMyTurn && (
        <p className="text-sm animate-pulse" style={{ color: '#c9a84c' }}>{t('your_turn')}</p>
      )}
    </div>
  )
}
