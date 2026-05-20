import React from 'react'
import { useCrown } from '../context/AuthContext'
import CrownBadge from './CrownBadge'

const BG1   = 'var(--table-row-1)'
const BG2   = 'var(--table-row-2)'
const BGHDR = 'var(--panel-hdr)'
const BGHI  = 'var(--table-highlight)'
const BGFUT = 'var(--table-future)'
const BORD  = 'var(--panel-bord)'
const BGPUL = 'var(--table-pulka-bg)'
const BORDP = 'var(--table-pulka-bord)'
const BGSEP = 'var(--table-sep-bg)'
const BGCUR = 'var(--table-cur-bg)'
const BGTOT = 'var(--table-total-bg)'
const CSCORE= 'var(--table-score-fg)'
const CBID  = 'var(--table-bid-fg)'
const CIDX  = 'var(--table-idx-fg)'
const CEMPTY= 'var(--table-empty-fg)'
const CHDR  = 'var(--table-hdr-fg)'

// ÷100 only for pulka subtotals and the final cumulative score
const fmtPts = (v) => {
  if (v == null) return '–'
  if (v === 0) return '0'
  const f = v / 100
  return Number.isInteger(f) ? String(f) : f.toFixed(1)
}

// Hisht mark for negative individual round scores
function HishtMark() {
  return <span style={{ textDecoration: 'line-through', color: '#ef4444', letterSpacing: '-1px' }}>I--I</span>
}

// Full pulka structure for all game modes
const STRUCTURES = {
  normal: {
    1: [1, 2, 3, 4, 5, 6, 7, 8],
    2: [9, 9, 9, 9],
    3: [8, 7, 6, 5, 4, 3, 2, 1],
    4: [9, 9, 9, 9],
  },
  only9: {
    1: [9, 9, 9, 9],
    2: [9, 9, 9, 9],
    3: [9, 9, 9, 9],
    4: [9, 9, 9, 9],
  },
  quick: {
    1: [1, 2, 3, 4, 5, 6, 7, 8],
    2: [9, 9, 9, 9],
  },
}

export default function ScoreTable({
  players = [],
  roundHistory = [],
  currentRoundNumber,
  currentPulkaNumber,
  gameScores,
  currentBids,
  dealerPlayerId = null,
  initialDealerPlayerId = null,
  myPlayerId = null,
  gameMode = 'normal',
  trickWinnerId = null,
}) {
  const crownUserId = useCrown()

  if (!players.length) return null

  // Column order anchored to initial dealer
  const orderedPlayers = (() => {
    const anchorId = initialDealerPlayerId ?? dealerPlayerId
    if (!anchorId) return players
    const di = players.findIndex(p => p.id === anchorId)
    if (di < 0) return players
    const n = players.length
    return Array.from({ length: n }, (_, i) => players[(di + 1 + i) % n])
  })()

  const abbr = (name = '') => name.length > 6 ? name.slice(0, 5) + '…' : name

  // Index round history by (pulka, round) key
  const historyByKey = {}
  const pulkaEndByPulka = {}
  const cumulative = Object.fromEntries(players.map(p => [p.id, 0]))

  for (const round of roundHistory) {
    historyByKey[`${round.pulkaNumber}-${round.roundNumber}`] = round
    if (round.scores) {
      players.forEach(p => { cumulative[p.id] = (cumulative[p.id] ?? 0) + (round.scores[p.id] ?? 0) })
    }
    if (round.pulkaComplete || round.gameComplete) {
      if (round.gameScores) {
        players.forEach(p => { cumulative[p.id] = round.gameScores[p.id] ?? cumulative[p.id] })
      }
      pulkaEndByPulka[round.pulkaNumber] = { round, snap: { ...cumulative } }
    }
  }

  const structure = STRUCTURES[gameMode] ?? STRUCTURES.normal

  // Running cumulative for the final row — use latest authoritative game scores
  const finalCumulative = { ...cumulative }
  if (gameScores) {
    players.forEach(p => {
      if (gameScores[p.id] != null) finalCumulative[p.id] = gameScores[p.id]
    })
  }

  return (
    <table className="w-full border-collapse table-fixed text-xs">
      <colgroup>
        <col style={{ width: 22 }} />
        {orderedPlayers.map(p => (
          <React.Fragment key={p.id}>
            <col style={{ width: 24 }} />
            <col style={{ width: 40 }} />
          </React.Fragment>
        ))}
      </colgroup>

      {/* ── Header ── */}
      <thead className="sticky top-0 z-10">
        <tr>
          <th className="border py-1" style={{ borderColor: BORD, background: BGHDR }} />
          {orderedPlayers.map(p => {
            const isMe = p.id === myPlayerId
            return (
              <th key={p.id} colSpan={2} title={p.name}
                className="border py-1 px-0.5 text-center font-semibold text-[11px] truncate"
                style={{
                  borderColor: isMe ? 'rgba(201,168,76,0.45)' : BORD,
                  background:  isMe ? 'rgba(201,168,76,0.08)' : BGHDR,
                  color:       isMe ? '#c9a84c' : CHDR,
                }}>
                {p.isBot ? '🤖' : ''}<CrownBadge show={!p.isBot && p.userId === crownUserId} />{abbr(p.name)}
              </th>
            )
          })}
        </tr>
        <tr>
          <th className="border py-0.5 text-center font-normal text-[10px]"
            style={{ borderColor: BORD, background: BGHDR, color: '#4a4a5a' }}>
            #
          </th>
          {orderedPlayers.map(p => {
            const isMe = p.id === myPlayerId
            return (
              <React.Fragment key={p.id}>
                <th className="border py-0.5 text-center font-normal text-[10px]"
                  style={{ borderColor: isMe ? 'rgba(201,168,76,0.3)' : BORD, background: isMe ? 'rgba(201,168,76,0.05)' : BGHDR, color: CHDR }}>
                  B
                </th>
                <th className="border py-0.5 text-center font-normal text-[10px]"
                  style={{ borderColor: isMe ? 'rgba(201,168,76,0.3)' : BORD, background: isMe ? 'rgba(201,168,76,0.05)' : BGHDR, color: CHDR }}>
                  Pts
                </th>
              </React.Fragment>
            )
          })}
        </tr>
      </thead>

      <tbody>
        {Object.keys(structure).map(Number).map(pulkaNum => {
          const pulkaStructure = structure[pulkaNum] ?? []
          const pulkaEnd       = pulkaEndByPulka[pulkaNum]

          return (
            <React.Fragment key={pulkaNum}>
              {/* Pulka label separator */}
              <tr style={{ background: BGSEP }}>
                <td colSpan={1 + orderedPlayers.length * 2}
                  className="border py-0.5 text-center font-bold text-[9px] uppercase tracking-widest"
                  style={{ borderColor: BORDP, color: CIDX }}>
                  P{pulkaNum}
                </td>
              </tr>

              {/* Round rows */}
              {pulkaStructure.map((cards, idx) => {
                const roundNum = idx + 1
                const key      = `${pulkaNum}-${roundNum}`
                const round    = historyByKey[key]

                const isCurrent = !round
                  && currentPulkaNumber === pulkaNum
                  && currentRoundNumber === roundNum
                const isFuture = !round && !isCurrent
                const isLatest = !!round && !historyByKey[`${pulkaNum}-${roundNum + 1}`]
                  && !pulkaEnd

                const bg = isFuture ? BGFUT : isCurrent ? BGCUR : isLatest ? BGHI : idx % 2 === 0 ? BG1 : BG2

                return (
                  <tr key={key} style={{ background: bg }}>
                    {/* Card count label — NOT ordinal */}
                    <td className="border py-0.5 text-center font-mono tabular-nums"
                      style={{ borderColor: BORD, color: isFuture ? CEMPTY : CIDX }}>
                      {cards}
                    </td>

                    {orderedPlayers.map(p => {
                      if (isFuture) {
                        return (
                          <React.Fragment key={p.id}>
                            <td className="border py-0.5" style={{ borderColor: '#1a1a22' }} />
                            <td className="border py-0.5" style={{ borderColor: '#1a1a22' }} />
                          </React.Fragment>
                        )
                      }
                      if (isCurrent) {
                        const liveBid   = currentBids?.[p.id]
                        const isWinner  = p.id === trickWinnerId
                        const cellBg    = isWinner ? 'rgba(201,168,76,0.10)' : 'transparent'
                        const cellBord  = isWinner ? 'rgba(201,168,76,0.35)' : '#1e1e2e'
                        return (
                          <React.Fragment key={p.id}>
                            <td className="border py-0.5 text-center tabular-nums"
                              style={{ borderColor: cellBord, background: cellBg, color: liveBid != null ? CBID : CEMPTY, transition: 'background 0.4s, border-color 0.4s' }}>
                              {liveBid != null ? liveBid : '–'}
                            </td>
                            <td className="border py-0.5 text-center italic"
                              style={{ borderColor: cellBord, background: cellBg, color: isWinner ? 'rgba(201,168,76,0.6)' : CEMPTY, transition: 'background 0.4s, border-color 0.4s' }}>
                              {isWinner ? '✓' : '–'}
                            </td>
                          </React.Fragment>
                        )
                      }

                      // Completed round — show raw score (no ÷100)
                      const bid   = round.bids?.[p.id]
                      const score = round.scores?.[p.id] ?? 0
                      return (
                        <React.Fragment key={p.id}>
                          <td className="border py-0.5 text-center tabular-nums"
                            style={{ borderColor: BORD, color: CBID }}>
                            {bid ?? '–'}
                          </td>
                          <td className="border py-0.5 text-center font-medium tabular-nums"
                            style={{ borderColor: BORD, color: score < 0 ? '#ef4444' : CSCORE }}>
                            {score < 0 ? <HishtMark /> : score}
                          </td>
                        </React.Fragment>
                      )
                    })}
                  </tr>
                )
              })}

              {/* Pulka summary row — only shown once pulka is complete */}
              {pulkaEnd && (() => {
                const { round, snap } = pulkaEnd
                return (
                  <tr style={{ background: BGPUL, borderTop: `1px solid ${BORDP}`, borderBottom: `1px solid ${BORDP}` }}>
                    <td className="border py-1 text-center font-bold text-[10px]"
                      style={{ borderColor: BORDP, color: '#4a9a6a' }}>
                      Σ{pulkaNum}
                    </td>
                    {orderedPlayers.map(p => {
                      const bonus   = round.pulkaScores?.[p.id]?.pulkaBonus
                      const gamePts = snap[p.id] ?? 0
                      const isWinner = typeof bonus === 'number' && bonus > 0
                      const isLoser  = typeof bonus === 'number' && bonus < 0

                      return (
                        <React.Fragment key={p.id}>
                          {/* Premia bonus / erasure cell — ÷100 */}
                          <td className="border py-1 text-center font-bold tabular-nums text-[11px]"
                            style={{ borderColor: BORDP }}>
                            {bonus == null || bonus === 0
                              ? <span style={{ color: CEMPTY }}>–</span>
                              : isWinner
                                ? <span style={{ color: '#4ade80' }}>+{fmtPts(bonus)}</span>
                                : <span style={{ color: '#ef4444', textDecoration: 'line-through' }}>{fmtPts(Math.abs(bonus))}</span>
                            }
                          </td>
                          {/* Running game total — ÷100 */}
                          <td className="border py-1 text-center font-bold tabular-nums"
                            style={{ borderColor: BORDP, color: gamePts < 0 ? '#ef4444' : '#c9a84c' }}>
                            {fmtPts(gamePts)}
                          </td>
                        </React.Fragment>
                      )
                    })}
                  </tr>
                )
              })()}
            </React.Fragment>
          )
        })}
      </tbody>

      {/* Final total row — ÷100 */}
      <tfoot className="sticky bottom-0">
        <tr style={{ background: BGTOT, borderTop: `2px solid #c9a84c` }}>
          <td className="border py-1 text-center font-bold text-[10px]"
            style={{ borderColor: BORD, color: CIDX }}>Σ</td>
          {orderedPlayers.map(p => {
            const raw = finalCumulative[p.id] ?? 0
            return (
              <React.Fragment key={p.id}>
                <td className="border py-0.5 text-center" style={{ borderColor: BORD, color: CEMPTY }}>–</td>
                <td className="border py-0.5 text-center font-bold tabular-nums"
                  style={{ borderColor: BORD, color: raw < 0 ? '#ef4444' : '#c9a84c' }}>
                  {fmtPts(raw)}
                </td>
              </React.Fragment>
            )
          })}
        </tr>
      </tfoot>
    </table>
  )
}
