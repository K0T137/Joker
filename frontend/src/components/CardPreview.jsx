import Card from './Card'

const SUITS = ['♠', '♥', '♦', '♣']
const RANKS = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']

const SUIT_NAMES = { '♠': 'Spades', '♥': 'Hearts', '♦': 'Diamonds', '♣': 'Clubs' }

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{
        color: 'rgba(201,168,76,0.5)',
        fontSize: 9,
        letterSpacing: '0.3em',
        textTransform: 'uppercase',
        marginBottom: 10,
        fontWeight: 700,
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}

export default function CardPreview({ onClose }) {
  return (
    <div
      className="fixed inset-0 z-[9999] overflow-auto"
      style={{ background: '#0d0d14' }}
    >
      <div style={{ padding: '24px 28px', maxWidth: 900, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <div>
            <div style={{ color: '#c9a84c', fontSize: 16, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              Card Preview
            </div>
            <div style={{ color: '#3a3a4a', fontSize: 10, letterSpacing: '0.2em', marginTop: 2 }}>
              Developer tool — visual card review
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32,
              borderRadius: '0.5rem',
              background: '#1a1a24',
              border: '1px solid #2a2a38',
              color: '#6a6a8a',
              fontSize: 18,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        {/* Face-down cards */}
        <Section title="Face Down — All Sizes">
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center' }}>
              <Card faceDown />
              <div style={{ color: '#3a3a4a', fontSize: 9, marginTop: 4 }}>normal</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <Card faceDown medium />
              <div style={{ color: '#3a3a4a', fontSize: 9, marginTop: 4 }}>medium</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <Card faceDown small />
              <div style={{ color: '#3a3a4a', fontSize: 9, marginTop: 4 }}>small</div>
            </div>
          </div>
        </Section>

        {/* Joker */}
        <Section title="Joker">
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <Card cardId="JOKER" />
            <Card cardId="JOKER" medium />
            <Card cardId="JOKER" small />
          </div>
        </Section>

        {/* Number cards — all sizes */}
        <Section title="Number Cards — Normal Size">
          {SUITS.map(suit => (
            <div key={suit} style={{ marginBottom: 16 }}>
              <div style={{ color: '#2a2a38', fontSize: 9, marginBottom: 6, letterSpacing: '0.15em' }}>
                {suit} {SUIT_NAMES[suit]}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['6','7','8','9','10'].map(rank => (
                  <Card key={rank} cardId={`${suit}${rank}`} />
                ))}
              </div>
            </div>
          ))}
        </Section>

        {/* Face cards */}
        <Section title="Face Cards (J Q K A) — Normal Size">
          {SUITS.map(suit => (
            <div key={suit} style={{ marginBottom: 16 }}>
              <div style={{ color: '#2a2a38', fontSize: 9, marginBottom: 6, letterSpacing: '0.15em' }}>
                {suit} {SUIT_NAMES[suit]}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['J','Q','K','A'].map(rank => (
                  <Card key={rank} cardId={`${suit}${rank}`} />
                ))}
              </div>
            </div>
          ))}
        </Section>

        {/* Full deck — medium size */}
        <Section title="Full Deck — Medium Size">
          {SUITS.map(suit => (
            <div key={suit} style={{ marginBottom: 12 }}>
              <div style={{ color: '#2a2a38', fontSize: 9, marginBottom: 6, letterSpacing: '0.15em' }}>
                {suit} {SUIT_NAMES[suit]}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {RANKS.map(rank => (
                  <Card key={rank} cardId={`${suit}${rank}`} medium />
                ))}
              </div>
            </div>
          ))}
        </Section>

        {/* Full deck — small size */}
        <Section title="Full Deck — Small Size">
          {SUITS.map(suit => (
            <div key={suit} style={{ marginBottom: 10 }}>
              <div style={{ color: '#2a2a38', fontSize: 9, marginBottom: 4, letterSpacing: '0.15em' }}>
                {suit}
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {RANKS.map(rank => (
                  <Card key={rank} cardId={`${suit}${rank}`} small />
                ))}
              </div>
            </div>
          ))}
        </Section>

        {/* Selected state demo */}
        <Section title="Selected State">
          <div style={{ display: 'flex', gap: 8 }}>
            <Card cardId="♠A" />
            <Card cardId="♥K" selected />
            <Card cardId="♦Q" />
          </div>
        </Section>

      </div>
    </div>
  )
}
