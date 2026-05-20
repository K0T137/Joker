export default function CrownBadge({ show }) {
  if (!show) return null
  return (
    <span
      title="Current #1"
      style={{ fontSize: 11, lineHeight: 1, flexShrink: 0, userSelect: 'none', color: '#c9a84c' }}
    >
      ♛
    </span>
  )
}
