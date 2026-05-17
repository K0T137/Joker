import { useT } from '../context/LangContext'

export default function BiddingPhase({ onBidSubmit, myBid, cardCount = 0, isMyTurn, forbiddenBid = null, equalizeBid = null, compact = false, mobile = false, currentBidderName = '' }) {
  const t = useT()
  const placed = myBid !== null && myBid !== undefined

  if (placed) {
    return (
      <div className="flex items-center justify-center gap-3 py-2">
        <span className="text-sm font-semibold" style={{ color: '#c9a84c' }}>{t('bid_placed')} {myBid}</span>
        <span className="text-gray-500 text-xs">{t('bid_others_wait')}</span>
      </div>
    )
  }

  const btnCls = mobile
    ? 'w-11 h-11 rounded-xl font-bold text-base transition-all duration-100 active:scale-95'
    : compact
      ? 'w-8 h-8 rounded-lg font-bold text-xs transition-all duration-100 active:scale-95'
      : 'w-10 h-10 rounded-xl font-bold text-sm transition-all duration-100 active:scale-95'

  return (
    <div className="flex flex-col items-center gap-1.5 py-1">
      <div className="flex items-center gap-2">
        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: isMyTurn ? '#c9a84c' : '#4b5563' }}>
          {isMyTurn ? t('place_bid') : t('bid_waiting', { name: currentBidderName })}
        </div>
        {isMyTurn && equalizeBid != null && (
          <div className="text-[10px] uppercase tracking-wide" style={{ color: 'rgba(201,168,76,0.55)' }}>
            · <span style={{ color: '#c9a84c', fontWeight: 700 }}>{equalizeBid}</span>↑
          </div>
        )}
      </div>

      <div className={`flex ${compact ? 'gap-1' : 'gap-1.5'} flex-wrap justify-center`}>
        {Array.from({ length: cardCount + 1 }, (_, i) => i).map(i => {
          const isForbidden = isMyTurn && forbiddenBid !== null && i === forbiddenBid
          const isEqualize  = isMyTurn && equalizeBid !== null && i === equalizeBid && !isForbidden
          const inactive    = !isMyTurn || isForbidden

          let style
          if (isForbidden) {
            style = { background: 'rgba(31,31,40,0.25)', color: '#252535', cursor: 'not-allowed' }
          } else if (isEqualize) {
            style = {
              background: 'rgba(201,168,76,0.15)',
              color:      '#c9a84c',
              border:     '1px solid rgba(201,168,76,0.5)',
              boxShadow:  '0 0 8px rgba(201,168,76,0.2)',
              cursor:     'pointer',
            }
          } else if (!isMyTurn) {
            style = { background: 'rgba(31,31,40,0.25)', color: '#252535', cursor: 'not-allowed' }
          } else {
            style = { background: '#1f2937', color: '#d1d5db', boxShadow: '0 2px 8px rgba(0,0,0,0.4)', cursor: 'pointer' }
          }

          return (
            <button key={i} onClick={() => !inactive && onBidSubmit(i)} disabled={inactive} className={btnCls} style={style}>
              {i}
            </button>
          )
        })}
      </div>
    </div>
  )
}
