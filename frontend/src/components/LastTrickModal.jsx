import Card from './Card'

export default function LastTrickModal({ trick, players, onClose }) {
  if (!trick?.cards?.length) return null

  const getName = (id) => players.find(p => p.id === id)?.name ?? id

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-600 rounded-2xl p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-center text-slate-300 text-sm font-semibold mb-4">
          Last Trick — Won by{' '}
          <span className="text-yellow-400">{getName(trick.winnerId)}</span>
        </div>

        <div className="flex gap-4 justify-center">
          {trick.cards.map(({ playerId, card }) => (
            <div key={playerId} className="flex flex-col items-center gap-1.5">
              <Card cardId={card} />
              <span className={`text-xs font-medium truncate max-w-[64px] text-center
                ${playerId === trick.winnerId ? 'text-yellow-400' : 'text-slate-400'}`}>
                {getName(playerId)}
              </span>
            </div>
          ))}
        </div>

        <div className="text-center mt-4">
          <button
            onClick={onClose}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
