// components/theme/ThemeProvider.tsx
'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export type Theme = 'light' | 'dark' | 'system'
type Ctx = { theme: Theme; resolved: 'light' | 'dark'; setTheme: (t: Theme) => void; toggle: () => void; mounted: boolean }

export const THEME_KEY = 'eih-theme'
const ThemeContext = createContext<Ctx | null>(null)

const systemPrefersDark = () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches

function apply(resolved: 'light' | 'dark') {
  const el = document.documentElement
  el.classList.toggle('dark', resolved === 'dark')
  el.style.colorScheme = resolved
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system')
  const [resolved, setResolved] = useState<'light' | 'dark'>('light')
  const [mounted, setMounted] = useState(false)

  // Read the saved choice once on the client (the inline script in layout.tsx already applied it before first paint).
  useEffect(() => {
    let saved: Theme = 'system'
    try { const v = localStorage.getItem(THEME_KEY); if (v === 'light' || v === 'dark' || v === 'system') saved = v } catch { /* storage blocked */ }
    setThemeState(saved)
    setResolved(saved === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : saved)
    setMounted(true)
  }, [])

  // Follow the operating system while the choice is "system".
  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => { const r = mq.matches ? 'dark' : 'light'; setResolved(r); apply(r) }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  // Keep several tabs in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== THEME_KEY) return
      const v = (e.newValue as Theme) || 'system'
      const r = v === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : v
      setThemeState(v); setResolved(r); apply(r)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setTheme = useCallback((t: Theme) => {
    const r = t === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : t
    setThemeState(t); setResolved(r); apply(r)
    try { localStorage.setItem(THEME_KEY, t) } catch { /* ignore */ }
  }, [])

  const toggle = useCallback(() => setTheme(resolved === 'dark' ? 'light' : 'dark'), [resolved, setTheme])
  const value = useMemo(() => ({ theme, resolved, setTheme, toggle, mounted }), [theme, resolved, setTheme, toggle, mounted])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): Ctx {
  const c = useContext(ThemeContext)
  if (!c) throw new Error('useTheme must be used inside <ThemeProvider>')
  return c
}