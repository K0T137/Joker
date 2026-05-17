import { useState, useEffect, useRef } from 'react'
import { useLang } from '../context/LangContext'

const FLAGS      = { en: '🇬🇧', ka: '🇬🇪', ru: '🇷🇺' }
const LABELS     = { en: 'EN',      ka: 'KA',      ru: 'RU'      }
const FULL_NAMES = { en: 'English', ka: 'Georgian', ru: 'Russian' }
const LANGS      = ['en', 'ka', 'ru']

export default function LangToggle({ labeled = false, compact = false }) {
  const { lang, setLang } = useLang()
  const [open, setOpen]   = useState(false)
  const ref               = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (compact) return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: 40, height: 40, padding: 0, borderRadius: '0.625rem',
        background: 'rgba(8,8,12,0.84)', border: '1px solid #2a2a38',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, lineHeight: 1,
      }}>
        {FLAGS[lang]}
      </button>
      {open && (
        <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, background: 'rgba(8,8,12,0.97)', border: '1px solid #2a2a38', borderRadius: '0.625rem', overflow: 'hidden', zIndex: 200, minWidth: 110, boxShadow: '0 8px 24px rgba(0,0,0,0.65)' }}>
          {LANGS.map(l => (
            <button key={l} onClick={() => { setLang(l); setOpen(false) }} style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '9px 13px', background: lang === l ? 'rgba(201,168,76,0.1)' : 'transparent', border: 'none', cursor: 'pointer', color: lang === l ? '#c9a84c' : '#7a7a9a', lineHeight: 1, textAlign: 'left' }}>
              <span style={{ fontSize: 20 }}>{FLAGS[l]}</span>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>{LABELS[l]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )

  const triggerStyle = labeled ? {
    display:       'flex',
    alignItems:    'center',
    gap:           8,
    padding:       '18px 32px',
    borderRadius:  '1rem',
    background:    'var(--ctrl-bg)',
    border:        'var(--ctrl-border)',
    cursor:        'pointer',
    color:         'var(--ctrl-color)',
    fontWeight:    900,
    fontSize:      14,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    boxShadow:     'var(--ctrl-shadow)',
    lineHeight:    1,
  } : {
    display:      'flex',
    alignItems:   'center',
    gap:          6,
    padding:      '7px 11px',
    borderRadius: '0.625rem',
    background:   'rgba(8,8,12,0.84)',
    border:       '1px solid #2a2a38',
    cursor:       'pointer',
    lineHeight:   1,
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setOpen(o => !o)} style={triggerStyle}>
        <span style={{ fontSize: labeled ? 18 : 22 }}>{FLAGS[lang]}</span>
        {labeled
          ? <span>{FULL_NAMES[lang]}</span>
          : <span style={{ fontSize: 12, fontWeight: 700, color: '#9090aa', letterSpacing: '0.08em' }}>{LABELS[lang]}</span>
        }
        <span style={{ fontSize: 9, color: '#4a4a5a', marginLeft: 1 }}>{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div style={{
          position:     'absolute',
          top:          'calc(100% + 6px)',
          left:         0,
          background:   'rgba(8,8,12,0.97)',
          border:       '1px solid #2a2a38',
          borderRadius: '0.625rem',
          overflow:     'hidden',
          zIndex:       200,
          minWidth:     '100%',
          boxShadow:    '0 8px 24px rgba(0,0,0,0.65)',
        }}>
          {LANGS.map(l => (
            <button
              key={l}
              onClick={() => { setLang(l); setOpen(false) }}
              style={{
                display:    'flex',
                alignItems: 'center',
                gap:        9,
                width:      '100%',
                padding:    '9px 13px',
                background: lang === l ? 'rgba(201,168,76,0.1)' : 'transparent',
                border:     'none',
                cursor:     'pointer',
                color:      lang === l ? '#c9a84c' : '#7a7a9a',
                lineHeight: 1,
                textAlign:  'left',
              }}
            >
              <span style={{ fontSize: 20 }}>{FLAGS[l]}</span>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em' }}>{LABELS[l]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
