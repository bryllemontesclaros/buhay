import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext()

const THEME_KEY = 'takda_theme'
const LEGACY_THEME_KEY = 'sentimo_theme'

const safeSet = (key, val) => { try { localStorage.setItem(key, val) } catch {} }

function readStoredTheme() {
  try {
    const next = localStorage.getItem(THEME_KEY) || localStorage.getItem(LEGACY_THEME_KEY)
    if (next === 'dark' || next === 'light') return next
  } catch {}
  return 'light'
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(readStoredTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    safeSet(THEME_KEY, theme)
  }, [theme])

  function toggle() { setTheme(t => t === 'dark' ? 'light' : 'dark') }

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>
}

export function useTheme() { return useContext(ThemeContext) }
