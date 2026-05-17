import React, { useState, useRef, useEffect } from 'react'
import ScoreTable from './ScoreTable'
import Card from './Card'
import { useT } from '../context/LangContext'
import { usePrefs } from '../context/PrefsContext'

const BG   = 'var(--panel-bg)'
const HDR  = 'var(--panel-hdr)'
const BORD = 'var(--panel-bord)'

export default function ScorePanel({ players = [], roundHistory = [], roomId, trump, pulkaNumber, roundNumber, lastTrick = null, gameScores = null, currentBids = null, gameLog = [], dealerPlayerId = null, initialDealerPlayerId = null, chatMessages = [], onSendChat = null, theme = 'dark', onToggleTheme = null, myPlayerId = null, hishtPenalty = null, mobileOpen = false, onMobileClose = null, gameMode = 'normal', trickWinnerId = null }) {
  const t = useT()
  const { suitHex } = usePrefs()
  const [chatInput, setChatInput]   = useState('')
  const chatEndRef                  = useRef(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages.length, gameLog.length])
  const trumpColor = trump && trump !== 'NO_TRUMP' ? suitHex(trump) : '#e8d5a3'
  const trumpLabel = trump === 'NO_TRUMP' ? 'NT' : (trump ?? '–')

  return (
    <div
      className={[
        'score-panel w-80 flex flex-col transition-all duration-200 opacity-75 hover:opacity-100',
        // Mobile: fixed drawer; Desktop: normal flex sibling
        'fixed md:relative md:flex-shrink-0 inset-y-0 right-0 z-50',
        mobileOpen ? 'translate-x-0 opacity-100' : 'translate-x-full md:translate-x-0',
      ].join(' ')}
      style={{ height: '100%', borderLeft: `1px solid ${BORD}`, background: BG }}
    >
      {/* Mobile close button */}
      {onMobileClose && (
        <button
          onClick={onMobileClose}
          className="absolute top-3 left-3 z-10 md:hidden text-base leading-none"
          style={{ color: '#4a4a5a', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          ×
        </button>
      )}
      {/* ── Header ── */}
      <div className="score-panel-hdr px-4 pt-3 pb-2.5 flex-shrink-0" style={{ borderBottom: `1px solid ${BORD}` }}>
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="font-black text-base tracking-[0.12em]"
              style={{ color: '#e8d5a3', fontFamily: "'Playfair Display', Georgia, serif" }}>
              JOKER
            </span>
            <span className="text-xs tracking-[0.18em]"
              style={{ color: '#c9a84c', fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700 }}>
              ჯოკერი
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px]" style={{ color: '#4a4a5a' }}>
            <span className="font-mono" style={{ color: '#3a3a4a' }}>{roomId}</span>
            <span>·</span>
            <span>P{pulkaNumber ?? '–'}/4</span>
            <span>R{roundNumber ?? '–'}</span>
            {trump && (
              <>
                <span>·</span>
                <span className="font-bold text-sm" style={{ color: trumpColor }}>{trumpLabel}</span>
              </>
            )}
            {hishtPenalty && hishtPenalty !== 200 && (
              <>
                <span>·</span>
                <span className="font-mono" style={{ color: '#e05252' }}>H{hishtPenalty / 100}</span>
              </>
            )}
            {gameMode === 'only9' && (
              <>
                <span>·</span>
                <span className="font-mono" style={{ color: '#9b9bc0' }}>9s</span>
              </>
            )}
            <div className="flex items-center gap-1 ml-1" />
          </div>
        </div>
      </div>

      {/* ── Rounds table — fixed height, no scrollbar ── */}
      <div className="flex-shrink-0 overflow-hidden">
        {players.length === 0 ? (
          <p className="text-xs p-4 text-center" style={{ color: 'var(--table-idx-fg)' }}>{t('waiting_game')}</p>
        ) : (
          <ScoreTable
            players={players}
            roundHistory={roundHistory}
            currentRoundNumber={roundNumber}
            currentPulkaNumber={pulkaNumber}
            gameScores={gameScores}
            currentBids={currentBids}
            dealerPlayerId={dealerPlayerId}
            initialDealerPlayerId={initialDealerPlayerId}
            myPlayerId={myPlayerId}
            gameMode={gameMode}
            trickWinnerId={trickWinnerId}
          />
        )}
      </div>

      {/* ── Feed: Game Log + Chat — grows to fill available space ── */}
      <div className="flex-1 min-h-0 flex flex-col" style={{ borderTop: `1px solid ${BORD}`, background: 'var(--panel-bg-deep)' }}>
        <div className="flex-1 min-h-0 px-3 pt-2 pb-1 flex flex-col gap-0.5 overflow-y-auto">
          {gameLog.map((entry, i) => (
            <div key={`log-${entry.id}`} className="text-[10px] leading-relaxed font-mono"
              style={{ color: i === gameLog.length - 1 ? 'var(--panel-text)' : 'var(--table-idx-fg)' }}>
              {entry.text}
            </div>
          ))}
          {chatMessages.map((m) => (
            <div key={`chat-${m.id}`} className="text-[10px] leading-relaxed font-mono flex gap-1.5">
              <span className="font-semibold flex-shrink-0" style={{ color: 'var(--panel-text)' }}>{m.name}:</span>
              <span className="break-all" style={{ color: 'var(--table-idx-fg)' }}>{m.message}</span>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
        {/* Emoji quick-reactions */}
        {onSendChat && (
          <div className="px-2 pt-1 flex gap-1 flex-shrink-0">
            {['👏', '🔥', '💀', '😂', '🃏'].map(em => (
              <button key={em} onClick={() => onSendChat(em)}
                className="text-base rounded-lg transition-all hover:brightness-125 active:scale-90"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}>
                {em}
              </button>
            ))}
          </div>
        )}
        {onSendChat && (
          <div className="px-2 py-1.5 flex gap-1 flex-shrink-0">
            <input
              type="text"
              maxLength={200}
              placeholder={t('chat_ph')}
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && chatInput.trim()) {
                  onSendChat(chatInput.trim())
                  setChatInput('')
                }
              }}
              className="flex-1 px-2 py-1 rounded-lg text-[10px] focus:outline-none"
              style={{ background: 'var(--panel-bg)', border: `1px solid ${BORD}`, color: 'var(--panel-text)', caretColor: '#c9a84c', minWidth: 0 }}
            />
            <button
              onClick={() => { if (chatInput.trim()) { onSendChat(chatInput.trim()); setChatInput('') } }}
              className="px-2 py-1 rounded-lg text-[10px] font-semibold flex-shrink-0 transition-all hover:brightness-125"
              style={{ background: 'var(--panel-hdr)', border: `1px solid ${BORD}`, color: 'var(--panel-text-dim)' }}
            >
              →
            </button>
          </div>
        )}
      </div>

      {/* ── Last Trick ── */}
      {lastTrick?.cards?.length > 0 && (
        <div className="px-3 py-2.5 flex-shrink-0"
          style={{ borderTop: `1px solid ${BORD}`, background: HDR }}>
          <div className="text-[10px] uppercase tracking-widest font-semibold mb-2" style={{ color: 'var(--table-idx-fg)' }}>
            {t('last_trick')}
          </div>
          <div className="flex gap-2 justify-center">
            {lastTrick.cards.map((entry, i) => {
              const p        = players.find(pl => pl.id === entry.playerId)
              const isWinner = entry.playerId === lastTrick.winnerId
              return (
                <div key={i} className="flex flex-col items-center gap-0.5">
                  <Card cardId={entry.card} small selected={isWinner} />
                  <span className="text-[9px] truncate max-w-[46px] text-center leading-tight font-medium"
                    style={{ color: isWinner ? '#c9a84c' : 'var(--panel-text-dim)' }}>
                    {p?.name ?? '?'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
