import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Theme = 'dark' | 'light'

const CUSTOMER_STORAGE_KEY = 'witchyu-customer-theme'
const LEGACY_STORAGE_KEY = 'witchyu-theme'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function getInitialTheme(storageKey: string): Theme {
  if (typeof window === 'undefined') return 'dark'

  const saved = window.localStorage.getItem(storageKey)
  if (saved === 'light' || saved === 'dark') return saved

  // ย้ายค่าธีมเดิมไปใช้กับ Customer เท่านั้น
  if (storageKey === CUSTOMER_STORAGE_KEY) {
    const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY)
    if (legacy === 'light' || legacy === 'dark') return legacy
  }

  return 'dark'
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
}

export function ThemeProvider({
  children,
  storageKey = CUSTOMER_STORAGE_KEY,
}: {
  children: ReactNode
  storageKey?: string
}) {
  const [theme, setThemeState] = useState<Theme>(() => getInitialTheme(storageKey))

  useEffect(() => {
    applyTheme(theme)
    window.localStorage.setItem(storageKey, theme)
  }, [theme, storageKey])

  const setTheme = (next: Theme) => {
    setThemeState(next)
  }

  const toggleTheme = () => {
    setThemeState((current) => (current === 'dark' ? 'light' : 'dark'))
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider')
  }

  return context
}
