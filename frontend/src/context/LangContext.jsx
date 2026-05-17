import { createContext, useContext, useState } from 'react'
import translations from '../translations'

const LangContext = createContext(null)

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('joker_lang') ?? 'en')
  const changeLang = (l) => { setLang(l); localStorage.setItem('joker_lang', l) }
  const t = (key, params) => {
    let str = translations[key]?.[lang] ?? translations[key]?.en ?? key
    if (params) Object.entries(params).forEach(([k, v]) => { str = str.replace(`{${k}}`, v) })
    return str
  }
  return <LangContext.Provider value={{ lang, setLang: changeLang, t }}>{children}</LangContext.Provider>
}

export const useLang = () => useContext(LangContext)
export const useT   = () => useContext(LangContext).t
