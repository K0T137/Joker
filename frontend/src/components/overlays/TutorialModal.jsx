import { useState } from 'react'
import { useT } from '../../context/LangContext'

// ── Mini card renders ─────────────────────────────────────────────────────────
const SUIT_COLOR = { '♥': '#dc2626', '♦': '#dc2626', '♠': '#0f172a', '♣': '#0f172a' }
const SUIT_ROW  = { '♥': 0, '♣': 1, '♦': 2, '♠': 3 }
const RANK_COL  = { '2':0,'3':1,'4':2,'5':3,'6':4,'7':5,'8':6,'9':7,'10':8,'J':9,'Q':10,'K':11,'A':12 }

function MiniCard({ rank, suit, small = false }) {
  const w = small ? 36 : 52
  const h = small ? 50 : 72
  const col = RANK_COL[rank]
  const row = SUIT_ROW[suit]
  return (
    <div style={{
      width: w, height: h, borderRadius: 6, flexShrink: 0, overflow: 'hidden',
      background: '#fff',
      backgroundImage: "url('/8BitDeck.png')",
      backgroundSize: '1300% 400%',
      backgroundPosition: `${(col / 12) * 100}% ${(row / 3) * 100}%`,
      backgroundRepeat: 'no-repeat',
      border: '1.5px solid #e2e8f0',
    }} />
  )
}

// Stack of face-down cards representing a collected trick
function TrickPile() {
  return (
    <div style={{ position: 'relative', width: 46, height: 58, flexShrink: 0 }}>
      {[2, 1, 0].map(i => (
        <div key={i} style={{ position: 'absolute', width: 36, height: 50, borderRadius: 6, background: '#1a3a6e', border: '2px solid #2a5aa8', top: i * 3, left: i * 3, boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }} />
      ))}
    </div>
  )
}

function JokerCard({ small = false }) {
  const sz = small ? { w: 36, h: 50, font: 9 } : { w: 52, h: 72, font: 11 }
  return (
    <div style={{ width: sz.w, height: sz.h, borderRadius: 6, background: 'linear-gradient(135deg,#1a0a3a,#2a1a5a)', border: '1.5px solid #7c3aed', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
      <span style={{ fontSize: sz.font + 4 }}>🃏</span>
      <span style={{ fontSize: sz.font, fontWeight: 900, color: '#c9a84c', letterSpacing: '0.05em' }}>JOKER</span>
    </div>
  )
}

function ScoreRow({ label, value, highlight = false, negative = false }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 12px', borderRadius: 10, background: highlight ? 'rgba(201,168,76,0.1)' : 'rgba(255,255,255,0.03)', border: highlight ? '1px solid rgba(201,168,76,0.3)' : '1px solid rgba(255,255,255,0.05)', marginBottom: 6 }}>
      <span style={{ fontSize: 12, color: '#8a9ab8' }}>{label}</span>
      <span style={{ fontWeight: 900, fontSize: 14, color: negative ? '#ef4444' : highlight ? '#c9a84c' : '#4ade80' }}>{value}</span>
    </div>
  )
}

// ── Slide content ─────────────────────────────────────────────────────────────
function Slide({ t, index }) {
  if (index === 0) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 20 }}>
      <div style={{ fontSize: 64 }}>🃏</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: '#c9a84c', fontFamily: 'Georgia, serif' }}>{t('tut_s1_title')}</div>
      <div style={{ fontSize: 14, color: '#8a9ab8', lineHeight: 1.7, maxWidth: 340 }}>{t('tut_s1_body')}</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        {['♥','♦','♠','♣'].map(s => (
          <div key={s} style={{ width: 48, height: 48, borderRadius: 12, background: '#fff', border: '1.5px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: SUIT_COLOR[s] }}>{s}</div>
        ))}
      </div>
    </div>
  )

  if (index === 1) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div style={{ fontSize: 18, fontWeight: 900, color: '#c9a84c', textAlign: 'center' }}>{t('tut_s2_title')}</div>
      <div style={{ fontSize: 13, color: '#8a9ab8', textAlign: 'center', lineHeight: 1.6 }}>{t('tut_s2_body')}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626' }}>♥ ♦ &nbsp; 6 → A</div>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'center' }}>
            {['6','7','8','9','10','J','Q','K','A'].map(r => <MiniCard key={r} rank={r} suit="♥" small />)}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>♠ ♣ &nbsp; 7 → A</div>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'center' }}>
            {['7','8','9','10','J','Q','K','A'].map(r => <MiniCard key={r} rank={r} suit="♠" small />)}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#c9a84c' }}>+ 2 Jokers</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <JokerCard small />
            <JokerCard small />
          </div>
        </div>
      </div>
    </div>
  )

  if (index === 2) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
      <div style={{ fontSize: 18, fontWeight: 900, color: '#c9a84c', textAlign: 'center' }}>{t('tut_s3_title')}</div>
      <div style={{ fontSize: 13, color: '#8a9ab8', textAlign: 'center', lineHeight: 1.6 }}>{t('tut_s3_body')}</div>
      {/* Special rule callout */}
      <div style={{ fontSize: 12, color: '#c9a84c', background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 10, padding: '8px 14px', textAlign: 'center', width: '100%' }}>
        ⚠ {t('tut_s3_rule')}
      </div>
      {/* Trick definition note */}
      <div style={{ fontSize: 12, color: '#8a9ab8', background: '#0a1422', border: '1px solid #1a2840', borderRadius: 10, padding: '8px 14px', textAlign: 'center', width: '100%' }}>
        {t('tut_s3_trick_def')}
      </div>
      {/* Bid example */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#4a5570', marginBottom: 4 }}>{t('tut_bid')}</div>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: '#c9a84c', color: '#0a0a0f', fontWeight: 900, fontSize: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>3</div>
        </div>
        <div style={{ fontSize: 24, color: '#4a5570' }}>→</div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#4a5570', marginBottom: 6 }}>{t('tut_tricks_won')}</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <TrickPile /><TrickPile /><TrickPile />
          </div>
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#4ade80', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 10, padding: '8px 14px', textAlign: 'center' }}>
        ✓ {t('tut_s3_exact')}
      </div>
    </div>
  )

  if (index === 3) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
      <div style={{ fontSize: 18, fontWeight: 900, color: '#c9a84c', textAlign: 'center' }}>{t('tut_s4_title')}</div>
      <div style={{ fontSize: 13, color: '#8a9ab8', textAlign: 'center', lineHeight: 1.6 }}>{t('tut_s4_body')}</div>
      {/* Trick example */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: '#4a5570', marginBottom: 8 }}>{t('tut_trick_example')}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'flex-end' }}>
          <div style={{ textAlign: 'center' }}>
            <MiniCard rank="J" suit="♠" />
            <div style={{ fontSize: 10, color: '#4a5570', marginTop: 4 }}>P1</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <MiniCard rank="9" suit="♠" />
            <div style={{ fontSize: 10, color: '#4a5570', marginTop: 4 }}>P2</div>
          </div>
          <div style={{ textAlign: 'center', position: 'relative' }}>
            <MiniCard rank="7" suit="♥" />
            <div style={{ position: 'absolute', top: -10, right: -10, background: '#c9a84c', color: '#0a0a0f', fontSize: 10, fontWeight: 900, borderRadius: 6, padding: '1px 5px' }}>{t('tut_trump')}</div>
            <div style={{ fontSize: 10, color: '#4ade80', marginTop: 4, fontWeight: 700 }}>P3 ✓</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <MiniCard rank="K" suit="♠" />
            <div style={{ fontSize: 10, color: '#4a5570', marginTop: 4 }}>P4</div>
          </div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: '#c9a84c', textAlign: 'center' }}>{t('tut_s4_caption')}</div>
      <div style={{ fontSize: 12, color: '#8a9ab8', background: '#0a1422', border: '1px solid #1a2840', borderRadius: 10, padding: '8px 14px', textAlign: 'center' }}>
        {t('tut_s4_note')}
      </div>
    </div>
  )

  if (index === 4) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
      <div style={{ fontSize: 18, fontWeight: 900, color: '#c9a84c', textAlign: 'center' }}>{t('tut_s5_title')}</div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        <JokerCard />
        <JokerCard />
      </div>
      <div style={{ fontSize: 13, color: '#8a9ab8', textAlign: 'center', lineHeight: 1.7, maxWidth: 340 }}>{t('tut_s5_body')}</div>
      <div style={{ display: 'flex', gap: 8, width: '100%' }}>
        <div style={{ flex: 1, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#4ade80', marginBottom: 4 }}>↑ {t('tut_joker_high')}</div>
          <div style={{ fontSize: 11, color: '#6a7a9a' }}>{t('tut_joker_high_desc')}</div>
        </div>
        <div style={{ flex: 1, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', marginBottom: 4 }}>↓ {t('tut_joker_low')}</div>
          <div style={{ fontSize: 11, color: '#6a7a9a' }}>{t('tut_joker_low_desc')}</div>
        </div>
      </div>
    </div>
  )

  if (index === 5) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div style={{ fontSize: 18, fontWeight: 900, color: '#c9a84c', textAlign: 'center' }}>{t('tut_s6_title')}</div>
      <div style={{ width: '100%' }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#4ade80', marginBottom: 5 }}>✓ {t('tut_s6_hit')}</div>
        <ScoreRow label={t('tut_score_zero')}   value="+50"  highlight />
        <ScoreRow label={t('tut_score_exact')}  value={t('tut_score_exact_val')} highlight />
        <ScoreRow label={t('tut_score_full')}   value={t('tut_score_full_val')}  highlight />
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#ef4444', marginTop: 8, marginBottom: 5 }}>✗ {t('tut_s6_miss')}</div>
        <ScoreRow label={t('tut_score_miss')}   value={t('tut_score_miss_val')}  />
        <ScoreRow label={t('tut_score_hisht')}  value={t('tut_score_hisht_val')} negative />
      </div>
      <div style={{ fontSize: 11, color: '#4a5570', textAlign: 'center' }}>{t('tut_s6_note')}</div>
    </div>
  )

  if (index === 6) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
      <div style={{ fontSize: 18, fontWeight: 900, color: '#c9a84c', textAlign: 'center' }}>{t('tut_s7_title')}</div>
      <div style={{ fontSize: 42 }}>🏆</div>
      <div style={{ fontSize: 13, color: '#8a9ab8', textAlign: 'center', lineHeight: 1.7, maxWidth: 340 }}>{t('tut_s7_body')}</div>
      <div style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 12, padding: '12px 18px', textAlign: 'center', width: '100%' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#c9a84c', marginBottom: 4 }}>{t('tut_premia_title')}</div>
        <div style={{ fontSize: 12, color: '#8a9ab8', lineHeight: 1.6 }}>{t('tut_premia_body')}</div>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#4ade80', textAlign: 'center', marginTop: 4 }}>
        {t('tut_ready')} 🃏
      </div>
    </div>
  )

  return null
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TutorialModal({ onClose }) {
  const t = useT()
  const [step, setStep] = useState(0)
  const TOTAL = 7

  const next = () => step < TOTAL - 1 ? setStep(s => s + 1) : onClose()
  const prev = () => setStep(s => Math.max(0, s - 1))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-3"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}>
      <div style={{ background: 'rgba(8,8,18,0.98)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: '1.5rem', width: 'min(92vw, 440px)', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 0' }}>
          <div style={{ fontSize: 10, letterSpacing: '0.35em', textTransform: 'uppercase', color: 'rgba(201,168,76,0.5)' }}>
            {t('tut_label')} {step + 1}/{TOTAL}
          </div>
          <button onClick={onClose} style={{ color: '#4a5570', fontSize: 18, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>

        {/* Slide */}
        <div style={{ padding: '24px 24px 20px', minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Slide t={t} index={step} />
        </div>

        {/* Dot indicators */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, paddingBottom: 4 }}>
          {Array.from({ length: TOTAL }).map((_, i) => (
            <button key={i} onClick={() => setStep(i)} style={{ width: i === step ? 20 : 7, height: 7, borderRadius: 4, background: i === step ? '#c9a84c' : '#1e2b40', border: 'none', cursor: 'pointer', transition: 'all 0.2s', padding: 0 }} />
          ))}
        </div>

        {/* Nav buttons */}
        <div style={{ display: 'flex', gap: 8, padding: '16px 20px 20px' }}>
          {step > 0 ? (
            <button onClick={prev} style={{ flex: 1, height: 44, borderRadius: 12, background: '#0a1422', color: '#8a9ab8', fontSize: 13, fontWeight: 600, border: '1px solid #1a2840', cursor: 'pointer' }}>
              ← {t('tut_prev')}
            </button>
          ) : (
            <button onClick={onClose} style={{ flex: 1, height: 44, borderRadius: 12, background: '#0a1422', color: '#4a5570', fontSize: 13, border: '1px solid #1a2840', cursor: 'pointer' }}>
              {t('tut_skip')}
            </button>
          )}
          <button onClick={next} style={{ flex: 2, height: 44, borderRadius: 12, background: step === TOTAL - 1 ? '#4ade80' : '#c9a84c', color: '#0a0a0f', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
            {step === TOTAL - 1 ? `${t('tut_play')} →` : `${t('tut_next')} →`}
          </button>
        </div>
      </div>
    </div>
  )
}
