import { useEffect, useState } from 'react'

const ICON  = { dark: '🌙', light: '☀' }
const TITLE = { dark: 'Switch to day mode', light: 'Switch to night mode' }

function getStoredTheme() {
  const stored = localStorage.getItem('joker_theme') ?? 'dark'
  return stored === 'auto' ? 'dark' : stored
}

export function useTheme() {
  const [theme, setTheme] = useState(getStoredTheme)

  useEffect(() => {
    localStorage.setItem('joker_theme', theme)
    document.documentElement.dataset.theme = theme
  }, [theme])

  return [theme, setTheme]
}

const LABEL = { dark: 'Dark', light: 'Light' }

export default function ThemeToggle({ theme, onToggle, labeled = false, style = {} }) {
  const icon  = ICON[theme]  ?? '🌙'
  const label = LABEL[theme] ?? 'Dark'
  const title = TITLE[theme] ?? 'Toggle theme'

  if (labeled) {
    return (
      <button
        onClick={onToggle}
        title={title}
        style={{
          display:        'flex',
          alignItems:     'center',
          gap:            8,
          padding:        '18px 32px',
          borderRadius:   '1rem',
          background:     'var(--ctrl-bg)',
          border:         'var(--ctrl-border)',
          cursor:         'pointer',
          color:          'var(--ctrl-color)',
          fontWeight:     900,
          fontSize:       14,
          letterSpacing:  '0.14em',
          textTransform:  'uppercase',
          boxShadow:      'var(--ctrl-shadow)',
          lineHeight:     1,
          ...style,
        }}
      >
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span>{label}</span>
      </button>
    )
  }

  return (
    <button
      onClick={onToggle}
      title={title}
      style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        width:          58,
        height:         38,
        padding:        0,
        borderRadius:   '0.625rem',
        background:     'rgba(8,8,12,0.84)',
        border:         '1px solid #2a2a38',
        cursor:         'pointer',
        fontSize:       20,
        lineHeight:     1,
        ...style,
      }}
    >
      {icon}
    </button>
  )
}
