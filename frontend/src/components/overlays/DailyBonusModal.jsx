import { useState } from 'react'
import { useT } from '../../context/LangContext'

const STREAK_TOTAL = 7

export default function DailyBonusModal({ bonus, onClose }) {
  const t = useT()
  const [streak,       setStreak]       = useState(bonus.streak)
  const [restoreState, setRestoreState] = useState('idle') // idle | loading | done | error

  const isWeekly      = bonus.weeklyBonus > 0
  const canRestore    = bonus.restoreEligible && bonus.restoreStreakValue > 1 && restoreState === 'idle'
  const restoreTarget = bonus.restoreStreakValue + 1

  async function handleRestore() {
    setRestoreState('loading')
    try {
      const token = localStorage.getItem('joker_token')
      const res   = await fetch('/api/auth/restore-streak', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) {
        setStreak(data.newStreak)
        setRestoreState('done')
      } else {
        setRestoreState(data.error === 'insufficient_tokens' ? 'error_tokens' : 'error')
      }
    } catch {
      setRestoreState('error')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
    >
      <div style={{
        background: 'rgba(8,8,18,0.98)',
        border: '1px solid rgba(201,168,76,0.3)',
        borderRadius: '1.5rem',
        width: 'min(92vw,380px)',
        padding: '32px 28px 28px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
        textAlign: 'center',
      }}>

        {/* Icon */}
        <div style={{ fontSize: 52, lineHeight: 1 }}>{isWeekly ? '🏆' : '🎉'}</div>

        {/* Title */}
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#c9a84c', fontFamily: 'Georgia, serif' }}>
            {isWeekly ? t('daily_weekly_title') : t('daily_welcome')}
          </div>
          <div style={{ fontSize: 13, color: '#6a7a9a', marginTop: 4 }}>
            {t('daily_reward')}
          </div>
        </div>

        {/* Token reward */}
        <div style={{
          background: 'rgba(201,168,76,0.1)',
          border: '1px solid rgba(201,168,76,0.25)',
          borderRadius: 14,
          padding: '12px 28px',
        }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#c9a84c' }}>{t('daily_tokens')}</div>
          {isWeekly && (
            <div style={{ fontSize: 14, fontWeight: 700, color: '#4ade80', marginTop: 4 }}>{t('daily_weekly_bonus')}</div>
          )}
        </div>

        {/* Streak dots */}
        <div style={{ width: '100%' }}>
          <div style={{ fontSize: 12, color: '#6a7a9a', marginBottom: 10 }}>{t('daily_streak_label')}</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
            {Array.from({ length: STREAK_TOTAL }).map((_, i) => {
              const filled = i < streak
              const isToday = i === streak - 1
              return (
                <div key={i} style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: filled
                    ? isToday
                      ? isWeekly ? '#4ade80' : '#c9a84c'
                      : 'rgba(201,168,76,0.4)'
                    : 'rgba(255,255,255,0.05)',
                  border: filled ? 'none' : '1px solid rgba(255,255,255,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700,
                  color: filled ? '#0a0a0f' : '#2a3a56',
                  transition: 'all 0.3s',
                }}>
                  {filled ? (isToday && isWeekly ? '★' : '✓') : i + 1}
                </div>
              )
            })}
          </div>
          <div style={{ fontSize: 11, color: '#4a5570', marginTop: 8 }}>
            {streak < STREAK_TOTAL ? t('daily_streak_goal') : ''}
          </div>
        </div>

        {/* Restore offer */}
        {bonus.restoreEligible && restoreState !== 'done' && (
          <div style={{
            width: '100%',
            background: 'rgba(239,68,68,0.06)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 12,
            padding: '12px 16px',
          }}>
            <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 8 }}>{t('daily_missed')}</div>
            {restoreState === 'idle' && (
              <div style={{ fontSize: 11, color: '#8a9ab8', marginBottom: 10 }}>
                {t('daily_restore_offer').replace('{n}', bonus.restoreStreakValue)}
              </div>
            )}
            {restoreState === 'error_tokens' && (
              <div style={{ fontSize: 11, color: '#ef4444', marginBottom: 10 }}>{t('daily_no_tokens')}</div>
            )}
            {restoreState !== 'error_tokens' && canRestore && (
              <button
                onClick={handleRestore}
                disabled={restoreState === 'loading'}
                style={{
                  width: '100%', height: 38, borderRadius: 10,
                  background: 'rgba(201,168,76,0.15)',
                  border: '1px solid rgba(201,168,76,0.4)',
                  color: '#c9a84c', fontSize: 12, fontWeight: 700,
                  cursor: restoreState === 'loading' ? 'wait' : 'pointer',
                }}
              >
                {restoreState === 'loading' ? '…' : t('daily_restore_btn')}
              </button>
            )}
          </div>
        )}

        {restoreState === 'done' && (
          <div style={{ fontSize: 13, color: '#4ade80', fontWeight: 700 }}>
            ✓ {t('daily_restore_done')} ({streak}/{STREAK_TOTAL})
          </div>
        )}

        {/* CTA */}
        <button
          onClick={onClose}
          style={{
            width: '100%', height: 48, borderRadius: 14,
            background: isWeekly ? '#4ade80' : '#c9a84c',
            color: '#0a0a0f', fontSize: 15, fontWeight: 700,
            border: 'none', cursor: 'pointer',
          }}
        >
          {t('daily_cta')}
        </button>
      </div>
    </div>
  )
}
