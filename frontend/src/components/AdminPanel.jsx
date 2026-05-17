import { useState } from 'react'

// Dev-only debug panel — only rendered when import.meta.env.DEV is true
export default function AdminPanel({ socket, roomId }) {
  const [open,      setOpen]      = useState(false)
  const [stateJson, setStateJson] = useState(null)
  const [loading,   setLoading]   = useState(false)

  const fetchState = () => {
    setLoading(true)
    socket?.emit('debug_get_state', { roomId }, (res) => {
      setLoading(false)
      if (res?.success) setStateJson(JSON.stringify(res.state, null, 2))
      else setStateJson('Error: ' + (res?.error ?? 'unknown'))
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-[9px] px-2 py-1 rounded-md"
        style={{ background: 'rgba(8,8,12,0.8)', border: '1px solid #3a1a3a', color: '#8a4a8a' }}
        title="Open debug panel"
      >
        ⚙ DEV
      </button>
    )
  }

  return (
    <div
      className="absolute top-4 right-4 z-50 flex flex-col gap-2 p-3 rounded-xl"
      style={{ background: 'rgba(8,8,12,0.96)', border: '1px solid #3a1a3a', minWidth: 260, maxWidth: 360 }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#8a4a8a' }}>Debug Panel</span>
        <button onClick={() => { setOpen(false); setStateJson(null) }} style={{ color: '#3a3a4a', fontSize: 12 }}>✕</button>
      </div>

      <div className="flex flex-wrap gap-1">
        <button
          onClick={fetchState}
          disabled={loading}
          className="text-[10px] px-2.5 py-1 rounded-lg transition-all hover:brightness-125"
          style={{ background: '#1a1a24', border: '1px solid #2a2a38', color: '#9b9bc0' }}
        >
          {loading ? '…' : 'Dump state'}
        </button>
      </div>

      {stateJson && (
        <pre
          className="text-[9px] overflow-auto rounded-lg p-2"
          style={{ background: '#0d0d14', color: '#6a6a8a', maxHeight: 320, border: '1px solid #1a1a28' }}
        >
          {stateJson}
        </pre>
      )}

      <p className="text-[9px]" style={{ color: '#2a2a3a' }}>DEV only — not visible in production</p>
    </div>
  )
}
