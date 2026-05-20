import { usePrefs } from '../context/PrefsContext'

// ── Sprite sheet constants ────────────────────────────────────────────────────
const SPRITE_COLS = 13  // 1846px / 142px per cell
const SPRITE_ROWS = 4
const SPRITE_SUIT_ROW = { '♥': 0, '♣': 1, '♦': 2, '♠': 3 }
const SPRITE_RANK_COL = { '2':0,'3':1,'4':2,'5':3,'6':4,'7':5,'8':6,'9':7,'10':8,'J':9,'Q':10,'K':11,'A':12 }
// hybrid mode: only these ranks use the sprite; number cards keep text pips
const HYBRID_SPRITE_RANKS = new Set(['J','Q','K','A'])

// Deck theme palettes
export const DECK_THEMES = [
  { id: 'gold',    label: 'Gold',    bg: '#0f2044', border: '#1e3a68', accent: '#c9a84c' },
  { id: 'navy',    label: 'Navy',    bg: '#0a1a2e', border: '#1a3a5e', accent: '#4a9ac9' },
  { id: 'forest',  label: 'Forest',  bg: '#0a1a0e', border: '#1a3a22', accent: '#4ac97a' },
  { id: 'crimson', label: 'Crimson', bg: '#1e0a0a', border: '#4a1a1a', accent: '#c94a4a' },
]

// Read current deck theme from localStorage
export function getDeckTheme() {
  const id = localStorage.getItem('joker_deck') ?? 'gold'
  return DECK_THEMES.find(t => t.id === id) ?? DECK_THEMES[0]
}

function parseCard(cardId) {
  if (!cardId || cardId.startsWith('JOKER')) {
    return { rank: 'JKR', suit: '★', isJoker: true, jokerNum: cardId?.endsWith('2') ? 2 : 1 }
  }
  const suit = cardId[0]       // ♠ ♥ ♦ ♣
  const rank = cardId.slice(1) // 6 7 8 9 10 J Q K A
  return { rank, suit, isJoker: false, jokerNum: 0 }
}

// Small-card overrides — columns at 35/65 (tighter than 27/73), rows compressed toward centre
const SMALL_PIP_LAYOUTS = {
  '6': [
    [35,31,false],[65,31,false],
    [35,50,false],[65,50,false],
    [35,69,true], [65,69,true],
  ],
  '7': [
    [35,31,false],[65,31,false],
    [35,50,false],[65,50,false],
    [35,69,true], [65,69,true],
    [50,40,false],
  ],
  '8': [
    [35,31,false],[65,31,false],
    [35,50,false],[65,50,false],
    [35,69,true], [65,69,true],
    [50,40,false],
    [50,59,true],
  ],
  '9': [
    [35,27,false],[65,27,false],
    [35,40,false],[65,40,false],
    [35,60,true], [65,60,true],
    [35,73,true], [65,73,true],
    [50,50,false],
  ],
  '10': [
    [35,24,false],[65,24,false],
    [35,41,false],[65,41,false],
    [35,59,true], [65,59,true],
    [35,76,true], [65,76,true],
    [50,32,false],
    [50,68,true],
  ],
}

// Pip positions [x%, y%, rotated180]
// Left col=27%, right col=73%, center=50%; rows stay inside the corner-index area (~20% from top/bottom)
const PIP_LAYOUTS = {
  '6': [
    [27,25,false],[73,25,false],   // row 1 — up
    [27,50,false],[73,50,false],   // row 2 — up
    [27,75,true], [73,75,true],    // row 3 — down
  ],
  '7': [
    [27,25,false],[73,25,false],   // row 1 — up  (identical to 6)
    [27,50,false],[73,50,false],   // row 2 — up  (identical to 6)
    [27,75,true], [73,75,true],    // row 3 — down (identical to 6)
    [50,37,false],                 // 7th — center between rows 1 & 2, up
  ],
  '8': [
    [27,25,false],[73,25,false],   // row 1 — up  (identical to 6)
    [27,50,false],[73,50,false],   // row 2 — up  (identical to 6)
    [27,75,true], [73,75,true],    // row 3 — down (identical to 6)
    [50,37,false],                 // 7th — center between rows 1 & 2, up
    [50,62,true],                  // 8th — center between rows 2 & 3, down
  ],
  '9': [
    [27,20,false],[73,20,false],   // row 1 — up
    [27,38,false],[73,38,false],   // row 2 — up
    [27,62,true], [73,62,true],    // row 3 — down
    [27,80,true], [73,80,true],    // row 4 — down
    [50,50,false],                 // 9th — center middle, up
  ],
  '10': [
    [27,17,false],[73,17,false],   // row 1 — up
    [27,40,false],[73,40,false],   // row 2 — up
    [27,60,true], [73,60,true],    // row 3 — down
    [27,83,true], [73,83,true],    // row 4 — down
    [50,28,false],                 // 9th — center between rows 1 & 2, up
    [50,72,true],                  // 10th — center between rows 3 & 4, down
  ],
}

function CardFace({ rank, suit, color, small, medium }) {
  const pips = (small && SMALL_PIP_LAYOUTS[rank]) ? SMALL_PIP_LAYOUTS[rank] : PIP_LAYOUTS[rank]

  if (pips) {
    const fontSize = small ? 11 : medium ? 20 : 24
    return (
      <div className="absolute inset-0 pointer-events-none select-none">
        {pips.map(([x, y, rotated], i) => (
          <div
            key={i}
            style={{
              position:       'absolute',
              left:           `${x}%`,
              top:            `${y}%`,
              width:          '1em',
              height:         '1em',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              transform:      `translate(-50%,-50%)${rotated ? ' rotate(180deg)' : ''}`,
              fontSize,
              lineHeight:     1,
              color,
            }}
          >
            {suit}
          </div>
        ))}
      </div>
    )
  }

  // Face cards (J / Q / K) and Ace: single large centred suit character
  const centerSize = small ? 22 : medium ? 32 : 44
  return (
    <div
      className="absolute inset-0 flex items-center justify-center select-none"
      style={{ fontSize: centerSize, lineHeight: 1, color }}
    >
      {suit}
    </div>
  )
}

// Natural sprite cell size in the PNG (2x resolution)
const CELL_W = 142
const CELL_H = 190

function SpriteCardFace({ rank, suit, displayW, displayH }) {
  const col = SPRITE_RANK_COL[rank]
  const row = SPRITE_SUIT_ROW[suit]
  if (col === undefined || row === undefined) return null

  // Scale the sprite cell to cover the card while preserving aspect ratio,
  // then center it. The background is clipped to the element border box by default.
  const scale = Math.max(displayW / CELL_W, displayH / CELL_H)
  const cellW  = CELL_W * scale
  const cellH  = CELL_H * scale
  const posX   = -(col * cellW) + (displayW - cellW) / 2
  const posY   = -(row * cellH) + (displayH - cellH) / 2

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        backgroundImage:    "url('/8BitDeck.png')",
        backgroundSize:     `${SPRITE_COLS * cellW}px ${SPRITE_ROWS * cellH}px`,
        backgroundPosition: `${posX}px ${posY}px`,
        backgroundRepeat:   'no-repeat',
        borderRadius:       'inherit',
      }}
    />
  )
}

function JokerCardFace({ jokerNum, small, medium }) {
  const color    = jokerNum === 1 ? '#c9a84c' : '#9333ea'
  const tint     = jokerNum === 1 ? 'rgba(201,168,76,0.13)' : 'rgba(147,51,234,0.13)'
  const rankFs   = small ? 7 : medium ? 8  : 10
  const cornerFs = small ? 5 : medium ? 6  : 7.5

  return (
    <>
      {/* Full-card illustration */}
      <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: 'inherit' }}>
        <img
          src="/joker.JPG"
          alt=""
          draggable={false}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block', userSelect: 'none' }}
        />
        {/* Colour tint so J1 (gold) and J2 (purple) are visually distinct */}
        <div style={{ position: 'absolute', inset: 0, background: tint, mixBlendMode: 'multiply' }} />
      </div>

      {/* Top-left corner */}
      <div className="absolute top-1 left-1.5 font-black leading-none select-none" style={{ color, textShadow: '0 0 5px rgba(255,255,255,0.9), 0 0 2px rgba(255,255,255,1)' }}>
        <div style={{ fontSize: rankFs, lineHeight: 1.1 }}>J</div>
        <div style={{ fontSize: cornerFs, lineHeight: 1, textAlign: 'center' }}>★</div>
      </div>

      {/* Bottom-right corner (rotated 180°) */}
      <div className="absolute bottom-1 right-1.5 font-black leading-none rotate-180 select-none" style={{ color, textShadow: '0 0 5px rgba(255,255,255,0.9), 0 0 2px rgba(255,255,255,1)' }}>
        <div style={{ fontSize: rankFs, lineHeight: 1.1 }}>J</div>
        <div style={{ fontSize: cornerFs, lineHeight: 1, textAlign: 'center' }}>★</div>
      </div>
    </>
  )
}

// normal → w-20 h-28  (80×112 px)
// medium → w-[86px] h-[116px]  (86×116 px)
// small  → w-12 h-16  (48×64 px)
export default function Card({ cardId, faceDown = false, small = false, medium = false, selected = false, onClick, className = '' }) {
  const w        = small ? 'w-12 h-16' : medium ? 'w-[86px] h-[116px]' : 'w-24 h-[134px]'
  const displayW = small ? 48 : medium ? 86 : 96
  const displayH = small ? 64 : medium ? 116 : 134
  const { suitCardHex, cardStyle } = usePrefs()

  if (faceDown) {
    const dt = getDeckTheme()
    return (
      <div
        className={`${w} rounded-lg flex-shrink-0 relative overflow-hidden ${className}`}
        style={{
          backgroundImage:    "url('/card-back.jpg')",
          backgroundSize:     'cover',
          backgroundPosition: 'center',
          backgroundColor:    dt.bg,
          border:             `1.5px solid ${dt.border}`,
          boxShadow:          small ? '0 2px 8px rgba(0,0,0,0.5)' : '0 4px 16px rgba(0,0,0,0.6)',
        }}
      >
      </div>
    )
  }

  const { rank, suit, isJoker, jokerNum } = parseCard(cardId)
  const color       = suitCardHex(suit)
  const jokerAccent = jokerNum === 1 ? 'rgba(201,168,76,0.5)' : 'rgba(147,51,234,0.5)'
  const jokerBg     = jokerNum === 1
    ? 'linear-gradient(160deg, #fffef8 0%, #fffaed 100%)'
    : 'linear-gradient(160deg, #fefeff 0%, #f8f2ff 100%)'

  // Corner: rank number size and suit character size — reduced 25% from original
  const rankFs   = small ? 7  : medium ? 8  : 10
  const cornerFs = small ? 5  : medium ? 6  : 7.5

  return (
    <div
      onClick={onClick}
      className={`${w} relative rounded-lg select-none flex-shrink-0 ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={selected
        ? { background: isJoker ? jokerBg : '#fff', border: '1.5px solid #c9a84c', boxShadow: '0 0 0 2px rgba(201,168,76,0.35), 0 6px 18px rgba(0,0,0,0.28)' }
        : isJoker
          ? { background: jokerBg, border: `1.5px solid ${jokerAccent}`, boxShadow: '0 2px 6px rgba(0,0,0,0.18)' }
          : { background: '#fff', border: '1px solid #d1d5db', boxShadow: '0 2px 6px rgba(0,0,0,0.18)' }
      }
    >
      {isJoker ? (
        <JokerCardFace jokerNum={jokerNum} small={small} medium={medium} />
      ) : cardStyle === 'sprite' ? (
        <SpriteCardFace rank={rank} suit={suit} displayW={displayW} displayH={displayH} />
      ) : cardStyle === 'hybrid' && HYBRID_SPRITE_RANKS.has(rank) ? (
        <SpriteCardFace rank={rank} suit={suit} displayW={displayW} displayH={displayH} />
      ) : (
        <>
          {/* Top-left corner */}
          <div className="absolute top-1 left-1.5 font-bold leading-none" style={{ color }}>
            <div style={{ fontSize: rankFs, lineHeight: 1.1 }}>{rank}</div>
            {!(small && PIP_LAYOUTS[rank]) && (
              <div style={{ fontSize: cornerFs, lineHeight: 1, textAlign: 'center' }}>{suit}</div>
            )}
          </div>

          <CardFace rank={rank} suit={suit} color={color} small={small} medium={medium} />

          {/* Bottom-right corner (rotated 180° — readable when card is flipped) */}
          <div className="absolute bottom-1 right-1.5 font-bold leading-none rotate-180" style={{ color }}>
            <div style={{ fontSize: rankFs, lineHeight: 1.1 }}>{rank}</div>
            {!(small && PIP_LAYOUTS[rank]) && (
              <div style={{ fontSize: cornerFs, lineHeight: 1, textAlign: 'center' }}>{suit}</div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
