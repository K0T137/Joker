import { useState } from 'react'
import { useT } from '../../context/LangContext'

export default function GameEndModal({ stats, players, myPlayerId, roomId, onPlayAgain, onRematch, onLeaveGame, playInPairs, isRanked = false }) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  const fmtPts   = (v) => { const f = v / 100; return Number.isInteger(f) ? String(f) : f.toFixed(1) }

  // In pairs mode: merge P1+P3, P2+P4 into two team rows; hide P3/P4 individually
  const displayRows = (() => {
    if (!playInPairs || stats.length < 4) return [...stats].sort((a, b) => b.score - a.score)
    const byPos = stats // server preserves playerIds order
    const teams = [
      { id: byPos[0]?.id, name: byPos[0]?.name, partner: byPos[2]?.name, score: (byPos[0]?.score ?? 0) + (byPos[2]?.score ?? 0),
        exactBids: (byPos[0]?.exactBids ?? 0) + (byPos[2]?.exactBids ?? 0),
        hishts:    (byPos[0]?.hishts    ?? 0) + (byPos[2]?.hishts    ?? 0),
        totalBids: (byPos[0]?.totalBids ?? 0) + (byPos[2]?.totalBids ?? 0), isBot: false },
      { id: byPos[1]?.id, name: byPos[1]?.name, partner: byPos[3]?.name, score: (byPos[1]?.score ?? 0) + (byPos[3]?.score ?? 0),
        exactBids: (byPos[1]?.exactBids ?? 0) + (byPos[3]?.exactBids ?? 0),
        hishts:    (byPos[1]?.hishts    ?? 0) + (byPos[3]?.hishts    ?? 0),
        totalBids: (byPos[1]?.totalBids ?? 0) + (byPos[3]?.totalBids ?? 0), isBot: false },
    ]
    return teams.sort((a, b) => b.score - a.score)
  })()
  const topScore = displayRows[0]?.score ?? 0

  const copyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${roomId}`
    navigator.clipboard?.writeText(url).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handlePlayAgain = () => {
    copyLink()
    onPlayAgain()
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(12px)' }}>
      <div style={{
        background:   'rgba(8,8,12,0.98)',
        border:       '1px solid rgba(201,168,76,0.35)',
        borderRadius: '1.5rem',
        padding:      'clamp(16px, 3.5vw, 32px) clamp(14px, 4vw, 40px)',
        width:        'min(92vw, 480px)',
        textAlign:    'center',
      }}>
        <div style={{ color: 'rgba(201,168,76,0.5)', fontSize: 10, letterSpacing: '0.4em', textTransform: 'uppercase', marginBottom: 16 }}>
          {t('game_over')}
        </div>

        {displayRows[0] && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ color: '#c9a84c', fontSize: 28, fontWeight: 900, fontFamily: 'Georgia, serif', letterSpacing: '0.05em' }}>
              {playInPairs && displayRows[0].partner
                ? `${displayRows[0].name} & ${displayRows[0].partner}`
                : displayRows[0].name}
            </div>
            <div style={{ color: 'rgba(201,168,76,0.5)', fontSize: 11, letterSpacing: '0.25em', textTransform: 'uppercase', marginTop: 4 }}>
              {displayRows[0].id === myPlayerId ? t('you_won') : t('winner')}
            </div>
          </div>
        )}

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24, fontSize: 12 }}>
          <thead>
            <tr style={{ color: '#3a3a4a', fontSize: 10, letterSpacing: '0.1em' }}>
              <th style={{ textAlign: 'left', paddingBottom: 8, fontWeight: 600 }}>{t('col_player')}</th>
              <th style={{ paddingBottom: 8, fontWeight: 600 }}>{t('col_score')}</th>
              <th style={{ paddingBottom: 8, fontWeight: 600 }}>{t('col_exact')}</th>
              <th style={{ paddingBottom: 8, fontWeight: 600 }}>{t('col_hisht')}</th>
              <th style={{ paddingBottom: 8, fontWeight: 600 }}>{t('col_acc')}</th>
              {!playInPairs && <th style={{ paddingBottom: 8, fontWeight: 600, color: 'rgba(201,168,76,0.5)' }}>🪙</th>}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((p, i) => {
              const isWinner  = p.score === topScore && !p.isBot
              const isMe      = p.id === myPlayerId
              const nameLabel = playInPairs && p.partner ? `${p.name} & ${p.partner}` : p.name
              const delta     = !playInPairs ? p.tokenDelta : null
              return (
                <tr key={p.id} style={{
                  background: isWinner ? 'rgba(201,168,76,0.06)' : 'transparent',
                  borderTop:  '1px solid rgba(255,255,255,0.04)',
                }}>
                  <td style={{ textAlign: 'left', padding: '7px 4px', color: isMe ? '#c9a84c' : '#8a8a9a', fontWeight: isMe ? 700 : 400 }}>
                    {i + 1}. {p.isBot ? '🤖 ' : ''}{nameLabel}
                  </td>
                  <td style={{ padding: '7px 4px', color: p.score < 0 ? '#ef4444' : isWinner ? '#c9a84c' : '#6a6a8a', fontWeight: 700, textAlign: 'center' }}>
                    {fmtPts(p.score)}
                  </td>
                  <td style={{ padding: '7px 4px', color: '#6a6a8a', textAlign: 'center' }}>{p.exactBids}</td>
                  <td style={{ padding: '7px 4px', color: p.hishts > 0 ? '#ef4444' : '#3a3a4a', textAlign: 'center' }}>{p.hishts}</td>
                  <td style={{ padding: '7px 4px', color: '#6a6a8a', textAlign: 'center' }}>
                    {p.totalBids > 0 ? `${Math.round(p.exactBids / p.totalBids * 100)}%` : '—'}
                  </td>
                  {!playInPairs && (
                    <td style={{ padding: '7px 4px', textAlign: 'center', fontWeight: 700,
                      color: p.isBot || delta === null ? '#3a3a4a' : delta >= 0 ? '#4ade80' : '#ef4444' }}>
                      {p.isBot || delta === null ? '—' : `${delta >= 0 ? '+' : ''}${delta}`}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          {onPlayAgain && (
            <button onClick={handlePlayAgain}
              style={{ flex: 1, padding: '11px 0', borderRadius: 12, background: copied ? '#1a2a1a' : '#c9a84c', color: copied ? '#4ade80' : '#0a0a0f', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}>
              {copied ? '✓' : '🔄'} {t('play_again')}
            </button>
          )}
          {onRematch && (
            <button onClick={onRematch}
              style={{ flex: 1, padding: '11px 0', borderRadius: 12, background: '#0e2244', color: '#4a9fe8', fontWeight: 700, fontSize: 13, border: '1px solid #1a3a6e', cursor: 'pointer' }}>
              📨 {t('rematch_invite_btn') || 'Invite Same'}
            </button>
          )}
          <button onClick={copyLink}
            style={{ padding: '11px 16px', borderRadius: 12, background: copied ? '#1a2a1a' : '#1e1e2a', color: copied ? '#4ade80' : '#8a8a9a', fontSize: 12, border: `1px solid ${copied ? '#2a4a2a' : '#2a2a38'}`, cursor: 'pointer', transition: 'all 0.2s' }}>
            {copied ? '✓' : t('invite_btn')}
          </button>
          <button onClick={onLeaveGame}
            style={{ padding: '11px 16px', borderRadius: 12, background: '#1e1e2a', color: '#4a4a5a', fontSize: 12, border: '1px solid #2a2a38', cursor: 'pointer' }}>
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}
