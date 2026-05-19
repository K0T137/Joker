import { createContext, useContext, useState, useCallback } from 'react'
import { DECK_THEMES } from '../components/Card'

export const TABLE_THEMES = [
  { id: 'green',    label: 'Green',    darkSrc: '/table_dark_green.png',    brightSrc: '/table_bright_green.png'    },
  { id: 'blue',     label: 'Blue',     darkSrc: '/table_dark_blue.png',     brightSrc: '/table_bright_blue.png'     },
  { id: 'black',    label: 'Black',    darkSrc: '/table_dark_black.png',    brightSrc: '/table_bright_black.png'    },
  { id: 'burgundy', label: 'Burgundy', darkSrc: '/table_dark_burgundy.png', brightSrc: '/table_bright_burgundy.png' },
  { id: 'purple',   label: 'Purple',   darkSrc: '/table_dark_purple.png',   brightSrc: '/table_bright_purple.png'   },
]

const PrefsContext = createContext(null)

// Tailwind classes for card faces (white background)
const SUIT_CLS_NORMAL = { '♠': 'text-slate-900', '♥': 'text-red-600', '♦': 'text-red-600',  '♣': 'text-slate-900' }
const SUIT_CLS_FOUR   = { '♠': 'text-slate-900', '♥': 'text-red-600', '♦': 'text-blue-700', '♣': 'text-green-700' }

// Hex colors for dark-background UI (game table, overlays, score panel)
const SUIT_HEX_NORMAL = { '♠': '#e8d5a3', '♥': '#ef4444', '♦': '#ef4444', '♣': '#e8d5a3' }
const SUIT_HEX_FOUR   = { '♠': '#e8d5a3', '♥': '#ef4444', '♦': '#3b82f6', '♣': '#22c55e' }

// Hex colors for card face (white background)
const SUIT_CARD_HEX_NORMAL = { '♠': '#0f172a', '♥': '#dc2626', '♦': '#dc2626', '♣': '#0f172a' }
const SUIT_CARD_HEX_FOUR   = { '♠': '#0f172a', '♥': '#dc2626', '♦': '#1d4ed8', '♣': '#15803d' }

export function PrefsProvider({ children }) {
  const [fourColor, setFourColor] = useState(() => localStorage.getItem('joker_4color') === 'true')

  const [deckThemeIdx, setDeckThemeIdx] = useState(() => {
    const id  = localStorage.getItem('joker_deck') ?? 'gold'
    const idx = DECK_THEMES.findIndex(t => t.id === id)
    return idx >= 0 ? idx : 0
  })

  const [tableThemeId, setTableThemeIdState] = useState(
    () => localStorage.getItem('joker_table') ?? 'green'
  )

  const [cardStyle, setCardStyleState] = useState(
    () => localStorage.getItem('joker_cardstyle') ?? 'pixel'
  )

  const setCardStyle = useCallback((style) => {
    localStorage.setItem('joker_cardstyle', style)
    setCardStyleState(style)
  }, [])

  const setTableThemeId = useCallback((id) => {
    localStorage.setItem('joker_table', id)
    setTableThemeIdState(id)
  }, [])

  const cycleTableTheme = useCallback(() => {
    setTableThemeIdState(cur => {
      const idx  = TABLE_THEMES.findIndex(t => t.id === cur)
      const next = TABLE_THEMES[(idx + 1) % TABLE_THEMES.length]
      localStorage.setItem('joker_table', next.id)
      return next.id
    })
  }, [])

  const toggleFourColor = useCallback(() => {
    setFourColor(v => {
      const next = !v
      localStorage.setItem('joker_4color', String(next))
      return next
    })
  }, [])

  const cycleDeckTheme = useCallback(() => {
    setDeckThemeIdx(i => {
      const next = (i + 1) % DECK_THEMES.length
      localStorage.setItem('joker_deck', DECK_THEMES[next].id)
      return next
    })
  }, [])

  const setDeckThemeId = useCallback((id) => {
    const idx = DECK_THEMES.findIndex(t => t.id === id)
    if (idx < 0) return
    localStorage.setItem('joker_deck', id)
    setDeckThemeIdx(idx)
  }, [])

  const suitCls = useCallback((suit) =>
    (fourColor ? SUIT_CLS_FOUR : SUIT_CLS_NORMAL)[suit] ?? 'text-slate-900'
  , [fourColor])

  const suitHex = useCallback((suit) =>
    (fourColor ? SUIT_HEX_FOUR : SUIT_HEX_NORMAL)[suit] ?? '#e8d5a3'
  , [fourColor])

  const suitCardHex = useCallback((suit) =>
    (fourColor ? SUIT_CARD_HEX_FOUR : SUIT_CARD_HEX_NORMAL)[suit] ?? '#0f172a'
  , [fourColor])

  const tableTheme = TABLE_THEMES.find(t => t.id === tableThemeId) ?? TABLE_THEMES[0]

  return (
    <PrefsContext.Provider value={{
      fourColor, toggleFourColor,
      deckThemeIdx, deckTheme: DECK_THEMES[deckThemeIdx], cycleDeckTheme, setDeckThemeId,
      tableTheme, tableThemeId, setTableThemeId, cycleTableTheme,
      cardStyle, setCardStyle,
      suitCls, suitHex, suitCardHex,
    }}>
      {children}
    </PrefsContext.Provider>
  )
}

export function usePrefs() {
  return useContext(PrefsContext)
}
