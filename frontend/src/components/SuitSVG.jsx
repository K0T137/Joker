export default function SuitSVG({ suit, size, color }) {
  const s = { display: 'block', flexShrink: 0 }
  if (suit === '♥') return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={s} aria-hidden="true">
      <path d="M50,88 C28,72 5,55 5,32 C5,14 16,3 30,3 C38,3 45,7 50,15 C55,7 62,3 70,3 C84,3 95,14 95,32 C95,55 72,72 50,88 Z" fill={color} />
    </svg>
  )
  if (suit === '♦') return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={s} aria-hidden="true">
      <path d="M50,4 L96,50 L50,96 L4,50 Z" fill={color} />
    </svg>
  )
  if (suit === '♠') return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={s} aria-hidden="true">
      <path d="M50,6 C62,16 95,32 95,54 C95,70 78,76 62,70 C67,80 66,88 65,93 L35,93 C34,88 33,80 38,70 C22,76 5,70 5,54 C5,32 38,16 50,6 Z" fill={color} />
    </svg>
  )
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={s} aria-hidden="true">
      <circle cx="50" cy="32" r="22" fill={color} />
      <circle cx="28" cy="62" r="22" fill={color} />
      <circle cx="72" cy="62" r="22" fill={color} />
      <path d="M43,68 L40,93 L60,93 L57,68 Z" fill={color} />
    </svg>
  )
}
